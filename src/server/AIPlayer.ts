import type { AIPlayerInterface } from "shared/GameEntity";
import type { PlayerData } from "./PlayerData";
import { AIAction } from "./services/LLMService"; // Keeping type, but not using service
import { SkillLevel } from "shared/GameTypes";
import * as Logger from "shared/Logger";
import type { MapGenerator } from "./services/MapGenerator";
import { ServerEvents } from "./ServerEvents";
import type { GameState } from "./GameState";
import type { MarketManager } from "./services/MarketManager";
import { MarketOffer, ResourceDict } from "shared/MarketTypes";
import { ResourceType } from "shared/TradeMath";

const PathfindingService = game.GetService("PathfindingService");

export class AIPlayer implements AIPlayerInterface {
	public UserId: number;
	public Name: string;
	public Character?: Model;
	public IsAI = true;
	public Skill: SkillLevel;
	private baseWalkSpeed: number = 20.8; // Default, will be set in Spawn

	// AI Logic State
	public State: "Idle" | "Thinking" | "Moving" | "Executing" | "MovingToResource" = "Idle";
	private pendingAction?: { type: string, position: Vector3, actionData?: AIAction };
	private pendingResource?: BasePart;
	private actionsThisPulse: number = 0;
	private lastPulsePhase: number = 1; // 0 for [60-30], 1 for [30-0]
	private thoughtPending: boolean = false;
	private taskQueue: Array<{ type: "BUILD" | "COLLECT", buildingType?: string, position: Vector3, part?: BasePart }> = [];
	private failedTownSpots: Vector3[] = [];

	// Pathfinding
	private currentPath?: Path;
	private currentWaypointIndex: number = 0;
	private lastMoveTime: number = 0;
	private lastCheckedPosition?: Vector3;
	private lastPositionTime: number = 0;
	private consecutiveStuckCount: number = 0;
	private lastThoughtPendingTime?: number;
	private spawnTime?: number;
	private static readonly STARTUP_DELAY = 15; // Shorter startup delay

	constructor(id: number, name: string, skill: SkillLevel = "Intermediate") {
		this.UserId = id;
		this.Name = name;
		this.Skill = skill;
	}

	public Kick(message?: string) {
		Logger.Info("AIPlayer", `${this.Name} kicked: ${message}`);
	}

