-- Client-side UI Manager
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Network = require(ReplicatedStorage.Shared.Network)
local Players = game:GetService("Players")

local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Create main UI
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "GameUI"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Resource Display
local resourceFrame = Instance.new("Frame")
resourceFrame.Name = "ResourceDisplay"
resourceFrame.Size = UDim2.new(0, 300, 0, 150)
resourceFrame.Position = UDim2.new(0, 10, 0, 10)
resourceFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
resourceFrame.BackgroundTransparency = 0.3
resourceFrame.BorderSizePixel = 2
resourceFrame.BorderColor3 = Color3.fromRGB(200, 200, 200)
resourceFrame.Parent = screenGui

-- Title
local titleLabel = Instance.new("TextLabel")
titleLabel.Name = "Title"
titleLabel.Size = UDim2.new(1, 0, 0, 30)
titleLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
titleLabel.BorderSizePixel = 0
titleLabel.Text = "Resources"
titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
titleLabel.Font = Enum.Font.SourceSansBold
titleLabel.TextSize = 20
titleLabel.Parent = resourceFrame

-- Resource labels
local resources = {"Wood", "Brick", "Wheat", "Ore", "Wool"}
for i, resourceName in ipairs(resources) do
	local label = Instance.new("TextLabel")
	label.Name = resourceName .. "Label"
	label.Size = UDim2.new(1, -20, 0, 25)
	label.Position = UDim2.new(0, 10, 0, 30 + (i - 1) * 30)
	label.BackgroundTransparency = 1
	label.Text = resourceName .. ": 0"
	label.TextColor3 = Color3.fromRGB(255, 255, 255)
	label.Font = Enum.Font.SourceSans
	label.TextSize = 18
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.Parent = resourceFrame
end

-- Building Menu
local buildingFrame = Instance.new("Frame")
buildingFrame.Name = "BuildingMenu"
buildingFrame.Size = UDim2.new(0, 250, 0, 300)
buildingFrame.Position = UDim2.new(1, -260, 0, 10)
buildingFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
buildingFrame.BackgroundTransparency = 0.3
buildingFrame.BorderSizePixel = 2
buildingFrame.BorderColor3 = Color3.fromRGB(200, 200, 200)
buildingFrame.Parent = screenGui

local buildingTitle = Instance.new("TextLabel")
buildingTitle.Name = "Title"
buildingTitle.Size = UDim2.new(1, 0, 0, 30)
buildingTitle.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
buildingTitle.BorderSizePixel = 0
buildingTitle.Text = "Buildings"
buildingTitle.TextColor3 = Color3.fromRGB(255, 255, 255)
buildingTitle.Font = Enum.Font.SourceSansBold
buildingTitle.TextSize = 20
buildingTitle.Parent = buildingFrame

-- Help text
local helpFrame = Instance.new("Frame")
helpFrame.Name = "HelpDisplay"
helpFrame.Size = UDim2.new(0, 300, 0, 120)
helpFrame.Position = UDim2.new(0, 10, 1, -130) -- Lower left corner
helpFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
helpFrame.BackgroundTransparency = 0.3
helpFrame.BorderSizePixel = 2
helpFrame.BorderColor3 = Color3.fromRGB(200, 200, 200)
helpFrame.Parent = screenGui

local helpTitle = Instance.new("TextLabel")
helpTitle.Name = "Title"
helpTitle.Size = UDim2.new(1, 0, 0, 25)
helpTitle.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
helpTitle.BorderSizePixel = 0
helpTitle.Text = "Controls"
helpTitle.TextColor3 = Color3.fromRGB(255, 255, 255)
helpTitle.Font = Enum.Font.SourceSansBold
helpTitle.TextSize = 18
helpTitle.Parent = helpFrame

local helpText = Instance.new("TextLabel")
helpText.Name = "HelpText"
helpText.Size = UDim2.new(1, -20, 1, -35)
helpText.Position = UDim2.new(0, 10, 0, 30)
helpText.BackgroundTransparency = 1
helpText.Text = "WASD - Move\nMouse - Look Around\nB - Toggle Build Mode\nH - Hire Worker\nG - Hire Guard\nR - Open Research"
helpText.TextColor3 = Color3.fromRGB(255, 255, 255)
helpText.Font = Enum.Font.SourceSans
helpText.TextSize = 16
helpText.TextXAlignment = Enum.TextXAlignment.Left
helpText.TextYAlignment = Enum.TextYAlignment.Top
helpText.Parent = helpFrame

-- Function to update resource display (would be called from server via RemoteEvents)
local function updateResourceDisplay(resources)
	for resourceName, amount in pairs(resources) do
		local label = resourceFrame:FindFirstChild(resourceName .. "Label")
		if label then
			label.Text = resourceName .. ": " .. tostring(amount)
		end
	end
end

-- Listen for resource updates from server
Network:OnEvent("ResourceUpdate", updateResourceDisplay)

-- System message handler (for chat log)
local StarterGui = game:GetService("StarterGui")
local Events = ReplicatedStorage:WaitForChild("Events")
local SystemMessageEvent = Events:WaitForChild("SystemMessageEvent")

-- Wait for chat to be ready
local chatReady = false
task.spawn(function()
	local attempts = 0
	while not chatReady and attempts < 30 do
		local success = pcall(function()
			StarterGui:SetCore("ChatMakeSystemMessage", {
				Text = "",
				Color = Color3.new(1, 1, 1)
			})
		end)
		if success then
			chatReady = true
			Logger.Info("UIManager", "Chat system ready")
		else
			attempts = attempts + 1
			task.wait(0.5)
		end
	end
end)

-- Function to send system message to chat
local function sendSystemMessage(message)
	-- Try to send to Roblox chat
	local success = pcall(function()
		StarterGui:SetCore("ChatMakeSystemMessage", {
			Text = message,
			Color = Color3.fromRGB(255, 215, 0), -- Gold color
			Font = Enum.Font.GothamBold,
			TextSize = 16
		})
	end)
	
	-- Also log it
	Logger.Info("System", message)
	
	return success
end

SystemMessageEvent.OnClientEvent:Connect(function(message)
	sendSystemMessage(message)
end)

Logger.Info("UIManager", "Initialized")

return {
	SendSystemMessage = sendSystemMessage
}
