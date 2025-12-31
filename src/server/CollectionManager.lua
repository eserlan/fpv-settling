-- COLLECTION MANAGER - Handles physical resource collection
-- Players walk near resources to collect them

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local ResourceTypes = require(ReplicatedStorage.Shared.ResourceTypes)
local Logger = require(ReplicatedStorage.Shared.Logger)

local CollectionManager = {}

-- Configuration
local COLLECTION_RANGE = 8 -- Studs - how close player needs to be
local COLLECTION_COOLDOWN = 0.5 -- Seconds between collections

-- Player collection cooldowns
local playerCooldowns = {}

-- Events
local Events = ReplicatedStorage:FindFirstChild("Events") or Instance.new("Folder", ReplicatedStorage)
Events.Name = "Events"

local CollectEvent = Events:FindFirstChild("CollectEvent") or Instance.new("RemoteEvent", Events)
CollectEvent.Name = "CollectEvent"

-- Player inventories (simple table for now)
local playerInventories = {}

-- Initialize player inventory with starting resources
function CollectionManager.InitPlayer(player)
	-- Starting resources: enough for 1 settlement + 1 road
	-- Settlement: Wood 1, Brick 1, Wheat 1, Wool 1
	-- Road: Wood 1, Brick 1
	playerInventories[player.UserId] = {
		Wood = 2,
		Brick = 2,
		Wheat = 1,
		Wool = 1,
		Ore = 0
	}
	playerCooldowns[player.UserId] = 0
	
	-- Send initial inventory to client
	task.delay(0.5, function()
		CollectEvent:FireClient(player, "InventoryUpdate", playerInventories[player.UserId])
	end)
	
	Logger.Debug("CollectionManager", "Initialized inventory for " .. player.Name .. " with starting resources")
end

-- Remove player inventory on leave
function CollectionManager.RemovePlayer(player)
	playerInventories[player.UserId] = nil
	playerCooldowns[player.UserId] = nil
end

-- Get player inventory
function CollectionManager.GetInventory(player)
	return playerInventories[player.UserId]
end

-- Add resource to player inventory
function CollectionManager.AddResource(player, resourceType, amount)
	local inventory = playerInventories[player.UserId]
	if not inventory then return false end
	
	if inventory[resourceType] ~= nil then
		inventory[resourceType] = inventory[resourceType] + amount
		
		-- Notify client
		CollectEvent:FireClient(player, "InventoryUpdate", inventory)
		
		return true
	end
	
	return false
end

-- Remove resource from player inventory
function CollectionManager.RemoveResource(player, resourceType, amount)
	local inventory = playerInventories[player.UserId]
	if not inventory then return false end
	
	if inventory[resourceType] and inventory[resourceType] >= amount then
		inventory[resourceType] = inventory[resourceType] - amount
		
		-- Notify client
		CollectEvent:FireClient(player, "InventoryUpdate", inventory)
		
		return true
	end
	
	return false
end

-- Check if player has enough resources
function CollectionManager.HasResources(player, requirements)
	local inventory = playerInventories[player.UserId]
	if not inventory then return false end
	
	for resourceType, amount in pairs(requirements) do
		if not inventory[resourceType] or inventory[resourceType] < amount then
			return false
		end
	end
	
	return true
end

-- Try to collect a specific resource
function CollectionManager.TryCollect(player, resource)
	if not resource or not resource.Parent then return false end
	
	local userId = player.UserId
	
	-- Check cooldown
	if playerCooldowns[userId] and playerCooldowns[userId] > 0 then
		return false
	end
	
	-- Check if player has a character
	local character = player.Character
	if not character then return false end
	
	local humanoidRootPart = character:FindFirstChild("HumanoidRootPart")
	if not humanoidRootPart then return false end
	
	-- Check distance
	local distance = (humanoidRootPart.Position - resource.Position).Magnitude
	if distance > COLLECTION_RANGE then
		return false
	end
	
	-- Get resource info
	local resourceType = resource:GetAttribute("ResourceType")
	local amount = resource:GetAttribute("Amount") or 1
	local tileQ = resource:GetAttribute("TileQ")
	local tileR = resource:GetAttribute("TileR")
	
	if not resourceType then return false end
	
	-- Check tile ownership (if TileOwnershipManager exists)
	local TileOwnershipManager = script.Parent:FindFirstChild("TileOwnershipManager")
	if TileOwnershipManager and tileQ and tileR then
		local ownershipModule = require(TileOwnershipManager)
		if not ownershipModule.PlayerOwnsTile(player, tileQ, tileR) then
			-- Player doesn't own this tile - can't collect
			return false
		end
	end
	
	-- Add to inventory
	if CollectionManager.AddResource(player, resourceType, amount) then
		-- Set cooldown
		playerCooldowns[userId] = COLLECTION_COOLDOWN
		
		-- Create collection effect
		CollectionManager.CreateCollectionEffect(resource.Position, resourceType)
		
		-- Notify client
		CollectEvent:FireClient(player, "Collected", resourceType, amount)
		
		-- Destroy the resource
		resource:Destroy()
		
		Logger.Debug("CollectionManager", player.Name .. " collected " .. amount .. " " .. resourceType)
		return true
	end
	
	return false
end

-- Create visual effect when collecting
function CollectionManager.CreateCollectionEffect(position, resourceType)
	local data = ResourceTypes[resourceType]
	if not data then return end
	
	-- Create sparkle particles
	local effect = Instance.new("Part")
	effect.Name = "CollectEffect"
	effect.Size = Vector3.new(1, 1, 1)
	effect.Position = position
	effect.Anchored = true
	effect.CanCollide = false
	effect.Transparency = 1
	effect.Parent = workspace
	
	local particles = Instance.new("ParticleEmitter")
	particles.Color = ColorSequence.new(data.Color)
	particles.Size = NumberSequence.new(1, 0)
	particles.Lifetime = NumberRange.new(0.5, 1)
	particles.Speed = NumberRange.new(5, 10)
	particles.SpreadAngle = Vector2.new(180, 180)
	particles.Rate = 50
	particles.Parent = effect
	
	-- Destroy after short time
	task.delay(0.5, function()
		particles.Enabled = false
		task.wait(1)
		effect:Destroy()
	end)
end

-- Update loop - check cooldowns and nearby resources
function CollectionManager.Update(deltaTime)
	-- Update cooldowns
	for userId, cooldown in pairs(playerCooldowns) do
		if cooldown > 0 then
			playerCooldowns[userId] = cooldown - deltaTime
		end
	end
	
	-- Check each player for nearby resources
	local resourcesFolder = workspace:FindFirstChild("Resources")
	if not resourcesFolder then return end
	
	for _, player in ipairs(Players:GetPlayers()) do
		local character = player.Character
		if not character then continue end
		
		local humanoidRootPart = character:FindFirstChild("HumanoidRootPart")
		if not humanoidRootPart then continue end
		
		local playerPos = humanoidRootPart.Position
		
		-- Check all resources
		for _, resource in ipairs(resourcesFolder:GetChildren()) do
			if resource:IsA("BasePart") then
				local distance = (playerPos - resource.Position).Magnitude
				if distance <= COLLECTION_RANGE then
					CollectionManager.TryCollect(player, resource)
				end
			end
		end
	end
end

-- Handle client request for inventory
CollectEvent.OnServerEvent:Connect(function(player, action)
	if action == "GetInventory" then
		local inventory = CollectionManager.GetInventory(player)
		if inventory then
			CollectEvent:FireClient(player, "InventoryUpdate", inventory)
		end
	end
end)

Logger.Info("CollectionManager", "Initialized")

return CollectionManager
