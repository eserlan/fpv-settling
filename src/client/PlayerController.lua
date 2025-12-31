-- Client-side Player Controller
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Network = require(ReplicatedStorage.Shared.Network)
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))
local Blueprints = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Blueprints"))

-- Wait for BlueprintBookUI to be available
local BlueprintBookUI = nil
task.spawn(function()
	BlueprintBookUI = require(script.Parent:WaitForChild("BlueprintBookUI"))
end)

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- Camera settings
camera.FieldOfView = 80

-- Zoom threshold - below this distance, lock mouse (FPV mode)
local ZOOM_THRESHOLD = 5 -- studs

-- Track current mode
local isFirstPerson = false

-- Building placement state
local placementMode = false
local selectedBlueprint = nil
local buildingPreview = nil
local currentVertex = nil
local isValidPlacement = false

-- Function to update mouse lock based on camera distance
local function updateMouseMode()
	local character = player.Character
	if not character then return end
	
	local head = character:FindFirstChild("Head")
	if not head then return end
	
	-- Don't lock mouse if blueprint book or placement mode is active
	if (BlueprintBookUI and BlueprintBookUI.IsOpen()) or placementMode then
		UserInputService.MouseBehavior = Enum.MouseBehavior.Default
		UserInputService.MouseIconEnabled = true
		return
	end
	
	-- Calculate distance from camera to character head
	local distance = (camera.CFrame.Position - head.Position).Magnitude
	
	-- Check if we should be in first-person mode
	local shouldBeFirstPerson = distance < ZOOM_THRESHOLD
	
	if shouldBeFirstPerson ~= isFirstPerson then
		isFirstPerson = shouldBeFirstPerson
		
		if isFirstPerson then
			-- First-person mode: lock mouse
			UserInputService.MouseBehavior = Enum.MouseBehavior.LockCenter
			UserInputService.MouseIconEnabled = false
			Logger.Debug("PlayerController", "Entered first-person mode")
		else
			-- Third-person mode: free mouse
			UserInputService.MouseBehavior = Enum.MouseBehavior.Default
			UserInputService.MouseIconEnabled = true
			Logger.Debug("PlayerController", "Entered third-person mode (mouse unlocked)")
		end
	end
end

-- Find vertex at mouse position
local function findVertexAtMouse()
	local mouse = player:GetMouse()
	if not mouse.Target then return nil end
	
	local mousePos = mouse.Hit.Position
	local vertexFolder = workspace:FindFirstChild("Vertices")
	if not vertexFolder then return nil end
	
	local closest = nil
	local closestDist = 20 -- Max snap distance
	
	for _, vertex in ipairs(vertexFolder:GetChildren()) do
		local dist = (vertex.Position - mousePos).Magnitude
		if dist < closestDist then
			closestDist = dist
			closest = vertex
		end
	end
	
	return closest
end

-- Check if vertex is valid for selected blueprint
local function isVertexValidForBlueprint(vertex, blueprintName)
	if not vertex or not blueprintName then return false end
	
	local blueprint = Blueprints.Buildings[blueprintName]
	if not blueprint then return false end
	
	local adjCount = vertex:GetAttribute("AdjacentTileCount") or 0
	
	if blueprint.PlacementType == "3-way" then
		return adjCount >= 3
	elseif blueprint.PlacementType == "2-way" then
		return adjCount == 2
	end
	
	return false
end

-- Create or update building preview
local function updatePlacementPreview()
	if not placementMode or not selectedBlueprint then
		if buildingPreview then
			buildingPreview:Destroy()
			buildingPreview = nil
		end
		return
	end
	
	local vertex = findVertexAtMouse()
	currentVertex = vertex
	
	if not vertex then
		if buildingPreview then
			buildingPreview.Transparency = 0.9
		end
		isValidPlacement = false
		return
	end
	
	local blueprint = Blueprints.Buildings[selectedBlueprint]
	isValidPlacement = isVertexValidForBlueprint(vertex, selectedBlueprint)
	
	-- Create preview if it doesn't exist
	if not buildingPreview then
		buildingPreview = Instance.new("Part")
		buildingPreview.Name = "BuildingPreview"
		buildingPreview.Anchored = true
		buildingPreview.CanCollide = false
		buildingPreview.Transparency = 0.3 -- More visible
		-- Flat indicator on ground
		buildingPreview.Size = Vector3.new(8, 0.5, 8)
		buildingPreview.Material = Enum.Material.Neon
		buildingPreview.Parent = workspace
	end
	
	-- Position flat on vertex (slightly above ground)
	buildingPreview.Position = vertex.Position + Vector3.new(0, 0.5, 0)
	
	-- Color based on validity
	if isValidPlacement then
		buildingPreview.Color = Color3.fromRGB(100, 255, 100) -- Green = valid
	else
		buildingPreview.Color = Color3.fromRGB(255, 100, 100) -- Red = invalid
	end
end

-- Exit placement mode
local function exitPlacementMode()
	placementMode = false
	selectedBlueprint = nil
	if buildingPreview then
		buildingPreview:Destroy()
		buildingPreview = nil
	end
	Logger.Debug("PlayerController", "Exited placement mode")
end

-- Handle blueprint selection callback
task.spawn(function()
	task.wait(1) -- Wait for BlueprintBookUI to initialize
	if BlueprintBookUI then
		BlueprintBookUI.OnBlueprintSelected(function(blueprintName, blueprintData)
			selectedBlueprint = blueprintName
			placementMode = true
			Logger.Info("PlayerController", "Entering placement mode for: " .. blueprintName)
		end)
	end
end)

-- Update every frame
RunService.RenderStepped:Connect(function()
	updateMouseMode()
	updatePlacementPreview()
end)

-- Handle input
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end
	
	-- Toggle Blueprint Book with 'B' key
	if input.KeyCode == Enum.KeyCode.B then
		if placementMode then
			exitPlacementMode()
		elseif BlueprintBookUI then
			BlueprintBookUI.Toggle()
		end
	end
	
	-- Cancel placement with Escape
	if input.KeyCode == Enum.KeyCode.Escape and placementMode then
		exitPlacementMode()
	end
	
	-- Place foundation with left mouse button
	if placementMode and input.UserInputType == Enum.UserInputType.MouseButton1 then
		if currentVertex and isValidPlacement and selectedBlueprint then
			Network:FireServer("PlaceFoundation", selectedBlueprint, currentVertex.Position)
			Logger.Info("PlayerController", "Placed foundation for " .. selectedBlueprint .. " at vertex " .. currentVertex.Name)
			exitPlacementMode()
		else
			Logger.Warn("PlayerController", "Invalid placement location")
		end
	end
	
	-- Hire Worker with 'H' key
	if input.KeyCode == Enum.KeyCode.H then
		local character = player.Character
		if character and character.PrimaryPart then
			Network:FireServer("HireNPC", "Worker", character.PrimaryPart.Position)
			Logger.Debug("PlayerController", "Requested Worker hire")
		end
	end
	
	-- Hire Guard with 'G' key
	if input.KeyCode == Enum.KeyCode.G then
		local character = player.Character
		if character and character.PrimaryPart then
			Network:FireServer("HireNPC", "Guard", character.PrimaryPart.Position)
			Logger.Debug("PlayerController", "Requested Guard hire")
		end
	end
	
	-- Open Research with 'R' key
	if input.KeyCode == Enum.KeyCode.R then
		Network:FireServer("StartResearch", "ImprovedTools")
		Logger.Debug("PlayerController", "Requested research: ImprovedTools")
	end
end)

Logger.Info("PlayerController", "Initialized")

return {}
