export interface PlayerData {
	Player: Player;
	ResourceManager: import("./ResourceManager");
	BuildingManager: import("./BuildingManager");
	NPCManager: import("./NPCManager");
	ResearchManager: import("./ResearchManager");
	GameTime: number;
	Settlements: unknown[];
	NeedsFirstSettlement: boolean;
}
