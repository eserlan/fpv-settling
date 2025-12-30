-- Tile types for procedural generation (Catan-style)
local TileTypes = {
	Forest = {
		Name = "Forest",
		Resource = "Wood",
		Color = Color3.fromHex("#1B4D3E"), -- Deep Forest Green
		Frequency = 4,
	},
	Fields = {
		Name = "Fields",
		Resource = "Wheat",
		Color = Color3.fromHex("#DAA520"), -- Goldenrod (Wheat)
		Frequency = 4,
	},
	Pasture = {
		Name = "Pasture",
		Resource = "Wool",
		Color = Color3.fromHex("#7CFC00"), -- Lawn Green
		Frequency = 4,
	},
	Hills = {
		Name = "Hills",
		Resource = "Brick",
		Color = Color3.fromHex("#B87333"), -- Copper/Terracotta
		Frequency = 3,
	},
	Mountains = {
		Name = "Mountains",
		Resource = "Ore",
		Color = Color3.fromHex("#808080"), -- Grey
		Frequency = 3,
	},
	Desert = {
		Name = "Desert",
		Resource = nil,
		Color = Color3.fromHex("#EDC9AF"), -- Desert Sand
		Frequency = 1,
	}
}

return TileTypes