	public Spawn(position: Vector3) {
		if (this.Character) {
			this.Character.Destroy();
		}

		// Skill-based colors
		let bodyColor: Color3;
		if (this.Skill === "Beginner") {
			bodyColor = Color3.fromRGB(100, 255, 100); // Green
		} else if (this.Skill === "Intermediate") {
			bodyColor = Color3.fromRGB(100, 150, 255); // Blue
		} else {
			bodyColor = Color3.fromRGB(255, 80, 80); // Red (Expert)
		}

		const SCALE = 1.3; // Make AI slightly larger than normal players
		const model = new Instance("Model");
		model.Name = this.Name;

		// HumanoidRootPart (invisible root)
		const root = new Instance("Part");
		root.Name = "HumanoidRootPart";
		root.Size = new Vector3(2 * SCALE, 2 * SCALE, 1 * SCALE);
		root.Position = position.add(new Vector3(0, 3 * SCALE, 0));
		root.Transparency = 1;
		root.CanCollide = false;
		root.Anchored = false;
		root.Parent = model;

		// Torso
		const torso = new Instance("Part");
		torso.Name = "Torso";
		torso.Size = new Vector3(2 * SCALE, 2 * SCALE, 1 * SCALE);
		torso.Position = root.Position;
		torso.Color = bodyColor;
		torso.CanCollide = true;
		torso.Anchored = false;
		torso.Parent = model;

		// Head
		const head = new Instance("Part");
		head.Name = "Head";
		head.Size = new Vector3(1.2 * SCALE, 1.2 * SCALE, 1.2 * SCALE);
		head.Position = torso.Position.add(new Vector3(0, 1.6 * SCALE, 0));
		head.Color = Color3.fromRGB(245, 205, 170); // Skin tone
		head.CanCollide = false;
		head.Parent = model;

		// Face decal on head
		const face = new Instance("Decal");
		face.Name = "face";
		face.Texture = "rbxasset://textures/face.png";
		face.Face = Enum.NormalId.Front;
		face.Parent = head;

		// Left Arm
		const leftArm = new Instance("Part");
		leftArm.Name = "Left Arm";
		leftArm.Size = new Vector3(1 * SCALE, 2 * SCALE, 1 * SCALE);
		leftArm.Position = torso.Position.add(new Vector3(-1.5 * SCALE, 0, 0));
		leftArm.Color = bodyColor;
		leftArm.CanCollide = false;
		leftArm.Parent = model;

		// Right Arm
		const rightArm = new Instance("Part");
		rightArm.Name = "Right Arm";
		rightArm.Size = new Vector3(1 * SCALE, 2 * SCALE, 1 * SCALE);
		rightArm.Position = torso.Position.add(new Vector3(1.5 * SCALE, 0, 0));
		rightArm.Color = bodyColor;
		rightArm.CanCollide = false;
		rightArm.Parent = model;

		// Left Leg
		const leftLeg = new Instance("Part");
		leftLeg.Name = "Left Leg";
		leftLeg.Size = new Vector3(1 * SCALE, 2 * SCALE, 1 * SCALE);
		leftLeg.Position = torso.Position.add(new Vector3(-0.5 * SCALE, -2 * SCALE, 0));
		leftLeg.Color = Color3.fromRGB(50, 50, 150); // Dark blue pants
		leftLeg.CanCollide = false;
		leftLeg.Parent = model;

		// Right Leg
		const rightLeg = new Instance("Part");
		rightLeg.Name = "Right Leg";
		rightLeg.Size = new Vector3(1 * SCALE, 2 * SCALE, 1 * SCALE);
		rightLeg.Position = torso.Position.add(new Vector3(0.5 * SCALE, -2 * SCALE, 0));
		rightLeg.Color = Color3.fromRGB(50, 50, 150); // Dark blue pants
		rightLeg.CanCollide = false;
		rightLeg.Parent = model;

		// Weld all parts to torso
		const weldTo = (part: BasePart) => {
			const weld = new Instance("WeldConstraint");
			weld.Part0 = torso;
			weld.Part1 = part;
			weld.Parent = torso;
		};
		weldTo(root);
		weldTo(head);
		weldTo(leftArm);
		weldTo(rightArm);
		weldTo(leftLeg);
		weldTo(rightLeg);

		// Assign collision group to all parts
		for (const part of model.GetDescendants()) {
			if (part.IsA("BasePart")) {
				part.CollisionGroup = "SelectableAI";
			}
		}

		// Humanoid
		const humanoid = new Instance("Humanoid");
		humanoid.DisplayName = `[${this.Skill}] ${this.Name}`;
		this.baseWalkSpeed = 16 * SCALE;
		humanoid.WalkSpeed = this.baseWalkSpeed;
		humanoid.Parent = model;

		model.PrimaryPart = root;
		model.Parent = game.Workspace;
		this.Character = model;

		Logger.Info("AIPlayer", `Spawned ${this.Name} (${this.Skill}) at ${position}`);
	}

	private FindNearestOwnedResource(playerData: PlayerData): BasePart | undefined {
		const resourcesFolder = game.Workspace.FindFirstChild("Resources");
		if (!resourcesFolder) return undefined;

		let nearest: BasePart | undefined;
		let minDist = 3000; // Increased search distance for "all over the map"

		const ownedTileKeys = playerData.TileOwnershipManager.GetPlayerTiles(playerData.Player);
		const ownedSet = new Set<string>(ownedTileKeys);

		for (const res of resourcesFolder.GetChildren()) {
			if (res.IsA("BasePart")) {
				// 1. Check explicit OwnerId first
				const ownerId = res.GetAttribute("OwnerId") as number | undefined;
				if (ownerId !== undefined) {
					if (ownerId !== this.UserId) continue;
					// It's ours, skip tile check
				} else {
					// 2. Fallback to Tile ownership
					const q = res.GetAttribute("TileQ") as number | undefined;
					const r = res.GetAttribute("TileR") as number | undefined;
					if (q === undefined || r === undefined) continue;

					const tileKey = `${q}_${r}`;
					if (!ownedSet.has(tileKey)) continue;
				}

				const dist = this.Character!.PrimaryPart!.Position.sub(res.Position).Magnitude;
				if (dist < minDist) {
					minDist = dist;
					nearest = res;
				}
			}
		}

		if (!nearest && resourcesFolder.GetChildren().size() > 0) {
			// Debug: if there are resources but none were ours
			// Logger.Debug("AIPlayer", `${this.Name} found no owned resources among ${resourcesFolder.GetChildren().size()} items`);
		}

		return nearest;
	}

