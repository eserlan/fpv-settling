-- THE PULSE - Resource Collection System
-- Every 60 seconds, a global dice roll happens and resources spawn on matching tiles

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local TileTypes = require(ReplicatedStorage.Shared.TileTypes)
local ResourceTypes = require(ReplicatedStorage.Shared.ResourceTypes)
local Logger = require(ReplicatedStorage.Shared.Logger)

local PulseManager = {}

-- Configuration
local PULSE_INTERVAL = 60 -- Seconds between pulses
local DICE_ROLL_DURATION = 3 -- Seconds for dice animation

-- Catan-style number distribution (excludes 7 - robber)
-- Numbers 6 and 8 are most common, 2 and 12 are rare
local NUMBER_DISTRIBUTION = {2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12}

-- State
local pulseTimer = PULSE_INTERVAL
local isRolling = false
local tileNumbers = {} -- Maps tile coordinates to numbers
local gameStarted = false -- Pulse doesn't start until all players place settlements
local GameManagerRef = nil -- Set on init

-- Events
local Events = ReplicatedStorage:FindFirstChild("Events") or Instance.new("Folder", ReplicatedStorage)
Events.Name = "Events"

local PulseEvent = Events:FindFirstChild("PulseEvent") or Instance.new("RemoteEvent", Events)
PulseEvent.Name = "PulseEvent"

local TimerEvent = Events:FindFirstChild("TimerEvent") or Instance.new("RemoteEvent", Events)
TimerEvent.Name = "TimerEvent"

local SystemMessageEvent = Events:FindFirstChild("SystemMessageEvent") or Instance.new("RemoteEvent", Events)
SystemMessageEvent.Name = "SystemMessageEvent"

-- Roll 2d6 dice
local function rollDice()
	local die1 = math.random(1, 6)
	local die2 = math.random(1, 6)
	return die1, die2, die1 + die2
end

