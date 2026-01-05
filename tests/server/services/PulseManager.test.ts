import "../../../tests/testUtils";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PulseManager } from "../../../src/server/services/PulseManager";
import { ServerEvents } from "../../../src/server/ServerEvents";

// Mocks
const mockRobberManager = {
    OnSevenRolled: vi.fn(),
    ResetToDesert: vi.fn(),
    GetRobberPosition: vi.fn().mockReturnValue({ Q: 0, R: 0 })
};

const mockTileOwnershipManager = {
    GetTileOwners: vi.fn().mockReturnValue([])
};

const mockServerGameState = {
    UpdateTileDice: vi.fn(),
    RegisterResource: vi.fn(),
    RemoveResource: vi.fn()
};

vi.mock("../../../src/server/ServerEvents", () => ({
    ServerEvents: {
        TimerEvent: { broadcast: vi.fn() },
        DiceRollStarted: { broadcast: vi.fn() },
        DiceRollCompleted: { broadcast: vi.fn() },
        SystemMessageEvent: { broadcast: vi.fn() },
        ResourceSpawned: { broadcast: vi.fn() },
        PulseVotesUpdate: { broadcast: vi.fn() }
    }
}));

describe("PulseManager", () => {
    let pulseManager: PulseManager;

    beforeEach(() => {
        pulseManager = new PulseManager(
            mockRobberManager as any,
            mockTileOwnershipManager as any,
            mockServerGameState as any
        );
        vi.clearAllMocks();
    });

    describe("StartGame", () => {
        it("should set pulseTimer to 0 for immediate first pulse", () => {
            pulseManager.StartGame();

            // In a real environment, onTick would then call ExecutePulse on next frame
            // We can check private state if we had access, but we checked public behavior 
            // via timer broadcast if it was 0.

            // Actually, StartGame calls TimerEvent.broadcast(0)
            expect(ServerEvents.TimerEvent.broadcast).toHaveBeenCalledWith(0);
        });
    });

    describe("Resource Spawning", () => {
        it("should generate a unique GUID and register resource", () => {
            // Mock a tile
            const mockTile = {
                PrimaryPart: {
                    Position: new Vector3(0, 0, 0),
                    GetAttribute: vi.fn().mockImplementation((name) => {
                        if (name === "Q") return 1;
                        if (name === "R") return 2;
                        return undefined;
                    })
                }
            };

            const resourceData = { Color: Color3.fromRGB(255, 0, 0), Icon: "🪵" };

            // Access private method for testing purpose or trigger via ExecutePulse
            // Since we want to test the GUID specifically:
            (pulseManager as any).SpawnResource(mockTile, "Wood", resourceData, 123);

            expect(mockServerGameState.RegisterResource).toHaveBeenCalled();
            const args = mockServerGameState.RegisterResource.mock.calls[0];
            expect(args[0]).toMatch(/^Res_/); // GUID
            expect(args[1]).toBe("Wood");
            expect(args[2]).toBe(123); // OwnerId
        });
    });
});
