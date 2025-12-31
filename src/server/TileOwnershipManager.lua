-- Tile Ownership Manager
-- Tracks which players own which tiles based on settlement proximity
-- In Catan: settlements adjacent to tile corners give ownership

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Logger = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Logger"))

local TileOwnershipManager = {}

-- Store ownership data: {[tileKey] = {playerUserId = userId, settlementId = id}}
local tileOwnership = {}

-- Settlement radius - how close a settlement must be to claim a tile
local SETTLEMENT_CLAIM_RADIUS = 30 -- studs

-- Get tile key from Q, R coordinates
local function getTileKey(q, r)
	return q .. "_" .. r
end

-- Check if a player owns a specific tile
function TileOwnershipManager.PlayerOwnsTile(player, tileQ, tileR)
	local key = getTileKey(tileQ, tileR)
	local ownership = tileOwnership[key]
	
	if ownership then
		return ownership.playerUserId == player.UserId
	end
	
	-- No owner = can't collect (must have a settlement on adjacent vertex)
	return false
end

-- Claim a tile for a player (called when placing a settlement)
function TileOwnershipManager.ClaimTile(player, tileQ, tileR, settlementId)
	local key = getTileKey(tileQ, tileR)
	
	-- Check if already owned by someone else
	if tileOwnership[key] and tileOwnership[key].playerUserId ~= player.UserId then
		Logger.Warn("TileOwnership", "Tile " .. key .. " already owned by another player")
		return false
	end
	
	tileOwnership[key] = {
		playerUserId = player.UserId,
		playerName = player.Name,
		settlementId = settlementId,
		claimedAt = os.time()
	}
	
	Logger.Info("TileOwnership", player.Name .. " claimed tile " .. key)
	return true
end

-- Release a tile (when settlement is destroyed)
function TileOwnershipManager.ReleaseTile(tileQ, tileR)
	local key = getTileKey(tileQ, tileR)
	tileOwnership[key] = nil
	Logger.Info("TileOwnership", "Tile " .. key .. " released")
end

-- Get all tiles owned by a player
function TileOwnershipManager.GetPlayerTiles(player)
	local tiles = {}
	for key, ownership in pairs(tileOwnership) do
		if ownership.playerUserId == player.UserId then
			table.insert(tiles, key)
		end
	end
	return tiles
end

-- Claim tiles near a settlement position (using vertex data)
function TileOwnershipManager.ClaimTilesNearSettlement(player, settlementPosition, settlementId)
	local claimedTiles = {}
	
	-- Find the vertex marker at this position
	local vertexFolder = workspace:FindFirstChild("Vertices")
	if not vertexFolder then 
		Logger.Warn("TileOwnership", "No vertices folder found")
		return claimedTiles 
	end
	
	-- Find the closest vertex to the settlement position
	local closestVertex = nil
	local closestDist = math.huge
	
	for _, vertex in ipairs(vertexFolder:GetChildren()) do
		local dist = (vertex.Position - settlementPosition).Magnitude
		if dist < closestDist then
			closestDist = dist
			closestVertex = vertex
		end
	end
	
	if not closestVertex or closestDist > 10 then
		Logger.Warn("TileOwnership", "No vertex found near settlement position")
		return claimedTiles
	end
	
	-- Get adjacent tiles from vertex attributes
	local adjCount = closestVertex:GetAttribute("AdjacentTileCount") or 0
	Logger.Debug("TileOwnership", "Vertex " .. closestVertex.Name .. " has " .. adjCount .. " adjacent tiles")
	
	for i = 1, adjCount do
		local q = closestVertex:GetAttribute("Tile" .. i .. "Q")
		local r = closestVertex:GetAttribute("Tile" .. i .. "R")
		
		if q and r then
			if TileOwnershipManager.ClaimTile(player, q, r, settlementId) then
				table.insert(claimedTiles, {Q = q, R = r})
			end
		end
	end
	
	Logger.Info("TileOwnership", player.Name .. " claimed " .. #claimedTiles .. " tiles with settlement at vertex " .. closestVertex.Name)
	return claimedTiles
end

-- Get owner of a tile
function TileOwnershipManager.GetTileOwner(tileQ, tileR)
	local key = getTileKey(tileQ, tileR)
	return tileOwnership[key]
end

-- Clear all ownership (for testing/reset)
function TileOwnershipManager.ClearAll()
	tileOwnership = {}
	Logger.Info("TileOwnership", "All tile ownership cleared")
end

Logger.Info("TileOwnershipManager", "Initialized")

return TileOwnershipManager
