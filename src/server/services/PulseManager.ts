import { Service, OnTick, OnStart } from "@flamework/core";
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");

import TileTypes from "shared/TileTypes";
import ResourceTypes from "shared/ResourceTypes";
import { ServerEvents } from "../ServerEvents";
import * as Logger from "shared/Logger";
import { RobberManager } from "./RobberManager";
import { TileOwnershipManager } from "./TileOwnershipManager";
import type { GameState } from "../GameState";

const PULSE_INTERVAL = 60;
const DICE_ROLL_DURATION = 3;
const NUMBER_DISTRIBUTION = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

@Service({})
export class PulseManager implements OnStart, OnTick {
	private pulseTimer = PULSE_INTERVAL;
	private isRolling = false;
	private waitTimer = 0;
	private tileNumbers: Record<string, number> = {};
	private gameStarted = false;
	private GameManagerRef: GameState | undefined;
	private pulsesSinceLastSeven = 0;

	private rng = new Random();

	constructor(private robberManager: RobberManager, private tileOwnershipManager: TileOwnershipManager) { }

	onStart() {
		Logger.Info("PulseManager", "Initialized - Waiting for players to place settlements...");
	}

	onTick(deltaTime: number) {
		if (this.isRolling) return;

		if (!this.gameStarted) {
			this.waitTimer += deltaTime;
			if (this.waitTimer >= 1) {
				this.waitTimer = 0;
				if (this.allPlayersReady()) {
					this.gameStarted = true;
					this.pulseTimer = PULSE_INTERVAL;
					Logger.Info("PulseManager", "All players ready! Starting pulse timer...");
					ServerEvents.TimerEvent.broadcast(math.floor(this.pulseTimer));
				} else {
					ServerEvents.TimerEvent.broadcast(-1);
				}
			}
		} else {
			this.pulseTimer -= deltaTime;
			if (math.floor(this.pulseTimer) < math.floor(this.pulseTimer + deltaTime)) {
				ServerEvents.TimerEvent.broadcast(math.floor(this.pulseTimer));
			}
		}

		if (this.pulseTimer <= 0) {
			this.ExecutePulse();
		}
	}

	public AssignTileNumbers() {
		const mapFolder = game.Workspace.FindFirstChild("Map");
		if (!mapFolder) return;

		const numbers = [...NUMBER_DISTRIBUTION];
		for (let i = numbers.size(); i >= 2; i -= 1) {
			const j = math.random(1, i);
			const swapIndex = j - 1;
			const currentIndex = i - 1;
			const temp = numbers[currentIndex];
			numbers[currentIndex] = numbers[swapIndex];
			numbers[swapIndex] = temp;
		}

		let numberIndex = 0;
		for (const tile of mapFolder.GetChildren()) {
			if (tile.IsA("Model") && tile.PrimaryPart) {
				const tileType = tile.PrimaryPart.GetAttribute("TileType") as string | undefined;
				if (tileType !== "Desert") {
					const q = tile.PrimaryPart.GetAttribute("Q") as number;
					const r = tile.PrimaryPart.GetAttribute("R") as number;
					const key = `${q}_${r}`;
					const number = numbers[numberIndex] ?? numbers[0];
					this.tileNumbers[key] = number;
					tile.PrimaryPart.SetAttribute("DiceNumber", number);

					const labelGui = tile.PrimaryPart.FindFirstChild("TileLabel");
					if (labelGui && labelGui.IsA("BillboardGui")) {
						const diceLabel = labelGui.FindFirstChild("DiceNumber");
						if (diceLabel && diceLabel.IsA("TextLabel")) {
							diceLabel.Text = `🎲 ${number}`;
							if (number === 6 || number === 8) diceLabel.TextColor3 = Color3.fromRGB(255, 100, 100);
						}
					}
					numberIndex = (numberIndex % numbers.size()) + 1;
				}
			}
		}
		Logger.Info("PulseManager", "Assigned numbers to tiles");
	}

