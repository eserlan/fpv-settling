// Client-side UI Manager
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");

import * as Logger from "shared/Logger";
import { ClientEvents } from "./ClientEvents";
import { MakeDraggable } from "./UIUtils";

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

// Management Menu (Sidebar)
const mainSidebar = new Instance("Frame");
mainSidebar.Name = "ManagementMenu";
mainSidebar.Size = new UDim2(0, 250, 0, 400);
mainSidebar.Position = new UDim2(1, -250, 0, 0);
mainSidebar.BackgroundColor3 = Color3.fromRGB(40, 40, 40);
mainSidebar.BackgroundTransparency = 0.3;
mainSidebar.BorderSizePixel = 2;
mainSidebar.BorderColor3 = Color3.fromRGB(200, 200, 200);
mainSidebar.Parent = screenGui;

const menuTitle = new Instance("TextLabel");
menuTitle.Name = "Title";
menuTitle.Size = new UDim2(1, 0, 0, 30);
menuTitle.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
menuTitle.BorderSizePixel = 0;
menuTitle.Text = "Your Assets";
menuTitle.TextColor3 = Color3.fromRGB(255, 255, 255);
menuTitle.Font = Enum.Font.GothamBold;
menuTitle.TextSize = 18;
menuTitle.Parent = mainSidebar;

MakeDraggable(mainSidebar, menuTitle);

// Tabs
const tabFrame = new Instance("Frame");
tabFrame.Name = "Tabs";
tabFrame.Size = new UDim2(1, 0, 0, 35);
tabFrame.Position = new UDim2(0, 0, 0, 30);
tabFrame.BackgroundColor3 = Color3.fromRGB(20, 20, 20);
tabFrame.BackgroundTransparency = 0.5;
tabFrame.BorderSizePixel = 0;
tabFrame.Parent = mainSidebar;

let currentTab: "Buildings" | "Resources" = "Buildings";

const createTabBtn = (name: string, pos: number) => {
	const btn = new Instance("TextButton");
	btn.Name = name + "Tab";
	btn.Size = new UDim2(0.5, 0, 1, 0);
	btn.Position = new UDim2(pos, 0, 0, 0);
	btn.BackgroundColor3 = Color3.fromRGB(50, 50, 50);
	btn.Text = name;
	btn.TextColor3 = new Color3(1, 1, 1);
	btn.Font = Enum.Font.GothamBold;
	btn.TextSize = 14;
	btn.Parent = tabFrame;
	return btn;
};

const buildingTabBtn = createTabBtn("Buildings", 0);
const resourceTabBtn = createTabBtn("Resources", 0.5);

// Container for lists
const listContainer = new Instance("Frame");
listContainer.Name = "ListContainer";
listContainer.Size = new UDim2(1, 0, 1, -100);
listContainer.Position = new UDim2(0, 0, 0, 65);
listContainer.BackgroundTransparency = 1;
listContainer.Parent = mainSidebar;

const buildingList = new Instance("ScrollingFrame");
buildingList.Name = "BuildingList";
buildingList.Size = new UDim2(1, -10, 1, 0);
buildingList.Position = new UDim2(0, 5, 0, 0);
buildingList.BackgroundTransparency = 1;
buildingList.AutomaticCanvasSize = Enum.AutomaticSize.Y;
buildingList.CanvasSize = new UDim2(0, 0, 0, 0);
buildingList.ScrollBarThickness = 6;
buildingList.Visible = true;
buildingList.Parent = listContainer;

const resourceList = new Instance("ScrollingFrame");
resourceList.Name = "ResourceList";
resourceList.Size = new UDim2(1, -10, 1, 0);
resourceList.Position = new UDim2(0, 5, 0, 0);
resourceList.BackgroundTransparency = 1;
resourceList.AutomaticCanvasSize = Enum.AutomaticSize.Y;
resourceList.CanvasSize = new UDim2(0, 0, 0, 0);
resourceList.ScrollBarThickness = 6;
resourceList.Visible = false;
resourceList.Parent = listContainer;

