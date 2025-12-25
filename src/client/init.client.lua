-- Main Client Initialization Script
-- Place this in StarterPlayerScripts

print("===========================================")
print("FPV Settling - Client Starting")
print("===========================================")

-- Wait for character to load
local Players = game:GetService("Players")
local player = Players.LocalPlayer

player.CharacterAdded:Wait()

-- Initialize client systems
local PlayerController = require(script.PlayerController)
local UIManager = require(script.UIManager)

print("Client systems loaded successfully!")
print("===========================================")
print("Welcome to FPV Settling!")
print("Press 'B' to enter build mode")
print("===========================================")
