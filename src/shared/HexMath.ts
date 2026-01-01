/**
 * HexMath - Pure mathematical functions for hexagonal grid operations
 * 
 * This module contains pure functions (no Roblox dependencies) for:
 * - Axial <-> World coordinate conversions
 * - Hex distance calculations
 * - Neighbor finding
 * - Vertex and edge position calculations
 * 
 * Coordinate System: Axial (q, r) - "pointy-top" hexagons
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Radius from hex center to corner (in studs) */
export const HEX_SIZE = 40;

/** Height of hex tile (in studs) */
export const HEX_HEIGHT = 4;

/** Square root of 3, used frequently in hex math */
export const SQRT_3 = 1.7320508075688772; // math.sqrt(3)

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Axial hex coordinates (q, r) */
export type AxialCoord = {
    q: number;
    r: number;
};

/** Cube hex coordinates (x, y, z) where x + y + z = 0 */
export type CubeCoord = {
    x: number;
    y: number;
    z: number;
};

/** 2D world position */
export type WorldPos = {
    x: number;
    z: number;
};

// ═══════════════════════════════════════════════════════════════════════════════
// COORDINATE CONVERSIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert axial coordinates to cube coordinates
 */
export const axialToCube = (coord: AxialCoord): CubeCoord => {
    const x = coord.q;
    const z = coord.r;
    const y = -x - z + 0; // +0 normalizes -0 to +0
    return { x, y, z };
};

/**
 * Convert cube coordinates to axial coordinates
 */
export const cubeToAxial = (coord: CubeCoord): AxialCoord => {
    return { q: coord.x + 0, r: coord.z + 0 }; // +0 normalizes -0 to +0
};

/**
 * Convert axial coordinates (q, r) to world position (x, z)
 * Uses "pointy-top" hex orientation
 * 
 * @param q - Axial q coordinate
 * @param r - Axial r coordinate
 * @param hexSize - Optional hex size (defaults to HEX_SIZE)
 * @returns World position { x, z }
 */
export const axialToWorld = (q: number, r: number, hexSize: number = HEX_SIZE): WorldPos => {
    const x = hexSize * 2 * (q + r / 2);
    const z = hexSize * SQRT_3 * r;
    return { x, z };
};

/**
 * Convert world position (x, z) to approximate axial coordinates (q, r)
 * Note: Returns fractional coordinates; use hexRound to get exact hex
 * 
 * @param x - World x coordinate
 * @param z - World z coordinate
 * @param hexSize - Optional hex size (defaults to HEX_SIZE)
 * @returns Fractional axial coordinates { q, r }
 */
export const worldToAxialFractional = (x: number, z: number, hexSize: number = HEX_SIZE): AxialCoord => {
    const q = (x / (hexSize * 2)) - (z / (hexSize * 2 * SQRT_3));
    const r = z / (hexSize * SQRT_3);
    return { q, r };
};

/**
 * Round fractional axial coordinates to the nearest hex
 * Uses cube coordinate rounding for accuracy
 */
export const hexRound = (coord: AxialCoord): AxialCoord => {
    const cube = axialToCube(coord);

    let rx = math.round(cube.x);
    let ry = math.round(cube.y);
    let rz = math.round(cube.z);

    const xDiff = math.abs(rx - cube.x);
    const yDiff = math.abs(ry - cube.y);
    const zDiff = math.abs(rz - cube.z);

    // Ensure x + y + z = 0
    if (xDiff > yDiff && xDiff > zDiff) {
        rx = -ry - rz;
    } else if (yDiff > zDiff) {
        ry = -rx - rz;
    } else {
        rz = -rx - ry;
    }

    return cubeToAxial({ x: rx, y: ry, z: rz });
};

/**
 * Convert world position to exact axial hex coordinates
 */
export const worldToAxial = (x: number, z: number, hexSize: number = HEX_SIZE): AxialCoord => {
    const fractional = worldToAxialFractional(x, z, hexSize);
    return hexRound(fractional);
};

// ═══════════════════════════════════════════════════════════════════════════════
// DISTANCE & NEIGHBORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate distance between two hexes (in hex steps)
 */
export const hexDistance = (a: AxialCoord, b: AxialCoord): number => {
    const cubeA = axialToCube(a);
    const cubeB = axialToCube(b);
    return math.max(
        math.abs(cubeA.x - cubeB.x),
        math.abs(cubeA.y - cubeB.y),
        math.abs(cubeA.z - cubeB.z)
    );
};

/** Direction vectors for the 6 neighboring hexes (axial coordinates) */
export const HEX_DIRECTIONS: readonly AxialCoord[] = [
    { q: 1, r: 0 },   // East
    { q: 1, r: -1 },  // Northeast
    { q: 0, r: -1 },  // Northwest
    { q: -1, r: 0 },  // West
    { q: -1, r: 1 },  // Southwest
    { q: 0, r: 1 },   // Southeast
] as const;

/**
 * Get the 6 neighboring hex coordinates
 */
export const getNeighbors = (coord: AxialCoord): AxialCoord[] => {
    return HEX_DIRECTIONS.map(dir => ({
        q: coord.q + dir.q,
        r: coord.r + dir.r,
    }));
};

