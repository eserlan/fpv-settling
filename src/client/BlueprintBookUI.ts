// Blueprint Book UI
// Opens with B key, shows available buildings and their costs

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const UserInputService = game.GetService("UserInputService");
const Players = game.GetService("Players");

import Blueprints from "shared/Blueprints";
import * as Logger from "shared/Logger";
import { ClientEvents } from "./ClientEvents";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

const BlueprintBookUI = {} as {
	Open: () => void;
	Close: () => void;
	Toggle: () => void;
	IsOpen: () => boolean;
	OnBlueprintSelected: (cb: (blueprintName: string, blueprintData: import("shared/Blueprints").BlueprintInfo) => void) => void;
};

// State
let isOpen = false;
let selectedBlueprint: string | undefined;
let onBlueprintSelected: ((blueprintName: string, blueprintData: import("shared/Blueprints").BlueprintInfo) => void) | undefined;
let currentResources: Record<string, number> = {
	Wood: 0,
	Brick: 0,
	Wheat: 0,
	Wool: 0,
	Ore: 0,
};
let isGameStarted = false;

ClientEvents.GameStart.connect(() => {
	isGameStarted = true;
});

type CardData = {
	SelectButton: TextButton;
	CostLabels: Record<string, TextLabel>;
};

const cards: Record<string, CardData> = {};

// Create the UI
const screenGui = new Instance("ScreenGui");
screenGui.Name = "BlueprintBookUI";
screenGui.ResetOnSpawn = false;
screenGui.Enabled = false;
screenGui.Parent = playerGui;

// Main frame
const mainFrame = new Instance("Frame");
mainFrame.Name = "MainFrame";
mainFrame.Size = new UDim2(0, 520, 0, 420);
mainFrame.Position = new UDim2(0.5, -260, 0.5, -210);
mainFrame.BackgroundColor3 = Color3.fromRGB(35, 35, 45);
mainFrame.BorderSizePixel = 0;
mainFrame.Parent = screenGui;

const corner = new Instance("UICorner");
corner.CornerRadius = new UDim(0, 16);
corner.Parent = mainFrame;

// Title bar
const titleBar = new Instance("Frame");
titleBar.Name = "TitleBar";
titleBar.Size = new UDim2(1, 0, 0, 50);
titleBar.BackgroundColor3 = Color3.fromRGB(50, 50, 65);
titleBar.BorderSizePixel = 0;
titleBar.Parent = mainFrame;

const titleCorner = new Instance("UICorner");
titleCorner.CornerRadius = new UDim(0, 16);
titleCorner.Parent = titleBar;

const titleFix = new Instance("Frame");
titleFix.Size = new UDim2(1, 0, 0, 16);
titleFix.Position = new UDim2(0, 0, 1, -16);
titleFix.BackgroundColor3 = Color3.fromRGB(50, 50, 65);
titleFix.BorderSizePixel = 0;
titleFix.Parent = titleBar;

const titleLabel = new Instance("TextLabel");
titleLabel.Name = "Title";
titleLabel.Size = new UDim2(1, 0, 1, 0);
titleLabel.BackgroundTransparency = 1;
titleLabel.Text = "📖 BLUEPRINT BOOK";
titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
titleLabel.Font = Enum.Font.GothamBold;
titleLabel.TextSize = 24;
titleLabel.Parent = titleBar;

// Close button
const closeButton = new Instance("TextButton");
closeButton.Name = "CloseButton";
closeButton.Size = new UDim2(0, 40, 0, 40);
closeButton.Position = new UDim2(1, -45, 0, 5);
closeButton.BackgroundColor3 = Color3.fromRGB(200, 80, 80);
closeButton.Text = "✕";
closeButton.TextColor3 = new Color3(1, 1, 1);
closeButton.Font = Enum.Font.GothamBold;
closeButton.TextSize = 20;
closeButton.Parent = titleBar;

const closeCorner = new Instance("UICorner");
closeCorner.CornerRadius = new UDim(0, 8);
closeCorner.Parent = closeButton;

closeButton.MouseButton1Click.Connect(() => {
	BlueprintBookUI.Close();
});

// Blueprint container
const container = new Instance("Frame");
container.Name = "Container";
container.Size = new UDim2(1, -40, 1, -110);
container.Position = new UDim2(0, 20, 0, 60);
container.BackgroundTransparency = 1;
container.Parent = mainFrame;

const containerLayout = new Instance("UIListLayout");
containerLayout.FillDirection = Enum.FillDirection.Horizontal;
containerLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
containerLayout.Padding = new UDim(0, 20);
containerLayout.Parent = container;

// Refresh affordability
const refreshAffordability = () => {
	for (const [name, cardData] of pairs(cards)) {
		const blueprintName = name as string;
		const data = cardData as CardData;
		const blueprint = Blueprints.Buildings[blueprintName];
		const canAfford = Blueprints.CanAfford(currentResources, blueprintName);

		const selectBtn = data.SelectButton;
		if (canAfford) {
			selectBtn.BackgroundColor3 = Color3.fromRGB(80, 160, 80);
			selectBtn.AutoButtonColor = true;
			selectBtn.Text = "SELECT";
			selectBtn.TextTransparency = 0;
		} else {
			selectBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 70);
			selectBtn.AutoButtonColor = false;
			selectBtn.Text = "INSUFFICIENT FUNDS";
			selectBtn.TextTransparency = 0.5;
		}

		for (const [resource, label] of pairs(data.CostLabels)) {
			const res = resource as string;
			const required = blueprint.Cost[res] ?? 0;
			const has = currentResources[res] ?? 0;
			if (has >= required) {
				label.TextColor3 = Color3.fromRGB(200, 200, 200);
			} else {
				label.TextColor3 = Color3.fromRGB(255, 100, 100);
			}
		}
	}
};

