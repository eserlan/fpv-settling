// Client-side Trade UI for Port Trading System
const Players = game.GetService("Players");
const UserInputService = game.GetService("UserInputService");
import { ClientEvents } from "./ClientEvents";
import ResourceTypes from "shared/ResourceTypes";
import PortTypes, { DEFAULT_TRADE_RATIO } from "shared/PortTypes";
import * as Logger from "shared/Logger";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

// Trade UI state
let currentGiveResource = "Wood";
let currentReceiveResource = "Brick";
let tradeAmount = 1;
let ownedPorts: string[] = [];
let harborMasterPoints = 0;
let isGameStarted = false;

ClientEvents.GameStart.connect(() => {
	isGameStarted = true;
});

// Create Trade UI
const createTradeUI = () => {
	const screenGui = playerGui.FindFirstChild("GameUI") as ScreenGui;
	if (!screenGui) {
		return;
	}

	// Main Trade Frame
	const tradeFrame = new Instance("Frame");
	tradeFrame.Name = "TradeMenu";
	tradeFrame.Size = new UDim2(0, 400, 0, 450);
	tradeFrame.Position = new UDim2(0.5, -200, 0.5, -225);
	tradeFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40);
	tradeFrame.BackgroundTransparency = 0.1;
	tradeFrame.BorderSizePixel = 3;
	tradeFrame.BorderColor3 = Color3.fromRGB(200, 200, 200);
	tradeFrame.Visible = false;
	tradeFrame.Parent = screenGui;

	// Title
	const title = new Instance("TextLabel");
	title.Name = "Title";
	title.Size = new UDim2(1, 0, 0, 40);
	title.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
	title.BorderSizePixel = 0;
	title.Text = "Port Trading";
	title.TextColor3 = Color3.fromRGB(255, 255, 255);
	title.Font = Enum.Font.GothamBold;
	title.TextSize = 24;
	title.Parent = tradeFrame;

	// Close Button
	const closeButton = new Instance("TextButton");
	closeButton.Name = "CloseButton";
	closeButton.Size = new UDim2(0, 30, 0, 30);
	closeButton.Position = new UDim2(1, -35, 0, 5);
	closeButton.BackgroundColor3 = Color3.fromRGB(200, 50, 50);
	closeButton.Text = "X";
	closeButton.TextColor3 = Color3.fromRGB(255, 255, 255);
	closeButton.Font = Enum.Font.GothamBold;
	closeButton.TextSize = 20;
	closeButton.Parent = tradeFrame;

	closeButton.MouseButton1Click.Connect(() => {
		tradeFrame.Visible = false;
	});

	// Trade Info Label
	const infoLabel = new Instance("TextLabel");
	infoLabel.Name = "InfoLabel";
	infoLabel.Size = new UDim2(1, -20, 0, 60);
	infoLabel.Position = new UDim2(0, 10, 0, 50);
	infoLabel.BackgroundTransparency = 1;
	infoLabel.Text = "Select resources to trade.\nTrade ratios depend on your ports.";
	infoLabel.TextColor3 = Color3.fromRGB(200, 200, 200);
	infoLabel.Font = Enum.Font.Gotham;
	infoLabel.TextSize = 16;
	infoLabel.TextWrapped = true;
	infoLabel.TextYAlignment = Enum.TextYAlignment.Top;
	infoLabel.Parent = tradeFrame;

	// Give Resource Section
	const giveLabel = new Instance("TextLabel");
	giveLabel.Name = "GiveLabel";
	giveLabel.Size = new UDim2(0, 150, 0, 25);
	giveLabel.Position = new UDim2(0, 20, 0, 120);
	giveLabel.BackgroundTransparency = 1;
	giveLabel.Text = "Give:";
	giveLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
	giveLabel.Font = Enum.Font.GothamBold;
	giveLabel.TextSize = 18;
	giveLabel.TextXAlignment = Enum.TextXAlignment.Left;
	giveLabel.Parent = tradeFrame;

	const giveDropdown = createResourceDropdown("GiveDropdown", new UDim2(0, 20, 0, 150), tradeFrame, (resource) => {
		currentGiveResource = resource;
		updateTradeInfo();
	});

	// Receive Resource Section
	const receiveLabel = new Instance("TextLabel");
	receiveLabel.Name = "ReceiveLabel";
	receiveLabel.Size = new UDim2(0, 150, 0, 25);
	receiveLabel.Position = new UDim2(0, 20, 0, 220);
	receiveLabel.BackgroundTransparency = 1;
	receiveLabel.Text = "Receive:";
	receiveLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
	receiveLabel.Font = Enum.Font.GothamBold;
	receiveLabel.TextSize = 18;
	receiveLabel.TextXAlignment = Enum.TextXAlignment.Left;
	receiveLabel.Parent = tradeFrame;

	const receiveDropdown = createResourceDropdown("ReceiveDropdown", new UDim2(0, 20, 0, 250), tradeFrame, (resource) => {
		currentReceiveResource = resource;
		updateTradeInfo();
	});

	// Trade Ratio Display
	const ratioLabel = new Instance("TextLabel");
	ratioLabel.Name = "RatioLabel";
	ratioLabel.Size = new UDim2(1, -40, 0, 30);
	ratioLabel.Position = new UDim2(0, 20, 0, 320);
	ratioLabel.BackgroundColor3 = Color3.fromRGB(60, 60, 60);
	ratioLabel.BorderSizePixel = 2;
	ratioLabel.BorderColor3 = Color3.fromRGB(100, 100, 100);
	ratioLabel.Text = "Trade Ratio: 4:1 (Bank)";
	ratioLabel.TextColor3 = Color3.fromRGB(255, 200, 100);
	ratioLabel.Font = Enum.Font.GothamBold;
	ratioLabel.TextSize = 18;
	ratioLabel.Parent = tradeFrame;

	// Execute Trade Button
	const tradeButton = new Instance("TextButton");
	tradeButton.Name = "TradeButton";
	tradeButton.Size = new UDim2(1, -40, 0, 40);
	tradeButton.Position = new UDim2(0, 20, 0, 360);
	tradeButton.BackgroundColor3 = Color3.fromRGB(50, 150, 50);
	tradeButton.Text = "Execute Trade";
	tradeButton.TextColor3 = Color3.fromRGB(255, 255, 255);
	tradeButton.Font = Enum.Font.GothamBold;
	tradeButton.TextSize = 20;
	tradeButton.Parent = tradeFrame;

	tradeButton.MouseButton1Click.Connect(() => {
		ClientEvents.ExecuteTrade.fire(currentGiveResource, currentReceiveResource, tradeAmount);
		Logger.Info("TradeUI", `Requesting trade: ${currentGiveResource} -> ${currentReceiveResource}`);
	});

	// Harbor Master Display (if applicable)
	const harborMasterLabel = new Instance("TextLabel");
	harborMasterLabel.Name = "HarborMasterLabel";
	harborMasterLabel.Size = new UDim2(1, -40, 0, 25);
	harborMasterLabel.Position = new UDim2(0, 20, 0, 410);
	harborMasterLabel.BackgroundTransparency = 1;
	harborMasterLabel.Text = "";
	harborMasterLabel.TextColor3 = Color3.fromRGB(255, 215, 0); // Gold
	harborMasterLabel.Font = Enum.Font.GothamBold;
	harborMasterLabel.TextSize = 14;
	harborMasterLabel.Parent = tradeFrame;

	// Update trade info display
	const updateTradeInfo = () => {
		const ratio = getBestTradeRatio(currentGiveResource);
		const cost = ratio * tradeAmount;

		let ratioText = `Trade Ratio: ${ratio}:1`;
		if (ratio === 2) {
			ratioText += ` (${currentGiveResource} Port)`;
		} else if (ratio === 3) {
			ratioText += " (Generic Port)";
		} else {
			ratioText += " (Bank)";
		}

		ratioLabel.Text = ratioText;
		tradeButton.Text = `Trade ${cost} ${currentGiveResource} for ${tradeAmount} ${currentReceiveResource}`;

		// Update Harbor Master display
		if (harborMasterPoints >= 3) {
			harborMasterLabel.Text = `⚓ Harbor Master (${harborMasterPoints} ports) - Special abilities unlocked!`;
		} else if (harborMasterPoints > 0) {
			harborMasterLabel.Text = `Ports owned: ${harborMasterPoints}`;
		} else {
			harborMasterLabel.Text = "";
		}
	};

	updateTradeInfo();

	return tradeFrame;
};

