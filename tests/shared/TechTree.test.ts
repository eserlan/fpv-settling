// TechTree doesn't use Roblox globals, so no testUtils needed
import { describe, expect, it } from "vitest";
import TechTree from "../../src/shared/TechTree";

describe("TechTree", () => {
	// ═══════════════════════════════════════════════════════════════════════════════
	// BASIC STRUCTURE
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Structure", () => {
		it("should have exactly 6 technologies", () => {
			const techCount = Object.keys(TechTree).length;
			expect(techCount).toBe(6);
		});

		it("should contain all expected technologies", () => {
			expect(TechTree).toHaveProperty("ImprovedTools");
			expect(TechTree).toHaveProperty("BrickMasonry");
			expect(TechTree).toHaveProperty("Agriculture");
			expect(TechTree).toHaveProperty("Military");
			expect(TechTree).toHaveProperty("AdvancedEngineering");
			expect(TechTree).toHaveProperty("Trading");
		});

		it("should have valid entries for all techs", () => {
			for (const key in TechTree) {
				const tech = TechTree[key];
				expect(tech.Name).toBeDefined();
				expect(tech.Description).toBeDefined();
				expect(tech.Cost).toBeDefined();
				expect(tech.ResearchTime).toBeGreaterThan(0);
				expect(tech.Effect).toBeDefined();
				expect(tech.Prerequisites).toBeDefined();
				expect(Array.isArray(tech.Prerequisites)).toBe(true);
			}
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// COSTS
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Costs", () => {
		it("should have positive costs for all resources", () => {
			for (const key in TechTree) {
				const tech = TechTree[key];
				for (const resource in tech.Cost) {
					expect(tech.Cost[resource]).toBeGreaterThan(0);
				}
			}
		});

		it("should have specific cost for ImprovedTools", () => {
			const cost = TechTree.ImprovedTools.Cost;
			expect(cost.Ore).toBe(3);
			expect(cost.Wheat).toBe(2);
		});

		it("should have specific cost for BrickMasonry", () => {
			const cost = TechTree.BrickMasonry.Cost;
			expect(cost.Brick).toBe(4);
			expect(cost.Ore).toBe(2);
		});

		it("should have specific cost for Agriculture", () => {
			const cost = TechTree.Agriculture.Cost;
			expect(cost.Wheat).toBe(3);
			expect(cost.Wood).toBe(2);
		});

		it("should have specific cost for Military", () => {
			const cost = TechTree.Military.Cost;
			expect(cost.Ore).toBe(4);
			expect(cost.Wheat).toBe(3);
		});

		it("should have specific cost for AdvancedEngineering", () => {
			const cost = TechTree.AdvancedEngineering.Cost;
			expect(cost.Ore).toBe(5);
			expect(cost.Brick).toBe(4);
		});

		it("should have specific cost for Trading", () => {
			const cost = TechTree.Trading.Cost;
			expect(cost.Wool).toBe(3);
			expect(cost.Wheat).toBe(2);
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// PREREQUISITES
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Prerequisites", () => {
		it("should have valid prerequisites (all exist in tree)", () => {
			const techKeys = Object.keys(TechTree);
			for (const key in TechTree) {
				const tech = TechTree[key];
				for (const prereq of tech.Prerequisites) {
					expect(techKeys).toContain(prereq);
				}
			}
		});

		it("should have no prerequisites for base techs", () => {
			expect(TechTree.ImprovedTools.Prerequisites).toHaveLength(0);
			expect(TechTree.BrickMasonry.Prerequisites).toHaveLength(0);
			expect(TechTree.Agriculture.Prerequisites).toHaveLength(0);
			expect(TechTree.Military.Prerequisites).toHaveLength(0);
			expect(TechTree.Trading.Prerequisites).toHaveLength(0);
		});

		it("should have prerequisites for AdvancedEngineering", () => {
			const prereqs = TechTree.AdvancedEngineering.Prerequisites;
			expect(prereqs).toHaveLength(2);
			expect(prereqs).toContain("BrickMasonry");
			expect(prereqs).toContain("ImprovedTools");
		});

		it("should not have circular dependencies", () => {
			// Simple check: no tech is its own prerequisite
			for (const key in TechTree) {
				expect(TechTree[key].Prerequisites).not.toContain(key);
			}
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// RESEARCH TIME
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Research Time", () => {
		it("should have correct research times", () => {
			expect(TechTree.ImprovedTools.ResearchTime).toBe(60);
			expect(TechTree.BrickMasonry.ResearchTime).toBe(90);
			expect(TechTree.Agriculture.ResearchTime).toBe(75);
			expect(TechTree.Military.ResearchTime).toBe(120);
			expect(TechTree.AdvancedEngineering.ResearchTime).toBe(150);
			expect(TechTree.Trading.ResearchTime).toBe(90);
		});

		it("should have longer times for advanced techs", () => {
			expect(TechTree.AdvancedEngineering.ResearchTime).toBeGreaterThan(
				TechTree.ImprovedTools.ResearchTime
			);
			expect(TechTree.AdvancedEngineering.ResearchTime).toBeGreaterThan(
				TechTree.BrickMasonry.ResearchTime
			);
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// EFFECTS & MODIFIERS
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Effects", () => {
		it("should have GatherSpeed effect for ImprovedTools", () => {
			expect(TechTree.ImprovedTools.Effect).toBe("GatherSpeed");
			expect(TechTree.ImprovedTools.Modifier).toBe(1.25);
		});

		it("should have UnlockBuilding effect for BrickMasonry", () => {
			expect(TechTree.BrickMasonry.Effect).toBe("UnlockBuilding");
		});

		it("should have WheatProduction effect for Agriculture", () => {
			expect(TechTree.Agriculture.Effect).toBe("WheatProduction");
			expect(TechTree.Agriculture.Modifier).toBe(1.5);
		});

		it("should have GuardEffectiveness effect for Military", () => {
			expect(TechTree.Military.Effect).toBe("GuardEffectiveness");
			expect(TechTree.Military.Modifier).toBe(1.3);
		});

		it("should have BuildingCost effect for AdvancedEngineering", () => {
			expect(TechTree.AdvancedEngineering.Effect).toBe("BuildingCost");
			expect(TechTree.AdvancedEngineering.Modifier).toBe(0.8); // 20% reduction
		});

		it("should have UnlockBuilding effect for Trading", () => {
			expect(TechTree.Trading.Effect).toBe("UnlockBuilding");
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// UNLOCKS
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Unlocks", () => {
		it("should have valid Unlocks arrays when present", () => {
			for (const key in TechTree) {
				const tech = TechTree[key];
				if (tech.Unlocks) {
					expect(Array.isArray(tech.Unlocks)).toBe(true);
					expect(tech.Unlocks.length).toBeGreaterThan(0);
				}
			}
		});

		it("should unlock BrickWall and BrickTower from BrickMasonry", () => {
			expect(TechTree.BrickMasonry.Unlocks).toContain("BrickWall");
			expect(TechTree.BrickMasonry.Unlocks).toContain("BrickTower");
		});

		it("should unlock TradingPost from Trading", () => {
			expect(TechTree.Trading.Unlocks).toContain("TradingPost");
		});

		it("should not have Unlocks for modifier techs", () => {
			expect(TechTree.ImprovedTools.Unlocks).toBeUndefined();
			expect(TechTree.Agriculture.Unlocks).toBeUndefined();
			expect(TechTree.Military.Unlocks).toBeUndefined();
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════════
	// DESCRIPTIONS
	// ═══════════════════════════════════════════════════════════════════════════════

	describe("Descriptions", () => {
		it("should have non-empty descriptions", () => {
			for (const key in TechTree) {
				expect(TechTree[key].Description.length).toBeGreaterThan(10);
			}
		});

		it("should mention modifier percentage in descriptions", () => {
			expect(TechTree.ImprovedTools.Description).toContain("25%");
			expect(TechTree.Agriculture.Description).toContain("50%");
			expect(TechTree.Military.Description).toContain("30%");
			expect(TechTree.AdvancedEngineering.Description).toContain("20%");
		});
	});
});
