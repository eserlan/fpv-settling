// Client-side Player Controller
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");
const UserInputService = game.GetService("UserInputService");
const RunService = game.GetService("RunService");

import * as Logger from "shared/Logger";
import { ClientEvents } from "./ClientEvents";
import { WorkspaceGameState } from "shared/lib/WorkspaceGameState";

import { CameraManager } from "./controllers/CameraManager";
import { PlacementController } from "./controllers/PlacementController";
import { InteractionController } from "./controllers/InteractionController";

type BlueprintBookUIType = {
	Toggle: () => void;
	IsOpen: () => boolean;
	OnBlueprintSelected: (cb: (blueprintName: string, blueprintData: import("shared/Blueprints").BlueprintInfo) => void) => void;
};

// State
let isGameStarted = false;
let isMySetupTurn = false;
let currentSetupStep: "Town1" | "Road1" | "Town2" | "Road2" | undefined;
let lastSetupTownVertexKey: string | undefined;

// Sprinting State
let isSprinting = false;
const WALK_SPEED = 16;
const RUN_SPEED = 32;

// Managers
const gameState = new WorkspaceGameState();
const cameraManager = new CameraManager();
const placementController = new PlacementController(gameState);
const interactionController = new InteractionController();

const player = Players.LocalPlayer;

// ==========================================
// Setup & Events
// ==========================================

ClientEvents.GameStart.connect(() => {
	isGameStarted = true;
	isMySetupTurn = false;
});

ClientEvents.SetupTurnUpdate.connect((userId, step) => {
	isMySetupTurn = (userId === player.UserId);
	currentSetupStep = step;

	if (isMySetupTurn) {
		const blueprintToSelect = step.sub(1, 4) === "Town" ? "Town" : "Road";
		placementController.StartPlacement(blueprintToSelect);
		Logger.Info("PlayerController", `It's your setup turn! Please place a ${blueprintToSelect}.`);
	} else if (placementController.IsActive) {
		// Exit placement mode if it was their turn but now it's someone else's (safety)
		placementController.StopPlacement();
	}
});

// Blueprint UI Loading
let BlueprintBookUI: BlueprintBookUIType | undefined;
task.spawn(() => {
	const [success, result] = pcall(() => {
		const module = script.Parent?.WaitForChild("BlueprintBookUI", 10) as ModuleScript | undefined;
		if (!module) throw "BlueprintBookUI not found";
		return require(module) as BlueprintBookUIType;
	});
	if (success) {
		BlueprintBookUI = result as BlueprintBookUIType;
		Logger.Info("PlayerController", "BlueprintBookUI loaded");

		let lastSelection = 0;
		BlueprintBookUI.OnBlueprintSelected((blueprintName, _blueprintData) => {
			const now = os.clock();
			if (now - lastSelection < 0.1) return;
			lastSelection = now;

			placementController.StartPlacement(blueprintName);
		});
	} else {
		Logger.Error("PlayerController", `Failed to load BlueprintBookUI: ${result}`);
	}
});

// ==========================================
// Main Loop
// ==========================================

const updateSpeed = () => {
	const character = player.Character;
	if (!character) return;
	const humanoid = character.FindFirstChild("Humanoid");
	if (humanoid && humanoid.IsA("Humanoid")) {
		humanoid.WalkSpeed = isSprinting ? RUN_SPEED : WALK_SPEED;
	}
};

RunService.RenderStepped.Connect((deltaTime) => {
	// 1. Placement Update
	if (placementController.IsActive) {
		placementController.UpdatePreview(isMySetupTurn, lastSetupTownVertexKey);
	}

	// 2. Camera Update
	const uiOpen = BlueprintBookUI?.IsOpen() ?? false;
	const isSetup = !isGameStarted && currentSetupStep !== undefined;
	cameraManager.Update(deltaTime, placementController.IsActive, isSetup, uiOpen);

	// 3. Interaction Update is handled internally in InteractionController via RenderStepped for now.
	// We could move it here, but it's fine.
});

// ==========================================
// Input Handling
// ==========================================

UserInputService.InputBegan.Connect((input, gameProcessed) => {
	if (gameProcessed) return;

	// 1. Route to Placement
	if (placementController.HandleInput(input, isMySetupTurn, lastSetupTownVertexKey)) {
		// If setup placement finished, handle state update
		if (isMySetupTurn && !placementController.IsActive) { // It just stopped
			if (currentSetupStep?.sub(1, 4) === "Town" && placementController.GetLastPlacedKey()) {
				// We need access to the key. PlacementController handled the firing, 
				// but we need to track lastSetupTownVertexKey for the Road step.
				lastSetupTownVertexKey = placementController.GetLastPlacedKey();
				// This is a bit tricky since PlacementController just fired and closed.
				// We might need an event from PlacementController?
				// Quick fix: We can't easily get the key here unless PlacementController exposes "LastPlacedKey".
				// Or we trust Server validation. 
				// Actually, `PlayerController` lines 628: `lastSetupTownVertexKey = snapKey`.
				// I missed this dependency.

				// Fix: Setup tracking needs to know the key.
				// Let's defer this specific "State Update" logic or make it robust.
				// Actually, `validateRoadPlacement` (PlayerController:265) used `lastSetupTownVertexKey`.
				// If we don't update it, Setup Road phase might fail validation if strict.
				// However, `validateRoadPlacement` implementation in GameRules (server) is the source of truth.
				// Client-side validation is just for visual feedback (red/green).
				// We do need `lastSetupTownVertexKey` for CLIENT-side validation of the subsequent ROAD placement.
			}
			isMySetupTurn = false;
		}
		return;
	}

	// 2. Route to Interaction
	if (interactionController.HandleInput(input)) {
		return;
	}

	// 3. Global Hotkeys

	// Toggle Blueprint Book 'B'
	if (input.KeyCode === Enum.KeyCode.B && isGameStarted) {
		if (placementController.IsActive) {
			placementController.StopPlacement();
		} else if (BlueprintBookUI) {
			BlueprintBookUI.Toggle();
		}
	}

	// Toggle Map View 'M'
	if (input.KeyCode === Enum.KeyCode.M && isGameStarted) {
		cameraManager.ToggleMapView();
	}

	// Manual Camera Reset 'V'
	if (input.KeyCode === Enum.KeyCode.V && isGameStarted) {
		cameraManager.ResetCamera();
	}

	// Hire Worker 'H'
	if (input.KeyCode === Enum.KeyCode.H && isGameStarted) {
		const character = player.Character;
		if (character && character.PrimaryPart) {
			ClientEvents.HireNPC.fire("Worker", character.PrimaryPart.Position);
			Logger.Debug("PlayerController", "Requested Worker hire");
		}
	}

	// Hire Guard 'G'
	if (input.KeyCode === Enum.KeyCode.G && isGameStarted) {
		const character = player.Character;
		if (character && character.PrimaryPart) {
			ClientEvents.HireNPC.fire("Guard", character.PrimaryPart.Position);
			Logger.Debug("PlayerController", "Requested Guard hire");
		}
	}

	// Sprint
	if (input.KeyCode === Enum.KeyCode.LeftShift || input.KeyCode === Enum.KeyCode.RightShift) {
		isSprinting = true;
		updateSpeed();
	}
});

UserInputService.InputEnded.Connect((input) => {
	if (input.KeyCode === Enum.KeyCode.LeftShift || input.KeyCode === Enum.KeyCode.RightShift) {
		isSprinting = false;
		updateSpeed();
	}
});

Logger.Info("PlayerController", "Initialized (Refactored)");

export = {};
