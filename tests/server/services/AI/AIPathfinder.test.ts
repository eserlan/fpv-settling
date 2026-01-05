import "../../../../tests/testUtils";
import { vi } from "vitest";

// Mock PathfindingService BEFORE importing the tested module
vi.mock("@rbxts/services", () => ({
    PathfindingService: {
        CreatePath: vi.fn().mockReturnValue({
            ComputeAsync: vi.fn(),
            GetWaypoints: vi.fn().mockReturnValue([]),
            Status: "Success"
        })
    }
}));

import { describe, it, expect, beforeEach } from "vitest";
import { AIPathfinder, MoveResult } from "../../../../src/server/services/AI/AIPathfinder";

describe("AIPathfinder", () => {
    let pathfinder: AIPathfinder;
    let mockHumanoid: any;
    let mockRootPart: any;

    beforeEach(() => {
        pathfinder = new AIPathfinder();
        mockRootPart = { Position: new Vector3(0, 0, 0) };
        mockHumanoid = {
            Parent: {
                PrimaryPart: mockRootPart
            },
            MoveTo: vi.fn(),
            WalkSpeed: 16,
            Jump: false
        };
        vi.clearAllMocks();
    });

    describe("XZ Distance Logic", () => {
        it("should arrive at target based on XZ distance, ignoring height", () => {
            // Target is 1 stud away on XZ, but 50 studs away on Y
            const targetPos = new Vector3(1, 50, 0);
            const result = pathfinder.Update(mockHumanoid, targetPos, 100, 16);

            expect(result).toBe(MoveResult.Arrived);
            // Height difference shouldn't prevent arrival if XZ is close (within 2 studs)
        });

        it("should continue moving if XZ distance is large, even if Y is same", () => {
            const targetPos = new Vector3(10, 0, 0);
            const result = pathfinder.Update(mockHumanoid, targetPos, 100, 16);

            expect(result).toBe(MoveResult.Continue);
            expect(mockHumanoid.MoveTo).toHaveBeenCalled();
        });
    });

    describe("Direct Movement", () => {
        it("should use ground-clamped target for MoveTo when close", () => {
            // Target is at Y=50, Character is at Y=0
            const targetPos = new Vector3(10, 50, 10);
            pathfinder.Update(mockHumanoid, targetPos, 100, 16);

            const call = mockHumanoid.MoveTo.mock.calls[0][0];
            expect(call.Y).toBe(0); // Clamped to character's Y
            expect(call.X).toBe(10);
            expect(call.Z).toBe(10);
        });
    });

    describe("Dynamic Speed", () => {
        it("should increase speed for distant targets", () => {
            const targetPos = new Vector3(500, 0, 0);
            pathfinder.Update(mockHumanoid, targetPos, 100, 16);

            expect(mockHumanoid.WalkSpeed).toBeGreaterThan(16);
        });

        it("should use normal speed for close targets", () => {
            const targetPos = new Vector3(10, 0, 0);
            pathfinder.Update(mockHumanoid, targetPos, 100, 16);

            expect(mockHumanoid.WalkSpeed).toBe(16);
        });
    });
});
