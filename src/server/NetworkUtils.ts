import type { GameEntity } from "shared/GameEntity";

export namespace NetworkUtils {
	export function FireClient(entity: GameEntity, event: { fire: (player: Player, ...args: any[]) => void }, ...args: any[]) {
		if ("IsAI" in entity && entity.IsAI) {
			// Don't fire network events to AI
			return;
		}
		// It's a real player
		event.fire(entity as Player, ...args);
	}

	export function Broadcast(event: { broadcast: (...args: any[]) => void }, ...args: any[]) {
		// Broadcast goes to all clients, no need to filter AI since they aren't clients
		event.broadcast(...args);
	}
}
