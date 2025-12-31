// Server-side Network Handler
// Routes requests from clients to the appropriate managers

const ReplicatedStorage = game.GetService("ReplicatedStorage");
import Network from "shared/Network";
import * as Logger from "shared/Logger";
import CollectionManager = require("./CollectionManager");

type BuildingManager = InstanceType<typeof import("./BuildingManager")>;
type NPCManager = InstanceType<typeof import("./NPCManager")>;
type ResearchManager = InstanceType<typeof import("./ResearchManager")>;

interface PlayerData {
	BuildingManager: BuildingManager;
	NPCManager: NPCManager;
	ResearchManager: ResearchManager;
}

const NetworkHandler = {
	Init(gameManager: { PlayerData: Record<number, PlayerData> }) {
		Network.OnEvent("ClientRequest", (player, actionType, ...args) => {
			const playerData = gameManager.PlayerData[(player as Player).UserId];
			if (!playerData) {
				return;
			}

			if (actionType === "PlaceBuilding") {
				const [buildingType, position] = args as [string, Vector3];
				playerData.BuildingManager.StartBuilding(buildingType, position);
			} else if (actionType === "PlaceFoundation") {
				// New blueprint building system
				const [blueprintName, position, rotation, snapKey] = args as [string, Vector3, Vector3, string];
				playerData.BuildingManager.PlaceFoundation(blueprintName, position, rotation, snapKey);
			} else if (actionType === "DepositResource") {
				// Deposit resource into foundation
				const [foundationId, resourceType] = args as [number, string];
				Logger.Debug(
					"NetworkHandler",
					`${(player as Player).Name} requesting deposit of ${resourceType} into foundation ${foundationId}`,
				);

				// First check if player has the resource
				const inventory = CollectionManager.GetInventory(player as Player);

				if (inventory && inventory[resourceType] && inventory[resourceType] > 0) {
					// Try to deposit
					const result = playerData.BuildingManager.DepositResource(foundationId, resourceType) as LuaTuple<[boolean, string]>;
					const success = result[0];
					if (success) {
						// Remove from player inventory
						CollectionManager.RemoveResource(player as Player, resourceType, 1);
					}
				} else {
					Logger.Warn(
						"NetworkHandler",
						`${(player as Player).Name} tried to deposit ${resourceType} but doesn't have any`,
					);
				}
			} else if (actionType === "HireNPC") {
				const [npcType, position] = args as [string, Vector3];
				playerData.NPCManager.HireNPC(npcType, position);
			} else if (actionType === "StartResearch") {
				const [techName] = args as [string];
				playerData.ResearchManager.StartResearch(techName);
			}
		});

		Logger.Info("NetworkHandler", "Initialized");
	},
};

export = NetworkHandler;
