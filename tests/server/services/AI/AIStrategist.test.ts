import "../../../../tests/testUtils";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AIStrategist } from "../../../../src/server/services/AI/AIStrategist";
import * as GameRules from "../../../../src/shared/lib/GameRules";

// Mocks
const mockMapGenerator = {
    GetRandomVertex: vi.fn(),
    FindNearestVertex: vi.fn(),
    GetRandomEdge: vi.fn(),
};

const mockGameState = {
    GetBuildings: vi.fn().mockReturnValue([]),
    GetBuildingAt: vi.fn().mockReturnValue(undefined),
    GetVertices: vi.fn().mockReturnValue([]),
    GetAllEdges: vi.fn().mockReturnValue([]),
    GetVertex: vi.fn().mockReturnValue(undefined),
    GetEdge: vi.fn().mockReturnValue(undefined),
    GetTile: vi.fn().mockReturnValue(undefined),
    GetAllTiles: vi.fn().mockReturnValue([]),
    GetResourcesOwnedBy: vi.fn().mockReturnValue([]),
};

// Mock Array with size() for Roblox-TS compatibility
function createMockArray(items: any[] = []) {
    const arr = [...items] as any;
    arr.size = () => arr.length;
    arr.find = (cb: any) => Array.prototype.find.call(arr, cb);
    arr.filter = (cb: any) => {
        const res = Array.prototype.filter.call(arr, cb);
        return createMockArray(res);
    };
    return arr;
}

// Mock Game Rules
vi.mock("../../../../src/shared/lib/GameRules", () => ({
    validateTownPlacement: vi.fn().mockReturnValue({ valid: true }),
    validateRoadPlacement: vi.fn().mockReturnValue({ valid: true }),
    isConnectedToNetwork: vi.fn().mockReturnValue(true),
}));

describe("AIStrategist", () => {
    let strategist: AIStrategist;
    const userId = 123;
    let mockBuildingManager: any;
    let mockPlayerData: any;

    beforeEach(() => {
        mockBuildingManager = {
            Towns: createMockArray([]),
            GetTowns: () => createMockArray([]),
        };
        mockPlayerData = {
            BuildingManager: mockBuildingManager,
            ResourceManager: { Resources: {} },
            Towns: createMockArray([]),
        } as any;

        strategist = new AIStrategist(userId, "TestBot");
        mockGameState.GetBuildings.mockReturnValue([]);
        vi.clearAllMocks();
    });

    describe("DecideAction", () => {
        it("should return BUILD Town if affordable and target found", () => {
            // Setup: Affordable
            const canAfford = () => true;

            // Setup: Target Town (Initial)
            mockPlayerData.NeedsFirstTown = true;

            // Mock vertices through gameState (AIStrategist now uses GetVertices)
            const mockVertexData = {
                Key: "v1",
                Position: new Vector3(10, 0, 10),
                AdjacentLandTileCount: 3,
                AdjacentTileCount: 3,
                AdjacentTiles: []
            };
            mockGameState.GetVertices.mockReturnValue(createMockArray([mockVertexData]));

            vi.mocked(GameRules.validateTownPlacement).mockReturnValue({ valid: true });

            const queue = strategist.DecideAction(mockPlayerData, mockMapGenerator as any, mockGameState as any, canAfford);

            expect(queue.length).toBeGreaterThan(0);
            expect(queue[0].type).toBe("BUILD");
            expect(queue[0].buildingType).toBe("Town");
        });

        it("should return nothing if unaffordable", () => {
            const canAfford = () => false;
            mockPlayerData.NeedsFirstTown = true;
            const mockVertex = {
                Position: new Vector3(10, 0, 10),
                GetAttribute: (k: string) => k === "Key" ? "v1" : undefined
            };
            mockMapGenerator.GetRandomVertex.mockReturnValue(mockVertex);

            const queue = strategist.DecideAction(mockPlayerData, mockMapGenerator as any, mockGameState as any, canAfford);

            // It might return COLLECT tasks if opportunistic, checking empty implementation details
            // But it should NOT return BUILD
            const buildTasks = queue.filter((t: any) => t.type === "BUILD");
            expect(buildTasks.length).toBe(0);
        });

        it("should include resourceKey in COLLECT tasks", () => {
            const canAfford = () => false;
            mockPlayerData.NeedsFirstTown = false;

            // Mock character and position
            const mockChar = {
                FindFirstChild: vi.fn().mockImplementation((name) => {
                    if (name === "HumanoidRootPart") return { Position: new Vector3(0, 0, 0) };
                    return undefined;
                })
            };
            vi.stubGlobal("game", {
                Workspace: {
                    FindFirstChild: vi.fn().mockReturnValue(mockChar)
                }
            });

            // Mock owned resources with keys
            const mockResources = createMockArray([
                { key: "Res_Wood_1", position: new Vector3(10, 0, 0), type: "Wood" },
                { key: "Res_Brick_1", position: new Vector3(0, 0, 10), type: "Brick" }
            ]);
            mockGameState.GetResourcesOwnedBy.mockReturnValue(mockResources);

            const queue = strategist.DecideAction(mockPlayerData, mockMapGenerator as any, mockGameState as any, canAfford);

            const collectTasks = queue.filter((t: any) => t.type === "COLLECT");
            expect(collectTasks.length).toBe(2);
            expect(collectTasks[0].resourceKey).toBeDefined();
            expect(collectTasks[0].resourceKey).toMatch(/^Res_/);
        });
    });

    describe("GetTargetBuilding", () => {
        it("should prioritize City upgrade if 3 towns exist", () => {
            mockPlayerData.NeedsFirstTown = false;
            // 3 Towns
            const t1 = { Type: "Town", OwnerId: userId, Position: new Vector3(0, 0, 0) };
            const t2 = { Type: "Town", OwnerId: userId, Position: new Vector3(10, 0, 0) };
            const t3 = { Type: "Town", OwnerId: userId, Position: new Vector3(20, 0, 0) };

            const townsArr = createMockArray([t1, t2, t3]);
            mockPlayerData.Towns = townsArr;

            const target = strategist.GetTargetBuilding(mockPlayerData, mockMapGenerator as any, mockGameState as any);

            expect(target).toBeDefined();
            expect(target?.type).toBe("City");
        });
    });
});
