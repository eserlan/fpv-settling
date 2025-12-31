// NPC Types (Workers and Guards) - Updated for Catan-style resources

type NPCInfo = {
	Name: string;
	Description: string;
	HireCost: Record<string, number>;
	MaintenanceCost: Record<string, number>;
	GatherRate?: number;
	Health: number;
	Speed: number;
	Damage?: number;
	AttackRange?: number;
	DetectionRange?: number;
};

const NPCTypes: Record<string, NPCInfo> = {
	Worker: {
		Name: "Worker",
		Description: "Gathers resources and constructs buildings. Good guy to have around.",
		HireCost: {
			Wheat: 2,
			Ore: 1,
		},
		MaintenanceCost: {
			Wheat: 1, // per minute
		},
		GatherRate: 5, // resources per minute
		Health: 50,
		Speed: 16,
	},
	Guard: {
		Name: "Guard",
		Description: "Defends settlements from threats",
		HireCost: {
			Wheat: 3,
			Ore: 2,
		},
		MaintenanceCost: {
			Wheat: 2, // per minute
		},
		Health: 100,
		Speed: 18,
		Damage: 10,
		AttackRange: 20,
		DetectionRange: 50,
	},
};

export type { NPCInfo };
export default NPCTypes;
