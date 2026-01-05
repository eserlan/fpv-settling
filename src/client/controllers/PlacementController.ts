import { Players, Workspace, UserInputService } from "@rbxts/services";
import * as Logger from "shared/Logger";
import Blueprints from "shared/Blueprints";
import { ClientEvents } from "client/ClientEvents";
import { validateTownPlacement, validateRoadPlacement } from "shared/lib/GameRules";
import { WorkspaceGameState } from "shared/lib/WorkspaceGameState";

const player = Players.LocalPlayer;

export class PlacementController {
    public IsActive = false;
    private selectedBlueprint: string | undefined;
    private buildingPreview: Part | undefined;
    private currentVertex: BasePart | undefined;
    private isValidPlacement = false;

    private lastValidPlacement: boolean | undefined;
    private lastLoggedKey: string | undefined;
    private lastPlacedKey: string | undefined;

    private gameState: WorkspaceGameState;

    constructor(gameState: WorkspaceGameState) {
        this.gameState = gameState;
    }

    public GetLastPlacedKey() { return this.lastPlacedKey; }

    public StartPlacement(blueprintName: string) {
        this.selectedBlueprint = blueprintName;
        this.IsActive = true;
        Logger.Info("PlacementController", `[${player.Name}] Entering placement mode for: ${blueprintName}`);
        this.UpdatePreview();
    }

    public StopPlacement() {
        this.IsActive = false;
        this.selectedBlueprint = undefined;
        this.lastValidPlacement = undefined;
        this.lastLoggedKey = undefined;
        if (this.buildingPreview) {
            this.buildingPreview.Destroy();
            this.buildingPreview = undefined;
        }

        // Hide markers
        this.SetMarkersVisible("Vertices", false);
        this.SetMarkersVisible("Edges", false);

        Logger.Debug("PlacementController", "Exited placement mode");
    }

    private SetMarkersVisible(folderName: string, visible: boolean) {
        const folder = Workspace.FindFirstChild(folderName);
        if (folder) {
            for (const child of folder.GetChildren()) {
                if (child.IsA("BasePart")) {
                    child.Transparency = visible ? 0.8 : 1;
                    if (visible) child.Color = Color3.fromRGB(200, 200, 255);
                }
            }
        }
    }

