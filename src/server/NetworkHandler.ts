// Server-side Network Handler
// Routes requests from clients to the appropriate managers

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Network = require(ReplicatedStorage.Shared.Network) as typeof import("shared/Network");
const Logger = require(ReplicatedStorage.Shared.Logger) as typeof import("shared/Logger");

const NetworkHandler = {
	Init(gameManager: { PlayerData: Record<number, any> }) {
		Network.OnEvent("ClientRequest", (player, actionType, ...args) => {
			const playerData = gameManager.PlayerData[player.UserId];
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
					`${player.Name} requesting deposit of ${resourceType} into foundation ${foundationId}`,
				);

				// First check if player has the resource
				const CollectionManager = require(script.Parent!.WaitForChild("CollectionManager")) as typeof import("./CollectionManager");
				const inventory = CollectionManager.GetInventory(player);

				if (inventory && inventory[resourceType] && inventory[resourceType] > 0) {
					// Try to deposit
					const [success] = playerData.BuildingManager.DepositResource(foundationId, resourceType);
					if (success) {
						// Remove from player inventory
						CollectionManager.RemoveResource(player, resourceType, 1);
					}
				} else {
					Logger.Warn(
						"NetworkHandler",
						`${player.Name} tried to deposit ${resourceType} but doesn't have any`,
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
