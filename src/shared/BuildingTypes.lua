-- Building types that can be constructed
local BuildingTypes = {
	Road = {
		Name = "Road",
		Description = "Connects settlements and increases travel speed",
		Cost = {
			Wood = 5,
			Stone = 10
		},
		BuildTime = 5,
		Size = Vector3.new(4, 0.5, 4)
	},
	House = {
		Name = "House",
		Description = "Basic settlement building, houses workers",
		Cost = {
			Wood = 50,
			Stone = 30
		},
		BuildTime = 30,
		Capacity = 5,
		Size = Vector3.new(10, 8, 10)
	},
	Storage = {
		Name = "Storage",
		Description = "Stores resources safely",
		Cost = {
			Wood = 30,
			Stone = 20
		},
		BuildTime = 20,
		StorageCapacity = 500,
		Size = Vector3.new(8, 6, 8)
	},
	Barracks = {
		Name = "Barracks",
		Description = "Houses and trains guards",
		Cost = {
			Wood = 40,
			Stone = 50,
			Gold = 100
		},
		BuildTime = 40,
		Capacity = 10,
		Size = Vector3.new(12, 8, 12)
	},
	Workshop = {
		Name = "Workshop",
		Description = "Research new technologies",
		Cost = {
			Wood = 60,
			Stone = 40,
			Gold = 150
		},
		BuildTime = 50,
		Size = Vector3.new(10, 8, 10)
	}
}

return BuildingTypes
