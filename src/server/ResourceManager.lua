-- Server-side Resource Manager
local ResourceTypes = require(game.ReplicatedStorage.Shared.ResourceTypes)

local ResourceManager = {}
ResourceManager.__index = ResourceManager

-- Create a new resource manager for a player
function ResourceManager.new(player)
	local self = setmetatable({}, ResourceManager)
	self.Player = player
	self.Resources = {}
	
	-- Initialize all resource types with 0
	for resourceName, _ in pairs(ResourceTypes) do
		self.Resources[resourceName] = 0
	end
	
	-- Give starting resources
	self.Resources.Wood = 50
	self.Resources.Stone = 30
	self.Resources.Food = 20
	self.Resources.Gold = 100
	
	return self
end

-- Add resources to player inventory
function ResourceManager:AddResource(resourceType, amount)
	if not ResourceTypes[resourceType] then
		warn("Invalid resource type:", resourceType)
		return false
	end
	
	local maxStack = ResourceTypes[resourceType].MaxStack
	local currentAmount = self.Resources[resourceType]
	
	-- Check if we can add the full amount
	if currentAmount + amount > maxStack then
		-- Add only what fits
		local addedAmount = maxStack - currentAmount
		self.Resources[resourceType] = maxStack
		return addedAmount
	else
		self.Resources[resourceType] = currentAmount + amount
		return amount
	end
end

-- Remove resources from player inventory
function ResourceManager:RemoveResource(resourceType, amount)
	if not ResourceTypes[resourceType] then
		warn("Invalid resource type:", resourceType)
		return false
	end
	
	if self.Resources[resourceType] >= amount then
		self.Resources[resourceType] = self.Resources[resourceType] - amount
		return true
	end
	
	return false
end

-- Check if player has enough resources
function ResourceManager:HasResources(costs)
	for resourceType, amount in pairs(costs) do
		if not self.Resources[resourceType] or self.Resources[resourceType] < amount then
			return false
		end
	end
	return true
end

-- Get current resource amounts
function ResourceManager:GetResources()
	return self.Resources
end

-- Get specific resource amount
function ResourceManager:GetResource(resourceType)
	return self.Resources[resourceType] or 0
end

return ResourceManager
