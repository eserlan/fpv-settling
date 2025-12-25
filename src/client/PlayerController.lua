-- Client-side Player Controller
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

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
		print("Build mode:", buildMode)
	end
	
	-- Place building with left mouse button
	if buildMode and input.UserInputType == Enum.UserInputType.MouseButton1 then
		if buildingPreview then
			-- Send placement request to server (would use RemoteEvents in full implementation)
			print("Placing building at:", buildingPreview.Position)
		end
	end
end)

-- Update building preview
RunService.RenderStepped:Connect(function()
	if buildMode and currentBuildingType then
		-- Create or update building preview
		-- This would show where the building will be placed
	end
end)

print("Player Controller initialized!")
