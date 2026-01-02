import { OnStart, Service } from "@flamework/core";

const Players = game.GetService("Players");
const RunService = game.GetService("RunService");

import ResourceManager = require("../ResourceManager");
import BuildingManager = require("../BuildingManager");
import NPCManager = require("../NPCManager");
import ResearchManager = require("../ResearchManager");
import PortManager = require("../PortManager");
import NetworkHandler = require("../NetworkHandler");
import MapGenerator = require("../MapGenerator");
import PulseManager = require("../PulseManager");
import CollectionManager = require("../CollectionManager");
import LogService = require("../LogService");
import type { PlayerData } from "../PlayerData";
import type { GameState } from "../GameState";
import * as Logger from "shared/Logger";

@Service({})
export class GameService implements OnStart, GameState {
	public PlayerData: Record<number, PlayerData> = {};

	onStart() {
		void LogService;

		Logger.Info("Server", "===========================================");
		Logger.Info("Server", "FPV Settling - Server Starting");
		Logger.Info("Server", "===========================================");

		MapGenerator.Generate();

		PulseManager.Initialize();
		PulseManager.SetGameManager(this);

		Players.PlayerAdded.Connect((player) => this.handlePlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.handlePlayerRemoving(player));

		for (const player of Players.GetPlayers()) {
			this.handlePlayerAdded(player);
		}

		RunService.Heartbeat.Connect((deltaTime) => this.handleHeartbeat(deltaTime));

		NetworkHandler.Init(this);

		Logger.Info("GameManager", "Game Manager initialized!");
		Logger.Info("Server", "===========================================");
		Logger.Info("Server", "Server ready! Waiting for players...");
		Logger.Info("Server", "===========================================");
	}

	private handlePlayerAdded(player: Player) {
		Logger.Info("GameManager", `Player joined: ${player.Name}`);

		CollectionManager.InitPlayer(player);

		const resourceManager = new ResourceManager(player);
		const buildingManager = new BuildingManager(player, resourceManager);
		const npcManager = new NPCManager(player, resourceManager);
		const researchManager = new ResearchManager(player, resourceManager);
		const portManager = new PortManager(player, resourceManager);

		portManager.SetPortLocations(MapGenerator.GetPortLocations());
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
		CollectionManager.RemovePlayer(player);
		delete this.PlayerData[player.UserId];
	}

	private handleHeartbeat(deltaTime: number) {
		PulseManager.Update(deltaTime);
		CollectionManager.Update(deltaTime);

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
