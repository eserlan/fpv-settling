import type { GameEntity } from "shared/GameEntity";

export interface PlayerData {
	Player: GameEntity;
	ResourceManager: import("./ResourceManager");
	BuildingManager: import("./BuildingManager");
	NPCManager: import("./NPCManager");
	ResearchManager: import("./ResearchManager");
	PortManager: import("./PortManager");
	TileOwnershipManager: import("./services/TileOwnershipManager").TileOwnershipManager;
	GameTime: number;
	PulseTimer: number;
	Towns: unknown[];
	NeedsFirstTown: boolean;
	Score: number;
	Color: Color3;
}
