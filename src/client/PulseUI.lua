-- Client-side Pulse UI - Hologram Dice and Timer Display
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))

local PulseUI = {}

-- Wait for events
local Events = ReplicatedStorage:WaitForChild("Events")
local PulseEvent = Events:WaitForChild("PulseEvent")
local TimerEvent = Events:WaitForChild("TimerEvent")

-- Create UI elements
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "PulseUI"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Timer display (top center)
local timerFrame = Instance.new("Frame")
timerFrame.Name = "TimerFrame"
timerFrame.Size = UDim2.new(0, 200, 0, 80)
timerFrame.Position = UDim2.new(0.5, -100, 0, 20)
timerFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
timerFrame.BackgroundTransparency = 0.3
timerFrame.BorderSizePixel = 0
timerFrame.Parent = screenGui

local timerCorner = Instance.new("UICorner")
timerCorner.CornerRadius = UDim.new(0, 16)
timerCorner.Parent = timerFrame

local timerLabel = Instance.new("TextLabel")
timerLabel.Name = "TimerLabel"
timerLabel.Size = UDim2.new(1, 0, 0.5, 0)
timerLabel.Position = UDim2.new(0, 0, 0, 0)
timerLabel.BackgroundTransparency = 1
timerLabel.TextColor3 = Color3.new(1, 1, 1)
timerLabel.TextScaled = true
timerLabel.Font = Enum.Font.GothamBold
timerLabel.Text = "NEXT PULSE"
timerLabel.Parent = timerFrame

local countdownLabel = Instance.new("TextLabel")
countdownLabel.Name = "CountdownLabel"
countdownLabel.Size = UDim2.new(1, 0, 0.5, 0)
countdownLabel.Position = UDim2.new(0, 0, 0.5, 0)
countdownLabel.BackgroundTransparency = 1
countdownLabel.TextColor3 = Color3.fromRGB(255, 200, 100)
countdownLabel.TextScaled = true
countdownLabel.Font = Enum.Font.GothamBold
countdownLabel.Text = "60"
countdownLabel.Parent = timerFrame

-- Dice result display (center, appears during roll)
local diceFrame = Instance.new("Frame")
diceFrame.Name = "DiceFrame"
diceFrame.Size = UDim2.new(0, 300, 0, 200)
diceFrame.Position = UDim2.new(0.5, -150, 0.3, 0)
diceFrame.BackgroundColor3 = Color3.fromRGB(50, 50, 80)
diceFrame.BackgroundTransparency = 0.2
diceFrame.BorderSizePixel = 0
diceFrame.Visible = false
diceFrame.Parent = screenGui

local diceCorner = Instance.new("UICorner")
diceCorner.CornerRadius = UDim.new(0, 20)
diceCorner.Parent = diceFrame

local pulseTitle = Instance.new("TextLabel")
pulseTitle.Name = "PulseTitle"
pulseTitle.Size = UDim2.new(1, 0, 0.3, 0)
pulseTitle.Position = UDim2.new(0, 0, 0, 0)
pulseTitle.BackgroundTransparency = 1
pulseTitle.TextColor3 = Color3.fromRGB(255, 215, 0)
pulseTitle.TextScaled = true
pulseTitle.Font = Enum.Font.GothamBold
pulseTitle.Text = "⚡ THE PULSE ⚡"
pulseTitle.Parent = diceFrame

local diceDisplay = Instance.new("TextLabel")
diceDisplay.Name = "DiceDisplay"
diceDisplay.Size = UDim2.new(1, 0, 0.5, 0)
diceDisplay.Position = UDim2.new(0, 0, 0.25, 0)
diceDisplay.BackgroundTransparency = 1
diceDisplay.TextColor3 = Color3.new(1, 1, 1)
diceDisplay.TextScaled = true
diceDisplay.Font = Enum.Font.GothamBold
diceDisplay.Text = "🎲 ? + ? 🎲"
diceDisplay.Parent = diceFrame

local resultLabel = Instance.new("TextLabel")
resultLabel.Name = "ResultLabel"
resultLabel.Size = UDim2.new(1, 0, 0.25, 0)
resultLabel.Position = UDim2.new(0, 0, 0.75, 0)
resultLabel.BackgroundTransparency = 1
resultLabel.TextColor3 = Color3.fromRGB(150, 255, 150)
resultLabel.TextScaled = true
resultLabel.Font = Enum.Font.GothamBold
resultLabel.Text = ""
resultLabel.Parent = diceFrame

-- Handle timer updates
TimerEvent.OnClientEvent:Connect(function(seconds)
	if seconds == -1 then
		-- Waiting for all players to place settlements
		countdownLabel.Text = "Place Settlement!"
		countdownLabel.TextColor3 = Color3.fromRGB(255, 255, 100)
		timerLabel.Text = "🏠 Build First"
	else
		timerLabel.Text = "⏱️ Next Pulse"
		countdownLabel.Text = tostring(seconds)
		
		-- Flash when low
		if seconds <= 5 then
			countdownLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
		else
			countdownLabel.TextColor3 = Color3.fromRGB(255, 200, 100)
		end
	end
end)

-- Handle pulse events
PulseEvent.OnClientEvent:Connect(function(eventType, die1, die2, total, matchingCount)
	if eventType == "RollStart" then
		-- Show dice rolling animation
		diceFrame.Visible = true
		diceDisplay.Text = "🎲 Rolling... 🎲"
		resultLabel.Text = ""
		
		-- Animate the roll
		for i = 1, 10 do
			task.wait(0.2)
			local fake1 = math.random(1, 6)
			local fake2 = math.random(1, 6)
			diceDisplay.Text = "🎲 " .. fake1 .. " + " .. fake2 .. " 🎲"
		end
		
		-- Show final result
		diceDisplay.Text = "🎲 " .. die1 .. " + " .. die2 .. " = " .. total .. " 🎲"
		
	elseif eventType == "RollComplete" then
		if matchingCount > 0 then
			resultLabel.Text = "✅ " .. matchingCount .. " tiles produce resources!"
			resultLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
		else
			resultLabel.Text = "❌ No matching tiles"
			resultLabel.TextColor3 = Color3.fromRGB(255, 150, 150)
		end
		
		-- Hide after delay
		task.delay(4, function()
			diceFrame.Visible = false
		end)
		
	elseif eventType == "Robber" then
		diceDisplay.Text = "🎲 7 🎲"
		resultLabel.Text = "🏴‍☠️ ROBBER! No resources this round!"
		resultLabel.TextColor3 = Color3.fromRGB(255, 50, 50)
		
		task.delay(4, function()
			diceFrame.Visible = false
		end)
	end
end)

Logger.Info("PulseUI", "Initialized")

return PulseUI
