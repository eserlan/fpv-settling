// Mock Roblox globals BEFORE imports
class Vector3Mock {
	constructor(public x: number, public y: number, public z: number) {}
}

(global as any).Vector3 = Vector3Mock;

import { describe, it, expect, beforeAll } from "vitest";

describe("BuildingTypes", () => {
    let BuildingTypes: any;

    beforeAll(async () => {
        const module = await import("../../src/shared/BuildingTypes");
        BuildingTypes = module.default;
    });

	it("should have valid building entries", () => {
		expect(BuildingTypes).toBeDefined();
		expect(BuildingTypes.Settlement).toBeDefined();
		expect(BuildingTypes.City).toBeDefined();
		expect(BuildingTypes.Road).toBeDefined();
	});

	it("should have correct properties for Settlement", () => {
		const settlement = BuildingTypes.Settlement;
		expect(settlement.Name).toBe("Settlement");
		expect(settlement.Size).toBeInstanceOf(Vector3Mock);
		expect(settlement.Cost).toEqual({
			Wood: 1,
			Brick: 1,
			Wheat: 1,
			Wool: 1,
		});
		expect(settlement.IsSettlement).toBe(true);
	});

	it("should have correct properties for Road", () => {
		const road = BuildingTypes.Road;
		expect(road.Name).toBe("Road");
		expect(road.IsRoad).toBe(true);
		expect(road.Cost).toEqual({ Wood: 1, Brick: 1 });
	});

	it("should require existing settlement for City", () => {
		const city = BuildingTypes.City;
		expect(city.RequiresSettlement).toBe(true);
	});

	it("should have valid dimensions for all buildings", () => {
		for (const key in BuildingTypes) {
			const building = BuildingTypes[key];
			expect(building.Size.x).toBeGreaterThan(0);
			expect(building.Size.y).toBeGreaterThan(0);
			expect(building.Size.z).toBeGreaterThan(0);
		}
	});
});
