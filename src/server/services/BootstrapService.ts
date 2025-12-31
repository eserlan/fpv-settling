import { OnStart, Service } from "@flamework/core";

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Logger = require(ReplicatedStorage.WaitForChild("Shared").WaitForChild("Logger")) as typeof import("shared/Logger");

@Service({})
export class BootstrapService implements OnStart {
	onStart(): void {
		Logger.Info("Server", "===========================================");
		Logger.Info("Server", "FPV Settling - Server Starting");
		Logger.Info("Server", "===========================================");

		const serverRoot = script.Parent?.Parent;
		if (!serverRoot) {
			Logger.Error("Server", "Server root not found; skipping initialization.");
			return;
		}

		const gameManagerModule = serverRoot.FindFirstChild("GameManager");
		if (!gameManagerModule || !gameManagerModule.IsA("ModuleScript")) {
			Logger.Error("Server", "GameManager module not found.");
			return;
		}

		const [success, result] = pcall(() => require(gameManagerModule));
		if (!success) {
			Logger.Error("Server", `Failed to initialize GameManager: ${result}`);
			return;
		}

		Logger.Debug("Server", "GameManager loaded via Flamework.");

		Logger.Info("Server", "===========================================");
		Logger.Info("Server", "Server ready! Waiting for players...");
		Logger.Info("Server", "===========================================");
	}
}
