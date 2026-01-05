
export interface VertexData {
    Key: string;
    Position: Vector3;
    AdjacentLandTileCount: number;
    AdjacentTileCount: number;
    AdjacentTiles: ReadonlyArray<{ Q: number, R: number }>;
}

export interface EdgeData {
    Key: string;
    Vertex1: string;
    Vertex2: string;
    AdjacentLandTileCount: number;
    Center: Vector3;
    AdjacentTiles: ReadonlyArray<{ Q: number, R: number }>;
}

export interface TileData {
    Key: string;
    Q: number;
    R: number;
    Type: string;
    Resource: string;
    DiceNumber?: number;
    Position: Vector3; // World position for AI distance checks
}

export interface BuildingData {
    Id: number | string;
    OwnerId: number;
    Type: "Town" | "City" | "Road";
    Key: string; // Snap key
    Position: Vector3;
}

export interface GameState {
    GetBuildingAt(key: string): BuildingData | undefined;
    GetBuildings(): ReadonlyArray<BuildingData>;
    GetVertex(key: string): VertexData | undefined;
    GetEdge(key: string): EdgeData | undefined;

    // New methods for AI
    GetTile(q: number, r: number): TileData | undefined;
    GetAllTiles(): ReadonlyArray<TileData>;
    GetVertices(): ReadonlyArray<VertexData>;
    GetAllEdges(): ReadonlyArray<EdgeData>;
}

export interface ValidationResult {
    valid: boolean;
    reason?: string;
}

/**
 * Checks if a vertex is connected to a road owned by the player.
 */
export function isConnectedToNetwork(gameState: GameState, playerId: number, vertexKey: string): boolean {
    const buildings = gameState.GetBuildings();

    // Check all roads (edges) to see if they touch this vertex and are owned by player
    for (const building of buildings) {
        if (building.Type === "Road" && building.OwnerId === playerId) {
            const parts = building.Key.split(":");
            const v1 = parts[0];
            const v2 = parts[1];

            if (v1 === vertexKey || v2 === vertexKey) {
                return true;
            }
        }
    }

    // Also check if we have a town/city at this vertex (redundant for "connecting to road" usually, 
    // but strictly speaking, if you are at a vertex you own, you are "connected" to your network)
    const buildingAtVertex = gameState.GetBuildingAt(vertexKey);
    if (buildingAtVertex && buildingAtVertex.OwnerId === playerId) {
        return true;
    }

    return false;
}

/**
 * Checks if an edge is connected to the player's network (Town or Road).
 */
export function isEdgeConnectedToNetwork(gameState: GameState, playerId: number, edgeKey: string): boolean {
    // [refactor] Use standard TS split for testability
    const parts = edgeKey.split(":");
    const v1 = parts[0];
    const v2 = parts[1];
    if (!v1 || !v2) return false;

    // Check endpoints for owned Towns/Cities
    const b1 = gameState.GetBuildingAt(v1);
    if (b1 && b1.OwnerId === playerId && (b1.Type === "Town" || b1.Type === "City")) return true;

    const b2 = gameState.GetBuildingAt(v2);
    if (b2 && b2.OwnerId === playerId && (b2.Type === "Town" || b2.Type === "City")) return true;

    // Check if any owned road touches v1 or v2
    const buildings = gameState.GetBuildings();
    for (const building of buildings) {
        if (building.Type === "Road" && building.OwnerId === playerId) {
            // Don't count self (if we are validating an existing road? usually this is for new placement)
            if (building.Key === edgeKey) continue;

            const roadParts = building.Key.split(":");
            const rv1 = roadParts[0];
            const rv2 = roadParts[1];

            // If the existing road shares ANY vertex with the target edge
            if (rv1 === v1 || rv1 === v2 || rv2 === v1 || rv2 === v2) {
                return true;
            }
        }
    }

    return false;
}

export function validateTownPlacement(
    gameState: GameState,
    playerId: number,
    vertexKey: string,
    isSetupTurn: boolean,
    hasPlacedFirstTowns: boolean // To distinguish "Starters" logic if needed, or derived from town count
): ValidationResult {
    const vertex = gameState.GetVertex(vertexKey);
    if (!vertex) return { valid: false, reason: "Invalid location" };

    if (vertex.AdjacentLandTileCount === 0) return { valid: false, reason: "Cannot build in the open sea!" };
    if (vertex.AdjacentTileCount < 2) return { valid: false, reason: "Invalid town location (must touch 2+ hexes)" };

    const existing = gameState.GetBuildingAt(vertexKey);
    if (existing) return { valid: false, reason: "Location occupied" };

    // INFO: Distance Rule (at least 2 edges away from ANY town)
    const buildings = gameState.GetBuildings();
    for (const b of buildings) {
        if (b.Type === "Town" || b.Type === "City") {
            const dist = b.Position.sub(vertex.Position).Magnitude;
            if (dist < 50) { // Approx 2 edge lengths
                return { valid: false, reason: "Too close to existing town" };
            }
        }
    }

    // INFO: Connection Rule
    // If it's setup turn, we don't need connection (unless "Road1" step etc, but usually Town is first)
    // Actually, Catan rules:
    // 1. First 2 towns: Anywhere valid.
    // 2. Subsequent towns: Must connect to road network.

    // We can infer "isSetupTurn" implies "free placement" regarding connection?
    // Or we rely on `hasPlacedFirstTowns`.
    // Let's count owned towns.
    let ownedTowns = 0;
    for (const b of buildings) {
        if (b.OwnerId === playerId && (b.Type === "Town" || b.Type === "City")) {
            ownedTowns++;
        }
    }

    if (!isSetupTurn && ownedTowns >= 2) {
        if (!isConnectedToNetwork(gameState, playerId, vertexKey)) {
            return { valid: false, reason: "Town must be connected to one of your roads" };
        }
    }

    return { valid: true };
}

export function validateCityPlacement(
    gameState: GameState,
    playerId: number,
    vertexKey: string
): ValidationResult {
    const existing = gameState.GetBuildingAt(vertexKey);
    if (!existing) return { valid: false, reason: "No town to upgrade" };

    if (existing.OwnerId !== playerId) return { valid: false, reason: "You don't own this town" };
    if (existing.Type !== "Town") return { valid: false, reason: "Can only upgrade Towns" }; // Already a city or road? (Roads shouldn't be at vertexKey but good to check)

    return { valid: true };
}

export function validateRoadPlacement(
    gameState: GameState,
    playerId: number,
    edgeKey: string,
    isSetupTurn: boolean,
    lastSetupTownKey?: string // For that specific rule: "Road must connect to the town just placed"
): ValidationResult {
    const edge = gameState.GetEdge(edgeKey);
    if (!edge) return { valid: false, reason: "Invalid location" };

    if (edge.AdjacentLandTileCount === 0) return { valid: false, reason: "Cannot build in the open sea!" };

    const existing = gameState.GetBuildingAt(edgeKey);
    if (existing) return { valid: false, reason: "Road already exists here" };

    // Connection Rule
    if (isSetupTurn && lastSetupTownKey) {
        // Special Setup Rule: Must connect to the town we just placed
        const parts = edgeKey.split(":");
        if (parts[0] !== lastSetupTownKey && parts[1] !== lastSetupTownKey) {
            return { valid: false, reason: "Road must connect to your placed town" };
        }
        return { valid: true };
    }

    if (!isEdgeConnectedToNetwork(gameState, playerId, edgeKey)) {
        return { valid: false, reason: "Road must be connected to one of your towns or roads" };
    }

    return { valid: true };
}
