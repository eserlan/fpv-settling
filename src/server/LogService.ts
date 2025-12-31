// LogService - Server-side log relay to external Python server
// Receives log events from clients and forwards them via HTTP

const HttpService = game.GetService("HttpService");
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const RunService = game.GetService("RunService");

// Configuration
const LOG_SERVER_URL = "http://localhost:8765/log";
let ENABLE_HTTP_LOGGING = true;
const LOG_BATCH_INTERVAL = 1; // Send logs every second
const MAX_BATCH_SIZE = 50;

// Create Events folder and LogEvent
const events = (ReplicatedStorage.FindFirstChild("Events") as Folder) ?? new Instance("Folder", ReplicatedStorage);
events.Name = "Events";

const LogEvent = (events.FindFirstChild("LogEvent") as RemoteEvent) ?? new Instance("RemoteEvent", events);
LogEvent.Name = "LogEvent";

// Queue for batching logs
let logQueue = new Array<Record<string, unknown>>();

const LogService = {
	_httpErrorLogged: false,

	// Internal: send single log to HTTP server
	sendToHttpServer(logEntry: Record<string, unknown>) {
		if (!ENABLE_HTTP_LOGGING) {
			return;
		}

		const [success, err] = pcall(() => {
			HttpService.PostAsync(LOG_SERVER_URL, HttpService.JSONEncode(logEntry), Enum.HttpContentType.ApplicationJson);
		});

		if (!success) {
			// Silently fail but print once
			if (!LogService._httpErrorLogged) {
				warn(`[LogService] Failed to send to HTTP log server: ${err}`);
				warn("[LogService] Make sure python3 tools/log_server.py is running");
				LogService._httpErrorLogged = true;
			}
		}
	},

	// Send batched logs
	flushLogQueue() {
		if (logQueue.size() === 0) {
			return;
		}

		// Send each log
		for (const logEntry of logQueue) {
			LogService.sendToHttpServer(logEntry);
		}

		logQueue = [];
	},

	// Add log to queue
	queueLog(level: string, source: string, message: string, playerName: string) {
		logQueue.push({
			level,
			source,
			message,
			player: playerName,
			timestamp: os.time(),
			isServer: RunService.IsServer(),
		});

		// Flush if batch is full
		if (logQueue.size() >= MAX_BATCH_SIZE) {
			LogService.flushLogQueue();
		}
	},

	// Handle log events from clients
	init() {
		LogEvent.OnServerEvent.Connect((player, level, source, message) => {
			// Queue the log with player info
			LogService.queueLog(level as string, source as string, message as string, player.Name);
		});
	},

	// Log directly from server (for server-side logs)
	Log(level: string, source: string, message: string) {
		LogService.queueLog(level, source, message, "SERVER");
	},

	// Convenience methods for server
	Debug(source: string, message: string) {
		LogService.Log("DEBUG", source, message);
	},

	Info(source: string, message: string) {
		LogService.Log("INFO", source, message);
	},

	Warn(source: string, message: string) {
		LogService.Log("WARN", source, message);
	},

	Error(source: string, message: string) {
		LogService.Log("ERROR", source, message);
	},

	// Toggle HTTP logging
	SetEnabled(enabled: boolean) {
		ENABLE_HTTP_LOGGING = enabled;
	},
};

LogService.init();

// Periodic flush
task.spawn(() => {
	while (true) {
		task.wait(LOG_BATCH_INTERVAL);
		LogService.flushLogQueue();
	}
});

print(`[LogService] Initialized - HTTP logging to ${LOG_SERVER_URL}`);

export = LogService;
