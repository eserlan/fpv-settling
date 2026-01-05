// Client-side Player Controller
const ReplicatedStorage = game.GetService("ReplicatedStorage");
import { ClientEvents } from "./ClientEvents";
const Players = game.GetService("Players");
const UserInputService = game.GetService("UserInputService");
const RunService = game.GetService("RunService");

import * as Logger from "shared/Logger";
import Blueprints from "shared/Blueprints";

type BlueprintBookUIType = {
	Toggle: () => void;
	IsOpen: () => boolean;
	OnBlueprintSelected: (cb: (blueprintName: string, blueprintData: import("shared/Blueprints").BlueprintInfo) => void) => void;
};

// Building placement state
let placementMode = false;
let selectedBlueprint: string | undefined;
let buildingPreview: Part | undefined;
let currentVertex: BasePart | undefined;
let isValidPlacement = false;
let lastValidPlacement: boolean | undefined; // Track to log only on change
let lastLoggedKey: string | undefined; // Track location to log change
let lastBlueprintSelectionTime = 0;
let isGameStarted = false;
let isMySetupTurn = false;
let currentSetupStep: "Town1" | "Road1" | "Town2" | "Road2" | undefined;

// Camera Focus for free placement view
let cameraFocusPart: Part | undefined;
const getCameraFocus = () => {
	if (!cameraFocusPart) {
		cameraFocusPart = new Instance("Part");
		cameraFocusPart.Name = "CameraFocus";
		cameraFocusPart.Anchored = true;
		cameraFocusPart.CanCollide = false;
		cameraFocusPart.Transparency = 1;
		cameraFocusPart.Size = new Vector3(1, 1, 1);
		cameraFocusPart.Position = new Vector3(0, 5, 0);
		cameraFocusPart.Parent = game.Workspace;
	}
	return cameraFocusPart;
};

const updateCameraSubject = () => {
	if (placementMode || (!isGameStarted && currentSetupStep !== undefined)) {
		const focus = getCameraFocus();
		if (camera.CameraSubject !== focus) {
			// Center focus on character initially if we just entered
			const char = player.Character;
			if (char && char.PrimaryPart && focus.Position.Magnitude === 5) {
				focus.Position = char.PrimaryPart.Position;
			}
			camera.CameraSubject = focus;
			camera.CameraType = Enum.CameraType.Custom;
		}
	} else if (!isMapView) {
		const char = player.Character;
		const hum = char?.FindFirstChildOfClass("Humanoid");
		if (hum && camera.CameraSubject !== hum) {
			camera.CameraSubject = hum;
			camera.CameraType = Enum.CameraType.Custom;
		}
	}
};

ClientEvents.GameStart.connect(() => {
	isGameStarted = true;
	isMySetupTurn = false;
});

ClientEvents.SetupTurnUpdate.connect((userId, step) => {
	isMySetupTurn = (userId === player.UserId);
	currentSetupStep = step;

	if (isMySetupTurn) {
		const blueprintToSelect = step.sub(1, 4) === "Town" ? "Town" : "Road";
		selectedBlueprint = blueprintToSelect;
		placementMode = true;
		camera.CameraType = Enum.CameraType.Custom;
		Logger.Info("PlayerController", `It's your setup turn! Please place a ${blueprintToSelect}.`);
	} else if (placementMode) {
		// Exit placement mode if it was their turn but now it's someone else's (safety)
		exitPlacementMode();
	}
});

// Wait for BlueprintBookUI to be available
let BlueprintBookUI: BlueprintBookUIType | undefined;
task.spawn(() => {
	const [success, result] = pcall(() => {
		const module = script.Parent?.WaitForChild("BlueprintBookUI", 10) as ModuleScript | undefined;
		if (!module) {
			throw "BlueprintBookUI not found";
		}
		return require(module) as BlueprintBookUIType;
	});
	if (success) {
		BlueprintBookUI = result as BlueprintBookUIType;
		Logger.Info("PlayerController", "BlueprintBookUI loaded");

		// Hook up selection callback immediately upon loading
		BlueprintBookUI.OnBlueprintSelected((blueprintName, _blueprintData) => {
			// Debounce: ignore if called within 100ms of last selection
			const now = os.clock();
			if (now - lastBlueprintSelectionTime < 0.1) {
				return;
			}
			lastBlueprintSelectionTime = now;

			selectedBlueprint = blueprintName;
			placementMode = true;
			camera.CameraType = Enum.CameraType.Custom;
			Logger.Info("PlayerController", `[${player.Name}] Entering placement mode for: ${blueprintName}`);
		});
	} else {
		Logger.Error("PlayerController", `Failed to load BlueprintBookUI: ${result}`);
	}
});