	public Update(deltaTime: number, playerData: PlayerData, mapGenerator: MapGenerator, marketManager: MarketManager) {
		if (!this.Character || !this.Character.PrimaryPart) return;

		// Startup delay
		if (!this.spawnTime) {
			this.spawnTime = playerData.GameTime;
		}
		if (playerData.GameTime - this.spawnTime < AIPlayer.STARTUP_DELAY) {
			return;
		}

		// Pulse Logic: Force "Think" on phase change
		const pulseTimer = playerData.PulseTimer;
		if (pulseTimer !== -1) {
			const currentPhase = pulseTimer > 30 ? 0 : 1;
			if (currentPhase !== this.lastPulsePhase) {
				this.lastPulsePhase = currentPhase;
				this.thoughtPending = true;
			}
		}

		if (this.State === "Idle") {
			// Priority 1: Decide on next major action (Think)
			if (this.thoughtPending || (pulseTimer !== -1 && playerData.NeedsFirstTown && this.taskQueue.size() === 0)) {
				this.thoughtPending = false;
				this.State = "Thinking";
				// Deterministic Think
				this.DecideAction(playerData, mapGenerator, marketManager);
				return;
			}

			// Priority 2: Process Queue
			if (this.taskQueue.size() > 0) {
				const task = this.taskQueue.shift()!;
				this.pendingAction = { type: task.buildingType ?? "", position: task.position, actionData: undefined };
				this.pendingResource = task.part;
				this.State = task.type === "BUILD" ? "Moving" : "MovingToResource";
				return;
			}

			// Priority 3: Opportunistic Resource Collection
			const resource = this.FindNearestOwnedResource(playerData);
			if (resource) {
				this.pendingResource = resource;
				this.State = "MovingToResource";
				this.currentPath = undefined;
				return;
			}
		}

		// Handle Movement
		if (this.State === "MovingToResource" || this.State === "Moving") {
			const targetPos = this.State === "MovingToResource" ? this.pendingResource?.Position : this.pendingAction?.position;

			if (!targetPos || (this.State === "MovingToResource" && !this.pendingResource?.Parent)) {
				if (this.State === "MovingToResource") {
					this.pendingResource = undefined;
					this.State = "Idle";
				} else {
					this.CancelCurrentAction("Target invalid");
				}
				return;
			}

			const humanoid = this.Character.FindFirstChildOfClass("Humanoid");
			if (humanoid) {
				this.FollowPath(humanoid, targetPos, playerData.GameTime);

				const dist = this.Character.PrimaryPart.Position.sub(targetPos).Magnitude;
				const arrivalThreshold = this.State === "MovingToResource" ? 5 : 12;

				if (dist < arrivalThreshold) {
					this.consecutiveStuckCount = 0;
					if (this.State === "MovingToResource") {
						this.currentPath = undefined;
						// Wait for pickup physics
					} else {
						this.State = "Executing";
						this.currentPath = undefined;
					}
				}
			}
			return;
		}

		// Handle Execution
		if (this.State === "Executing") {
			if (this.pendingAction && this.pendingAction.type !== "") {
				const { type: actionType, position } = this.pendingAction;
				const [success, result] = playerData.BuildingManager.StartBuilding(actionType, position);

				if (success) {
					Logger.Info("AIPlayer", `${this.Name} built ${actionType}!`);
					if (playerData.NeedsFirstTown && actionType === "Town") {
						playerData.NeedsFirstTown = false;
					}
				} else {
					Logger.Warn("AIPlayer", `${this.Name} failed to build ${actionType}: ${result}`);
					if (actionType === "Town") {
						this.failedTownSpots.push(position);
					}
				}

				this.pendingAction = undefined;
				this.State = "Idle";
				return;
			} else {
				this.pendingAction = undefined;
				this.State = "Idle";
				return;
			}
		}

		// Fake "Thinking" delay
		if (this.State === "Thinking") {
			this.State = "Idle"; // Instant think
		}
	}

	public EvaluateMarketOffer(offer: MarketOffer, playerData: PlayerData, marketManager: MarketManager) {
		if (offer.posterId === this.UserId) return;
		if (this.State === "Thinking" || this.State === "Executing") return;

		const resources = playerData.ResourceManager.Resources;
		const have = resources[offer.wantType] ?? 0;

		// Only evaluate if we have surplus of what they want
		if (have > 2) {
			// Reuse TryMarketTrade to re-evaluate all offers (includes the new one)
			// This is simpler and ensures we pick the best one available right now
			this.TryMarketTrade(playerData, marketManager);
		}
	}

	public GetTaskQueueSize() { return this.taskQueue.size(); }

