import { PlayerData } from "../../PlayerData";
import { ServerGameState } from "../ServerGameState";
import { MapGenerator } from "../MapGenerator";
import * as Logger from "shared/Logger";
import { validateTownPlacement, validateRoadPlacement, isConnectedToNetwork } from "shared/lib/GameRules";

export class AIStrategist {
    private userId: number;
    private name: string;
    private failedTownSpots: Vector3[] = [];

    constructor(userId: number, name: string) {
        this.userId = userId;
        this.name = name;
    }

    public RecordFailedPlacement(pos: Vector3) {
        this.failedTownSpots.push(pos);
    }

    public DecideAction(
        playerData: PlayerData,
        mapGenerator: MapGenerator,
        gameState: ServerGameState,
        canAfford: (bs: "City" | "Town" | "Road", r: Record<string, number>) => boolean
    ): { type: "BUILD" | "COLLECT", buildingType?: string, position: Vector3, resourceKey?: string }[] {
        const resources = playerData.ResourceManager.Resources;
        const target = this.GetTargetBuilding(playerData, mapGenerator, gameState);

        const queue: { type: "BUILD" | "COLLECT", buildingType?: string, position: Vector3, resourceKey?: string }[] = [];

        if (target) {
            if (canAfford(target.type, resources)) {
                queue.push({ type: "BUILD", buildingType: target.type, position: target.position ?? new Vector3() });
                Logger.Info("AIPlayer", `${this.name} decided to build ${target.type.upper()}`);
                return queue;
            }
        }

        // Opportunistic Collection if nothing to build immediately
        const ownedResources = gameState.GetResourcesOwnedBy(this.userId);

        if (ownedResources.size() > 0) {
            const myChar = game.Workspace.FindFirstChild(this.name) as Model | undefined;
            const root = myChar ? (myChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined) : undefined;
            const myPos = root ? root.Position : undefined;

            if (myPos) {
                try {
                    // Sort by XZ distance (nearest first) to match collection logic
                    const withDist = ownedResources.map(r => {
                        const diff = r.position.sub(myPos);
                        const distXZ = new Vector3(diff.X, 0, diff.Z).Magnitude;
                        return { ...r, dist: distXZ };
                    });

                    withDist.sort((a, b) => a.dist < b.dist);

                    const count = math.min(withDist.size(), 5);
                    for (let i = 0; i < count; i++) {
                        queue.push({ type: "COLLECT", position: withDist[i].position, resourceKey: withDist[i].key });
                    }
                    Logger.Info("AIStrategist", `${this.name} (ID: ${this.userId}) found ${ownedResources.size()} resources, queued ${queue.size()} COLLECT tasks`);
                } catch (e) {
                    Logger.Error("AIStrategist", `Error sorting/queuing resources for ${this.name}: ${e}`);
                }
            } else {
                Logger.Warn("AIStrategist", `${this.name} could not find root part position for collection (Character in Workspace: ${myChar !== undefined})`);
            }
        } else {
            // Only log this occasionally to avoid spam, or keep for now to debug
            // Logger.Info("AIStrategist", `${this.name} (ID: ${this.userId}) found 0 owned resources`);
        }

        return queue;
    }

    public GetTargetBuilding(playerData: PlayerData, mapGenerator: MapGenerator, gameState: ServerGameState): { type: "City" | "Town" | "Road", position?: Vector3 } | undefined {
        const towns = playerData.Towns;

        // 1. Initial Town
        if (playerData.NeedsFirstTown) {
            const spot = this.GetBestTownSpot(mapGenerator, true, gameState);
            if (spot) return { type: "Town", position: spot };
        }

        // 2. Expansion Selection
        const targetExpansionSpot = this.GetBestTownSpot(mapGenerator, false, gameState);

        // 3. City Upgrade
        if (towns.size() >= 3) {
            const townToUpgrade = towns.find(t => t.Type === "Town" && t.OwnerId === this.userId);
            if (townToUpgrade) {
                return { type: "City", position: townToUpgrade.Position };
            }
        }

        // 4. Expansion
        if (targetExpansionSpot) {
            // We found a valid spot, but do we need a road to get there?
            // The Spot validation ensures it's either (a) initial or (b) connected.
            // If GetBestTownSpot returned a spot, it means it IS connected and valid to build NOW.
            return { type: "Town", position: targetExpansionSpot };
        }

        // 5. Road Building
        // If we can't build a town (likely due to no connected valid spots), we need to expand our road network.
        // We should aim towards a high-value area.
        // For simplicity, GetBestRoadSpot picks a random valid edge or one towards a "Target" if we had one.
        // Let's just expand generally.
        const bestRoad = this.GetBestRoadSpot(playerData, gameState);
        if (bestRoad) return { type: "Road", position: bestRoad };

        // 6. Fallback (Upgrade if possible)
        const fallbackTown = towns.find(t => t.Type === "Town");
        if (fallbackTown) return { type: "City", position: fallbackTown.Position };

        return undefined;
    }

