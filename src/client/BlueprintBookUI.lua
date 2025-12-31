-- Blueprint Book UI
-- Opens with B key, shows available buildings and their costs

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")

local Blueprints = require(ReplicatedStorage.Shared.Blueprints)
local Logger = require(ReplicatedStorage.Shared.Logger)

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local BlueprintBookUI = {}

-- State
local isOpen = false
local selectedBlueprint = nil
local onBlueprintSelected = nil -- Callback when blueprint is selected

-- Create the UI
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "BlueprintBookUI"
screenGui.ResetOnSpawn = false
screenGui.Enabled = false
screenGui.Parent = playerGui

-- Main frame
local mainFrame = Instance.new("Frame")
mainFrame.Name = "MainFrame"
mainFrame.Size = UDim2.new(0, 500, 0, 400) -- Taller to fit cards
mainFrame.Position = UDim2.new(0.5, -250, 0.5, -200)
mainFrame.BackgroundColor3 = Color3.fromRGB(35, 35, 45)
mainFrame.BorderSizePixel = 0
mainFrame.Parent = screenGui

-- Rounded corners
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 16)
corner.Parent = mainFrame

-- Title bar
local titleBar = Instance.new("Frame")
titleBar.Name = "TitleBar"
titleBar.Size = UDim2.new(1, 0, 0, 50)
titleBar.BackgroundColor3 = Color3.fromRGB(50, 50, 65)
titleBar.BorderSizePixel = 0
titleBar.Parent = mainFrame

local titleCorner = Instance.new("UICorner")
titleCorner.CornerRadius = UDim.new(0, 16)
titleCorner.Parent = titleBar

-- Fix bottom corners of title bar
local titleFix = Instance.new("Frame")
titleFix.Size = UDim2.new(1, 0, 0, 16)
titleFix.Position = UDim2.new(0, 0, 1, -16)
titleFix.BackgroundColor3 = Color3.fromRGB(50, 50, 65)
titleFix.BorderSizePixel = 0
titleFix.Parent = titleBar

local titleLabel = Instance.new("TextLabel")
titleLabel.Name = "Title"
titleLabel.Size = UDim2.new(1, 0, 1, 0)
titleLabel.BackgroundTransparency = 1
titleLabel.Text = "📖 BLUEPRINT BOOK"
titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
titleLabel.Font = Enum.Font.GothamBold
titleLabel.TextSize = 24
titleLabel.Parent = titleBar

-- Close button
local closeButton = Instance.new("TextButton")
closeButton.Name = "CloseButton"
closeButton.Size = UDim2.new(0, 40, 0, 40)
closeButton.Position = UDim2.new(1, -45, 0, 5)
closeButton.BackgroundColor3 = Color3.fromRGB(200, 80, 80)
closeButton.Text = "✕"
closeButton.TextColor3 = Color3.new(1, 1, 1)
closeButton.Font = Enum.Font.GothamBold
closeButton.TextSize = 20
closeButton.Parent = titleBar

local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(0, 8)
closeCorner.Parent = closeButton

closeButton.MouseButton1Click:Connect(function()
	BlueprintBookUI.Close()
end)

-- Blueprint container
local container = Instance.new("Frame")
container.Name = "Container"
container.Size = UDim2.new(1, -40, 1, -80)
container.Position = UDim2.new(0, 20, 0, 60)
container.BackgroundTransparency = 1
container.Parent = mainFrame

local containerLayout = Instance.new("UIListLayout")
containerLayout.FillDirection = Enum.FillDirection.Horizontal
containerLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
containerLayout.Padding = UDim.new(0, 20)
containerLayout.Parent = container

