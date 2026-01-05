// Client-side Trade UI for Port Trading System
const Players = game.GetService("Players");
const UserInputService = game.GetService("UserInputService");
import { ClientEvents } from "./ClientEvents";
import ResourceTypes from "shared/ResourceTypes";
import PortTypes, { DEFAULT_TRADE_RATIO } from "shared/PortTypes";
import { MarketOffer, ResourceDict } from "shared/MarketTypes";
import { ResourceType } from "shared/TradeMath";
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
let currentTab: "Port" | "Market" = "Port";
let activeMarketOffers: MarketOffer[] = [];
let localResources: Record<string, number> = {};
let updateMarketCallback: (() => void) | undefined;

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

	// Tab Buttons
	const portTab = new Instance("TextButton");
	portTab.Name = "PortTab";
	portTab.Size = new UDim2(0.5, 0, 0, 40);
	portTab.Position = new UDim2(0, 0, 0, 40);
	portTab.BackgroundColor3 = Color3.fromRGB(60, 60, 60);
	portTab.Text = "Port Trading";
	portTab.TextColor3 = Color3.fromRGB(255, 255, 255);
	portTab.Font = Enum.Font.GothamBold;
	portTab.TextSize = 16;
	portTab.Parent = tradeFrame;

	const marketTab = new Instance("TextButton");
	marketTab.Name = "MarketTab";
	marketTab.Size = new UDim2(0.5, 0, 0, 40);
	marketTab.Position = new UDim2(0.5, 0, 0, 40);
	marketTab.BackgroundColor3 = Color3.fromRGB(40, 40, 40);
	marketTab.Text = "Public Market";
	marketTab.TextColor3 = Color3.fromRGB(150, 150, 150);
	marketTab.Font = Enum.Font.GothamBold;
	marketTab.TextSize = 16;
	marketTab.Parent = tradeFrame;

	// Content areas
	const portContent = new Instance("Frame");
	portContent.Name = "PortContent";
	portContent.Size = new UDim2(1, 0, 1, -80);
	portContent.Position = new UDim2(0, 0, 0, 80);
	portContent.BackgroundTransparency = 1;
	portContent.Parent = tradeFrame;

	const marketFrame = new Instance("Frame");
	marketFrame.Name = "MarketFrame";
	marketFrame.Size = new UDim2(1, 0, 1, -80);
	marketFrame.Position = new UDim2(0, 0, 0, 80);
	marketFrame.BackgroundTransparency = 1;
	marketFrame.Visible = false;
	marketFrame.Parent = tradeFrame;

	// PORT TRADING ELEMENTS
	const infoLabel = new Instance("TextLabel");
	infoLabel.Name = "InfoLabel";
	infoLabel.Size = new UDim2(1, -20, 0, 60);
	infoLabel.Position = new UDim2(0, 10, 0, 10);
	infoLabel.BackgroundTransparency = 1;
	infoLabel.Text = "Select resources to trade.\nTrade ratios depend on your ports.";
	infoLabel.TextColor3 = Color3.fromRGB(200, 200, 200);
	infoLabel.Font = Enum.Font.Gotham;
	infoLabel.TextSize = 16;
	infoLabel.TextWrapped = true;
	infoLabel.TextYAlignment = Enum.TextYAlignment.Top;
	infoLabel.Parent = portContent;

	const giveLabel = new Instance("TextLabel");
	giveLabel.Name = "GiveLabel";
	giveLabel.Size = new UDim2(0, 150, 0, 25);
	giveLabel.Position = new UDim2(0, 20, 0, 50);
	giveLabel.BackgroundTransparency = 1;
	giveLabel.Text = "Give:";
	giveLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
	giveLabel.Font = Enum.Font.GothamBold;
	giveLabel.TextSize = 18;
	giveLabel.TextXAlignment = Enum.TextXAlignment.Left;
	giveLabel.Parent = portContent;

	const giveDropdown = createResourceDropdown("GiveDropdown", new UDim2(0, 20, 0, 80), portContent, (resource) => {
		currentGiveResource = resource;
		updateTradeInfo();
	});

	const receiveLabel = new Instance("TextLabel");
	receiveLabel.Name = "ReceiveLabel";
	receiveLabel.Size = new UDim2(0, 150, 0, 25);
	receiveLabel.Position = new UDim2(0, 20, 0, 150);
	receiveLabel.BackgroundTransparency = 1;
	receiveLabel.Text = "Receive:";
	receiveLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
	receiveLabel.Font = Enum.Font.GothamBold;
	receiveLabel.TextSize = 18;
	receiveLabel.TextXAlignment = Enum.TextXAlignment.Left;
	receiveLabel.Parent = portContent;

	const receiveDropdown = createResourceDropdown("ReceiveDropdown", new UDim2(0, 20, 0, 180), portContent, (resource) => {
		currentReceiveResource = resource;
		updateTradeInfo();
	});

	const ratioLabel = new Instance("TextLabel");
	ratioLabel.Name = "RatioLabel";
	ratioLabel.Size = new UDim2(1, -40, 0, 30);
	ratioLabel.Position = new UDim2(0, 20, 0, 250);
	ratioLabel.BackgroundColor3 = Color3.fromRGB(60, 60, 60);
	ratioLabel.BorderSizePixel = 2;
	ratioLabel.BorderColor3 = Color3.fromRGB(100, 100, 100);
	ratioLabel.Text = "Trade Ratio: 4:1 (Bank)";
	ratioLabel.TextColor3 = Color3.fromRGB(255, 200, 100);
	ratioLabel.Font = Enum.Font.GothamBold;
	ratioLabel.TextSize = 18;
	ratioLabel.Parent = portContent;

	const tradeButton = new Instance("TextButton");
	tradeButton.Name = "TradeButton";
	tradeButton.Size = new UDim2(1, -40, 0, 40);
	tradeButton.Position = new UDim2(0, 20, 0, 290);
	tradeButton.BackgroundColor3 = Color3.fromRGB(50, 150, 50);
	tradeButton.Text = "Execute Trade";
	tradeButton.TextColor3 = Color3.fromRGB(255, 255, 255);
	tradeButton.Font = Enum.Font.GothamBold;
	tradeButton.TextSize = 20;
	tradeButton.Parent = portContent;

	tradeButton.MouseButton1Click.Connect(() => {
		ClientEvents.ExecuteTrade.fire(currentGiveResource, currentReceiveResource, tradeAmount);
		Logger.Info("TradeUI", `Requesting trade: ${currentGiveResource} -> ${currentReceiveResource}`);
	});

	const harborMasterLabel = new Instance("TextLabel");
	harborMasterLabel.Name = "HarborMasterLabel";
	harborMasterLabel.Size = new UDim2(1, -40, 0, 25);
	harborMasterLabel.Position = new UDim2(0, 20, 0, 340);
	harborMasterLabel.BackgroundTransparency = 1;
	harborMasterLabel.Text = "";
	harborMasterLabel.TextColor3 = Color3.fromRGB(255, 215, 0);
	harborMasterLabel.Font = Enum.Font.GothamBold;
	harborMasterLabel.TextSize = 14;
	harborMasterLabel.Parent = portContent;

	const updateTradeInfo = () => {
		const ratio = getBestTradeRatio(currentGiveResource);
		const cost = ratio * tradeAmount;
		ratioLabel.Text = `Trade Ratio: ${ratio}:1 ${ratio === 4 ? "(Bank)" : ratio === 3 ? "(Generic Port)" : "(" + currentGiveResource + " Port)"}`;
		tradeButton.Text = `Trade ${cost} ${currentGiveResource} for ${tradeAmount} ${currentReceiveResource}`;
		harborMasterLabel.Text = harborMasterPoints > 0 ? `Ports owned: ${harborMasterPoints}` : "";
	};
	updateTradeInfo();

	// MARKET TRADING ELEMENTS
	const scrollList = new Instance("ScrollingFrame");
	scrollList.Name = "OfferList";
	scrollList.Size = new UDim2(1, -20, 0, 200);
	scrollList.Position = new UDim2(0, 10, 0, 10);
	scrollList.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
	scrollList.BorderSizePixel = 0;
	scrollList.CanvasSize = new UDim2(0, 0, 0, 0);
	scrollList.ScrollBarThickness = 6;
	scrollList.Parent = marketFrame;

	const postSection = new Instance("Frame");
	postSection.Name = "PostSection";
	postSection.Size = new UDim2(1, -20, 0, 150);
	postSection.Position = new UDim2(0, 10, 0, 220);
	postSection.BackgroundColor3 = Color3.fromRGB(45, 45, 45);
	postSection.BorderSizePixel = 0;
	postSection.Parent = marketFrame;

	const postTitle = new Instance("TextLabel");
	postTitle.Size = new UDim2(1, 0, 0, 30);
	postTitle.BackgroundTransparency = 1;
	postTitle.Text = "Post New Offer (Limit 3)";
	postTitle.TextColor3 = Color3.fromRGB(200, 200, 200);
	postTitle.Font = Enum.Font.GothamBold;
	postTitle.TextSize = 14;
	postTitle.Parent = postSection;

	let marketGiveCart: ResourceDict = {};
	let marketWantRes = "Brick";

	const pickers = new Instance("Frame");
	pickers.Size = new UDim2(1, 0, 0, 80);
	pickers.Position = new UDim2(0, 0, 0, 30);
	pickers.BackgroundTransparency = 1;
	pickers.Parent = postSection;

	const giveSide = new Instance("Frame");
	giveSide.Size = new UDim2(0.5, -5, 1, 0);
	giveSide.BackgroundTransparency = 1;
	giveSide.Parent = pickers;

	const cartIcons = new Instance("Frame");
	cartIcons.Size = new UDim2(1, -40, 0, 30);
	cartIcons.Position = new UDim2(0, 0, 0, 20);
	cartIcons.BackgroundTransparency = 1;
	cartIcons.Parent = giveSide;

	const updateCartUI = () => {
		cartIcons.ClearAllChildren();
		const l = new Instance("UIListLayout", cartIcons);
		l.FillDirection = Enum.FillDirection.Horizontal;
		l.Padding = new UDim(0, 2);

		let total = 0;
		for (const [res, amt] of pairs(marketGiveCart)) {
			if (amt > 0) {
				const label = new Instance("TextLabel");
				label.Size = new UDim2(0, 35, 1, 0);
				label.Text = `${amt}${ResourceTypes.Get(res as string)?.Icon}`;
				label.BackgroundColor3 = Color3.fromRGB(60, 60, 60);
				label.TextColor3 = Color3.fromRGB(255, 255, 255);
				label.Font = Enum.Font.GothamBold;
				label.TextSize = 14;
				label.Parent = cartIcons;
				total += (amt as number);
			}
		}
		if (total === 0) {
			const label = new Instance("TextLabel");
			label.Size = new UDim2(1, 0, 1, 0);
			label.Text = "Empty";
			label.TextColor3 = Color3.fromRGB(100, 100, 100);
			label.BackgroundTransparency = 1;
			label.Font = Enum.Font.Gotham;
			label.TextSize = 12;
			label.Parent = cartIcons;
		}
	};

	const resButtons = new Instance("Frame");
	resButtons.Size = new UDim2(1, 0, 0, 30);
	resButtons.Position = new UDim2(0, 0, 0, 50);
	resButtons.BackgroundTransparency = 1;
	resButtons.Parent = giveSide;
	const bl = new Instance("UIListLayout", resButtons);
	bl.FillDirection = Enum.FillDirection.Horizontal;
	bl.Padding = new UDim(0, 2);

	const resources = ["Wood", "Brick", "Wheat", "Wool", "Ore"];
	for (const res of resources) {
		const b = new Instance("TextButton");
		b.Size = new UDim2(0, 30, 1, 0);
		b.Text = ResourceTypes.Get(res)?.Icon ?? "";
		b.BackgroundColor3 = Color3.fromRGB(50, 50, 50);
		b.TextColor3 = Color3.fromRGB(255, 255, 255);
		b.Font = Enum.Font.Gotham;
		b.TextSize = 16;
		b.Parent = resButtons;
		b.MouseButton1Click.Connect(() => {
			marketGiveCart[res] = (marketGiveCart[res] ?? 0) + 1;
			updateCartUI();
		});
	}

	const clearBtn = new Instance("TextButton");
	clearBtn.Size = new UDim2(0, 40, 0, 20);
	clearBtn.Position = new UDim2(1, -40, 0, 0);
	clearBtn.Text = "Clear";
	clearBtn.BackgroundColor3 = Color3.fromRGB(100, 50, 50);
	clearBtn.TextColor3 = Color3.fromRGB(255, 255, 255);
	clearBtn.Font = Enum.Font.Gotham;
	clearBtn.TextSize = 10;
	clearBtn.Parent = giveSide;
	clearBtn.MouseButton1Click.Connect(() => {
		marketGiveCart = {};
		updateCartUI();
	});

	const wantSide = new Instance("Frame");
	wantSide.Size = new UDim2(0, 180, 1, 0);
	wantSide.Position = new UDim2(1, -180, 0, 0);
	wantSide.BackgroundTransparency = 1;
	wantSide.Parent = pickers;

	createMarketPicker("You Want", new UDim2(0, 0, 0, 0), wantSide, (res) => (marketWantRes = res));

	const postBtn = new Instance("TextButton");
	postBtn.Size = new UDim2(1, -40, 0, 35);
	postBtn.Position = new UDim2(0, 20, 0, 110);
	postBtn.BackgroundColor3 = Color3.fromRGB(50, 100, 150);
	postBtn.Text = "Post Offer";
	postBtn.TextColor3 = Color3.fromRGB(255, 255, 255);
	postBtn.Font = Enum.Font.GothamBold;
	postBtn.TextSize = 16;
	postBtn.Parent = postSection;

	postBtn.MouseButton1Click.Connect(() => {
		let hasItems = false;
		for (const [_] of pairs(marketGiveCart)) { hasItems = true; break; }
		if (!hasItems) return;
		ClientEvents.PostMarketOffer.fire(marketGiveCart, marketWantRes, 1);
		marketGiveCart = {};
		updateCartUI();
	});

	const updateMarketList = () => {
		scrollList.ClearAllChildren();
		const layout = new Instance("UIListLayout", scrollList);
		layout.Padding = new UDim(0, 3);

		for (const offer of activeMarketOffers) {
			const item = new Instance("Frame");
			item.Size = new UDim2(1, -10, 0, 40);
			item.BackgroundColor3 = offer.posterId === player.UserId ? Color3.fromRGB(60, 70, 60) : Color3.fromRGB(50, 50, 50);
			item.BorderSizePixel = 0;
			item.Parent = scrollList;

			let giveStr = "";
			for (const [res, amt] of pairs(offer.giveResources)) {
				if ((amt as number) > 0) giveStr += `${amt}${ResourceTypes.Get(res as string)?.Icon} `;
			}

			const text = new Instance("TextLabel");
			text.Size = new UDim2(1, -90, 1, 0);
			text.Position = new UDim2(0, 5, 0, 0);
			text.BackgroundTransparency = 1;
			text.Text = `[${offer.posterName}] Give: ${giveStr} ↔ Want: ${offer.wantAmount}${ResourceTypes.Get(offer.wantType)?.Icon}`;
			text.TextColor3 = Color3.fromRGB(255, 255, 255);
			text.TextXAlignment = Enum.TextXAlignment.Left;
			text.Font = Enum.Font.Gotham;
			text.TextSize = 14;
			text.Parent = item;

			const canAccept = offer.posterId === player.UserId || (localResources[offer.wantType] ?? 0) >= offer.wantAmount;

			const actionBtn = new Instance("TextButton");
			actionBtn.Size = new UDim2(0, 80, 0, 30);
			actionBtn.Position = new UDim2(1, -85, 0, 5);

			if (offer.posterId === player.UserId) {
				actionBtn.BackgroundColor3 = Color3.fromRGB(150, 50, 50);
				actionBtn.Text = "Cancel";
			} else {
				actionBtn.BackgroundColor3 = canAccept ? Color3.fromRGB(50, 150, 50) : Color3.fromRGB(80, 80, 80);
				actionBtn.Text = "Accept";
				if (!canAccept) {
					item.BackgroundTransparency = 0.5;
					text.TextTransparency = 0.5;
					actionBtn.AutoButtonColor = false;
				}
			}

			actionBtn.TextColor3 = Color3.fromRGB(255, 255, 255);
			actionBtn.Font = Enum.Font.GothamBold;
			actionBtn.TextSize = 14;
			actionBtn.Parent = item;

			actionBtn.MouseButton1Click.Connect(() => {
				if (offer.posterId === player.UserId) {
					ClientEvents.CancelMarketOffer.fire(offer.id);
				} else if (canAccept) {
					ClientEvents.AcceptMarketOffer.fire(offer.id);
				}
			});
		}
		scrollList.CanvasSize = new UDim2(0, 0, 0, activeMarketOffers.size() * 45);
	};

	const switchTab = (tab: "Port" | "Market") => {
		currentTab = tab;
		portContent.Visible = tab === "Port";
		marketFrame.Visible = tab === "Market";
		portTab.BackgroundColor3 = tab === "Port" ? Color3.fromRGB(60, 60, 60) : Color3.fromRGB(40, 40, 40);
		portTab.TextColor3 = tab === "Port" ? Color3.fromRGB(255, 255, 255) : Color3.fromRGB(150, 150, 150);
		marketTab.BackgroundColor3 = tab === "Market" ? Color3.fromRGB(60, 60, 60) : Color3.fromRGB(40, 40, 40);
		marketTab.TextColor3 = tab === "Market" ? Color3.fromRGB(255, 255, 255) : Color3.fromRGB(150, 150, 150);
		if (tab === "Market") updateMarketList();
	};

	portTab.MouseButton1Click.Connect(() => switchTab("Port"));
	marketTab.MouseButton1Click.Connect(() => switchTab("Market"));
	updateCartUI();
	updateMarketCallback = updateMarketList;
	return tradeFrame;
};