    public GetBestTownSpot(mapGenerator: MapGenerator, isInitial: boolean, gameState: ServerGameState): Vector3 | undefined {
        let bestScore = -999;
        let bestPos: Vector3 | undefined;

        // Sampling approach via ServerGameState (avoid workspace scan)
        const allVertices = gameState.GetVertices();
        if (allVertices.size() === 0) return undefined;

        for (let i = 0; i < 50; i++) {
            const v = allVertices[math.random(0, allVertices.size() - 1)];
            if (!v) continue;

            // Check if failed before
            let isFailed = false;
            for (const failed of this.failedTownSpots) {
                if (v.Position.sub(failed).Magnitude < 5) {
                    isFailed = true;
                    break;
                }
            }
            if (isFailed) continue;

            const vertexKey = v.Key;

            // STRICT VALIDATION via GameRules
            const validation = validateTownPlacement(gameState, this.userId, vertexKey, isInitial, !isInitial);

            if (!validation.valid) continue;

            const score = this.CalculateSpotScore(v, gameState);
            if (score > bestScore) {
                bestScore = score;
                bestPos = v.Position;
            }
        }
        return bestPos;
    }

    public GetBestRoadSpot(playerData: PlayerData, gameState: ServerGameState, targetTownPos?: Vector3, isSetupTurn: boolean = false, lastSetupTownKey?: string): Vector3 | undefined {
        const allEdges = gameState.GetAllEdges();
        if (allEdges.size() === 0) return undefined;

        const candidates: { pos: Vector3, score: number }[] = [];

        // During setup, we need edges that specifically connect to the lastSetupTownKey vertex
        // Otherwise, we can sample random edges for general expansion
        if (isSetupTurn && lastSetupTownKey) {
            // Find ALL edges that contain the lastSetupTownKey vertex
            for (const edge of allEdges) {
                const key = edge.Key;
                const parts = key.split(":");

                // Check if this edge connects to our town vertex
                if (parts[0] !== lastSetupTownKey && parts[1] !== lastSetupTownKey) {
                    continue;
                }

                const validation = validateRoadPlacement(gameState, this.userId, key, isSetupTurn, lastSetupTownKey);
                if (!validation.valid) continue;

                // Prefer edges with higher adjacent land tile count (better connected)
                let score = edge.AdjacentLandTileCount * 100 + math.random(1, 50);
                candidates.push({ pos: edge.Center, score });
            }
        } else {
            // Non-setup: sample random edges for expansion
            for (let i = 0; i < 30; i++) {
                const edge = allEdges[math.random(0, allEdges.size() - 1)];
                if (!edge) continue;

                const key = edge.Key;
                const validation = validateRoadPlacement(gameState, this.userId, key, isSetupTurn, lastSetupTownKey);

                if (!validation.valid) continue;

                let score = math.random(1, 100);
                if (targetTownPos) {
                    const dist = edge.Center.sub(targetTownPos).Magnitude;
                    score += (1000 - dist);
                    candidates.push({ pos: edge.Center, score });
                } else {
                    candidates.push({ pos: edge.Center, score });
                }
            }
        }

        if (candidates.size() === 0) return undefined;

        candidates.sort((a, b) => a.score > b.score);
        return candidates[0].pos;
    }

    private CalculateSpotScore(vertex: import("shared/lib/GameRules").VertexData, gameState: ServerGameState): number {
        let totalScore = 0;

        // Optimized: Use AdjacentTiles for O(1) lookup
        if (vertex.AdjacentTiles) {
            for (const { Q, R } of vertex.AdjacentTiles) {
                const tile = gameState.GetTile(Q, R);
                if (tile) {
                    const diceNum = tile.DiceNumber;
                    if (diceNum) totalScore += (6 - math.abs(7 - diceNum));
                }
            }
        }

        return totalScore;
    }
}
