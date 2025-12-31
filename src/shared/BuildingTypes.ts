// Building types that can be constructed (Catan-style resources)

type BuildingInfo = {
	Name: string;
	Description: string;
	Cost: Record<string, number>;
	BuildTime: number;
	Size: Vector3;
	ClaimRadius?: number;
	IsSettlement?: boolean;
	RequiresSettlement?: boolean;
	IsRoad?: boolean;
	Capacity?: number;
	StorageCapacity?: number;
};

const BuildingTypes: Record<string, BuildingInfo> = {
	Settlement: {
		Name: "Settlement",
		Description: "Your base! Claims nearby tiles for resource collection",
		Cost: {
			Wood: 1,
			Brick: 1,
			Wheat: 1,
			Wool: 1,
		},
		BuildTime: 0, // Instant for first settlement
		Size: new Vector3(10, 8, 10),
		ClaimRadius: 30, // Studs - claims tiles within this radius
		IsSettlement: true,
	},
	City: {
		Name: "City",
		Description: "Upgrade a settlement for double resources",
		Cost: {
			Wheat: 2,
			Ore: 3,
		},
		BuildTime: 10,
		Size: new Vector3(15, 12, 15),
		ClaimRadius: 40,
		IsSettlement: true,
		RequiresSettlement: true, // Must be built on existing settlement
	},
	Road: {
		Name: "Road",
		Description: "Connects settlements, required for expansion",
		Cost: {
			Wood: 1,
			Brick: 1,
		},
		BuildTime: 0,
		Size: new Vector3(4, 0.5, 8),
		IsRoad: true,
	},
	House: {
		Name: "House",
		Description: "Houses workers and increases population",
		Cost: {
			Wood: 3,
			Brick: 2,
			Wheat: 1,
		},
		BuildTime: 10,
		Capacity: 5,
		Size: new Vector3(8, 6, 8),
	},
	Storage: {
		Name: "Storage",
		Description: "Stores extra resources safely",
		Cost: {
			Wood: 2,
			Brick: 2,
		},
		BuildTime: 5,
		StorageCapacity: 50,
		Size: new Vector3(6, 5, 6),
	},
};

export type { BuildingInfo };
export default BuildingTypes;
