-- Technology research tree
local TechTree = {
	ImprovedTools = {
		Name = "Improved Tools",
		Description = "Workers gather resources 25% faster",
		Cost = {
			Gold = 100
		},
		ResearchTime = 60,
		Prerequisites = {},
		Effect = "GatherSpeed",
		Modifier = 1.25
	},
	StoneWork = {
		Name = "Stone Work",
		Description = "Unlock stone buildings and better fortifications",
		Cost = {
			Gold = 150,
			Stone = 50
		},
		ResearchTime = 90,
		Prerequisites = {},
		Effect = "UnlockBuilding",
		Unlocks = {"StoneWall", "StoneTower"}
	},
	Agriculture = {
		Name = "Agriculture",
		Description = "Food production increases by 50%",
		Cost = {
			Gold = 120,
			Wood = 30
		},
		ResearchTime = 75,
		Prerequisites = {},
		Effect = "FoodProduction",
		Modifier = 1.5
	},
	Military = {
		Name = "Military Training",
		Description = "Guards are 30% more effective in combat",
		Cost = {
			Gold = 200
		},
		ResearchTime = 120,
		Prerequisites = {},
		Effect = "GuardEffectiveness",
		Modifier = 1.3
	},
	AdvancedEngineering = {
		Name = "Advanced Engineering",
		Description = "Buildings cost 20% less resources",
		Cost = {
			Gold = 250,
			Stone = 100
		},
		ResearchTime = 150,
		Prerequisites = {"StoneWork", "ImprovedTools"},
		Effect = "BuildingCost",
		Modifier = 0.8
	},
	Trading = {
		Name = "Trading",
		Description = "Unlock trading posts and better resource exchange rates",
		Cost = {
			Gold = 180
		},
		ResearchTime = 90,
		Prerequisites = {},
		Effect = "UnlockBuilding",
		Unlocks = {"TradingPost"}
	}
}

return TechTree
