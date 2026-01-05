import "../../../tests/testUtils";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CollectionManager } from "../../../src/server/services/CollectionManager";

// Mocks
const mockTileOwnershipManager = {
    PlayerOwnsTile: vi.fn().mockReturnValue(true)
};

const mockServerGameState = {
    RemoveResource: vi.fn(),
    GetResourcesOwnedBy: vi.fn().mockReturnValue([])
};

vi.mock("../../../src/server/ServerEvents", () => ({
    ServerEvents: {
        ResourceCollected: { broadcast: vi.fn() }
    }
}));

describe("CollectionManager", () => {
    let collectionManager: CollectionManager;
    let mockEntity: any;

    beforeEach(() => {
        collectionManager = new CollectionManager(
            mockTileOwnershipManager as any,
            mockServerGameState as any
        );

        mockEntity = {
            UserId: 123,
            Name: "TestPlayer",
            Character: {
                FindFirstChild: vi.fn().mockReturnValue({ Position: new Vector3(0, 0, 0), IsA: () => true })
            }
        };

        vi.clearAllMocks();
    });

    describe("TryCollect", () => {
        it("should successfully collect if player is explicit owner and within range", () => {
            const mockResource = {
                Position: new Vector3(5, 10, 5), // Close XZ (dist ~7), OK Y (10 < 20)
                Parent: {},
                Name: "Res_1",
                GetAttribute: vi.fn().mockImplementation((name) => {
                    if (name === "OwnerId") return 123;
                    if (name === "ResourceType") return "Wood";
                    if (name === "Amount") return 1;
                    if (name === "ResourceGuid") return "GUID_1";
                    return undefined;
                }),
                Destroy: vi.fn()
            };

            // Add resource manager mock to entity
            (collectionManager as any).AddResource = vi.fn().mockReturnValue(true);

            const result = collectionManager.TryCollect(mockEntity, mockResource as any);

            expect(result).toBe(true);
            expect(mockResource.Destroy).toHaveBeenCalled();
            expect(mockServerGameState.RemoveResource).toHaveBeenCalledWith("GUID_1");
        });

        it("should fail if resource is too far on XZ", () => {
            const mockResource = {
                Position: new Vector3(20, 0, 0), // COLLECTION_RANGE is 12
                Parent: {},
                GetAttribute: vi.fn().mockReturnValue(123),
                Destroy: vi.fn()
            };

            const result = collectionManager.TryCollect(mockEntity, mockResource as any);

            expect(result).toBe(false);
            expect(mockResource.Destroy).not.toHaveBeenCalled();
        });

        it("should fail if ownership check fails (neither explicit nor tile owner)", () => {
            const mockResource = {
                Position: new Vector3(2, 0, 2),
                Parent: {},
                GetAttribute: vi.fn().mockImplementation((name) => {
                    if (name === "OwnerId") return 456; // Different owner
                    return undefined;
                }),
                Destroy: vi.fn()
            };

            const result = collectionManager.TryCollect(mockEntity, mockResource as any);

            expect(result).toBe(false);
        });

        it("should succeed for non-explicit owner if they own the tile", () => {
            const mockResource = {
                Position: new Vector3(2, 0, 2),
                Parent: {},
                GetAttribute: vi.fn().mockImplementation((name) => {
                    if (name === "OwnerId") return undefined; // common resource
                    if (name === "ResourceType") return "Brick";
                    return undefined;
                }),
                Destroy: vi.fn()
            };

            mockTileOwnershipManager.PlayerOwnsTile.mockReturnValue(true);
            (collectionManager as any).AddResource = vi.fn().mockReturnValue(true);

            const result = collectionManager.TryCollect(mockEntity, mockResource as any);

            expect(result).toBe(true);
        });
    });
});
