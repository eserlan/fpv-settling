-- Logger module - Unified logging for client and server
-- Client: Sends logs via RemoteEvent to server
-- Server: Uses LogService to send via HTTP

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")

local Logger = {}

-- Log levels
Logger.Level = {
	DEBUG = "DEBUG",
	INFO = "INFO",
	WARN = "WARN",
	ERROR = "ERROR"
}

-- Configuration
local LOG_SERVER_URL = "http://localhost:8765/log"

-- Will be set when LogEvent is available
local LogEvent = nil
local isServer = RunService:IsServer()

-- Initialize log event (called after events are created)
local function ensureLogEvent()
	if LogEvent then return true end
	
	local Events = ReplicatedStorage:FindFirstChild("Events")
	if Events then
		LogEvent = Events:FindFirstChild("LogEvent")
	end
	
	return LogEvent ~= nil
end

-- Send log to HTTP server (server-side only)
local function sendToHttpServer(level, source, message)
	if not isServer then return end
	
	local success, err = pcall(function()
		HttpService:PostAsync(LOG_SERVER_URL, HttpService:JSONEncode({
			level = level,
			source = source,
			message = message,
			player = "SERVER",
			timestamp = os.time(),
			isServer = true
		}), Enum.HttpContentType.ApplicationJson)
	end)
	
	-- Silent fail - HTTP might not be enabled
end

-- Log with level
function Logger.Log(level, source, message)
	local formattedMessage = "[" .. source .. "] " .. message
	
	-- Print to Roblox Output
	if level == Logger.Level.ERROR then
		warn("[ERROR] " .. formattedMessage)
	elseif level == Logger.Level.WARN then
		warn(formattedMessage)
	else
		print(formattedMessage)
	end
	
	-- Send to external logger
	if isServer then
		-- Server: Send directly via HTTP
		task.spawn(function()
			sendToHttpServer(level, source, message)
		end)
	else
		-- Client: Send via RemoteEvent to server
		task.spawn(function()
			if ensureLogEvent() then
				LogEvent:FireServer(level, source, message)
			end
		end)
	end
end

-- Convenience methods
function Logger.Debug(source, message)
	Logger.Log(Logger.Level.DEBUG, source, message)
end

function Logger.Info(source, message)
	Logger.Log(Logger.Level.INFO, source, message)
end

function Logger.Warn(source, message)
	Logger.Log(Logger.Level.WARN, source, message)
end

function Logger.Error(source, message)
	Logger.Log(Logger.Level.ERROR, source, message)
end

-- Quick log (uses calling script as source)
function Logger.Print(message)
	Logger.Info("Game", message)
end

return Logger