const createMarketPicker = (label: string, pos: UDim2, parent: Frame, callback: (res: string) => void) => {
	const f = new Instance("Frame");
	f.Size = new UDim2(0, 170, 1, 0);
	f.Position = pos;
	f.BackgroundTransparency = 1;
	f.Parent = parent;
	const l = new Instance("TextLabel");
	l.Size = new UDim2(0, 60, 1, 0);
	l.Text = label + ":";
	l.TextColor3 = Color3.fromRGB(200, 200, 200);
	l.BackgroundTransparency = 1;
	l.Font = Enum.Font.Gotham;
	l.TextSize = 14;
	l.Parent = f;
	const btn = new Instance("TextButton");
	btn.Size = new UDim2(0, 100, 0, 40);
	btn.Position = new UDim2(0, 65, 0, 10);
	btn.BackgroundColor3 = Color3.fromRGB(70, 70, 70);
	btn.Text = "Wood 🪵";
	btn.TextColor3 = Color3.fromRGB(255, 255, 255);
	btn.Font = Enum.Font.GothamBold;
	btn.TextSize = 16;
	btn.Parent = f;
	let index = 0;
	const resList = ["Wood", "Brick", "Wheat", "Wool", "Ore"];
	btn.MouseButton1Click.Connect(() => {
		index = (index + 1) % resList.size();
		const res = resList[index];
		btn.Text = `${res} ${ResourceTypes.Get(res)?.Icon}`;
		callback(res);
	});
	return f;
};

