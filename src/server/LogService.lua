-- LogService - Server-side log relay to external Python server
-- Receives log events from clients and forwards them via HTTP

local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local LogService = {}

-- Configuration
local LOG_SERVER_URL = "http://localhost:8765/log"
local ENABLE_HTTP_LOGGING = true
local LOG_BATCH_INTERVAL = 1 -- Send logs every second
local MAX_BATCH_SIZE = 50

-- Create Events folder and LogEvent
local Events = ReplicatedStorage:FindFirstChild("Events") or Instance.new("Folder", ReplicatedStorage)
Events.Name = "Events"

local LogEvent = Events:FindFirstChild("LogEvent") or Instance.new("RemoteEvent", Events)
LogEvent.Name = "LogEvent"

-- Queue for batching logs
local logQueue = {}
local lastSendTime = 0

-- Internal: send single log to HTTP server
local function sendToHttpServer(logEntry)
	if not ENABLE_HTTP_LOGGING then return end
	
	local success, err = pcall(function()
		HttpService:PostAsync(LOG_SERVER_URL, HttpService:JSONEncode(logEntry), Enum.HttpContentType.ApplicationJson)
	end)
	
	if not success then
		-- Silently fail but print once
		if not LogService._httpErrorLogged then
			warn("[LogService] Failed to send to HTTP log server: " .. tostring(err))
			warn("[LogService] Make sure python3 tools/log_server.py is running")
			LogService._httpErrorLogged = true
		end
	end
end

-- Send batched logs
local function flushLogQueue()
	if #logQueue == 0 then return end
	
	-- Send each log
	for _, logEntry in ipairs(logQueue) do
		sendToHttpServer(logEntry)
	end
	
	logQueue = {}
end

-- Add log to queue
local function queueLog(level, source, message, playerName)
	table.insert(logQueue, {
		level = level,
		source = source,
		message = message,
		player = playerName,
		timestamp = os.time(),
		isServer = RunService:IsServer()
	})
	
	-- Flush if batch is full
	if #logQueue >= MAX_BATCH_SIZE then
		flushLogQueue()
	end
end

-- Handle log events from clients
LogEvent.OnServerEvent:Connect(function(player, level, source, message)
	-- Queue the log with player info
	queueLog(level, source, message, player.Name)
end)

-- Log directly from server (for server-side logs)
function LogService.Log(level, source, message)
	queueLog(level, source, message, "SERVER")
end

-- Convenience methods for server
function LogService.Debug(source, message)
	LogService.Log("DEBUG", source, message)
end

function LogService.Info(source, message)
	LogService.Log("INFO", source, message)
end

function LogService.Warn(source, message)
	LogService.Log("WARN", source, message)
end

function LogService.Error(source, message)
	LogService.Log("ERROR", source, message)
end

-- Periodic flush
task.spawn(function()
	while true do
		task.wait(LOG_BATCH_INTERVAL)
		flushLogQueue()
	end
end)

-- Toggle HTTP logging
function LogService.SetEnabled(enabled)
	ENABLE_HTTP_LOGGING = enabled
end

print("[LogService] Initialized - HTTP logging to " .. LOG_SERVER_URL)

return LogService
