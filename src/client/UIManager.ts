// Client-side UI Manager
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");

import * as Logger from "shared/Logger";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

// Create main UI
const screenGui = new Instance("ScreenGui");
screenGui.Name = "GameUI";
screenGui.ResetOnSpawn = false;
screenGui.Parent = playerGui;

// Note: Resource display removed - using InventoryUI at bottom center instead

// Building Menu
const buildingFrame = new Instance("Frame");
buildingFrame.Name = "BuildingMenu";
buildingFrame.Size = new UDim2(0, 250, 0, 300);
buildingFrame.Position = new UDim2(1, -260, 0, 10);
buildingFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40);
buildingFrame.BackgroundTransparency = 0.3;
buildingFrame.BorderSizePixel = 2;
buildingFrame.BorderColor3 = Color3.fromRGB(200, 200, 200);
buildingFrame.Parent = screenGui;

const buildingTitle = new Instance("TextLabel");
buildingTitle.Name = "Title";
buildingTitle.Size = new UDim2(1, 0, 0, 30);
buildingTitle.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
buildingTitle.BorderSizePixel = 0;
buildingTitle.Text = "Buildings";
buildingTitle.TextColor3 = Color3.fromRGB(255, 255, 255);
buildingTitle.Font = Enum.Font.SourceSansBold;
buildingTitle.TextSize = 20;
buildingTitle.Parent = buildingFrame;

// Help text
const helpFrame = new Instance("Frame");
helpFrame.Name = "HelpDisplay";
helpFrame.Size = new UDim2(0, 300, 0, 140);
helpFrame.Position = new UDim2(0, 10, 1, -150); // Lower left corner
helpFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40);
helpFrame.BackgroundTransparency = 0.3;
helpFrame.BorderSizePixel = 2;
helpFrame.BorderColor3 = Color3.fromRGB(200, 200, 200);
helpFrame.Parent = screenGui;

const helpTitle = new Instance("TextLabel");
helpTitle.Name = "Title";
helpTitle.Size = new UDim2(1, 0, 0, 25);
helpTitle.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
helpTitle.BorderSizePixel = 0;
helpTitle.Text = "Controls";
helpTitle.TextColor3 = Color3.fromRGB(255, 255, 255);
helpTitle.Font = Enum.Font.SourceSansBold;
helpTitle.TextSize = 18;
helpTitle.Parent = helpFrame;

const helpText = new Instance("TextLabel");
helpText.Name = "HelpText";
helpText.Size = new UDim2(1, -20, 1, -35);
helpText.Position = new UDim2(0, 10, 0, 30);
helpText.BackgroundTransparency = 1;
helpText.Text = "WASD - Move\nShift - Sprint\nB - Blueprints\nE - Deposit Resources\nMouse - Look Around";
helpText.TextColor3 = Color3.fromRGB(255, 255, 255);
helpText.Font = Enum.Font.SourceSans;
helpText.TextSize = 16;
helpText.TextXAlignment = Enum.TextXAlignment.Left;
helpText.TextYAlignment = Enum.TextYAlignment.Top;
helpText.Parent = helpFrame;

// System message handler (for chat log)
const StarterGui = game.GetService("StarterGui");
const events = ReplicatedStorage.WaitForChild("Events");
const SystemMessageEvent = events.WaitForChild("SystemMessageEvent") as RemoteEvent;

// Wait for chat to be ready
let chatReady = false;
task.spawn(() => {
	let attempts = 0;
	while (!chatReady && attempts < 30) {
		const [success] = pcall(() => {
			StarterGui.SetCore("ChatMakeSystemMessage", {
				Text: "",
				Color: new Color3(1, 1, 1),
			});
		});
		if (success) {
			chatReady = true;
			Logger.Info("UIManager", "Chat system ready");
		} else {
			attempts += 1;
			task.wait(0.5);
		}
	}
});

// Function to send system message to chat
const sendSystemMessage = (message: string) => {
	// Try to send to Roblox chat
	const [success] = pcall(() => {
		StarterGui.SetCore("ChatMakeSystemMessage", {
			Text: message,
			Color: Color3.fromRGB(255, 215, 0), // Gold color
			Font: Enum.Font.GothamBold,
			TextSize: 16,
		});
	});

	// Also log it
	Logger.Info("System", message);

	return success;
};

SystemMessageEvent.OnClientEvent.Connect((message) => {
	sendSystemMessage(message as string);
});

Logger.Info("UIManager", "Initialized");

export = {
	SendSystemMessage: sendSystemMessage,
};
