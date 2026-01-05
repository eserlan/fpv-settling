import { Service, OnStart } from "@flamework/core";
const Workspace = game.GetService("Workspace");
const TweenService = game.GetService("TweenService");

import { ServerEvents } from "../ServerEvents";
import * as Logger from "shared/Logger";
import * as TileKey from "shared/TileKey";
import { TileOwnershipManager } from "./TileOwnershipManager";
import type { GameState } from "../GameState";
import { NetworkUtils } from "../NetworkUtils";

type RobberState = {
	currentQ: number;
	currentR: number;
	pulsesSinceSeven: number;
};

@Service({})
export class RobberManager implements OnStart {
	private State: RobberState = {
		currentQ: 0,
		currentR: 0,
		pulsesSinceSeven: 0,
	};

	private RobberModel: Model | undefined;
	private DesertLocation = { Q: 0, R: 0, Position: new Vector3(0, 0, 0) };

	constructor(private tileOwnershipManager: TileOwnershipManager) { }

	onStart() {
		Logger.Info("RobberManager", "Initializing Robber...");
		this.FindDesert();
		this.CreateRobberModel();
		this.MoveRobber(this.DesertLocation.Q, this.DesertLocation.R, true);
	}

	private FindDesert() {
		const mapFolder = Workspace.FindFirstChild("Map");
		if (!mapFolder) return;

		for (const tile of mapFolder.GetChildren()) {
			if (tile.IsA("Model") && tile.PrimaryPart) {
				const tileType = tile.PrimaryPart.GetAttribute("TileType") as string;
				if (tileType === "Desert") {
					const q = tile.PrimaryPart.GetAttribute("Q") as number;
					const r = tile.PrimaryPart.GetAttribute("R") as number;
					this.DesertLocation = { Q: q, R: r, Position: tile.PrimaryPart.Position };
					Logger.Info("RobberManager", `Desert found at ${q}, ${r}`);
					break;
				}
			}
		}
	}

	private CreateRobberModel() {
		if (this.RobberModel) return;

		const model = new Instance("Model");
		model.Name = "Robber";

		const SCALE = 1.6; // Slightly larger than players
		const bodyColor = Color3.fromRGB(0, 0, 0); // Pure black

		// HumanoidRootPart - this will be our primary part and anchored
		const root = new Instance("Part");
		root.Name = "HumanoidRootPart";
		root.Size = new Vector3(2 * SCALE, 2 * SCALE, 1 * SCALE);
		root.Transparency = 1;
		root.CanCollide = false;
		root.Anchored = true;
		root.Parent = model;

		// Torso
		const torso = new Instance("Part");
		torso.Name = "Torso";
		torso.Size = new Vector3(2 * SCALE, 2 * SCALE, 1 * SCALE);
		torso.Color = bodyColor;
		torso.Material = Enum.Material.Slate;
		torso.CanCollide = false;
		torso.Anchored = false;
		torso.Parent = model;

		// Head
		const head = new Instance("Part");
		head.Name = "Head";
		head.Size = new Vector3(1.2 * SCALE, 1.2 * SCALE, 1.2 * SCALE);
		head.Color = bodyColor;
		head.CanCollide = false;
		head.Anchored = false;
		head.Parent = model;

		// Evil Face
		const face = new Instance("Decal");
		face.Name = "face";
		face.Texture = "rbxassetid://7074749"; // Evil grin
		face.Face = Enum.NormalId.Front;
		face.Parent = head;

		// Arms and Legs
		const limbParts: Part[] = [];
		const names = ["Left Arm", "Right Arm", "Left Leg", "Right Leg"];
		const armLegSize = new Vector3(1 * SCALE, 2 * SCALE, 1 * SCALE);

		for (const name of names) {
			const p = new Instance("Part");
			p.Name = name;
			p.Size = armLegSize;
			p.Color = bodyColor;
			p.CanCollide = false;
			p.Anchored = false;
			p.Parent = model;
			limbParts.push(p);
		}

		// Initial relative positioning
		torso.CFrame = new CFrame(0, 0, 0);
		root.CFrame = torso.CFrame;
		head.CFrame = torso.CFrame.mul(new CFrame(0, 1.6 * SCALE, 0));
		(model.FindFirstChild("Left Arm") as BasePart).CFrame = torso.CFrame.mul(new CFrame(-1.5 * SCALE, 0, 0));
		(model.FindFirstChild("Right Arm") as BasePart).CFrame = torso.CFrame.mul(new CFrame(1.5 * SCALE, 0, 0));
		(model.FindFirstChild("Left Leg") as BasePart).CFrame = torso.CFrame.mul(new CFrame(-0.5 * SCALE, -2 * SCALE, 0));
		(model.FindFirstChild("Right Leg") as BasePart).CFrame = torso.CFrame.mul(new CFrame(0.5 * SCALE, -2 * SCALE, 0));

		// Weld all parts to Root
		const weldParts = (p1: BasePart) => {
			const weld = new Instance("WeldConstraint");
			weld.Part0 = root;
			weld.Part1 = p1;
			weld.Parent = root;
		};
		weldParts(torso);
		weldParts(head);
		for (const p of limbParts) weldParts(p);

		// Smoke effect on torso
		const emitter = new Instance("ParticleEmitter");
		emitter.Texture = "rbxassetid://243098098";
		emitter.Color = new ColorSequence(Color3.fromRGB(10, 10, 10));
		emitter.Size = new NumberSequence([new NumberSequenceKeypoint(0, 5), new NumberSequenceKeypoint(1, 12)]);
		emitter.Transparency = new NumberSequence([new NumberSequenceKeypoint(0, 0.3), new NumberSequenceKeypoint(1, 1)]);
		emitter.Rate = 20;
		emitter.Lifetime = new NumberRange(1, 2.5);
		emitter.Speed = new NumberRange(2, 5);
		emitter.Parent = torso;

		// Label
		const billboard = new Instance("BillboardGui");
		billboard.Size = new UDim2(0, 150, 0, 60);
		billboard.StudsOffset = new Vector3(0, 8, 0);
		billboard.AlwaysOnTop = true;
		billboard.Parent = head;

		const label = new Instance("TextLabel");
		label.Size = new UDim2(1, 0, 1, 0);
		label.BackgroundTransparency = 1;
		label.Text = "😈 THE ROBBER";
		label.TextColor3 = Color3.fromRGB(255, 30, 30);
		label.Font = Enum.Font.GothamBlack;
		label.TextSize = 24;
		label.TextStrokeTransparency = 0;
		label.Parent = billboard;

		model.PrimaryPart = root;
		model.Parent = Workspace;
		this.RobberModel = model;
	}

