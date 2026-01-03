// Technology research tree - Updated for Catan-style resources

type TechInfo = {
	Name: string;
	Description: string;
	Cost: Record<string, number>;
	ResearchTime: number;
	Prerequisites: string[];
	Effect: string;
	Modifier?: number;
	Unlocks?: string[];
	Points?: number;
};

const TechTree: Record<string, TechInfo> = {
	ImprovedTools: {
		Name: "Improved Tools",
		Description: "Workers gather resources 25% faster",
		Cost: {
			Ore: 3,
			Wheat: 2,
		},
		ResearchTime: 60,
		Prerequisites: [],
		Effect: "GatherSpeed",
		Modifier: 1.25,
	},
	BrickMasonry: {
		Name: "Brick Masonry",
		Description: "Unlock brick buildings and better fortifications",
		Cost: {
			Brick: 4,
			Ore: 2,
		},
		ResearchTime: 90,
		Prerequisites: [],
		Effect: "UnlockBuilding",
		Unlocks: ["BrickWall", "BrickTower"],
	},
	Agriculture: {
		Name: "Agriculture",
		Description: "Wheat production increases by 50%",
		Cost: {
			Wheat: 3,
			Wood: 2,
		},
		ResearchTime: 75,
		Prerequisites: [],
		Effect: "WheatProduction",
		Modifier: 1.5,
	},
	Military: {
		Name: "Military Training",
		Description: "Guards are 30% more effective in combat",
		Cost: {
			Ore: 4,
			Wheat: 3,
		},
		ResearchTime: 120,
		Prerequisites: [],
		Effect: "GuardEffectiveness",
		Modifier: 1.3,
	},
	AdvancedEngineering: {
		Name: "Advanced Engineering",
		Description: "Buildings cost 20% less resources",
		Cost: {
			Ore: 5,
			Brick: 4,
		},
		ResearchTime: 150,
		Prerequisites: ["BrickMasonry", "ImprovedTools"],
		Effect: "BuildingCost",
		Modifier: 0.8,
		Points: 1,
	},
	Trading: {
		Name: "Trading",
		Description: "Unlock trading posts and better resource exchange rates",
		Cost: {
			Wool: 3,
			Wheat: 2,
		},
		ResearchTime: 90,
		Prerequisites: [],
		Effect: "UnlockBuilding",
		Unlocks: ["TradingPost"],
	},
};

export type { TechInfo };
export default TechTree;