const player = Players.LocalPlayer;
const camera = game.Workspace.CurrentCamera!;
// Camera settings
camera.CameraType = Enum.CameraType.Custom;
camera.FieldOfView = 80;
player.CameraMaxZoomDistance = 400; // Allow "free" zooming
player.CameraMinZoomDistance = 0.5;

// Zoom threshold - below this distance, lock mouse (FPV mode)
const ZOOM_THRESHOLD = 5; // studs

// Speed settings
const WALK_SPEED = 16;
const RUN_SPEED = 32;

// Track current mode
let isFirstPerson = false;
let isSprinting = false;
let isMapView = false;
const MAP_CAMERA_HEIGHT = 300;
const MAP_CAMERA_ANGLE = math.rad(-85);

// Update player speed based on sprint state
const updateSpeed = () => {
	const character = player.Character;
	if (!character) {
		return;
	}

	const humanoid = character.FindFirstChild("Humanoid");
	if (humanoid && humanoid.IsA("Humanoid")) {
		humanoid.WalkSpeed = isSprinting ? RUN_SPEED : WALK_SPEED;
	}
};

// Function to update mouse lock based on camera distance
const updateMouseMode = () => {
	const character = player.Character;
	if (!character) {
		return;
	}

	const head = character.FindFirstChild("Head");
	if (!head || !head.IsA("BasePart")) {
		return;
	}

	// Don't lock mouse if blueprint book or placement mode is active
	// Also don't lock if in setup phase (to allow free camera)
	if ((BlueprintBookUI && BlueprintBookUI.IsOpen()) || placementMode || isMapView || (!isGameStarted && currentSetupStep !== undefined)) {
		if (UserInputService.MouseBehavior !== Enum.MouseBehavior.Default) {
			UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
			UserInputService.MouseIconEnabled = true;
		}
		return;
	}

	// Calculate distance from camera to character head
	const distance = camera.CFrame.Position.sub(head.Position).Magnitude;

	// Check if we should be in first-person mode
	const shouldBeFirstPerson = distance < ZOOM_THRESHOLD;

	if (shouldBeFirstPerson !== isFirstPerson) {
		isFirstPerson = shouldBeFirstPerson;

		if (isFirstPerson) {
			// First-person mode: lock mouse
			if (UserInputService.MouseBehavior !== Enum.MouseBehavior.LockCenter) {
				UserInputService.MouseBehavior = Enum.MouseBehavior.LockCenter;
				UserInputService.MouseIconEnabled = false;
			}
			Logger.Debug("PlayerController", "Entered first-person mode");
		} else {
			// Third-person mode: free mouse
			if (UserInputService.MouseBehavior !== Enum.MouseBehavior.Default) {
				UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
				UserInputService.MouseIconEnabled = true;
			}
			Logger.Debug("PlayerController", "Entered third-person mode (mouse unlocked)");
		}
	}
};

// Find snapping point (vertex or edge) at mouse position
const findSnapPointAtMouse = () => {
	const mouse = player.GetMouse();
	if (!mouse.Target) {
		return undefined;
	}

	const mousePos = mouse.Hit.Position;
	const blueprint = selectedBlueprint ? Blueprints.Buildings[selectedBlueprint] : undefined;
	if (!blueprint) {
		return undefined;
	}

	let folderName = "Vertices";
	if (blueprint.PlacementType === "edge") {
		folderName = "Edges";
	}

	const folder = game.Workspace.FindFirstChild(folderName);
	if (!folder) {
		return undefined;
	}

	let closest: BasePart | undefined;
	let closestDist = 45; // Max snap distance (Increased for better feel with HEX_SIZE 40)

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
};

