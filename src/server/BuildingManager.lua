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

-- New Blueprint Building System: Place a foundation
function BuildingManager:PlaceFoundation(blueprintName, position)
	local Blueprints = require(ReplicatedStorage.Shared.Blueprints)
	local blueprint = Blueprints.Buildings[blueprintName]
	
	if not blueprint then
		Logger.Warn("BuildingManager", "Invalid blueprint: " .. tostring(blueprintName))
		return false, "Invalid blueprint"
	end
	
	-- First settlement is free
	local isFreeFirst = blueprintName == "Settlement" and not self.HasPlacedFirstSettlement
	
	-- Check resources (unless free first settlement)
	if not isFreeFirst then
		for resource, required in pairs(blueprint.Cost) do
			local has = self.ResourceManager:GetResource(resource) or 0
			if has < required then
				Logger.Warn("BuildingManager", self.Player.Name .. " can't afford " .. blueprintName)
				Network:FireClient(self.Player, "BuildingError", "Not enough resources")
				return false, "Not enough resources"
			end
		end
		
		-- Deduct resources
		for resource, required in pairs(blueprint.Cost) do
			self.ResourceManager:RemoveResource(resource, required)
		end
	else
		Logger.Info("BuildingManager", self.Player.Name .. " placing FREE first settlement!")
	end
	
	-- Create the foundation/ghost building
	local foundationId = #self.Buildings + 1
	local foundation = {
		Id = foundationId,
		Type = blueprintName,
		Position = position,
		Blueprint = blueprint,
		IsFoundation = true,
		IsSettlement = blueprint.ClaimsTiles or blueprintName == "Settlement",
		RequiredResources = {}, -- Copy of blueprint cost
		DepositedResources = {}, -- Track what's been deposited
		Progress = 0, -- 0 to 1
		Completed = false,
		OwnerId = self.Player.UserId
	}
	
	-- Copy required resources from blueprint
	for resource, amount in pairs(blueprint.Cost) do
		foundation.RequiredResources[resource] = amount
		foundation.DepositedResources[resource] = 0
	end
	
	-- First settlement is free - auto-deposit all resources
	if isFreeFirst then
		for resource, amount in pairs(blueprint.Cost) do
			foundation.DepositedResources[resource] = amount
		end
		foundation.Progress = 1
		foundation.Completed = true
	end
	
	-- Create physical foundation model
	self:CreateFoundationModel(foundation)
	
	table.insert(self.Buildings, foundation)
	
	-- Store foundation by ID for easy lookup
	self.FoundationsById = self.FoundationsById or {}
	self.FoundationsById[foundationId] = foundation
	
	-- Mark first settlement as placed
	if blueprintName == "Settlement" and not self.HasPlacedFirstSettlement then
		self.HasPlacedFirstSettlement = true
	end
	
	-- Complete immediately if free first settlement
	if foundation.Completed then
		self:OnBuildingComplete(foundation)
	end
	
	-- Notify client about new foundation
	Network:FireClient(self.Player, "FoundationPlaced", foundationId, blueprintName, position, foundation.RequiredResources)
	
	Logger.Info("BuildingManager", self.Player.Name .. " placed foundation for " .. blueprintName .. " (ID: " .. foundationId .. ")")
	return true, foundationId
end

-- Deposit a resource into a foundation
function BuildingManager:DepositResource(foundationId, resourceType)
	local foundation = self.FoundationsById and self.FoundationsById[foundationId]
	if not foundation then
		Logger.Warn("BuildingManager", "Foundation not found: " .. tostring(foundationId))
		return false, "Foundation not found"
	end
	
	if foundation.Completed then
		return false, "Already completed"
	end
	
	-- Check if this resource is needed
	local required = foundation.RequiredResources[resourceType] or 0
	local deposited = foundation.DepositedResources[resourceType] or 0
	
	if deposited >= required then
		return false, "Resource not needed"
	end
	
	-- Deposit the resource
	foundation.DepositedResources[resourceType] = deposited + 1
	
	-- Calculate progress
	local totalRequired = 0
	local totalDeposited = 0
	for res, req in pairs(foundation.RequiredResources) do
		totalRequired = totalRequired + req
		totalDeposited = totalDeposited + (foundation.DepositedResources[res] or 0)
	end
	foundation.Progress = totalDeposited / totalRequired
	
	-- Update the visual
	self:UpdateFoundationVisual(foundation)
	
	-- Check if complete
	if foundation.Progress >= 1 then
		foundation.Completed = true
		self:OnBuildingComplete(foundation)
		Logger.Info("BuildingManager", "Foundation completed: " .. foundation.Type)
	end
	
	-- Notify client
	Network:FireClient(self.Player, "ResourceDeposited", foundationId, resourceType, foundation.Progress)
	
	Logger.Debug("BuildingManager", "Deposited " .. resourceType .. " into foundation " .. foundationId .. " (Progress: " .. math.floor(foundation.Progress * 100) .. "%)")
	return true
end

