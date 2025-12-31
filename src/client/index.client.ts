// Client Entry Point
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");
import * as Logger from "shared/Logger";

Logger.Info("Client", "===========================================");
Logger.Info("Client", "FPV Settling - Client Starting");
Logger.Info("Client", "===========================================");

const player = Players.LocalPlayer;
// Wait for character? Bootstrap did.
if (!player.Character) {
    player.CharacterAdded.Wait();
}
Logger.Info("Client", "Character loaded!");

const clientRoot = script; // index.client.ts is usually in client/ folder. Bootstrap was in controllers/.
// Use script.Parent or just script if modules are siblings/children?
// Files are in src/client/*.ts. index.client.ts is in src/client/index.client.ts (compiled to out/client/init.client.lua)
// The modules are siblings in out/client.

const safeRequire = (name: string) => {
    const module = script.FindFirstChild(name);
    if (!module || !module.IsA("ModuleScript")) {
        Logger.Error("Client", `Failed to find module: ${name}`);
        return undefined;
    }

    const [success, result] = pcall(() => require(module));
    if (success) {
        Logger.Debug("Client", `Loaded: ${name}`);
        return result;
    }
    Logger.Error("Client", `Failed to load ${name}: ${result}`);
    return undefined;
};

safeRequire("PlayerController");
safeRequire("UIManager");
safeRequire("PulseUI");
safeRequire("InventoryUI");
safeRequire("BlueprintBookUI");
safeRequire("DevPanel");

Logger.Info("Client", "===========================================");
Logger.Info("Client", "Welcome to FPV Settling!");
Logger.Info("Client", "Press B to open Blueprint Book");
Logger.Info("Client", "Press Alt+C to open dev panel");
Logger.Info("Client", "===========================================");
