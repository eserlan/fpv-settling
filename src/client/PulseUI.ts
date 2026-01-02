// Client-side Pulse UI - Hologram Dice and Timer Display
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

import { ClientEvents } from "./ClientEvents";
import * as Logger from "shared/Logger";

const PulseUI = {} as Record<string, unknown>;

// Create UI elements
const screenGui = new Instance("ScreenGui");
screenGui.Name = "PulseUI";
screenGui.ResetOnSpawn = false;
screenGui.Parent = playerGui;

// Timer display (top center)
const timerFrame = new Instance("Frame");
timerFrame.Name = "TimerFrame";
timerFrame.Size = new UDim2(0, 200, 0, 80);
timerFrame.Position = new UDim2(0.5, -100, 0, 20);
timerFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
timerFrame.BackgroundTransparency = 0.3;
timerFrame.BorderSizePixel = 0;
timerFrame.Parent = screenGui;

const timerCorner = new Instance("UICorner");
timerCorner.CornerRadius = new UDim(0, 16);
timerCorner.Parent = timerFrame;

const timerLabel = new Instance("TextLabel");
timerLabel.Name = "TimerLabel";
timerLabel.Size = new UDim2(1, 0, 0.5, 0);
timerLabel.Position = new UDim2(0, 0, 0, 0);
timerLabel.BackgroundTransparency = 1;
timerLabel.TextColor3 = new Color3(1, 1, 1);
timerLabel.TextScaled = true;
timerLabel.Font = Enum.Font.GothamBold;
timerLabel.Text = "NEXT PULSE";
timerLabel.Parent = timerFrame;

const countdownLabel = new Instance("TextLabel");
countdownLabel.Name = "CountdownLabel";
countdownLabel.Size = new UDim2(1, 0, 0.5, 0);
countdownLabel.Position = new UDim2(0, 0, 0.5, 0);
countdownLabel.BackgroundTransparency = 1;
countdownLabel.TextColor3 = Color3.fromRGB(255, 200, 100);
countdownLabel.TextScaled = true;
countdownLabel.Font = Enum.Font.GothamBold;
countdownLabel.Text = "60";
countdownLabel.Parent = timerFrame;

// Dice result display (center, appears during roll)
const diceFrame = new Instance("Frame");
diceFrame.Name = "DiceFrame";
diceFrame.Size = new UDim2(0, 300, 0, 200);
diceFrame.Position = new UDim2(0.5, -150, 0.3, 0);
diceFrame.BackgroundColor3 = Color3.fromRGB(50, 50, 80);
diceFrame.BackgroundTransparency = 0.2;
diceFrame.BorderSizePixel = 0;
diceFrame.Visible = false;
diceFrame.Parent = screenGui;

const diceCorner = new Instance("UICorner");
diceCorner.CornerRadius = new UDim(0, 20);
diceCorner.Parent = diceFrame;

const pulseTitle = new Instance("TextLabel");
pulseTitle.Name = "PulseTitle";
pulseTitle.Size = new UDim2(1, 0, 0.3, 0);
pulseTitle.Position = new UDim2(0, 0, 0, 0);
pulseTitle.BackgroundTransparency = 1;
pulseTitle.TextColor3 = Color3.fromRGB(255, 215, 0);
pulseTitle.TextScaled = true;
pulseTitle.Font = Enum.Font.GothamBold;
pulseTitle.Text = "⚡ THE PULSE ⚡";
pulseTitle.Parent = diceFrame;

const diceDisplay = new Instance("TextLabel");
diceDisplay.Name = "DiceDisplay";
diceDisplay.Size = new UDim2(1, 0, 0.5, 0);
diceDisplay.Position = new UDim2(0, 0, 0.25, 0);
diceDisplay.BackgroundTransparency = 1;
diceDisplay.TextColor3 = new Color3(1, 1, 1);
diceDisplay.TextScaled = true;
diceDisplay.Font = Enum.Font.GothamBold;
diceDisplay.Text = "🎲 ? + ? 🎲";
diceDisplay.Parent = diceFrame;

const resultLabel = new Instance("TextLabel");
resultLabel.Name = "ResultLabel";
resultLabel.Size = new UDim2(1, 0, 0.25, 0);
resultLabel.Position = new UDim2(0, 0, 0.75, 0);
resultLabel.BackgroundTransparency = 1;
resultLabel.TextColor3 = Color3.fromRGB(150, 255, 150);
resultLabel.TextScaled = true;
resultLabel.Font = Enum.Font.GothamBold;
resultLabel.Text = "";
resultLabel.Parent = diceFrame;

// Handle timer updates
ClientEvents.TimerEvent.connect((seconds) => {
	if (seconds === -1) {
		// Waiting for all players to place settlements
		countdownLabel.Text = "Place Settlement!";
		countdownLabel.TextColor3 = Color3.fromRGB(255, 255, 100);
		timerLabel.Text = "🏠 Build First";
	} else {
		timerLabel.Text = "⏱️ Next Pulse";
		countdownLabel.Text = tostring(seconds);

		// Flash when low
		if (seconds <= 5) {
			countdownLabel.TextColor3 = Color3.fromRGB(255, 100, 100);
		} else {
			countdownLabel.TextColor3 = Color3.fromRGB(255, 200, 100);
		}
	}
});

// Handle pulse events
ClientEvents.PulseEvent.connect((eventType, ...args) => {
	if (eventType === "RollStart") {
		const [die1, die2, total] = args as [number, number, number];
		// Show dice rolling animation
		diceFrame.Visible = true;
		diceDisplay.Text = "🎲 Rolling... 🎲";
		resultLabel.Text = "";

		// Animate the roll
		for (let i = 1; i <= 10; i += 1) {
			task.wait(0.2);
			const fake1 = math.random(1, 6);
			const fake2 = math.random(1, 6);
			diceDisplay.Text = `🎲 ${fake1} + ${fake2} 🎲`;
		}

		// Show final result
		diceDisplay.Text = `🎲 ${die1} + ${die2} = ${total} 🎲`;
	} else if (eventType === "RollComplete") {
		const [die1, die2, total, matchingCount] = args as [number, number, number, number];
		if (matchingCount > 0) {
			resultLabel.Text = `✅ ${matchingCount} tiles produce resources!`;
			resultLabel.TextColor3 = Color3.fromRGB(100, 255, 100);
		} else {
			resultLabel.Text = "❌ No matching tiles";
			resultLabel.TextColor3 = Color3.fromRGB(255, 150, 150);
		}

		// Hide after delay
		task.delay(4, () => {
			diceFrame.Visible = false;
		});
	} else if (eventType === "Robber") {
		diceDisplay.Text = "🎲 7 🎲";
		resultLabel.Text = "🏴‍☠️ ROBBER! No resources this round!";
		resultLabel.TextColor3 = Color3.fromRGB(255, 50, 50);

		task.delay(4, () => {
			diceFrame.Visible = false;
		});
	}
});

Logger.Info("PulseUI", "Initialized");

export = PulseUI;
