export interface PlayerData {
	Player: Player;
	ResourceManager: import("./ResourceManager");
	BuildingManager: import("./BuildingManager");
	NPCManager: import("./NPCManager");
	ResearchManager: import("./ResearchManager");
	PortManager: import("./PortManager");
	GameTime: number;
	Settlements: unknown[];
	NeedsFirstSettlement: boolean;
}