	public MoveRobber(q: number, r: number, instant = false) {
		this.CreateRobberModel();
		this.State.currentQ = q;
		this.State.currentR = r;

		const mapFolder = Workspace.FindFirstChild("Map");
		let targetPos = this.DesertLocation.Position;

		if (mapFolder) {
			for (const tile of mapFolder.GetChildren()) {
				if (tile.IsA("Model") && tile.PrimaryPart) {
					const tQ = tile.PrimaryPart.GetAttribute("Q") as number;
					const tR = tile.PrimaryPart.GetAttribute("R") as number;
					if (tQ === q && tR === r) {
						targetPos = tile.PrimaryPart.Position;
						break;
					}
				}
			}
		}

		if (!this.RobberModel || !this.RobberModel.PrimaryPart) return;

		// Position slightly floating above the tile
		const endCFrame = new CFrame(targetPos.add(new Vector3(0, 12, 0))).mul(CFrame.Angles(0, math.pi, 0));

		if (instant) {
			this.RobberModel.PivotTo(endCFrame);
		} else {
			const info = new TweenInfo(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
			const tween = TweenService.Create(this.RobberModel.PrimaryPart as BasePart, info, { CFrame: endCFrame });
			tween.Play();
		}

		Logger.Info("RobberManager", `Robber moved to ${q}, ${r}`);
	}

	public ResetToDesert() {
		Logger.Info("RobberManager", "Robber returning to desert (Reset)");
		this.MoveRobber(this.DesertLocation.Q, this.DesertLocation.R);
		NetworkUtils.Broadcast(ServerEvents.SystemMessageEvent, "🕊️ The Robber has returned to the Desert.");
	}

	public SetDesertLocation(q: number, r: number, position: Vector3) {
		this.DesertLocation = { Q: q, R: r, Position: position };
		this.MoveRobber(q, r, true);
	}

	public GetRobberPosition() {
		return { Q: this.State.currentQ, R: this.State.currentR };
	}

	public OnSevenRolled(gameState: GameState) {
		Logger.Info("RobberManager", "7 Rolled! Executing Robber Logic...");

		// 1. DISCARD PENALTY (The "Mass Theft")
		// Anyone holding 8 or more resource cards must discard half (rounded down).
		for (const [userId, playerData] of pairs(gameState.PlayerData)) {
			const total = playerData.ResourceManager.GetTotalResourceCount();
			if (total >= 8) {
				const toRemove = math.floor(total / 2);
				playerData.ResourceManager.RemoveRandomResources(toRemove);
				NetworkUtils.Broadcast(
					ServerEvents.SystemMessageEvent,
					`🏴‍☠️ [THE ROBBER] ${playerData.Player.Name} was caught with ${total} cards! The Robber snatched away ${toRemove} resources!`,
				);
			}
		}

		// 2. TARGETED THEFT
		// Find the leader to move the robber to their best tile (Automated logic)
		let leader: (typeof gameState.PlayerData)[number] | undefined;
		let maxVP = -1;

		for (const [userId, playerData] of pairs(gameState.PlayerData)) {
			let vp = 0;
			// VP from towns and cities
			for (const b of playerData.Towns) vp += b.Type === "City" ? 2 : 1;
			// VP from largest army/longest road could be added here if implemented
			if (vp > maxVP) {
				maxVP = vp;
				leader = playerData;
			}
		}

		if (!leader) {
			Logger.Warn("RobberManager", "No players found, Robber stays put.");
			return;
		}

		// Identify where the Robber should go (best tile of the leader)
		const ownedTileKeys = this.tileOwnershipManager.GetPlayerTiles(leader.Player);
		let bestTile: { q: number; r: number; score: number } | undefined;
		const mapFolder = Workspace.FindFirstChild("Map");

		if (mapFolder) {
			for (const key of ownedTileKeys) {
				const { q, r } = TileKey.parseTileKey(key);
				let diceNumber = 0;
				for (const tile of mapFolder.GetChildren()) {
					if (tile.IsA("Model") && tile.PrimaryPart) {
						if (tile.PrimaryPart.GetAttribute("Q") === q && tile.PrimaryPart.GetAttribute("R") === r) {
							diceNumber = (tile.PrimaryPart.GetAttribute("DiceNumber") as number) ?? 0;
							break;
						}
					}
				}
				if (diceNumber === 0) continue;

				// Score based on probability (6/8 are best)
				let score = 1;
				if (diceNumber === 6 || diceNumber === 8) score = 10;
				else if (diceNumber === 5 || diceNumber === 9) score = 5;

				// Avoid staying on the same tile if possible
				if (q === this.State.currentQ && r === this.State.currentR) score -= 100;

				if (!bestTile || score > bestTile.score) bestTile = { q, r, score };
			}
		}

		if (bestTile) {
			this.MoveRobber(bestTile.q, bestTile.r);
			NetworkUtils.Broadcast(ServerEvents.SystemMessageEvent, `🏴‍☠️ The Robber has moved to block a high-value tile!`);

			// Identify all potential victims on this tile
			const owners = this.tileOwnershipManager.GetTileOwners(bestTile.q, bestTile.r);
			const uniqueVictimIds = new Set<number>();
			for (const owner of owners) {
				uniqueVictimIds.add(owner.playerUserId);
			}

			// Convert Set to array to pick randomly
			const victimsList: number[] = [];
			for (const id of uniqueVictimIds) {
				const victimData = gameState.PlayerData[id];
				if (victimData && victimData.ResourceManager.GetTotalResourceCount() > 0) {
					victimsList.push(id);
				}
			}

			if (victimsList.size() > 0) {
				const randomVictimId = victimsList[math.random(0, victimsList.size() - 1)];
				const victim = gameState.PlayerData[randomVictimId];

				if (victim) {
					const stolen = victim.ResourceManager.RemoveRandomResources(1);
					if (stolen.size() > 0) {
						const resourceName = stolen[0];
						NetworkUtils.Broadcast(
							ServerEvents.SystemMessageEvent,
							`🏴‍☠️ The Robber pillaged ${victim.Player.Name} and stole a resource!`,
						);
						Logger.Info("RobberManager", `Stole ${resourceName} from ${victim.Player.Name}`);
					}
				}
			}
		}
	}
}
