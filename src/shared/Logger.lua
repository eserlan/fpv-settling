-- Logger module - Unified logging for client and server
-- Client: Sends logs via RemoteEvent to server
-- Server: Posts logs to external Python server via HTTP

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Logger = {}

-- Log levels
Logger.Level = {
	DEBUG = "DEBUG",
	INFO = "INFO",
	WARN = "WARN",
	ERROR = "ERROR"
}

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

-- Send log to server (client only)
local function sendToServer(level, source, message)
	if isServer then return end -- Server logs differently
	
	if ensureLogEvent() then
		LogEvent:FireServer(level, source, message)
	end
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
		-- Server: Use LogService directly (imported where needed)
		-- This avoids circular dependency
		local LogService = ReplicatedStorage:FindFirstChild("Shared") and 
			ReplicatedStorage.Shared:FindFirstChild("LogService")
		-- LogService handles its own HTTP posting
		-- For now, server logs are handled by LogService when required
		
		-- Alternative: queue for later
		task.spawn(function()
			if ensureLogEvent() then
				-- Server can also use the batching system
				local Events = ReplicatedStorage:FindFirstChild("Events")
				if Events then
					local ServerLogEvent = Events:FindFirstChild("ServerLogEvent")
					-- Server logs are handled by LogService directly
				end
			end
		end)
	else
		-- Client: Send via RemoteEvent
		task.spawn(function()
			sendToServer(level, source, message)
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
