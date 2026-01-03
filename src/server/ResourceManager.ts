// Server-side Resource Manager
const ReplicatedStorage = game.GetService("ReplicatedStorage");
import ResourceTypes from "shared/ResourceTypes";
import { ServerEvents } from "./ServerEvents";
import * as Logger from "shared/Logger";
import type { GameEntity } from "shared/GameEntity";
import { NetworkUtils } from "./NetworkUtils";

class ResourceManager {
	Player: GameEntity;
	Resources: Record<string, number>;

	constructor(player: GameEntity) {
		this.Player = player;
		this.Resources = {};

		const VALID_RESOURCES = ["Wood", "Brick", "Wheat", "Wool", "Ore"];

		// Initialize all resource types with 0
		for (const resourceName of VALID_RESOURCES) {
			this.Resources[resourceName] = 0;
		}

		// Starting resources: enough for 1 settlement + 1 road
		// Settlement: Wood 1, Brick 1, Wheat 1, Wool 1
		// Road: Wood 1, Brick 1
		this.Resources.Wood = 2;
		this.Resources.Brick = 2;
		this.Resources.Wheat = 1;
		this.Resources.Wool = 1;
		this.Resources.Ore = 0;
	}

	// Add resources to player inventory
	AddResource(resourceType: string, amount: number) {
		const resourceInfo = ResourceTypes.Get(resourceType);
		if (!resourceInfo) {
			Logger.Warn("ResourceManager", `[${this.Player.Name}] Invalid resource type: ${resourceType}`);
			return false;
		}

		if (amount > 0) {
			Logger.Info("ResourceManager", `[${this.Player.Name}] Adding ${amount} ${resourceType}`);
		}

		const maxStack = resourceInfo.MaxStack;
		const currentAmount = this.Resources[resourceType] ?? 0;

		// Check if we can add the full amount
		if (currentAmount + amount > maxStack) {
			// Add only what fits
			const addedAmount = maxStack - currentAmount;
			this.Resources[resourceType] = maxStack;
			NetworkUtils.FireClient(this.Player, ServerEvents.ResourceUpdate, this.Resources);
			return addedAmount;
		}

		this.Resources[resourceType] = currentAmount + amount;
		NetworkUtils.FireClient(this.Player, ServerEvents.ResourceUpdate, this.Resources);
		return amount;
	}

	// Remove resources from player inventory
	RemoveResource(resourceType: string, amount: number) {
		const resourceInfo = ResourceTypes.Get(resourceType);
		if (!resourceInfo) {
			Logger.Warn("ResourceManager", `[${this.Player.Name}] Invalid resource type: ${resourceType}`);
			return false;
		}

		const current = this.Resources[resourceType] ?? 0;
		if (current >= amount) {
			if (amount > 0) {
				Logger.Info("ResourceManager", `[${this.Player.Name}] Removing ${amount} ${resourceType}. (Before: ${current})`);
				this.Resources[resourceType] = current - amount;

				// Log current state
				let state = "";
				for (const [k, v] of pairs(this.Resources)) state += `${k}=${v} `;
				Logger.Debug("ResourceManager", `[${this.Player.Name}] New State: ${state}`);

				NetworkUtils.FireClient(this.Player, ServerEvents.ResourceUpdate, this.Resources);
			}
			return true;
		}

		Logger.Warn("ResourceManager", `[${this.Player.Name}] Failed to remove ${amount} ${resourceType} (only had ${current})`);
		return false;
	}

	// Check if player has enough resources
	HasResources(costs: Record<string, number>) {
		for (const [resourceType, amount] of pairs(costs)) {
			if (!this.Resources[resourceType] || this.Resources[resourceType] < amount) {
				return false;
			}
		}
		return true;
	}

	// Get current resource amounts
	GetResources() {
		return this.Resources;
	}

	// Get specific resource amount
	GetResource(resourceType: string) {
		return this.Resources[resourceType] ?? 0;
	}

	// Get total count of all resources
	GetTotalResourceCount() {
		let total = 0;
		for (const [_, amount] of pairs(this.Resources)) {
			total += amount;
		}
		return total;
	}

	// Remove random resources (for Robber penalty)
	RemoveRandomResources(count: number) {
		let removedCount = 0;
		const resourcesToRemove: string[] = [];

		// We need to remove 'count' resources
		// Algorithm: Pick a random index from 1 to Total, find that resource, remove it. Repeat.
		// Note: This is slightly inefficient if count is large, but simpler than bulk removal logic

		for (let i = 0; i < count; i++) {
			const currentTotal = this.GetTotalResourceCount();
			if (currentTotal === 0) break;

			let pick = math.random(1, currentTotal);
			let acc = 0;

			for (const [resType, amount] of pairs(this.Resources)) {
				if (amount > 0) {
					acc += amount;
					if (acc >= pick) {
						// Found the victim
						this.Resources[resType] = amount - 1;
						removedCount++;
						resourcesToRemove.push(resType);
						break;
					}
				}
			}
		}

		if (removedCount > 0) {
			Logger.Info("ResourceManager", `[${this.Player.Name}] Randomly removed ${removedCount} resources: ${resourcesToRemove.join(", ")}`);
			NetworkUtils.FireClient(this.Player, ServerEvents.ResourceUpdate, this.Resources);
		}

		return resourcesToRemove;
	}
}

export = ResourceManager;