// Check if snap point is valid for selected blueprint
const isSnapPointValidForBlueprint = (marker: BasePart | undefined, blueprintName: string | undefined) => {
	if (!marker || !blueprintName) {
		return false;
	}

	const blueprint = Blueprints.Buildings[blueprintName];
	if (!blueprint) {
		return false;
	}

	// Helper to find owner of a building at a position/key
	const getOwnerAt = (key: string, folderName: string) => {
		const folder = game.Workspace.FindFirstChild(folderName);
		if (!folder) {
			return undefined;
		}
		for (const model of folder.GetChildren()) {
			if (model.IsA("Model")) {
				const base = model.FindFirstChild("FoundationBase") ?? model.PrimaryPart;
				if (base && base.IsA("BasePart") && base.GetAttribute("Key") === key) {
					return base.GetAttribute("OwnerId") as number | undefined;
				}
			}
		}
		return undefined;
	};

	// Helper to check if a vertex key is occupied by ANY building
	const isVertexOccupied = (key: string | undefined) => {
		if (!key) {
			return false;
		}
		const folders = ["Towns", "Buildings"];
		for (const folderName of folders) {
			const folder = game.Workspace.FindFirstChild(folderName);
			if (folder) {
				for (const model of folder.GetChildren()) {
					if (model.IsA("Model")) {
						const base = model.FindFirstChild("FoundationBase") ?? model.PrimaryPart;
						if (base && base.IsA("BasePart") && base.GetAttribute("Key") === key) {
							return true;
						}
					}
				}
			}
		}
		return false;
	};

	// 1. Check for open sea (must touch at least one land tile)
	if (blueprint.PlacementType === "edge") {
		const adjLand = (marker.GetAttribute("AdjacentLandTileCount") as number);
		if (adjLand === 0) return false;
	} else if (blueprint.PlacementType === "3-way" || blueprintName === "Town") {
		const adjLand = (marker.GetAttribute("AdjacentLandTileCount") as number);
		if (adjLand === 0) return false;
	}

	// Adjacency rules
	if (blueprint.PlacementType === "3-way") {
		const myKey = marker.GetAttribute("Key") as string | undefined;

		if (isVertexOccupied(myKey)) {
			return false;
		}

		for (let i = 1; i <= 6; i += 1) {
			const neighborKey = marker.GetAttribute(`Neighbor_${i}`) as string | undefined;
			if (neighborKey && isVertexOccupied(neighborKey)) {
				return false;
			}
		}

		// Check how many towns/foundations the player already has
		const countOwnedTowns = () => {
			let count = 0;
			const folders = ["Towns", "Buildings"];
			for (const folderName of folders) {
				const f = game.Workspace.FindFirstChild(folderName);
				if (f) {
					for (const m of f.GetChildren()) {
						if (m.IsA("Model")) {
							const b = m.FindFirstChild("FoundationBase") ?? m.PrimaryPart;
							const isActuallyTown = m.Name.find("Town")[0] !== undefined || m.Name.find("City")[0] !== undefined || b?.GetAttribute("BlueprintName") === "Town";
							if (b && b.IsA("BasePart") && b.GetAttribute("OwnerId") === player.UserId && (m.Name.find("Town")[0] !== undefined || m.Name.find("City")[0] !== undefined)) {
								count += 1;
							}
						}
					}
				}
			}
			return count;
		};

		const ownedTownCount = countOwnedTowns();

		if (ownedTownCount < 2 || isMySetupTurn) {
			return true;
		}

		// Subsequent towns must be connected via road (standard Catan)
		let ownedRoadFound = false;
		const bFolder = game.Workspace.FindFirstChild("Buildings");
		if (bFolder) {
			for (const m of bFolder.GetChildren()) {
				if (m.IsA("Model")) {
					const b = m.FindFirstChild("FoundationBase") ?? m.PrimaryPart;
					if (b && b.IsA("BasePart") && b.GetAttribute("OwnerId") === player.UserId) {
						const key = b.GetAttribute("Key") as string | undefined;
						// Road keys are "V1:V2". We check if our vertex key is part of it.
						if (key && myKey && (key.find(myKey, 1, true)[0] !== undefined)) {
							ownedRoadFound = true;
							break;
						}
					}
				}
			}
		}

		if (ownedRoadFound) {
			return true;
		}

		return false;
	} else if (blueprint.PlacementType === "edge") {
		// During setup turn, we are more lenient with road checks to avoid replication lag issues
		if (isMySetupTurn) return true;

		// Roads MUST connect to a town or road you own
		const v1 = marker.GetAttribute("Vertex1") as string | undefined;
		const v2 = marker.GetAttribute("Vertex2") as string | undefined;

		// Check for owned town at either vertex endpoint
		const folders = ["Towns", "Buildings"];
		for (const folder of folders) {
			const f = game.Workspace.FindFirstChild(folder);
			if (f) {
				for (const model of f.GetChildren()) {
					if (model.IsA("Model")) {
						const base = model.FindFirstChild("FoundationBase") ?? model.PrimaryPart;
						if (base && base.IsA("BasePart")) {
							const ownerId = base.GetAttribute("OwnerId");
							const townKey = base.GetAttribute("Key") as string | undefined;

							if (ownerId === player.UserId) {
								// Check if town's key matches either vertex of this edge
								if (townKey && (townKey === v1 || townKey === v2)) {
									return true;
								}
							}
						}
					}
				}
			}
		}

		// Check for owned road that shares a vertex
		const f = game.Workspace.FindFirstChild("Buildings");
		if (f) {
			for (const model of f.GetChildren()) {
				if (model.IsA("Model")) {
					const base = model.FindFirstChild("FoundationBase") ?? model.PrimaryPart;
					if (base && base.IsA("BasePart") && base.GetAttribute("OwnerId") === player.UserId) {
						// Road keys are stored as "vertex1:vertex2"
						// Check if this road shares a vertex with the new road
						const roadKey = base.GetAttribute("Key") as string | undefined;
						if (roadKey && v1 && v2) {
							// Parse the existing road's vertices
							const parts = string.split(roadKey, ":");
							const roadV1 = parts[0];
							const roadV2 = parts[1];

							// Check if any vertex matches
							if (roadV1 === v1 || roadV1 === v2 || roadV2 === v1 || roadV2 === v2) {
								return true;
							}
						}
					}
				}
			}
		}

		// Only log rejection once when placement changes, not every frame
		return false;
	}

	return false;
};