	private CancelCurrentAction(reason: string) {
		this.pendingAction = undefined;
		this.pendingResource = undefined;
		this.currentPath = undefined;
		this.consecutiveStuckCount = 0;
		this.State = "Idle";
		if (reason === "Stuck" || reason === "Timeout") {
			this.taskQueue = [];
		}
	}

	public RecordFailedPlacement(pos: Vector3) {
		this.failedTownSpots.push(pos);
	}

	private FollowPath(humanoid: Humanoid, targetPos: Vector3, gameTime: number) {
		const myPos = this.Character!.PrimaryPart!.Position;
		const totalDist = myPos.sub(targetPos).Magnitude;

		// Dynamic Speed: Scaled aggressively for long distances to ensure quick map traversal
		let multiplier = 1;
		if (totalDist > 400) multiplier = 5.0;      // Extreme distance (e.g. across map)
		else if (totalDist > 200) multiplier = 4.0; // Very far
		else if (totalDist > 100) multiplier = 2.5; // Far
		else if (totalDist > 50) multiplier = 1.8;  // Approaching
		else if (totalDist > 25) multiplier = 1.3;  // Near

		humanoid.WalkSpeed = this.baseWalkSpeed * multiplier;

		// Direct movement for close targets
		if (totalDist < 25) {
			humanoid.MoveTo(targetPos);
			this.currentPath = undefined;
			if (totalDist < 10 && (this.consecutiveStuckCount > 0)) {
				humanoid.Jump = true; // Small hop if struggling up close
			}
			return;
		}

		if (!this.currentPath) {
			const isStuck = this.consecutiveStuckCount > 4;
			const radius = isStuck ? 6 : 3;

			const newPath = PathfindingService.CreatePath({
				AgentRadius: radius,
				AgentHeight: 6,
				AgentCanJump: true,
				Costs: {
					Water: math.huge,
					Mud: 10,
				}
			});

			const [success] = pcall(() => {
				newPath.ComputeAsync(myPos, targetPos);
			});

			if (success && newPath.Status === Enum.PathStatus.Success) {
				this.currentPath = newPath;
				this.currentWaypointIndex = 0;
			} else {
				humanoid.MoveTo(targetPos);
				return;
			}
			this.lastMoveTime = gameTime;
			this.lastPositionTime = gameTime;
			this.lastCheckedPosition = myPos;
		}

		// Stuck Checks
		if (gameTime - this.lastPositionTime > 2) {
			const travelled = this.lastCheckedPosition ? myPos.sub(this.lastCheckedPosition).Magnitude : 10;
			if (travelled < 3) {
				this.consecutiveStuckCount++;
				if (this.consecutiveStuckCount >= 8) {
					this.CancelCurrentAction("Stuck");
					return;
				}
				this.currentPath = undefined;
				humanoid.Jump = true;
				const nudgeY = this.consecutiveStuckCount > 4 ? 10 : 0;
				const nudgeDir = new Vector3(math.random(-15, 15), nudgeY, math.random(-15, 15));
				humanoid.MoveTo(myPos.add(nudgeDir));
				this.lastPositionTime = gameTime;
				this.lastCheckedPosition = myPos;
				return;
			}
			this.lastPositionTime = gameTime;
			this.lastCheckedPosition = myPos;
		}

		if (gameTime - this.lastMoveTime > 30) {
			this.CancelCurrentAction("Timeout");
			return;
		}

		const waypoints = this.currentPath.GetWaypoints();
		if (this.currentWaypointIndex < waypoints.size()) {
			const wp = waypoints[this.currentWaypointIndex];
			humanoid.MoveTo(wp.Position);
			const waypointThreshold = math.clamp(humanoid.WalkSpeed / 12, 4, 15);
			if (myPos.sub(wp.Position).Magnitude < waypointThreshold) {
				this.currentWaypointIndex++;
				if (wp.Action === Enum.PathWaypointAction.Jump) humanoid.Jump = true;
			}
		} else {
			humanoid.MoveTo(targetPos);
			if (myPos.sub(targetPos).Magnitude > 20) {
				this.currentPath = undefined;
			}
		}
	}

