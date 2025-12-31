import { Controller, OnStart } from "@flamework/core";

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");

const Logger = require(ReplicatedStorage.WaitForChild("Shared").WaitForChild("Logger")) as typeof import("shared/Logger");

@Controller({})
export class BootstrapController implements OnStart {
	onStart(): void {
		Logger.Info("Client", "===========================================");
		Logger.Info("Client", "FPV Settling - Client Starting");
		Logger.Info("Client", "===========================================");

		const player = Players.LocalPlayer;
		Logger.Info("Client", "Waiting for character...");
		player.CharacterAdded.Wait();
		Logger.Info("Client", "Character loaded!");

		const clientRoot = script.Parent?.Parent;
		if (!clientRoot) {
			Logger.Error("Client", "Client root not found; skipping initialization.");
			return;
		}

		const safeRequire = (name: string) => {
			const module = clientRoot.FindFirstChild(name);
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
	}
}
