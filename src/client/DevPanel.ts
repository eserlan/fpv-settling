// Dev Panel UI - Toggle features and debug tools
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");
const UserInputService = game.GetService("UserInputService");

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

import * as Logger from "shared/Logger";

const DevPanel = {} as Record<string, unknown>;

// Configuration
const TOGGLE_KEY = Enum.KeyCode.C; // Press Alt+C to toggle dev panel

// State
const showDiceNumbers = false;

// Wait for events
const events = ReplicatedStorage.WaitForChild("Events");
const DevEvent = events.WaitForChild("DevEvent") as RemoteEvent;

// Create UI
const screenGui = new Instance("ScreenGui");
screenGui.Name = "DevPanel";
screenGui.ResetOnSpawn = false;
screenGui.DisplayOrder = 100;
screenGui.Parent = playerGui;

// Main panel frame
const panelFrame = new Instance("Frame");
panelFrame.Name = "Panel";
panelFrame.Size = new UDim2(0, 250, 0, 300);
panelFrame.AnchorPoint = new Vector2(1, 1);
panelFrame.Position = new UDim2(1, -20, 1, -20);
panelFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 40);
panelFrame.BackgroundTransparency = 0.1;
panelFrame.BorderSizePixel = 0;
panelFrame.Visible = false; // Hidden by default, Alt+C to toggle
panelFrame.Parent = screenGui;

const panelCorner = new Instance("UICorner");
panelCorner.CornerRadius = new UDim(0, 12);
panelCorner.Parent = panelFrame;

// Title
const titleLabel = new Instance("TextLabel");
titleLabel.Name = "Title";
titleLabel.Size = new UDim2(1, 0, 0, 40);
titleLabel.Position = new UDim2(0, 0, 0, 0);
titleLabel.BackgroundColor3 = Color3.fromRGB(60, 60, 80);
titleLabel.BackgroundTransparency = 0.5;
titleLabel.TextColor3 = Color3.fromRGB(255, 200, 100);
titleLabel.TextScaled = true;
titleLabel.Font = Enum.Font.GothamBold;
titleLabel.Text = "🛠️ DEV PANEL";
titleLabel.Parent = panelFrame;

const titleCorner = new Instance("UICorner");
titleCorner.CornerRadius = new UDim(0, 12);
titleCorner.Parent = titleLabel;

// Content area
const contentFrame = new Instance("Frame");
contentFrame.Name = "Content";
contentFrame.Size = new UDim2(1, -20, 1, -60);
contentFrame.Position = new UDim2(0, 10, 0, 50);
contentFrame.BackgroundTransparency = 1;
contentFrame.Parent = panelFrame;

const contentLayout = new Instance("UIListLayout");
contentLayout.FillDirection = Enum.FillDirection.Vertical;
contentLayout.Padding = new UDim(0, 8);
contentLayout.Parent = contentFrame;

// Helper to create a toggle button
const createToggleButton = (
	name: string,
	labelText: string,
	defaultState: boolean,
	callback: (state: boolean) => void,
) => {
	const button = new Instance("TextButton");
	button.Name = name;
	button.Size = new UDim2(1, 0, 0, 35);
	button.BackgroundColor3 = defaultState ? Color3.fromRGB(50, 150, 50) : Color3.fromRGB(80, 80, 80);
	button.TextColor3 = new Color3(1, 1, 1);
	button.TextScaled = true;
	button.Font = Enum.Font.GothamBold;
	button.Text = `${labelText}${defaultState ? " ✓" : " ✗"}`;
	button.Parent = contentFrame;

	const buttonCorner = new Instance("UICorner");
	buttonCorner.CornerRadius = new UDim(0, 8);
	buttonCorner.Parent = button;

	let isOn = defaultState;

	button.MouseButton1Click.Connect(() => {
		isOn = !isOn;
		button.BackgroundColor3 = isOn ? Color3.fromRGB(50, 150, 50) : Color3.fromRGB(80, 80, 80);
		button.Text = `${labelText}${isOn ? " ✓" : " ✗"}`;
		callback(isOn);
	});

	return [button, () => isOn] as const;
};

// Helper to create an action button
const createActionButton = (name: string, labelText: string, callback: () => void) => {
	const button = new Instance("TextButton");
	button.Name = name;
	button.Size = new UDim2(1, 0, 0, 35);
	button.BackgroundColor3 = Color3.fromRGB(100, 80, 150);
	button.TextColor3 = new Color3(1, 1, 1);
	button.TextScaled = true;
	button.Font = Enum.Font.GothamBold;
	button.Text = labelText;
	button.Parent = contentFrame;

	const buttonCorner = new Instance("UICorner");
	buttonCorner.CornerRadius = new UDim(0, 8);
	buttonCorner.Parent = button;

	button.MouseButton1Click.Connect(callback);

	return button;
};

// Section label helper
const createSectionLabel = (text: string) => {
	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 0, 20);
	label.BackgroundTransparency = 1;
	label.TextColor3 = Color3.fromRGB(150, 150, 150);
	label.TextScaled = true;
	label.Font = Enum.Font.Gotham;
	label.Text = text;
	label.TextXAlignment = Enum.TextXAlignment.Left;
	label.Parent = contentFrame;
	return label;
};

// ========== ACTION: Force Pulse ==========
createSectionLabel("Pulse Controls");

createActionButton("ForcePulse", "⚡ Force Dice Roll", () => {
	DevEvent.FireServer("ForcePulse");
});

// Toggle panel visibility
const togglePanel = () => {
	panelFrame.Visible = !panelFrame.Visible;
};

// Key input (Alt+C)
UserInputService.InputBegan.Connect((input, gameProcessed) => {
	if (gameProcessed) {
		return;
	}

	// Check for Alt+C combination
	if (input.KeyCode === TOGGLE_KEY && UserInputService.IsKeyDown(Enum.KeyCode.LeftAlt)) {
		togglePanel();
	}
});

Logger.Info("DevPanel", "Initialized - Press Alt+C to open");

export = DevPanel;
