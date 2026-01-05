import { Players, UserInputService, RunService, Workspace } from "@rbxts/services";
import * as Logger from "shared/Logger";

const player = Players.LocalPlayer;
const camera = Workspace.CurrentCamera!;

// Constants
const ZOOM_THRESHOLD = 5;
const MAP_CAMERA_HEIGHT = 300;
const MAP_CAMERA_ANGLE = math.rad(-85);

export class CameraManager {
    private isFirstPerson = false;
    private isMapView = false;
    private cameraFocusPart: Part | undefined;

    private listeners: Array<() => void> = [];

    constructor() {
        // Initial Settings
        camera.CameraType = Enum.CameraType.Custom;
        camera.FieldOfView = 80;
        player.CameraMaxZoomDistance = 400;
        player.CameraMinZoomDistance = 0.5;

        RunService.RenderStepped.Connect((dt) => this.OnUpdate(dt));
    }

    public IsMapView() {
        return this.isMapView;
    }

    public ToggleMapView() {
        this.isMapView = !this.isMapView;
        if (!this.isMapView) {
            this.ResetCamera();
        }
        Logger.Info("CameraManager", `Map View: ${this.isMapView ? "Enabled" : "Disabled"}`);
    }

    public ResetCamera() {
        this.isMapView = false;
        camera.CameraType = Enum.CameraType.Custom;
        if (player.Character) {
            const humanoid = player.Character.FindFirstChildOfClass("Humanoid");
            if (humanoid) camera.CameraSubject = humanoid;
        }
        Logger.Info("CameraManager", "Camera manually reset");
    }

    private GetCameraFocus() {
        if (!this.cameraFocusPart) {
            this.cameraFocusPart = new Instance("Part");
            this.cameraFocusPart.Name = "CameraFocus";
            this.cameraFocusPart.Anchored = true;
            this.cameraFocusPart.CanCollide = false;
            this.cameraFocusPart.Transparency = 1;
            this.cameraFocusPart.Size = new Vector3(1, 1, 1);
            this.cameraFocusPart.Position = new Vector3(0, 5, 0);
            this.cameraFocusPart.Parent = Workspace;
        }
        return this.cameraFocusPart;
    }

    private UpdateMouseMode(shouldUnlock: boolean) {
        const character = player.Character;
        if (!character || !character.FindFirstChild("Head") || shouldUnlock) {
            if (UserInputService.MouseBehavior !== Enum.MouseBehavior.Default) {
                UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
                UserInputService.MouseIconEnabled = true;
            }
            return;
        }

        // Calculate distance
        const head = character.FindFirstChild("Head") as BasePart;
        const distance = camera.CFrame.Position.sub(head.Position).Magnitude;
        const shouldBeFirstPerson = distance < ZOOM_THRESHOLD;

        if (shouldBeFirstPerson !== this.isFirstPerson) {
            this.isFirstPerson = shouldBeFirstPerson;
            if (this.isFirstPerson) {
                UserInputService.MouseBehavior = Enum.MouseBehavior.LockCenter;
                UserInputService.MouseIconEnabled = false;
                Logger.Debug("CameraManager", "Entered first-person mode");
            } else {
                UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
                UserInputService.MouseIconEnabled = true;
                Logger.Debug("CameraManager", "Entered third-person mode");
            }
        }
    }

    public UpdateCameraSubject(placementMode: boolean, isSetupTurn: boolean) {
        if (placementMode || isSetupTurn) {
            const focus = this.GetCameraFocus();
            if (camera.CameraSubject !== focus) {
                const char = player.Character;
                if (char && char.PrimaryPart && focus.Position.Magnitude < 10) { // Just init check
                    focus.Position = char.PrimaryPart.Position;
                }
                camera.CameraSubject = focus;
                camera.CameraType = Enum.CameraType.Custom;
            }
        } else if (!this.isMapView) {
            const char = player.Character;
            const hum = char?.FindFirstChildOfClass("Humanoid");
            if (hum && camera.CameraSubject !== hum) {
                camera.CameraSubject = hum;
                camera.CameraType = Enum.CameraType.Custom;
            }
        }
    }

    private OnUpdate(deltaTime: number) {
        // NOTE: Mouse unlock logic is partially dependent on UI state which is outside.
        // We'll expose a method or rely on the Controller to pass "shouldUnlock"
    }

    // Called by main controller
    public Update(deltaTime: number, placementMode: boolean, isSetupTurn: boolean, uiOpen: boolean) {
        const shouldFreeMouse = uiOpen || placementMode || this.isMapView || isSetupTurn;
        this.UpdateMouseMode(shouldFreeMouse);
        this.UpdateCameraSubject(placementMode, isSetupTurn);

        if (this.isMapView) {
            camera.CameraType = Enum.CameraType.Scriptable;
            const targetPos = new Vector3(0, 0, 0); // Or center of map
            const targetCFrame = new CFrame(targetPos.add(new Vector3(0, MAP_CAMERA_HEIGHT, 0)))
                .mul(CFrame.Angles(MAP_CAMERA_ANGLE, 0, 0));
            camera.CFrame = camera.CFrame.Lerp(targetCFrame, 0.1);
        }

        // Pan logic
        if (placementMode || isSetupTurn) {
            const focus = this.GetCameraFocus();
            let moveDir = new Vector3(0, 0, 0);
            const look = camera.CFrame.LookVector;
            const right = camera.CFrame.RightVector;
            const flatLook = new Vector3(look.X, 0, look.Z).Unit;
            const flatRight = new Vector3(right.X, 0, right.Z).Unit;

            if (UserInputService.IsKeyDown(Enum.KeyCode.W)) moveDir = moveDir.add(flatLook);
            if (UserInputService.IsKeyDown(Enum.KeyCode.S)) moveDir = moveDir.sub(flatLook);
            if (UserInputService.IsKeyDown(Enum.KeyCode.A)) moveDir = moveDir.sub(flatRight);
            if (UserInputService.IsKeyDown(Enum.KeyCode.D)) moveDir = moveDir.add(flatRight);
            if (UserInputService.IsKeyDown(Enum.KeyCode.Q)) moveDir = moveDir.add(new Vector3(0, 1, 0));
            if (UserInputService.IsKeyDown(Enum.KeyCode.E)) moveDir = moveDir.sub(new Vector3(0, 1, 0));

            if (moveDir.Magnitude > 0) {
                const panSpeed = UserInputService.IsKeyDown(Enum.KeyCode.LeftShift) ? 200 : 100;
                focus.Position = focus.Position.add(moveDir.Unit.mul(panSpeed * deltaTime));
            }
        }
    }
}
