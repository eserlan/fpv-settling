-- Dev Panel UI - Toggle features and debug tools
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))

local DevPanel = {}

-- Configuration
local TOGGLE_KEY = Enum.KeyCode.C -- Press Alt+C to toggle dev panel

-- State
local showDiceNumbers = false

-- Wait for events
local Events = ReplicatedStorage:WaitForChild("Events")
local DevEvent = Events:WaitForChild("DevEvent")

-- Create UI
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "DevPanel"
screenGui.ResetOnSpawn = false
screenGui.DisplayOrder = 100
screenGui.Parent = playerGui

-- Main panel frame
local panelFrame = Instance.new("Frame")
panelFrame.Name = "Panel"
panelFrame.Size = UDim2.new(0, 250, 0, 300)
panelFrame.Position = UDim2.new(1, -270, 0, 20)
panelFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
panelFrame.BackgroundTransparency = 0.1
panelFrame.BorderSizePixel = 0
panelFrame.Visible = false -- Hidden by default, Alt+C to toggle
panelFrame.Parent = screenGui

local panelCorner = Instance.new("UICorner")
panelCorner.CornerRadius = UDim.new(0, 12)
panelCorner.Parent = panelFrame

-- Title
local titleLabel = Instance.new("TextLabel")
titleLabel.Name = "Title"
titleLabel.Size = UDim2.new(1, 0, 0, 40)
titleLabel.Position = UDim2.new(0, 0, 0, 0)
titleLabel.BackgroundColor3 = Color3.fromRGB(60, 60, 80)
titleLabel.BackgroundTransparency = 0.5
titleLabel.TextColor3 = Color3.fromRGB(255, 200, 100)
titleLabel.TextScaled = true
titleLabel.Font = Enum.Font.GothamBold
titleLabel.Text = "🛠️ DEV PANEL"
titleLabel.Parent = panelFrame

local titleCorner = Instance.new("UICorner")
titleCorner.CornerRadius = UDim.new(0, 12)
titleCorner.Parent = titleLabel

-- Content area
local contentFrame = Instance.new("Frame")
contentFrame.Name = "Content"
contentFrame.Size = UDim2.new(1, -20, 1, -60)
contentFrame.Position = UDim2.new(0, 10, 0, 50)
contentFrame.BackgroundTransparency = 1
contentFrame.Parent = panelFrame

local contentLayout = Instance.new("UIListLayout")
contentLayout.FillDirection = Enum.FillDirection.Vertical
contentLayout.Padding = UDim.new(0, 8)
contentLayout.Parent = contentFrame

-- Helper to create a toggle button
local function createToggleButton(name, labelText, defaultState, callback)
	local button = Instance.new("TextButton")
	button.Name = name
	button.Size = UDim2.new(1, 0, 0, 35)
	button.BackgroundColor3 = defaultState and Color3.fromRGB(50, 150, 50) or Color3.fromRGB(80, 80, 80)
	button.TextColor3 = Color3.new(1, 1, 1)
	button.TextScaled = true
	button.Font = Enum.Font.GothamBold
	button.Text = labelText .. (defaultState and " ✓" or " ✗")
	button.Parent = contentFrame
	
	local buttonCorner = Instance.new("UICorner")
	buttonCorner.CornerRadius = UDim.new(0, 8)
	buttonCorner.Parent = button
	
	local isOn = defaultState
	
	button.MouseButton1Click:Connect(function()
		isOn = not isOn
		button.BackgroundColor3 = isOn and Color3.fromRGB(50, 150, 50) or Color3.fromRGB(80, 80, 80)
		button.Text = labelText .. (isOn and " ✓" or " ✗")
		callback(isOn)
	end)
	
	return button, function() return isOn end
end

-- Helper to create an action button
local function createActionButton(name, labelText, callback)
	local button = Instance.new("TextButton")
	button.Name = name
	button.Size = UDim2.new(1, 0, 0, 35)
	button.BackgroundColor3 = Color3.fromRGB(100, 80, 150)
	button.TextColor3 = Color3.new(1, 1, 1)
	button.TextScaled = true
	button.Font = Enum.Font.GothamBold
	button.Text = labelText
	button.Parent = contentFrame
	
	local buttonCorner = Instance.new("UICorner")
	buttonCorner.CornerRadius = UDim.new(0, 8)
	buttonCorner.Parent = button
	
	button.MouseButton1Click:Connect(callback)
	
	return button
end

-- Section label helper
local function createSectionLabel(text)
	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(1, 0, 0, 20)
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.fromRGB(150, 150, 150)
	label.TextScaled = true
	label.Font = Enum.Font.Gotham
	label.Text = text
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.Parent = contentFrame
	return label
end

-- ========== ACTION: Force Pulse ==========
createSectionLabel("Pulse Controls")

createActionButton("ForcePulse", "⚡ Force Dice Roll", function()
	DevEvent:FireServer("ForcePulse")
end)





-- Toggle panel visibility
local function togglePanel()
	panelFrame.Visible = not panelFrame.Visible
end

-- Key input (Alt+C)
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end
	
	-- Check for Alt+C combination
	if input.KeyCode == TOGGLE_KEY and UserInputService:IsKeyDown(Enum.KeyCode.LeftAlt) then
		togglePanel()
	end
end)

Logger.Info("DevPanel", "Initialized - Press Alt+C to open")

return DevPanel
