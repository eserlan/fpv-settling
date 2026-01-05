// Building types that can be constructed (Catan-style resources)

type BuildingInfo = {
	Name: string;
	Description: string;
	Cost: Record<string, number>;
	BuildTime: number;
	Size: Vector3;
	ClaimRadius?: number;
	IsTown?: boolean;
	RequiresTown?: boolean;
	IsRoad?: boolean;
	Capacity?: number;
	StorageCapacity?: number;
	Points?: number;
};

const BuildingTypes: Record<string, BuildingInfo> = {
	Town: {
		Name: "Town",
		Description: "Your base! Claims nearby tiles for resource collection",
		Cost: {
			Wood: 1,
			Brick: 1,
			Wheat: 1,
			Wool: 1,
		},
		BuildTime: 0, // Instant for first town
		Size: new Vector3(10, 8, 10),
		ClaimRadius: 30, // Studs - claims tiles within this radius
		IsTown: true,
		Points: 1,
	},
	City: {
		Name: "City",
		Description: "Upgrade a town for double resources",
		Cost: {
			Wheat: 2,
			Ore: 3,
		},
		BuildTime: 10,
		Size: new Vector3(15, 12, 15),
		ClaimRadius: 40,
		IsTown: true,
		RequiresTown: true, // Must be built on existing town
		Points: 2,
	},
	Road: {
		Name: "Road",
		Description: "Connects towns, required for expansion",
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
