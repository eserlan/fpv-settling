import { Service } from "@flamework/core";
import { GameState, BuildingData, VertexData, EdgeData, TileData } from "shared/lib/GameRules";
import * as Logger from "shared/Logger";

@Service({})
export class ServerGameState implements GameState {
    private buildings: Map<string, BuildingData> = new Map();
    private vertices: Map<string, VertexData> = new Map();
    private edges: Map<string, EdgeData> = new Map();
    private tiles: Map<string, TileData> = new Map();
    private resources: Map<string, { type: string, ownerId: number, position: Vector3, key: string }> = new Map();

    // Implementation of GameState interface
    public GetBuildingAt(key: string): BuildingData | undefined {
        return this.buildings.get(key);
    }

    public GetBuildings(): ReadonlyArray<BuildingData> {
        const arr: BuildingData[] = [];
        for (const [_, b] of this.buildings) {
            arr.push(b);
        }
        return arr;
    }

    public GetVertex(key: string): VertexData | undefined {
        return this.vertices.get(key);
    }

    public GetEdge(key: string): EdgeData | undefined {
        return this.edges.get(key);
    }

    public GetTile(q: number, r: number): TileData | undefined {
        return this.tiles.get(`${q}_${r}`);
    }

    public GetAllTiles(): ReadonlyArray<TileData> {
        const arr: TileData[] = [];
        for (const [_, t] of this.tiles) arr.push(t);
        return arr;
    }

    public GetVertices(): ReadonlyArray<VertexData> {
        const arr: VertexData[] = [];
        for (const [_, v] of this.vertices) arr.push(v);
        return arr;
    }

    public GetAllEdges(): ReadonlyArray<EdgeData> {
        const arr: EdgeData[] = [];
        for (const [_, e] of this.edges) arr.push(e);
        return arr;
    }

    // Admin / Setup methods
    public RegisterVertex(data: VertexData) {
        this.vertices.set(data.Key, data);
    }

    public RegisterEdge(data: EdgeData) {
        this.edges.set(data.Key, data);
    }

    public RegisterTile(data: TileData) {
        this.tiles.set(`${data.Q}_${data.R}`, data);
    }

    public UpdateTileDice(q: number, r: number, dice: number) {
        const key = `${q}_${r}`;
        const tile = this.tiles.get(key);
        if (tile) {
            tile.DiceNumber = dice;
            // No need to re-set in map as we modified the object reference, but for safety/clarity:
            this.tiles.set(key, tile);
        }
    }

    public RegisterBuilding(data: BuildingData) {
        this.buildings.set(data.Key, data);
        Logger.Info("ServerGameState", `Registered building ${data.Type} at ${data.Key}`);
    }

    public RemoveBuilding(key: string) {
        if (this.buildings.has(key)) {
            this.buildings.delete(key);
            Logger.Info("ServerGameState", `Removed building at ${key}`);
        }
    }

    public RegisterResource(key: string, resType: string, ownerId: number, position: Vector3) {
        this.resources.set(key, { type: resType, ownerId, position, key });
    }

    public RemoveResource(key: string) {
        this.resources.delete(key);
    }

    // Queries for AI
    public GetResourcesOwnedBy(ownerId: number) {
        const result: { type: string, position: Vector3, key: string }[] = [];
        for (const [_, res] of this.resources) {
            if (res.ownerId === ownerId) {
                result.push({ type: res.type, position: res.position, key: res.key });
            }
        }
        return result;
    }
}