	public ExecutePulse() {
		if (this.isRolling) return;
		this.isRolling = true;

		const die1 = this.rng.NextInteger(1, 6);
		const die2 = this.rng.NextInteger(1, 6);
		const total = die1 + die2;

		Logger.Info("PulseManager", `THE PULSE! Rolled ${die1} + ${die2} = ${total}`);
		ServerEvents.PulseEvent.broadcast("RollStart", die1, die2, total);

		task.wait(DICE_ROLL_DURATION);

		if (total === 7) {
			this.pulsesSinceLastSeven = 0;
			ServerEvents.PulseEvent.broadcast("Robber");
			ServerEvents.SystemMessageEvent.broadcast("🏴‍☠️ [THE ROBBER] A 7 was rolled! No resources dropped this pulse.");
			if (this.GameManagerRef) this.robberManager.OnSevenRolled(this.GameManagerRef);
		} else {
			this.pulsesSinceLastSeven++;
			if (this.pulsesSinceLastSeven > 5) this.robberManager.ResetToDesert();

			const matchingTiles = this.GetMatchingTiles(total);
			const spawnedResources: Record<string, number> = {};
			const robberPos = this.robberManager.GetRobberPosition();

			for (const tile of matchingTiles) {
				const tileQ = tile.PrimaryPart?.GetAttribute("Q") as number;
				const tileR = tile.PrimaryPart?.GetAttribute("R") as number;
				if (robberPos.Q === tileQ && robberPos.R === tileR) continue;

				const tileType = tile.PrimaryPart?.GetAttribute("TileType") as string | undefined;
				if (!tileType) continue;
				const [resourceKey, resourceData] = ResourceTypes.GetByTileType(tileType);
				if (resourceKey && resourceData) {
					// Spawn one resource for EVERY unique owner
					const owners = this.tileOwnershipManager.GetTileOwners(tileQ, tileR);
					const uniqueOwners = new Set<number>();

					for (const owner of owners) {
						if (!uniqueOwners.has(owner.playerUserId)) {
							uniqueOwners.add(owner.playerUserId);
							this.SpawnResource(tile, resourceKey, resourceData);
							spawnedResources[resourceKey] = (spawnedResources[resourceKey] ?? 0) + 1;
						}
					}
				}
			}

			if (matchingTiles.size() > 0) {
				const resourceList = new Array<string>();
				for (const [resource, count] of pairs(spawnedResources)) {
					const data = ResourceTypes.Get(resource);
					resourceList.push(`${count}x ${data?.Icon ?? ""} ${resource}`);
				}
				ServerEvents.SystemMessageEvent.broadcast(`🎲 [ROLL: ${total}] Resources dropped: ${resourceList.join(", ")}`);
			} else {
				ServerEvents.SystemMessageEvent.broadcast(`🎲 [ROLL: ${total}] No matching tiles.`);
			}
			ServerEvents.PulseEvent.broadcast("RollComplete", die1, die2, total, matchingTiles.size());
		}

		this.isRolling = false;
		this.pulseTimer = PULSE_INTERVAL;
		this.GameManagerRef?.UpdateScores();
	}

	private GetMatchingTiles(diceTotal: number) {
		const matching = new Array<Model>();
		const mapFolder = game.Workspace.FindFirstChild("Map");
		if (!mapFolder) return matching;

		for (const tile of mapFolder.GetChildren()) {
			if (tile.IsA("Model") && tile.PrimaryPart) {
				const number = tile.PrimaryPart.GetAttribute("DiceNumber");
				if (number === diceTotal) matching.push(tile);
			}
		}
		return matching;
	}

	private SpawnResource(tile: Model, resourceKey: string, resourceData: import("shared/ResourceTypes").ResourceInfo) {
		const tilePos = tile.PrimaryPart!.Position;
		const angle = math.random() * math.pi * 2;
		const dist = math.random(5, 20);
		const spawnPos = tilePos.add(new Vector3(math.cos(angle) * dist, 50, math.sin(angle) * dist));

		const resource = new Instance("Part");
		resource.Name = `Resource_${resourceKey}`;
		resource.Size = new Vector3(3, 3, 3);
		resource.Position = spawnPos;
		resource.Color = resourceData.Color;
		resource.Material = resourceData.Material;
		resource.Anchored = false;
		resource.CanCollide = true;
		resource.SetAttribute("ResourceType", resourceKey);
		resource.SetAttribute("Amount", 1);
		resource.SetAttribute("TileQ", tile.PrimaryPart!.GetAttribute("Q"));
		resource.SetAttribute("TileR", tile.PrimaryPart!.GetAttribute("R"));
		resource.SetAttribute("SpawnTime", os.time());

		const light = new Instance("PointLight");
		light.Color = resourceData.Color;
		light.Brightness = 2;
		light.Range = 8;
		light.Parent = resource;

		const resourcesFolder = (game.Workspace.FindFirstChild("Resources") as Folder) ?? new Instance("Folder", game.Workspace);
		resourcesFolder.Name = "Resources";
		resource.Parent = resourcesFolder;
	}

	private allPlayersReady() {
		if (!this.GameManagerRef) return false;

		const playerDataMap = this.GameManagerRef.PlayerData;
		let count = 0;

		for (const [userId, playerData] of pairs(playerDataMap)) {
			count++;
			if (!playerData.BuildingManager || !playerData.BuildingManager.HasPlacedFirstSettlement) {
				return false;
			}
		}

		return count > 0; // Don't start if no one is in the game
	}

	public SetGameManager(gm: GameState) {
		this.GameManagerRef = gm;
	}

	public GetTimer() {
		return this.pulseTimer;
	}

	public ForcePulse() {
		this.pulseTimer = 0;
	}
}
