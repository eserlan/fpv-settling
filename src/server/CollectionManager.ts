// COLLECTION MANAGER - Handles physical resource collection
// Players walk near resources to collect them

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");

import ResourceTypes from "shared/ResourceTypes";
import { ServerEvents } from "./ServerEvents";
import * as Logger from "shared/Logger";
import ownershipModule = require("./TileOwnershipManager");
import HexMath from "shared/HexMath";

// Configuration
const COLLECTION_RANGE = 8; // Studs - how close player needs to be
const COLLECTION_COOLDOWN = 0.5; // Seconds between collections

// Player collection cooldowns
const playerCooldowns = new Map<number, number>();

// Player inventories (simple table for now)
const playerInventories = new Map<number, Record<string, number>>();

const CollectionManager = {
	// Initialize player inventory with starting resources
	InitPlayer(player: Player) {
		// Starting resources: enough for 1 settlement + 1 road
		// Settlement: Wood 1, Brick 1, Wheat 1, Wool 1
		// Road: Wood 1, Brick 1
		playerInventories.set(player.UserId, {
			Wood: 2,
			Brick: 2,
			Wheat: 1,
			Wool: 1,
			Ore: 0,
		});
		playerCooldowns.set(player.UserId, 0);

		// Send initial inventory to client
		task.delay(0.5, () => {
			const inventory = playerInventories.get(player.UserId);
			if (inventory) {
				ServerEvents.CollectEvent.fire(player, "InventoryUpdate", inventory);
			}
		});

		Logger.Debug("CollectionManager", `Initialized inventory for ${player.Name} with starting resources`);
	},

	// Remove player inventory on leave
	RemovePlayer(player: Player) {
		playerInventories.delete(player.UserId);
		playerCooldowns.delete(player.UserId);
	},

	// Get player inventory
	GetInventory(player: Player) {
		return playerInventories.get(player.UserId);
	},

	// Add resource to player inventory
	AddResource(player: Player, resourceType: string, amount: number) {
		const inventory = playerInventories.get(player.UserId);
		if (!inventory) {
			return false;
		}

		if (inventory[resourceType] !== undefined) {
			inventory[resourceType] += amount;

			// Notify client
			ServerEvents.CollectEvent.fire(player, "InventoryUpdate", inventory);

			return true;
		}

		return false;
	},

	// Remove resource from player inventory
	RemoveResource(player: Player, resourceType: string, amount: number) {
		const inventory = playerInventories.get(player.UserId);
		if (!inventory) {
			return false;
		}

		if (inventory[resourceType] !== undefined && inventory[resourceType] >= amount) {
			inventory[resourceType] -= amount;

			// Notify client
			ServerEvents.CollectEvent.fire(player, "InventoryUpdate", inventory);

			return true;
		}

		return false;
	},

	// Check if player has enough resources
	HasResources(player: Player, requirements: Record<string, number>) {
		const inventory = playerInventories.get(player.UserId);
		if (!inventory) {
			return false;
		}

		for (const [resourceType, amount] of pairs(requirements)) {
			if (!inventory[resourceType] || inventory[resourceType] < amount) {
				return false;
			}
		}

		return true;
	},

	// Try to collect a specific resource
	TryCollect(player: Player, resource: BasePart) {
		if (!resource || !resource.Parent) {
			return false;
		}

		const userId = player.UserId;

		// Check cooldown
		const cooldown = playerCooldowns.get(userId);
		if (cooldown !== undefined && cooldown > 0) {
			return false;
		}

		// Check if player has a character
		const character = player.Character;
		if (!character) {
			return false;
		}

		const humanoidRootPart = character.FindFirstChild("HumanoidRootPart");
		if (!humanoidRootPart || !humanoidRootPart.IsA("BasePart")) {
			return false;
		}

		// Check distance
		const distance = humanoidRootPart.Position.sub(resource.Position).Magnitude;
		if (distance > COLLECTION_RANGE) {
			return false;
		}

		// Get resource info
		const resourceType = resource.GetAttribute("ResourceType") as string | undefined;
		const amount = (resource.GetAttribute("Amount") as number | undefined) ?? 1;
		const tileQ = resource.GetAttribute("TileQ") as number | undefined;
		const tileR = resource.GetAttribute("TileR") as number | undefined;

		if (!resourceType) {
			return false;
		}

		// Check tile ownership based on CURRENT position (Resource Stealing Mechanic)
		const currentAxial = HexMath.worldToAxial(resource.Position.X, resource.Position.Z);
		if (!ownershipModule.PlayerOwnsTile(player, currentAxial.q, currentAxial.r)) {
			// Player doesn't own the tile the resource is CURRENTLY on
			return false;
		}

		// Add to inventory
		if (CollectionManager.AddResource(player, resourceType, amount)) {
			// Set cooldown
			playerCooldowns.set(userId, COLLECTION_COOLDOWN);

			// Create collection effect
			CollectionManager.CreateCollectionEffect(resource.Position, resourceType);

			// Notify client
			ServerEvents.CollectEvent.fire(player, "Collected", resourceType, amount);

			// Destroy the resource
			resource.Destroy();

			Logger.Debug("CollectionManager", `${player.Name} collected ${amount} ${resourceType}`);
			return true;
		}

		return false;
	},

	// Create visual effect when collecting
	CreateCollectionEffect(position: Vector3, resourceType: string) {
		const data = ResourceTypes.Get(resourceType);
		if (!data) {
			return;
		}

		// Create sparkle particles
		const effect = new Instance("Part");
		effect.Name = "CollectEffect";
		effect.Size = new Vector3(1, 1, 1);
		effect.Position = position;
		effect.Anchored = true;
		effect.CanCollide = false;
		effect.Transparency = 1;
		effect.Parent = game.Workspace;

		const particles = new Instance("ParticleEmitter");
		particles.Color = new ColorSequence(data.Color);
		particles.Size = new NumberSequence(1, 0);
		particles.Lifetime = new NumberRange(0.5, 1);
		particles.Speed = new NumberRange(5, 10);
		particles.SpreadAngle = new Vector2(180, 180);
		particles.Rate = 50;
		particles.Parent = effect;

		// Destroy after short time
		task.delay(0.5, () => {
			particles.Enabled = false;
			task.wait(1);
			effect.Destroy();
		});
	},

	// Update loop - check cooldowns and nearby resources
	Update(deltaTime: number) {
		// Update cooldowns
		for (const [userId, cooldown] of playerCooldowns) {
			if (cooldown > 0) {
				playerCooldowns.set(userId, cooldown - deltaTime);
			}
		}

		// Check each player for nearby resources
		const resourcesFolder = game.Workspace.FindFirstChild("Resources");
		if (!resourcesFolder) {
			return;
		}

		for (const player of Players.GetPlayers()) {
			const character = player.Character;
			if (!character) {
				continue;
			}

			const humanoidRootPart = character.FindFirstChild("HumanoidRootPart");
			if (!humanoidRootPart || !humanoidRootPart.IsA("BasePart")) {
				continue;
			}

			const playerPos = humanoidRootPart.Position;

			// Check all resources
			for (const resource of resourcesFolder.GetChildren()) {
				if (resource.IsA("BasePart")) {
					const distance = playerPos.sub(resource.Position).Magnitude;
					if (distance <= COLLECTION_RANGE) {
						CollectionManager.TryCollect(player, resource);
					}
				}
			}
		}
	},
};

// Event handling moved to NetworkService.ts

Logger.Info("CollectionManager", "Initialized");

export = CollectionManager;
