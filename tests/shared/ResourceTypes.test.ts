
// 1. Define Mocks locally
const pairsMock = <T>(obj: Record<string, T> | T[]): [string, T][] => {
	if (Array.isArray(obj)) {
		return obj.map((v, i) => [String(i + 1), v]);
	}
	return Object.entries(obj) as [string, T][];
};

const typeIsMock = (val: any, type: string) => {
	if (type === "table") {
		return typeof val === "object" && val !== null;
	}
	if (type === "string") {
		return typeof val === "string";
	}
	if (type === "number") {
		return typeof val === "number";
	}
	return false;
};

class Color3Mock {
	constructor(public r: number, public g: number, public b: number) {}
	static fromRGB(r: number, g: number, b: number) {
		return new Color3Mock(r / 255, g / 255, b / 255);
	}
}

const EnumMock = {
	Material: {
		Brick: "Brick",
		Wood: "Wood",
		Grass: "Grass",
		Slate: "Slate",
		SmoothPlastic: "SmoothPlastic",
	},
};

const tupleMock = <T extends any[]>(...args: T): T => args;

// 2. Assign to global before ANY imports
(global as any).pairs = pairsMock;
(global as any).typeIs = typeIsMock;
(global as any).Color3 = Color3Mock;
(global as any).Enum = EnumMock;
(global as any).$tuple = tupleMock;

// 3. Import Vitest
import { describe, it, expect, beforeAll } from "vitest";

describe("ResourceTypes", () => {
	let ResourceTypes: any;

	beforeAll(async () => {
		// Dynamic import ensures this runs after globals are set
		const module = await import("../../src/shared/ResourceTypes");
		ResourceTypes = module.default;
	});

	it("should have valid base resources", () => {
		expect(ResourceTypes.Brick).toBeDefined();
		expect(ResourceTypes.Wood).toBeDefined();
		expect(ResourceTypes.Wheat).toBeDefined();
		expect(ResourceTypes.Ore).toBeDefined();
		expect(ResourceTypes.Wool).toBeDefined();
	});

	describe("GetByTileType", () => {
		it("should return correct resource for Hills", () => {
			const [key, data] = ResourceTypes.GetByTileType("Hills");
			expect(key).toBe("Brick");
			expect(data).toBeDefined();
			expect(data.Name).toBe("Brick");
		});

		it("should return correct resource for Forest", () => {
			const [key, data] = ResourceTypes.GetByTileType("Forest");
			expect(key).toBe("Wood");
			expect(data).toBeDefined();
			expect(data.Name).toBe("Wood");
		});

		it("should return undefined for invalid tile type", () => {
			const [key, data] = ResourceTypes.GetByTileType("Invalid");
			expect(key).toBeUndefined();
			expect(data).toBeUndefined();
		});
	});
});
