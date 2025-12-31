-- Resource types for The Pulse system (Catan-inspired)
local ResourceTypes = {
	Brick = {
		Name = "Brick",
		Icon = "🧱",
		Description = "Clay bricks for building foundations",
		Color = Color3.fromRGB(178, 102, 59),
		Material = Enum.Material.Brick,
		TileType = "Hills", -- Spawns from Hills tiles
		MaxStack = 50,
		BuildingCost = { Settlement = 1, Road = 1 }
	},
	Wood = {
		Name = "Wood",
		Icon = "🪵",
		Description = "Lumber for construction",
		Color = Color3.fromRGB(139, 90, 43),
		Material = Enum.Material.Wood,
		TileType = "Forest",
		MaxStack = 50,
		BuildingCost = { Settlement = 1, Road = 1 }
	},
	Wheat = {
		Name = "Wheat",
		Icon = "🌾",
		Description = "Grain for settlements and cities",
		Color = Color3.fromRGB(218, 165, 32),
		Material = Enum.Material.Grass,
		TileType = "Fields",
		MaxStack = 50,
		BuildingCost = { Settlement = 1, City = 2 }
	},
	Ore = {
		Name = "Ore",
		Icon = "⛏️",
		Description = "Iron ore for advanced construction",
		Color = Color3.fromRGB(105, 105, 105),
		Material = Enum.Material.Slate,
		TileType = "Mountains",
		MaxStack = 50,
		BuildingCost = { City = 3 }
	},
	Wool = {
		Name = "Wool",
		Icon = "🧶",
		Description = "Wool from sheep for settlements",
		Color = Color3.fromRGB(245, 245, 245),
		Material = Enum.Material.SmoothPlastic,
		TileType = "Pasture",
		MaxStack = 50,
		BuildingCost = { Settlement = 1 }
	}
}

-- Get resource type by tile type
function ResourceTypes.GetByTileType(tileType)
	for key, data in pairs(ResourceTypes) do
		if type(data) == "table" and data.TileType == tileType then
			return key, data
		end
	end
	return nil, nil
end

return ResourceTypes