// Helper function to create resource dropdown
const createResourceDropdown = (
	name: string,
	position: UDim2,
	parent: Frame,
	onChange: (resource: string) => void,
) => {
	const dropdown = new Instance("Frame");
	dropdown.Name = name;
	dropdown.Size = new UDim2(1, -40, 0, 50);
	dropdown.Position = position;
	dropdown.BackgroundColor3 = Color3.fromRGB(60, 60, 60);
	dropdown.BorderSizePixel = 2;
	dropdown.BorderColor3 = Color3.fromRGB(100, 100, 100);
	dropdown.Parent = parent;

	const layout = new Instance("UIListLayout");
	layout.FillDirection = Enum.FillDirection.Horizontal;
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
	layout.VerticalAlignment = Enum.VerticalAlignment.Center;
	layout.Padding = new UDim(0, 5);
	layout.Parent = dropdown;

	// Create a button for each resource type
	for (const [resourceName, resourceInfo] of pairs(ResourceTypes.Resources)) {
		const button = new Instance("TextButton");
		button.Name = resourceName;
		button.Size = new UDim2(0, 60, 0, 45);
		button.BackgroundColor3 = resourceInfo.Color;
		button.Text = resourceInfo.Icon;
		button.TextColor3 = Color3.fromRGB(255, 255, 255);
		button.Font = Enum.Font.GothamBold;
		button.TextSize = 24;
		button.Parent = dropdown;

		button.MouseButton1Click.Connect(() => {
			onChange(resourceName);
		});
	}

	return dropdown;
};

