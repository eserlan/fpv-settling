// Logger module - Unified logging for client and server
// Client: Sends logs via RemoteEvent to server
// Server: Uses LogService to send via HTTP

const RunService = game.GetService("RunService");
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const HttpService = game.GetService("HttpService");

const Logger = {
	Level: {
		DEBUG: "DEBUG",
		INFO: "INFO",
		WARN: "WARN",
		ERROR: "ERROR",
	},
};

export const Level = Logger.Level;

type LoggerLevel = (typeof Logger.Level)[keyof typeof Logger.Level];

// Configuration
const LOG_SERVER_URL = "http://localhost:8765/log";

// Will be set when LogEvent is available
let LogEvent: RemoteEvent | undefined;
const isServer = RunService.IsServer();

// Initialize log event (called after events are created)
const ensureLogEvent = () => {
	if (LogEvent) {
		return true;
	}

	const events = ReplicatedStorage.FindFirstChild("Events");
	if (events) {
		const found = events.FindFirstChild("LogEvent");
		if (found && found.IsA("RemoteEvent")) {
			LogEvent = found;
		}
	}

	return LogEvent !== undefined;
};

// Send log to HTTP server (server-side only)
const sendToHttpServer = (level: LoggerLevel, source: string, message: string) => {
	if (!isServer) {
		return;
	}

	pcall(() => {
		HttpService.PostAsync(
			LOG_SERVER_URL,
			HttpService.JSONEncode({
				level,
				source,
				message,
				player: "SERVER",
				timestamp: os.time(),
				isServer: true,
			}),
			Enum.HttpContentType.ApplicationJson,
		);
	});
};

// Log with level
export const Log = (level: LoggerLevel, source: string, message: string) => {
	const formattedMessage = `[${source}] ${message}`;

	// Print to Roblox Output
	if (level === Logger.Level.ERROR) {
		warn(`[ERROR] ${formattedMessage}`);
	} else if (level === Logger.Level.WARN) {
		warn(formattedMessage);
	} else {
		print(formattedMessage);
	}

	// Send to external logger
	if (isServer) {
		// Server: Send directly via HTTP
		task.spawn(() => {
			sendToHttpServer(level, source, message);
		});
	} else {
		// Client: Send via RemoteEvent to server
		task.spawn(() => {
			if (ensureLogEvent() && LogEvent) {
				LogEvent.FireServer(level, source, message);
			}
		});
	}
};

// Convenience methods
export const Debug = (source: string, message: string) => {
	Log(Logger.Level.DEBUG, source, message);
};

export const Info = (source: string, message: string) => {
	Log(Logger.Level.INFO, source, message);
};

export const Warn = (source: string, message: string) => {
	Log(Logger.Level.WARN, source, message);
};

export const Error = (source: string, message: string) => {
	Log(Logger.Level.ERROR, source, message);
};

// Quick log (uses calling script as source)
export const Print = (message: string) => {
	Info("Game", message);
};
