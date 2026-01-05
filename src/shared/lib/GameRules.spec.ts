import { describe, it, expect } from "vitest";
import {
    validateTownPlacement,
    validateRoadPlacement,
    GameState,
    BuildingData,
    VertexData,
    EdgeData,
    TileData
} from "./GameRules";

// Mock Vector3 for Node environment
class MockVector3 {
    constructor(public X: number, public Y: number, public Z: number) { }

    sub(other: MockVector3): MockVector3 {
        return new MockVector3(this.X - other.X, this.Y - other.Y, this.Z - other.Z);
    }

    add(other: MockVector3): MockVector3 {
        return new MockVector3(this.X + other.X, this.Y + other.Y, this.Z + other.Z);
    }

    get Magnitude(): number {
        return Math.sqrt(this.X ** 2 + this.Y ** 2 + this.Z ** 2);
    }
}

// Helper to create vector
const v3 = (x: number, y: number, z: number) => new MockVector3(x, y, z) as unknown as Vector3;

// Mock GameState
class MockGameState implements GameState {
    public buildings: BuildingData[] = [];
    public vertices = new Map<string, VertexData>();
    public edges = new Map<string, EdgeData>();

    GetBuildingAt(key: string): BuildingData | undefined {
        return this.buildings.find(b => b.Key === key);
    }

    GetBuildings(): ReadonlyArray<BuildingData> {
        return this.buildings;
    }

    GetVertex(key: string): VertexData | undefined {
        return this.vertices.get(key);
    }

    GetEdge(key: string): EdgeData | undefined {
        return this.edges.get(key);
    }

    GetTile(q: number, r: number): TileData | undefined {
        return undefined;
    }

    GetAllTiles(): ReadonlyArray<TileData> {
        return [];
    }

    GetVertices(): ReadonlyArray<VertexData> {
        const arr: VertexData[] = [];
        this.vertices.forEach(v => arr.push(v));
        return arr;
    }

    GetAllEdges(): ReadonlyArray<EdgeData> {
        const arr: EdgeData[] = [];
        this.edges.forEach(e => arr.push(e));
        return arr;
    }

    // Helper to setup test data
    addTown(id: number, ownerId: number, key: string, pos: Vector3) {
        this.buildings.push({ Id: id, OwnerId: ownerId, Type: "Town", Key: key, Position: pos });
    }

    addRoad(id: number, ownerId: number, key: string) {
        this.buildings.push({ Id: id, OwnerId: ownerId, Type: "Road", Key: key, Position: v3(0, 0, 0) });
    }

    addVertex(key: string, pos: Vector3, adjLand: number = 3, adjTile: number = 3) {
        this.vertices.set(key, { Key: key, Position: pos, AdjacentLandTileCount: adjLand, AdjacentTileCount: adjTile, AdjacentTiles: [] });
    }

    addEdge(key: string, v1: string, v2: string, adjLand: number = 2) {
        this.edges.set(key, { Key: key, Vertex1: v1, Vertex2: v2, AdjacentLandTileCount: adjLand, Center: v3(0, 0, 0), AdjacentTiles: [] });
    }
}

describe("GameRules Validator", () => {

    it("should validate valid initial town placement", () => {
        const state = new MockGameState();
        const pos = v3(0, 0, 0);
        state.addVertex("0_0_0", pos); // valid vertex

        // Setup Phase
        const result = validateTownPlacement(state, 1, "0_0_0", true, false);
        expect(result.valid).toBe(true);
    });

    it("should reject town in open sea", () => {
        const state = new MockGameState();
        state.addVertex("0_0_0", v3(0, 0, 0), 0); // 0 land tiles

        const result = validateTownPlacement(state, 1, "0_0_0", true, false);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("open sea");
    });

    it("should reject town too close to another town", () => {
        const state = new MockGameState();
        state.addVertex("0_0_0", v3(0, 0, 0));
        state.addVertex("0_0_1", v3(10, 0, 0)); // only 10 studs away

        state.addTown(1, 2, "0_0_1", v3(10, 0, 0)); // Another player's town nearby

        const result = validateTownPlacement(state, 1, "0_0_0", false, true);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("Too close");
    });

    it("should require connection for 3rd town", () => {
        const state = new MockGameState();
        // Player already has 2 towns
        state.addTown(1, 1, "town1", v3(100, 0, 0));
        state.addTown(2, 1, "town2", v3(200, 0, 0));

        state.addVertex("target", v3(0, 0, 0));

        // No road connected
        const result = validateTownPlacement(state, 1, "target", false, true);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("must be connected");
    });

    it("should allow connected 3rd town", () => {
        const state = new MockGameState();
        // Player already has 2 towns
        state.addTown(1, 1, "town1", v3(100, 0, 0));
        state.addTown(2, 1, "town2", v3(200, 0, 0));

        state.addVertex("target", v3(0, 0, 0));
        // Add road connected to target
        // Simulating road on edge "target:other"
        state.addRoad(3, 1, "target:other");

        const result = validateTownPlacement(state, 1, "target", false, true);
        expect(result.valid).toBe(true);
    });

    it("should reject road not connected to network", () => {
        const state = new MockGameState();
        state.addEdge("v1:v2", "v1", "v2");

        const result = validateRoadPlacement(state, 1, "v1:v2", false);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("connected");
    });

    it("should allow road connected to own town", () => {
        const state = new MockGameState();
        state.addEdge("v1:v2", "v1", "v2");
        state.addTown(1, 1, "v1", v3(0, 0, 0)); // Town at v1

        const result = validateRoadPlacement(state, 1, "v1:v2", false);
        expect(result.valid).toBe(true);
    });

    it("should allow road connected to own road", () => {
        const state = new MockGameState();
        state.addEdge("v1:v2", "v1", "v2");
        // Existing road at v2:v3
        state.addRoad(1, 1, "v2:v3");

        const result = validateRoadPlacement(state, 1, "v1:v2", false);
        expect(result.valid).toBe(true);
    });
});
