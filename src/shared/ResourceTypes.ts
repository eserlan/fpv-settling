// Resource types for The Pulse system (Catan-inspired)

type ResourceInfo = {
	Name: string;
	Icon: string;
	Description: string;
	Color: Color3;
	Material: Enum.Material;
	TileType: string;
	MaxStack: number;
	BuildingCost: Record<string, number>;
};

type ResourceTypesMap = Record<string, ResourceInfo> & {
	GetByTileType: (tileType: string) => LuaTuple<[string | undefined, ResourceInfo | undefined]>;
};

const BaseResources: Record<string, ResourceInfo> = {
	Brick: {
		Name: "Brick",
		Icon: "🧱",
		Description: "Clay bricks for building foundations",
		Color: Color3.fromRGB(178, 102, 59),
		Material: Enum.Material.Brick,
		TileType: "Hills", // Spawns from Hills tiles
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

const ResourceTypes = BaseResources as ResourceTypesMap;

ResourceTypes.GetByTileType = (tileType: string) => {
	for (const [key, data] of pairs(BaseResources)) {
		if (data.TileType === tileType) {
			return $tuple(key, data);
		}
	}
	return $tuple(undefined, undefined);
};

export type { ResourceInfo };
export default ResourceTypes;
