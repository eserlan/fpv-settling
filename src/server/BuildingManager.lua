-- Server-side Building Manager
local BuildingTypes = require(game.ReplicatedStorage.Shared.BuildingTypes)
local Network = require(game.ReplicatedStorage.Shared.Network)

local BuildingManager = {}
BuildingManager.__index = BuildingManager

-- Create a new building manager for a player
function BuildingManager.new(player, resourceManager)
	local self = setmetatable({}, BuildingManager)
	self.Player = player
	self.ResourceManager = resourceManager
	self.Buildings = {}
	self.BuildingInProgress = {}
	
	return self
end

-- Start building construction
function BuildingManager:StartBuilding(buildingType, position)
	if not BuildingTypes[buildingType] then
		warn("Invalid building type:", buildingType)
		return false, "Invalid building type"
	end
	
	local buildingData = BuildingTypes[buildingType]
	
	-- Check if player has enough resources
	if not self.ResourceManager:HasResources(buildingData.Cost) then
		return false, "Not enough resources"
	end
	
	-- Remove resources
	for resourceType, amount in pairs(buildingData.Cost) do
		self.ResourceManager:RemoveResource(resourceType, amount)
	end
	
	-- Create building instance
	local buildingId = #self.Buildings + 1
	local building = {
		Id = buildingId,
		Type = buildingType,
		Position = position,
		Progress = 0,
		BuildTime = buildingData.BuildTime,
		Completed = false,
		Data = buildingData
	}
	
	table.insert(self.BuildingInProgress, building)
	
	Network:FireClient(self.Player, "ConstructionStarted", buildingId, buildingType, position)
	
	return true, buildingId
end

-- Update building construction progress
function BuildingManager:UpdateBuildings(deltaTime)
	for i = #self.BuildingInProgress, 1, -1 do
		local building = self.BuildingInProgress[i]
		building.Progress = building.Progress + deltaTime
		
		if building.Progress >= building.BuildTime then
			-- Building completed
			building.Completed = true
			table.insert(self.Buildings, building)
			table.remove(self.BuildingInProgress, i)
			self:OnBuildingComplete(building)
		end
	end
end

-- Called when a building is completed
function BuildingManager:OnBuildingComplete(building)
	print("Building completed:", building.Type, "for player:", self.Player.Name)
	-- Create physical building in workspace
	self:CreateBuildingModel(building)
	
	Network:FireClient(self.Player, "ConstructionCompleted", building.Id, building.Type)
end

-- Create the physical building model
function BuildingManager:CreateBuildingModel(building)
	local model = Instance.new("Model")
	model.Name = building.Type
	
	local part = Instance.new("Part")
	part.Size = building.Data.Size
	part.Position = building.Position
	part.Anchored = true
	part.Parent = model
	
	-- Color based on building type
	if building.Type == "Road" then
		part.BrickColor = BrickColor.new("Dark stone grey")
	elseif building.Type == "House" then
		part.BrickColor = BrickColor.new("Bright red")
	elseif building.Type == "Storage" then
		part.BrickColor = BrickColor.new("Bright yellow")
	elseif building.Type == "Barracks" then
		part.BrickColor = BrickColor.new("Really black")
	elseif building.Type == "Workshop" then
		part.BrickColor = BrickColor.new("Bright blue")
	end
	
	model.Parent = workspace
	building.Model = model
	
	return model
end

-- Get all completed buildings
function BuildingManager:GetBuildings()
	return self.Buildings
end

-- Get buildings currently under construction
function BuildingManager:GetBuildingsInProgress()
	return self.BuildingInProgress
end

return BuildingManager