-- Assign numbers to tiles (called after map generation)
function PulseManager.AssignTileNumbers()
	local mapFolder = workspace:FindFirstChild("Map")
	if not mapFolder then return end
	
	-- Create a shuffled copy of the number distribution
	local numbers = {}
	for _, n in ipairs(NUMBER_DISTRIBUTION) do
		table.insert(numbers, n)
	end
	
	-- Shuffle
	for i = #numbers, 2, -1 do
		local j = math.random(1, i)
		numbers[i], numbers[j] = numbers[j], numbers[i]
	end
	
	local numberIndex = 1
	
	for _, tile in ipairs(mapFolder:GetChildren()) do
		if tile:IsA("Model") and tile.PrimaryPart then
			local tileType = tile.PrimaryPart:GetAttribute("TileType")
			
			-- Desert gets no number
			if tileType ~= "Desert" then
				local q = tile.PrimaryPart:GetAttribute("Q")
				local r = tile.PrimaryPart:GetAttribute("R")
				local key = q .. "_" .. r
				
				local number = numbers[numberIndex] or numbers[1]
				tileNumbers[key] = number
				tile.PrimaryPart:SetAttribute("DiceNumber", number)
				
				-- Update the visible dice label
				local labelGui = tile.PrimaryPart:FindFirstChild("TileLabel")
				if labelGui then
					local diceLabel = labelGui:FindFirstChild("DiceNumber")
					if diceLabel then
						diceLabel.Text = "🎲 " .. number
						-- Highlight 6 and 8 (most common rolls) in red
						if number == 6 or number == 8 then
							diceLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
						end
					end
				end
				
				numberIndex = (numberIndex % #numbers) + 1
			end
		end
	end
	
	Logger.Info("PulseManager", "Assigned numbers to tiles")
end

-- Get tiles that match a dice roll
function PulseManager.GetMatchingTiles(diceTotal)
	local matching = {}
	local mapFolder = workspace:FindFirstChild("Map")
	if not mapFolder then return matching end
	
	for _, tile in ipairs(mapFolder:GetChildren()) do
		if tile:IsA("Model") and tile.PrimaryPart then
			local number = tile.PrimaryPart:GetAttribute("DiceNumber")
			if number == diceTotal then
				table.insert(matching, tile)
			end
		end
	end
	
	return matching
end

-- Execute a pulse (dice roll and resource spawn)
function PulseManager.ExecutePulse()
	if isRolling then return end
	isRolling = true
	
	-- Roll the dice
	local die1, die2, total = rollDice()
	
	Logger.Info("PulseManager", "THE PULSE! Rolled " .. die1 .. " + " .. die2 .. " = " .. total)
	
	-- Broadcast to all clients for visual effects
	PulseEvent:FireAllClients("RollStart", die1, die2, total)
	
	-- Wait for animation
	task.wait(DICE_ROLL_DURATION)
	
	-- Get matching tiles and spawn resources
	local matchingTiles = PulseManager.GetMatchingTiles(total)
	
	if total == 7 then
		-- Robber! (TODO: Implement robber mechanics)
		Logger.Warn("PulseManager", "ROBBER! No resources this pulse.")
		PulseEvent:FireAllClients("Robber")
		SystemMessageEvent:FireAllClients("🏴‍☠️ Robber! No resources this round.")
	else
		Logger.Info("PulseManager", #matchingTiles .. " tiles match!")
		
		-- Track spawned resources for the message
		local spawnedResources = {}
		
		for _, tile in ipairs(matchingTiles) do
			local tileType = tile.PrimaryPart:GetAttribute("TileType")
			local resourceKey, resourceData = ResourceTypes.GetByTileType(tileType)
			
			if resourceKey then
				PulseManager.SpawnResource(tile, resourceKey, resourceData)
				spawnedResources[resourceKey] = (spawnedResources[resourceKey] or 0) + 1
			end
		end
		
		-- Send system message about spawned resources
		if #matchingTiles > 0 then
			local resourceList = {}
			for resource, count in pairs(spawnedResources) do
				table.insert(resourceList, count .. "x " .. resource)
			end
			local message = "🎲 Rolled " .. total .. "! Spawned: " .. table.concat(resourceList, ", ")
			SystemMessageEvent:FireAllClients(message)
		else
			SystemMessageEvent:FireAllClients("🎲 Rolled " .. total .. " - No matching tiles")
		end
		
		PulseEvent:FireAllClients("RollComplete", die1, die2, total, #matchingTiles)
	end
	
	isRolling = false
	pulseTimer = PULSE_INTERVAL
end

-- Spawn a physical resource on a tile
function PulseManager.SpawnResource(tile, resourceKey, resourceData)
	local tilePos = tile.PrimaryPart.Position
	
	-- Random position on the tile
	local angle = math.random() * math.pi * 2
	local dist = math.random(5, 20)
	local spawnPos = tilePos + Vector3.new(math.cos(angle) * dist, 10, math.sin(angle) * dist)
	
	-- Create physical resource
	local resource = Instance.new("Part")
	resource.Name = "Resource_" .. resourceKey
	resource.Size = Vector3.new(3, 3, 3)
	resource.Position = spawnPos
	resource.Color = resourceData.Color
	resource.Material = resourceData.Material
	resource.Anchored = false -- Will fall and can be picked up
	resource.CanCollide = true
	
	-- Add attributes for collection
	resource:SetAttribute("ResourceType", resourceKey)
	resource:SetAttribute("Amount", 1)
	resource:SetAttribute("TileQ", tile.PrimaryPart:GetAttribute("Q"))
	resource:SetAttribute("TileR", tile.PrimaryPart:GetAttribute("R"))
	resource:SetAttribute("SpawnTime", os.time())
	
	-- Add glow effect
	local light = Instance.new("PointLight")
	light.Color = resourceData.Color
	light.Brightness = 2
	light.Range = 8
	light.Parent = resource
	
	-- Add to resources folder
	local resourcesFolder = workspace:FindFirstChild("Resources") or Instance.new("Folder", workspace)
	resourcesFolder.Name = "Resources"
	resource.Parent = resourcesFolder
	
	-- Resources NO LONGER auto-destroy - they persist until collected
	-- Tile ownership will be checked by CollectionManager
	
	Logger.Debug("PulseManager", "Spawned " .. resourceKey .. " at tile")
end

-- Check if all players have placed their first settlement
local function allPlayersReady()
	if not GameManagerRef then return false end
	
	local players = Players:GetPlayers()
	if #players == 0 then return false end
	
	for _, player in ipairs(players) do
		local playerData = GameManagerRef.PlayerData[player.UserId]
		if not playerData then return false end
		if not playerData.BuildingManager then return false end
		if not playerData.BuildingManager.HasPlacedFirstSettlement then
			return false
		end
	end
	
	return true
end

-- Update loop (called from GameManager)
function PulseManager.Update(deltaTime)
	if isRolling then return end
	
	-- Check if game has started (all players placed settlements)
	if not gameStarted then
		if allPlayersReady() then
			gameStarted = true
			pulseTimer = PULSE_INTERVAL
			Logger.Info("PulseManager", "All players ready! Starting pulse timer...")
			TimerEvent:FireAllClients(math.floor(pulseTimer))
		else
			-- Show "waiting for players" status
			TimerEvent:FireAllClients(-1) -- -1 means waiting
			return
		end
	end
	
	pulseTimer = pulseTimer - deltaTime
	
	-- Broadcast timer to clients every second
	if math.floor(pulseTimer) ~= math.floor(pulseTimer + deltaTime) then
		TimerEvent:FireAllClients(math.floor(pulseTimer))
	end
	
	if pulseTimer <= 0 then
		PulseManager.ExecutePulse()
	end
end

-- Set reference to GameManager (called from GameManager)
function PulseManager.SetGameManager(gm)
	GameManagerRef = gm
end

-- Initialize
function PulseManager.Initialize()
	Logger.Info("PulseManager", "Initialized - Waiting for players to place settlements...")
	
	-- Assign numbers after a short delay to ensure map is generated
	task.delay(1, function()
		PulseManager.AssignTileNumbers()
	end)
end

-- Get current timer value
function PulseManager.GetTimer()
	return pulseTimer
end

-- Force a pulse (for testing)
function PulseManager.ForcePulse()
	pulseTimer = 0
end

-- Dev panel event handler
local DevEvent = Events:FindFirstChild("DevEvent") or Instance.new("RemoteEvent", Events)
DevEvent.Name = "DevEvent"

DevEvent.OnServerEvent:Connect(function(player, action, data)
	if action == "ForcePulse" then
		Logger.Info("PulseManager", "Force pulse triggered by " .. player.Name)
		PulseManager.ForcePulse()
	end
end)

return PulseManager