const createResourceDropdown = (name: string, position: UDim2, parent: Frame, onChange: (resource: string) => void) => {
	const dropdown = new Instance("Frame");
	dropdown.Name = name;
	dropdown.Size = new UDim2(1, -40, 0, 50);
	dropdown.Position = position;
	dropdown.BackgroundColor3 = Color3.fromRGB(60, 60, 60);
	dropdown.BorderSizePixel = 2;
	dropdown.BorderColor3 = Color3.fromRGB(100, 100, 100);
	dropdown.Parent = parent;
	const layout = new Instance("UIListLayout", dropdown);
	layout.FillDirection = Enum.FillDirection.Horizontal;
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
	layout.VerticalAlignment = Enum.VerticalAlignment.Center;
	layout.Padding = new UDim(0, 5);
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

const getBestTradeRatio = (resourceType: string): number => {
	if (ownedPorts.includes(`${resourceType}Port`)) return 2;
	if (ownedPorts.includes("GenericPort")) return 3;
	return DEFAULT_TRADE_RATIO;
};

const tradeFrame = createTradeUI();
UserInputService.InputBegan.Connect((input, gameProcessed) => {
	if (gameProcessed) return;
	if (input.KeyCode === Enum.KeyCode.T && tradeFrame && isGameStarted) tradeFrame.Visible = !tradeFrame.Visible;
});

ClientEvents.PortClaimed.connect((portType) => {
	if (!ownedPorts.includes(portType)) {
		ownedPorts.push(portType);
		Logger.Info("TradeUI", `Port claimed: ${portType}`);
	}
});

ClientEvents.HarborMasterUpdate.connect((points) => {
	harborMasterPoints = points;
});

ClientEvents.MarketUpdate.connect((offers) => {
	activeMarketOffers = offers;
	if (updateMarketCallback) updateMarketCallback();
});

ClientEvents.ResourceUpdate.connect((resources) => {
	localResources = resources as Record<string, number>;
	if (updateMarketCallback && currentTab === "Market") updateMarketCallback();
});

// Request initial inventory
task.delay(1, () => {
	ClientEvents.RequestInventory.fire();
});

Logger.Info("TradeUI", "Trade UI initialized! Press T to open trade menu");
export { };