	// ==========================================
	// Deterministic Decision Logic
	// ==========================================
	private GetTargetBuilding(playerData: PlayerData, mapGenerator: MapGenerator): { type: "City" | "Town" | "Road", position?: Vector3 } | undefined {
		const towns = playerData.BuildingManager.Towns;

		// 1. Initial Town (Setup)
		if (playerData.NeedsFirstTown) {
			const spot = this.GetBestTownSpot(mapGenerator, true);
			if (spot) return { type: "Town", position: spot };
		}

		// 2. expansion Selection: Find the best town spot we WANT to reach
		// We use isInitial=false here to consider connection rules
		const targetExpansionSpot = this.GetBestTownSpot(mapGenerator, false);

		// 3. City Upgrade
		// Focus on upgrades if we have a solid base (>= 3 towns).
		if (towns.size() >= 3) {
			// Find a town we own that isn't already a city
			const townToUpgrade = towns.find(t => t.Type === "Town" && t.OwnerId === this.UserId);
			if (townToUpgrade && this.CanAfford("City", playerData.ResourceManager.Resources)) {
				return { type: "City", position: townToUpgrade.Position };
			}
		}

		// 4. Expansion: If we have a target spot and are connected, build Town
		if (targetExpansionSpot) {
			const [vertex] = mapGenerator.FindNearestVertex(targetExpansionSpot);
			if (vertex && this.IsConnectedToRoad(vertex, this.UserId)) {
				return { type: "Town", position: targetExpansionSpot };
			}
		}

		// 5. Road Building: If we have a target spot but aren't connected, build roads towards it
		if (targetExpansionSpot) {
			const edge = this.GetBestRoadSpot(playerData, targetExpansionSpot);
			if (edge) return { type: "Road", position: edge };
		}

		// 6. Fallback: If no expansion target (rare), just upgrade to City or build random road
		const fallbackTown = towns.find(t => t.Type === "Town");
		if (fallbackTown) return { type: "City", position: fallbackTown.Position };

		const randomEdge = this.GetBestRoadSpot(playerData);
		if (randomEdge) return { type: "Road", position: randomEdge };

		return undefined;
	}

	private GetResourceNeeds(targetType: "City" | "Town" | "Road", resources: Record<string, number>): Record<string, number> {
		const needs: Record<string, number> = {};
		const costs: Record<string, Record<string, number>> = {
			City: { Wheat: 2, Ore: 3 },
			Town: { Wood: 1, Brick: 1, Wheat: 1, Wool: 1 },
			Road: { Wood: 1, Brick: 1 }
		};

		const cost = costs[targetType];
		for (const [res, amt] of pairs(cost)) {
			const have = resources[res as string] ?? 0;
			if (have < (amt as number)) {
				needs[res as string] = (amt as number) - have;
			}
		}
		return needs;
	}

	private DecideAction(playerData: PlayerData, mapGenerator: MapGenerator, marketManager: MarketManager) {
		const resources = playerData.ResourceManager.Resources;
		const target = this.GetTargetBuilding(playerData, mapGenerator);
		if (target) {
			if (this.CanAfford(target.type, resources)) {
				this.taskQueue.push({ type: "BUILD", buildingType: target.type, position: target.position ?? new Vector3() });
				Logger.Info("AIPlayer", `${this.Name} decided to build ${target.type.upper()}`);
				return;
			} else {
				// We want something but can't afford it yet.
				// Try trading for it!
				this.TryTradeForNeeds(playerData, target.type, marketManager);
			}
		}

		// 5. General Trade Logic (Balancing)
		this.TryTrade(playerData);
		this.TryMarketTrade(playerData, marketManager);

		// 6. Resource Collection (Opportunistic & Aggressive)
		// If we are strictly waiting (no active build tasks), fill the queue with nearby resources
		if (this.taskQueue.isEmpty() || this.taskQueue.every(t => t.type === "COLLECT")) {
			const resourcesFolder = game.Workspace.FindFirstChild("Resources");
			if (resourcesFolder) {
				const ownedResources: { part: BasePart, dist: number }[] = [];
				const myPos = this.Character!.PrimaryPart!.Position;

				// Scan for all our resources in range
				for (const res of resourcesFolder.GetChildren()) {
					if (res.IsA("BasePart")) {
						const ownerId = res.GetAttribute("OwnerId") as number | undefined;
						if (ownerId === this.UserId) {
							const dist = myPos.sub(res.Position).Magnitude;
							if (dist < 3000) ownedResources.push({ part: res as BasePart, dist });
						}
					}
				}

				// Sort by distance and push the nearest 5 to the queue
				ownedResources.sort((a, b) => a.dist < b.dist);
				for (let i = 0; i < math.min(ownedResources.size(), 5); i++) {
					const res = ownedResources[i].part;
					// Only push if not already in queue (crude check via position)
					if (!this.taskQueue.some(t => t.position === res.Position)) {
						this.taskQueue.push({ type: "COLLECT", part: res, position: res.Position });
					}
				}

				if (ownedResources.size() > 0) {
					Logger.Info("AIPlayer", `${this.Name} queued ${math.min(ownedResources.size(), 5)} resources for collection`);
				}
			}
		}
	}

