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

@Service({})
export class GameService implements OnStart, GameState {
	public PlayerData: Record<number, PlayerData> = {};

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

		this.mapGenerator.Generate();
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

	private handlePlayerAdded(player: Player) {
		Logger.Info("GameManager", `Player joined: ${player.Name}`);

		this.collectionManager.InitPlayer(player);

		const resourceManager = new ResourceManager(player);
		const buildingManager = new BuildingManager(player, resourceManager, this.mapGenerator, this.tileOwnershipManager);
		const npcManager = new NPCManager(player, resourceManager);
		const researchManager = new ResearchManager(player, resourceManager);
		const portManager = new PortManager(player, resourceManager);

		portManager.SetPortLocations(this.mapGenerator.GetPortLocations());
		buildingManager.SetPortManager(portManager);

		this.PlayerData[player.UserId] = {
			Player: player,
			ResourceManager: resourceManager,
			BuildingManager: buildingManager,
			NPCManager: npcManager,
			ResearchManager: researchManager,
			PortManager: portManager,
			GameTime: 0,
			Settlements: [],
			NeedsFirstSettlement: true,
		};

		player.CharacterAdded.Connect((character) => {
			const humanoid = character.WaitForChild("Humanoid") as Humanoid;
			humanoid.WalkSpeed = 16;

			const playerData = this.PlayerData[player.UserId];
			if (playerData && playerData.NeedsFirstSettlement) {
				Logger.Info("GameManager", `${player.Name} needs to place first settlement (Press B)`);
			}
		});
	}

	private handlePlayerRemoving(player: Player) {
		Logger.Info("GameManager", `Player leaving: ${player.Name}`);
		this.collectionManager.RemovePlayer(player);
		delete this.PlayerData[player.UserId];
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
		}
	}
}
