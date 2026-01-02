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
import LogService = require("../LogService");
import type { PlayerData } from "../PlayerData";
import type { GameState } from "../GameState";
import * as Logger from "shared/Logger";
import { ServerEvents } from "../ServerEvents";
import { AIPlayer } from "../AIPlayer";
import type { GameEntity } from "shared/GameEntity";
import { NetworkUtils } from "../NetworkUtils";

@Service({})
export class GameService implements OnStart, GameState {
	public PlayerData: Record<number, PlayerData> = {};
	private isGameStarted = false;
	private readyPlayers = new Set<number>();
	private readonly MIN_PLAYERS_TO_START = 1;
	private readonly AI_PLAYER_COUNT = 3; // Configurable AI count

	constructor(
		private mapGenerator: MapGenerator,
		private pulseManager: PulseManager,
		private collectionManager: CollectionManager,
		private tileOwnershipManager: TileOwnershipManager,
	) { }

	onStart() {
		void LogService;

		Logger.Info("Server", "===========================================");
		Logger.Info("Server", "FPV Settling - Server Starting");
		Logger.Info("Server", "===========================================");

		this.mapGenerator.GenerateLobby();
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

	public ToggleReady(player: Player) {
		if (this.isGameStarted) return;

		if (this.readyPlayers.has(player.UserId)) {
			this.readyPlayers.delete(player.UserId);
		} else {
			this.readyPlayers.add(player.UserId);
		}

		const readyCount = this.readyPlayers.size();
		const totalPlayers = Players.GetPlayers().size();
		NetworkUtils.Broadcast(ServerEvents.LobbyUpdate, readyCount, totalPlayers);
		Logger.Info("GameManager", `${player.Name} is ${this.readyPlayers.has(player.UserId) ? "Ready" : "Not Ready"}. (${readyCount}/${totalPlayers})`);

		if (readyCount === totalPlayers && readyCount >= this.MIN_PLAYERS_TO_START) {
			this.StartGame();
		}
	}

	public StartGame() {
		if (this.isGameStarted) return;
		this.isGameStarted = true;
		Logger.Info("GameManager", "Starting Game...");

		// Generate the real map
		this.mapGenerator.Generate();

		// Spawn AI Players
		this.SpawnAIPlayers();

		// Teleport all players (Real and AI)
		for (const [userId, playerData] of pairs(this.PlayerData)) {
			const entity = playerData.Player;

			if ("IsAI" in entity && entity.IsAI) {
				const ai = entity as AIPlayer;
				// AI Spawn logic
				ai.Spawn(new Vector3(math.random(-50, 50), 50, math.random(-50, 50)));
			} else {
				const player = entity as Player;
				const character = player.Character;
				if (character) {
					character.PivotTo(new CFrame(0, 50, 0));
				}
			}

			// Refresh port manager locations for everyone
			playerData.PortManager.SetPortLocations(this.mapGenerator.GetPortLocations());
		}

		NetworkUtils.Broadcast(ServerEvents.GameStart);
		Logger.Info("GameManager", "Game Started!");
	}

	private SpawnAIPlayers() {
		Logger.Info("GameManager", `Spawning ${this.AI_PLAYER_COUNT} AI players...`);
		for (let i = 1; i <= this.AI_PLAYER_COUNT; i++) {
			const aiId = -i; // Negative IDs for AI
			const aiName = `AI_Bot_${i}`;
			const aiPlayer = new AIPlayer(aiId, aiName);
			this.initializePlayerData(aiPlayer);
		}
	}

	private initializePlayerData(entity: GameEntity) {
		const resourceManager = new ResourceManager(entity);
		const buildingManager = new BuildingManager(entity, resourceManager, this.mapGenerator, this.tileOwnershipManager);
		const npcManager = new NPCManager(entity, resourceManager);
		const researchManager = new ResearchManager(entity, resourceManager);
		const portManager = new PortManager(entity, resourceManager);

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
			Settlements: [],
			NeedsFirstSettlement: true,
		};
	}

	private handlePlayerAdded(player: Player) {
		Logger.Info("GameManager", `Player joined: ${player.Name}`);

		this.collectionManager.InitPlayer(player);
		this.initializePlayerData(player);

		player.CharacterAdded.Connect((character) => {
			const humanoid = character.WaitForChild("Humanoid") as Humanoid;
			humanoid.WalkSpeed = 16;

			if (!this.isGameStarted) {
				// Teleport to Lobby
				character.PivotTo(new CFrame(0, 103, 0));
			} else {
				// Late joiner spawn
				character.PivotTo(new CFrame(0, 50, 0));
			}

			const playerData = this.PlayerData[player.UserId];
			if (playerData && playerData.NeedsFirstSettlement) {
				Logger.Info("GameManager", `${player.Name} needs to place first settlement (Press B)`);
			}
		});

		// Send initial lobby status to new player
		if (!this.isGameStarted) {
			NetworkUtils.FireClient(player, ServerEvents.LobbyUpdate, this.readyPlayers.size(), Players.GetPlayers().size());
		} else {
			NetworkUtils.FireClient(player, ServerEvents.GameStart);
		}
	}

	private handlePlayerRemoving(player: Player) {
		Logger.Info("GameManager", `Player leaving: ${player.Name}`);
		this.collectionManager.RemovePlayer(player);
		delete this.PlayerData[player.UserId];

		if (!this.isGameStarted) {
			this.readyPlayers.delete(player.UserId);
			const readyCount = this.readyPlayers.size();
			// Subtract 1 because Players.GetPlayers() still includes the leaving player
			const totalPlayers = Players.GetPlayers().size() - 1;
			NetworkUtils.Broadcast(ServerEvents.LobbyUpdate, readyCount, totalPlayers);

			// Check if we should start (e.g. everyone else was ready)
			if (readyCount > 0 && readyCount === totalPlayers && readyCount >= this.MIN_PLAYERS_TO_START) {
				this.StartGame();
			}
		}
	}

	private handleHeartbeat(deltaTime: number) {
		for (const [userId, playerData] of pairs(this.PlayerData)) {
			playerData.GameTime += deltaTime;
			playerData.BuildingManager.UpdateBuildings(deltaTime);
			playerData.NPCManager.UpdateNPCs(deltaTime);
			playerData.ResearchManager.UpdateResearch(deltaTime);

			if (playerData.GameTime % 60 < deltaTime) {
				playerData.NPCManager.PayMaintenance(1);
			}

			// Update AI Logic
			const entity = playerData.Player;
			if ("IsAI" in entity && entity.IsAI) {
				(entity as AIPlayer).Update(deltaTime, playerData, this.mapGenerator);
			}
		}
	}
}
