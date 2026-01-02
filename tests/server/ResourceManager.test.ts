import { vi } from "vitest";
import "../testUtils";

// Mock Flamework networking since it's not Node-compatible
vi.mock("@flamework/networking", () => ({
    Networking: {
        createEvent: () => ({
            createServer: () => ({
                ClientRequest: { connect: vi.fn() },
                DevEvent: { connect: vi.fn() },
                CollectEvent: { connect: vi.fn(), fire: vi.fn() },
            }),
            createClient: () => ({}),
        }),
    },
}));

import { describe, it, expect } from "vitest";
import ResourceManager from "../../src/server/ResourceManager";

// Mock ServerEvents manually to avoid loading the real one which might still fail
vi.mock("../../src/server/ServerEvents", () => ({
    ServerEvents: {
        ResourceUpdate: {
            fire: vi.fn(),
        },
        CollectEvent: {
            fire: vi.fn(),
        },
    },
}));

// Mock Player
const mockPlayer = {
    UserId: 123,
    Name: "TestPlayer",
} as unknown as Player;

describe("ResourceManager", () => {
    it("should initialize with starting resources", () => {
        const rm = new ResourceManager(mockPlayer);
        expect(rm.GetResource("Wood")).toBe(2);
        expect(rm.GetResource("Brick")).toBe(2);
        expect(rm.GetResource("Wheat")).toBe(1);
        expect(rm.GetResource("Wool")).toBe(1);
        expect(rm.GetResource("Ore")).toBe(0);
    });

    it("should add resources", () => {
        const rm = new ResourceManager(mockPlayer);
        rm.AddResource("Wood", 5);
        expect(rm.GetResource("Wood")).toBe(7);
    });

    it("should respect max stack when adding", () => {
        const rm = new ResourceManager(mockPlayer);
        // Max stack is 50 in ResourceMath/ResourceTypes
        const added = rm.AddResource("Wood", 60);
        expect(added).toBe(48); // 2 + 48 = 50
        expect(rm.GetResource("Wood")).toBe(50);
    });

    it("should remove resources", () => {
        const rm = new ResourceManager(mockPlayer);
        const success = rm.RemoveResource("Wood", 1);
        expect(success).toBe(true);
        expect(rm.GetResource("Wood")).toBe(1);
    });

    it("should return false when removing more than available", () => {
        const rm = new ResourceManager(mockPlayer);
        const success = rm.RemoveResource("Wood", 10);
        expect(success).toBe(false);
        expect(rm.GetResource("Wood")).toBe(2);
    });

    it("should check if player has enough resources", () => {
        const rm = new ResourceManager(mockPlayer);
        expect(rm.HasResources({ Wood: 2, Brick: 1 })).toBe(true);
        expect(rm.HasResources({ Wood: 3 })).toBe(false);
    });

    it("should calculate total resource count", () => {
        const rm = new ResourceManager(mockPlayer);
        // 2 + 2 + 1 + 1 = 6
        expect(rm.GetTotalResourceCount()).toBe(6);
    });

    it("should remove random resources", () => {
        const rm = new ResourceManager(mockPlayer);
        // Starting with 6: 2 Wood, 2 Brick, 1 Wheat, 1 Wool
        const removed = rm.RemoveRandomResources(3);
        expect(removed.length).toBe(3);
        expect(rm.GetTotalResourceCount()).toBe(3);
    });
});
