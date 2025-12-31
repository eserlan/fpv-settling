-- Blueprint definitions for the building system
-- Used by BlueprintBookUI and ConstructionManager

local Blueprints = {}

-- Resource icons for display
Blueprints.ResourceIcons = {
	Wood = "🌲",
	Brick = "🧱",
	Wheat = "🌾",
	Ore = "⛏",
	Wool = "🧶"
}

-- Building blueprints
Blueprints.Buildings = {
	Settlement = {
		Name = "Settlement",
		Icon = "🏠",
		Description = "A small village that claims adjacent tiles",
		PlacementType = "3-way", -- Place on 3-way vertices
		Cost = {
			Wood = 1,
			Brick = 1,
			Wheat = 1,
			Wool = 1
		},
		Size = Vector3.new(5, 4, 5),
		ClaimsTiles = true,
		FirstIsFree = true, -- First settlement is free for new players
	},
	
	City = {
		Name = "City",
		Icon = "🏰",
		Description = "Upgrade a settlement to double resource production",
		PlacementType = "upgrade", -- Must upgrade existing settlement
		RequiresExisting = "Settlement",
		Cost = {
			Wheat = 2,
			Ore = 3
		},
		Size = Vector3.new(7, 6, 7),
		ProductionMultiplier = 2,
	},
	
	Road = {
		Name = "Road",
		Icon = "🛣️",
		Description = "Connect your settlements",
		PlacementType = "edge", -- Place on edges between vertices
		Cost = {
			Wood = 1,
			Brick = 1
		},
		Size = Vector3.new(2, 1, 8),
		RequiresConnection = true, -- Must connect to existing road or settlement
	}
}

-- Get total cost of a blueprint as a formatted string
function Blueprints.GetCostString(blueprintName)
	local blueprint = Blueprints.Buildings[blueprintName]
	if not blueprint then return "" end
	
	local parts = {}
	for resource, amount in pairs(blueprint.Cost) do
		local icon = Blueprints.ResourceIcons[resource] or resource
		table.insert(parts, icon .. amount)
	end
	return table.concat(parts, " ")
end

-- Check if player can afford a blueprint
function Blueprints.CanAfford(resources, blueprintName)
	local blueprint = Blueprints.Buildings[blueprintName]
	if not blueprint then return false end
	
	for resource, required in pairs(blueprint.Cost) do
		local has = resources[resource] or 0
		if has < required then
			return false
		end
	end
	return true
end

-- Get list of all blueprint names
function Blueprints.GetBlueprintNames()
	local names = {}
	for name, _ in pairs(Blueprints.Buildings) do
		table.insert(names, name)
	end
	-- Sort for consistent order
	table.sort(names)
	return names
end

return Blueprints
