import { OnStart, Service } from "@flamework/core";

const Players = game.GetService("Players");
const RunService = game.GetService("RunService");

import ResourceManager = require("../ResourceManager");
import BuildingManager = require("../BuildingManager");
import NPCManager = require("../NPCManager");
import ResearchManager = require("../ResearchManager");
import PortManager = require("../PortManager");
import { MapGenerator } from "./MapGenerator";
import { PulseManager } from "./PulseManager";
import { CollectionManager } from "./CollectionManager";
import { TileOwnershipManager } from "./TileOwnershipManager";
import { MarketManager } from "./MarketManager";
import { LobbyGeneratorService } from "./LobbyGeneratorService";
import ResourceTypes from "shared/ResourceTypes";
import LogService = require("../LogService");
import type { PlayerData } from "../PlayerData";
import type { GameState } from "../GameState";
import * as Logger from "shared/Logger";
import { ServerEvents } from "../ServerEvents";
import { AIPlayer } from "../AIPlayer";
import type { GameEntity } from "shared/GameEntity";
import { NetworkUtils } from "../NetworkUtils";
import { SkillLevel } from "shared/GameTypes";

const PLAYER_COLORS = [
	Color3.fromRGB(255, 80, 80),   // Red
	Color3.fromRGB(80, 80, 255),   // Blue
	Color3.fromRGB(240, 240, 240), // White
	Color3.fromRGB(255, 160, 20),  // Orange
	Color3.fromRGB(80, 255, 80),   // Green
	Color3.fromRGB(180, 80, 255),  // Purple
];

@Service({})
export class GameService implements OnStart, GameState {
	public PlayerData: Record<number, PlayerData> = {};
	private isGameStarted = false;
	private readonly MIN_PLAYERS_TO_START = 1;
	private readonly TARGET_PLAYER_COUNT = 4; // AI fill target
	private isSetupPhase = false;
	private setupSequence: { userId: number, step: "Town1" | "Road1" | "Town2" | "Road2" }[] = [];
	private currentSetupIndex = 0;
	private lastPlacedTownPos: Vector3 | undefined;
	private nextColorIndex = 0;

	constructor(
		private mapGenerator: MapGenerator,
		private pulseManager: PulseManager,
		private collectionManager: CollectionManager,
		private tileOwnershipManager: TileOwnershipManager,
		private lobbyGenerator: LobbyGeneratorService,
		private marketManager: MarketManager,
	) { }

	onStart() {
		void LogService;

		Logger.Info("Server", "===========================================");
		Logger.Info("Server", "FPV Settling - Server Starting");
		Logger.Info("Server", "===========================================");

		this.lobbyGenerator.GenerateLobby();
		this.pulseManager.SetGameManager(this);

		this.marketManager.OnOfferPosted = (offer) => {
			for (const [_, playerData] of pairs(this.PlayerData)) {
				const entity = playerData.Player;
				if (!typeIs(entity, "Instance")) { // Is AI
					(entity as AIPlayer).EvaluateMarketOffer(offer, playerData, this.marketManager);
				}
			}
		};

		Players.PlayerAdded.Connect((player) => this.handlePlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.handlePlayerRemoving(player));

		ServerEvents.SetupPlacement.connect((player, buildingType, position) => {
			this.OnSetupPlacement(player.UserId, buildingType, position);
		});

		for (const player of Players.GetPlayers()) {
			this.handlePlayerAdded(player);
		}

		RunService.Heartbeat.Connect((deltaTime) => this.handleHeartbeat(deltaTime));

		Logger.Info("GameManager", "Game Manager initialized!");
		Logger.Info("Server", "===========================================");
		Logger.Info("Server", "Server ready! Waiting for players...");
		Logger.Info("Server", "===========================================");
	}

