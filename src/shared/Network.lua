-- Shared Network Module
-- Centralizes access to RemoteEvents and provides a consistent API

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))

local Events = ReplicatedStorage:FindFirstChild("Events")
if not Events then
	if RunService:IsServer() then
		Events = Instance.new("Folder")
		Events.Name = "Events"
		Events.Parent = ReplicatedStorage
	else
		Events = ReplicatedStorage:WaitForChild("Events")
	end
end

local Network = {}

-- Utility to get a RemoteEvent
function Network.GetEvent(eventName)
	local event = Events:FindFirstChild(eventName)
	if not event then
		if RunService:IsServer() then
			-- Create it if it doesn't exist (Server side only)
			event = Instance.new("RemoteEvent")
			event.Name = eventName
			event.Parent = Events
			Logger.Debug("Network", "Created RemoteEvent: " .. eventName)
		else
			-- Client side: wait for it to exist
			event = Events:WaitForChild(eventName, 5)
			if not event then
				error("RemoteEvent not found: " .. eventName)
			end
		end
	end
	return event
end

-- Server -> Client: Fire to a specific player
function Network:FireClient(player, eventName, ...)
	if not RunService:IsServer() then
		error("FireClient can only be called from the server")
	end
	self.GetEvent(eventName):FireClient(player, ...)
end

-- Server -> Client: Fire to all players
function Network:FireAllClients(eventName, ...)
	if not RunService:IsServer() then
		error("FireAllClients can only be called from the server")
	end
	self.GetEvent(eventName):FireAllClients(...)
end

-- Client -> Server: Fire request
function Network:FireServer(eventName, ...)
	if not RunService:IsClient() then
		error("FireServer can only be called from the client")
	end
	-- We use a single ClientRequest event for all client-to-server requests
	-- The first argument is the specific action type
	self.GetEvent("ClientRequest"):FireServer(eventName, ...)
end

-- Connect to an event (Server or Client)
function Network:OnEvent(eventName, callback)
	local event = self.GetEvent(eventName)
	if RunService:IsServer() then
		return event.OnServerEvent:Connect(callback)
	else
		return event.OnClientEvent:Connect(callback)
	end
end

return Network