// Function to refresh the building list
const refreshBuildingList = () => {
	buildingList.ClearAllChildren();

	const listLayout = new Instance("UIListLayout");
	listLayout.Padding = new UDim(0, 5);
	listLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	listLayout.Parent = buildingList;

	const foldersToCheck = ["Towns", "Buildings"];
	let itemCount = 0;

	for (const folderName of foldersToCheck) {
		const folder = game.Workspace.FindFirstChild(folderName);
		if (!folder) continue;

		for (const building of folder.GetChildren()) {
			if (building.IsA("Model")) {
				const ownerId = building.GetAttribute("OwnerId") as number | undefined;
				if (ownerId !== player.UserId) continue; // Only show OUR buildings

				const buildingName = building.Name.lower();
				const [foundFoundation] = buildingName.find("foundation");
				if (foundFoundation !== undefined) continue;

				const [foundTown] = buildingName.find("town");
				const [foundCity] = buildingName.find("city");

				// Only show Towns and Cities
				if (foundTown === undefined && foundCity === undefined) continue;

				const isCity = foundCity !== undefined;
				const icon = isCity ? "🏙️" : "🏠";

				const btn = new Instance("TextButton");
				btn.Name = building.Name;
				btn.Size = new UDim2(1, -10, 0, 35);
				btn.BackgroundColor3 = Color3.fromRGB(60, 100, 60);
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
						const buildingPos = building.PrimaryPart.Position;
						camera.CameraType = Enum.CameraType.Scriptable;
						const targetCFrame = CFrame.lookAt(buildingPos.add(new Vector3(30, 20, 30)), buildingPos);
						game.GetService("TweenService").Create(camera, new TweenInfo(0.5), { CFrame: targetCFrame }).Play();
					}
				});
			}
		}
	}

	if (itemCount === 0) {
		const placeholder = new Instance("TextLabel");
		placeholder.Size = new UDim2(1, -10, 0, 50);
		placeholder.BackgroundTransparency = 1;
		placeholder.Text = "No buildings found.";
		placeholder.TextColor3 = Color3.fromRGB(150, 150, 150);
		placeholder.Font = Enum.Font.Gotham;
		placeholder.TextSize = 12;
		placeholder.Parent = buildingList;
	}
};

const refreshResourceList = () => {
	resourceList.ClearAllChildren();

	const listLayout = new Instance("UIListLayout");
	listLayout.Padding = new UDim(0, 5);
	listLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	listLayout.Parent = resourceList;

	const resourcesFolder = game.Workspace.FindFirstChild("Resources");
	let itemCount = 0;

	if (resourcesFolder) {
		for (const res of resourcesFolder.GetChildren()) {
			if (res.IsA("BasePart")) {
				const ownerId = res.GetAttribute("OwnerId") as number | undefined;
				if (ownerId !== player.UserId) continue; // Only show OUR resources

				const resType = res.GetAttribute("ResourceType") as string ?? "Resource";
				const icons: Record<string, string> = { Wood: "🌲", Brick: "🧱", Wheat: "🌾", Ore: "⛏", Wool: "🧶" };
				const icon = icons[resType] ?? "📦";

				const btn = new Instance("TextButton");
				btn.Name = res.Name;
				btn.Size = new UDim2(1, -10, 0, 35);
				btn.BackgroundColor3 = Color3.fromRGB(60, 60, 100);
				btn.Text = `${icon} ${resType}`;
				btn.TextColor3 = new Color3(1, 1, 1);
				btn.Font = Enum.Font.GothamBold;
				btn.TextSize = 14;
				btn.Parent = resourceList;
				itemCount++;

				const corner = new Instance("UICorner");
				corner.CornerRadius = new UDim(0, 4);
				corner.Parent = btn;

				btn.MouseButton1Click.Connect(() => {
					const camera = game.Workspace.CurrentCamera;
					if (camera) {
						camera.CameraType = Enum.CameraType.Scriptable;
						const targetCFrame = CFrame.lookAt(res.Position.add(new Vector3(15, 15, 15)), res.Position);
						game.GetService("TweenService").Create(camera, new TweenInfo(0.5), { CFrame: targetCFrame }).Play();
					}
				});
			}
		}
	}

	if (itemCount === 0) {
		const placeholder = new Instance("TextLabel");
		placeholder.Size = new UDim2(1, -10, 0, 50);
		placeholder.BackgroundTransparency = 1;
		placeholder.Text = "No dropped resources.";
		placeholder.TextColor3 = Color3.fromRGB(150, 150, 150);
		placeholder.Font = Enum.Font.Gotham;
		placeholder.TextSize = 12;
		placeholder.Parent = resourceList;
	}
};

