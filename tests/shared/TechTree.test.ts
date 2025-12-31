import { describe, expect, it } from "vitest";
import TechTree from "../../src/shared/TechTree";

describe("TechTree", () => {
	it("should have valid entries", () => {
		for (const key in TechTree) {
			const tech = TechTree[key];
			expect(tech.Name).toBeDefined();
			expect(tech.Description).toBeDefined();
			expect(tech.Cost).toBeDefined();
			expect(tech.ResearchTime).toBeGreaterThan(0);
			expect(tech.Effect).toBeDefined();
		}
	});

	it("should have positive costs", () => {
		for (const key in TechTree) {
			const tech = TechTree[key];
			for (const resource in tech.Cost) {
				expect(tech.Cost[resource]).toBeGreaterThan(0);
			}
		}
	});

	it("should have valid prerequisites", () => {
		const techKeys = Object.keys(TechTree);
		for (const key in TechTree) {
			const tech = TechTree[key];
			for (const prereq of tech.Prerequisites) {
				expect(techKeys).toContain(prereq);
			}
		}
	});

	it("should have valid Unlocks", () => {
		for (const key in TechTree) {
			const tech = TechTree[key];
			if (tech.Unlocks) {
				expect(Array.isArray(tech.Unlocks)).toBe(true);
				expect(tech.Unlocks.length).toBeGreaterThan(0);
			}
		}
	});

	it("should contain specific technologies", () => {
		expect(TechTree).toHaveProperty("ImprovedTools");
		expect(TechTree).toHaveProperty("BrickMasonry");
		expect(TechTree).toHaveProperty("Agriculture");
		expect(TechTree).toHaveProperty("Military");
		expect(TechTree).toHaveProperty("AdvancedEngineering");
		expect(TechTree).toHaveProperty("Trading");
	});
});
