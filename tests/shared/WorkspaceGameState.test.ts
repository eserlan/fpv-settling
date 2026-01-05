import { describe, it, expect, beforeEach, vi } from "vitest";
import "../../tests/testUtils";

// Helper to create a Lua-compatible string (with lower() and find())
function luaString(s: string) {
    return {
        toString: () => s,
        lower: () => luaString(s.toLowerCase()),
        find: (pattern: string) => {
            const idx = s.toLowerCase().indexOf(pattern.toLowerCase());
            return idx >= 0 ? [idx + 1] : [undefined]; // Lua indices are 1-based
        },
    };
}

// Mock game.Workspace for WorkspaceGameState
const mockVertices: Record<string, { Name: string; Position: Vector3; Attributes: Record<string, unknown> }> = {};
const mockEdges: Record<string, { Name: string; Position: Vector3; Attributes: Record<string, unknown> }> = {};
const mockTowns: { Name: unknown; PrimaryPart: { Position: Vector3; Attributes: Record<string, unknown> } }[] = [];
const mockBuildings: { Name: unknown; PrimaryPart: { Position: Vector3; Attributes: Record<string, unknown> } }[] = [];

// Create mock game.Workspace
const mockWorkspace = {
    FindFirstChild: (name: string) => {
        if (name === "Vertices") {
            return {
                GetChildren: () => Object.values(mockVertices).map(v => ({
                    IsA: (t: string) => t === "BasePart",
                    Name: v.Name,
                    Position: v.Position,
                    GetAttribute: (attr: string) => v.Attributes[attr],
                })),
            };
        }
        if (name === "Edges") {
            return {
                GetChildren: () => Object.values(mockEdges).map(e => ({
                    IsA: (t: string) => t === "BasePart",
                    Name: e.Name,
                    Position: e.Position,
                    GetAttribute: (attr: string) => e.Attributes[attr],
                })),
            };
        }
        if (name === "Towns") {
            return {
                GetChildren: () => mockTowns.map(t => ({
                    IsA: (type: string) => type === "Model",
                    Name: t.Name, // Already a luaString
                    PrimaryPart: {
                        IsA: (type: string) => type === "BasePart",
                        Position: t.PrimaryPart.Position,
                        GetAttribute: (attr: string) => t.PrimaryPart.Attributes[attr],
                    },
                    FindFirstChild: () => undefined,
                    GetAttribute: (attr: string) => t.PrimaryPart.Attributes[attr],
                })),
            };
        }
        if (name === "Buildings") {
            return {
                GetChildren: () => mockBuildings.map(b => ({
                    IsA: (type: string) => type === "Model",
                    Name: b.Name, // Already a luaString
                    PrimaryPart: {
                        IsA: (type: string) => type === "BasePart",
                        Position: b.PrimaryPart.Position,
                        GetAttribute: (attr: string) => b.PrimaryPart.Attributes[attr],
                    },
                    FindFirstChild: () => undefined,
                    GetAttribute: (attr: string) => b.PrimaryPart.Attributes[attr],
                })),
            };
        }
        return undefined;
    },
};

// Set up global game mock
(global as unknown as { game: { Workspace: typeof mockWorkspace } }).game = {
    Workspace: mockWorkspace,
};

// Import after mocking
import { WorkspaceGameState } from "../../src/shared/lib/WorkspaceGameState";