// Create or update building preview
const updatePlacementPreview = () => {
	if (!placementMode || !selectedBlueprint) {
		if (buildingPreview) {
			buildingPreview.Destroy();
			buildingPreview = undefined;
		}
		// Hide markers when not in placement mode
		const vFolder = game.Workspace.FindFirstChild("Vertices");
		if (vFolder) {
			for (const v of vFolder.GetChildren()) {
				if (v.IsA("BasePart")) {
					v.Transparency = 1;
				}
			}
		}
		const eFolder = game.Workspace.FindFirstChild("Edges");
		if (eFolder) {
			for (const e of eFolder.GetChildren()) {
				if (e.IsA("BasePart")) {
					e.Transparency = 1;
				}
			}
		}
		return;
	}

	// Make valid snap points visible while building
	const folderName = Blueprints.Buildings[selectedBlueprint].PlacementType === "edge" ? "Edges" : "Vertices";
	const folder = game.Workspace.FindFirstChild(folderName);
	if (folder) {
		for (const marker of folder.GetChildren()) {
			if (marker.IsA("BasePart")) {
				marker.Transparency = 0.8;
				marker.Color = Color3.fromRGB(200, 200, 255);
			}
		}
	}

	const snapPoint = findSnapPointAtMouse();
	currentVertex = snapPoint;

	if (!snapPoint) {
		if (buildingPreview) {
			buildingPreview.Transparency = 0.9;
		}
		isValidPlacement = false;
		return;
	}

	const blueprint = Blueprints.Buildings[selectedBlueprint];
	const newValidState = isSnapPointValidForBlueprint(snapPoint, selectedBlueprint);
	const currentKey = snapPoint.GetAttribute("Key") as string | undefined;

	// Only log when validity state changes OR we moved to a new key
	if (newValidState !== lastValidPlacement || currentKey !== lastLoggedKey) {
		if (newValidState) {
			Logger.Debug("Placement", `VALID placement at ${currentKey ?? "unknown"}`);
		} else {
			Logger.Info("Placement", `[${player.Name}] REJECTED placement at ${currentKey ?? "unknown"}`);
		}
		lastValidPlacement = newValidState;
		lastLoggedKey = currentKey;
	}
	isValidPlacement = newValidState;

	// Create preview if it doesn't exist
	if (!buildingPreview) {
		buildingPreview = new Instance("Part");
		buildingPreview.Name = "BuildingPreview";
		buildingPreview.Anchored = true;
		buildingPreview.CanCollide = false;
		buildingPreview.Transparency = 0.3; // More visible
		buildingPreview.Material = Enum.Material.Neon;
		buildingPreview.Parent = game.Workspace;
	}

	// Update preview size and rotation
	if (blueprint.PlacementType === "edge") {
		buildingPreview.Size = new Vector3(37, 0.5, 4);
		buildingPreview.CFrame = snapPoint.CFrame.mul(new CFrame(0, 0.25, 0));
	} else {
		buildingPreview.Size = new Vector3(8, 0.5, 8);
		buildingPreview.CFrame = new CFrame(snapPoint.Position.add(new Vector3(0, 0.25, 0)));
	}

	// Color based on validity
	if (isValidPlacement) {
		buildingPreview.Color = Color3.fromRGB(100, 255, 100); // Green = valid
	} else {
		buildingPreview.Color = Color3.fromRGB(255, 100, 100); // Red = invalid
	}

	buildingPreview.Transparency = 0.3;
};

