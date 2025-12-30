-- Client-side Inventory UI - Shows collected resources
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local InventoryUI = {}

-- Wait for events
local Events = ReplicatedStorage:WaitForChild("Events")
local CollectEvent = Events:WaitForChild("CollectEvent")

-- Resource display data
local RESOURCES = {
	{ Key = "Wood", Icon = "🪵", Color = Color3.fromRGB(139, 90, 43) },
	{ Key = "Brick", Icon = "🧱", Color = Color3.fromRGB(178, 102, 59) },
	{ Key = "Wheat", Icon = "🌾", Color = Color3.fromRGB(218, 165, 32) },
	{ Key = "Ore", Icon = "�ite", Color = Color3.fromRGB(105, 105, 105) },
	{ Key = "Wool", Icon = "🐑", Color = Color3.fromRGB(245, 245, 245) },
}

-- Create UI elements
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "InventoryUI"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Inventory bar (bottom center)
local inventoryFrame = Instance.new("Frame")
inventoryFrame.Name = "InventoryFrame"
inventoryFrame.Size = UDim2.new(0, 400, 0, 60)
inventoryFrame.Position = UDim2.new(0.5, -200, 1, -80)
inventoryFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
inventoryFrame.BackgroundTransparency = 0.3
inventoryFrame.BorderSizePixel = 0
inventoryFrame.Parent = screenGui

local inventoryCorner = Instance.new("UICorner")
inventoryCorner.CornerRadius = UDim.new(0, 12)
inventoryCorner.Parent = inventoryFrame

local inventoryLayout = Instance.new("UIListLayout")
inventoryLayout.FillDirection = Enum.FillDirection.Horizontal
inventoryLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
inventoryLayout.VerticalAlignment = Enum.VerticalAlignment.Center
inventoryLayout.Padding = UDim.new(0, 10)
inventoryLayout.Parent = inventoryFrame

-- Create resource slots
local resourceLabels = {}

for _, resourceData in ipairs(RESOURCES) do
	local slot = Instance.new("Frame")
	slot.Name = resourceData.Key .. "Slot"
	slot.Size = UDim2.new(0, 70, 0, 50)
	slot.BackgroundColor3 = resourceData.Color
	slot.BackgroundTransparency = 0.5
	slot.BorderSizePixel = 0
	slot.Parent = inventoryFrame
	
	local slotCorner = Instance.new("UICorner")
	slotCorner.CornerRadius = UDim.new(0, 8)
	slotCorner.Parent = slot
	
	local iconLabel = Instance.new("TextLabel")
	iconLabel.Name = "Icon"
	iconLabel.Size = UDim2.new(0.5, 0, 1, 0)
	iconLabel.Position = UDim2.new(0, 0, 0, 0)
	iconLabel.BackgroundTransparency = 1
	iconLabel.TextColor3 = Color3.new(1, 1, 1)
	iconLabel.TextScaled = true
	iconLabel.Font = Enum.Font.GothamBold
	iconLabel.Text = resourceData.Icon
	iconLabel.Parent = slot
	
	local countLabel = Instance.new("TextLabel")
	countLabel.Name = "Count"
	countLabel.Size = UDim2.new(0.5, 0, 1, 0)
	countLabel.Position = UDim2.new(0.5, 0, 0, 0)
	countLabel.BackgroundTransparency = 1
	countLabel.TextColor3 = Color3.new(1, 1, 1)
	countLabel.TextScaled = true
	countLabel.Font = Enum.Font.GothamBold
	countLabel.Text = "0"
	countLabel.Parent = slot
	
	resourceLabels[resourceData.Key] = countLabel
end

-- Collection notification (floating text)
local notificationLabel = Instance.new("TextLabel")
notificationLabel.Name = "Notification"
notificationLabel.Size = UDim2.new(0, 300, 0, 50)
notificationLabel.Position = UDim2.new(0.5, -150, 0.7, 0)
notificationLabel.BackgroundTransparency = 1
notificationLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
notificationLabel.TextScaled = true
notificationLabel.Font = Enum.Font.GothamBold
notificationLabel.Text = ""
notificationLabel.TextTransparency = 1
notificationLabel.Parent = screenGui

-- Update inventory display
local function updateInventory(inventory)
	for resourceKey, countLabel in pairs(resourceLabels) do
		local count = inventory[resourceKey] or 0
		countLabel.Text = tostring(count)
	end
end

-- Show collection notification
local function showCollectionNotification(resourceType, amount)
	local icons = {
		Wood = "🪵",
		Brick = "🧱",
		Wheat = "🌾",
		Ore = "⛏️",
		Wool = "🐑"
	}
	
	local icon = icons[resourceType] or "📦"
	notificationLabel.Text = "+" .. amount .. " " .. icon .. " " .. resourceType
	notificationLabel.TextTransparency = 0
	notificationLabel.Position = UDim2.new(0.5, -150, 0.7, 0)
	
	-- Animate upward and fade
	local tween = TweenService:Create(
		notificationLabel,
		TweenInfo.new(1.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
		{
			Position = UDim2.new(0.5, -150, 0.6, 0),
			TextTransparency = 1
		}
	)
	tween:Play()
end

-- Handle collection events
CollectEvent.OnClientEvent:Connect(function(eventType, data1, data2)
	if eventType == "InventoryUpdate" then
		updateInventory(data1)
	elseif eventType == "Collected" then
		showCollectionNotification(data1, data2)
	end
end)

-- Request initial inventory
task.delay(1, function()
	CollectEvent:FireServer("GetInventory")
end)

print("[InventoryUI] Initialized")

return InventoryUI
