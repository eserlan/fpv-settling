// Client-side Inventory UI - Shows collected resources
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");
const TweenService = game.GetService("TweenService");

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

const Logger = require(ReplicatedStorage.WaitForChild("Shared").WaitForChild("Logger")) as typeof import("shared/Logger");

const InventoryUI = {} as Record<string, unknown>;

// Wait for events
const events = ReplicatedStorage.WaitForChild("Events");
const CollectEvent = events.WaitForChild("CollectEvent") as RemoteEvent;

// Resource display data (icons must match Blueprints.ResourceIcons)
const RESOURCES = [
	{ Key: "Wood", Icon: "🌲", Color: Color3.fromRGB(139, 90, 43) },
	{ Key: "Brick", Icon: "🧱", Color: Color3.fromRGB(178, 102, 59) },
	{ Key: "Wheat", Icon: "🌾", Color: Color3.fromRGB(218, 165, 32) },
	{ Key: "Ore", Icon: "⛏", Color: Color3.fromRGB(105, 105, 105) },
	{ Key: "Wool", Icon: "🧶", Color: Color3.fromRGB(245, 245, 245) },
];

// Create UI elements
const screenGui = new Instance("ScreenGui");
screenGui.Name = "InventoryUI";
screenGui.ResetOnSpawn = false;
screenGui.Parent = playerGui;

// Inventory bar (bottom center)
const inventoryFrame = new Instance("Frame");
inventoryFrame.Name = "InventoryFrame";
inventoryFrame.Size = UDim2.new(0, 400, 0, 60);
inventoryFrame.Position = UDim2.new(0.5, -200, 1, -80);
inventoryFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40);
inventoryFrame.BackgroundTransparency = 0.3;
inventoryFrame.BorderSizePixel = 0;
inventoryFrame.Parent = screenGui;

const inventoryCorner = new Instance("UICorner");
inventoryCorner.CornerRadius = UDim.new(0, 12);
inventoryCorner.Parent = inventoryFrame;

const inventoryLayout = new Instance("UIListLayout");
inventoryLayout.FillDirection = Enum.FillDirection.Horizontal;
inventoryLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
inventoryLayout.VerticalAlignment = Enum.VerticalAlignment.Center;
inventoryLayout.Padding = UDim.new(0, 10);
inventoryLayout.Parent = inventoryFrame;

// Create resource slots
const resourceLabels: Record<string, TextLabel> = {};

for (const resourceData of RESOURCES) {
	const slot = new Instance("Frame");
	slot.Name = `${resourceData.Key}Slot`;
	slot.Size = UDim2.new(0, 70, 0, 50);
	slot.BackgroundColor3 = resourceData.Color;
	slot.BackgroundTransparency = 0.5;
	slot.BorderSizePixel = 0;
	slot.Parent = inventoryFrame;

	const slotCorner = new Instance("UICorner");
	slotCorner.CornerRadius = UDim.new(0, 8);
	slotCorner.Parent = slot;

	const iconLabel = new Instance("TextLabel");
	iconLabel.Name = "Icon";
	iconLabel.Size = UDim2.new(0.5, 0, 1, 0);
	iconLabel.Position = UDim2.new(0, 0, 0, 0);
	iconLabel.BackgroundTransparency = 1;
	iconLabel.TextColor3 = Color3.new(1, 1, 1);
	iconLabel.TextScaled = true;
	iconLabel.Font = Enum.Font.GothamBold;
	iconLabel.Text = resourceData.Icon;
	iconLabel.Parent = slot;

	const countLabel = new Instance("TextLabel");
	countLabel.Name = "Count";
	countLabel.Size = UDim2.new(0.5, 0, 1, 0);
	countLabel.Position = UDim2.new(0.5, 0, 0, 0);
	countLabel.BackgroundTransparency = 1;
	countLabel.TextColor3 = Color3.new(1, 1, 1);
	countLabel.TextScaled = true;
	countLabel.Font = Enum.Font.GothamBold;
	countLabel.Text = "0";
	countLabel.Parent = slot;

	resourceLabels[resourceData.Key] = countLabel;
}

// Collection notification (floating text)
const notificationLabel = new Instance("TextLabel");
notificationLabel.Name = "Notification";
notificationLabel.Size = UDim2.new(0, 300, 0, 50);
notificationLabel.Position = UDim2.new(0.5, -150, 0.7, 0);
notificationLabel.BackgroundTransparency = 1;
notificationLabel.TextColor3 = Color3.fromRGB(100, 255, 100);
notificationLabel.TextScaled = true;
notificationLabel.Font = Enum.Font.GothamBold;
notificationLabel.Text = "";
notificationLabel.TextTransparency = 1;
notificationLabel.Parent = screenGui;

// Update inventory display
const updateInventory = (inventory: Record<string, number>) => {
	for (const [resourceKey, countLabel] of pairs(resourceLabels)) {
		const count = inventory[resourceKey] ?? 0;
		countLabel.Text = tostring(count);
	}
};

// Show collection notification
const showCollectionNotification = (resourceType: string, amount: number) => {
	const icons: Record<string, string> = {
		Wood: "🌲",
		Brick: "🧱",
		Wheat: "🌾",
		Ore: "⛏",
		Wool: "🧶",
	};

	const icon = icons[resourceType] ?? "📦";
	notificationLabel.Text = `+${amount} ${icon} ${resourceType}`;
	notificationLabel.TextTransparency = 0;
	notificationLabel.Position = UDim2.new(0.5, -150, 0.7, 0);

	// Animate upward and fade
	const tween = TweenService.Create(
		notificationLabel,
		new TweenInfo(1.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
		{
			Position: UDim2.new(0.5, -150, 0.6, 0),
			TextTransparency: 1,
		},
	);
	tween.Play();
};

// Handle collection events
CollectEvent.OnClientEvent.Connect((eventType, data1, data2) => {
	if (eventType === "InventoryUpdate") {
		updateInventory(data1 as Record<string, number>);
	} else if (eventType === "Collected") {
		showCollectionNotification(data1 as string, data2 as number);
	}
});

// Request initial inventory
task.delay(1, () => {
	CollectEvent.FireServer("GetInventory");
});

Logger.Info("InventoryUI", "Initialized");

export = InventoryUI;
