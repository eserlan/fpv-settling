// Robber Manager
// Handles the "7-Pulse" Logic: Hand Checks, Target Selection, and Physical Movement

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Workspace = game.GetService("Workspace");
const TweenService = game.GetService("TweenService");

import * as Logger from "shared/Logger";
import * as TileKey from "shared/TileKey";
import TileOwnershipManager = require("./TileOwnershipManager");
import type { GameState } from "./GameState";

// Events
const events = (ReplicatedStorage.FindFirstChild("Events") as Folder) ?? new Instance("Folder", ReplicatedStorage);
const SystemMessageEvent = (events.FindFirstChild("SystemMessageEvent") as RemoteEvent) ?? new Instance("RemoteEvent", events);

// Types
type RobberState = {
	currentQ: number;
	currentR: number;
	pulsesSinceSeven: number;
};

const RobberManager = {
	State: {
		currentQ: 0,
		currentR: 0,
		pulsesSinceSeven: 0,
	} as RobberState,

	RobberModel: undefined as Model | undefined,
	DesertLocation: { Q: 0, R: 0, Position: new Vector3(0, 0, 0) },

	Initialize() {
		Logger.Info("RobberManager", "Initializing Robber...");
		this.FindDesert();
		this.CreateRobberModel();
		this.MoveRobber(this.DesertLocation.Q, this.DesertLocation.R, true);
	},

	// Find the desert tile to set as home
	FindDesert() {
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
	},

	// Create physical Robber representation
	CreateRobberModel() {
		if (this.RobberModel) return;

		const model = new Instance("Model");
		model.Name = "Robber";

		const part = new Instance("Part");
		part.Name = "Body";
		part.Size = new Vector3(4, 8, 4);
		part.Shape = Enum.PartType.Cylinder; // Placeholder shape
		part.Color = Color3.fromRGB(50, 50, 50); // Dark grey/black
		part.Material = Enum.Material.Slate;
		part.Anchored = true;
		part.CanCollide = false; // Don't block physical movement of players
		// Orient cylinder upright
		part.CFrame = new CFrame(0, 0, 0).mul(CFrame.Angles(0, 0, math.rad(90)));
		part.Parent = model;

		// Add "Blockade Zone" visual
		const emitter = new Instance("ParticleEmitter");
		emitter.Texture = "rbxassetid://243098098"; // Generic smoke/cloud
		emitter.Color = new ColorSequence(Color3.fromRGB(20, 20, 20));
		emitter.Size = new NumberSequence([new NumberSequenceKeypoint(0, 5), new NumberSequenceKeypoint(1, 10)]);
		emitter.Transparency = new NumberSequence([new NumberSequenceKeypoint(0, 0.5), new NumberSequenceKeypoint(1, 1)]);
		emitter.Rate = 20;
		emitter.Lifetime = new NumberRange(2, 4);
		emitter.Parent = part;

		// Hover billboard
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
	},

	// Move Robber to specific Hex
	MoveRobber(q: number, r: number, instant = false) {
		this.State.currentQ = q;
		this.State.currentR = r;

		if (!this.RobberModel || !this.RobberModel.PrimaryPart) return;

		// Find target tile position
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

		const endCFrame = new CFrame(targetPos.add(new Vector3(0, 5, 0))).mul(CFrame.Angles(0, 0, math.rad(90)));

		if (instant) {
			this.RobberModel.SetPrimaryPartCFrame(endCFrame);
		} else {
			// Tween movement
			const info = new TweenInfo(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
			const tween = TweenService.Create(this.RobberModel.PrimaryPart, info, { CFrame: endCFrame });
			tween.Play();
		}

		Logger.Info("RobberManager", `Robber moved to ${q}, ${r}`);
	},

	ResetToDesert() {
		Logger.Info("RobberManager", "Robber returning to desert (Reset)");
		this.MoveRobber(this.DesertLocation.Q, this.DesertLocation.R);
		SystemMessageEvent.FireAllClients("🕊️ The Robber has returned to the Desert.");
	},

	GetRobberPosition() {
		return { Q: this.State.currentQ, R: this.State.currentR };
	},

	// Main logic trigger
	OnSevenRolled(gameState: GameState) {
		Logger.Info("RobberManager", "7 Rolled! Executing Robber Logic...");

		// 1. Hand Check (Drop half if > 7)
		for (const [userId, playerData] of pairs(gameState.PlayerData)) {
			const total = playerData.ResourceManager.GetTotalResourceCount();
			if (total > 7) {
				const toRemove = math.floor(total / 2);
				playerData.ResourceManager.RemoveRandomResources(toRemove);
				SystemMessageEvent.FireClient(playerData.Player, `🏴‍☠️ Robber Penalty! You lost ${toRemove} resources.`);
			}
		}

		// 2. Identify Leader
		let leader: typeof gameState.PlayerData[number] | undefined;
		let maxVP = -1;

		for (const [userId, playerData] of pairs(gameState.PlayerData)) {
			let vp = 0;
			// Calculate VP: Settlement=1, City=2
			for (const b of playerData.BuildingManager.GetSettlements()) {
				vp += (b.Type === "City" ? 2 : 1);
			}

			if (vp > maxVP) {
				maxVP = vp;
				leader = playerData;
			}
		}

		if (!leader) {
			Logger.Warn("RobberManager", "No leader found (no players?), Robber stays put.");
			return;
		}

		Logger.Info("RobberManager", `Leader identified: ${leader.Player.Name} with ${maxVP} VP`);

		// 3. Find Target Hex
		// Look for leader's most productive tile (6 or 8 prefered)
		const ownedTileKeys = TileOwnershipManager.GetPlayerTiles(leader.Player);
		let bestTile: { q: number; r: number; score: number } | undefined;

		const mapFolder = Workspace.FindFirstChild("Map");

		if (mapFolder) {
			for (const key of ownedTileKeys) {
				const { q, r } = TileKey.parseTileKey(key);

				// Find physical tile to get DiceNumber
				let diceNumber = 0;
				// Need to scan map - inefficient but safe without direct map lookup
				// Optimization: Could store dice numbers in a lookup in PulseManager and expose it
				for (const tile of mapFolder.GetChildren()) {
					if (tile.IsA("Model") && tile.PrimaryPart) {
						const tQ = tile.PrimaryPart.GetAttribute("Q");
						const tR = tile.PrimaryPart.GetAttribute("R");
						if (tQ === q && tR === r) {
							diceNumber = (tile.PrimaryPart.GetAttribute("DiceNumber") as number) ?? 0;
							break;
						}
					}
				}

				if (diceNumber === 0) continue; // Desert or invalid

				// Score: 6 or 8 = 10 points. 5,9 = 5 points. Others = 1 point.
				let score = 1;
				if (diceNumber === 6 || diceNumber === 8) score = 10;
				else if (diceNumber === 5 || diceNumber === 9) score = 5;

				// Don't move to where it already is if possible, unless it's the ONLY option
				if (q === this.State.currentQ && r === this.State.currentR) {
					score -= 100;
				}

				if (!bestTile || score > bestTile.score) {
					bestTile = { q, r, score };
				}
			}
		}

		if (bestTile) {
			// 4. Move Robber
			this.MoveRobber(bestTile.q, bestTile.r);
			SystemMessageEvent.FireAllClients(`🏴‍☠️ The Robber blocked ${leader.Player.Name}'s tile!`);

			// 5. Automated Theft
			const stolen = leader.ResourceManager.RemoveRandomResources(1);
			if (stolen.size() > 0) {
				Logger.Info("RobberManager", `Robber stole ${stolen[0]} from ${leader.Player.Name}`);
				// Optional: Inform leader specifically what was lost
			}
		} else {
			Logger.Info("RobberManager", "Leader has no tiles to target.");
			// Maybe move to a random tile or back to desert?
			// For now, do nothing
		}
	}
};

export = RobberManager;
