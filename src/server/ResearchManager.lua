-- Server-side Research Manager
local TechTree = require(game.ReplicatedStorage.Shared.TechTree)
local Network = require(game.ReplicatedStorage.Shared.Network)

local ResearchManager = {}
ResearchManager.__index = ResearchManager

-- Create a new research manager for a player
function ResearchManager.new(player, resourceManager)
	local self = setmetatable({}, ResearchManager)
	self.Player = player
	self.ResourceManager = resourceManager
	self.ResearchedTechs = {}
	self.CurrentResearch = nil
	self.ResearchProgress = 0
	
	return self
end

-- Start researching a technology
function ResearchManager:StartResearch(techName)
	if not TechTree[techName] then
		warn("Invalid technology:", techName)
		return false, "Invalid technology"
	end
	
	local tech = TechTree[techName]
	
	-- Check if already researched
	if self:HasResearched(techName) then
		return false, "Already researched"
	end
	
	-- Check prerequisites
	for _, prereq in ipairs(tech.Prerequisites) do
		if not self:HasResearched(prereq) then
			return false, "Missing prerequisite: " .. prereq
		end
	end
	
	-- Check if player has enough resources
	if not self.ResourceManager:HasResources(tech.Cost) then
		return false, "Not enough resources"
	end
	
	-- Check if already researching something
	if self.CurrentResearch then
		return false, "Already researching: " .. self.CurrentResearch
	end
	
	-- Remove research cost
	for resourceType, amount in pairs(tech.Cost) do
		self.ResourceManager:RemoveResource(resourceType, amount)
	end
	
	-- Start research
	self.CurrentResearch = techName
	self.ResearchProgress = 0
	
	Network:FireClient(self.Player, "ResearchStarted", techName, tech.ResearchTime)
	
	return true, techName
end

-- Update research progress
function ResearchManager:UpdateResearch(deltaTime)
	if not self.CurrentResearch then
		return
	end
	
	local tech = TechTree[self.CurrentResearch]
	self.ResearchProgress = self.ResearchProgress + deltaTime
	
	if self.ResearchProgress >= tech.ResearchTime then
		-- Research completed
		self:CompleteResearch(self.CurrentResearch)
	end
end

-- Complete research
function ResearchManager:CompleteResearch(techName)
	table.insert(self.ResearchedTechs, techName)
	print("Research completed:", techName, "for player:", self.Player.Name)
	
	-- Apply effects
	local tech = TechTree[techName]
	self:ApplyTechEffect(techName, tech)
	
	self.CurrentResearch = nil
	self.ResearchProgress = 0
	
	Network:FireClient(self.Player, "ResearchCompleted", techName)
end

-- Apply technology effect
function ResearchManager:ApplyTechEffect(techName, tech)
	-- Tech effects are passive and are checked when needed
	-- For example, building costs are reduced when constructing
	-- This method could trigger events or update player stats
	print("Applied tech effect:", tech.Effect, "with modifier:", tech.Modifier or "N/A")
end

-- Check if a technology has been researched
function ResearchManager:HasResearched(techName)
	for _, tech in ipairs(self.ResearchedTechs) do
		if tech == techName then
			return true
		end
	end
	return false
end

-- Get research progress as percentage
function ResearchManager:GetResearchProgress()
	if not self.CurrentResearch then
		return 0
	end
	
	local tech = TechTree[self.CurrentResearch]
	return (self.ResearchProgress / tech.ResearchTime) * 100
end

-- Get all researched technologies
function ResearchManager:GetResearchedTechs()
	return self.ResearchedTechs
end

-- Get current research
function ResearchManager:GetCurrentResearch()
	return self.CurrentResearch
end

-- Get tech modifier for a specific effect
-- Note: Currently uses multiplicative stacking for all effects
-- Future improvement: Use additive stacking for cost reduction effects
function ResearchManager:GetModifier(effectType)
	local modifier = 1
	
	for _, techName in ipairs(self.ResearchedTechs) do
		local tech = TechTree[techName]
		if tech.Effect == effectType and tech.Modifier then
			-- Multiplicative stacking (e.g., 1.25 * 1.5 = 1.875)
			-- Works well for speed/production bonuses
			-- For cost reduction, consider additive in future versions
			modifier = modifier * tech.Modifier
		end
	end
	
	return modifier
end

return ResearchManager
