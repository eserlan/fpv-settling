-- Resource types available in the game
local ResourceTypes = {
	Wood = {
		Name = "Wood",
		Description = "Basic building material from trees",
		Icon = "rbxassetid://0", -- Placeholder
		MaxStack = 100
	},
	Stone = {
		Name = "Stone",
		Description = "Durable building material from quarries",
		Icon = "rbxassetid://0", -- Placeholder
		MaxStack = 100
	},
	Food = {
		Name = "Food",
		Description = "Required to sustain workers and guards",
		Icon = "rbxassetid://0", -- Placeholder
		MaxStack = 50
	},
	Gold = {
		Name = "Gold",
		Description = "Currency for hiring and trading",
		Icon = "rbxassetid://0", -- Placeholder
		MaxStack = 500
	}
}

return ResourceTypes
