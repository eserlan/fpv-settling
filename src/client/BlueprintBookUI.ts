// Blueprint Book UI
// Opens with B key, shows available buildings and their costs

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const UserInputService = game.GetService("UserInputService");
const Players = game.GetService("Players");

const Blueprints = require(ReplicatedStorage.Shared.Blueprints) as typeof import("shared/Blueprints");
const Logger = require(ReplicatedStorage.Shared.Logger) as typeof import("shared/Logger");
const Network = require(ReplicatedStorage.Shared.Network) as typeof import("shared/Network");

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
mainFrame.Size = UDim2.new(0, 520, 0, 420);
mainFrame.Position = UDim2.new(0.5, -260, 0.5, -210);
mainFrame.BackgroundColor3 = Color3.fromRGB(35, 35, 45);
mainFrame.BorderSizePixel = 0;
mainFrame.Parent = screenGui;

const corner = new Instance("UICorner");
corner.CornerRadius = UDim.new(0, 16);
corner.Parent = mainFrame;

// Title bar
const titleBar = new Instance("Frame");
titleBar.Name = "TitleBar";
titleBar.Size = UDim2.new(1, 0, 0, 50);
titleBar.BackgroundColor3 = Color3.fromRGB(50, 50, 65);
titleBar.BorderSizePixel = 0;
titleBar.Parent = mainFrame;

const titleCorner = new Instance("UICorner");
titleCorner.CornerRadius = UDim.new(0, 16);
titleCorner.Parent = titleBar;

const titleFix = new Instance("Frame");
titleFix.Size = UDim2.new(1, 0, 0, 16);
titleFix.Position = UDim2.new(0, 0, 1, -16);
titleFix.BackgroundColor3 = Color3.fromRGB(50, 50, 65);
titleFix.BorderSizePixel = 0;
titleFix.Parent = titleBar;

const titleLabel = new Instance("TextLabel");
titleLabel.Name = "Title";
titleLabel.Size = UDim2.new(1, 0, 1, 0);
titleLabel.BackgroundTransparency = 1;
titleLabel.Text = "📖 BLUEPRINT BOOK";
titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
titleLabel.Font = Enum.Font.GothamBold;
titleLabel.TextSize = 24;
titleLabel.Parent = titleBar;

// Close button
const closeButton = new Instance("TextButton");
closeButton.Name = "CloseButton";
closeButton.Size = UDim2.new(0, 40, 0, 40);
closeButton.Position = UDim2.new(1, -45, 0, 5);
closeButton.BackgroundColor3 = Color3.fromRGB(200, 80, 80);
closeButton.Text = "✕";
closeButton.TextColor3 = Color3.new(1, 1, 1);
closeButton.Font = Enum.Font.GothamBold;
closeButton.TextSize = 20;
closeButton.Parent = titleBar;

const closeCorner = new Instance("UICorner");
closeCorner.CornerRadius = UDim.new(0, 8);
closeCorner.Parent = closeButton;

closeButton.MouseButton1Click.Connect(() => {
	BlueprintBookUI.Close();
});

// Blueprint container
const container = new Instance("Frame");
container.Name = "Container";
container.Size = UDim2.new(1, -40, 1, -110);
container.Position = UDim2.new(0, 20, 0, 60);
container.BackgroundTransparency = 1;
container.Parent = mainFrame;

const containerLayout = new Instance("UIListLayout");
containerLayout.FillDirection = Enum.FillDirection.Horizontal;
containerLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
containerLayout.Padding = UDim.new(0, 20);
containerLayout.Parent = container;

