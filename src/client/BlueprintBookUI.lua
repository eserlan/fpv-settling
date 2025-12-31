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
local currentResources = {
	Wood = 0,
	Brick = 0,
	Wheat = 0,
	Wool = 0,
	Ore = 0
}

local cards = {} -- Store card refs for updating

-- Create the UI
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "BlueprintBookUI"
screenGui.ResetOnSpawn = false
screenGui.Enabled = false
screenGui.Parent = playerGui

-- Main frame
local mainFrame = Instance.new("Frame")
mainFrame.Name = "MainFrame"
mainFrame.Size = UDim2.new(0, 520, 0, 420)
mainFrame.Position = UDim2.new(0.5, -260, 0.5, -210)
mainFrame.BackgroundColor3 = Color3.fromRGB(35, 35, 45)
mainFrame.BorderSizePixel = 0
mainFrame.Parent = screenGui

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
container.Size = UDim2.new(1, -40, 1, -110)
container.Position = UDim2.new(0, 20, 0, 60)
container.BackgroundTransparency = 1
container.Parent = mainFrame

local containerLayout = Instance.new("UIListLayout")
containerLayout.FillDirection = Enum.FillDirection.Horizontal
containerLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
containerLayout.Padding = UDim.new(0, 20)
containerLayout.Parent = container

-- Refresh affordability
local function refreshAffordability()
	for name, cardData in pairs(cards) do
		local blueprint = Blueprints.Buildings[name]
		local canAfford = Blueprints.CanAfford(currentResources, name)
		
		local selectBtn = cardData.SelectButton
		if canAfford then
			selectBtn.BackgroundColor3 = Color3.fromRGB(80, 160, 80)
			selectBtn.AutoButtonColor = true
			selectBtn.Text = "SELECT"
			selectBtn.TextTransparency = 0
		else
			selectBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 70)
			selectBtn.AutoButtonColor = false
			selectBtn.Text = "INSUFFICIENT FUNDS"
			selectBtn.TextTransparency = 0.5
		end
		
		for resource, label in pairs(cardData.CostLabels) do
			local required = blueprint.Cost[resource] or 0
			local has = currentResources[resource] or 0
			if has >= required then
				label.TextColor3 = Color3.fromRGB(200, 200, 200)
			else
				label.TextColor3 = Color3.fromRGB(255, 100, 100)
			end
		end
	end
end

-- Create a blueprint card
local function createBlueprintCard(blueprintName, blueprintData)
	local card = Instance.new("Frame")
	card.Name = blueprintName .. "Card"
	card.Size = UDim2.new(0, 140, 0, 260)
	card.BackgroundColor3 = Color3.fromRGB(55, 55, 70)
	card.BorderSizePixel = 0
	
	local cardCorner = Instance.new("UICorner")
	cardCorner.CornerRadius = UDim.new(0, 12)
	cardCorner.Parent = card
	
	local icon = Instance.new("TextLabel")
	icon.Name = "Icon"
	icon.Size = UDim2.new(1, 0, 0, 60)
	icon.Position = UDim2.new(0, 0, 0, 10)
	icon.BackgroundTransparency = 1
	icon.Text = blueprintData.Icon
	icon.TextSize = 48
	icon.Parent = card
	
	local nameLabel = Instance.new("TextLabel")
	nameLabel.Name = "Name"
	nameLabel.Size = UDim2.new(1, -10, 0, 25)
	nameLabel.Position = UDim2.new(0, 5, 0, 70)
	nameLabel.BackgroundTransparency = 1
	nameLabel.Text = blueprintData.Name
	nameLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.TextSize = 16
	nameLabel.Parent = card
	
	local costFrame = Instance.new("Frame")
	costFrame.Name = "CostFrame"
	costFrame.Size = UDim2.new(1, -10, 0, 110)
	costFrame.Position = UDim2.new(0, 5, 0, 100)
	costFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 50)
	costFrame.BorderSizePixel = 0
	costFrame.Parent = card
	
	local costCorner = Instance.new("UICorner")
	costCorner.CornerRadius = UDim.new(0, 6)
	costCorner.Parent = costFrame
	
	local costLabels = {}
	local y = 8
	for resource, amount in pairs(blueprintData.Cost) do
		local costLabel = Instance.new("TextLabel")
		costLabel.Size = UDim2.new(1, -10, 0, 18)
		costLabel.Position = UDim2.new(0, 10, 0, y)
		costLabel.BackgroundTransparency = 1
		costLabel.Text = (Blueprints.ResourceIcons[resource] or "") .. " " .. resource .. ": " .. amount
		costLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
		costLabel.Font = Enum.Font.Gotham
		costLabel.TextSize = 12
		costLabel.TextXAlignment = Enum.TextXAlignment.Left
		costLabel.Parent = costFrame
		costLabels[resource] = costLabel
		y = y + 18
	end
	
	local selectButton = Instance.new("TextButton")
	selectButton.Name = "SelectButton"
	selectButton.Size = UDim2.new(1, -10, 0, 35)
	selectButton.Position = UDim2.new(0, 5, 1, -40)
	selectButton.BackgroundColor3 = Color3.fromRGB(80, 160, 80)
	selectButton.Text = "SELECT"
	selectButton.TextColor3 = Color3.new(1, 1, 1)
	selectButton.Font = Enum.Font.GothamBold
	selectButton.TextSize = 9
	selectButton.Parent = card
	
	local btnCorner = Instance.new("UICorner")
	btnCorner.CornerRadius = UDim.new(0, 6)
	btnCorner.Parent = selectButton
	
	selectButton.MouseButton1Click:Connect(function()
		if Blueprints.CanAfford(currentResources, blueprintName) then
			selectedBlueprint = blueprintName
			BlueprintBookUI.Close()
			if onBlueprintSelected then
				onBlueprintSelected(blueprintName, blueprintData)
			end
		end
	end)
	
	cards[blueprintName] = {
		SelectButton = selectButton,
		CostLabels = costLabels
	}
	
	return card
end

-- Initialize
local sortedNames = Blueprints.GetBlueprintNames()
for _, name in ipairs(sortedNames) do
	local data = Blueprints.Buildings[name]
	local card = createBlueprintCard(name, data)
	card.Parent = container
end

-- Listen for inventory updates
local Events = ReplicatedStorage:WaitForChild("Events")
local CollectEvent = Events:WaitForChild("InventoryUpdate")

CollectEvent.OnClientEvent:Connect(function(action, data)
	if action == "InventoryUpdate" then
		currentResources = data
		refreshAffordability()
	end
end)

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

-- Public Functions
function BlueprintBookUI.Open()
	isOpen = true
	screenGui.Enabled = true
	refreshAffordability()
end

function BlueprintBookUI.Close()
	isOpen = false
	screenGui.Enabled = false
end

function BlueprintBookUI.Toggle()
	if isOpen then BlueprintBookUI.Close() else BlueprintBookUI.Open() end
end

function BlueprintBookUI.IsOpen() return isOpen end
function BlueprintBookUI.OnBlueprintSelected(cb) onBlueprintSelected = cb end

UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.KeyCode == Enum.KeyCode.Escape and isOpen then
		BlueprintBookUI.Close()
	end
end)

return BlueprintBookUI
