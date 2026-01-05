// Import mocks before any other imports
import "../testUtils";

import { describe, it, expect, beforeAll } from "vitest";

describe("Blueprints", () => {
	let Blueprints: any;

	beforeAll(async () => {
		const module = await import("../../src/shared/Blueprints");
		Blueprints = module.default;
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// BUILDING DEFINITIONS
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Buildings", () => {
		it("should have all 3 building types defined", () => {
			expect(Blueprints.Buildings).toBeDefined();
			expect(Blueprints.Buildings["Town"]).toBeDefined();
			expect(Blueprints.Buildings["City"]).toBeDefined();
			expect(Blueprints.Buildings["Road"]).toBeDefined();
		});

		it("should have valid Town properties", () => {
			const town = Blueprints.Buildings["Town"];
			expect(town.Name).toBe("Town");
			expect(town.Icon).toBe("🏠");
			expect(town.PlacementType).toBe("3-way");
			expect(town.ClaimsTiles).toBe(true);
			expect(town.FirstIsFree).toBe(true);
		});

		it("should have valid City properties", () => {
			const city = Blueprints.Buildings["City"];
			expect(city.Name).toBe("City");
			expect(city.Icon).toBe("🏰");
			expect(city.PlacementType).toBe("upgrade");
			expect(city.RequiresExisting).toBe("Town");
			expect(city.ProductionMultiplier).toBe(2);
		});

		it("should have valid Road properties", () => {
			const road = Blueprints.Buildings["Road"];
			expect(road.Name).toBe("Road");
			expect(road.Icon).toBe("🛣️");
			expect(road.PlacementType).toBe("edge");
			expect(road.RequiresConnection).toBe(true);
		});

		it("should have Size as Vector3 for all buildings", () => {
			for (const name of ["Town", "City", "Road"]) {
				const building = Blueprints.Buildings[name];
				expect(building.Size).toBeDefined();
				expect(building.Size.x).toBeDefined();
				expect(building.Size.y).toBeDefined();
				expect(building.Size.z).toBeDefined();
			}
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// COSTS
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Building Costs", () => {
		it("should have correct Town cost (1 of each basic)", () => {
			const cost = Blueprints.Buildings["Town"].Cost;
			expect(cost.Wood).toBe(1);
			expect(cost.Brick).toBe(1);
			expect(cost.Wheat).toBe(1);
			expect(cost.Wool).toBe(1);
			expect(cost.Ore).toBeUndefined();
		});

		it("should have correct City cost (Wheat + Ore)", () => {
			const cost = Blueprints.Buildings["City"].Cost;
			expect(cost.Wheat).toBe(2);
			expect(cost.Ore).toBe(3);
			expect(cost.Wood).toBeUndefined();
			expect(cost.Brick).toBeUndefined();
			expect(cost.Wool).toBeUndefined();
		});

		it("should have correct Road cost (Wood + Brick)", () => {
			const cost = Blueprints.Buildings["Road"].Cost;
			expect(cost.Wood).toBe(1);
			expect(cost.Brick).toBe(1);
			expect(cost.Wheat).toBeUndefined();
			expect(cost.Ore).toBeUndefined();
			expect(cost.Wool).toBeUndefined();
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// GET COST STRING
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("GetCostString", () => {
		it("should return correct cost string for Road", () => {
			const costString = Blueprints.GetCostString("Road");
			expect(costString).toContain("🌲1");
			expect(costString).toContain("🧱1");
		});

		it("should return correct cost string for Town", () => {
			const costString = Blueprints.GetCostString("Town");
			expect(costString).toContain("🌲1");
			expect(costString).toContain("🧱1");
			expect(costString).toContain("🌾1");
			expect(costString).toContain("🧶1");
		});

		it("should return correct cost string for City", () => {
			const costString = Blueprints.GetCostString("City");
			expect(costString).toContain("🌾2");
			expect(costString).toContain("⛏3");
		});

		it("should return empty string for invalid blueprint", () => {
			expect(Blueprints.GetCostString("Invalid")).toBe("");
			expect(Blueprints.GetCostString("")).toBe("");
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// CAN AFFORD
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("CanAfford", () => {
		describe("Road affordability", () => {
			it("should return true if resources are exactly sufficient", () => {
				const resources = { Wood: 1, Brick: 1 };
				expect(Blueprints.CanAfford(resources, "Road")).toBe(true);
			});

			it("should return true if resources are more than enough", () => {
				const resources = { Wood: 5, Brick: 5 };
				expect(Blueprints.CanAfford(resources, "Road")).toBe(true);
			});

			it("should return false if missing Wood", () => {
				const resources = { Brick: 1 };
				expect(Blueprints.CanAfford(resources, "Road")).toBe(false);
			});

			it("should return false if missing Brick", () => {
				const resources = { Wood: 1 };
				expect(Blueprints.CanAfford(resources, "Road")).toBe(false);
			});

			it("should return false if both resources are 0", () => {
				const resources = { Wood: 0, Brick: 0 };
				expect(Blueprints.CanAfford(resources, "Road")).toBe(false);
			});
		});

		describe("Town affordability", () => {
			it("should return true with all 4 resources", () => {
				const resources = { Wood: 1, Brick: 1, Wheat: 1, Wool: 1 };
				expect(Blueprints.CanAfford(resources, "Town")).toBe(true);
			});

			it("should return false if missing any resource", () => {
				expect(Blueprints.CanAfford({ Brick: 1, Wheat: 1, Wool: 1 }, "Town")).toBe(false);
				expect(Blueprints.CanAfford({ Wood: 1, Wheat: 1, Wool: 1 }, "Town")).toBe(false);
				expect(Blueprints.CanAfford({ Wood: 1, Brick: 1, Wool: 1 }, "Town")).toBe(false);
				expect(Blueprints.CanAfford({ Wood: 1, Brick: 1, Wheat: 1 }, "Town")).toBe(false);
			});
		});

		describe("City affordability", () => {
			it("should return true with 2 Wheat and 3 Ore", () => {
				const resources = { Wheat: 2, Ore: 3 };
				expect(Blueprints.CanAfford(resources, "City")).toBe(true);
			});

			it("should return false with insufficient Wheat", () => {
				const resources = { Wheat: 1, Ore: 3 };
				expect(Blueprints.CanAfford(resources, "City")).toBe(false);
			});

			it("should return false with insufficient Ore", () => {
				const resources = { Wheat: 2, Ore: 2 };
				expect(Blueprints.CanAfford(resources, "City")).toBe(false);
			});
		});

		describe("Edge cases", () => {
			it("should return false for invalid blueprint", () => {
				const resources = { Wood: 100, Brick: 100, Wheat: 100, Ore: 100, Wool: 100 };
				expect(Blueprints.CanAfford(resources, "Invalid")).toBe(false);
			});

			it("should return false for empty resources", () => {
				expect(Blueprints.CanAfford({}, "Road")).toBe(false);
				expect(Blueprints.CanAfford({}, "Town")).toBe(false);
				expect(Blueprints.CanAfford({}, "City")).toBe(false);
			});
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// GET BLUEPRINT NAMES
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("GetBlueprintNames", () => {
		it("should return all 3 blueprint names", () => {
			const names = Blueprints.GetBlueprintNames();
			expect(names.length).toBe(3);
		});

		it("should contain all expected names", () => {
			const names = Blueprints.GetBlueprintNames();
			expect(names).toContain("Town");
			expect(names).toContain("City");
			expect(names).toContain("Road");
		});

		it("should return sorted names", () => {
			const names = Blueprints.GetBlueprintNames();
			const sorted = [...names].sort();
			expect(names).toEqual(sorted);
		});

		it("should return a new array each time", () => {
			const names1 = Blueprints.GetBlueprintNames();
			const names2 = Blueprints.GetBlueprintNames();
			expect(names1).not.toBe(names2);
			expect(names1).toEqual(names2);
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// RESOURCE ICONS
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("ResourceIcons", () => {
		it("should have all 5 resource icons", () => {
			const icons = Blueprints.ResourceIcons;
			expect(icons.Wood).toBe("🌲");
			expect(icons.Brick).toBe("🧱");
			expect(icons.Wheat).toBe("🌾");
			expect(icons.Ore).toBe("⛏");
			expect(icons.Wool).toBe("🧶");
		});
	});
});
