
// 1. Define Mocks locally
class Color3Mock {
	constructor(public r: number, public g: number, public b: number) {}
	static fromHex(hex: string) {
		return new Color3Mock(0, 0, 0);
	}
}

// 2. Assign to global before ANY imports
(global as any).Color3 = Color3Mock;

// 3. Import Vitest
import { describe, it, expect, beforeAll } from "vitest";

describe("TileTypes", () => {
	let TileTypes: any;

	beforeAll(async () => {
		const module = await import("../../src/shared/TileTypes");
		TileTypes = module.default;
	});

	it("should have valid tile definitions", () => {
		expect(TileTypes).toBeDefined();
		expect(Object.keys(TileTypes).length).toBeGreaterThan(0);
	});

	it("should have all expected tile types", () => {
		const expectedTypes = ["Forest", "Fields", "Pasture", "Hills", "Mountains", "Desert"];
		for (const type of expectedTypes) {
			expect(TileTypes[type]).toBeDefined();
		}
	});

	it("should have required properties for all tiles", () => {
		for (const key in TileTypes) {
			const tile = TileTypes[key];
			expect(tile.Name).toBeDefined();
			expect(typeof tile.Name).toBe("string");

			expect(tile.Color).toBeDefined();
			expect(tile.Color).toBeInstanceOf(Color3Mock);

			expect(tile.Frequency).toBeDefined();
			expect(typeof tile.Frequency).toBe("number");
			expect(tile.Frequency).toBeGreaterThan(0);
		}
	});

	it("should have valid resources", () => {
		const tilesWithResources = ["Forest", "Fields", "Pasture", "Hills", "Mountains"];
		for (const type of tilesWithResources) {
			expect(TileTypes[type].Resource).toBeDefined();
			expect(typeof TileTypes[type].Resource).toBe("string");
		}

		expect(TileTypes.Desert.Resource).toBeUndefined();
	});
});
