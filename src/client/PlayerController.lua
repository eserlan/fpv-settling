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

-- Speed settings
local WALK_SPEED = 16
local RUN_SPEED = 32

-- Track current mode
local isFirstPerson = false
local isSprinting = false

-- Building placement state
local placementMode = false
local selectedBlueprint = nil
local buildingPreview = nil
local currentVertex = nil
local isValidPlacement = false

-- Update player speed based on sprint state
local function updateSpeed()
	local character = player.Character
	if not character then return end
	
	local humanoid = character:FindFirstChild("Humanoid")
	if humanoid then
		humanoid.WalkSpeed = isSprinting and RUN_SPEED or WALK_SPEED
	end
end

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

-- Find snapping point (vertex or edge) at mouse position
local function findSnapPointAtMouse()
	local mouse = player:GetMouse()
	if not mouse.Target then return nil end
	
	local mousePos = mouse.Hit.Position
	local blueprint = selectedBlueprint and Blueprints.Buildings[selectedBlueprint]
	if not blueprint then return nil end
	
	local folderName = "Vertices"
	if blueprint.PlacementType == "edge" then
		folderName = "Edges"
	end
	
	local folder = workspace:FindFirstChild(folderName)
	if not folder then return nil end
	
	local closest = nil
	local closestDist = 20 -- Max snap distance
	
	for _, marker in ipairs(folder:GetChildren()) do
		local dist = (marker.Position - mousePos).Magnitude
		if dist < closestDist then
			closestDist = dist
			closest = marker
		end
	end
	
	return closest
end

