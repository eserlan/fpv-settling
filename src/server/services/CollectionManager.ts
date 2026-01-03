import { Service, OnTick, OnStart } from "@flamework/core";
const Players = game.GetService("Players");

import ResourceTypes from "shared/ResourceTypes";
import { ServerEvents } from "../ServerEvents";
import * as Logger from "shared/Logger";
import { TileOwnershipManager } from "./TileOwnershipManager";
import HexMath from "shared/HexMath";
import type { GameEntity } from "shared/GameEntity";

const COLLECTION_RANGE = 8;
const COLLECTION_COOLDOWN = 0.5;

@Service({})
export class CollectionManager implements OnStart, OnTick {
	private playerCooldowns = new Map<number, number>();
	private playerResourceManagers = new Map<number, import("../ResourceManager")>();
	private registeredEntities = new Set<GameEntity>();

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

		for (const entity of this.registeredEntities) {
			const character = typeIs(entity, "Instance") ? (entity as Player).Character : (entity as import("../AIPlayer").AIPlayer).Character;
			if (!character) continue;

			const rootPart = character.FindFirstChild("HumanoidRootPart") ?? character.PrimaryPart;
			if (!rootPart || !rootPart.IsA("BasePart")) continue;

			const playerPos = rootPart.Position;
			for (const resource of resourcesFolder.GetChildren()) {
				if (resource.IsA("BasePart")) {
					const distance = playerPos.sub(resource.Position).Magnitude;
					if (distance <= COLLECTION_RANGE) {
						this.TryCollect(entity, resource);
					}
				}
			}
		}
	}

	public RegisterEntity(entity: GameEntity, resourceManager: import("../ResourceManager")) {
		this.registeredEntities.add(entity);
		this.playerResourceManagers.set(entity.UserId, resourceManager);
		this.playerCooldowns.set(entity.UserId, 0);
	}

	public InitPlayer(player: Player, resourceManager: import("../ResourceManager")) {
		this.RegisterEntity(player, resourceManager);

		task.delay(0.5, () => {
			const inventory = resourceManager.GetResources();
			ServerEvents.CollectEvent.fire(player, "InventoryUpdate", inventory);
		});
		Logger.Debug("CollectionManager", `Initialized inventory for ${player.Name} with starting resources`);
	}

	public RemovePlayer(player: Player) {
		this.playerResourceManagers.delete(player.UserId);
		this.playerCooldowns.delete(player.UserId);
		this.registeredEntities.delete(player);
	}

	public GetInventory(entity: GameEntity) {
		return this.playerResourceManagers.get(entity.UserId)?.GetResources();
	}

	public AddResource(entity: GameEntity, resourceType: string, amount: number) {
		const rm = this.playerResourceManagers.get(entity.UserId);
		if (!rm) return false;

		const added = rm.AddResource(resourceType, amount);
		return typeOf(added) === "number" && (added as number) > 0;
	}

	public RemoveResource(entity: GameEntity, resourceType: string, amount: number) {
		const rm = this.playerResourceManagers.get(entity.UserId);
		if (!rm) return false;

		return rm.RemoveResource(resourceType, amount);
	}

	public HasResources(entity: GameEntity, requirements: Record<string, number>) {
		const rm = this.playerResourceManagers.get(entity.UserId);
		if (!rm) return false;
		return rm.HasResources(requirements);
	}

	public TryCollect(entity: GameEntity, resource: BasePart) {
		if (!resource || !resource.Parent) return false;
		const userId = entity.UserId;
		const cooldown = this.playerCooldowns.get(userId);
		if (cooldown !== undefined && cooldown > 0) return false;

		const character = typeIs(entity, "Instance") ? (entity as Player).Character : (entity as import("../AIPlayer").AIPlayer).Character;
		if (!character) return false;

		const rootPart = character.FindFirstChild("HumanoidRootPart") ?? character.PrimaryPart;
		if (!rootPart || !rootPart.IsA("BasePart")) return false;

		const distance = rootPart.Position.sub(resource.Position).Magnitude;
		if (distance > COLLECTION_RANGE) return false;

		const resourceType = resource.GetAttribute("ResourceType") as string | undefined;
		const amount = (resource.GetAttribute("Amount") as number | undefined) ?? 1;
		if (!resourceType) return false;

		const currentAxial = HexMath.worldToAxial(resource.Position.X, resource.Position.Z);
		const ownsTile = this.tileOwnershipManager.PlayerOwnsTile(entity, currentAxial.q, currentAxial.r);
		if (!ownsTile) return false;

		if (this.AddResource(entity, resourceType, amount)) {
			this.playerCooldowns.set(userId, COLLECTION_COOLDOWN);
			this.CreateCollectionEffect(resource.Position, resourceType);

			if (typeIs(entity, "Instance")) {
				ServerEvents.CollectEvent.fire(entity as Player, "Collected", resourceType, amount);
				const data = ResourceTypes.Get(resourceType);
				ServerEvents.SystemMessageEvent.fire(entity as Player, `📦 Collected ${amount}x ${data?.Icon ?? ""} ${resourceType}`);
			}

			resource.Destroy();
			Logger.Debug("CollectionManager", `${entity.Name} collected ${amount} ${resourceType}`);
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
