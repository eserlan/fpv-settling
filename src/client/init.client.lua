-- Main Client Initialization Script
-- Place this in StarterPlayerScripts

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local player = Players.LocalPlayer

-- Wait for Logger to be available
local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))

Logger.Info("Client", "===========================================")
Logger.Info("Client", "FPV Settling - Client Starting")
Logger.Info("Client", "===========================================")

Logger.Info("Client", "Waiting for character...")
player.CharacterAdded:Wait()
Logger.Info("Client", "Character loaded!")

-- Initialize client systems with error handling
local function safeRequire(name, module)
	local success, result = pcall(function()
		return require(module)
	end)
	if success then
		Logger.Debug("Client", "Loaded: " .. name)
		return result
	else
		Logger.Error("Client", "Failed to load " .. name .. ": " .. tostring(result))
		return nil
	end
end

local PlayerController = safeRequire("PlayerController", script.PlayerController)
local UIManager = safeRequire("UIManager", script.UIManager)
local PulseUI = safeRequire("PulseUI", script.PulseUI)
local InventoryUI = safeRequire("InventoryUI", script.InventoryUI)
local DevPanel = safeRequire("DevPanel", script.DevPanel)

Logger.Info("Client", "===========================================")
Logger.Info("Client", "Welcome to FPV Settling!")
Logger.Info("Client", "Press Alt+C to open dev panel")
Logger.Info("Client", "===========================================")
