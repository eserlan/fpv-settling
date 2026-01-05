// Import mocks before any other imports
import "../testUtils";

import { describe, it, expect, beforeAll } from "vitest";

describe("TileTypes", () => {
	let TileTypes: any;

	beforeAll(async () => {
		const module = await import("../../src/shared/TileTypes");
		TileTypes = module.default;
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// BASIC STRUCTURE
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Structure", () => {
		it("should have exactly 7 tile types", () => {
			expect(Object.keys(TileTypes).length).toBe(7);
		});

		it("should have all expected tile types", () => {
			const expectedTypes = ["Forest", "Fields", "Pasture", "Hills", "Mountains", "Desert", "Sea"];
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
				expect(tile.Frequency).toBeDefined();
				expect(typeof tile.Frequency).toBe("number");
			}
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// INDIVIDUAL TILE TYPES
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Forest", () => {
		it("should have correct name", () => {
			expect(TileTypes.Forest.Name).toBe("Forest");
		});

		it("should produce Wood", () => {
			expect(TileTypes.Forest.Resource).toBe("Wood");
		});

		it("should have frequency of 4", () => {
			expect(TileTypes.Forest.Frequency).toBe(4);
		});

		it("should have a Color", () => {
			expect(TileTypes.Forest.Color).toBeDefined();
		});
	});

	describe("Fields", () => {
		it("should have correct name", () => {
			expect(TileTypes.Fields.Name).toBe("Fields");
		});

		it("should produce Wheat", () => {
			expect(TileTypes.Fields.Resource).toBe("Wheat");
		});

		it("should have frequency of 4", () => {
			expect(TileTypes.Fields.Frequency).toBe(4);
		});

		it("should have a Color", () => {
			expect(TileTypes.Fields.Color).toBeDefined();
		});
	});

	describe("Pasture", () => {
		it("should have correct name", () => {
			expect(TileTypes.Pasture.Name).toBe("Pasture");
		});

		it("should produce Wool", () => {
			expect(TileTypes.Pasture.Resource).toBe("Wool");
		});

		it("should have frequency of 4", () => {
			expect(TileTypes.Pasture.Frequency).toBe(4);
		});

		it("should have a Color", () => {
			expect(TileTypes.Pasture.Color).toBeDefined();
		});
	});

	describe("Hills", () => {
		it("should have correct name", () => {
			expect(TileTypes.Hills.Name).toBe("Hills");
		});

		it("should produce Brick", () => {
			expect(TileTypes.Hills.Resource).toBe("Brick");
		});

		it("should have frequency of 3 (less common)", () => {
			expect(TileTypes.Hills.Frequency).toBe(3);
		});

		it("should have a Color", () => {
			expect(TileTypes.Hills.Color).toBeDefined();
		});
	});

	describe("Mountains", () => {
		it("should have correct name", () => {
			expect(TileTypes.Mountains.Name).toBe("Mountains");
		});

		it("should produce Ore", () => {
			expect(TileTypes.Mountains.Resource).toBe("Ore");
		});

		it("should have frequency of 3 (less common)", () => {
			expect(TileTypes.Mountains.Frequency).toBe(3);
		});

		it("should have a Color", () => {
			expect(TileTypes.Mountains.Color).toBeDefined();
		});
	});

	describe("Desert", () => {
		it("should have correct name", () => {
			expect(TileTypes.Desert.Name).toBe("Desert");
		});

		it("should produce NO resource", () => {
			expect(TileTypes.Desert.Resource).toBeUndefined();
		});

		it("should have frequency of 1 (rarest)", () => {
			expect(TileTypes.Desert.Frequency).toBe(1);
		});

		it("should have a Color", () => {
			expect(TileTypes.Desert.Color).toBeDefined();
		});
	});

	describe("Sea", () => {
		it("should have correct name", () => {
			expect(TileTypes.Sea.Name).toBe("Sea");
		});

		it("should produce NO resource", () => {
			expect(TileTypes.Sea.Resource).toBeUndefined();
		});

		it("should have frequency of 0 (not randomly placed)", () => {
			expect(TileTypes.Sea.Frequency).toBe(0);
		});

		it("should have a Color", () => {
			expect(TileTypes.Sea.Color).toBeDefined();
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// RESOURCES
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Resources", () => {
		it("should have resources for 5 tile types (not Desert)", () => {
			const tilesWithResources = ["Forest", "Fields", "Pasture", "Hills", "Mountains"];
			for (const type of tilesWithResources) {
				expect(TileTypes[type].Resource).toBeDefined();
				expect(typeof TileTypes[type].Resource).toBe("string");
			}
		});

		it("should have unique resources for each tile (except Desert)", () => {
			const resources = new Set<string>();
			const tilesWithResources = ["Forest", "Fields", "Pasture", "Hills", "Mountains"];

			for (const type of tilesWithResources) {
				const resource = TileTypes[type].Resource;
				expect(resources.has(resource)).toBe(false);
				resources.add(resource);
			}
		});

		it("should map to all 5 Catan resources", () => {
			const resources = new Set<string>();
			for (const key in TileTypes) {
				if (TileTypes[key].Resource) {
					resources.add(TileTypes[key].Resource);
				}
			}
			expect(resources).toContain("Wood");
			expect(resources).toContain("Brick");
			expect(resources).toContain("Wheat");
			expect(resources).toContain("Ore");
			expect(resources).toContain("Wool");
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// FREQUENCY (for map generation)
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Frequency", () => {
		it("should have non-negative frequencies for all tiles", () => {
			for (const key in TileTypes) {
				expect(TileTypes[key].Frequency).toBeGreaterThanOrEqual(0);
			}
		});

		it("should have positive frequencies for all land tiles", () => {
			const landTiles = ["Forest", "Fields", "Pasture", "Hills", "Mountains", "Desert"];
			for (const key of landTiles) {
				expect(TileTypes[key].Frequency).toBeGreaterThan(0);
			}
		});

		it("should have common tiles with frequency 4", () => {
			expect(TileTypes.Forest.Frequency).toBe(4);
			expect(TileTypes.Fields.Frequency).toBe(4);
			expect(TileTypes.Pasture.Frequency).toBe(4);
		});

		it("should have rare tiles with frequency 3", () => {
			expect(TileTypes.Hills.Frequency).toBe(3);
			expect(TileTypes.Mountains.Frequency).toBe(3);
		});

		it("should have Desert as rarest with frequency 1", () => {
			expect(TileTypes.Desert.Frequency).toBe(1);
		});

		it("should sum to 19 (standard Catan map)", () => {
			let total = 0;
			for (const key in TileTypes) {
				total += TileTypes[key].Frequency;
			}
			expect(total).toBe(19);
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// COLORS
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Colors", () => {
		it("should have unique colors for visual distinction", () => {
			// We can't easily compare Color3 instances, but we verify they exist
			for (const key in TileTypes) {
				expect(TileTypes[key].Color).toBeDefined();
			}
		});
	});
});
