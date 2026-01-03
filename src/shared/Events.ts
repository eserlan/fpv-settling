import { Networking } from "@flamework/networking";
import type { RoomState } from "./RoomTypes";

interface ServerEvents {
    // Typed action events (replacing generic ClientRequest)
    PlaceBuilding(buildingType: string, position: Vector3): void;
    PlaceFoundation(blueprintName: string, position: Vector3, rotation: Vector3, snapKey: string): void;
    DepositResource(foundationId: number, resourceType: string): void;
    HireNPC(npcType: string, position: Vector3): void;
    StartResearch(techName: string): void;
    ExecuteTrade(giveResource: string, receiveResource: string, amount: number): void;

    // Utility events
    DevEvent(action: string): void;
    CollectEvent(action: "GetInventory"): void;
    ReadyForPulse(): void;

    // Lobby Room Events
    JoinRoom(roomId: number): void;
    LeaveRoom(): void;
    AddAIRoom(roomId: number, skill: string): void;
    RemoveAIRoom(roomId: number, aiUserId: number): void;
    StartRoomGame(roomId: number): void;
}

interface ClientEvents {
    // Game lifecycle events
    RoomUpdate(roomId: number, room: RoomState): void;
    GameStart(): void;
    PlayerJoined(userId: number, name: string, isAI: boolean): void;
    PlayerLeft(userId: number, name: string): void;

    // Resource events
    ResourceUpdate(resources: Record<string, number>): void;
    ResourceSpawned(resourceType: string, position: Vector3, tileQ: number, tileR: number): void;
    ResourceCollected(resourceType: string, amount: number, collectorName: string): void;

    // Building events
    ConstructionStarted(buildingId: number, buildingType: string, position: Vector3): void;
    ConstructionCompleted(buildingId: number, buildingType: string): void;
    BuildingDestroyed(buildingId: number, buildingType: string, ownerId: number): void;
    FoundationPlaced(
        foundationId: number,
        blueprintName: string,
        position: Vector3,
        requiredResources: Record<string, number>,
    ): void;
    ResourceDeposited(foundationId: number, resourceType: string, progress: number): void;

    // Tile ownership events
    TileOwnershipChanged(tileQ: number, tileR: number, ownerId: number, ownerName: string): void;

    // NPC/Research events
    NPCHired(npcId: number, npcType: string, position: Vector3): void;
    ResearchStarted(techName: string, researchTime: number): void;
    ResearchCompleted(techName: string): void;

    // Pulse/Timer events
    TimerEvent(time: number): void;
    PulseVotesUpdate(readyCount: number, totalCount: number): void;
    PulseEvent(action: "RollStart" | "RollComplete" | "Robber", ...args: unknown[]): void;

    // Trade/Port events
    PortClaimed(portType: string): void;
    HarborMasterUpdate(points: number): void;
    TradeCompleted(
        giveType: string,
        giveAmount: number,
        receiveType: string,
        receiveAmount: number,
        ratio: number,
    ): void;

    // UI/System events
    SystemMessageEvent(message: string): void;
    ScoresUpdate(scores: { userId: number, name: string, score: number }[]): void;
    ScoreChanged(userId: number, playerName: string, newScore: number, delta: number): void;

    // Legacy complex events (consider refactoring later)
    CollectEvent(action: string, ...args: unknown[]): void;
}

export const GlobalEvents = Networking.createEvent<ServerEvents, ClientEvents>();
