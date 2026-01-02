// Import mocks before any other imports
import "../testUtils";

import { describe, it, expect } from "vitest";
import HexMath, {
    axialToWorld,
    worldToAxial,
    hexRound,
    hexDistance,
    getNeighbors,
    getHexesInRange,
    getHexRing,
    getHexVertices,
    getHexEdgeCenters,
    makeTileKey,
    parseTileKey,
    makeVertexKey,
    makeEdgeKey,
    generateHexSpiral,
    countHexesInRings,
    axialToCube,
    cubeToAxial,
    HEX_SIZE,
    SQRT_3,
    HEX_DIRECTIONS,
    HEX_STRETCH,
} from "../../src/shared/HexMath";

describe("HexMath", () => {
    describe("Constants", () => {
        it("should have correct HEX_SIZE", () => {
            expect(HEX_SIZE).toBe(40);
        });

        it("should have correct SQRT_3", () => {
            expect(SQRT_3).toBeCloseTo(Math.sqrt(3), 10);
        });

        it("should have 6 hex directions", () => {
            expect(HEX_DIRECTIONS).toHaveLength(6);
        });
    });

    describe("Coordinate Conversions", () => {
        describe("axialToCube / cubeToAxial", () => {
            it("should convert axial (0, 0) to cube (0, 0, 0)", () => {
                const cube = axialToCube({ q: 0, r: 0 });
                expect(cube.x).toBe(0);
                expect(cube.y).toBe(0);
                expect(cube.z).toBe(0);
            });

            it("should satisfy x + y + z = 0", () => {
                const testCoords = [
                    { q: 1, r: 2 },
                    { q: -3, r: 4 },
                    { q: 5, r: -2 },
                    { q: 0, r: -7 },
                ];

                for (const coord of testCoords) {
                    const cube = axialToCube(coord);
                    expect(cube.x + cube.y + cube.z).toBe(0);
                }
            });

            it("should round-trip correctly", () => {
                const original = { q: 3, r: -5 };
                const cube = axialToCube(original);
                const result = cubeToAxial(cube);
                expect(result.q).toBe(original.q);
                expect(result.r).toBe(original.r);
            });
        });

        describe("axialToWorld", () => {
            it("should convert origin hex to world origin", () => {
                const world = axialToWorld(0, 0);
                expect(world.x).toBe(0);
                expect(world.z).toBe(0);
            });

            it("should handle positive coordinates", () => {
                const world = axialToWorld(1, 0);
                expect(world.x).toBe(HEX_SIZE * 2);
                expect(world.z).toBe(0);
            });

            it("should handle negative coordinates", () => {
                const world = axialToWorld(-1, 0);
                expect(world.x).toBe(-HEX_SIZE * 2);
                expect(world.z).toBe(0);
            });

            it("should calculate correct z for r axis", () => {
                const world = axialToWorld(0, 1);
                expect(world.x).toBe(HEX_SIZE); // q + r/2 = 0 + 0.5 = 0.5, * 2 * 40 = 40
                expect(world.z).toBeCloseTo(HEX_SIZE * SQRT_3);
            });

            it("should support custom hex size", () => {
                const customSize = 20;
                const world = axialToWorld(1, 0, customSize);
                expect(world.x).toBe(customSize * 2);
            });
        });

        describe("worldToAxial / hexRound", () => {
            it("should round-trip origin correctly", () => {
                const world = axialToWorld(0, 0);
                const axial = worldToAxial(world.x, world.z);
                expect(axial.q).toBe(0);
                expect(axial.r).toBe(0);
            });

            it("should round-trip various coordinates", () => {
                const testCoords = [
                    { q: 1, r: 0 },
                    { q: 0, r: 1 },
                    { q: -1, r: 2 },
                    { q: 2, r: -1 },
                    { q: -2, r: -2 },
                ];

                for (const original of testCoords) {
                    const world = axialToWorld(original.q, original.r);
                    const result = worldToAxial(world.x, world.z);
                    expect(result.q).toBe(original.q);
                    expect(result.r).toBe(original.r);
                }
            });

            it("should round to nearest hex", () => {
                // Test a point slightly off-center
                const world = axialToWorld(1, 0);
                const result = worldToAxial(world.x + 5, world.z + 3);
                expect(result.q).toBe(1);
                expect(result.r).toBe(0);
            });
        });
    });

    describe("Distance & Neighbors", () => {
        describe("hexDistance", () => {
            it("should return 0 for same hex", () => {
                expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
            });

            it("should return 1 for adjacent hexes", () => {
                const center = { q: 0, r: 0 };
                for (const dir of HEX_DIRECTIONS) {
                    expect(hexDistance(center, dir)).toBe(1);
                }
            });

            it("should return correct distance for non-adjacent hexes", () => {
                expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2);
                expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -3 })).toBe(3);
                expect(hexDistance({ q: -2, r: 1 }, { q: 2, r: -1 })).toBe(4);
            });
        });

        describe("getNeighbors", () => {
            it("should return 6 neighbors", () => {
                const neighbors = getNeighbors({ q: 0, r: 0 });
                expect(neighbors).toHaveLength(6);
            });

            it("should return correct neighbors for origin", () => {
                const neighbors = getNeighbors({ q: 0, r: 0 });
                const expected = [
                    { q: 1, r: 0 },
                    { q: 1, r: -1 },
                    { q: 0, r: -1 },
                    { q: -1, r: 0 },
                    { q: -1, r: 1 },
                    { q: 0, r: 1 },
                ];
                expect(neighbors).toEqual(expected);
            });

            it("should offset correctly for non-origin hex", () => {
                const neighbors = getNeighbors({ q: 2, r: -1 });
                for (const neighbor of neighbors) {
                    expect(hexDistance({ q: 2, r: -1 }, neighbor)).toBe(1);
                }
            });
        });

        describe("getHexesInRange", () => {
            it("should return only center for distance 0", () => {
                const hexes = getHexesInRange({ q: 0, r: 0 }, 0);
                expect(hexes).toEqual([{ q: 0, r: 0 }]);
            });

            it("should return 7 hexes for distance 1", () => {
                const hexes = getHexesInRange({ q: 0, r: 0 }, 1);
                expect(hexes).toHaveLength(7); // Center + 6 neighbors
            });

            it("should return 19 hexes for distance 2 (standard Catan)", () => {
                const hexes = getHexesInRange({ q: 0, r: 0 }, 2);
                expect(hexes).toHaveLength(19);
            });
        });

        describe("getHexRing", () => {
            it("should return center for radius 0", () => {
                const ring = getHexRing({ q: 0, r: 0 }, 0);
                expect(ring).toEqual([{ q: 0, r: 0 }]);
            });

            it("should return 6 hexes for radius 1", () => {
                const ring = getHexRing({ q: 0, r: 0 }, 1);
                expect(ring).toHaveLength(6);
                for (const hex of ring) {
                    expect(hexDistance({ q: 0, r: 0 }, hex)).toBe(1);
                }
            });

            it("should return 12 hexes for radius 2", () => {
                const ring = getHexRing({ q: 0, r: 0 }, 2);
                expect(ring).toHaveLength(12);
                for (const hex of ring) {
                    expect(hexDistance({ q: 0, r: 0 }, hex)).toBe(2);
                }
            });
        });
    });

    describe("Vertices & Edges", () => {
        describe("getHexVertices", () => {
            it("should return 6 vertices", () => {
                const vertices = getHexVertices(0, 0);
                expect(vertices).toHaveLength(6);
            });

            it("should have vertices equidistant from center", () => {
                const vertices = getHexVertices(0, 0);
                const distances = vertices.map(v => Math.sqrt(v.x ** 2 + v.z ** 2));
                const expectedRadius = HEX_SIZE * HEX_STRETCH;

                for (const dist of distances) {
                    expect(dist).toBeCloseTo(expectedRadius, 5);
                }
            });
        });

        describe("getHexEdgeCenters", () => {
            it("should return 6 edge centers", () => {
                const edges = getHexEdgeCenters(0, 0);
                expect(edges).toHaveLength(6);
            });

            it("should be between adjacent vertices", () => {
                const vertices = getHexVertices(0, 0);
                const edges = getHexEdgeCenters(0, 0);

                for (let i = 0; i < 6; i++) {
                    const v1 = vertices[i];
                    const v2 = vertices[(i + 1) % 6];
                    const edge = edges[i];

                    expect(edge.x).toBeCloseTo((v1.x + v2.x) / 2, 5);
                    expect(edge.z).toBeCloseTo((v1.z + v2.z) / 2, 5);
                }
            });
        });
    });

    describe("Tile Key Utilities", () => {
        describe("makeTileKey", () => {
            it("should create key from positive coordinates", () => {
                expect(makeTileKey(2, 5)).toBe("2_5");
            });

            it("should create key from negative coordinates", () => {
                expect(makeTileKey(-3, -1)).toBe("-3_-1");
            });

            it("should create key with zero", () => {
                expect(makeTileKey(0, 0)).toBe("0_0");
            });
        });

        describe("parseTileKey", () => {
            it("should parse positive coordinates", () => {
                const result = parseTileKey("2_5");
                expect(result.q).toBe(2);
                expect(result.r).toBe(5);
            });

            it("should parse negative coordinates", () => {
                const result = parseTileKey("-3_-1");
                expect(result.q).toBe(-3);
                expect(result.r).toBe(-1);
            });

            it("should parse zero", () => {
                const result = parseTileKey("0_0");
                expect(result.q).toBe(0);
                expect(result.r).toBe(0);
            });

            it("should round-trip with makeTileKey", () => {
                const original = { q: 7, r: -4 };
                const key = makeTileKey(original.q, original.r);
                const parsed = parseTileKey(key);
                expect(parsed).toEqual(original);
            });
        });

        describe("makeVertexKey", () => {
            it("should snap to grid", () => {
                const key1 = makeVertexKey(16.1, 24.9);
                const key2 = makeVertexKey(15.9, 24.1);
                expect(key1).toBe(key2); // Both should snap to same grid cell
            });

            it("should support custom grid size", () => {
                const key = makeVertexKey(10, 10, 5);
                expect(key).toBe("2_2"); // 10/5 = 2
            });
        });

        describe("makeEdgeKey", () => {
            it("should create consistent key regardless of order", () => {
                const key1 = makeEdgeKey("1_2", "3_4");
                const key2 = makeEdgeKey("3_4", "1_2");
                expect(key1).toBe(key2);
            });

            it("should use colon separator", () => {
                const key = makeEdgeKey("1_2", "3_4");
                expect(key).toContain(":");
            });
        });
    });

    describe("Spiral Generation", () => {
        describe("countHexesInRings", () => {
            it("should return 1 for 0 rings", () => {
                expect(countHexesInRings(0)).toBe(1);
            });

            it("should return 7 for 1 ring", () => {
                expect(countHexesInRings(1)).toBe(7);
            });

            it("should return 19 for 2 rings (standard Catan)", () => {
                expect(countHexesInRings(2)).toBe(19);
            });

            it("should return 37 for 3 rings", () => {
                expect(countHexesInRings(3)).toBe(37);
            });
        });

        describe("generateHexSpiral", () => {
            it("should start with center hex", () => {
                const spiral = generateHexSpiral(1);
                expect(spiral[0]).toEqual({ q: 0, r: 0 });
            });

            it("should generate correct count for 1 ring", () => {
                const spiral = generateHexSpiral(1);
                expect(spiral).toHaveLength(7);
            });

            it("should generate correct count for 2 rings", () => {
                const spiral = generateHexSpiral(2);
                expect(spiral).toHaveLength(19);
            });

            it("should have no duplicates", () => {
                const spiral = generateHexSpiral(2);
                const keys = spiral.map(h => makeTileKey(h.q, h.r));
                const uniqueKeys = new Set(keys);
                expect(uniqueKeys.size).toBe(spiral.length);
            });
        });
    });

    describe("Default export", () => {
        it("should export all functions", () => {
            expect(HexMath.axialToWorld).toBeDefined();
            expect(HexMath.worldToAxial).toBeDefined();
            expect(HexMath.hexDistance).toBeDefined();
            expect(HexMath.getNeighbors).toBeDefined();
            expect(HexMath.makeTileKey).toBeDefined();
            expect(HexMath.parseTileKey).toBeDefined();
        });
    });
});