	public StartRoomGame(entities: { userId: number, name: string, isAI: boolean, skill?: SkillLevel }[]) {
		if (this.isGameStarted) {
			Logger.Warn("GameManager", "Game already in progress. Resetting state for new room...");
			// Ideally we'd have multiple instances, but for now we reset.
			this.isGameStarted = false;
			// Clear existing units/buildings? (Out of scope for this simple refactor)
		}

		this.isGameStarted = true;
		Logger.Info("GameManager", `Starting Room Game with ${entities.size()} entities...`);

		// Shuffle entities for random snake draft order
		for (let i = entities.size() - 1; i > 0; i--) {
			const j = math.random(0, i);
			const temp = entities[i];
			entities[i] = entities[j];
			entities[j] = temp;
		}
		// Generate the real map
		this.mapGenerator.Generate();
		this.pulseManager.AssignTileNumbers();

		// Setup players and AI
		for (const e of entities) {
			if (e.isAI) {
				const aiPlayer = new AIPlayer(e.userId, e.name, e.skill ?? "Intermediate");
				const color = this.getNextColor(); // AI gets a color too
				this.initializePlayerData(aiPlayer, color);
				aiPlayer.Spawn(new Vector3(math.random(-50, 50), 150, math.random(-50, 50)));
			} else {
				const player = Players.GetPlayerByUserId(e.userId);
				if (player) {
					// Player Data is already initialized on join
					const character = player.Character;
					if (character) character.PivotTo(new CFrame(0, 150, 0));
				}
			}

			const playerData = this.PlayerData[e.userId];
			if (playerData) {
				playerData.PortManager.SetPortLocations(this.mapGenerator.GetPortLocations());
			}
		}

		NetworkUtils.Broadcast(ServerEvents.GameStart);
		this.UpdateScores();

		// Delay setup phase slightly to ensure all clients have processed GameStart
		task.delay(1, () => {
			this.StartSetupPhase(entities.map(e => e.userId));
		});
	}

	public StartGame() {
		if (this.isGameStarted) return;
		this.isGameStarted = true;
		Logger.Info("GameManager", "Starting Global Game...");

		// Generate the real map
		this.mapGenerator.Generate();
		this.pulseManager.AssignTileNumbers();

		// Spawn AI Players to fill lobby
		const humanCount = Players.GetPlayers().size();
		const aiNeeded = math.max(0, this.TARGET_PLAYER_COUNT - humanCount);
		this.SpawnAIPlayers(aiNeeded);

		// Teleport all players (Real and AI)
		for (const [userId, playerData] of pairs(this.PlayerData)) {
			const entity = playerData.Player;

			if (!typeIs(entity, "Instance")) { // Is AI
				const ai = entity as AIPlayer;
				// AI Spawn logic
				ai.Spawn(new Vector3(math.random(-50, 50), 150, math.random(-50, 50)));
			} else {
				const player = entity as Player;
				const character = player.Character;
				if (character) {
					character.PivotTo(new CFrame(0, 150, 0));
				}
			}

			// Refresh port manager locations for everyone
			playerData.PortManager.SetPortLocations(this.mapGenerator.GetPortLocations());
		}

		NetworkUtils.Broadcast(ServerEvents.GameStart);
		this.UpdateScores();

		// Start setup phase for everyone currently in-game
		const ids = new Array<number>();
		for (const [id] of pairs(this.PlayerData)) {
			ids.push(id as number);
		}

		task.delay(1, () => {
			this.StartSetupPhase(ids);
		});

		Logger.Info("GameManager", "Global Game Started with Setup Phase!");
	}

	private SpawnAIPlayers(count: number) {
		Logger.Info("GameManager", `Spawning ${count} AI players...`);
		const skills: SkillLevel[] = ["Beginner", "Intermediate", "Expert"];

		for (let i = 1; i <= count; i++) {
			const aiId = -i; // Negative IDs for AI
			const skill = skills[math.random(0, skills.size() - 1)]; // Random skill
			const aiName = `AI_${skill}_${i}`;

			const aiPlayer = new AIPlayer(aiId, aiName, skill);
			const color = this.getNextColor();
			this.initializePlayerData(aiPlayer, color);

			Logger.Info("GameManager", `Spawned AI: ${aiName} (${skill})`);
		}
	}

