import { Service, OnStart } from "@flamework/core";
import * as Logger from "shared/Logger";
import * as TileKey from "shared/TileKey";

type TileOwnershipRecord = {
	playerUserId: number;
	playerName: string;
	settlementId: string;
	claimedAt: number;
};

@Service({})
export class TileOwnershipManager implements OnStart {
	private tileOwnership: Record<string, TileOwnershipRecord | undefined> = {};

	onStart() {
		Logger.Info("TileOwnershipManager", "Initialized");
	}

	public PlayerOwnsTile(player: Player, tileQ: number, tileR: number) {
		const key = TileKey.makeTileKey(tileQ, tileR);
		const ownership = this.tileOwnership[key];
		return ownership ? ownership.playerUserId === player.UserId : false;
	}

	public ClaimTile(player: Player, tileQ: number, tileR: number, settlementId: string) {
		const key = TileKey.makeTileKey(tileQ, tileR);
		if (this.tileOwnership[key] && this.tileOwnership[key]!.playerUserId !== player.UserId) {
			Logger.Warn("TileOwnership", `Tile ${key} already owned by another player`);
			return false;
		}

		this.tileOwnership[key] = {
			playerUserId: player.UserId,
			playerName: player.Name,
			settlementId,
			claimedAt: os.time(),
		};
		Logger.Info("TileOwnership", `${player.Name} claimed tile ${key}`);
		return true;
	}

	public ReleaseTile(tileQ: number, tileR: number) {
		const key = TileKey.makeTileKey(tileQ, tileR);
		this.tileOwnership[key] = undefined;
		Logger.Info("TileOwnership", `Tile ${key} released`);
	}

	public GetPlayerTiles(player: Player) {
		const tiles = new Array<string>();
		for (const [key, ownership] of pairs(this.tileOwnership)) {
			if (ownership && ownership.playerUserId === player.UserId) tiles.push(key);
		}
		return tiles;
	}

	public ClaimTilesNearSettlement(player: Player, settlementPosition: Vector3, settlementId: string) {
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

	public GetTileOwner(tileQ: number, tileR: number) {
		const key = TileKey.makeTileKey(tileQ, tileR);
		return this.tileOwnership[key];
	}

	public ClearAll() {
		this.tileOwnership = {};
		Logger.Info("TileOwnership", "All tile ownership cleared");
	}
}