// Calculate best trade ratio for a given resource
const getBestTradeRatio = (resourceType: string): number => {
	// Check if player has a specialized port for this resource
	const specializedPort = `${resourceType}Port`;
	if (ownedPorts.includes(specializedPort)) {
		return 2; // Specialized port: 2:1
	}

	// Check if player has a generic port
	if (ownedPorts.includes("GenericPort")) {
		return 3; // Generic port: 3:1
	}

	// Default bank trade
	return DEFAULT_TRADE_RATIO; // 4:1
};

// Initialize the Trade UI
const tradeFrame = createTradeUI();

// Toggle Trade UI with T key
UserInputService.InputBegan.Connect((input, gameProcessed) => {
	if (gameProcessed) {
		return;
	}

	if (input.KeyCode === Enum.KeyCode.T && tradeFrame && isGameStarted) {
		tradeFrame.Visible = !tradeFrame.Visible;
	}
});

// Network events
ClientEvents.PortClaimed.connect((portType) => {
	if (!ownedPorts.includes(portType)) {
		ownedPorts.push(portType);
		Logger.Info("TradeUI", `Port claimed: ${portType}`);
	}
});

ClientEvents.HarborMasterUpdate.connect((points) => {
	harborMasterPoints = points;
	Logger.Info("TradeUI", `Harbor Master points: ${harborMasterPoints}`);
});

ClientEvents.TradeCompleted.connect((giveResource, giveAmount, receiveResource, receiveAmount, ratio) => {
	Logger.Info(
		"TradeUI",
		`Trade completed: ${giveAmount} ${giveResource} -> ${receiveAmount} ${receiveResource} (${ratio}:1)`,
	);
});

Logger.Info("TradeUI", "Trade UI initialized! Press T to open trade menu");

export { };