// Exit placement mode
const exitPlacementMode = () => {
	placementMode = false;
	selectedBlueprint = undefined;
	lastValidPlacement = undefined;
	lastLoggedKey = undefined;
	if (buildingPreview) {
		buildingPreview.Destroy();
		buildingPreview = undefined;
	}
	Logger.Debug("PlayerController", "Exited placement mode");
};

// Foundation interaction state
let nearbyFoundation:
	| {
		Id: number;
		Model: Model;
		Part: BasePart;
	}
	| undefined;

const createDepositPrompt = () => {
	const screenGui = new Instance("ScreenGui");
	screenGui.Name = "DepositPrompt";
	screenGui.ResetOnSpawn = false;
	screenGui.Parent = player.WaitForChild("PlayerGui") as PlayerGui;

	const frame = new Instance("Frame");
	frame.Name = "PromptFrame";
	frame.Size = new UDim2(0, 300, 0, 60);
	frame.Position = new UDim2(0.5, -150, 0.6, 0);
	frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
	frame.BackgroundTransparency = 0.3;
	frame.BorderSizePixel = 0;
	frame.Visible = false;
	frame.Parent = screenGui;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, 10);
	corner.Parent = frame;

	const label = new Instance("TextLabel");
	label.Name = "Text";
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.TextColor3 = new Color3(1, 1, 1);
	label.Font = Enum.Font.GothamBold;
	label.TextSize = 18;
	label.Text = "Press E to deposit resource";
	label.Parent = frame;

	return $tuple(screenGui, frame);
};

const [depositPromptGui, promptFrame] = createDepositPrompt();

