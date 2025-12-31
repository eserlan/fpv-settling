// Tile Ownership Manager
// Tracks which players own which tiles based on settlement proximity
// In Catan: settlements adjacent to tile corners give ownership

const ReplicatedStorage = game.GetService("ReplicatedStorage");
import * as Logger from "shared/Logger";

type TileOwnershipRecord = {
	playerUserId: number;
	playerName: string;
	settlementId: string;
	claimedAt: number;
};

// Store ownership data: {[tileKey] = {playerUserId = userId, settlementId = id}}
let tileOwnership: Record<string, TileOwnershipRecord | undefined> = {};

// Settlement radius - how close a settlement must be to claim a tile
const SETTLEMENT_CLAIM_RADIUS = 30; // studs

// Get tile key from Q, R coordinates
const getTileKey = (q: number, r: number) => `${q}_${r}`;

const TileOwnershipManager = {
	// Check if a player owns a specific tile
	PlayerOwnsTile(player: Player, tileQ: number, tileR: number) {
		const key = getTileKey(tileQ, tileR);
		const ownership = tileOwnership[key];

		if (ownership) {
			return ownership.playerUserId === player.UserId;
		}

		// No owner = can't collect (must have a settlement on adjacent vertex)
		return false;
	},

	// Claim a tile for a player (called when placing a settlement)
	ClaimTile(player: Player, tileQ: number, tileR: number, settlementId: string) {
		const key = getTileKey(tileQ, tileR);

		// Check if already owned by someone else
		if (tileOwnership[key] && tileOwnership[key]!.playerUserId !== player.UserId) {
			Logger.Warn("TileOwnership", `Tile ${key} already owned by another player`);
			return false;
		}

		tileOwnership[key] = {
			playerUserId: player.UserId,
			playerName: player.Name,
			settlementId,
			claimedAt: os.time(),
		};

		Logger.Info("TileOwnership", `${player.Name} claimed tile ${key}`);
		return true;
	},

	// Release a tile (when settlement is destroyed)
	ReleaseTile(tileQ: number, tileR: number) {
		const key = getTileKey(tileQ, tileR);
		tileOwnership[key] = undefined;
		Logger.Info("TileOwnership", `Tile ${key} released`);
	},

	// Get all tiles owned by a player
	GetPlayerTiles(player: Player) {
		const tiles = new Array<string>();
		for (const [key, ownership] of pairs(tileOwnership)) {
			if (ownership && ownership.playerUserId === player.UserId) {
				tiles.push(key);
			}
		}
		return tiles;
	},

	// Claim tiles near a settlement position (using vertex data)
	ClaimTilesNearSettlement(player: Player, settlementPosition: Vector3, settlementId: string) {
		const claimedTiles = new Array<{ Q: number; R: number }>();

		// Find the vertex marker at this position
		const vertexFolder = game.Workspace.FindFirstChild("Vertices");
		if (!vertexFolder) {
			Logger.Warn("TileOwnership", "No vertices folder found");
			return claimedTiles;
		}

		// Find the closest vertex to the settlement position
		let closestVertex: BasePart | undefined;
		let closestDist = math.huge;

		for (const vertex of vertexFolder.GetChildren()) {
			if (vertex.IsA("BasePart")) {
				const dist = vertex.Position.sub(settlementPosition).Magnitude;
				if (dist < closestDist) {
					closestDist = dist;
					closestVertex = vertex;
				}
			}
		}

		if (!closestVertex || closestDist > 10) {
			Logger.Warn("TileOwnership", "No vertex found near settlement position");
			return claimedTiles;
		}

		// Get adjacent tiles from vertex attributes
		const adjCount = (closestVertex.GetAttribute("AdjacentTileCount") as number | undefined) ?? 0;
		Logger.Debug("TileOwnership", `Vertex ${closestVertex.Name} has ${adjCount} adjacent tiles`);

		for (let i = 1; i <= adjCount; i += 1) {
			const q = closestVertex.GetAttribute(`Tile${i}Q`) as number | undefined;
			const r = closestVertex.GetAttribute(`Tile${i}R`) as number | undefined;

			if (q !== undefined && r !== undefined) {
				if (TileOwnershipManager.ClaimTile(player, q, r, settlementId)) {
					claimedTiles.push({ Q: q, R: r });
				}
			}
		}

		Logger.Info(
			"TileOwnership",
			`${player.Name} claimed ${claimedTiles.size()} tiles with settlement at vertex ${closestVertex.Name}`,
		);
		return claimedTiles;
	},

	// Get owner of a tile
	GetTileOwner(tileQ: number, tileR: number) {
		const key = getTileKey(tileQ, tileR);
		return tileOwnership[key];
	},

	// Clear all ownership (for testing/reset)
	ClearAll() {
		tileOwnership = {};
		Logger.Info("TileOwnership", "All tile ownership cleared");
	},
};

Logger.Info("TileOwnershipManager", "Initialized");

export = TileOwnershipManager;