    private FindSnapPointAtMouse() {
        const mouse = player.GetMouse();
        if (!mouse.Target) return undefined;

        const mousePos = mouse.Hit.Position;
        const blueprint = this.selectedBlueprint ? Blueprints.Buildings[this.selectedBlueprint] : undefined;
        if (!blueprint) return undefined;

        const folderName = blueprint.PlacementType === "edge" ? "Edges" : "Vertices";
        const folder = Workspace.FindFirstChild(folderName);
        if (!folder) return undefined;

        let closest: BasePart | undefined;
        let closestDist = 45; // Max snap distance

        for (const marker of folder.GetChildren()) {
            if (marker.IsA("BasePart")) {
                const dist = marker.Position.sub(mousePos).Magnitude;
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = marker;
                }
            }
        }
        return closest;
    }

    private IsSnapPointValid(marker: BasePart, blueprintName: string, isSetupTurn: boolean, lastSetupTownKey?: string) {
        const blueprint = Blueprints.Buildings[blueprintName];
        if (!blueprint) return false;

        const key = marker.GetAttribute("Key") as string;
        if (!key) return false;

        if (blueprint.PlacementType === "edge") {
            const validation = validateRoadPlacement(this.gameState, player.UserId, key, isSetupTurn, lastSetupTownKey);
            return validation.valid;
        } else if (blueprint.PlacementType === "3-way" || blueprintName === "Town") {
            // Note: We use false for isSetupTurn in Town validation if we want strict rules, 
            // checking logic from original PlayerController:
            // "We'll pass `false` for `hasPlacedFirstTowns` if it's setup turn 1? ... Let's rely on GameRules"
            // The original code passed `isMySetupTurn` to validateTownPlacement.
            const validation = validateTownPlacement(this.gameState, player.UserId, key, isSetupTurn, false);
            return validation.valid;
        }
        return false;
    }

    public UpdatePreview(isSetupTurn: boolean = false, lastSetupTownKey?: string) {
        if (!this.IsActive || !this.selectedBlueprint) {
            if (this.buildingPreview) this.StopPlacement();
            return;
        }

        // Show valid markers
        const folderName = Blueprints.Buildings[this.selectedBlueprint].PlacementType === "edge" ? "Edges" : "Vertices";
        this.SetMarkersVisible(folderName, true);

        const snapPoint = this.FindSnapPointAtMouse();
        this.currentVertex = snapPoint;

        if (!snapPoint) {
            if (this.buildingPreview) this.buildingPreview.Transparency = 0.9;
            this.isValidPlacement = false;
            return;
        }

        const blueprint = Blueprints.Buildings[this.selectedBlueprint];
        const newValidState = this.IsSnapPointValid(snapPoint, this.selectedBlueprint, isSetupTurn, lastSetupTownKey);
        const currentKey = snapPoint.GetAttribute("Key") as string | undefined;

        // Only log if this is a new position or validity state changed for the same position
        const stateKey = `${currentKey ?? "unknown"}:${newValidState}`;
        const lastStateKey = `${this.lastLoggedKey ?? "unknown"}:${this.lastValidPlacement}`;

        if (stateKey !== lastStateKey) {
            if (newValidState) {
                Logger.Debug("Placement", `VALID placement at ${currentKey ?? "unknown"}`);
            } else {
                Logger.Debug("Placement", `[${player.Name}] REJECTED placement at ${currentKey ?? "unknown"}`);
            }
            this.lastValidPlacement = newValidState;
            this.lastLoggedKey = currentKey;
        }
        this.isValidPlacement = newValidState;

        // Create Preview
        if (!this.buildingPreview) {
            this.buildingPreview = new Instance("Part");
            this.buildingPreview.Name = "BuildingPreview";
            this.buildingPreview.Anchored = true;
            this.buildingPreview.CanCollide = false;
            this.buildingPreview.Transparency = 0.3;
            this.buildingPreview.Material = Enum.Material.Neon;
            this.buildingPreview.Parent = Workspace;
        }

        // Update Preview Transform
        if (blueprint.PlacementType === "edge") {
            this.buildingPreview.Size = new Vector3(37, 0.5, 4);
            this.buildingPreview.CFrame = snapPoint.CFrame.mul(new CFrame(0, 0.25, 0));
        } else {
            this.buildingPreview.Size = new Vector3(8, 0.5, 8);
            this.buildingPreview.CFrame = new CFrame(snapPoint.Position.add(new Vector3(0, 0.25, 0)));
        }

        this.buildingPreview.Color = this.isValidPlacement ? Color3.fromRGB(100, 255, 100) : Color3.fromRGB(255, 100, 100);
        this.buildingPreview.Transparency = 0.3;
    }

    public HandleInput(input: InputObject, isSetupTurn: boolean, lastSetupTownKey?: string): boolean {
        if (!this.IsActive) return false;

        const isC = input.KeyCode === Enum.KeyCode.C;
        const isEscape = input.KeyCode === Enum.KeyCode.Escape;
        const altPressed = UserInputService.IsKeyDown(Enum.KeyCode.LeftAlt) || UserInputService.IsKeyDown(Enum.KeyCode.RightAlt);

        if (isEscape || (isC && !altPressed)) {
            this.StopPlacement();
            return true;
        }

        if (input.UserInputType === Enum.UserInputType.MouseButton1) {
            if (this.currentVertex && this.isValidPlacement && this.selectedBlueprint) {
                const rotation = this.currentVertex.Rotation;
                const snapKey = this.currentVertex.GetAttribute("Key") as string | undefined;
                this.lastPlacedKey = snapKey;

                if (isSetupTurn) {
                    ClientEvents.SetupPlacement.fire(this.selectedBlueprint, this.currentVertex.Position);
                    Logger.Info("PlacementController", `[${player.Name}] Finalized setup placement for ${this.selectedBlueprint}`);
                    // Note: Caller needs to handle setup turn tracking (updating lastSetupTownKey etc)
                } else {
                    ClientEvents.PlaceFoundation.fire(this.selectedBlueprint, this.currentVertex.Position, rotation, snapKey ?? "");
                    Logger.Info("PlacementController", `[${player.Name}] Placed foundation for ${this.selectedBlueprint}`);
                }
                this.StopPlacement();
                return true;
            }
        }

        return false;
    }
}