	private CanAfford(building: "City" | "Town" | "Road", resources: Record<string, number>): boolean {
		if (building === "City") return resources.Wheat >= 2 && resources.Ore >= 3;
		if (building === "Town") return resources.Wood >= 1 && resources.Brick >= 1 && resources.Wheat >= 1 && resources.Wool >= 1;
		if (building === "Road") return resources.Wood >= 1 && resources.Brick >= 1;
		return false;
	}

	private IsConnectedToRoad(vertex: BasePart, ownerId: number): boolean {
		const vertexKey = vertex.GetAttribute("Key") as string;
		if (!vertexKey) return false;

		const edgeFolder = game.Workspace.FindFirstChild("Edges");
		const buildingsFolder = game.Workspace.FindFirstChild("Buildings");
		if (!edgeFolder || !buildingsFolder) return false;

		// Find all edges touching this vertex
		for (const edge of edgeFolder.GetChildren()) {
			if (edge.IsA("BasePart")) {
				if (edge.GetAttribute("Vertex1") === vertexKey || edge.GetAttribute("Vertex2") === vertexKey) {
					const edgeKey = edge.GetAttribute("Key") as string;

					// Check if there's a road owned by the player on this edge
					for (const building of buildingsFolder.GetChildren()) {
						if (building.IsA("Model") && building.GetAttribute("Key") === edgeKey) {
							if (building.GetAttribute("OwnerId") === ownerId) {
								return true;
							}
						}
					}
				}
			}
		}

		return false;
	}

	private GetBestTownSpot(mapGenerator: MapGenerator, isInitial: boolean): Vector3 | undefined {
		// Simplified scoring
		let bestScore = -999;
		let bestPos: Vector3 | undefined;

		const towns = game.Workspace.FindFirstChild("Towns")?.GetChildren().filter(t => t.IsA("Model") && t.GetAttribute("OwnerId") === this.UserId) ?? [];
		const needsConnection = !isInitial && towns.size() >= 2;

		// Attempt 100 random samples (increased to ensure we find valid spots)
		for (let i = 0; i < 100; i++) {
			const v = mapGenerator.GetRandomVertex();
			if (!v) continue;

			// Skip known failed spots (within 5 studs)
			let isFailed = false;
			for (const failed of this.failedTownSpots) {
				if (v.Position.sub(failed).Magnitude < 5) {
					isFailed = true;
					break;
				}
			}
			if (isFailed) continue;

			const adjCount = (v.GetAttribute("AdjacentTileCount") as number ?? 0);
			if (adjCount < 2) continue;

			// Check connection rule if applicable
			if (needsConnection) {
				if (!this.IsConnectedToRoad(v, this.UserId)) continue;
			}

			const score = this.CalculateSpotScore(v); // Reuse existing score logic
			if (score > bestScore) {
				bestScore = score;
				bestPos = v.Position;
			}
		}
		return bestPos;
	}

	private GetBestRoadSpot(playerData: PlayerData, targetTownPos?: Vector3): Vector3 | undefined {
		// 1. Identify all road-end points (vertices that touch our roads or towns)
		const edgesFolder = game.Workspace.FindFirstChild("Edges");
		const buildingsFolder = game.Workspace.FindFirstChild("Buildings");
		const townsFolder = game.Workspace.FindFirstChild("Towns");
		if (!edgesFolder) return undefined;

		const myEdges = new Set<string>();
		if (buildingsFolder) {
			for (const b of buildingsFolder.GetChildren()) {
				if (b.IsA("Model") && b.GetAttribute("OwnerId") === this.UserId) {
					const key = b.GetAttribute("Key") as string;
					if (key) myEdges.add(key);
				}
			}
		}

		const myTownVertices = new Set<string>();
		if (townsFolder) {
			for (const t of townsFolder.GetChildren()) {
				if (t.IsA("Model") && t.GetAttribute("OwnerId") === this.UserId) {
					const key = t.GetAttribute("Key") as string;
					if (key) myTownVertices.add(key);
				}
			}
		}

		// 2. Find valid empty edges connected to our network
		const candidates: { pos: Vector3, score: number }[] = [];

		for (const edgePart of edgesFolder.GetChildren()) {
			if (!edgePart.IsA("BasePart")) continue;

			const key = edgePart.GetAttribute("Key") as string;
			// Skip if already occupied by anyone
			let occupied = false;
			if (buildingsFolder) {
				for (const b of buildingsFolder.GetChildren()) {
					if (b.IsA("Model") && b.GetAttribute("Key") === key) {
						occupied = true;
						break;
					}
				}
			}
			if (occupied) continue;

			const v1 = edgePart.GetAttribute("Vertex1") as string;
			const v2 = edgePart.GetAttribute("Vertex2") as string;

			// Check if connected to our town
			const connectedToTown = myTownVertices.has(v1) || myTownVertices.has(v2);

			// Check if connected to our road (requires sharing a vertex with an owned edge)
			let connectedToRoad = false;
			if (!connectedToTown) {
				for (const myEdgeKey of myEdges) {
					const [mv1, mv2] = string.split(myEdgeKey, ":");
					if (mv1 === v1 || mv1 === v2 || mv2 === v1 || mv2 === v2) {
						connectedToRoad = true;
						break;
					}
				}
			}

			if (connectedToTown || connectedToRoad) {
				let score = 0;
				if (targetTownPos) {
					// Score based on distance to target - closer is better
					const dist = edgePart.Position.sub(targetTownPos).Magnitude;
					score = 1000 - dist;
				} else {
					// random fallback
					score = math.random(1, 100);
				}
				candidates.push({ pos: edgePart.Position, score });
			}
		}

		if (candidates.size() === 0) return undefined;

		candidates.sort((a, b) => a.score > b.score);
		return candidates[0].pos;
	}

