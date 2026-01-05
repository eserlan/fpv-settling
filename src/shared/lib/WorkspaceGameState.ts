import { GameState, BuildingData, VertexData, EdgeData, TileData } from "shared/lib/GameRules";

export class WorkspaceGameState implements GameState {
    public GetBuildingAt(key: string): BuildingData | undefined {
        // Check Towns
        const townsFolder = game.Workspace.FindFirstChild("Towns");
        if (townsFolder) {
            for (const model of townsFolder.GetChildren()) {
                if (model.IsA("Model")) {
                    const base = model.FindFirstChild("FoundationBase") ?? model.PrimaryPart;
                    if (base && base.IsA("BasePart") && base.GetAttribute("Key") === key) {
                        return this.modelToBuildingData(model, base);
                    }
                }
            }
        }

        // Check Buildings (Roads, Foundations)
        const buildingsFolder = game.Workspace.FindFirstChild("Buildings");
        if (buildingsFolder) {
            for (const model of buildingsFolder.GetChildren()) {
                if (model.IsA("Model")) {
                    const base = model.FindFirstChild("FoundationBase") ?? model.PrimaryPart;
                    if (base && base.IsA("BasePart") && base.GetAttribute("Key") === key) {
                        return this.modelToBuildingData(model, base);
                    }
                }
            }
        }

        return undefined;
    }

    public GetBuildings(): ReadonlyArray<BuildingData> {
        const result: BuildingData[] = [];
        const folders = ["Towns", "Buildings"];

        for (const folderName of folders) {
            const folder = game.Workspace.FindFirstChild(folderName);
            if (folder) {
                for (const model of folder.GetChildren()) {
                    if (model.IsA("Model")) {
                        const base = model.FindFirstChild("FoundationBase") ?? model.PrimaryPart;
                        if (base && base.IsA("BasePart")) {
                            const data = this.modelToBuildingData(model, base);
                            if (data) result.push(data);
                        }
                    }
                }
            }
        }
        return result;
    }

    public GetVertex(key: string): VertexData | undefined {
        const folder = game.Workspace.FindFirstChild("Vertices");
        if (!folder) return undefined;

        // Search by Key attribute, not by name (vertices are named "Vertex_X")
        for (const child of folder.GetChildren()) {
            if (child.IsA("BasePart") && child.GetAttribute("Key") === key) {
                return {
                    Key: key,
                    Position: child.Position,
                    AdjacentLandTileCount: child.GetAttribute("AdjacentLandTileCount") as number ?? 0,
                    AdjacentTileCount: child.GetAttribute("AdjacentTileCount") as number ?? 0,
                    AdjacentTiles: []
                };
            }
        }
        return undefined;
    }

    public GetEdge(key: string): EdgeData | undefined {
        const folder = game.Workspace.FindFirstChild("Edges");
        if (!folder) return undefined;

        // Search by Key attribute, not by name (edges are named "Edge_X")
        for (const child of folder.GetChildren()) {
            if (child.IsA("BasePart") && child.GetAttribute("Key") === key) {
                return {
                    Key: key,
                    Vertex1: child.GetAttribute("Vertex1") as string,
                    Vertex2: child.GetAttribute("Vertex2") as string,
                    AdjacentLandTileCount: child.GetAttribute("AdjacentLandTileCount") as number ?? 0,
                    Center: child.Position,
                    AdjacentTiles: []
                };
            }
        }
        return undefined;
    }

    public GetTile(q: number, r: number): TileData | undefined {
        return undefined; // Not used by Client validation
    }

    public GetAllTiles(): ReadonlyArray<TileData> {
        return []; // Not used by Client validation
    }

    public GetVertices(): ReadonlyArray<VertexData> {
        return []; // Not used by Client validation (yet)
    }

    public GetAllEdges(): ReadonlyArray<EdgeData> {
        return []; // Not used by Client validation (yet)
    }

    private modelToBuildingData(model: Model, base: BasePart): BuildingData | undefined {
        const ownerId = base.GetAttribute("OwnerId") as number;
        const key = base.GetAttribute("Key") as string;
        if (ownerId === undefined || !key) return undefined;

        let buildingType: "Town" | "City" | "Road" = "Town";
        const name = model.Name.lower();
        if (name.find("city")[0] !== undefined) buildingType = "City";
        else if (name.find("road")[0] !== undefined) buildingType = "Road";
        else if (name.find("town")[0] !== undefined) buildingType = "Town";
        else return undefined; // Ignore Foundation? Or treat as type? For now ignore Foundations for validation rules unless they count as "occupying"

        return {
            Id: model.GetAttribute("Id") as number ?? 0, // Fallback
            OwnerId: ownerId,
            Type: buildingType,
            Key: key,
            Position: base.Position,
        };
    }
}
