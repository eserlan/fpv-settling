import { OnStart, Service } from "@flamework/core";
import { GlobalEvents } from "shared/Events";
import * as Logger from "shared/Logger";
import { CollectionManager } from "./CollectionManager";
import { PulseManager } from "./PulseManager";
import { GameService } from "./GameService";
import { ServerEvents } from "../ServerEvents";

import { BuildingManager } from "./BuildingManager";

@Service({})
export class NetworkService implements OnStart {
    private serverEvents = ServerEvents;

    constructor(
        private gameService: GameService,
        private collectionManager: CollectionManager,
        private pulseManager: PulseManager,
        private buildingManager: BuildingManager,
    ) { }

    onStart() {
        // Typed event handlers (replacing generic ClientRequest)
        this.serverEvents.PlaceBuilding.connect((player: Player, buildingType: string, position: Vector3) => {
            const playerData = this.gameService.PlayerData[player.UserId];
            if (!playerData) return;

            const [success, result] = this.buildingManager.StartBuilding(playerData, buildingType, position);
            if (!success) {
                Logger.Warn("NetworkService", `[${player.Name}] Failed to PlaceBuilding ${buildingType}: ${result}`);
            } else {
                Logger.Info("NetworkService", `[${player.Name}] PlaceBuilding ${buildingType} success`);
            }
        });

        this.serverEvents.PlaceFoundation.connect((player: Player, blueprintName: string, position: Vector3, rotation: Vector3, snapKey: string) => {
            const playerData = this.gameService.PlayerData[player.UserId];
            if (!playerData) return;

            const [success, result] = this.buildingManager.PlaceFoundation(playerData, blueprintName, position, rotation, snapKey);
            if (!success) {
                Logger.Warn("NetworkService", `[${player.Name}] Failed to PlaceFoundation ${blueprintName}: ${result}`);
            } else {
                Logger.Info("NetworkService", `[${player.Name}] PlaceFoundation ${blueprintName} success`);
            }
        });

        this.serverEvents.DepositResource.connect((player: Player, foundationId: number, resourceType: string) => {
            const playerData = this.gameService.PlayerData[player.UserId];
            if (!playerData) return;

            Logger.Debug("NetworkService", `${player.Name} requesting deposit of ${resourceType} into foundation ${foundationId}`);

            const inventory = this.collectionManager.GetInventory(player);
            if (inventory && inventory[resourceType] && inventory[resourceType] > 0) {
                const [success] = this.buildingManager.DepositResource(playerData, foundationId, resourceType);
                if (success) {
                    this.collectionManager.RemoveResource(player, resourceType, 1);
                }
            } else {
                Logger.Warn("NetworkService", `${player.Name} tried to deposit ${resourceType} but doesn't have any`);
            }
        });

        this.serverEvents.HireNPC.connect((player: Player, npcType: string, position: Vector3) => {
            const playerData = this.gameService.PlayerData[player.UserId];
            if (!playerData) return;

            const [success, result] = playerData.NPCManager.HireNPC(npcType, position);
            if (!success) {
                Logger.Warn("NetworkService", `[${player.Name}] Failed to HireNPC ${npcType}: ${result}`);
            } else {
                Logger.Info("NetworkService", `[${player.Name}] HireNPC ${npcType} success`);
            }
        });

        this.serverEvents.StartResearch.connect((player: Player, techName: string) => {
            const playerData = this.gameService.PlayerData[player.UserId];
            if (!playerData) return;

            const [success, result] = playerData.ResearchManager.StartResearch(techName);
            if (!success) {
                Logger.Warn("NetworkService", `[${player.Name}] Failed to StartResearch ${techName}: ${result}`);
            } else {
                Logger.Info("NetworkService", `[${player.Name}] StartResearch ${techName} success`);
            }
        });

        this.serverEvents.ExecuteTrade.connect((player: Player, giveResource: string, receiveResource: string, amount: number) => {
            const playerData = this.gameService.PlayerData[player.UserId];
            if (!playerData) return;

            Logger.Debug("NetworkService", `${player.Name} requesting trade: ${amount ?? 1} x (${giveResource} -> ${receiveResource})`);
            playerData.PortManager.ExecuteTrade(giveResource, receiveResource, amount ?? 1);
        });

        this.serverEvents.RequestInventory.connect((player: Player) => {
            const inventory = this.collectionManager.GetInventory(player);
            if (inventory) {
                this.serverEvents.ResourceUpdate.fire(player, inventory as Record<string, number>);
            }
        });

        this.serverEvents.ReadyForPulse.connect((player: Player) => {
            this.pulseManager.SetPlayerReady(player.UserId, true);
        });

        this.serverEvents.DevEvent.connect((player: Player, action: "ForcePulse" | "AddResources") => {
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