// Refresh affordability
const refreshAffordability = () => {
	for (const [name, cardData] of pairs(cards)) {
		const blueprint = Blueprints.Buildings[name];
		const canAfford = Blueprints.CanAfford(currentResources, name);

		const selectBtn = cardData.SelectButton;
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

		for (const [resource, label] of pairs(cardData.CostLabels)) {
			const required = blueprint.Cost[resource] ?? 0;
			const has = currentResources[resource] ?? 0;
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
	card.Size = UDim2.new(0, 140, 0, 260);
	card.BackgroundColor3 = Color3.fromRGB(55, 55, 70);
	card.BorderSizePixel = 0;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = UDim.new(0, 12);
	cardCorner.Parent = card;

	const icon = new Instance("TextLabel");
	icon.Name = "Icon";
	icon.Size = UDim2.new(1, 0, 0, 60);
	icon.Position = UDim2.new(0, 0, 0, 10);
	icon.BackgroundTransparency = 1;
	icon.Text = blueprintData.Icon;
	icon.TextSize = 48;
	icon.Parent = card;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "Name";
	nameLabel.Size = UDim2.new(1, -10, 0, 25);
	nameLabel.Position = UDim2.new(0, 5, 0, 70);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = blueprintData.Name;
	nameLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
	nameLabel.Font = Enum.Font.GothamBold;
	nameLabel.TextSize = 16;
	nameLabel.Parent = card;

	const costFrame = new Instance("Frame");
	costFrame.Name = "CostFrame";
	costFrame.Size = UDim2.new(1, -10, 0, 110);
	costFrame.Position = UDim2.new(0, 5, 0, 100);
	costFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 50);
	costFrame.BorderSizePixel = 0;
	costFrame.Parent = card;

	const costCorner = new Instance("UICorner");
	costCorner.CornerRadius = UDim.new(0, 6);
	costCorner.Parent = costFrame;

	const costLabels: Record<string, TextLabel> = {};
	let y = 8;
	for (const [resource, amount] of pairs(blueprintData.Cost)) {
		const costLabel = new Instance("TextLabel");
		costLabel.Size = UDim2.new(1, -10, 0, 18);
		costLabel.Position = UDim2.new(0, 10, 0, y);
		costLabel.BackgroundTransparency = 1;
		costLabel.Text = `${Blueprints.ResourceIcons[resource] ?? ""} ${resource}: ${amount}`;
		costLabel.TextColor3 = Color3.fromRGB(200, 200, 200);
		costLabel.Font = Enum.Font.Gotham;
		costLabel.TextSize = 12;
		costLabel.TextXAlignment = Enum.TextXAlignment.Left;
		costLabel.Parent = costFrame;
		costLabels[resource] = costLabel;
		y += 18;
	}

	const selectButton = new Instance("TextButton");
	selectButton.Name = "SelectButton";
	selectButton.Size = UDim2.new(1, -10, 0, 35);
	selectButton.Position = UDim2.new(0, 5, 1, -40);
	selectButton.BackgroundColor3 = Color3.fromRGB(80, 160, 80);
	selectButton.Text = "SELECT";
	selectButton.TextColor3 = Color3.new(1, 1, 1);
	selectButton.Font = Enum.Font.GothamBold;
	selectButton.TextSize = 9;
	selectButton.Parent = card;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = UDim.new(0, 6);
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
	const data = Blueprints.Buildings[name];
	const card = createBlueprintCard(name, data);
	card.Parent = container;
}

// Listen for inventory updates
Network.OnEvent("CollectEvent", (action, data) => {
	if (action === "InventoryUpdate") {
		currentResources = data as Record<string, number>;
		refreshAffordability();
	}
});

// Help text
const helpText = new Instance("TextLabel");
helpText.Name = "HelpText";
helpText.Size = UDim2.new(1, 0, 0, 30);
helpText.Position = UDim2.new(0, 0, 1, -30);
helpText.BackgroundTransparency = 1;
helpText.Text = "Click a blueprint to select, then click to place foundation • ESC or B to close";
helpText.TextColor3 = Color3.fromRGB(150, 150, 150);
helpText.Font = Enum.Font.Gotham;
helpText.TextSize = 12;
helpText.Parent = mainFrame;

// Public Functions
BlueprintBookUI.Open = () => {
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
