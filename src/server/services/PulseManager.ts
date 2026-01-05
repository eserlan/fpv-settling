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
import { ServerGameState } from "./ServerGameState";

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
	private readyPlayers = new Set<number>();

	private rng = new Random();

	constructor(private robberManager: RobberManager, private tileOwnershipManager: TileOwnershipManager, private serverGameState: ServerGameState) { }

	onStart() {
		Logger.Info("PulseManager", "Initialized - Waiting for players to place towns...");
	}

	onTick(deltaTime: number) {
		if (this.isRolling) return;

		if (!this.gameStarted) {
			this.waitTimer += deltaTime;
			if (this.waitTimer >= 1) {
				this.waitTimer = 0;
				// During setup phase, we just broadcast -1 to indicate game hasn't "started" its pulse cycle
				ServerEvents.TimerEvent.broadcast(-1);
			}
			return;
		} else {
			this.pulseTimer -= deltaTime;
			if (math.floor(this.pulseTimer) < math.floor(this.pulseTimer + deltaTime)) {
				ServerEvents.TimerEvent.broadcast(math.floor(this.pulseTimer));
				this.BroadcastReadyStatus();
			}

			// Check if all players are ready to skip wait
			if (this.pulseTimer > 5 && this.allPlayersVotedReady()) {
				Logger.Info("PulseManager", "All players ready for next pulse! Skipping wait...");
				this.pulseTimer = 0;
			}
		}

		if (this.pulseTimer <= 0) {
			this.ExecutePulse();
		}
	}

	private allPlayersVotedReady(): boolean {
		if (!this.GameManagerRef) return false;

		const playerDataMap = this.GameManagerRef.PlayerData;
		let totalPlayers = 0;
		let readyCount = 0;

		for (const [userId, playerData] of pairs(playerDataMap)) {
			totalPlayers++;
			const entity = playerData.Player;

			if (!typeIs(entity, "Instance")) {
				// AI is ready if Idle and no tasks
				const ai = entity as import("../AIPlayer").AIPlayer;
				if (ai.State === "Idle" && ai.GetTaskQueueSize() === 0) {
					readyCount++;
				}
			} else {
				// Humans must explicitly vote
				if (this.readyPlayers.has(userId as number)) {
					readyCount++;
				}
			}
		}

		return totalPlayers > 0 && readyCount === totalPlayers;
	}

	public SetPlayerReady(userId: number, ready: boolean) {
		if (ready) {
			this.readyPlayers.add(userId);
		} else {
			this.readyPlayers.delete(userId);
		}
		this.BroadcastReadyStatus();
	}

	private BroadcastReadyStatus() {
		if (!this.GameManagerRef) return;

		const playerDataMap = this.GameManagerRef.PlayerData;
		let totalPlayers = 0;
		let readyCount = 0;

		for (const [userId, playerData] of pairs(playerDataMap)) {
			totalPlayers++;
			const entity = playerData.Player;
			if (!typeIs(entity, "Instance")) {
				const ai = entity as import("../AIPlayer").AIPlayer;
				if (ai.State === "Idle" && ai.GetTaskQueueSize() === 0) {
					readyCount++;
				}
			} else if (this.readyPlayers.has(userId as number)) {
				readyCount++;
			}
		}

		ServerEvents.PulseVotesUpdate.broadcast(readyCount, totalPlayers);
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
				if (tileType !== "Desert" && tileType !== "Sea") {
					const q = tile.PrimaryPart.GetAttribute("Q") as number;
					const r = tile.PrimaryPart.GetAttribute("R") as number;
					const key = `${q}_${r}`;
					const number = numbers[numberIndex] ?? numbers[0];
					this.tileNumbers[key] = number;
					tile.PrimaryPart.SetAttribute("DiceNumber", number);
					this.serverGameState.UpdateTileDice(q, r, number);

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
		ServerEvents.DiceRollStarted.broadcast(die1, die2, total);

		task.wait(DICE_ROLL_DURATION);

		if (total === 7) {
			this.pulsesSinceLastSeven = 0;
			ServerEvents.RobberEvent.broadcast();
			ServerEvents.SystemMessageEvent.broadcast("🏴‍☠️ [THE ROBBER] A 7 was rolled! No resources dropped this pulse.");
			if (this.GameManagerRef) this.robberManager.OnSevenRolled(this.GameManagerRef);
		} else {
			this.pulsesSinceLastSeven++;
			if (this.pulsesSinceLastSeven > 5) this.robberManager.ResetToDesert();

			const matchingTiles = this.GetMatchingTiles(total);
			const spawnedResources: Record<string, number> = {};
			const playerDrops: Record<number, Record<string, number>> = {};
			const robberPos = this.robberManager.GetRobberPosition();

			for (const tile of matchingTiles) {
				const tileQ = tile.PrimaryPart?.GetAttribute("Q") as number;
				const tileR = tile.PrimaryPart?.GetAttribute("R") as number;
				if (robberPos.Q === tileQ && robberPos.R === tileR) continue;

				const tileType = tile.PrimaryPart?.GetAttribute("TileType") as string | undefined;
				if (!tileType) continue;
				const [resourceKey, resourceData] = ResourceTypes.GetByTileType(tileType);
				if (resourceKey && resourceData) {
					// Spawn one resource for EVERY town/city adjacent to this tile
					const owners = this.tileOwnershipManager.GetTileOwners(tileQ, tileR);

					for (const owner of owners) {
						this.SpawnResource(tile, resourceKey, resourceData, owner.playerUserId);
						spawnedResources[resourceKey] = (spawnedResources[resourceKey] ?? 0) + 1;

						if (!playerDrops[owner.playerUserId]) playerDrops[owner.playerUserId] = {};
						playerDrops[owner.playerUserId][resourceKey] = (playerDrops[owner.playerUserId][resourceKey] ?? 0) + 1;
					}
				}
			}

			// Only announce if resources actually dropped (someone owns the tiles)
			let totalDropped = 0;
			for (const [_, count] of pairs(spawnedResources)) {
				totalDropped += count;
			}

			if (totalDropped > 0) {
				const resourceList = new Array<string>();
				for (const [resource, count] of pairs(spawnedResources)) {
					const data = ResourceTypes.Get(resource);
					resourceList.push(`${count}x ${data?.Icon ?? ""} ${resource}`);
				}
				ServerEvents.SystemMessageEvent.broadcast(`🎲 [ROLL: ${total}] ${resourceList.join(", ")}`);
			}
			ServerEvents.DiceRollCompleted.broadcast(die1, die2, total, matchingTiles.size());
		}

		this.isRolling = false;
		this.pulseTimer = PULSE_INTERVAL;
		this.readyPlayers.clear();
		this.BroadcastReadyStatus();
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

	private SpawnResource(tile: Model, resourceKey: string, resourceData: import("shared/ResourceTypes").ResourceInfo, ownerUserId: number) {
		const tilePos = tile.PrimaryPart!.Position;
		const angle = math.random() * math.pi * 2;
		const dist = math.random(5, 20);
		const spawnPos = tilePos.add(new Vector3(math.cos(angle) * dist, 50, math.sin(angle) * dist));

		const guid = `Res_${game.GetService("HttpService").GenerateGUID(false)}`;
		const resource = new Instance("Part");
		resource.Name = guid;
		resource.SetAttribute("ResourceGuid", guid);
		resource.Position = spawnPos;
		resource.Color = resourceData.Color;
		resource.Material = Enum.Material.Neon; // Glow!
		resource.Anchored = false;
		resource.CanCollide = true;
		resource.CollisionGroup = "Resources";
		resource.SetAttribute("ResourceType", resourceKey);
		resource.SetAttribute("Amount", 1);
		resource.SetAttribute("OwnerId", ownerUserId);

		const particles = new Instance("ParticleEmitter");
		particles.Color = new ColorSequence(resourceData.Color);
		particles.Size = new NumberSequence(0.5, 0);
		particles.Transparency = new NumberSequence(0.5, 1);
		particles.Lifetime = new NumberRange(1, 2);
		particles.Speed = new NumberRange(1, 2);
		particles.Rate = 5;
		particles.Parent = resource;

		const tileQ = tile.PrimaryPart!.GetAttribute("Q") as number;
		const tileR = tile.PrimaryPart!.GetAttribute("R") as number;
		resource.SetAttribute("TileQ", tileQ);
		resource.SetAttribute("TileR", tileR);
		resource.SetAttribute("SpawnTime", os.time());

		const light = new Instance("PointLight");
		light.Color = resourceData.Color;
		light.Brightness = 5; // Increased from 2
		light.Range = 12; // Increased from 8
		light.Shadows = true;
		light.Parent = resource;

		const highlight = new Instance("Highlight");
		highlight.FillColor = resourceData.Color;
		highlight.OutlineColor = Color3.fromRGB(255, 255, 255);
		highlight.FillTransparency = 0.5;
		highlight.OutlineTransparency = 0;
		highlight.Adornee = resource;
		highlight.Parent = resource;

		const billboard = new Instance("BillboardGui");
		billboard.Name = "ResourceLabel";
		billboard.Size = new UDim2(4, 0, 1, 0);
		billboard.StudsOffset = new Vector3(0, 3, 0);
		billboard.AlwaysOnTop = true;
		billboard.MaxDistance = 100;
		billboard.Parent = resource;

		const label = new Instance("TextLabel");
		label.Size = new UDim2(1, 0, 1, 0);
		label.BackgroundTransparency = 1;
		label.Text = `${resourceData.Icon} ${resourceKey}`;
		label.TextColor3 = Color3.fromRGB(255, 255, 255);
		label.TextStrokeTransparency = 0;
		label.TextScaled = true;
		label.Font = Enum.Font.GothamBold;
		label.Parent = billboard;

		const resourcesFolder = (game.Workspace.FindFirstChild("Resources") as Folder) ?? new Instance("Folder", game.Workspace);
		resourcesFolder.Name = "Resources";
		resource.Parent = resourcesFolder;

		// Notify clients about the new resource
		ServerEvents.ResourceSpawned.broadcast(resourceKey, spawnPos, tileQ, tileR);

		this.serverGameState.RegisterResource(guid, resourceKey, ownerUserId, spawnPos);
		Logger.Info("PulseManager", `Registered resource ${resourceKey} for owner ${ownerUserId} (GUID: ${guid})`);
	}


	public StartGame() {
		this.gameStarted = true;
		this.pulseTimer = 0; // Trigger immediate first pulse after setup
		Logger.Info("PulseManager", "Pulse Phase Started with immediate roll!");
		ServerEvents.TimerEvent.broadcast(0);
	}

	public SetGameManager(gm: GameState) {
		this.GameManagerRef = gm;
	}

	public GetTimer() {
		return this.gameStarted ? this.pulseTimer : -1;
	}

	public ForcePulse() {
		this.pulseTimer = 0;
	}
}
