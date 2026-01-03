import { Networking } from "@flamework/networking";

// ============================================================================
// SERVER EVENTS (Client → Server)
// ============================================================================

/** Game action events - Player actions during gameplay */
interface GameActionEvents {
    PlaceBuilding(buildingType: string, position: Vector3): void;
    PlaceFoundation(blueprintName: string, position: Vector3, rotation: Vector3, snapKey: string): void;
    DepositResource(foundationId: number, resourceType: string): void;
    HireNPC(npcType: string, position: Vector3): void;
    StartResearch(techName: string): void;
    ExecuteTrade(giveResource: string, receiveResource: string, amount: number): void;
}

/** Lobby events - Room management before game starts */
interface LobbyActionEvents {
    JoinRoom(roomId: number): void;
    LeaveRoom(): void;
    AddAIRoom(roomId: number, skill: string): void;
    RemoveAIRoom(roomId: number, aiUserId: number): void;
    StartRoomGame(roomId: number): void;
}

/** Pulse events - Turn/timing related actions */
interface PulseActionEvents {
    ReadyForPulse(): void;
}

/** Utility events - Debug and inventory */
interface UtilityActionEvents {
    DevEvent(action: string): void;
    CollectEvent(action: "GetInventory"): void;
}

/** Combined Server Events interface */
interface ServerEvents extends GameActionEvents, LobbyActionEvents, PulseActionEvents, UtilityActionEvents { }

// ============================================================================
// CLIENT EVENTS (Server → Client)
// ============================================================================

/** Lifecycle events - Game state & player presence */
interface LifecycleEvents {
    RoomUpdate(roomId: number, data: string): void;
    GameStart(): void;
    PlayerJoined(userId: number, name: string, isAI: boolean): void;
    PlayerLeft(userId: number, name: string): void;
}

/** Resource events - Inventory & spawned resources */
interface ResourceEvents {
    ResourceUpdate(resources: Record<string, number>): void;
    ResourceSpawned(resourceType: string, position: Vector3, tileQ: number, tileR: number): void;
    ResourceCollected(resourceType: string, amount: number, collectorName: string): void;
}

/** Building events - Construction & foundations */
interface BuildingEvents {
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
}

/** Tile events - Ownership changes */
interface TileEvents {
    TileOwnershipChanged(tileQ: number, tileR: number, ownerId: number, ownerName: string): void;
}

/** NPC/Research events */
interface NPCResearchEvents {
    NPCHired(npcId: number, npcType: string, position: Vector3): void;
    ResearchStarted(techName: string, researchTime: number): void;
    ResearchCompleted(techName: string): void;
}

/** Pulse events - Timer & dice rolls */
interface PulseEvents {
    TimerEvent(time: number): void;
    PulseVotesUpdate(readyCount: number, totalCount: number): void;
    PulseEvent(action: "RollStart" | "RollComplete" | "Robber", ...args: unknown[]): void;
}

/** Trade events - Ports & trading */
interface TradeEvents {
    PortClaimed(portType: string): void;
    HarborMasterUpdate(points: number): void;
    TradeCompleted(
        giveType: string,
        giveAmount: number,
        receiveType: string,
        receiveAmount: number,
        ratio: number,
    ): void;
}

/** Score events - Points & leaderboard */
interface ScoreEvents {
    ScoresUpdate(scores: { userId: number, name: string, score: number }[]): void;
    ScoreChanged(userId: number, playerName: string, newScore: number, delta: number): void;
}

/** System events - Messages & UI notifications */
interface SystemEvents {
    SystemMessageEvent(message: string): void;
    CollectEvent(action: string, ...args: unknown[]): void;
}

/** Combined Client Events interface */
interface ClientEvents extends
    LifecycleEvents,
    ResourceEvents,
    BuildingEvents,
    TileEvents,
    NPCResearchEvents,
    PulseEvents,
    TradeEvents,
    ScoreEvents,
    SystemEvents { }

// ============================================================================
// EXPORTS
// ============================================================================

export const GlobalEvents = Networking.createEvent<ServerEvents, ClientEvents>();

// Re-export individual interfaces for documentation/typing purposes
export type {
    // Server event groups
    GameActionEvents,
    LobbyActionEvents,
    PulseActionEvents,
    UtilityActionEvents,
    ServerEvents,
    // Client event groups
    LifecycleEvents,
    ResourceEvents,
    BuildingEvents,
    TileEvents,
    NPCResearchEvents,
    PulseEvents,
    TradeEvents,
    ScoreEvents,
    SystemEvents,
    ClientEvents,
};
