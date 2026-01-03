import type { PlayerData } from "./PlayerData";

export interface GameState {
	PlayerData: Record<number, PlayerData>;
	UpdateScores(): void;
}
