import { Networking } from "@flamework/networking";

interface ServerEvents {
    ClientRequest(actionType: string, ...args: unknown[]): void;
    DevEvent(action: string): void;
    CollectEvent(action: "GetInventory"): void;

    // Lobby Room Events
    JoinRoom(roomId: number): void;
    LeaveRoom(): void;
    AddAIRoom(roomId: number, skill: string): void;
    RemoveAIRoom(roomId: number, aiUserId: number): void;
    StartRoomGame(roomId: number): void;
}

interface ClientEvents {
    // Traditional individual events
    RoomUpdate(roomId: number, data: string): void; // JSON string of room state
    GameStart(): void;
    ResourceUpdate(resources: Record<string, number>): void;
    ConstructionStarted(buildingId: number, buildingType: string, position: Vector3): void;
    ConstructionCompleted(buildingId: number, buildingType: string): void;
    FoundationPlaced(
        foundationId: number,
        blueprintName: string,
        position: Vector3,
        requiredResources: Record<string, number>,
    ): void;
    ResourceDeposited(foundationId: number, resourceType: string, progress: number): void;
    NPCHired(npcId: number, npcType: string, position: Vector3): void;
    ResearchStarted(techName: string, researchTime: number): void;
    ResearchCompleted(techName: string): void;
    TimerEvent(time: number): void;
    PortClaimed(portType: string): void;
    HarborMasterUpdate(points: number): void;
    TradeCompleted(
        giveType: string,
        giveAmount: number,
        receiveType: string,
        receiveAmount: number,
        ratio: number,
    ): void;
    SystemMessageEvent(message: string): void;
    ScoresUpdate(scores: { userId: number, name: string, score: number }[]): void;

    // Complex interaction events
    CollectEvent(action: string, ...args: unknown[]): void;
    PulseEvent(action: "RollStart" | "RollComplete" | "Robber", ...args: unknown[]): void;
}

export const GlobalEvents = Networking.createEvent<ServerEvents, ClientEvents>();
