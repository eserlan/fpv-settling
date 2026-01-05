import { vi } from "vitest";
import "../testUtils";

import { describe, it, expect } from "vitest";
import NPCManager from "../../src/server/NPCManager";
import ResourceManager from "../../src/server/ResourceManager";

// Mock ServerEvents manually
vi.mock("../../src/server/ServerEvents", () => ({
    ServerEvents: {
        NPCHired: {
            fire: vi.fn(),
        },
        ResourceUpdate: {
            fire: vi.fn(),
        },
    },
}));

// Mock Player
const mockPlayer = {
    UserId: 123,
    Name: "TestPlayer",
} as unknown as Player;

describe("NPCManager", () => {
    it("should initialize with no NPCs", () => {
        const rm = new ResourceManager(mockPlayer);
        const nm = new NPCManager(mockPlayer, rm);
        expect(nm.GetNPCs().length).toBe(0);
    });

    it("should fail to hire NPC without resources", () => {
        const rm = new ResourceManager(mockPlayer);
        // Inventory is empty by default now

        const nm = new NPCManager(mockPlayer, rm);
        const [success, error] = nm.HireNPC("Worker");

        expect(success).toBe(false);
        expect(error).toBe("Not enough resources to hire");
    });

    it("should successfully hire NPC with resources", () => {
        const rm = new ResourceManager(mockPlayer);
        // Give enough for a worker (2 Wheat, 1 Ore)
        rm.AddResource("Wheat", 2);
        rm.AddResource("Ore", 1);

        const nm = new NPCManager(mockPlayer, rm);
        const [success, npcId] = nm.HireNPC("Worker");

        expect(success).toBe(true);
        expect(npcId).toBe(1);
        expect(nm.GetNPCs().length).toBe(1);
        expect(rm.GetResource("Wheat")).toBe(0); // 0 (start) + 2 (added) - 2 (cost) = 0
        expect(rm.GetResource("Ore")).toBe(0);   // 0 (start) + 1 (added) - 1 (cost) = 0
    });

    it("should pay maintenance costs", () => {
        const rm = new ResourceManager(mockPlayer);
        rm.AddResource("Wheat", 10);
        rm.AddResource("Ore", 1);

        const nm = new NPCManager(mockPlayer, rm);
        nm.HireNPC("Worker"); // Deducts 2 Wheat, 1 Ore. Wheat: 10 - 2 = 8.

        // Maintenance for worker is 1 wheat/min. For 5 mins = 5 wheat.
        const success = nm.PayMaintenance(5);
        expect(success).toBe(true);
        expect(rm.GetResource("Wheat")).toBe(3); // 8 - 5 = 3
    });

    it("should return false for maintenance if out of food", () => {
        const rm = new ResourceManager(mockPlayer);
        rm.AddResource("Wheat", 2);
        rm.AddResource("Ore", 1);
        const nm = new NPCManager(mockPlayer, rm);
        nm.HireNPC("Worker"); // Wheat remains: 0 + 2 - 2 = 0.

        // Maintenance for worker is 1 wheat/min. For 2 mins = 2 wheat.
        const success = nm.PayMaintenance(2);
        expect(success).toBe(false);
    });

    it("should fire an NPC", () => {
        const rm = new ResourceManager(mockPlayer);
        rm.AddResource("Wheat", 2);
        rm.AddResource("Ore", 1);
        const nm = new NPCManager(mockPlayer, rm);
        const [_, npcId] = nm.HireNPC("Worker");

        const success = nm.FireNPC(npcId as number);
        expect(success).toBe(true);
        expect(nm.GetNPCs().length).toBe(0);
    });
});
