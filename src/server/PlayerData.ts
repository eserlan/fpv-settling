import type { GameEntity } from "shared/GameEntity";

export interface PlayerData {
	Player: GameEntity;
	ResourceManager: import("./ResourceManager");
	Buildings: import("shared/GameTypes").BuildingRecord[];
	BuildingsInProgress: import("shared/GameTypes").BuildingRecord[];
	Towns: import("shared/GameTypes").BuildingRecord[];
	NPCManager: import("./NPCManager");
	ResearchManager: import("./ResearchManager");
	PortManager: import("./PortManager");
	TileOwnershipManager: import("./services/TileOwnershipManager").TileOwnershipManager;
	GameTime: number;
	PulseTimer: number;
	NeedsFirstTown: boolean;
	Score: number;
	Color: Color3;
}