-- Update foundation visual based on progress
function BuildingManager:UpdateFoundationVisual(foundation)
	if not foundation.Model then return end
	
	local basePart = foundation.Model:FindFirstChild("FoundationBase")
	if not basePart then return end
	
	-- Reduce transparency as progress increases (0.7 at 0%, 0.2 at 100%)
	basePart.Transparency = 0.7 - (foundation.Progress * 0.5)
	
	-- Change color as it completes
	local greenAmount = math.floor(200 + foundation.Progress * 55)
	basePart.Color = Color3.fromRGB(100, greenAmount, 100 + (1 - foundation.Progress) * 155)
	
	-- Update progress bar if exists
	local progressBar = foundation.Model:FindFirstChild("ProgressBar")
	if progressBar then
		local fill = foundation.Model:FindFirstChild("Fill")
		if fill then
			local fillWidth = math.max(0.1, progressBar.Size.X * foundation.Progress)
			fill.Size = Vector3.new(fillWidth, fill.Size.Y, fill.Size.Z)
			-- Move fill to correct position
			fill.Position = progressBar.Position - Vector3.new((progressBar.Size.X - fillWidth) / 2, 0, 0)
		end
	end
	
	-- Update resource display text
	local resourceDisplay = basePart:FindFirstChild("ResourceDisplay")
	if resourceDisplay then
		local resourceLabel = resourceDisplay:FindFirstChild("Resources")
		if resourceLabel then
			local Blueprints = require(ReplicatedStorage.Shared.Blueprints)
			local resourceText = "Needs:\n"
			for resource, required in pairs(foundation.RequiredResources) do
				local icon = Blueprints.ResourceIcons[resource] or ""
				local deposited = foundation.DepositedResources[resource] or 0
				local status = deposited >= required and "✓" or ""
				resourceText = resourceText .. icon .. " " .. deposited .. "/" .. required .. " " .. status .. "\n"
			end
			resourceLabel.Text = resourceText
		end
	end
end

-- Get foundation at position (for client interaction)
function BuildingManager:GetFoundationNear(position, maxDistance)
	maxDistance = maxDistance or 15
	
	for _, building in ipairs(self.Buildings) do
		if building.IsFoundation and not building.Completed then
			local dist = (building.Position - position).Magnitude
			if dist <= maxDistance then
				return building
			end
		end
	end
	return nil
end

-- Create foundation/ghost model with progress indicators
function BuildingManager:CreateFoundationModel(foundation)
	local model = Instance.new("Model")
	model.Name = self.Player.Name .. "_Foundation_" .. foundation.Type .. "_" .. foundation.Id
	
	local size = foundation.Blueprint.Size or Vector3.new(5, 4, 5)
	
	-- Main ghost building
	local part = Instance.new("Part")
	part.Name = "FoundationBase"
	part.Size = size
	part.Position = foundation.Position + Vector3.new(0, size.Y / 2, 0)
	part.Anchored = true
	part.CanCollide = false
	part.Transparency = 0.7 -- Start very transparent
	part.Color = Color3.fromRGB(100, 200, 255) -- Light blue ghost
	part.Material = Enum.Material.ForceField
	part.Parent = model
	
	-- Progress bar background
	local progressBg = Instance.new("Part")
	progressBg.Name = "ProgressBar"
	progressBg.Size = Vector3.new(6, 0.3, 0.3)
	progressBg.Position = foundation.Position + Vector3.new(0, size.Y + 2, 0)
	progressBg.Anchored = true
	progressBg.CanCollide = false
	progressBg.Color = Color3.fromRGB(50, 50, 50)
	progressBg.Material = Enum.Material.SmoothPlastic
	progressBg.Parent = model
	
	-- Progress bar fill
	local progressFill = Instance.new("Part")
	progressFill.Name = "Fill"
	progressFill.Size = Vector3.new(0.1, 0.4, 0.4) -- Starts small
	progressFill.Position = progressBg.Position - Vector3.new(progressBg.Size.X / 2 - 0.05, 0, 0)
	progressFill.Anchored = true
	progressFill.CanCollide = false
	progressFill.Color = Color3.fromRGB(100, 255, 100) -- Green
	progressFill.Material = Enum.Material.Neon
	progressFill.Parent = model
	
	-- Billboard for resource requirements
	local billboard = Instance.new("BillboardGui")
	billboard.Name = "ResourceDisplay"
	billboard.Size = UDim2.new(0, 150, 0, 80)
	billboard.StudsOffset = Vector3.new(0, size.Y + 4, 0)
	billboard.AlwaysOnTop = true
	billboard.Adornee = part
	billboard.Parent = part
	
	local resourceLabel = Instance.new("TextLabel")
	resourceLabel.Name = "Resources"
	resourceLabel.Size = UDim2.new(1, 0, 1, 0)
	resourceLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
	resourceLabel.BackgroundTransparency = 0.3
	resourceLabel.TextColor3 = Color3.new(1, 1, 1)
	resourceLabel.Font = Enum.Font.GothamBold
	resourceLabel.TextSize = 14
	resourceLabel.TextWrapped = true
	resourceLabel.Parent = billboard
	
	-- Build resource text
	local Blueprints = require(ReplicatedStorage.Shared.Blueprints)
	local resourceText = "Needs:\n"
	for resource, amount in pairs(foundation.RequiredResources) do
		local icon = Blueprints.ResourceIcons[resource] or ""
		local deposited = foundation.DepositedResources[resource] or 0
		resourceText = resourceText .. icon .. " " .. deposited .. "/" .. amount .. "\n"
	end
	resourceLabel.Text = resourceText
	
	model.PrimaryPart = part
	model.Parent = workspace:FindFirstChild("Buildings") or workspace
	
	-- Store reference to foundation ID on the model for interaction
	part:SetAttribute("FoundationId", foundation.Id)
	part:SetAttribute("OwnerId", foundation.OwnerId)
	
	foundation.Model = model
end

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
	
	-- Remove foundation model if it exists
	if building.Model then
		building.Model:Destroy()
		building.Model = nil
	end
	
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
	
	-- Get size from Blueprint (new system) or Data (old system)
	local buildingData = building.Blueprint or building.Data or {}
	local size = buildingData.Size or Vector3.new(5, 4, 5)
	
	local part = Instance.new("Part")
	part.Size = size
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
