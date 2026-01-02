// Resource types for The Pulse system (Catan-inspired)

export type ResourceInfo = {
	Name: string;
	Icon: string;
	Description: string;
	Color: Color3;
	Material: Enum.Material;
	TileType: string;
	MaxStack: number;
	BuildingCost: Record<string, number>;
};

// Resource definitions (pure data, no functions)
const Resources: Record<string, ResourceInfo> = {
	Brick: {
		Name: "Brick",
		Icon: "🧱",
		Description: "Clay bricks for building foundations",
		Color: Color3.fromRGB(178, 102, 59),
		Material: Enum.Material.Brick,
		TileType: "Hills",
		MaxStack: 50,
		BuildingCost: { Settlement: 1, Road: 1 },
	},
	Wood: {
		Name: "Wood",
		Icon: "🌲",
		Description: "Lumber for construction",
		Color: Color3.fromRGB(139, 90, 43),
		Material: Enum.Material.Wood,
		TileType: "Forest",
		MaxStack: 50,
		BuildingCost: { Settlement: 1, Road: 1 },
	},
	Wheat: {
		Name: "Wheat",
		Icon: "🌾",
		Description: "Grain for settlements and cities",
		Color: Color3.fromRGB(218, 165, 32),
		Material: Enum.Material.Grass,
		TileType: "Fields",
		MaxStack: 50,
		BuildingCost: { Settlement: 1, City: 2 },
	},
	Ore: {
		Name: "Ore",
		Icon: "⛏",
		Description: "Iron ore for advanced construction",
		Color: Color3.fromRGB(105, 105, 105),
		Material: Enum.Material.Slate,
		TileType: "Mountains",
		MaxStack: 50,
		BuildingCost: { City: 3 },
	},
	Wool: {
		Name: "Wool",
		Icon: "🧶",
		Description: "Wool from sheep for settlements",
		Color: Color3.fromRGB(245, 245, 245),
		Material: Enum.Material.SmoothPlastic,
		TileType: "Pasture",
		MaxStack: 50,
		BuildingCost: { Settlement: 1 },
	},
};

// Utility functions
const GetByTileType = (tileType: string): LuaTuple<[string | undefined, ResourceInfo | undefined]> => {
	for (const [key, data] of pairs(Resources)) {
		if (data.TileType === tileType) {
			return $tuple(key, data);
		}
	}
	return $tuple(undefined, undefined);
};

const GetResourceNames = (): string[] => {
	const names: string[] = [];
	for (const [key] of pairs(Resources)) {
		names.push(key);
	}
	return names;
};

const Get = (name: string): ResourceInfo | undefined => {
	return Resources[name];
};

// Combined module export
const ResourceTypes = {
	// Data - index signature via Resources
	Resources,

	// Direct named access
	Brick: Resources.Brick,
	Wood: Resources.Wood,
	Wheat: Resources.Wheat,
	Ore: Resources.Ore,
	Wool: Resources.Wool,

	// Functions
	GetByTileType,
	GetResourceNames,
	Get,
};

export default ResourceTypes;