	private TryTradeForNeeds(playerData: PlayerData, targetType: "City" | "Town" | "Road", marketManager: MarketManager) {
		const resources = playerData.ResourceManager.Resources;
		const needs = this.GetResourceNeeds(targetType, resources);

		let nextNeed: string | undefined;
		for (const [res, _] of pairs(needs)) {
			nextNeed = res as string;
			break;
		}
		if (!nextNeed) return;

		// Find surplus resources (not needed for this building and > 1)
		const surpluses: { res: string, amt: number }[] = [];
		const costs: Record<string, Record<string, number>> = {
			City: { Wheat: 2, Ore: 3 },
			Town: { Wood: 1, Brick: 1, Wheat: 1, Wool: 1 },
			Road: { Wood: 1, Brick: 1 }
		};
		const targetCost = costs[targetType];

		for (const [res, amt] of pairs(resources)) {
			const neededForTarget = targetCost[res as string] ?? 0;
			if ((amt as number) > neededForTarget) {
				surpluses.push({ res: res as string, amt: (amt as number) - neededForTarget });
			}
		}

		if (surpluses.size() === 0) return;

		// Sort surpluses by amount descending
		surpluses.sort((a, b) => a.amt > b.amt);

		// 1. Try Port Trade first (Internal)
		for (const surplus of surpluses) {
			const ratio = playerData.PortManager.GetBestTradeRatio(surplus.res);
			if (surplus.amt >= ratio) {
				const [success] = playerData.PortManager.ExecuteTrade(surplus.res, nextNeed);
				if (success) {
					Logger.Info("AIPlayer", `${this.Name} traded surplus ${surplus.res} for needed ${nextNeed} (Port)`);
					return;
				}
			}
		}

		// 2. Try Posting to Market (External)
		const myActiveOffers = marketManager.GetOffers().filter(o => o.posterId === this.UserId);
		if (myActiveOffers.size() < 3) {
			const alreadySeeking = myActiveOffers.some(o => o.wantType === nextNeed);
			if (!alreadySeeking) {
				for (const surplus of surpluses) {
					if (surplus.amt >= 1) {
						const giveDict: ResourceDict = { [surplus.res]: 1 };
						const success = marketManager.PostOffer(this.UserId, giveDict, nextNeed as ResourceType, 1);
						if (success) {
							Logger.Info("AIPlayer", `${this.Name} posted market trade: 1 ${surplus.res} for 1 ${nextNeed}`);
							return;
						}
					}
				}
			}
		}
	}