-- Create a blueprint card
local function createBlueprintCard(blueprintName, blueprintData)
	local card = Instance.new("Frame")
	card.Name = blueprintName .. "Card"
	card.Size = UDim2.new(0, 130, 0, 240) -- Taller card
	card.BackgroundColor3 = Color3.fromRGB(55, 55, 70)
	card.BorderSizePixel = 0
	
	local cardCorner = Instance.new("UICorner")
	cardCorner.CornerRadius = UDim.new(0, 12)
	cardCorner.Parent = card
	
	-- Icon
	local icon = Instance.new("TextLabel")
	icon.Name = "Icon"
	icon.Size = UDim2.new(1, 0, 0, 60)
	icon.Position = UDim2.new(0, 0, 0, 10)
	icon.BackgroundTransparency = 1
	icon.Text = blueprintData.Icon
	icon.TextSize = 48
	icon.Parent = card
	
	-- Name
	local name = Instance.new("TextLabel")
	name.Name = "Name"
	name.Size = UDim2.new(1, -10, 0, 25)
	name.Position = UDim2.new(0, 5, 0, 70)
	name.BackgroundTransparency = 1
	name.Text = blueprintData.Name
	name.TextColor3 = Color3.fromRGB(255, 255, 255)
	name.Font = Enum.Font.GothamBold
	name.TextSize = 16
	name.Parent = card
	
	-- Cost display - taller to fit 4 resources
	local costFrame = Instance.new("Frame")
	costFrame.Name = "CostFrame"
	costFrame.Size = UDim2.new(1, -10, 0, 95) -- Taller
	costFrame.Position = UDim2.new(0, 5, 0, 100)
	costFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 50)
	costFrame.BorderSizePixel = 0
	costFrame.Parent = card
	
	local costCorner = Instance.new("UICorner")
	costCorner.CornerRadius = UDim.new(0, 6)
	costCorner.Parent = costFrame
	
	-- Cost items
	local y = 5
	for resource, amount in pairs(blueprintData.Cost) do
		local costLabel = Instance.new("TextLabel")
		costLabel.Size = UDim2.new(1, -10, 0, 18)
		costLabel.Position = UDim2.new(0, 5, 0, y)
		costLabel.BackgroundTransparency = 1
		costLabel.Text = (Blueprints.ResourceIcons[resource] or "") .. " " .. resource .. ": " .. amount
		costLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
		costLabel.Font = Enum.Font.Gotham
		costLabel.TextSize = 12
		costLabel.TextXAlignment = Enum.TextXAlignment.Left
		costLabel.Parent = costFrame
		y = y + 16
	end
	
	-- Select button
	local selectButton = Instance.new("TextButton")
	selectButton.Name = "SelectButton"
	selectButton.Size = UDim2.new(1, -10, 0, 30)
	selectButton.Position = UDim2.new(0, 5, 1, -35)
	selectButton.BackgroundColor3 = Color3.fromRGB(80, 160, 80)
	selectButton.Text = "SELECT"
	selectButton.TextColor3 = Color3.new(1, 1, 1)
	selectButton.Font = Enum.Font.GothamBold
	selectButton.TextSize = 14
	selectButton.Parent = card
	
	local selectCorner = Instance.new("UICorner")
	selectCorner.CornerRadius = UDim.new(0, 6)
	selectCorner.Parent = selectButton
	
	selectButton.MouseButton1Click:Connect(function()
		selectedBlueprint = blueprintName
		BlueprintBookUI.Close()
		
		if onBlueprintSelected then
			onBlueprintSelected(blueprintName, blueprintData)
		end
		
		Logger.Info("BlueprintBook", "Selected: " .. blueprintName)
	end)
	
	return card
end

-- Initialize blueprint cards
for name, data in pairs(Blueprints.Buildings) do
	local card = createBlueprintCard(name, data)
	card.Parent = container
end

-- Help text
local helpText = Instance.new("TextLabel")
helpText.Name = "HelpText"
helpText.Size = UDim2.new(1, 0, 0, 30)
helpText.Position = UDim2.new(0, 0, 1, -30)
helpText.BackgroundTransparency = 1
helpText.Text = "Click a blueprint to select, then click to place foundation • ESC or B to close"
helpText.TextColor3 = Color3.fromRGB(150, 150, 150)
helpText.Font = Enum.Font.Gotham
helpText.TextSize = 12
helpText.Parent = mainFrame

-- Public functions
function BlueprintBookUI.Open()
	if isOpen then return end
	isOpen = true
	screenGui.Enabled = true
	selectedBlueprint = nil
	Logger.Info("BlueprintBook", "Opened")
end

function BlueprintBookUI.Close()
	if not isOpen then return end
	isOpen = false
	screenGui.Enabled = false
	Logger.Info("BlueprintBook", "Closed")
end

function BlueprintBookUI.Toggle()
	if isOpen then
		BlueprintBookUI.Close()
	else
		BlueprintBookUI.Open()
	end
end

function BlueprintBookUI.IsOpen()
	return isOpen
end

function BlueprintBookUI.GetSelectedBlueprint()
	return selectedBlueprint
end

function BlueprintBookUI.OnBlueprintSelected(callback)
	onBlueprintSelected = callback
end

-- Handle keyboard input
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end
	
	if input.KeyCode == Enum.KeyCode.Escape and isOpen then
		BlueprintBookUI.Close()
	end
end)

Logger.Info("BlueprintBookUI", "Initialized")

return BlueprintBookUI
