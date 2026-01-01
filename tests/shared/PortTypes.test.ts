
// 1. Define Mocks locally
const pairsMock = <T>(obj: Record<string, T> | T[]): [string, T][] => {
	if (Array.isArray(obj)) {
		return obj.map((v, i) => [String(i + 1), v]);
	}
	return Object.entries(obj) as [string, T][];
};

class Color3Mock {
	constructor(public r: number, public g: number, public b: number) {}
	static fromRGB(r: number, g: number, b: number) {
		return new Color3Mock(r / 255, g / 255, b / 255);
	}
}

// 2. Assign to global before ANY imports
(global as any).pairs = pairsMock;
(global as any).Color3 = Color3Mock;

// 3. Import Vitest
import { describe, it, expect, beforeAll } from "vitest";

describe("PortTypes", () => {
	let PortTypes: any;
	let StandardPortConfiguration: any;
	let DEFAULT_TRADE_RATIO: any;

	beforeAll(async () => {
		// Dynamic import ensures this runs after globals are set
		const module = await import("../../src/shared/PortTypes");
		PortTypes = module.default;
		StandardPortConfiguration = module.StandardPortConfiguration;
		DEFAULT_TRADE_RATIO = module.DEFAULT_TRADE_RATIO;
	});

	it("should have valid port types", () => {
		expect(PortTypes.GenericPort).toBeDefined();
		expect(PortTypes.WoodPort).toBeDefined();
		expect(PortTypes.BrickPort).toBeDefined();
		expect(PortTypes.WheatPort).toBeDefined();
		expect(PortTypes.OrePort).toBeDefined();
		expect(PortTypes.WoolPort).toBeDefined();
	});

	it("should have correct trade ratios", () => {
		expect(PortTypes.GenericPort.TradeRatio).toBe(3);
		expect(PortTypes.WoodPort.TradeRatio).toBe(2);
		expect(PortTypes.BrickPort.TradeRatio).toBe(2);
		expect(PortTypes.WheatPort.TradeRatio).toBe(2);
		expect(PortTypes.OrePort.TradeRatio).toBe(2);
		expect(PortTypes.WoolPort.TradeRatio).toBe(2);
	});

	it("should have correct port types", () => {
		expect(PortTypes.GenericPort.Type).toBe("Generic");
		expect(PortTypes.WoodPort.Type).toBe("Specialized");
		expect(PortTypes.BrickPort.Type).toBe("Specialized");
	});

	it("should have correct resource assignments for specialized ports", () => {
		expect(PortTypes.WoodPort.Resource).toBe("Wood");
		expect(PortTypes.BrickPort.Resource).toBe("Brick");
		expect(PortTypes.WheatPort.Resource).toBe("Wheat");
		expect(PortTypes.OrePort.Resource).toBe("Ore");
		expect(PortTypes.WoolPort.Resource).toBe("Wool");
		expect(PortTypes.GenericPort.Resource).toBeUndefined();
	});

	it("should have standard port configuration with 9 ports", () => {
		expect(StandardPortConfiguration).toHaveLength(9);
	});

	it("should have 5 specialized ports in standard configuration", () => {
		const specialized = StandardPortConfiguration.filter((port: string) => 
			port !== "GenericPort"
		);
		expect(specialized).toHaveLength(5);
	});

	it("should have 4 generic ports in standard configuration", () => {
		const generic = StandardPortConfiguration.filter((port: string) => 
			port === "GenericPort"
		);
		expect(generic).toHaveLength(4);
	});

	it("should have default trade ratio of 4:1", () => {
		expect(DEFAULT_TRADE_RATIO).toBe(4);
	});

	it("should have all required port properties", () => {
		for (const [key, port] of Object.entries(PortTypes)) {
			expect(port).toHaveProperty("Name");
			expect(port).toHaveProperty("Type");
			expect(port).toHaveProperty("TradeRatio");
			expect(port).toHaveProperty("Icon");
			expect(port).toHaveProperty("Description");
			expect(port).toHaveProperty("Color");
		}
	});
});