describe("WorkspaceGameState", () => {
    let gameState: WorkspaceGameState;

    beforeEach(() => {
        // Clear mock data
        for (const key of Object.keys(mockVertices)) delete mockVertices[key];
        for (const key of Object.keys(mockEdges)) delete mockEdges[key];
        mockTowns.length = 0;
        mockBuildings.length = 0;

        gameState = new WorkspaceGameState();
    });

    describe("GetVertex", () => {
        it("should find vertex by Key attribute, not by name", () => {
            // Vertex is named "Vertex_1" but has Key attribute "10_6"
            mockVertices["v1"] = {
                Name: "Vertex_1",
                Position: new Vector3(10, 5, 6),
                Attributes: {
                    Key: "10_6",
                    AdjacentLandTileCount: 3,
                    AdjacentTileCount: 3,
                },
            };

            const vertex = gameState.GetVertex("10_6");

            expect(vertex).toBeDefined();
            expect(vertex?.Key).toBe("10_6");
            expect(vertex?.AdjacentLandTileCount).toBe(3);
        });

        it("should return undefined if vertex key not found", () => {
            mockVertices["v1"] = {
                Name: "Vertex_1",
                Position: new Vector3(0, 0, 0),
                Attributes: { Key: "10_6" },
            };

            const vertex = gameState.GetVertex("nonexistent_key");

            expect(vertex).toBeUndefined();
        });

        it("should not find vertex by name when Key attribute differs", () => {
            // Important: vertex name is "10_6" but Key attribute is "5_3"
            mockVertices["v1"] = {
                Name: "10_6", // Name matches search
                Position: new Vector3(0, 0, 0),
                Attributes: { Key: "5_3" }, // But Key attribute doesn't
            };

            // Should NOT find by name
            const vertex = gameState.GetVertex("10_6");

            expect(vertex).toBeUndefined();
        });
    });

    describe("GetEdge", () => {
        it("should find edge by Key attribute, not by name", () => {
            // Edge is named "Edge_42" but has Key attribute "10_6:5_3"
            mockEdges["e1"] = {
                Name: "Edge_42",
                Position: new Vector3(7.5, 5, 4.5),
                Attributes: {
                    Key: "10_6:5_3",
                    Vertex1: "10_6",
                    Vertex2: "5_3",
                    AdjacentLandTileCount: 2,
                },
            };

            const edge = gameState.GetEdge("10_6:5_3");

            expect(edge).toBeDefined();
            expect(edge?.Key).toBe("10_6:5_3");
            expect(edge?.Vertex1).toBe("10_6");
            expect(edge?.Vertex2).toBe("5_3");
            expect(edge?.AdjacentLandTileCount).toBe(2);
        });

        it("should return undefined if edge key not found", () => {
            mockEdges["e1"] = {
                Name: "Edge_1",
                Position: new Vector3(0, 0, 0),
                Attributes: { Key: "10_6:5_3", Vertex1: "10_6", Vertex2: "5_3" },
            };

            const edge = gameState.GetEdge("nonexistent:key");

            expect(edge).toBeUndefined();
        });

        it("should not find edge by name when Key attribute differs", () => {
            mockEdges["e1"] = {
                Name: "10_6:5_3", // Name matches search
                Position: new Vector3(0, 0, 0),
                Attributes: { Key: "other:key", Vertex1: "other", Vertex2: "key" },
            };

            const edge = gameState.GetEdge("10_6:5_3");

            expect(edge).toBeUndefined();
        });
    });

    describe("GetBuildingAt", () => {
        it("should find town by Key attribute", () => {
            mockTowns.push({
                Name: luaString("Town_Player1"),
                PrimaryPart: {
                    Position: new Vector3(10, 5, 10),
                    Attributes: {
                        Key: "10_6",
                        OwnerId: 123,
                    },
                },
            });

            const building = gameState.GetBuildingAt("10_6");

            expect(building).toBeDefined();
            expect(building?.Key).toBe("10_6");
            expect(building?.OwnerId).toBe(123);
            expect(building?.Type).toBe("Town");
        });

        it("should find road by Key attribute", () => {
            mockBuildings.push({
                Name: luaString("Road_Player1"),
                PrimaryPart: {
                    Position: new Vector3(5, 5, 5),
                    Attributes: {
                        Key: "10_6:5_3",
                        OwnerId: 456,
                    },
                },
            });

            const building = gameState.GetBuildingAt("10_6:5_3");

            expect(building).toBeDefined();
            expect(building?.Key).toBe("10_6:5_3");
            expect(building?.OwnerId).toBe(456);
            expect(building?.Type).toBe("Road");
        });

        it("should return undefined if no building at key", () => {
            mockTowns.push({
                Name: luaString("Town_Player1"),
                PrimaryPart: {
                    Position: new Vector3(0, 0, 0),
                    Attributes: { Key: "10_6", OwnerId: 1 },
                },
            });

            const building = gameState.GetBuildingAt("nonexistent");

            expect(building).toBeUndefined();
        });
    });

    describe("GetBuildings", () => {
        it("should return all buildings from Towns and Buildings folders", () => {
            mockTowns.push({
                Name: luaString("Town_Player1"),
                PrimaryPart: {
                    Position: new Vector3(10, 5, 10),
                    Attributes: { Key: "v1", OwnerId: 1 },
                },
            });
            mockTowns.push({
                Name: luaString("City_Player1"),
                PrimaryPart: {
                    Position: new Vector3(20, 5, 20),
                    Attributes: { Key: "v2", OwnerId: 1 },
                },
            });
            mockBuildings.push({
                Name: luaString("Road_Player1"),
                PrimaryPart: {
                    Position: new Vector3(15, 5, 15),
                    Attributes: { Key: "e1", OwnerId: 1 },
                },
            });

            const buildings = gameState.GetBuildings();

            expect(buildings.length).toBe(3);
            expect(buildings.filter(b => b.Type === "Town").length).toBe(1);
            expect(buildings.filter(b => b.Type === "City").length).toBe(1);
            expect(buildings.filter(b => b.Type === "Road").length).toBe(1);
        });
    });
});