	private TryMarketTrade(playerData: PlayerData, marketManager: MarketManager) {
		const resources = playerData.ResourceManager.Resources;
		const activeOffers = marketManager.GetOffers();

		// Priority 1: Scan for trades that fill any immediate needs (even if not target building)
		for (const offer of activeOffers) {
			if (offer.posterId === this.UserId) continue;

			let totalGive = 0;
			for (const [_, amt] of pairs(offer.giveResources)) totalGive += (amt as number);

			if (totalGive >= 1 && resources[offer.wantType] >= 2) {
				// Check if this helps me with ANY resource I have 0 of
				let helpsMe = false;
				for (const [res, amt] of pairs(offer.giveResources)) {
					if (resources[res as string] === 0 && (amt as number) > 0) {
						helpsMe = true;
						break;
					}
				}

				if (helpsMe) {
					const success = marketManager.AcceptOffer(this.UserId, offer.id);
					if (success) {
						Logger.Info("AIPlayer", `${this.Name} accepted market trade for ${offer.wantAmount} ${offer.wantType}`);
						return;
					}
				}
			}
		}

		// Priority 2: Post surplus if we have LOTS of something (global balancing)
		const myActiveCount = activeOffers.filter(o => o.posterId === this.UserId).size();
		if (myActiveCount < 2) {
			for (const [res, amt] of pairs(resources)) {
				if ((amt as number) > 4) { // Lowered from 6
					// Find something I have 0 or 1 of
					for (const [neededRes, neededAmt] of pairs(resources)) {
						if ((neededAmt as number) <= 1 && neededRes !== res) {
							const giveDict: ResourceDict = { [res as string]: 1 };
							const success = marketManager.PostOffer(this.UserId, giveDict, neededRes as ResourceType, 1);
							if (success) {
								Logger.Info("AIPlayer", `${this.Name} posted balancing trade: 1 ${res} for 1 ${neededRes}`);
								return;
							}
						}
					}
				}
			}
		}
	}

	private TryTrade(playerData: PlayerData) {
		const res = playerData.ResourceManager.Resources;
		// Basic Balancing: if > 4 of anything, trade for something we have 0 of
		for (const [r, amt] of pairs(res)) {
			if ((amt as number) > 4) {
				// Find shortage
				for (const [missing, mAmt] of pairs(res)) {
					if ((mAmt as number) === 0) {
						playerData.PortManager.ExecuteTrade(r as string, missing as string);
						Logger.Info("AIPlayer", `Trade Balance: ${r} -> ${missing}`);
						return;
					}
				}
			}
		}
	}

	// Reused utility
	private CalculateSpotScore(vertex: BasePart): number {
		let totalScore = 0;
		const mapFolder = game.Workspace.FindFirstChild("Map");
		if (!mapFolder) return 0;
		const key = vertex.GetAttribute("Key") as string;

		// Occupancy
		const townsFolder = game.Workspace.FindFirstChild("Towns");
		if (townsFolder) {
			for (const s of townsFolder.GetChildren()) {
				if (s.IsA("Model") && s.GetAttribute("Key") === key) return -100;
				if (s.IsA("Model") && s.PrimaryPart) {
					if (s.PrimaryPart.Position.sub(vertex.Position).Magnitude < 45) return -50;
				}
			}
		}

		// Tile score
		for (let i = 1; i <= 3; i++) {
			const q = vertex.GetAttribute(`Tile${i}Q`) as number;
			const r = vertex.GetAttribute(`Tile${i}R`) as number;
			if (q === undefined) continue;

			for (const tile of mapFolder.GetChildren()) {
				if (tile.IsA("Model") && tile.PrimaryPart) {
					if (tile.PrimaryPart.GetAttribute("Q") === q && tile.PrimaryPart.GetAttribute("R") === r) {
						const diceNum = tile.PrimaryPart.GetAttribute("DiceNumber") as number;
						if (diceNum) totalScore += (6 - math.abs(7 - diceNum));
						break;
					}
				}
			}
		}
		return totalScore;
	}

	public HandleSetupTurn(step: "Town1" | "Road1" | "Town2" | "Road2", mapGenerator: MapGenerator, gameService: GameState) {
		// Same Setup Logic
		task.delay(1.0, () => {
			if (step.sub(1, 4) === "Town") {
				const bestPos = this.GetBestTownSpot(mapGenerator, true);
				if (bestPos) gameService.OnSetupPlacement(this.UserId, "Town", bestPos);
			} else {
				// Road logic reused from previous
				const playerData = gameService.PlayerData[this.UserId];
				if (playerData) {
					const towns = playerData.BuildingManager.GetTowns();
					const lastTown = towns[towns.size() - 1];
					if (lastTown) {
						const edgesFolder = game.Workspace.FindFirstChild("Edges");
						if (edgesFolder) {
							for (const edge of edgesFolder.GetChildren()) {
								if (edge.IsA("BasePart")) {
									const dist = edge.Position.sub(lastTown.Position).Magnitude;
									if (dist < 40) {
										gameService.OnSetupPlacement(this.UserId, "Road", edge.Position);
										return;
									}
								}
							}
						}
					}
				}
			}
		});
	}
}
