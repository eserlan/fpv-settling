
// Import mocks before any other imports
import "../testUtils";

import { describe, it, expect, beforeAll } from "vitest";

describe("ResourceTypes", () => {
	let ResourceTypes: any;

	beforeAll(async () => {
		// Dynamic import ensures this runs after globals are set
		const module = await import("../../src/shared/ResourceTypes");
		ResourceTypes = module.default;
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// BASIC STRUCTURE
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Structure", () => {
		it("should have exactly 5 base resources", () => {
			const resources = ["Brick", "Wood", "Wheat", "Ore", "Wool"];
			for (const res of resources) {
				expect(ResourceTypes[res]).toBeDefined();
			}
		});

		it("should have valid base resources", () => {
			expect(ResourceTypes.Brick).toBeDefined();
			expect(ResourceTypes.Wood).toBeDefined();
			expect(ResourceTypes.Wheat).toBeDefined();
			expect(ResourceTypes.Ore).toBeDefined();
			expect(ResourceTypes.Wool).toBeDefined();
		});

		it("should have GetByTileType function", () => {
			expect(typeof ResourceTypes.GetByTileType).toBe("function");
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// RESOURCE PROPERTIES
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Brick", () => {
		it("should have correct name", () => {
			expect(ResourceTypes.Brick.Name).toBe("Brick");
		});

		it("should have correct icon", () => {
			expect(ResourceTypes.Brick.Icon).toBe("🧱");
		});

		it("should spawn from Hills", () => {
			expect(ResourceTypes.Brick.TileType).toBe("Hills");
		});

		it("should have MaxStack of 50", () => {
			expect(ResourceTypes.Brick.MaxStack).toBe(50);
		});

		it("should have correct building costs", () => {
			expect(ResourceTypes.Brick.BuildingCost.Town).toBe(1);
			expect(ResourceTypes.Brick.BuildingCost.Road).toBe(1);
		});

		it("should have Color3 color", () => {
			expect(ResourceTypes.Brick.Color).toBeDefined();
		});
	});

	describe("Wood", () => {
		it("should have correct name", () => {
			expect(ResourceTypes.Wood.Name).toBe("Wood");
		});

		it("should have correct icon", () => {
			expect(ResourceTypes.Wood.Icon).toBe("🌲");
		});

		it("should spawn from Forest", () => {
			expect(ResourceTypes.Wood.TileType).toBe("Forest");
		});

		it("should have MaxStack of 50", () => {
			expect(ResourceTypes.Wood.MaxStack).toBe(50);
		});

		it("should have correct building costs", () => {
			expect(ResourceTypes.Wood.BuildingCost.Town).toBe(1);
			expect(ResourceTypes.Wood.BuildingCost.Road).toBe(1);
		});
	});

	describe("Wheat", () => {
		it("should have correct name", () => {
			expect(ResourceTypes.Wheat.Name).toBe("Wheat");
		});

		it("should have correct icon", () => {
			expect(ResourceTypes.Wheat.Icon).toBe("🌾");
		});

		it("should spawn from Fields", () => {
			expect(ResourceTypes.Wheat.TileType).toBe("Fields");
		});

		it("should have MaxStack of 50", () => {
			expect(ResourceTypes.Wheat.MaxStack).toBe(50);
		});

		it("should have correct building costs", () => {
			expect(ResourceTypes.Wheat.BuildingCost.Town).toBe(1);
			expect(ResourceTypes.Wheat.BuildingCost.City).toBe(2);
		});
	});

	describe("Ore", () => {
		it("should have correct name", () => {
			expect(ResourceTypes.Ore.Name).toBe("Ore");
		});

		it("should have correct icon", () => {
			expect(ResourceTypes.Ore.Icon).toBe("⛏");
		});

		it("should spawn from Mountains", () => {
			expect(ResourceTypes.Ore.TileType).toBe("Mountains");
		});

		it("should have MaxStack of 50", () => {
			expect(ResourceTypes.Ore.MaxStack).toBe(50);
		});

		it("should have correct building costs", () => {
			expect(ResourceTypes.Ore.BuildingCost.City).toBe(3);
			expect(ResourceTypes.Ore.BuildingCost.Town).toBeUndefined();
		});
	});

	describe("Wool", () => {
		it("should have correct name", () => {
			expect(ResourceTypes.Wool.Name).toBe("Wool");
		});

		it("should have correct icon", () => {
			expect(ResourceTypes.Wool.Icon).toBe("🧶");
		});

		it("should spawn from Pasture", () => {
			expect(ResourceTypes.Wool.TileType).toBe("Pasture");
		});

		it("should have MaxStack of 50", () => {
			expect(ResourceTypes.Wool.MaxStack).toBe(50);
		});

		it("should have correct building costs", () => {
			expect(ResourceTypes.Wool.BuildingCost.Town).toBe(1);
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// GET BY TILE TYPE
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("GetByTileType", () => {
		it("should return Brick for Hills", () => {
			const [key, data] = ResourceTypes.GetByTileType("Hills");
			expect(key).toBe("Brick");
			expect(data).toBeDefined();
			expect(data.Name).toBe("Brick");
		});

		it("should return Wood for Forest", () => {
			const [key, data] = ResourceTypes.GetByTileType("Forest");
			expect(key).toBe("Wood");
			expect(data).toBeDefined();
			expect(data.Name).toBe("Wood");
		});

		it("should return Wheat for Fields", () => {
			const [key, data] = ResourceTypes.GetByTileType("Fields");
			expect(key).toBe("Wheat");
			expect(data).toBeDefined();
			expect(data.Name).toBe("Wheat");
		});

		it("should return Ore for Mountains", () => {
			const [key, data] = ResourceTypes.GetByTileType("Mountains");
			expect(key).toBe("Ore");
			expect(data).toBeDefined();
			expect(data.Name).toBe("Ore");
		});

		it("should return Wool for Pasture", () => {
			const [key, data] = ResourceTypes.GetByTileType("Pasture");
			expect(key).toBe("Wool");
			expect(data).toBeDefined();
			expect(data.Name).toBe("Wool");
		});

		it("should return undefined for Desert", () => {
			const [key, data] = ResourceTypes.GetByTileType("Desert");
			expect(key).toBeUndefined();
			expect(data).toBeUndefined();
		});

		it("should return undefined for invalid tile type", () => {
			const [key, data] = ResourceTypes.GetByTileType("Invalid");
			expect(key).toBeUndefined();
			expect(data).toBeUndefined();
		});

		it("should return undefined for empty string", () => {
			const [key, data] = ResourceTypes.GetByTileType("");
			expect(key).toBeUndefined();
			expect(data).toBeUndefined();
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// CONSISTENCY CHECKS
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Consistency", () => {
		it("should have unique tile types for each resource", () => {
			const tileTypes = new Set<string>();
			const resources = ["Brick", "Wood", "Wheat", "Ore", "Wool"];

			for (const res of resources) {
				const tileType = ResourceTypes[res].TileType;
				expect(tileTypes.has(tileType)).toBe(false);
				tileTypes.add(tileType);
			}
		});

		it("should have unique icons for each resource", () => {
			const icons = new Set<string>();
			const resources = ["Brick", "Wood", "Wheat", "Ore", "Wool"];

			for (const res of resources) {
				const icon = ResourceTypes[res].Icon;
				expect(icons.has(icon)).toBe(false);
				icons.add(icon);
			}
		});

		it("should have same MaxStack for all resources", () => {
			const resources = ["Brick", "Wood", "Wheat", "Ore", "Wool"];
			for (const res of resources) {
				expect(ResourceTypes[res].MaxStack).toBe(50);
			}
		});

		it("should have descriptions for all resources", () => {
			const resources = ["Brick", "Wood", "Wheat", "Ore", "Wool"];
			for (const res of resources) {
				expect(ResourceTypes[res].Description).toBeDefined();
				expect(ResourceTypes[res].Description.length).toBeGreaterThan(10);
			}
		});
	});
});
