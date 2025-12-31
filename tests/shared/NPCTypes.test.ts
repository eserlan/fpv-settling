
import { describe, it, expect, beforeAll } from "vitest";

describe("NPCTypes", () => {
	let NPCTypes: any;

	beforeAll(async () => {
		const module = await import("../../src/shared/NPCTypes");
		NPCTypes = module.default;
	});

	it("should have valid NPC definitions", () => {
		expect(NPCTypes).toBeDefined();
		expect(Object.keys(NPCTypes).length).toBeGreaterThan(0);
	});

	it("should have required properties for all NPCs", () => {
		for (const key in NPCTypes) {
			const npc = NPCTypes[key];
			expect(npc.Name).toBeDefined();
			expect(typeof npc.Name).toBe("string");

			expect(npc.Description).toBeDefined();
			expect(typeof npc.Description).toBe("string");

			expect(npc.HireCost).toBeDefined();
			expect(typeof npc.HireCost).toBe("object");

			expect(npc.MaintenanceCost).toBeDefined();
			expect(typeof npc.MaintenanceCost).toBe("object");

			expect(npc.Health).toBeGreaterThan(0);
			expect(npc.Speed).toBeGreaterThan(0);
		}
	});

	it("Worker should have GatherRate", () => {
		const worker = NPCTypes.Worker;
		expect(worker).toBeDefined();
		expect(worker.GatherRate).toBeDefined();
		expect(worker.GatherRate).toBeGreaterThan(0);
	});

	it("Guard should have combat stats", () => {
		const guard = NPCTypes.Guard;
		expect(guard).toBeDefined();
		expect(guard.Damage).toBeGreaterThan(0);
		expect(guard.AttackRange).toBeGreaterThan(0);
		expect(guard.DetectionRange).toBeGreaterThan(0);
	});
});
