import type { PlayerData } from "./PlayerData";

export interface GameState {
	PlayerData: Record<number, PlayerData>;
	UpdateScores(): void;
	OnSetupPlacement(userId: number, buildingType: string, position: Vector3): boolean;
}
