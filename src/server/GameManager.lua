-- Main Game Manager Server Script
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local ResourceManager = require(script.Parent.ResourceManager)
local BuildingManager = require(script.Parent.BuildingManager)
local NPCManager = require(script.Parent.NPCManager)
local ResearchManager = require(script.Parent.ResearchManager)

local GameManager = {}
GameManager.PlayerData = {}

-- Initialize player data when they join
local function onPlayerAdded(player)
	print("Player joined:", player.Name)
	
	-- Create managers for this player
	local resourceManager = ResourceManager.new(player)
	local buildingManager = BuildingManager.new(player, resourceManager)
	local npcManager = NPCManager.new(player, resourceManager)
	local researchManager = ResearchManager.new(player, resourceManager)
	
	GameManager.PlayerData[player.UserId] = {
		Player = player,
		ResourceManager = resourceManager,
		BuildingManager = buildingManager,
		NPCManager = npcManager,
		ResearchManager = researchManager,
		GameTime = 0
	}
	
	-- Setup player character for first-person view
	player.CharacterAdded:Connect(function(character)
		local humanoid = character:WaitForChild("Humanoid")
		humanoid.WalkSpeed = 16
		
		-- Set camera to first person
		player.CameraMode = Enum.CameraMode.LockFirstPerson
		player.CameraMaxZoomDistance = 0.5
		player.CameraMinZoomDistance = 0.5
	end)
end

-- Clean up player data when they leave
local function onPlayerRemoving(player)
	print("Player leaving:", player.Name)
	GameManager.PlayerData[player.UserId] = nil
end

-- Game update loop
local lastUpdate = tick()
RunService.Heartbeat:Connect(function()
	local currentTime = tick()
	local deltaTime = currentTime - lastUpdate
	lastUpdate = currentTime
	
	-- Update all player systems
	for userId, playerData in pairs(GameManager.PlayerData) do
		playerData.GameTime = playerData.GameTime + deltaTime
		
		-- Update building construction
		playerData.BuildingManager:UpdateBuildings(deltaTime)
		
		-- Update NPCs
		playerData.NPCManager:UpdateNPCs(deltaTime)
		
		-- Update research
		playerData.ResearchManager:UpdateResearch(deltaTime)
		
		-- Pay NPC maintenance every minute
		if playerData.GameTime % 60 < deltaTime then
			playerData.NPCManager:PayMaintenance(1)
		end
	end
end)

-- Connect player events
Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)

-- Handle existing players (in case script loads after players join)
for _, player in ipairs(Players:GetPlayers()) do
	onPlayerAdded(player)
end

print("Game Manager initialized!")

return GameManager
