// Server Entry Point
import * as Logger from "shared/Logger";

Logger.Info("Server", "===========================================");
Logger.Info("Server", "FPV Settling - Server Starting");
Logger.Info("Server", "===========================================");

const serverRoot = script.Parent; // index.server.ts -> out/server/init.server.lua. Parent is 'Server' script service folder.
// But modules are in out/server/... so they are children of script (if it's a Folder-like structure in Rojo?)
// Usually src/server/index.server.ts -> ServerScriptService/Server/init.server.lua (or just script)
// And GameManager.ts -> ServerScriptService/Server/GameManager.lua
// So they are children of script.Parent? Or if index.server.ts becomes init.server.lua inside a Folder named Server?
// `default.project.json` maps "Server": { "$path": "out/server" }.
// So "Server" in SSS is a Folder (or script if init.lua exists).
// If it's a Folder, index.server.ts (renamed to init.server.ts) compiles to init.lua?
// The user renamed `index.server.ts` earlier.
// If the folder contains `init.lua`, then `script` is that script. Its children are the other modules.
// Wait, `init.lua` children are not the other modules unless they are physically inside it?
// No, in ROBLOX, `init.lua` makes the Folder act like a ModuleScript. The other files in the folder are children of the Script/Module.
// So `script` is the parent of `GameManager`.

const gameManagerModule = script.FindFirstChild("GameManager");
if (gameManagerModule && gameManagerModule.IsA("ModuleScript")) {
    const [success, result] = pcall(() => require(gameManagerModule));
    if (!success) {
        Logger.Error("Server", `Failed to initialize GameManager: ${result}`);
    } else {
        Logger.Debug("Server", "GameManager loaded.");
    }
} else {
    Logger.Error("Server", "GameManager module not found as child of script.");
}

Logger.Info("Server", "===========================================");
Logger.Info("Server", "Server ready! Waiting for players...");
Logger.Info("Server", "===========================================");