-- Check if snap point is valid for selected blueprint
local function isSnapPointValidForBlueprint(marker, blueprintName)
	if not marker or not blueprintName then return false end
	
	local blueprint = Blueprints.Buildings[blueprintName]
	if not blueprint then return false end
	
	-- Helper to find owner of a building at a position/key
	local function getOwnerAt(key, folderName)
		local folder = workspace:FindFirstChild(folderName)
		if not folder then return nil end
		for _, model in ipairs(folder:GetChildren()) do
			local base = model:FindFirstChild("FoundationBase") or model.PrimaryPart
			if base and base:GetAttribute("Key") == key then
				return base:GetAttribute("OwnerId")
			end
		end
		return nil
	end
	
	-- Helper to check if a vertex key is occupied by ANY building
	local function isVertexOccupied(key)
		local folders = {"Settlements", "Buildings"}
		for _, folderName in ipairs(folders) do
			local folder = workspace:FindFirstChild(folderName)
			if folder then
				for _, model in ipairs(folder:GetChildren()) do
					local base = model:FindFirstChild("FoundationBase") or model.PrimaryPart
					if base and base:GetAttribute("Key") == key then
						return true
					end
				end
			end
		end
		return false
	end
	
	-- Adjacency rules
	if blueprint.PlacementType == "3-way" then
		local myKey = marker:GetAttribute("Key")
		
		-- DISTANCE RULE: Is there a building here or at ANY neighbor?
		if isVertexOccupied(myKey) then return false end
		
		-- Check all neighbors for settlements
		for i = 1, 3 do -- Most hex vertices have up to 3 neighbors
			local neighborKey = marker:GetAttribute("Neighbor_" .. i)
			if neighborKey and isVertexOccupied(neighborKey) then
				return false -- Too close to another settlement!
			end
		end
		
		-- First settlement can be placed anywhere valid (no connection needed)
		local hasAnyBuildings = false
		for _, model in ipairs(workspace:GetChildren()) do
			if model:IsA("Model") then
				local base = model:FindFirstChild("FoundationBase") or model.PrimaryPart
				if base and base:GetAttribute("OwnerId") == player.UserId then
					hasAnyBuildings = true
					break
				end
			end
		end
		
		if not hasAnyBuildings then return true end -- First one is free (Distance rule still applies above)
		
		-- Subsequent settlements must be connected via road (standard Catan)
		-- Check if any owned road touches this vertex
		local f = workspace:FindFirstChild("Buildings")
		if f then
			for _, model in ipairs(f:GetChildren()) do
				local base = model:FindFirstChild("FoundationBase") or model.PrimaryPart
				if base and base:GetAttribute("OwnerId") == player.UserId then
					local key = base:GetAttribute("Key")
					-- Edge key is "V1:V2", check if myKey is part of it
					if key and string.find(key, myKey) then
						return true
					end
				end
			end
		end
		
		return false -- Not connected
	elseif blueprint.PlacementType == "edge" then
		-- Roads MUST connect to a settlement or road you own
		local v1 = marker:GetAttribute("Vertex1")
		local v2 = marker:GetAttribute("Vertex2")
		
		-- Check for owned settlement at either vertex
		local folders = {"Settlements", "Buildings"}
		for _, folder in ipairs(folders) do
			local f = workspace:FindFirstChild(folder)
			if f then
				for _, model in ipairs(f:GetChildren()) do
					local base = model:FindFirstChild("FoundationBase") or model.PrimaryPart
					if base and base:GetAttribute("OwnerId") == player.UserId then
						local pos = base.Position
						-- Vertices are spheres, check distance
						if (pos - marker.Position).Magnitude < 25 then
							return true
						end
					end
				end
			end
		end
		
		-- Check for owned road at either vertex
		-- A road at vertex V1 means its key has V1 in it
		local f = workspace:FindFirstChild("Buildings")
		if f then
			for _, model in ipairs(f:GetChildren()) do
				local base = model:FindFirstChild("FoundationBase") or model.PrimaryPart
				if base and base:GetAttribute("OwnerId") == player.UserId then
					local key = base:GetAttribute("Key")
					if key and (string.find(key, v1) or string.find(key, v2)) then
						return true
					end
				end
			end
		end
		
		return false
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
	
	local snapPoint = findSnapPointAtMouse()
	currentVertex = snapPoint
	
	if not snapPoint then
		if buildingPreview then
			buildingPreview.Transparency = 0.9
		end
		isValidPlacement = false
		return
	end
	
	local blueprint = Blueprints.Buildings[selectedBlueprint]
	isValidPlacement = isSnapPointValidForBlueprint(snapPoint, selectedBlueprint)
	
	-- Create preview if it doesn't exist
	if not buildingPreview then
		buildingPreview = Instance.new("Part")
		buildingPreview.Name = "BuildingPreview"
		buildingPreview.Anchored = true
		buildingPreview.CanCollide = false
		buildingPreview.Transparency = 0.3 -- More visible
		buildingPreview.Material = Enum.Material.Neon
		buildingPreview.Parent = workspace
	end
	
	-- Update preview size and rotation
	if blueprint.PlacementType == "edge" then
		buildingPreview.Size = Vector3.new(37, 0.5, 4)
		buildingPreview.CFrame = snapPoint.CFrame * CFrame.new(0, 0.25, 0)
	else
		buildingPreview.Size = Vector3.new(8, 0.5, 8)
		buildingPreview.CFrame = CFrame.new(snapPoint.Position + Vector3.new(0, 0.25, 0))
	end
	
	-- Color based on validity
	if isValidPlacement then
		buildingPreview.Color = Color3.fromRGB(100, 255, 100) -- Green = valid
	else
		buildingPreview.Color = Color3.fromRGB(255, 100, 100) -- Red = invalid
	end
	
	buildingPreview.Transparency = 0.3
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

-- Foundation interaction state
local nearbyFoundation = nil
local depositPromptGui = nil

-- Create deposit prompt UI
local function createDepositPrompt()
	local screenGui = Instance.new("ScreenGui")
	screenGui.Name = "DepositPrompt"
	screenGui.ResetOnSpawn = false
	screenGui.Parent = player:WaitForChild("PlayerGui")
	
	local frame = Instance.new("Frame")
	frame.Name = "PromptFrame"
	frame.Size = UDim2.new(0, 300, 0, 60)
	frame.Position = UDim2.new(0.5, -150, 0.6, 0)
	frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
	frame.BackgroundTransparency = 0.3
	frame.BorderSizePixel = 0
	frame.Visible = false
	frame.Parent = screenGui
	
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = frame
	
	local label = Instance.new("TextLabel")
	label.Name = "Text"
	label.Size = UDim2.new(1, 0, 1, 0)
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.new(1, 1, 1)
	label.Font = Enum.Font.GothamBold
	label.TextSize = 18
	label.Text = "Press E to deposit resource"
	label.Parent = frame
	
	return screenGui, frame
end

depositPromptGui = createDepositPrompt()
local promptFrame = depositPromptGui:FindFirstChild("PromptFrame")

