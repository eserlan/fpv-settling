-- Client-side Player Controller
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Network = require(ReplicatedStorage.Shared.Network)
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- First-person camera settings
camera.FieldOfView = 80
camera.CameraType = Enum.CameraType.Custom

-- Mouse sensitivity
local mouseSensitivity = 0.003

-- Camera angles
local cameraAngleX = 0
local cameraAngleY = 0

-- Lock and hide mouse for first-person view
-- Note: This is a dedicated FPV game, so mouse is always locked
-- Future: Add pause menu to unlock mouse temporarily
UserInputService.MouseBehavior = Enum.MouseBehavior.LockCenter
UserInputService.MouseIconEnabled = false

-- Handle mouse movement for first-person camera
UserInputService.InputChanged:Connect(function(input, gameProcessed)
	if gameProcessed then return end
	
	if input.UserInputType == Enum.UserInputType.MouseMovement then
		local delta = input.Delta
		
		cameraAngleX = cameraAngleX - delta.X * mouseSensitivity
		cameraAngleY = math.clamp(cameraAngleY - delta.Y * mouseSensitivity, -math.pi/2 + 0.1, math.pi/2 - 0.1)
	end
end)

-- Update camera every frame
RunService.RenderStepped:Connect(function()
	local character = player.Character
	if not character then return end
	
	local humanoidRootPart = character:FindFirstChild("HumanoidRootPart")
	local head = character:FindFirstChild("Head")
	
	if humanoidRootPart and head then
		-- Position camera at head position
		local headPosition = head.Position
		
		-- Calculate camera orientation based on mouse movement
		local rotation = CFrame.Angles(0, cameraAngleX, 0) * CFrame.Angles(cameraAngleY, 0, 0)
		
		-- Set camera CFrame
		camera.CFrame = CFrame.new(headPosition) * rotation
		
		-- Update character orientation to face camera direction
		local lookVector = Vector3.new(camera.CFrame.LookVector.X, 0, camera.CFrame.LookVector.Z).Unit
		humanoidRootPart.CFrame = CFrame.new(humanoidRootPart.Position, humanoidRootPart.Position + lookVector)
	end
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
		Network:FireServer("HireNPC", "Worker", player.Character.PrimaryPart.Position + player.Character.PrimaryPart.CFrame.LookVector * 5)
		Logger.Debug("PlayerController", "Requested worker hire")
	end
	
	-- Hire Guard with 'G' key
	if input.KeyCode == Enum.KeyCode.G then
		Network:FireServer("HireNPC", "Guard", player.Character.PrimaryPart.Position + player.Character.PrimaryPart.CFrame.LookVector * 5)
		Logger.Debug("PlayerController", "Requested guard hire")
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
