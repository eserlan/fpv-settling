import type { GameEntity } from "shared/GameEntity";

export namespace NetworkUtils {
	export function FireClient<T extends unknown[]>(entity: GameEntity, event: { fire(player: Player, ...args: T): void }, ...args: T) {
		if (!typeIs(entity, "Instance") || !entity.IsA("Player")) {
			// Don't fire network events to AI (objects) or non-Player instances
			return;
		}
		// It's guaranteed to be a real player instance
		event.fire(entity, ...args);
	}

	export function Broadcast<T extends unknown[]>(event: { broadcast(...args: T): void }, ...args: T) {
		// Broadcast goes to all clients, no need to filter AI since they aren't clients
		event.broadcast(...args);
	}
}
