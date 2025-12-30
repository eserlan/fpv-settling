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
	
	-- No owner = anyone can collect (for now)
	return true
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

-- Claim tiles near a settlement position
function TileOwnershipManager.ClaimTilesNearSettlement(player, settlementPosition, settlementId)
	local mapFolder = workspace:FindFirstChild("Map")
	if not mapFolder then return {} end
	
	local claimedTiles = {}
	
	for _, tile in ipairs(mapFolder:GetChildren()) do
		if tile:IsA("Model") and tile.PrimaryPart then
			local tilePos = tile.PrimaryPart.Position
			local distance = (Vector3.new(tilePos.X, 0, tilePos.Z) - Vector3.new(settlementPosition.X, 0, settlementPosition.Z)).Magnitude
			
			if distance <= SETTLEMENT_CLAIM_RADIUS then
				local q = tile.PrimaryPart:GetAttribute("Q")
				local r = tile.PrimaryPart:GetAttribute("R")
				
				if q and r then
					if TileOwnershipManager.ClaimTile(player, q, r, settlementId) then
						table.insert(claimedTiles, {Q = q, R = r})
					end
				end
			end
		end
	end
	
	Logger.Info("TileOwnership", player.Name .. " claimed " .. #claimedTiles .. " tiles with settlement")
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
