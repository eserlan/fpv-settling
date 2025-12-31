// Blueprint definitions for the building system
// Used by BlueprintBookUI and ConstructionManager

type BlueprintInfo = {
	Name: string;
	Icon: string;
	Description: string;
	PlacementType: string;
	Cost: Record<string, number>;
	Size: Vector3;
	ClaimsTiles?: boolean;
	FirstIsFree?: boolean;
	RequiresExisting?: string;
	ProductionMultiplier?: number;
	RequiresConnection?: boolean;
};

type BlueprintState = {
	ResourceIcons: Record<string, string>;
	Buildings: Record<string, BlueprintInfo>;
	GetCostString: (blueprintName: string) => string;
	CanAfford: (resources: Record<string, number>, blueprintName: string) => boolean;
	GetBlueprintNames: () => string[];
};

const Blueprints: BlueprintState = {
	ResourceIcons: {
		Wood: "🌲",
		Brick: "🧱",
		Wheat: "🌾",
		Ore: "⛏",
		Wool: "🧶",
	},
	Buildings: {
		Settlement: {
			Name: "Settlement",
			Icon: "🏠",
			Description: "A small village that claims adjacent tiles",
			PlacementType: "3-way", // Place on 3-way vertices
			Cost: {
				Wood: 1,
				Brick: 1,
				Wheat: 1,
				Wool: 1,
			},
			Size: Vector3.new(5, 4, 5),
			ClaimsTiles: true,
			FirstIsFree: true, // First settlement is free for new players
		},
		City: {
			Name: "City",
			Icon: "🏰",
			Description: "Upgrade a settlement to double resource production",
			PlacementType: "upgrade", // Must upgrade existing settlement
			RequiresExisting: "Settlement",
			Cost: {
				Wheat: 2,
				Ore: 3,
			},
			Size: Vector3.new(7, 6, 7),
			ProductionMultiplier: 2,
		},
		Road: {
			Name: "Road",
			Icon: "🛣️",
			Description: "Connect your settlements",
			PlacementType: "edge", // Place on edges between vertices
			Cost: {
				Wood: 1,
				Brick: 1,
			},
			Size: Vector3.new(2, 1, 8),
			RequiresConnection: true, // Must connect to existing road or settlement
		},
	},
	GetCostString: (blueprintName: string) => {
		const blueprint = Blueprints.Buildings[blueprintName];
		if (!blueprint) {
			return "";
		}

		const parts = new Array<string>();
		for (const [resource, amount] of pairs(blueprint.Cost)) {
			const icon = Blueprints.ResourceIcons[resource] ?? resource;
			parts.push(`${icon}${amount}`);
		}
		return parts.join(" ");
	},
	CanAfford: (resources: Record<string, number>, blueprintName: string) => {
		const blueprint = Blueprints.Buildings[blueprintName];
		if (!blueprint) {
			return false;
		}

		for (const [resource, required] of pairs(blueprint.Cost)) {
			const has = resources[resource] ?? 0;
			if (has < required) {
				return false;
			}
		}
		return true;
	},
	GetBlueprintNames: () => {
		const names = new Array<string>();
		for (const [name] of pairs(Blueprints.Buildings)) {
			names.push(name);
		}
		table.sort(names);
		return names;
	},
};

export type { BlueprintInfo };
export default Blueprints;
