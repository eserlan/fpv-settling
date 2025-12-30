-- Server-side NPC Manager
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local NPCTypes = require(ReplicatedStorage.Shared.NPCTypes)
local Network = require(ReplicatedStorage.Shared.Network)
local Logger = require(ReplicatedStorage.Shared.Logger)

local NPCManager = {}
NPCManager.__index = NPCManager

-- Create a new NPC manager for a player
function NPCManager.new(player, resourceManager)
	local self = setmetatable({}, NPCManager)
	self.Player = player
	self.ResourceManager = resourceManager
	self.NPCs = {}
	self.NextNPCId = 1
	
	return self
end

-- Hire a new NPC
function NPCManager:HireNPC(npcType, position)
	if not NPCTypes[npcType] then
		Logger.Warn("NPCManager", "Invalid NPC type: " .. tostring(npcType))
		return false, "Invalid NPC type"
	end
	
	local npcData = NPCTypes[npcType]
	
	-- Check if player has enough resources to hire
	if not self.ResourceManager:HasResources(npcData.HireCost) then
		return false, "Not enough resources to hire"
	end
	
	-- Remove hiring cost
	for resourceType, amount in pairs(npcData.HireCost) do
		self.ResourceManager:RemoveResource(resourceType, amount)
	end
	
	-- Create NPC
	local npc = {
		Id = self.NextNPCId,
		Type = npcType,
		Position = position or Vector3.new(0, 5, 0),
		Health = npcData.Health,
		MaxHealth = npcData.Health,
		State = "Idle",
		Target = nil,
		Data = npcData
	}
	
	self.NextNPCId = self.NextNPCId + 1
	table.insert(self.NPCs, npc)
	
	-- Create physical NPC model
	self:CreateNPCModel(npc)
	
	Network:FireClient(self.Player, "NPCHired", npc.Id, npcType, position)
	
	return true, npc.Id
end

-- Create the physical NPC model
function NPCManager:CreateNPCModel(npc)
	local model = Instance.new("Model")
	model.Name = npc.Type .. "_" .. npc.Id
	
	-- Create simple humanoid model
	local torso = Instance.new("Part")
	torso.Name = "Torso"
	torso.Size = Vector3.new(2, 2, 1)
	torso.Position = npc.Position
	torso.Anchored = false
	
	-- Color based on NPC type
	if npc.Type == "Worker" then
		torso.BrickColor = BrickColor.new("Bright yellow")
	elseif npc.Type == "Guard" then
		torso.BrickColor = BrickColor.new("Bright red")
	end
	
	torso.Parent = model
	
	local head = Instance.new("Part")
	head.Name = "Head"
	head.Size = Vector3.new(1, 1, 1)
	head.Shape = Enum.PartType.Ball
	head.Position = npc.Position + Vector3.new(0, 1.5, 0)
	head.BrickColor = BrickColor.new("Light orange")
	head.Parent = model
	
	-- Create neck weld
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = torso
	weld.Part1 = head
	weld.Parent = torso
	
	-- Add humanoid
	local humanoid = Instance.new("Humanoid")
	humanoid.MaxHealth = npc.MaxHealth
	humanoid.Health = npc.Health
	humanoid.WalkSpeed = npc.Data.Speed
	humanoid.Parent = model
	
	model.Parent = workspace
	model.PrimaryPart = torso
	npc.Model = model
	
	return model
end

-- Update NPCs (AI, movement, resource gathering)
function NPCManager:UpdateNPCs(deltaTime)
	for _, npc in ipairs(self.NPCs) do
		if npc.Type == "Worker" then
			self:UpdateWorker(npc, deltaTime)
		elseif npc.Type == "Guard" then
			self:UpdateGuard(npc, deltaTime)
		end
	end
end

-- Worker AI logic
function NPCManager:UpdateWorker(worker, deltaTime)
	if worker.State == "Idle" then
		-- Simple idle behavior - could be expanded to gather resources
		-- For now, workers just exist and consume food
	elseif worker.State == "Gathering" then
		-- Gathering logic would go here
	end
end

-- Guard AI logic
function NPCManager:UpdateGuard(guard, deltaTime)
	if guard.State == "Idle" then
		-- Patrol or watch for threats
	elseif guard.State == "Attacking" then
		-- Attack logic would go here
	end
end

-- Pay maintenance costs for all NPCs
function NPCManager:PayMaintenance(minutes)
	local totalWheat = 0
	
	for _, npc in ipairs(self.NPCs) do
		totalWheat = totalWheat + (npc.Data.MaintenanceCost.Wheat * minutes)
	end
	
	-- Check if player has enough food
	if self.ResourceManager:GetResource("Wheat") >= totalWheat then
		self.ResourceManager:RemoveResource("Wheat", totalWheat)
		return true
	else
		-- Not enough food - NPCs might leave or become unhappy
		Logger.Warn("NPCManager", "Not enough food to maintain NPCs!")
		return false
	end
end

-- Get all NPCs
function NPCManager:GetNPCs()
	return self.NPCs
end

-- Get NPC by ID
function NPCManager:GetNPC(npcId)
	for _, npc in ipairs(self.NPCs) do
		if npc.Id == npcId then
			return npc
		end
	end
	return nil
end

-- Fire/remove an NPC
function NPCManager:FireNPC(npcId)
	for i, npc in ipairs(self.NPCs) do
		if npc.Id == npcId then
			if npc.Model then
				npc.Model:Destroy()
			end
			table.remove(self.NPCs, i)
			return true
		end
	end
	return false
end

return NPCManager
