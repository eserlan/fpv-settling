// Client-side UI Manager
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");

import * as Logger from "shared/Logger";
import { ClientEvents } from "./ClientEvents";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

// Create main UI
const screenGui = new Instance("ScreenGui");
screenGui.Name = "GameUI";
screenGui.ResetOnSpawn = false;
screenGui.Enabled = false;
screenGui.Parent = playerGui;

ClientEvents.GameStart.connect(() => {
	screenGui.Enabled = true;
});

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

// Building List Content
const buildingList = new Instance("ScrollingFrame");
buildingList.Name = "List";
buildingList.Size = new UDim2(1, -10, 1, -80);
buildingList.Position = new UDim2(0, 5, 0, 35);
buildingList.BackgroundTransparency = 1;
buildingList.CanvasSize = new UDim2(0, 0, 0, 0); // Automatic
buildingList.ScrollBarThickness = 4;
buildingList.Parent = buildingFrame;

const listLayout = new Instance("UIListLayout");
listLayout.Padding = new UDim(0, 5);
listLayout.SortOrder = Enum.SortOrder.LayoutOrder;
listLayout.Parent = buildingList;

// Function to refresh the building list
const refreshBuildingList = () => {
	buildingList.ClearAllChildren();
	listLayout.Parent = buildingList; // Re-add layout

	const foldersToCheck = ["Settlements", "Buildings"];
	let itemCount = 0;

	for (const folderName of foldersToCheck) {
		const folder = game.Workspace.FindFirstChild(folderName);
		if (!folder) continue;

		for (const building of folder.GetChildren()) {
			if (building.IsA("Model")) {
				const ownerId = building.GetAttribute("OwnerId") as number | undefined;

				const icon = folderName === "Settlements" ? "🏠" : "🛤️";
				const btn = new Instance("TextButton");
				btn.Name = building.Name;
				btn.Size = new UDim2(1, -5, 0, 30);

				// Color based on ownership
				if (ownerId === player.UserId) {
					btn.BackgroundColor3 = Color3.fromRGB(60, 100, 60); // Green = yours
				} else if (ownerId !== undefined) {
					btn.BackgroundColor3 = Color3.fromRGB(100, 60, 60); // Red = other player
				} else {
					btn.BackgroundColor3 = Color3.fromRGB(80, 80, 80); // Grey = unknown owner
				}

				btn.Text = `${icon} ${building.Name}`;
				btn.TextColor3 = new Color3(1, 1, 1);
				btn.Font = Enum.Font.GothamBold;
				btn.TextSize = 14;
				btn.Parent = buildingList;
				itemCount++;

				const corner = new Instance("UICorner");
				corner.CornerRadius = new UDim(0, 4);
				corner.Parent = btn;

				btn.MouseButton1Click.Connect(() => {
					const camera = game.Workspace.CurrentCamera;
					if (camera && building.PrimaryPart) {
						camera.CameraSubject = building.PrimaryPart;
						Logger.Info("Camera", `Focused on ${building.Name}`);
					}
				});
			}
		}
	}

	// Update title with count
	buildingTitle.Text = `Buildings (${itemCount})`;
	buildingList.CanvasSize = new UDim2(0, 0, 0, itemCount * 35);
};

const resetCamBtn = new Instance("TextButton");
resetCamBtn.Name = "ResetCamera";
resetCamBtn.Size = new UDim2(1, -10, 0, 30);
resetCamBtn.Position = new UDim2(0, 5, 1, -35);
resetCamBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 60);
resetCamBtn.Text = "Reset Focus";
resetCamBtn.TextColor3 = new Color3(1, 1, 1);
resetCamBtn.Font = Enum.Font.GothamBold;
resetCamBtn.TextSize = 14;
resetCamBtn.Parent = buildingFrame;

const btnCorner = new Instance("UICorner");
btnCorner.CornerRadius = new UDim(0, 4);
btnCorner.Parent = resetCamBtn;

resetCamBtn.MouseButton1Click.Connect(() => {
	const camera = game.Workspace.CurrentCamera;
	const character = player.Character;
	if (camera && character) {
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (humanoid) camera.CameraSubject = humanoid;
	}
});

// Periodically refresh the list
task.spawn(() => {
	while (true) {
		refreshBuildingList();
		task.wait(5); // Refresh every 5s
	}
});

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
helpText.Text = "WASD - Move\nShift - Sprint\nB - Blueprints\nT - Trade\nE - Deposit Resources\nMouse - Look Around";
helpText.TextColor3 = Color3.fromRGB(255, 255, 255);
helpText.Font = Enum.Font.SourceSans;
helpText.TextSize = 16;
helpText.TextXAlignment = Enum.TextXAlignment.Left;
helpText.TextYAlignment = Enum.TextYAlignment.Top;
helpText.Parent = helpFrame;

// System message handler (for chat log)
const StarterGui = game.GetService("StarterGui");

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

ClientEvents.SystemMessageEvent.connect((message) => {
	sendSystemMessage(message);
});

Logger.Info("UIManager", "Initialized");

export = {
	SendSystemMessage: sendSystemMessage,
};
