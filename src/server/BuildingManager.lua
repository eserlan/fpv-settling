-- Server-side Building Manager
-- Handles construction of buildings including settlements that claim tiles

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local BuildingTypes = require(ReplicatedStorage.Shared.BuildingTypes)
local Network = require(ReplicatedStorage.Shared.Network)
local Logger = require(ReplicatedStorage.Shared.Logger)

-- TileOwnershipManager will be required when needed to avoid circular deps
local TileOwnershipManager = nil
local function getTileOwnershipManager()
	if not TileOwnershipManager then
		TileOwnershipManager = require(script.Parent.TileOwnershipManager)
	end
	return TileOwnershipManager
end

-- MapGenerator provides vertex snapping
local MapGenerator = require(script.Parent.MapGenerator)

local BuildingManager = {}
BuildingManager.__index = BuildingManager

-- Create a new building manager for a player
function BuildingManager.new(player, resourceManager)
	local self = setmetatable({}, BuildingManager)
	self.Player = player
	self.ResourceManager = resourceManager
	self.Buildings = {}
	self.Settlements = {} -- Track settlements separately
	self.BuildingInProgress = {}
	self.HasPlacedFirstSettlement = false
	
	return self
end

-- Start building construction
function BuildingManager:StartBuilding(buildingType, position)
	if not BuildingTypes[buildingType] then
		Logger.Warn("BuildingManager", "Invalid building type: " .. tostring(buildingType))
		return false, "Invalid building type"
	end
	
	local buildingData = BuildingTypes[buildingType]
	local finalPosition = position
	
	-- Snap settlements to hex vertices (pre-calculated markers)
	if buildingData.IsSettlement then
		local nearestVertex, dist = MapGenerator.FindNearestVertex(position)
		if nearestVertex then
			finalPosition = nearestVertex.Position
			Logger.Debug("BuildingManager", "Snapped to vertex " .. nearestVertex.Name .. " (dist: " .. math.floor(dist) .. ")")
		end
	end
	
	-- First settlement is FREE
	local isFreeFirstSettlement = buildingData.IsSettlement and not self.HasPlacedFirstSettlement
	
	-- Check if player has enough resources (unless free first settlement)
	if not isFreeFirstSettlement then
		if not self.ResourceManager:HasResources(buildingData.Cost) then
			Logger.Warn("BuildingManager", self.Player.Name .. " doesn't have enough resources for " .. buildingType)
			return false, "Not enough resources"
		end
		
		-- Remove resources
		for resourceType, amount in pairs(buildingData.Cost) do
			self.ResourceManager:RemoveResource(resourceType, amount)
		end
	else
		Logger.Info("BuildingManager", self.Player.Name .. " placing FREE first settlement!")
	end
	
	-- Create building instance
	local buildingId = #self.Buildings + 1
	local building = {
		Id = buildingId,
		Type = buildingType,
		Position = finalPosition, -- Use snapped position for settlements
		Progress = 0,
		BuildTime = buildingData.BuildTime,
		Completed = false,
		Data = buildingData,
		IsSettlement = buildingData.IsSettlement
	}
	
	-- If instant build (BuildTime = 0), complete immediately
	if buildingData.BuildTime == 0 then
		building.Completed = true
		table.insert(self.Buildings, building)
		self:OnBuildingComplete(building)
	else
		table.insert(self.BuildingInProgress, building)
		Network:FireClient(self.Player, "ConstructionStarted", buildingId, buildingType, finalPosition)
	end
	
	-- Mark first settlement as placed
	if buildingData.IsSettlement and not self.HasPlacedFirstSettlement then
		self.HasPlacedFirstSettlement = true
	end
	
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
	Logger.Info("BuildingManager", "Building completed: " .. building.Type .. " for player: " .. self.Player.Name)
	
	-- Create physical building in workspace
	self:CreateBuildingModel(building)
	
	-- If it's a settlement, claim nearby tiles
	if building.IsSettlement then
		local settlementId = self.Player.UserId .. "_" .. building.Id
		local ownership = getTileOwnershipManager()
		local claimedTiles = ownership.ClaimTilesNearSettlement(self.Player, building.Position, settlementId)
		
		table.insert(self.Settlements, building)
		Logger.Info("BuildingManager", "Settlement claimed " .. #claimedTiles .. " tiles")
	end
	
	Network:FireClient(self.Player, "ConstructionCompleted", building.Id, building.Type)
end

-- Create the physical building model
function BuildingManager:CreateBuildingModel(building)
	local model = Instance.new("Model")
	model.Name = self.Player.Name .. "_" .. building.Type .. "_" .. building.Id
	
	local part = Instance.new("Part")
	part.Size = building.Data.Size
	part.Position = building.Position
	part.Anchored = true
	part.Parent = model
	
	-- Color based on building type
	if building.Type == "Settlement" then
		-- Create a proper house shape!
		-- Base/walls
		part.Size = Vector3.new(5, 4, 5)
		part.Position = building.Position + Vector3.new(0, 2, 0)
		part.Color = Color3.fromRGB(220, 200, 160) -- Cream walls
		part.Material = Enum.Material.SmoothPlastic
		
		-- Roof - using 2 wedges to form A-frame
		-- WedgePart: the slanted face points in -Z direction by default
		local roofHeight = 2.5
		local roofOverhang = 0.5
		
		-- Left side of roof
		local roof1 = Instance.new("WedgePart")
		roof1.Size = Vector3.new(5 + roofOverhang * 2, roofHeight, 3)
		roof1.CFrame = CFrame.new(building.Position + Vector3.new(0, 4 + roofHeight/2, -1.5)) 
			* CFrame.Angles(0, 0, 0)
		roof1.Anchored = true
		roof1.Color = Color3.fromRGB(139, 69, 19) -- Brown roof
		roof1.Material = Enum.Material.Wood
		roof1.Parent = model
		
		-- Right side of roof (rotated 180 degrees around Y)
		local roof2 = Instance.new("WedgePart")
		roof2.Size = Vector3.new(5 + roofOverhang * 2, roofHeight, 3)
		roof2.CFrame = CFrame.new(building.Position + Vector3.new(0, 4 + roofHeight/2, 1.5)) 
			* CFrame.Angles(0, math.pi, 0)
		roof2.Anchored = true
		roof2.Color = Color3.fromRGB(139, 69, 19) -- Brown roof
		roof2.Material = Enum.Material.Wood
		roof2.Parent = model
		
		-- Door
		local door = Instance.new("Part")
		door.Size = Vector3.new(1.2, 2.5, 0.3)
		door.Position = building.Position + Vector3.new(0, 1.25, 2.6)
		door.Anchored = true
		door.Color = Color3.fromRGB(101, 67, 33) -- Dark wood door
		door.Material = Enum.Material.Wood
		door.Parent = model
		
		-- Window
		local window = Instance.new("Part")
		window.Size = Vector3.new(1, 1, 0.2)
		window.Position = building.Position + Vector3.new(1.5, 2.5, 2.6)
		window.Anchored = true
		window.Color = Color3.fromRGB(135, 206, 235) -- Light blue glass
		window.Material = Enum.Material.Glass
		window.Transparency = 0.3
		window.Parent = model
	elseif building.Type == "City" then
		part.Color = Color3.fromRGB(80, 80, 80) -- Stone grey
		part.Material = Enum.Material.Slate
	elseif building.Type == "Road" then
		part.Color = Color3.fromRGB(100, 80, 60) -- Dirt road
		part.Material = Enum.Material.Ground
	elseif building.Type == "House" then
		part.Color = Color3.fromRGB(200, 100, 80) -- Red house
		part.Material = Enum.Material.Brick
	elseif building.Type == "Storage" then
		part.Color = Color3.fromRGB(180, 140, 60) -- Yellow storage
		part.Material = Enum.Material.Wood
	end
	
	-- Put in appropriate folder
	local folderName = building.IsSettlement and "Settlements" or "Buildings"
	local folder = workspace:FindFirstChild(folderName) or Instance.new("Folder", workspace)
	folder.Name = folderName
	model.Parent = folder
	model.PrimaryPart = part
	
	building.Model = model
	
	return model
end

-- Get all completed buildings
function BuildingManager:GetBuildings()
	return self.Buildings
end

-- Get settlements
function BuildingManager:GetSettlements()
	return self.Settlements
end

-- Get buildings currently under construction
function BuildingManager:GetBuildingsInProgress()
	return self.BuildingInProgress
end

return BuildingManager
