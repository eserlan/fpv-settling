// Main Client Initialization Script
// Place this in StarterPlayerScripts

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");
const player = Players.LocalPlayer;

// Wait for Logger to be available
const Logger = require(ReplicatedStorage.WaitForChild("Shared").WaitForChild("Logger")) as typeof import("shared/Logger");

Logger.Info("Client", "===========================================");
Logger.Info("Client", "FPV Settling - Client Starting");
Logger.Info("Client", "===========================================");

Logger.Info("Client", "Waiting for character...");
player.CharacterAdded.Wait();
Logger.Info("Client", "Character loaded!");

// Initialize client systems with error handling
const safeRequire = (name: string, moduleScript: ModuleScript) => {
	const [success, result] = pcall(() => require(moduleScript));
	if (success) {
		Logger.Debug("Client", `Loaded: ${name}`);
		return result;
	}
	Logger.Error("Client", `Failed to load ${name}: ${result}`);
	return undefined;
};

const PlayerController = safeRequire("PlayerController", script.WaitForChild("PlayerController") as ModuleScript);
const UIManager = safeRequire("UIManager", script.WaitForChild("UIManager") as ModuleScript);
const PulseUI = safeRequire("PulseUI", script.WaitForChild("PulseUI") as ModuleScript);
const InventoryUI = safeRequire("InventoryUI", script.WaitForChild("InventoryUI") as ModuleScript);
const BlueprintBookUI = safeRequire("BlueprintBookUI", script.WaitForChild("BlueprintBookUI") as ModuleScript);
const DevPanel = safeRequire("DevPanel", script.WaitForChild("DevPanel") as ModuleScript);

Logger.Info("Client", "===========================================");
Logger.Info("Client", "Welcome to FPV Settling!");
Logger.Info("Client", "Press B to open Blueprint Book");
Logger.Info("Client", "Press Alt+C to open dev panel");
Logger.Info("Client", "===========================================");