/**
 * Get hexes within a certain distance (ring)
 */
export const getHexesInRange = (center: AxialCoord, distance: number): AxialCoord[] => {
    const results: AxialCoord[] = [];

    for (let q = -distance; q <= distance; q++) {
        const r1 = math.max(-distance, -q - distance);
        const r2 = math.min(distance, -q + distance);
        for (let r = r1; r <= r2; r++) {
            results.push({ q: center.q + q, r: center.r + r });
        }
    }

    return results;
};

/**
 * Get hexes exactly at a certain distance (ring outline)
 */
export const getHexRing = (center: AxialCoord, radius: number): AxialCoord[] => {
    if (radius === 0) return [center];

    const results: AxialCoord[] = [];
    let hex: AxialCoord = {
        q: center.q + HEX_DIRECTIONS[4].q * radius,
        r: center.r + HEX_DIRECTIONS[4].r * radius,
    };

    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < radius; j++) {
            results.push({ ...hex });
            hex = { q: hex.q + HEX_DIRECTIONS[i].q, r: hex.r + HEX_DIRECTIONS[i].r };
        }
    }

    return results;
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERTEX & EDGE POSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the 6 corner (vertex) positions of a hex in world coordinates
 * Corners are numbered 0-5, starting from the right and going counter-clockwise
 * 
 * @param centerX - World x position of hex center
 * @param centerZ - World z position of hex center
 * @param hexSize - Optional hex size (defaults to HEX_SIZE)
 * @returns Array of 6 vertex positions
 */
export const getHexVertices = (centerX: number, centerZ: number, hexSize: number = HEX_SIZE): WorldPos[] => {
    const vertices: WorldPos[] = [];
    const cornerRadius = hexSize * 1.15; // Adjusted for visual hex shape

    for (let i = 0; i < 6; i++) {
        const angle = (math.pi / 3) * i + (math.pi / 6); // 30° offset for pointy-top
        vertices.push({
            x: centerX + cornerRadius * math.cos(angle),
            z: centerZ + cornerRadius * math.sin(angle),
        });
    }

    return vertices;
};

/**
 * Get the 6 edge center positions of a hex in world coordinates
 * Edges are numbered 0-5, edge i connects vertex i to vertex (i+1) mod 6
 */
export const getHexEdgeCenters = (centerX: number, centerZ: number, hexSize: number = HEX_SIZE): WorldPos[] => {
    const vertices = getHexVertices(centerX, centerZ, hexSize);
    const edges: WorldPos[] = [];

    for (let i = 0; i < 6; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % 6];
        edges.push({
            x: (v1.x + v2.x) / 2,
            z: (v1.z + v2.z) / 2,
        });
    }

    return edges;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TILE KEY UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a unique string key from axial coordinates
 */
export const makeTileKey = (q: number, r: number): string => `${q}_${r}`;

/**
 * Parse a tile key back to axial coordinates
 */
export const parseTileKey = (key: string): AxialCoord => {
    const parts = key.split("_");
    return {
        q: tonumber(parts[0])!,
        r: tonumber(parts[1])!,
    };
};

/**
 * Create a unique string key for a vertex (grid-snapped position)
 */
export const makeVertexKey = (x: number, z: number, gridSize: number = 8): string => {
    const keyX = math.floor(x / gridSize + 0.5);
    const keyZ = math.floor(z / gridSize + 0.5);
    return `${keyX}_${keyZ}`;
};

/**
 * Create a unique string key for an edge (sorted vertex keys)
 */
export const makeEdgeKey = (vertexKey1: string, vertexKey2: string): string => {
    return vertexKey1 < vertexKey2 ? `${vertexKey1}:${vertexKey2}` : `${vertexKey2}:${vertexKey1}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPIRAL ITERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate hex coordinates in a spiral pattern, starting from center
 * Useful for map generation
 * 
 * @param rings - Number of rings around the center (0 = just center, 2 = standard Catan)
 * @returns Array of axial coordinates in spiral order
 */
export const generateHexSpiral = (rings: number): AxialCoord[] => {
    const hexes: AxialCoord[] = [{ q: 0, r: 0 }]; // Center

    for (let ring = 1; ring <= rings; ring++) {
        hexes.push(...getHexRing({ q: 0, r: 0 }, ring));
    }

    return hexes;
};

/**
 * Count total hexes for a given number of rings
 * Formula: 1 + 3*n*(n+1) where n = rings
 */
export const countHexesInRings = (rings: number): number => {
    return 1 + 3 * rings * (rings + 1);
};

// Default export for convenient imports
export default {
    // Constants
    HEX_SIZE,
    HEX_HEIGHT,
    SQRT_3,
    HEX_DIRECTIONS,

    // Coordinate conversions
    axialToCube,
    cubeToAxial,
    axialToWorld,
    worldToAxialFractional,
    worldToAxial,
    hexRound,

    // Distance & neighbors
    hexDistance,
    getNeighbors,
    getHexesInRange,
    getHexRing,

    // Vertices & edges
    getHexVertices,
    getHexEdgeCenters,

    // Key utilities
    makeTileKey,
    parseTileKey,
    makeVertexKey,
    makeEdgeKey,

    // Spiral generation
    generateHexSpiral,
    countHexesInRings,
};