	private initializePlayerData(entity: GameEntity, color: Color3) {
		const resourceManager = new ResourceManager(entity);
		const buildingManager = new BuildingManager(entity, color, resourceManager, this.mapGenerator, this.tileOwnershipManager);
		const npcManager = new NPCManager(entity, resourceManager);
		const researchManager = new ResearchManager(entity, resourceManager);
		const portManager = new PortManager(entity, resourceManager);

		// Register with collection manager for inventory tracking
		this.collectionManager.RegisterEntity(entity, resourceManager);

		// If game already started, get ports immediately
		if (this.isGameStarted) {
			portManager.SetPortLocations(this.mapGenerator.GetPortLocations());
		}

		buildingManager.SetPortManager(portManager);

		this.PlayerData[entity.UserId] = {
			Player: entity,
			ResourceManager: resourceManager,
			BuildingManager: buildingManager,
			NPCManager: npcManager,
			ResearchManager: researchManager,
			PortManager: portManager,
			TileOwnershipManager: this.tileOwnershipManager,
			GameTime: 0,
			PulseTimer: 0,
			Towns: [],
			NeedsFirstTown: true,
			Score: 0,
			Color: color,
		};
	}

	private getNextColor(): Color3 {
		const color = PLAYER_COLORS[this.nextColorIndex % PLAYER_COLORS.size()];
		this.nextColorIndex++;
		return color;
	}

	private handlePlayerAdded(player: Player) {
		Logger.Info("GameManager", `Player joined: ${player.Name}`);

		// Initialize player data first so ResourceManager exists
		const color = this.getNextColor();
		this.initializePlayerData(player, color);

		// Then init collection with the resource manager
		const playerData = this.PlayerData[player.UserId];
		if (playerData) {
			this.collectionManager.InitPlayer(player, playerData.ResourceManager);
		}

		// Notify all clients about the new player
		NetworkUtils.Broadcast(ServerEvents.PlayerJoined, player.UserId, player.Name, false);

		player.CharacterAdded.Connect((character) => {
			const humanoid = character.WaitForChild("Humanoid") as Humanoid;
			humanoid.WalkSpeed = 16;

			if (!this.isGameStarted) {
				// Teleport to Lobby
				character.PivotTo(new CFrame(0, 103, 0));
			} else {
				// Late joiner spawn
				character.PivotTo(new CFrame(0, 150, 0));
			}

			const playerData = this.PlayerData[player.UserId];
			if (playerData && playerData.NeedsFirstTown) {
				Logger.Info("GameManager", `${player.Name} needs to place first town (Press B)`);
			}
		});

		// If game already started, tell the player
		if (this.isGameStarted) {
			NetworkUtils.FireClient(player, ServerEvents.GameStart);
		}
	}

	private handlePlayerRemoving(player: Player) {
		Logger.Info("GameManager", `Player leaving: ${player.Name}`);

		// Notify all clients about the player leaving
		NetworkUtils.Broadcast(ServerEvents.PlayerLeft, player.UserId, player.Name);

		this.collectionManager.RemovePlayer(player);
		delete this.PlayerData[player.UserId];

		// Player removal cleanup finished
	}

	private handleHeartbeat(deltaTime: number) {
		const pulseTimer = this.pulseManager.GetTimer();

		for (const [userId, playerData] of pairs(this.PlayerData)) {
			playerData.GameTime += deltaTime;
			playerData.PulseTimer = pulseTimer;
			playerData.BuildingManager.UpdateBuildings(deltaTime);
			playerData.NPCManager.UpdateNPCs(deltaTime);
			playerData.ResearchManager.UpdateResearch(deltaTime);

			if (playerData.GameTime % 60 < deltaTime) {
				playerData.NPCManager.PayMaintenance(1);
			}

			// Update AI Logic
			const entity = playerData.Player;
			if (!typeIs(entity, "Instance")) { // Is AI
				(entity as AIPlayer).Update(deltaTime, playerData, this.mapGenerator, this.marketManager);
			}
		}

	}

	public UpdateScores() {
		const scores: { userId: number; name: string; score: number }[] = [];

		for (const [userId, playerData] of pairs(this.PlayerData)) {
			const buildingScore = playerData.BuildingManager.GetScore();
			const researchScore = playerData.ResearchManager.GetScore();
			const currentScore = buildingScore + researchScore;

			const previousScore = playerData.Score;
			const delta = currentScore - previousScore;

			playerData.Score = currentScore;
			scores.push({
				userId: userId as number,
				name: playerData.Player.Name,
				score: currentScore,
			});

			// Fire individual ScoreChanged event if score actually changed
			if (delta !== 0) {
				NetworkUtils.Broadcast(ServerEvents.ScoreChanged, userId as number, playerData.Player.Name, currentScore, delta);
			}
		}

		NetworkUtils.Broadcast(ServerEvents.ScoresUpdate, scores);
	}

