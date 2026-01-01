// Port types for trading system (Catan-style)

type PortInfo = {
	Name: string;
	Type: "Generic" | "Specialized";
	Resource?: string; // For specialized ports (e.g., "Wood", "Brick")
	TradeRatio: number; // Input:Output ratio (e.g., 3:1 = 3, 2:1 = 2)
	Icon: string;
	Description: string;
	Color: Color3;
};

const PortTypes: Record<string, PortInfo> = {
	GenericPort: {
		Name: "Generic Port",
		Type: "Generic",
		TradeRatio: 3,
		Icon: "❓",
		Description: "Trade 3 of any one resource for 1 of any other resource",
		Color: Color3.fromRGB(150, 150, 150),
	},
	WoodPort: {
		Name: "Wood Port",
		Type: "Specialized",
		Resource: "Wood",
		TradeRatio: 2,
		Icon: "🌲",
		Description: "Trade 2 Wood for 1 of any other resource",
		Color: Color3.fromRGB(139, 90, 43),
	},
	BrickPort: {
		Name: "Brick Port",
		Type: "Specialized",
		Resource: "Brick",
		TradeRatio: 2,
		Icon: "🧱",
		Description: "Trade 2 Brick for 1 of any other resource",
		Color: Color3.fromRGB(178, 102, 59),
	},
	WheatPort: {
		Name: "Wheat Port",
		Type: "Specialized",
		Resource: "Wheat",
		TradeRatio: 2,
		Icon: "🌾",
		Description: "Trade 2 Wheat for 1 of any other resource",
		Color: Color3.fromRGB(218, 165, 32),
	},
	OrePort: {
		Name: "Ore Port",
		Type: "Specialized",
		Resource: "Ore",
		TradeRatio: 2,
		Icon: "⛏",
		Description: "Trade 2 Ore for 1 of any other resource",
		Color: Color3.fromRGB(105, 105, 105),
	},
	WoolPort: {
		Name: "Wool Port",
		Type: "Specialized",
		Resource: "Wool",
		TradeRatio: 2,
		Icon: "🧶",
		Description: "Trade 2 Wool for 1 of any other resource",
		Color: Color3.fromRGB(245, 245, 245),
	},
};

// Standard port configuration (9 ports total)
const StandardPortConfiguration = [
	"WoodPort",
	"BrickPort",
	"WheatPort",
	"OrePort",
	"WoolPort",
	"GenericPort",
	"GenericPort",
	"GenericPort",
	"GenericPort",
];

// Default trade ratio without a port
const DEFAULT_TRADE_RATIO = 4;

export type { PortInfo };
export { StandardPortConfiguration, DEFAULT_TRADE_RATIO };
export default PortTypes;