// Find nearby foundation
const findNearbyFoundation = () => {
	const character = player.Character;
	if (!character || !character.PrimaryPart) {
		return undefined;
	}

	const playerPos = character.PrimaryPart.Position;
	let closest:
		| {
			Id: number;
			Model: Model;
			Part: BasePart;
		}
		| undefined;
	let closestDist = 15; // Max interaction distance
	let foundCount = 0;

	// Search all of game.Workspace to be more robust than just checking specific folders
	for (const object of game.Workspace.GetChildren()) {
		// Also check inside folders if they exist
		let searchArea = [object];
		if (object.IsA("Folder") && (object.Name === "Buildings" || object.Name === "Towns")) {
			searchArea = object.GetChildren();
		}

		for (const model of searchArea) {
			if (model.IsA("Model")) {
				const basePart = model.FindFirstChild("FoundationBase");
				if (basePart && basePart.IsA("BasePart")) {
					const foundationId = basePart.GetAttribute("FoundationId");
					const ownerId = basePart.GetAttribute("OwnerId");

					if (foundationId !== undefined) {
						foundCount += 1;
						const dist = basePart.Position.sub(playerPos).Magnitude;

						// Only interact with own foundations
						if (ownerId === player.UserId) {
							if (dist < closestDist) {
								closestDist = dist;
								closest = {
									Id: foundationId as number,
									Model: model,
									Part: basePart,
								};
							}
						}
					}
				}
			}
		}
	}

	// Store for debug logging
	(_G as Record<string, unknown>).FoundFoundations = foundCount;
	return closest;
};