	public StartSetupPhase(playerIds: number[]) {
		this.isSetupPhase = true;
		this.setupSequence = [];
		this.currentSetupIndex = 0;

		// Forward round
		for (const id of playerIds) {
			this.setupSequence.push({ userId: id, step: "Town1" });
			this.setupSequence.push({ userId: id, step: "Road1" });
		}
		// Reverse round
		for (let i = playerIds.size() - 1; i >= 0; i--) {
			const id = playerIds[i];
			this.setupSequence.push({ userId: id, step: "Town2" });
			this.setupSequence.push({ userId: id, step: "Road2" });
		}

		Logger.Info("GameManager", `Setup Phase Init: Sequence has ${this.setupSequence.size()} steps for players: [${playerIds.join(", ")}]`);
		this.BroadcastSetupTurn();
	}

	private BroadcastSetupTurn() {
		const current = this.setupSequence[this.currentSetupIndex];
		if (current) {
			const playerData = this.PlayerData[current.userId];
			const ownerName = playerData?.Player.Name ?? "Unknown";
			Logger.Info("GameManager", `Setup Phase: Turn ${this.currentSetupIndex + 1}/${this.setupSequence.size()} belongs to ${ownerName} (ID: ${current.userId}) - Task: ${current.step}`);

			NetworkUtils.Broadcast(ServerEvents.SetupTurnUpdate, current.userId, current.step);

			// If AI, trigger AI placement logic
			if (playerData && !typeIs(playerData.Player, "Instance")) {
				const ai = playerData.Player as AIPlayer;
				task.delay(1, () => {
					// Double check it's STILL this AI's turn after the delay
					const checkCurrent = this.setupSequence[this.currentSetupIndex];
					if (checkCurrent && checkCurrent.userId === ai.UserId && this.isSetupPhase) {
						ai.HandleSetupTurn(checkCurrent.step, this.mapGenerator, this);
					} else {
						Logger.Warn("GameManager", `AI ${ai.Name} attempted setup turn but it's no longer their turn or phase ended.`);
					}
				});
			}
		} else {
			this.EndSetupPhase();
		}
	}

	public OnSetupPlacement(userId: number, buildingType: string, position: Vector3): boolean {
		if (!this.isSetupPhase) return false;
		const current = this.setupSequence[this.currentSetupIndex];
		if (!current || current.userId !== userId) return false;

		const playerData = this.PlayerData[userId];
		if (!playerData) {
			Logger.Error("GameManager", `Setup: No player data found for ${userId}`);
			return false;
		}

		// Place for free
		const [success, err] = playerData.BuildingManager.StartBuilding(buildingType, position, true);
		if (success) {
			if (buildingType === "Town") {
				this.lastPlacedTownPos = position;
				playerData.NeedsFirstTown = false;
			}
			Logger.Info("GameManager", `Setup: Success! ${playerData.Player.Name} placed ${buildingType} at ${position}. Advancing...`);
			this.currentSetupIndex++;
			this.BroadcastSetupTurn();
			return true;
		} else {
			Logger.Warn("GameManager", `Setup: Placement REJECTED for ${playerData.Player.Name} (${buildingType}): ${err}`);
			// If AI, trigger AI placement logic again to pick a new spot
			if (!typeIs(playerData.Player, "Instance")) {
				const ai = playerData.Player as AIPlayer;
				if (buildingType === "Town") {
					ai.RecordFailedPlacement(position);
				}
				task.defer(() => {
					const check = this.setupSequence[this.currentSetupIndex];
					if (check && check.userId === userId && this.isSetupPhase) {
						ai.HandleSetupTurn(check.step, this.mapGenerator, this);
					}
				});
			}
			return false;
		}
	}

	private EndSetupPhase() {
		this.isSetupPhase = false;
		Logger.Info("GameManager", "Setup Phase Completed! Starting game pulses...");
		this.pulseManager.StartGame();
	}
}
