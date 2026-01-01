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

const ResourceIcons: Record<string, string> = {
	Wood: "🌲",
	Brick: "🧱",
	Wheat: "🌾",
	Ore: "⛏",
	Wool: "🧶",
};

const Buildings: Record<string, BlueprintInfo> = {
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
		Size: new Vector3(5, 4, 5),
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
		Size: new Vector3(7, 6, 7),
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
		Size: new Vector3(2, 1, 8),
		RequiresConnection: true, // Must connect to existing road or settlement
	},
};

const Blueprints: BlueprintState = {
	ResourceIcons: ResourceIcons,
	Buildings: Buildings,
	GetCostString: (blueprintName: string) => {
		const blueprint = Buildings[blueprintName];
		if (!blueprint) {
			return "";
		}

		const parts = new Array<string>();
		for (const [resource, amount] of pairs(blueprint.Cost)) {
			const res = resource as string;
			const amt = amount as number;
			const icon = ResourceIcons[res] ?? res;
			parts.push(`${icon}${amt}`);
		}
		return parts.join(" ");
	},
	CanAfford: (resources: Record<string, number>, blueprintName: string) => {
		const blueprint = Buildings[blueprintName];
		if (!blueprint) {
			return false;
		}

		for (const [resource, required] of pairs(blueprint.Cost)) {
			const res = resource as string;
			const req = required as number;
			const has = resources[res] ?? 0;
			if (has < req) {
				return false;
			}
		}
		return true;
	},
	GetBlueprintNames: () => {
		const names = new Array<string>();
		for (const [name] of pairs(Buildings)) {
			names.push(name as string);
		}
		table.sort(names);
		return names;
	},
};

export type { BlueprintInfo };
export default Blueprints;
