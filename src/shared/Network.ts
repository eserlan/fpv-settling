// Shared Network Module
// Centralizes access to RemoteEvents and provides a consistent API

const RunService = game.GetService("RunService");
const ReplicatedStorage = game.GetService("ReplicatedStorage");
import * as Logger from "shared/Logger";

let events = ReplicatedStorage.FindFirstChild("Events");
if (!events) {
	if (RunService.IsServer()) {
		events = new Instance("Folder");
		events.Name = "Events";
		events.Parent = ReplicatedStorage;
	} else {
		events = ReplicatedStorage.WaitForChild("Events");
	}
}

const getEvent = (eventName: string) => {
	const eventsFolder = events as Folder;
	let event = eventsFolder.FindFirstChild(eventName);
	if (!event) {
		if (RunService.IsServer()) {
			// Create it if it doesn't exist (Server side only)
			event = new Instance("RemoteEvent");
			event.Name = eventName;
			event.Parent = eventsFolder;
			Logger.Debug("Network", `Created RemoteEvent: ${eventName}`);
		} else {
			// Client side: wait for it to exist
			const awaited = eventsFolder.WaitForChild(eventName, 5);
			if (!awaited || !awaited.IsA("RemoteEvent")) {
				throw `RemoteEvent not found: ${eventName}`;
			}
			event = awaited;
		}
	}

	if (!event.IsA("RemoteEvent")) {
		throw `RemoteEvent not found: ${eventName}`;
	}

	return event;
};

const FireClient = (player: Player, eventName: string, ...args: unknown[]) => {
	if (!RunService.IsServer()) {
		throw "FireClient can only be called from the server";
	}
	getEvent(eventName).FireClient(player, ...args);
};

const FireAllClients = (eventName: string, ...args: unknown[]) => {
	if (!RunService.IsServer()) {
		throw "FireAllClients can only be called from the server";
	}
	getEvent(eventName).FireAllClients(...args);
};

const FireServer = (eventName: string, ...args: unknown[]) => {
	if (!RunService.IsClient()) {
		throw "FireServer can only be called from the client";
	}
	// We use a single ClientRequest event for all client-to-server requests
	// The first argument is the specific action type
	getEvent("ClientRequest").FireServer(eventName, ...args);
};

const OnEvent = (eventName: string, callback: (...args: unknown[]) => void) => {
	const event = getEvent(eventName);
	if (RunService.IsServer()) {
		return event.OnServerEvent.Connect(callback);
	}
	return event.OnClientEvent.Connect(callback);
};

export default {
	GetEvent: getEvent,
	FireClient,
	FireAllClients,
	FireServer,
	OnEvent,
};