-- Find nearby foundation
local function findNearbyFoundation()
	local character = player.Character
	if not character or not character.PrimaryPart then return nil end
	
	local playerPos = character.PrimaryPart.Position
	local closest = nil
	local closestDist = 15 -- Max interaction distance
	local foundCount = 0
	
	-- Search all of workspace to be more robust than just checking specific folders
	for _, object in ipairs(workspace:GetChildren()) do
		-- Also check inside folders if they exist
		local searchArea = {object}
		if object:IsA("Folder") and (object.Name == "Buildings" or object.Name == "Settlements") then
			searchArea = object:GetChildren()
		end
		
		for _, model in ipairs(searchArea) do
			if model:IsA("Model") then
				local basePart = model:FindFirstChild("FoundationBase")
				if basePart then
					local foundationId = basePart:GetAttribute("FoundationId")
					local ownerId = basePart:GetAttribute("OwnerId")
					
					if foundationId then
						foundCount = foundCount + 1
						local dist = (basePart.Position - playerPos).Magnitude
						
						-- Only interact with own foundations
						if ownerId == player.UserId then
							if dist < closestDist then
								closestDist = dist
								closest = {
									Id = foundationId,
									Model = model,
									Part = basePart
								}
							end
						end
					end
				end
			end
		end
	end
	
	-- Store for debug logging
	_G.FoundFoundations = foundCount
	return closest
end

-- Get first needed resource from foundation
local function getNeededResourceFromFoundation(foundation)
	if not foundation or not foundation.Part then return nil end
	
	local resourceDisplay = foundation.Part:FindFirstChild("ResourceDisplay")
	if not resourceDisplay then return nil end
	
	local resourceLabel = resourceDisplay:FindFirstChild("Resources")
	if not resourceLabel then return nil end
	
	-- Parse the text to find a resource that's not complete
	-- This is a simple approach - ideally server would send this info
	local resources = {"Wood", "Brick", "Wheat", "Wool", "Ore"}
	for _, res in ipairs(resources) do
		-- Check if player has this resource (client-side check)
		-- The server will verify anyway
		return res -- Return first resource type for now
	end
	return nil
end

-- Update every frame
RunService.RenderStepped:Connect(function()
	updateMouseMode()
	updatePlacementPreview()
	
	-- Check for nearby foundation (when not in placement mode)
	if not placementMode then
		local lastFoundation = nearbyFoundation
		nearbyFoundation = findNearbyFoundation()
		
		if nearbyFoundation and not lastFoundation then
			Logger.Info("PlayerController", "Now NEAR foundation: " .. tostring(nearbyFoundation.Id))
		end
		
		if nearbyFoundation and promptFrame then
			promptFrame.Visible = true
			local textLabel = promptFrame:FindFirstChild("Text")
			if textLabel then
				textLabel.Text = "Press E to deposit resources"
			end
		elseif promptFrame then
			promptFrame.Visible = false
		end
	elseif promptFrame then
		promptFrame.Visible = false
	end
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
			local rotation = currentVertex.Rotation
			local snapKey = currentVertex:GetAttribute("Key")
			Network:FireServer("PlaceFoundation", selectedBlueprint, currentVertex.Position, rotation, snapKey)
			Logger.Info("PlayerController", "Placed foundation for " .. selectedBlueprint)
			exitPlacementMode()
		else
			Logger.Warn("PlayerController", "Invalid placement location")
		end
	end
	
	-- Deposit resource into foundation with E key
	if input.KeyCode == Enum.KeyCode.E then
		if nearbyFoundation then
			Logger.Debug("PlayerController", "Pressing E near foundation: " .. tostring(nearbyFoundation.Id))
			-- Deposit wood first, then brick, wheat, wool, ore in order
			local resourcesToTry = {"Wood", "Brick", "Wheat", "Wool", "Ore"}
			for _, resourceType in ipairs(resourcesToTry) do
				Network:FireServer("DepositResource", nearbyFoundation.Id, resourceType)
			end
		else
			local totalFound = _G.FoundFoundations or 0
			if totalFound == 0 then
				Logger.Debug("PlayerController", "Pressing E, but NO foundations with 'FoundationBase' were found in workspace at all.")
			else
				Logger.Debug("PlayerController", "Pressing E, found " .. totalFound .. " foundations in workspace, but none close enough (15 studs) or owned by you.")
			end
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
	
	-- Sprint with Shift
	if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.RightShift then
		isSprinting = true
		updateSpeed()
	end
end)

-- Handle key release
UserInputService.InputEnded:Connect(function(input, gameProcessed)
	-- Stop sprinting when shift is released
	if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.RightShift then
		isSprinting = false
		updateSpeed()
	end
end)

Logger.Info("PlayerController", "Initialized")

return {}
