import { Service, OnTick, OnStart } from "@flamework/core";
const Players = game.GetService("Players");

import ResourceTypes from "shared/ResourceTypes";
import { ServerEvents } from "../ServerEvents";
import * as Logger from "shared/Logger";
import { TileOwnershipManager } from "./TileOwnershipManager";
import HexMath from "shared/HexMath";

const COLLECTION_RANGE = 8;
const COLLECTION_COOLDOWN = 0.5;

@Service({})
export class CollectionManager implements OnStart, OnTick {
	private playerCooldowns = new Map<number, number>();
	private playerInventories = new Map<number, Record<string, number>>();

	constructor(private tileOwnershipManager: TileOwnershipManager) { }

	onStart() {
		Logger.Info("CollectionManager", "Initialized");
	}

	onTick(deltaTime: number) {
		for (const [userId, cooldown] of this.playerCooldowns) {
			if (cooldown > 0) this.playerCooldowns.set(userId, cooldown - deltaTime);
		}

		const resourcesFolder = game.Workspace.FindFirstChild("Resources");
		if (!resourcesFolder) return;

		for (const player of Players.GetPlayers()) {
			const character = player.Character;
			if (!character) continue;

			const humanoidRootPart = character.FindFirstChild("HumanoidRootPart");
			if (!humanoidRootPart || !humanoidRootPart.IsA("BasePart")) continue;

			const playerPos = humanoidRootPart.Position;
			for (const resource of resourcesFolder.GetChildren()) {
				if (resource.IsA("BasePart")) {
					const distance = playerPos.sub(resource.Position).Magnitude;
					if (distance <= COLLECTION_RANGE) this.TryCollect(player, resource);
				}
			}
		}
	}

	public InitPlayer(player: Player) {
		this.playerInventories.set(player.UserId, {
			Wood: 2,
			Brick: 2,
			Wheat: 1,
			Wool: 1,
			Ore: 0,
		});
		this.playerCooldowns.set(player.UserId, 0);

		task.delay(0.5, () => {
			const inventory = this.playerInventories.get(player.UserId);
			if (inventory) ServerEvents.CollectEvent.fire(player, "InventoryUpdate", inventory);
		});
		Logger.Debug("CollectionManager", `Initialized inventory for ${player.Name} with starting resources`);
	}

	public RemovePlayer(player: Player) {
		this.playerInventories.delete(player.UserId);
		this.playerCooldowns.delete(player.UserId);
	}

	public GetInventory(player: Player) {
		return this.playerInventories.get(player.UserId);
	}

	public AddResource(player: Player, resourceType: string, amount: number) {
		const inventory = this.playerInventories.get(player.UserId);
		if (!inventory) return false;

		if (inventory[resourceType] !== undefined) {
			inventory[resourceType] += amount;
			ServerEvents.CollectEvent.fire(player, "InventoryUpdate", inventory);
			return true;
		}
		return false;
	}

	public RemoveResource(player: Player, resourceType: string, amount: number) {
		const inventory = this.playerInventories.get(player.UserId);
		if (!inventory) return false;

		if (inventory[resourceType] !== undefined && inventory[resourceType] >= amount) {
			inventory[resourceType] -= amount;
			ServerEvents.CollectEvent.fire(player, "InventoryUpdate", inventory);
			return true;
		}
		return false;
	}

	public HasResources(player: Player, requirements: Record<string, number>) {
		const inventory = this.playerInventories.get(player.UserId);
		if (!inventory) return false;
		for (const [resourceType, amount] of pairs(requirements)) {
			if (!inventory[resourceType] || inventory[resourceType] < amount) return false;
		}
		return true;
	}

	public TryCollect(player: Player, resource: BasePart) {
		if (!resource || !resource.Parent) return false;
		const userId = player.UserId;
		const cooldown = this.playerCooldowns.get(userId);
		if (cooldown !== undefined && cooldown > 0) return false;

		const character = player.Character;
		if (!character) return false;

		const humanoidRootPart = character.FindFirstChild("HumanoidRootPart");
		if (!humanoidRootPart || !humanoidRootPart.IsA("BasePart")) return false;

		const distance = humanoidRootPart.Position.sub(resource.Position).Magnitude;
		if (distance > COLLECTION_RANGE) return false;

		const resourceType = resource.GetAttribute("ResourceType") as string | undefined;
		const amount = (resource.GetAttribute("Amount") as number | undefined) ?? 1;
		if (!resourceType) return false;

		const currentAxial = HexMath.worldToAxial(resource.Position.X, resource.Position.Z);
		if (!this.tileOwnershipManager.PlayerOwnsTile(player, currentAxial.q, currentAxial.r)) return false;

		if (this.AddResource(player, resourceType, amount)) {
			this.playerCooldowns.set(userId, COLLECTION_COOLDOWN);
			this.CreateCollectionEffect(resource.Position, resourceType);
			ServerEvents.CollectEvent.fire(player, "Collected", resourceType, amount);

			// Show collection in chat for the player
			const data = ResourceTypes.Get(resourceType);
			ServerEvents.SystemMessageEvent.fire(player, `📦 Collected ${amount}x ${data?.Icon ?? ""} ${resourceType}`);

			resource.Destroy();
			Logger.Debug("CollectionManager", `${player.Name} collected ${amount} ${resourceType}`);
			return true;
		}
		return false;
	}

	private CreateCollectionEffect(position: Vector3, resourceType: string) {
		const data = ResourceTypes.Get(resourceType);
		if (!data) return;

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

		task.delay(0.5, () => {
			particles.Enabled = false;
			task.wait(1);
			effect.Destroy();
		});
	}
}
