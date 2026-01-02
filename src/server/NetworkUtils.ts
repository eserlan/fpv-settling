import type { GameEntity } from "shared/GameEntity";

export namespace NetworkUtils {
	export function FireClient<T extends unknown[]>(
		entity: GameEntity,
		event: { fire: (player: Player, ...args: T) => void },
		...args: T
	) {
		if (!typeIs(entity, "Instance")) {
			// Don't fire network events to AI (which are simple objects, not Instances)
			return;
		}
		// It's a real player
		event.fire(entity as Player, ...args);
	}

	export function Broadcast<T extends unknown[]>(event: { broadcast: (...args: T) => void }, ...args: T) {
		// Broadcast goes to all clients, no need to filter AI since they aren't clients
		event.broadcast(...args);
	}
}
