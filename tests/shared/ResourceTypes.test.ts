// Mock Roblox globals BEFORE imports
class Color3Mock {
	static fromRGB(r: number, g: number, b: number) {
		return { r, g, b };
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

const pairsMock = <T>(obj: Record<string, T> | T[]): [string, T][] => {
	if (Array.isArray(obj)) {
		return obj.map((v, i) => [String(i + 1), v]);
	}
	return Object.entries(obj) as [string, T][];
};

const typeIsMock = (value: any, type: string) => {
	if (type === "table") return typeof value === "object" && value !== null;
	return typeof value === type;
};

const tupleMock = (...args: any[]) => args;

(global as any).Color3 = Color3Mock;
(global as any).Enum = EnumMock;
(global as any).pairs = pairsMock;
(global as any).typeIs = typeIsMock;
(global as any).$tuple = tupleMock;

import { describe, it, expect, beforeAll } from "vitest";

describe("ResourceTypes", () => {
    let ResourceTypes: any;

    beforeAll(async () => {
        const module = await import("../../src/shared/ResourceTypes");
        ResourceTypes = module.default;
    });

	it("should have valid resource entries", () => {
		expect(ResourceTypes).toBeDefined();
		expect(ResourceTypes.Wood).toBeDefined();
		expect(ResourceTypes.Brick).toBeDefined();
		expect(ResourceTypes.Wheat).toBeDefined();
		expect(ResourceTypes.Ore).toBeDefined();
		expect(ResourceTypes.Wool).toBeDefined();
	});

	it("should have correct properties for Wood", () => {
		const wood = ResourceTypes.Wood;
		expect(wood.Name).toBe("Wood");
		expect(wood.Material).toBe("Wood");
		expect(wood.TileType).toBe("Forest");
	});

	it("should retrieve resource by tile type", () => {
		const [key, resource] = ResourceTypes.GetByTileType("Forest");
		expect(key).toBe("Wood");
		expect(resource).toBeDefined();
		expect(resource.Name).toBe("Wood");
	});

	it("should return undefined for unknown tile type", () => {
		const [key, resource] = ResourceTypes.GetByTileType("Unknown");
		expect(key).toBeUndefined();
		expect(resource).toBeUndefined();
	});

    it("should have valid colors", () => {
        for(const key in ResourceTypes) {
            // Skip the function
            if (typeof ResourceTypes[key] !== "function") {
               const resource = ResourceTypes[key];
               expect(resource.Color).toBeDefined();
               // We mocked color as {r, g, b}
               expect(resource.Color.r).toBeDefined();
            }
        }
    });
});
