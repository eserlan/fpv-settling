// Main Server Initialization Script
// Place this in ServerScriptService

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Logger = require(ReplicatedStorage.WaitForChild("Shared").WaitForChild("Logger")) as typeof import("shared/Logger");

Logger.Info("Server", "===========================================");
Logger.Info("Server", "FPV Settling - Server Starting");
Logger.Info("Server", "===========================================");

// Initialize the game manager
const GameManager = require(script.WaitForChild("GameManager")) as typeof import("./GameManager");

Logger.Info("Server", "===========================================");
Logger.Info("Server", "Server ready! Waiting for players...");
Logger.Info("Server", "===========================================");
