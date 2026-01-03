import type { SkillLevel } from "../server/AIPrompts";

export interface RoomPlayer {
    name: string;
    userId: number;
    isAI: boolean;
    skill?: SkillLevel;
    isActive: boolean;
}

export interface RoomState {
    id: number;
    players: RoomPlayer[];
    isGameStarted: boolean;
}