// Update every frame
RunService.RenderStepped.Connect((deltaTime) => {
	updateMouseMode();
	updatePlacementPreview();
	updateCameraSubject();

	// Handle Map View (Locked Top-Down)
	if (isMapView) {
		camera.CameraType = Enum.CameraType.Scriptable;
		const targetPos = new Vector3(0, 0, 0);
		const targetCFrame = new CFrame(targetPos.add(new Vector3(0, MAP_CAMERA_HEIGHT, 0)))
			.mul(CFrame.Angles(MAP_CAMERA_ANGLE, 0, 0));

		camera.CFrame = camera.CFrame.Lerp(targetCFrame, 0.1);
	}

	// Handle Camera Panning in Placement/Setup Mode
	if (placementMode || (!isGameStarted && currentSetupStep !== undefined)) {
		const focus = getCameraFocus();
		let moveDir = new Vector3(0, 0, 0);

		// Use camera-relative movement for panning
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

	// Check for nearby foundation (when not in placement mode)
	if (!placementMode) {
		const lastFoundation = nearbyFoundation;
		nearbyFoundation = findNearbyFoundation();

		if (nearbyFoundation && !lastFoundation) {
			Logger.Info("PlayerController", `[${player.Name}] Now NEAR foundation: ${nearbyFoundation.Id}`);
		}

		if (nearbyFoundation && promptFrame) {
			promptFrame.Visible = true;
			const textLabel = promptFrame.FindFirstChild("Text");
			if (textLabel && textLabel.IsA("TextLabel")) {
				textLabel.Text = "Press E to deposit resources";
			}
		} else if (promptFrame) {
			promptFrame.Visible = false;
		}
	} else if (promptFrame) {
		promptFrame.Visible = false;
	}
});

// Handle input
UserInputService.InputBegan.Connect((input, gameProcessed) => {
	if (gameProcessed) {
		return;
	}

	// Toggle Blueprint Book with 'B' key
	if (input.KeyCode === Enum.KeyCode.B && isGameStarted) {
		if (placementMode) {
			exitPlacementMode();
		} else if (BlueprintBookUI) {
			BlueprintBookUI.Toggle();
		}
	}

	// Toggle Map View with 'M' key
	if (input.KeyCode === Enum.KeyCode.M && isGameStarted) {
		isMapView = !isMapView;
		if (!isMapView) {
			camera.CameraType = Enum.CameraType.Custom;
			if (player.Character) {
				const humanoid = player.Character.FindFirstChildOfClass("Humanoid");
				if (humanoid) camera.CameraSubject = humanoid;
			}
		}
		Logger.Info("PlayerController", `Map View: ${isMapView ? "Enabled" : "Disabled"}`);
	}

	// Manual Camera Reset with 'V' key
	if (input.KeyCode === Enum.KeyCode.V && isGameStarted) {
		isMapView = false;
		camera.CameraType = Enum.CameraType.Custom;
		if (player.Character) {
			const humanoid = player.Character.FindFirstChildOfClass("Humanoid");
			if (humanoid) camera.CameraSubject = humanoid;
		}
		Logger.Info("PlayerController", "Camera manually reset");
	}

	// Cancel placement with Escape or C
	if (placementMode) {
		const isC = input.KeyCode === Enum.KeyCode.C;
		const isEscape = input.KeyCode === Enum.KeyCode.Escape;
		const altPressed = UserInputService.IsKeyDown(Enum.KeyCode.LeftAlt) || UserInputService.IsKeyDown(Enum.KeyCode.RightAlt);

		if (isEscape || (isC && !altPressed)) {
			exitPlacementMode();
		}
	}

	// Place structure
	if (placementMode && input.UserInputType === Enum.UserInputType.MouseButton1) {
		if (currentVertex && isValidPlacement && selectedBlueprint) {
			const rotation = currentVertex.Rotation;
			const snapKey = currentVertex.GetAttribute("Key") as string | undefined;

			if (isMySetupTurn) {
				ClientEvents.SetupPlacement.fire(selectedBlueprint, currentVertex.Position);
				Logger.Info("PlayerController", `[${player.Name}] Finalized setup placement for ${selectedBlueprint}`);
				isMySetupTurn = false; // Reset locally to avoid double fire
			} else {
				ClientEvents.PlaceFoundation.fire(selectedBlueprint, currentVertex.Position, rotation, snapKey ?? "");
				Logger.Info("PlayerController", `[${player.Name}] Placed foundation for ${selectedBlueprint}`);
			}

			exitPlacementMode();
		} else {
			// Fail silently or play a sound, but don't spam warn logs
		}
	}

	// Deposit resource into foundation with E key
	if (input.KeyCode === Enum.KeyCode.E && isGameStarted) {
		if (nearbyFoundation) {
			Logger.Debug("PlayerController", `Pressing E near foundation: ${nearbyFoundation.Id}`);
			// Deposit wood first, then brick, wheat, wool, ore in order
			const resourcesToTry = ["Wood", "Brick", "Wheat", "Wool", "Ore"];
			for (const resourceType of resourcesToTry) {
				ClientEvents.DepositResource.fire(nearbyFoundation.Id, resourceType);
			}
		} else {
			const totalFound = (_G as Record<string, number>).FoundFoundations ?? 0;
			if (totalFound === 0) {
				Logger.Debug(
					"PlayerController",
					"Pressing E, but NO foundations with 'FoundationBase' were found in game.Workspace at all.",
				);
			} else {
				Logger.Debug(
					"PlayerController",
					`Pressing E, found ${totalFound} foundations in game.Workspace, but none close enough (15 studs) or owned by you.`,
				);
			}
		}
	}

	// Hire Worker with 'H' key
	if (input.KeyCode === Enum.KeyCode.H && isGameStarted) {
		const character = player.Character;
		if (character && character.PrimaryPart) {
			ClientEvents.HireNPC.fire("Worker", character.PrimaryPart.Position);
			Logger.Debug("PlayerController", "Requested Worker hire");
		}
	}

	// Hire Guard with 'G' key
	if (input.KeyCode === Enum.KeyCode.G && isGameStarted) {
		const character = player.Character;
		if (character && character.PrimaryPart) {
			ClientEvents.HireNPC.fire("Guard", character.PrimaryPart.Position);
			Logger.Debug("PlayerController", "Requested Guard hire");
		}
	}



	// Sprint with Shift
	if (input.KeyCode === Enum.KeyCode.LeftShift || input.KeyCode === Enum.KeyCode.RightShift) {
		isSprinting = true;
		updateSpeed();
	}
});

// Handle key release
UserInputService.InputEnded.Connect((input) => {
	// Stop sprinting when shift is released
	if (input.KeyCode === Enum.KeyCode.LeftShift || input.KeyCode === Enum.KeyCode.RightShift) {
		isSprinting = false;
		updateSpeed();
	}
});

Logger.Info("PlayerController", "Initialized");

export = {};
