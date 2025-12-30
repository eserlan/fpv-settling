-- Main Client Initialization Script
-- Place this in StarterPlayerScripts

print("===========================================")
print("FPV Settling - Client Starting")
print("===========================================")

-- Wait for character to load
local Players = game:GetService("Players")
local player = Players.LocalPlayer

print("[Client] Waiting for character...")
player.CharacterAdded:Wait()
print("[Client] Character loaded!")

-- Initialize client systems with error handling
local function safeRequire(name, module)
	local success, result = pcall(function()
		return require(module)
	end)
	if success then
		print("[Client] Loaded: " .. name)
		return result
	else
		warn("[Client] Failed to load " .. name .. ": " .. tostring(result))
		return nil
	end
end

local PlayerController = safeRequire("PlayerController", script.PlayerController)
local UIManager = safeRequire("UIManager", script.UIManager)
local PulseUI = safeRequire("PulseUI", script.PulseUI)
local InventoryUI = safeRequire("InventoryUI", script.InventoryUI)
local DevPanel = safeRequire("DevPanel", script.DevPanel)

print("===========================================")
print("Welcome to FPV Settling!")
print("Click 'Dev Panel' button (top right) for dev tools")
print("===========================================")
