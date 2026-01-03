import { Controller, OnStart } from "@flamework/core";

import * as Logger from "shared/Logger";

const Players = game.GetService("Players");

@Controller({})
export class ClientBootstrapController implements OnStart {
	onStart() {
		Logger.Info("Client", "===========================================");
		Logger.Info("Client", "FPV Settling - Client Starting");
		Logger.Info("Client", "===========================================");

		const player = Players.LocalPlayer;
		if (!player.Character) {
			player.CharacterAdded.Wait();
		}
		Logger.Info("Client", "Character loaded!");

		const clientRoot = script.Parent?.Parent;
		if (!clientRoot) {
			Logger.Error("Client", "Client root not found. Unable to bootstrap client modules.");
			return;
		}

		this.safeRequire(clientRoot, "PlayerController");
		this.safeRequire(clientRoot, "UIManager");
		this.safeRequire(clientRoot, "PulseUI");
		this.safeRequire(clientRoot, "InventoryUI");
		this.safeRequire(clientRoot, "BlueprintBookUI");
		this.safeRequire(clientRoot, "DevPanel");
		this.safeRequire(clientRoot, "TradeUI");
		this.safeRequire(clientRoot, "ScoreboardUI");
		// this.safeRequire(clientRoot, "LobbyUI");

		Logger.Info("Client", "===========================================");
		Logger.Info("Client", "Welcome to FPV Settling!");
		Logger.Info("Client", "Press B to open Blueprint Book");
		Logger.Info("Client", "Press T to open Trade Menu");
		Logger.Info("Client", "Press Alt+C to open dev panel");
		Logger.Info("Client", "===========================================");
	}

	private safeRequire(root: Instance, name: string) {
		const module = root.FindFirstChild(name);
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
	}
}