const updateTabs = () => {
	buildingTabBtn.BackgroundColor3 = currentTab === "Buildings" ? Color3.fromRGB(80, 80, 80) : Color3.fromRGB(40, 40, 40);
	resourceTabBtn.BackgroundColor3 = currentTab === "Resources" ? Color3.fromRGB(80, 80, 80) : Color3.fromRGB(40, 40, 40);
	buildingList.Visible = currentTab === "Buildings";
	resourceList.Visible = currentTab === "Resources";
};

buildingTabBtn.MouseButton1Click.Connect(() => { currentTab = "Buildings"; updateTabs(); });
resourceTabBtn.MouseButton1Click.Connect(() => { currentTab = "Resources"; updateTabs(); });
updateTabs();

const resetCamBtn = new Instance("TextButton");
resetCamBtn.Name = "ResetCamera";
resetCamBtn.Size = new UDim2(1, -10, 0, 30);
resetCamBtn.Position = new UDim2(0, 5, 1, -35);
resetCamBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 60);
resetCamBtn.Text = "Reset Focus";
resetCamBtn.TextColor3 = new Color3(1, 1, 1);
resetCamBtn.Font = Enum.Font.GothamBold;
resetCamBtn.TextSize = 14;
resetCamBtn.Parent = mainSidebar;

const btnCorner = new Instance("UICorner");
btnCorner.CornerRadius = new UDim(0, 4);
btnCorner.Parent = resetCamBtn;

resetCamBtn.MouseButton1Click.Connect(() => {
	const camera = game.Workspace.CurrentCamera;
	const character = player.Character;
	if (camera && character) {
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			camera.CameraType = Enum.CameraType.Custom;
			camera.CameraSubject = humanoid;
		}
	}
});

// Periodically refresh the list
task.spawn(() => {
	while (true) {
		refreshBuildingList();
		refreshResourceList();
		task.wait(2); // Slightly faster refresh
	}
});

// Also refresh when buildings are added/removed
const setupFolderListeners = (folderName: string) => {
	const folder = game.Workspace.WaitForChild(folderName, 30);
	if (folder) {
		folder.ChildAdded.Connect(() => refreshBuildingList());
		folder.ChildRemoved.Connect(() => refreshBuildingList());
		Logger.Info("UIManager", `Listening for changes in ${folderName} folder`);
	}
};

task.spawn(() => setupFolderListeners("Towns"));
task.spawn(() => setupFolderListeners("Buildings"));

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

MakeDraggable(helpFrame, helpTitle);

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

// System message handler (for Roblox's built-in chat)
const TextChatService = game.GetService("TextChatService");

// Get or wait for the RBXGeneral channel (the main chat channel)
let generalChannel: TextChannel | undefined;

task.spawn(() => {
	// Wait for TextChatService to be ready
	const textChannels = TextChatService.WaitForChild("TextChannels", 10) as Folder | undefined;
	if (textChannels) {
		generalChannel = textChannels.WaitForChild("RBXGeneral", 10) as TextChannel | undefined;
		if (generalChannel) {
			Logger.Info("UIManager", "TextChatService ready - RBXGeneral channel found");
		} else {
			Logger.Warn("UIManager", "RBXGeneral channel not found, trying RBXSystem...");
			generalChannel = textChannels.FindFirstChild("RBXSystem") as TextChannel | undefined;
		}
	} else {
		Logger.Warn("UIManager", "TextChannels folder not found in TextChatService");
	}
});

// Function to send system message to Roblox's built-in chat
const sendSystemMessage = (message: string) => {
	// Try TextChatService first (modern chat)
	if (generalChannel) {
		const [success] = pcall(() => {
			generalChannel!.DisplaySystemMessage(message);
		});
		if (success) {
			Logger.Debug("UIManager", `Sent to TextChatService: ${message}`);
			return true;
		}
	}

	// Fallback to legacy chat (StarterGui.SetCore)
	const StarterGui = game.GetService("StarterGui");
	const [success] = pcall(() => {
		StarterGui.SetCore("ChatMakeSystemMessage", {
			Text: message,
			Color: Color3.fromRGB(255, 215, 0), // Gold color
			Font: Enum.Font.GothamBold,
			TextSize: 16,
		});
	});

	if (success) {
		Logger.Debug("UIManager", `Sent to legacy chat: ${message}`);
	} else {
		Logger.Warn("UIManager", `Failed to send chat message: ${message}`);
	}

	return success;
};

ClientEvents.SystemMessageEvent.connect((message) => {
	sendSystemMessage(message);
});

Logger.Info("UIManager", "Initialized");

export = {
	SendSystemMessage: sendSystemMessage,
};
