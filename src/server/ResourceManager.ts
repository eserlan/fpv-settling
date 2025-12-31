// Server-side Resource Manager
const ReplicatedStorage = game.GetService("ReplicatedStorage");
import ResourceTypes from "shared/ResourceTypes";
import Network from "shared/Network";
import * as Logger from "shared/Logger";

class ResourceManager {
	Player: Player;
	Resources: Record<string, number>;

	constructor(player: Player) {
		this.Player = player;
		this.Resources = {};

		// Initialize all resource types with 0
		for (const [resourceName] of pairs(ResourceTypes)) {
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
		const resourceInfo = ResourceTypes[resourceType];
		if (!resourceInfo) {
			Logger.Warn("ResourceManager", `Invalid resource type: ${resourceType}`);
			return false;
		}

		const maxStack = resourceInfo.MaxStack;
		const currentAmount = this.Resources[resourceType] ?? 0;

		// Check if we can add the full amount
		if (currentAmount + amount > maxStack) {
			// Add only what fits
			const addedAmount = maxStack - currentAmount;
			this.Resources[resourceType] = maxStack;
			return addedAmount;
		}

		this.Resources[resourceType] = currentAmount + amount;
		Network.FireClient(this.Player, "ResourceUpdate", this.Resources);
		return amount;
	}

	// Remove resources from player inventory
	RemoveResource(resourceType: string, amount: number) {
		const resourceInfo = ResourceTypes[resourceType];
		if (!resourceInfo) {
			Logger.Warn("ResourceManager", `Invalid resource type: ${resourceType}`);
			return false;
		}

		if ((this.Resources[resourceType] ?? 0) >= amount) {
			this.Resources[resourceType] = (this.Resources[resourceType] ?? 0) - amount;
			Network.FireClient(this.Player, "ResourceUpdate", this.Resources);
			return true;
		}

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
}

export = ResourceManager;
