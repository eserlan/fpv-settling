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
import { LobbyGeneratorService } from "./LobbyGeneratorService";
import LogService = require("../LogService");
import type { PlayerData } from "../PlayerData";
import type { GameState } from "../GameState";
import * as Logger from "shared/Logger";
import { ServerEvents } from "../ServerEvents";
import { AIPlayer } from "../AIPlayer";
import type { GameEntity } from "shared/GameEntity";
import { NetworkUtils } from "../NetworkUtils";
import { SkillLevel } from "../AIPrompts";

@Service({})
export class GameService implements OnStart, GameState {
	public PlayerData: Record<number, PlayerData> = {};
	private isGameStarted = false;
	private readonly MIN_PLAYERS_TO_START = 1;
	private readonly TARGET_PLAYER_COUNT = 4; // AI fill target
	private scoreUpdateTimer = 0;
	private readonly SCORE_UPDATE_INTERVAL = 2; // Broadcast scores every 2 seconds

	constructor(
		private mapGenerator: MapGenerator,
		private pulseManager: PulseManager,
		private collectionManager: CollectionManager,
		private tileOwnershipManager: TileOwnershipManager,
		private lobbyGenerator: LobbyGeneratorService,
	) { }

	onStart() {
		void LogService;

		Logger.Info("Server", "===========================================");
		Logger.Info("Server", "FPV Settling - Server Starting");
		Logger.Info("Server", "===========================================");

		this.lobbyGenerator.GenerateLobby();
		this.pulseManager.SetGameManager(this);

		Players.PlayerAdded.Connect((player) => this.handlePlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.handlePlayerRemoving(player));

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

		// Generate the real map
		this.mapGenerator.Generate();
		this.pulseManager.AssignTileNumbers();

		// Setup players and AI
		for (const e of entities) {
			if (e.isAI) {
				const aiPlayer = new AIPlayer(e.userId, e.name, e.skill ?? "Intermediate");
				this.initializePlayerData(aiPlayer);
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
		Logger.Info("GameManager", "Game Started!");
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
		Logger.Info("GameManager", "Game Started!");
	}

	private SpawnAIPlayers(count: number) {
		Logger.Info("GameManager", `Spawning ${count} AI players...`);
		const skills: SkillLevel[] = ["Beginner", "Intermediate", "Expert"];

		for (let i = 1; i <= count; i++) {
			const aiId = -i; // Negative IDs for AI
			const skill = skills[math.random(0, skills.size() - 1)]; // Random skill
			const aiName = `AI_${skill}_${i}`;

			const aiPlayer = new AIPlayer(aiId, aiName, skill);
			this.initializePlayerData(aiPlayer);

			Logger.Info("GameManager", `Spawned AI: ${aiName} (${skill})`);
		}
	}

	private initializePlayerData(entity: GameEntity) {
		const resourceManager = new ResourceManager(entity);
		const buildingManager = new BuildingManager(entity, resourceManager, this.mapGenerator, this.tileOwnershipManager);
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
			GameTime: 0,
			PulseTimer: 0,
			Settlements: [],
			NeedsFirstSettlement: true,
			Score: 0,
		};
	}

	private handlePlayerAdded(player: Player) {
		Logger.Info("GameManager", `Player joined: ${player.Name}`);

		// Initialize player data first so ResourceManager exists
		this.initializePlayerData(player);

		// Then init collection with the resource manager
		const playerData = this.PlayerData[player.UserId];
		if (playerData) {
			this.collectionManager.InitPlayer(player, playerData.ResourceManager);
		}

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
			if (playerData && playerData.NeedsFirstSettlement) {
				Logger.Info("GameManager", `${player.Name} needs to place first settlement (Press B)`);
			}
		});

		// If game already started, tell the player
		if (this.isGameStarted) {
			NetworkUtils.FireClient(player, ServerEvents.GameStart);
		}
	}

	private handlePlayerRemoving(player: Player) {
		Logger.Info("GameManager", `Player leaving: ${player.Name}`);
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
				(entity as AIPlayer).Update(deltaTime, playerData, this.mapGenerator);
			}
		}

		// Periodic Score Update and Broadcast
		this.scoreUpdateTimer += deltaTime;
		if (this.scoreUpdateTimer >= this.SCORE_UPDATE_INTERVAL) {
			this.scoreUpdateTimer = 0;
			const scores: { userId: number; name: string; score: number }[] = [];

			for (const [userId, playerData] of pairs(this.PlayerData)) {
				const buildingScore = playerData.BuildingManager.GetScore();
				const researchScore = playerData.ResearchManager.GetScore();
				const currentScore = buildingScore + researchScore;

				playerData.Score = currentScore;
				scores.push({
					userId: userId as number,
					name: playerData.Player.Name,
					score: currentScore,
				});
			}

			NetworkUtils.Broadcast(ServerEvents.ScoresUpdate, scores);
		}
	}
}
