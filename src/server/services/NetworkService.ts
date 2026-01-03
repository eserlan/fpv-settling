import { OnStart, Service } from "@flamework/core";
import { GlobalEvents } from "shared/Events";
import * as Logger from "shared/Logger";
import { CollectionManager } from "./CollectionManager";
import { PulseManager } from "./PulseManager";
import { GameService } from "./GameService";
import { ServerEvents } from "../ServerEvents";

@Service({})
export class NetworkService implements OnStart {
    private serverEvents = ServerEvents;

    constructor(
        private gameService: GameService,
        private collectionManager: CollectionManager,
        private pulseManager: PulseManager,
    ) { }

    onStart() {
        this.serverEvents.ClientRequest.connect((player: Player, actionType: string, ...args: any[]) => {
            const playerData = this.gameService.PlayerData[player.UserId];
            if (!playerData) return;

            if (actionType === "PlaceBuilding") {
                const [buildingType, position] = args as [string, Vector3];
                const [success, result] = playerData.BuildingManager.StartBuilding(buildingType, position);
                if (!success) {
                    Logger.Warn("NetworkService", `[${player.Name}] Failed to PlaceBuilding ${buildingType}: ${result}`);
                } else {
                    Logger.Info("NetworkService", `[${player.Name}] PlaceBuilding ${buildingType} success`);
                }
            } else if (actionType === "PlaceFoundation") {
                const [blueprintName, position, rotation, snapKey] = args as [string, Vector3, Vector3, string];
                const [success, result] = playerData.BuildingManager.PlaceFoundation(
                    blueprintName,
                    position,
                    rotation,
                    snapKey,
                );
                if (!success) {
                    Logger.Warn("NetworkService", `[${player.Name}] Failed to PlaceFoundation ${blueprintName}: ${result}`);
                } else {
                    Logger.Info("NetworkService", `[${player.Name}] PlaceFoundation ${blueprintName} success`);
                }
            } else if (actionType === "DepositResource") {
                const [foundationId, resourceType] = args as [number, string];
                Logger.Debug(
                    "NetworkService",
                    `${player.Name} requesting deposit of ${resourceType} into foundation ${foundationId}`,
                );

                const inventory = this.collectionManager.GetInventory(player);
                if (inventory && inventory[resourceType] && inventory[resourceType] > 0) {
                    const [success] = playerData.BuildingManager.DepositResource(foundationId, resourceType);
                    if (success) {
                        this.collectionManager.RemoveResource(player, resourceType, 1);
                    }
                } else {
                    Logger.Warn("NetworkService", `${player.Name} tried to deposit ${resourceType} but doesn't have any`);
                }
            } else if (actionType === "HireNPC") {
                const [npcType, position] = args as [string, Vector3];
                const [success, result] = playerData.NPCManager.HireNPC(npcType, position);
                if (!success) {
                    Logger.Warn("NetworkService", `[${player.Name}] Failed to HireNPC ${npcType}: ${result}`);
                } else {
                    Logger.Info("NetworkService", `[${player.Name}] HireNPC ${npcType} success`);
                }
            } else if (actionType === "StartResearch") {
                const [techName] = args as [string];
                const [success, result] = playerData.ResearchManager.StartResearch(techName);
                if (!success) {
                    Logger.Warn("NetworkService", `[${player.Name}] Failed to StartResearch ${techName}: ${result}`);
                } else {
                    Logger.Info("NetworkService", `[${player.Name}] StartResearch ${techName} success`);
                }
            } else if (actionType === "ExecuteTrade") {
                const [giveResource, receiveResource, amount] = args as [string, string, number];
                Logger.Debug(
                    "NetworkService",
                    `${player.Name} requesting trade: ${amount ?? 1} x (${giveResource} -> ${receiveResource})`,
                );
                playerData.PortManager.ExecuteTrade(giveResource, receiveResource, amount ?? 1);
            }
        });

        this.serverEvents.CollectEvent.connect((player: Player, action: string) => {
            if (action === "GetInventory") {
                const inventory = this.collectionManager.GetInventory(player);
                if (inventory) {
                    this.serverEvents.CollectEvent.fire(player, "InventoryUpdate", inventory as any);
                }
            }
        });

        this.serverEvents.DevEvent.connect((player: Player, action: string) => {
            if (action === "ForcePulse") {
                Logger.Info("NetworkService", `Force pulse triggered by ${player.Name}`);
                this.pulseManager.ForcePulse();
            }
        });

        Logger.Info("NetworkService", "Flamework Networking Service Initialized");
    }

    public getEvents() {
        return this.serverEvents;
    }
}