// Create a blueprint card
const createBlueprintCard = (blueprintName: string, blueprintData: import("shared/Blueprints").BlueprintInfo) => {
	const card = new Instance("Frame");
	card.Name = `${blueprintName}Card`;
	card.Size = new UDim2(0, 140, 0, 260);
	card.BackgroundColor3 = Color3.fromRGB(55, 55, 70);
	card.BorderSizePixel = 0;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = new UDim(0, 12);
	cardCorner.Parent = card;

	const icon = new Instance("TextLabel");
	icon.Name = "Icon";
	icon.Size = new UDim2(1, 0, 0, 60);
	icon.Position = new UDim2(0, 0, 0, 10);
	icon.BackgroundTransparency = 1;
	icon.Text = blueprintData.Icon;
	icon.TextSize = 48;
	icon.Parent = card;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "Name";
	nameLabel.Size = new UDim2(1, -10, 0, 25);
	nameLabel.Position = new UDim2(0, 5, 0, 70);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = blueprintData.Name;
	nameLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
	nameLabel.Font = Enum.Font.GothamBold;
	nameLabel.TextSize = 16;
	nameLabel.Parent = card;

	const costFrame = new Instance("Frame");
	costFrame.Name = "CostFrame";
	costFrame.Size = new UDim2(1, -10, 0, 110);
	costFrame.Position = new UDim2(0, 5, 0, 100);
	costFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 50);
	costFrame.BorderSizePixel = 0;
	costFrame.Parent = card;

	const costCorner = new Instance("UICorner");
	costCorner.CornerRadius = new UDim(0, 6);
	costCorner.Parent = costFrame;

	const costLabels: Record<string, TextLabel> = {};
	let y = 8;
	for (const [resource, amount] of pairs(blueprintData.Cost)) {
		const res = resource as string;
		const amt = amount as number;
		const costLabel = new Instance("TextLabel");
		costLabel.Size = new UDim2(1, -10, 0, 18);
		costLabel.Position = new UDim2(0, 10, 0, y);
		costLabel.BackgroundTransparency = 1;
		costLabel.Text = `${Blueprints.ResourceIcons[res] ?? ""} ${res}: ${amt}`;
		costLabel.TextColor3 = Color3.fromRGB(200, 200, 200);
		costLabel.Font = Enum.Font.Gotham;
		costLabel.TextSize = 12;
		costLabel.TextXAlignment = Enum.TextXAlignment.Left;
		costLabel.Parent = costFrame;
		costLabels[res] = costLabel;
		y += 18;
	}

	const selectButton = new Instance("TextButton");
	selectButton.Name = "SelectButton";
	selectButton.Size = new UDim2(1, -10, 0, 35);
	selectButton.Position = new UDim2(0, 5, 1, -40);
	selectButton.BackgroundColor3 = Color3.fromRGB(80, 160, 80);
	selectButton.Text = "SELECT";
	selectButton.TextColor3 = new Color3(1, 1, 1);
	selectButton.Font = Enum.Font.GothamBold;
	selectButton.TextSize = 9;
	selectButton.Parent = card;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0, 6);
	btnCorner.Parent = selectButton;

	selectButton.MouseButton1Click.Connect(() => {
		if (Blueprints.CanAfford(currentResources, blueprintName)) {
			selectedBlueprint = blueprintName;
			BlueprintBookUI.Close();
			if (onBlueprintSelected) {
				onBlueprintSelected(blueprintName, blueprintData);
			}
		}
	});

	cards[blueprintName] = {
		SelectButton: selectButton,
		CostLabels: costLabels,
	};

	return card;
};

// Initialize
const sortedNames = Blueprints.GetBlueprintNames();
for (const name of sortedNames) {
	const n = name as string;
	const data = Blueprints.Buildings[n];
	const card = createBlueprintCard(n, data);
	card.Parent = container;
}

// Listen for inventory updates
ClientEvents.CollectEvent.connect((action, ...args) => {
	if (action === "InventoryUpdate") {
		currentResources = args[0] as Record<string, number>;
		refreshAffordability();
	}
});

// Help text
const helpText = new Instance("TextLabel");
helpText.Name = "HelpText";
helpText.Size = new UDim2(1, 0, 0, 30);
helpText.Position = new UDim2(0, 0, 1, -30);
helpText.BackgroundTransparency = 1;
helpText.Text = "Click a blueprint to select, then click to place foundation • ESC or B to close";
helpText.TextColor3 = Color3.fromRGB(150, 150, 150);
helpText.Font = Enum.Font.Gotham;
helpText.TextSize = 12;
helpText.Parent = mainFrame;

// Public Functions
BlueprintBookUI.Open = () => {
	if (!isGameStarted) return;
	isOpen = true;
	screenGui.Enabled = true;
	refreshAffordability();
};

BlueprintBookUI.Close = () => {
	isOpen = false;
	screenGui.Enabled = false;
};

BlueprintBookUI.Toggle = () => {
	if (isOpen) {
		BlueprintBookUI.Close();
	} else {
		BlueprintBookUI.Open();
	}
};

BlueprintBookUI.IsOpen = () => isOpen;
BlueprintBookUI.OnBlueprintSelected = (cb) => {
	onBlueprintSelected = cb;
};

UserInputService.InputBegan.Connect((input, processed) => {
	if (!processed && input.KeyCode === Enum.KeyCode.Escape && isOpen) {
		BlueprintBookUI.Close();
	}
});

Logger.Info("BlueprintBookUI", "Initialized");

export = BlueprintBookUI;
