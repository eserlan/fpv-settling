import type { GameEntity } from "shared/GameEntity";

export interface PlayerData {
	Player: GameEntity;
	ResourceManager: import("./ResourceManager");
	BuildingManager: import("./BuildingManager");
	NPCManager: import("./NPCManager");
	ResearchManager: import("./ResearchManager");
	PortManager: import("./PortManager");
	GameTime: number;
	PulseTimer: number;
	Settlements: unknown[];
	NeedsFirstSettlement: boolean;
	Score: number;
}
