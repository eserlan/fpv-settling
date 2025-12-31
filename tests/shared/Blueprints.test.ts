
// 1. Define Mocks locally
class Vector3Mock {
	constructor(public x: number, public y: number, public z: number) {}
}

const pairsMock = <T>(obj: Record<string, T> | T[]): [string, T][] => {
	if (Array.isArray(obj)) {
		return obj.map((v, i) => [String(i + 1), v]);
	}
	return Object.entries(obj) as [string, T][];
};

const tableMock = {
	sort: (arr: any[]) => arr.sort(),
};

// 2. Assign to global before ANY imports
(global as any).Vector3 = Vector3Mock;
(global as any).pairs = pairsMock;
(global as any).table = tableMock;

// 3. Import Vitest
import { describe, it, expect, beforeAll } from "vitest";

describe("Blueprints", () => {
    let Blueprints: any;

    beforeAll(async () => {
        // Dynamic import ensures this runs after globals are set
        const module = await import("../../src/shared/Blueprints");
        Blueprints = module.default;
    });

	it("should have valid buildings", () => {
		expect(Blueprints.Buildings).toBeDefined();
		expect(Blueprints.Buildings["Settlement"]).toBeDefined();
		expect(Blueprints.Buildings["City"]).toBeDefined();
		expect(Blueprints.Buildings["Road"]).toBeDefined();
	});

	describe("GetCostString", () => {
		it("should return correct cost string for Road", () => {
			const costString = Blueprints.GetCostString("Road");
			expect(costString).toContain("🌲1");
			expect(costString).toContain("🧱1");
		});

		it("should return empty string for invalid blueprint", () => {
			expect(Blueprints.GetCostString("Invalid")).toBe("");
		});
	});

	describe("CanAfford", () => {
		it("should return true if resources are sufficient", () => {
			const resources = { Wood: 1, Brick: 1 };
			expect(Blueprints.CanAfford(resources, "Road")).toBe(true);
		});

		it("should return false if resources are insufficient", () => {
			const resources = { Wood: 1 };
			expect(Blueprints.CanAfford(resources, "Road")).toBe(false);
		});

		it("should return true if resources are more than enough", () => {
			const resources = { Wood: 5, Brick: 5 };
			expect(Blueprints.CanAfford(resources, "Road")).toBe(true);
		});
	});

	describe("GetBlueprintNames", () => {
		it("should return all blueprint names sorted", () => {
			const names = Blueprints.GetBlueprintNames();
			expect(names).toContain("Settlement");
			expect(names).toContain("City");
			expect(names).toContain("Road");
			expect(names.length).toBe(3);
		});
	});
});
