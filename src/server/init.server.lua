-- Main Server Initialization Script
-- Place this in ServerScriptService

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))

Logger.Info("Server", "===========================================")
Logger.Info("Server", "FPV Settling - Server Starting")
Logger.Info("Server", "===========================================")

-- Initialize the game manager
local GameManager = require(script.GameManager)

Logger.Info("Server", "===========================================")
Logger.Info("Server", "Server ready! Waiting for players...")
Logger.Info("Server", "===========================================")
