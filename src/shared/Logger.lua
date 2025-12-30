-- Logger module - sends logs to local server via HTTP
-- Also prints to Roblox Output

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")

local Logger = {}

-- Configuration
local LOG_SERVER_URL = "http://localhost:8765/log"
local ENABLE_HTTP_LOGGING = true -- Set to false if log server not running

-- Log levels
Logger.Level = {
	DEBUG = "DEBUG",
	INFO = "INFO",
	WARN = "WARN",
	ERROR = "ERROR"
}

-- Internal: send log to server
local function sendToServer(level, source, message)
	if not ENABLE_HTTP_LOGGING then return end
	
	-- Only works in Studio with HttpService enabled for localhost
	local success, err = pcall(function()
		HttpService:PostAsync(LOG_SERVER_URL, HttpService:JSONEncode({
			level = level,
			source = source,
			message = message,
			timestamp = os.time()
		}), Enum.HttpContentType.ApplicationJson)
	end)
	
	if not success then
		-- Silently fail - log server might not be running
		-- warn("[Logger] Failed to send to log server: " .. tostring(err))
	end
end

-- Log with level
function Logger.Log(level, source, message)
	local formattedMessage = "[" .. source .. "] " .. message
	
	-- Print to Roblox Output
	if level == Logger.Level.ERROR then
		error(formattedMessage, 0)
	elseif level == Logger.Level.WARN then
		warn(formattedMessage)
	else
		print(formattedMessage)
	end
	
	-- Send to local server
	task.spawn(function()
		sendToServer(level, source, message)
	end)
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

-- Toggle HTTP logging
function Logger.SetHttpLogging(enabled)
	ENABLE_HTTP_LOGGING = enabled
end

return Logger
