import { Service, OnStart } from "@flamework/core";
import * as Logger from "shared/Logger";
import * as TileKey from "shared/TileKey";
import type { GameEntity } from "shared/GameEntity";
import { ServerEvents } from "../ServerEvents";

type TileOwnershipRecord = {
	playerUserId: number;
	playerName: string;
	settlementId: string;
	claimedAt: number;
};

@Service({})
export class TileOwnershipManager implements OnStart {
	private tileOwnership: Record<string, TileOwnershipRecord[]> = {};

	onStart() {
		Logger.Info("TileOwnershipManager", "Initialized");
	}

	public PlayerOwnsTile(player: GameEntity, tileQ: number, tileR: number) {
		const key = TileKey.makeTileKey(tileQ, tileR);
		const records = this.tileOwnership[key];
		if (!records) return false;

		for (const record of records) {
			if (record.playerUserId === player.UserId) return true;
		}
		return false;
	}

	public ClaimTile(player: GameEntity, tileQ: number, tileR: number, settlementId: string) {
		const key = TileKey.makeTileKey(tileQ, tileR);
		if (!this.tileOwnership[key]) {
			this.tileOwnership[key] = [];
		}

		// Check if already claimed by this player
		const records = this.tileOwnership[key]!;
		for (const record of records) {
			if (record.playerUserId === player.UserId && record.settlementId === settlementId) {
				return true; // Already claimed by this specific settlement
			}
		}

		records.push({
			playerUserId: player.UserId,
			playerName: player.Name,
			settlementId,
			claimedAt: os.time(),
		});

		Logger.Info("TileOwnership", `${player.Name} (Settlement: ${settlementId}) claimed part of tile ${key}. Total owners: ${records.size()}`);

		// Notify clients about the tile ownership change
		ServerEvents.TileOwnershipChanged.broadcast(tileQ, tileR, player.UserId, player.Name);

		return true;
	}

	public ReleaseTile(tileQ: number, tileR: number, settlementId?: string) {
		const key = TileKey.makeTileKey(tileQ, tileR);
		if (!this.tileOwnership[key]) return;

		if (settlementId) {
			const records = this.tileOwnership[key]!;
			for (let i = records.size(); i >= 1; i--) {
				if (records[i - 1].settlementId === settlementId) {
					records.remove(i - 1);
				}
			}
			if (records.size() === 0) {
				delete this.tileOwnership[key];
			}
		} else {
			delete this.tileOwnership[key];
		}

		Logger.Info("TileOwnership", `Tile ${key} released (Settlement: ${settlementId ?? "All"})`);
	}

	public GetPlayerTiles(player: GameEntity) {
		const tiles = new Array<string>();
		for (const [key, records] of pairs(this.tileOwnership)) {
			if (records) {
				for (const record of records) {
					if (record.playerUserId === player.UserId) {
						tiles.push(key);
						break;
					}
				}
			}
		}
		return tiles;
	}

	public ClaimTilesNearSettlement(player: GameEntity, settlementPosition: Vector3, settlementId: string) {
		const claimedTiles = new Array<{ Q: number; R: number }>();
		const vertexFolder = game.Workspace.FindFirstChild("Vertices");
		if (!vertexFolder) return claimedTiles;

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

		if (!closestVertex || closestDist > 10) return claimedTiles;

		const adjCount = (closestVertex.GetAttribute("AdjacentTileCount") as number | undefined) ?? 0;
		for (let i = 1; i <= adjCount; i += 1) {
			const q = closestVertex.GetAttribute(`Tile${i}Q`) as number | undefined;
			const r = closestVertex.GetAttribute(`Tile${i}R`) as number | undefined;
			if (q !== undefined && r !== undefined) {
				if (this.ClaimTile(player, q, r, settlementId)) claimedTiles.push({ Q: q, R: r });
			}
		}
		return claimedTiles;
	}

	public GetTileOwners(tileQ: number, tileR: number) {
		const key = TileKey.makeTileKey(tileQ, tileR);
		return this.tileOwnership[key] ?? [];
	}

	public ClearAll() {
		this.tileOwnership = {};
		Logger.Info("TileOwnership", "All tile ownership cleared");
	}
}
