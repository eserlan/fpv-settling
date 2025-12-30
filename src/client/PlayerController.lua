-- Client-side Player Controller
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Network = require(ReplicatedStorage.Shared.Network)
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- Camera settings
camera.FieldOfView = 80

-- Zoom threshold - below this distance, lock mouse (FPV mode)
local ZOOM_THRESHOLD = 5 -- studs

-- Track current mode
local isFirstPerson = false

-- Function to update mouse lock based on camera distance
local function updateMouseMode()
	local character = player.Character
	if not character then return end
	
	local head = character:FindFirstChild("Head")
	if not head then return end
	
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

-- Update every frame
RunService.RenderStepped:Connect(function()
	updateMouseMode()
end)

-- Building placement system
local buildMode = false
local currentBuildingType = nil
local buildingPreview = nil

-- Toggle build mode with 'B' key
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end
	
	if input.KeyCode == Enum.KeyCode.B then
		buildMode = not buildMode
		Logger.Debug("PlayerController", "Build mode: " .. tostring(buildMode))
	end
	
	-- Place building with left mouse button
	if buildMode and input.UserInputType == Enum.UserInputType.MouseButton1 then
		if buildingPreview and currentBuildingType then
			Network:FireServer("PlaceBuilding", currentBuildingType, buildingPreview.Position)
			Logger.Debug("PlayerController", "Requested building placement at: " .. tostring(buildingPreview.Position))
		end
	end
	
	-- Hire Worker with 'H' key
	if input.KeyCode == Enum.KeyCode.H then
		local character = player.Character
		if character and character.PrimaryPart then
			Network:FireServer("HireNPC", "Worker", character.PrimaryPart.Position + character.PrimaryPart.CFrame.LookVector * 5)
			Logger.Debug("PlayerController", "Requested worker hire")
		end
	end
	
	-- Hire Guard with 'G' key
	if input.KeyCode == Enum.KeyCode.G then
		local character = player.Character
		if character and character.PrimaryPart then
			Network:FireServer("HireNPC", "Guard", character.PrimaryPart.Position + character.PrimaryPart.CFrame.LookVector * 5)
			Logger.Debug("PlayerController", "Requested guard hire")
		end
	end
	
	-- Open Research with 'R' key (placeholder for now, just starts first tech)
	if input.KeyCode == Enum.KeyCode.R then
		Network:FireServer("StartResearch", "ImprovedTools")
		Logger.Debug("PlayerController", "Requested research: ImprovedTools")
	end
end)

-- Update building preview
RunService.RenderStepped:Connect(function()
	if buildMode then
		-- Set default building type if none selected
		if not currentBuildingType then
			currentBuildingType = "House"
		end
		
		-- Create preview part if it doesn't exist
		if not buildingPreview then
			buildingPreview = Instance.new("Part")
			buildingPreview.Name = "BuildingPreview"
			buildingPreview.Anchored = true
			buildingPreview.CanCollide = false
			buildingPreview.Transparency = 0.5
			buildingPreview.BrickColor = BrickColor.new("Electric blue")
			buildingPreview.Size = Vector3.new(10, 8, 10)
			buildingPreview.Parent = workspace
		end
		
		-- Position preview 10 units in front of player
		local character = player.Character
		if character and character.PrimaryPart then
			local lookVector = character.PrimaryPart.CFrame.LookVector
			buildingPreview.Position = character.PrimaryPart.Position + lookVector * 15
		end
	else
		-- Remove preview if it exists
		if buildingPreview then
			buildingPreview:Destroy()
			buildingPreview = nil
		end
	end
end)

Logger.Info("PlayerController", "Initialized")
