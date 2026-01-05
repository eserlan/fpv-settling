
// 1. Define Mocks locally
class Vector3Mock {
	constructor(public x: number, public y: number, public z: number) { }
}

// 2. Assign to global before ANY imports
(global as any).Vector3 = Vector3Mock;

// 3. Import Vitest
import { describe, it, expect, beforeAll } from "vitest";

describe("BuildingTypes", () => {
	let BuildingTypes: any;

	beforeAll(async () => {
		const module = await import("../../src/shared/BuildingTypes");
		BuildingTypes = module.default;
	});

	it("should have valid building definitions", () => {
		expect(BuildingTypes).toBeDefined();
		expect(Object.keys(BuildingTypes).length).toBeGreaterThan(0);
	});

	it("should have required properties for all buildings", () => {
		for (const key in BuildingTypes) {
			const building = BuildingTypes[key];
			expect(building.Name).toBeDefined();
			expect(typeof building.Name).toBe("string");

			expect(building.Description).toBeDefined();
			expect(typeof building.Description).toBe("string");

			expect(building.Cost).toBeDefined();
			expect(typeof building.Cost).toBe("object");

			expect(building.BuildTime).toBeDefined();
			expect(typeof building.BuildTime).toBe("number");

			expect(building.Size).toBeDefined();
		}
	});

	it("should have valid costs", () => {
		for (const key in BuildingTypes) {
			const building = BuildingTypes[key];
			for (const resource in building.Cost) {
				expect(building.Cost[resource]).toBeGreaterThan(0);
			}
		}
	});

	it("Town should have specific properties", () => {
		const town = BuildingTypes.Town;
		expect(town).toBeDefined();
		expect(town.IsTown).toBe(true);
		expect(town.ClaimRadius).toBeGreaterThan(0);
	});
});
