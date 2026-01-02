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

		const part = new Instance("Part");
		part.Name = "Body";
		part.Size = new Vector3(4, 8, 4);
		part.Shape = Enum.PartType.Cylinder;
		part.Color = Color3.fromRGB(50, 50, 50);
		part.Material = Enum.Material.Slate;
		part.Anchored = true;
		part.CanCollide = false;
		part.CFrame = new CFrame(0, 0, 0).mul(CFrame.Angles(0, 0, math.rad(90)));
		part.Parent = model;

		const emitter = new Instance("ParticleEmitter");
		emitter.Texture = "rbxassetid://243098098";
		emitter.Color = new ColorSequence(Color3.fromRGB(20, 20, 20));
		emitter.Size = new NumberSequence([new NumberSequenceKeypoint(0, 5), new NumberSequenceKeypoint(1, 10)]);
		emitter.Transparency = new NumberSequence([new NumberSequenceKeypoint(0, 0.5), new NumberSequenceKeypoint(1, 1)]);
		emitter.Rate = 20;
		emitter.Lifetime = new NumberRange(2, 4);
		emitter.Parent = part;

		const billboard = new Instance("BillboardGui");
		billboard.Size = new UDim2(0, 100, 0, 50);
		billboard.StudsOffset = new Vector3(0, 6, 0);
		billboard.AlwaysOnTop = true;
		billboard.Parent = part;

		const label = new Instance("TextLabel");
		label.Size = new UDim2(1, 0, 1, 0);
		label.BackgroundTransparency = 1;
		label.Text = "☠️ ROBBER";
		label.TextColor3 = Color3.fromRGB(200, 50, 50);
		label.Font = Enum.Font.GothamBlack;
		label.TextSize = 20;
		label.Parent = billboard;

		model.PrimaryPart = part;
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

		const endCFrame = new CFrame(targetPos.add(new Vector3(0, 5, 0))).mul(CFrame.Angles(0, 0, math.rad(90)));

		if (instant) {
			this.RobberModel.SetPrimaryPartCFrame(endCFrame);
		} else {
			const info = new TweenInfo(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
			const tween = TweenService.Create(this.RobberModel.PrimaryPart, info, { CFrame: endCFrame });
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

		for (const [userId, playerData] of pairs(gameState.PlayerData)) {
			const total = playerData.ResourceManager.GetTotalResourceCount();
			if (total > 7) {
				const toRemove = math.floor(total / 2);
				playerData.ResourceManager.RemoveRandomResources(toRemove);
				NetworkUtils.FireClient(playerData.Player, ServerEvents.SystemMessageEvent, `🏴‍☠️ Robber Penalty! You lost ${toRemove} resources.`);
			}
		}

		let leader: typeof gameState.PlayerData[number] | undefined;
		let maxVP = -1;

		for (const [userId, playerData] of pairs(gameState.PlayerData)) {
			let vp = 0;
			for (const b of playerData.BuildingManager.GetSettlements()) vp += (b.Type === "City" ? 2 : 1);
			if (vp > maxVP) {
				maxVP = vp;
				leader = playerData;
			}
		}

		if (!leader) {
			Logger.Warn("RobberManager", "No leader found, Robber stays put.");
			return;
		}

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

				let score = 1;
				if (diceNumber === 6 || diceNumber === 8) score = 10;
				else if (diceNumber === 5 || diceNumber === 9) score = 5;

				if (q === this.State.currentQ && r === this.State.currentR) score -= 100;
				if (!bestTile || score > bestTile.score) bestTile = { q, r, score };
			}
		}

		if (bestTile) {
			this.MoveRobber(bestTile.q, bestTile.r);
			NetworkUtils.Broadcast(ServerEvents.SystemMessageEvent, `🏴‍☠️ The Robber blocked ${leader.Player.Name}'s tile!`);
			leader.ResourceManager.RemoveRandomResources(1);
		}
	}
}
