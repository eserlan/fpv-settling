import { Service, OnTick, OnStart } from "@flamework/core";
const Players = game.GetService("Players");

import ResourceTypes from "shared/ResourceTypes";
import { ServerEvents } from "../ServerEvents";
import * as Logger from "shared/Logger";
import { TileOwnershipManager } from "./TileOwnershipManager";
import HexMath from "shared/HexMath";
import type { GameEntity } from "shared/GameEntity";

const COLLECTION_RANGE = 8;
const COLLECTION_COOLDOWN = 0.5; // Reverted to original pace for visual feedback

@Service({})
export class CollectionManager implements OnStart, OnTick {
	private playerCooldowns = new Map<number, number>();
	private playerResourceManagers = new Map<number, import("../ResourceManager")>();
	private registeredEntities = new Set<GameEntity>();

	constructor(private tileOwnershipManager: TileOwnershipManager) { }

	onStart() {
		Logger.Info("CollectionManager", "Initialized");
	}

	private unjamTimer = 0;

	onTick(deltaTime: number) {
		for (const [userId, cooldown] of this.playerCooldowns) {
			if (cooldown > 0) this.playerCooldowns.set(userId, cooldown - deltaTime);
		}

		const resourcesFolder = game.Workspace.FindFirstChild("Resources");
		if (!resourcesFolder) return;

		this.unjamTimer += deltaTime;
		const shouldUnjam = this.unjamTimer >= 0.5;
		if (shouldUnjam) this.unjamTimer = 0;

		const resources = resourcesFolder.GetChildren();
		for (const resource of resources) {
			if (resource.IsA("BasePart")) {
				if (shouldUnjam) {
					this.CheckObstacleOverlap(resource);
				}

				for (const entity of this.registeredEntities) {
					const character = typeIs(entity, "Instance") ? (entity as Player).Character : (entity as import("../AIPlayer").AIPlayer).Character;
					if (!character) continue;

					const rootPart = character.FindFirstChild("HumanoidRootPart") ?? character.PrimaryPart;
					if (!rootPart || !rootPart.IsA("BasePart")) continue;

					const playerPos = rootPart.Position;
					const distance = playerPos.sub(resource.Position).Magnitude;
					if (distance <= COLLECTION_RANGE) {
						this.TryCollect(entity, resource);
					}
				}
			}
		}
	}

	private CheckObstacleOverlap(resource: BasePart) {
		const params = new OverlapParams();
		const map = game.Workspace.FindFirstChild("Map");
		const buildings = game.Workspace.FindFirstChild("Buildings");
		const towns = game.Workspace.FindFirstChild("Towns");

		const filters: Instance[] = [];
		if (map) filters.push(map);
		if (buildings) filters.push(buildings);
		if (towns) filters.push(towns);

		if (filters.size() === 0) return;

		params.FilterDescendantsInstances = filters;
		params.FilterType = Enum.RaycastFilterType.Include;
		params.MaxParts = 1; // We only need to know IF it overlaps

		let overlaps = game.Workspace.GetPartsInPart(resource, params);
		if (overlaps.size() > 0) {
			const tileQ = resource.GetAttribute("TileQ") as number;
			const tileR = resource.GetAttribute("TileR") as number;
			if (tileQ === undefined || tileR === undefined) return;

			const tilePos = HexMath.axialToWorld(tileQ, tileR);
			const tileCenter = new Vector3(tilePos.x, resource.Position.Y, tilePos.z);

			// Direction from tile center to resource
			let pushDir = resource.Position.sub(tileCenter);
			pushDir = new Vector3(pushDir.X, 0, pushDir.Z); // Horizontal only

			if (pushDir.Magnitude < 0.1) {
				// Exactly at center? Push in random direction
				const angle = math.random() * math.pi * 2;
				pushDir = new Vector3(math.cos(angle), 0, math.sin(angle));
			} else {
				pushDir = pushDir.Unit;
			}

			// Push it out until no longer overlapping or max attempts reached
			let attempts = 0;
			const stepSize = 2;
			while (attempts < 40) {
				const nextPos = resource.Position.add(pushDir.mul(stepSize));

				// Ensure the next position is still within the same tile
				const nextAxial = HexMath.worldToAxial(nextPos.X, nextPos.Z);
				if (nextAxial.q !== tileQ || nextAxial.r !== tileR) {
					break; // Stop at boundary
				}

				resource.Position = nextPos;
				overlaps = game.Workspace.GetPartsInPart(resource, params);
				if (overlaps.size() === 0) break;
				attempts++;
			}

			// Reset velocity so it doesn't fly away
			resource.AssemblyLinearVelocity = new Vector3(0, 0, 0);
			resource.AssemblyAngularVelocity = new Vector3(0, 0, 0);
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
			ServerEvents.ResourceUpdate.fire(player, inventory);
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

		const ownerId = resource.GetAttribute("OwnerId") as number | undefined;
		const isExplicitOwner = (ownerId !== undefined && ownerId === entity.UserId);

		if (ownerId !== undefined && ownerId !== entity.UserId) return false;

		// If we are the explicit owner, we can ALWAYS pick it up.
		// Otherwise, we must own the tile (for common resources).
		if (!isExplicitOwner) {
			const currentAxial = HexMath.worldToAxial(resource.Position.X, resource.Position.Z);
			const ownsTile = this.tileOwnershipManager.PlayerOwnsTile(entity, currentAxial.q, currentAxial.r);
			if (!ownsTile) return false;
		}

		if (this.AddResource(entity, resourceType, amount)) {
			this.playerCooldowns.set(userId, COLLECTION_COOLDOWN);
			this.CreateCollectionEffect(resource.Position, resourceType);

			// Broadcast to all clients for visual feedback
			ServerEvents.ResourceCollected.broadcast(resourceType, amount, entity.Name);

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
