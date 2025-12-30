-- Main Game Manager Server Script
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local ResourceManager = require(script.Parent.ResourceManager)
local BuildingManager = require(script.Parent.BuildingManager)
local NPCManager = require(script.Parent.NPCManager)
local ResearchManager = require(script.Parent.ResearchManager)
local NetworkHandler = require(script.Parent.NetworkHandler)
local MapGenerator = require(script.Parent.MapGenerator)
local PulseManager = require(script.Parent.PulseManager)
local CollectionManager = require(script.Parent.CollectionManager)
local LogService = require(script.Parent.LogService)
local TileOwnershipManager = require(script.Parent.TileOwnershipManager)

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Logger = require(ReplicatedStorage.Shared.Logger)

local GameManager = {}
GameManager.PlayerData = {}

-- Generate the procedural map
MapGenerator.Generate()

-- Initialize the Pulse system
PulseManager.Initialize()

-- Create a starting settlement for a player
local function createStartingSettlement(player, spawnPosition)
	-- Create simple settlement model
	local settlement = Instance.new("Model")
	settlement.Name = player.Name .. "_Settlement"
	
	local base = Instance.new("Part")
	base.Name = "Base"
	base.Size = Vector3.new(10, 2, 10)
	base.Position = spawnPosition + Vector3.new(5, 1, 5)
	base.Anchored = true
	base.Color = Color3.fromRGB(139, 90, 43) -- Brown
	base.Material = Enum.Material.Wood
	base.Parent = settlement
	
	local roof = Instance.new("Part")
	roof.Name = "Roof"
	roof.Size = Vector3.new(12, 1, 12)
	roof.Position = base.Position + Vector3.new(0, 4, 0)
	roof.Anchored = true
	roof.Color = Color3.fromRGB(178, 102, 59) -- Terracotta
	roof.Material = Enum.Material.Brick
	roof.Parent = settlement
	
	settlement.PrimaryPart = base
	
	-- Put in Settlements folder
	local settlementsFolder = workspace:FindFirstChild("Settlements") or Instance.new("Folder", workspace)
	settlementsFolder.Name = "Settlements"
	settlement.Parent = settlementsFolder
	
	-- Claim nearby tiles for this player
	local settlementId = player.UserId .. "_" .. os.time()
	TileOwnershipManager.ClaimTilesNearSettlement(player, base.Position, settlementId)
	
	Logger.Info("GameManager", "Created starting settlement for " .. player.Name)
	
	return settlement
end

-- Initialize player data when they join
local function onPlayerAdded(player)
	Logger.Info("GameManager", "Player joined: " .. player.Name)
	
	-- Initialize collection/inventory for this player
	CollectionManager.InitPlayer(player)
	
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
		GameTime = 0,
		Settlement = nil
	}
	
	-- Setup player character and create starting settlement
	player.CharacterAdded:Connect(function(character)
		local humanoid = character:WaitForChild("Humanoid")
		humanoid.WalkSpeed = 16
		
		-- Create starting settlement near spawn (only once)
		local playerData = GameManager.PlayerData[player.UserId]
		if playerData and not playerData.Settlement then
			task.wait(0.5) -- Wait for character to fully spawn
			local spawnPos = character:WaitForChild("HumanoidRootPart").Position
			playerData.Settlement = createStartingSettlement(player, spawnPos)
		end
	end)
end

-- Clean up player data when they leave
local function onPlayerRemoving(player)
	Logger.Info("GameManager", "Player leaving: " .. player.Name)
	CollectionManager.RemovePlayer(player)
	GameManager.PlayerData[player.UserId] = nil
end

-- Game update loop
local lastUpdate = tick()
RunService.Heartbeat:Connect(function()
	local currentTime = tick()
	local deltaTime = currentTime - lastUpdate
	lastUpdate = currentTime
	
	-- Update the Pulse system (global timer)
	PulseManager.Update(deltaTime)
	
	-- Update resource collection
	CollectionManager.Update(deltaTime)
	
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

-- Initialize Network Handler
NetworkHandler.Init(GameManager)

Logger.Info("GameManager", "Game Manager initialized!")

return GameManager
