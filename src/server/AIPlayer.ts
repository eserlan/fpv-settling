import type { AIPlayerInterface } from "shared/GameEntity";
import type { PlayerData } from "./PlayerData";
import { LLMService, AIAction } from "./services/LLMService";
import { PROMPTS, SkillLevel } from "./AIPrompts";
import * as Logger from "shared/Logger";
import type { MapGenerator } from "./services/MapGenerator";
import { ServerEvents } from "./ServerEvents";

const PathfindingService = game.GetService("PathfindingService");

export class AIPlayer implements AIPlayerInterface {
	public UserId: number;
	public Name: string;
	public Character?: Model;
	public IsAI = true;
	public Skill: SkillLevel;

	// AI Logic State
	public State: "Idle" | "Thinking" | "Moving" | "Executing" | "MovingToResource" = "Idle";
	private pendingAction?: { type: string, position: Vector3, actionData?: AIAction };
	private pendingResource?: BasePart;
	private actionsThisPulse: number = 0;
	private lastPulsePhase: number = 1; // 0 for [60-30], 1 for [30-0]
	private thoughtPending: boolean = false;
	private taskQueue: Array<{ type: "BUILD" | "COLLECT", buildingType?: string, position: Vector3, part?: BasePart }> = [];

	// Pathfinding
	private currentPath?: Path;
	private currentWaypointIndex: number = 0;
	private lastMoveTime: number = 0;
	private lastCheckedPosition?: Vector3;
	private lastPositionTime: number = 0;
	private consecutiveStuckCount: number = 0;
	private lastThoughtPendingTime?: number;
	private spawnTime?: number;
	private static readonly STARTUP_DELAY = 25; // Seconds to wait before AI starts acting

	private llmService: LLMService;

	constructor(id: number, name: string, skill: SkillLevel = "Intermediate") {
		this.UserId = id;
		this.Name = name;
		this.Skill = skill;
		this.llmService = new LLMService();
	}

	public Kick(message?: string) {
		// No-op for AI
		Logger.Info("AIPlayer", `${this.Name} kicked: ${message}`);
	}

	public Spawn(position: Vector3) {
		if (this.Character) {
			this.Character.Destroy();
		}

		const model = new Instance("Model");
		model.Name = this.Name;

		// Simple avatar for AI
		const torso = new Instance("Part");
		torso.Name = "Torso";
		torso.Size = new Vector3(2, 2, 1);
		torso.Position = position.add(new Vector3(0, 3, 0));
		torso.CanCollide = true;
		torso.Anchored = false;
		torso.Parent = model;

		const root = new Instance("Part");
		root.Name = "HumanoidRootPart";
		root.Size = new Vector3(2, 2, 1);
		root.Position = torso.Position;
		root.Transparency = 1;
		root.CanCollide = false;
		root.Parent = model;

		const head = new Instance("Part");
		head.Name = "Head";
		head.Size = new Vector3(1, 1, 1);
		head.Shape = Enum.PartType.Ball;
		head.Color = Color3.fromRGB(200, 200, 200);
		head.Position = torso.Position.add(new Vector3(0, 1.5, 0));
		head.Parent = model;

		const weld = new Instance("WeldConstraint");
		weld.Part0 = torso;
		weld.Part1 = head;
		weld.Parent = torso;

		const weld2 = new Instance("WeldConstraint");
		weld2.Part0 = torso;
		weld2.Part1 = root;
		weld2.Parent = torso;

		const humanoid = new Instance("Humanoid");
		humanoid.DisplayName = `[${this.Skill}] ${this.Name}`;
		humanoid.Parent = model;

		model.PrimaryPart = torso;
		model.Parent = game.Workspace;
		this.Character = model;

		// Color based on skill level
		if (this.Skill === "Beginner") {
			torso.Color = Color3.fromRGB(100, 255, 100); // Green
		} else if (this.Skill === "Intermediate") {
			torso.Color = Color3.fromRGB(100, 100, 255); // Blue
		} else {
			torso.Color = Color3.fromRGB(255, 100, 100); // Red (Expert)
		}
	}

	private FindNearestOwnedResource(playerData: PlayerData): BasePart | undefined {
		const resourcesFolder = game.Workspace.FindFirstChild("Resources");
		if (!resourcesFolder) return undefined;

		let nearest: BasePart | undefined;
		let minDist = 200; // Max search distance for AI

		// Get the list of tiles this player owns
		const ownedTileKeys = playerData.TileOwnershipManager.GetPlayerTiles(playerData.Player);
		const ownedSet = new Set<string>(ownedTileKeys);

		for (const res of resourcesFolder.GetChildren()) {
			if (res.IsA("BasePart")) {
				const q = res.GetAttribute("TileQ") as number | undefined;
				const r = res.GetAttribute("TileR") as number | undefined;

				if (q === undefined || r === undefined) continue;

				// Check if AI owns this tile using the proper key format
				const tileKey = `${q}_${r}`;
				if (!ownedSet.has(tileKey)) continue;

				const dist = this.Character!.PrimaryPart!.Position.sub(res.Position).Magnitude;
				if (dist < minDist) {
					minDist = dist;
					nearest = res;
				}
			}
		}

		return nearest;
	}

	public Update(deltaTime: number, playerData: PlayerData, mapGenerator: MapGenerator) {
		if (!this.Character || !this.Character.PrimaryPart) return;

		// Startup delay: give human players time to orient
		if (!this.spawnTime) {
			this.spawnTime = playerData.GameTime;
		}
		if (playerData.GameTime - this.spawnTime < AIPlayer.STARTUP_DELAY) {
			return; // Still in grace period
		}

		// 0. Detect Pulse Phase Transitions (must happen regardless of state)
		const pulseTimer = playerData.PulseTimer;
		if (pulseTimer !== -1) {
			const currentPhase = pulseTimer > 30 ? 0 : 1;
			if (currentPhase !== this.lastPulsePhase) {
				this.lastPulsePhase = currentPhase;
				this.thoughtPending = true;
				const phaseName = currentPhase === 0 ? "Pulse Reset" : "Mid-Pulse";
				Logger.Info("AIPlayer", `${this.Name} phase transition: ${phaseName} (pending thought, state=${this.State})`);
			}
		}

		// Safety: If we have a pending thought but are stuck in a non-Idle state, force reset
		if (this.thoughtPending && this.State !== "Idle" && this.State !== "Thinking") {
			// Give the current action a few seconds to finish, then force unstick
			if (!this.lastThoughtPendingTime) {
				this.lastThoughtPendingTime = playerData.GameTime;
			} else if (playerData.GameTime - this.lastThoughtPendingTime > 15) {
				Logger.Warn("AIPlayer", `${this.Name} stuck in ${this.State} for 15s with pending thought, forcing Idle`);
				this.CancelCurrentAction("Thought Timeout");
				this.lastThoughtPendingTime = undefined;
			}
		} else {
			this.lastThoughtPendingTime = undefined;
		}

		if (this.State === "Idle") {
			// Priority 1: Strategic Thinking (Pulse synchronized or Initial)
			if (this.thoughtPending || (playerData.NeedsFirstSettlement && this.taskQueue.size() === 0)) {
				this.thoughtPending = false;
				this.State = "Thinking";
				this.Think(playerData, mapGenerator);
				return;
			}

			// Priority 2: Process Task Queue (Strategic decisions from Think)
			if (this.taskQueue.size() > 0) {
				const task = this.taskQueue.shift()!;
				this.pendingAction = { type: task.buildingType ?? "", position: task.position, actionData: undefined };
				this.pendingResource = task.part;
				this.State = task.type === "BUILD" ? "Moving" : "MovingToResource";
				return;
			}

			// Priority 3: Collect nearby resources autonomously
			const resource = this.FindNearestOwnedResource(playerData);
			if (resource) {
				this.pendingResource = resource;
				this.State = "MovingToResource";
				this.currentPath = undefined;
				Logger.Info("AIPlayer", `${this.Name} → high-priority autonomous collection of ${resource.GetAttribute("ResourceType")}`);
				return;
			}
		}

		// Handle movement states (Both Resource and Build)
		if (this.State === "MovingToResource" || this.State === "Moving") {
			const targetPos = this.State === "MovingToResource" ? this.pendingResource?.Position : this.pendingAction?.position;

			if (!targetPos || (this.State === "MovingToResource" && !this.pendingResource?.Parent)) {
				// Resource was collected (destroyed) or lost - we're done!
				if (this.State === "MovingToResource") {
					Logger.Debug("AIPlayer", `${this.Name} resource collected or lost, going Idle`);
					this.pendingResource = undefined;
					this.State = "Idle";
				} else {
					this.CancelCurrentAction("Target lost or missing");
				}
				return;
			}

			const humanoid = this.Character.FindFirstChildOfClass("Humanoid");
			if (humanoid) {
				this.FollowPath(humanoid, targetPos, playerData.GameTime);

				const dist = this.Character.PrimaryPart.Position.sub(targetPos).Magnitude;
				// Use different thresholds: closer for resources (need to touch), farther for builds
				const arrivalThreshold = this.State === "MovingToResource" ? 5 : 12;

				if (dist < arrivalThreshold) {
					this.consecutiveStuckCount = 0;
					if (this.State === "MovingToResource") {
						// Don't immediately go Idle - wait for the resource to be collected (destroyed)
						// The touch-based collection should trigger soon
						// Just stop moving and let physics handle the pickup
						this.currentPath = undefined;
						// Keep checking - if resource is still here next frame, we'll keep waiting
						// The check at line 206 will catch when it's finally collected
					} else {
						this.State = "Executing";
						Logger.Info("AIPlayer", `${this.Name} arrived at build site.`);
						this.currentPath = undefined;
					}
				}
			}
			return;
		}

		// Handle action execution
		if (this.State === "Executing") {
			if (this.pendingAction && this.pendingAction.type !== "") {
				const { type: actionType, position } = this.pendingAction;
				const [success, result] = playerData.BuildingManager.StartBuilding(actionType, position);

				if (success) {
					Logger.Info("AIPlayer", `${this.Name} built ${actionType}!`);
					if (playerData.NeedsFirstSettlement && actionType === "Settlement") {
						playerData.NeedsFirstSettlement = false;
					}
				} else {
					Logger.Warn("AIPlayer", `${this.Name} failed to build ${actionType}: ${result}`);
				}

				this.pendingAction = undefined;
				this.State = "Idle";
				return;
			} else {
				// Safety: Stuck in Executing with no valid action
				Logger.Warn("AIPlayer", `${this.Name} stuck in Executing with no action, resetting to Idle`);
				this.pendingAction = undefined;
				this.State = "Idle";
				return;
			}
		}
	}

	public GetTaskQueueSize() {
		return this.taskQueue.size();
	}

	private CancelCurrentAction(reason: string) {
		Logger.Warn("AIPlayer", `${this.Name} cancelling action: ${reason}`);
		this.pendingAction = undefined;
		this.pendingResource = undefined;
		this.currentPath = undefined;
		this.consecutiveStuckCount = 0;
		this.State = "Idle";
		// Clear queue if we are totally stuck, so we can re-evaluate on next pulse
		if (reason === "Stuck" || reason === "Timeout") {
			this.taskQueue = [];
		}
	}

	private FollowPath(humanoid: Humanoid, targetPos: Vector3, gameTime: number) {
		const myPos = this.Character!.PrimaryPart!.Position;

		// 1. Compute path if missing
		if (!this.currentPath) {
			const newPath = PathfindingService.CreatePath({
				AgentRadius: 3, // Slightly larger for better clearance
				AgentHeight: 6,
				AgentCanJump: true,
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

		// 2. Active Stuck Detection (Is actually moving?)
		if (gameTime - this.lastPositionTime > 3) {
			const travelled = this.lastCheckedPosition ? myPos.sub(this.lastCheckedPosition).Magnitude : 10;
			if (travelled < 2) {
				this.consecutiveStuckCount++;
				Logger.Warn("AIPlayer", `${this.Name} hasn't progressed much (${this.consecutiveStuckCount}/6), recomputing path...`);

				if (this.consecutiveStuckCount >= 6) {
					this.CancelCurrentAction("Stuck");
					this.consecutiveStuckCount = 0;
					return;
				}

				this.currentPath = undefined; // Force recalculate
				humanoid.Jump = true; // Try jumping out of it

				// Nudge if really stuck
				if (this.consecutiveStuckCount > 3) {
					const nudge = new Vector3(math.random(-10, 10), 0, math.random(-10, 10));
					humanoid.MoveTo(myPos.add(nudge));
				}

				this.lastPositionTime = gameTime;
				this.lastCheckedPosition = myPos;
				return;
			}
			// Don't reset stuck count here, only on successful arrival or state change
			this.lastPositionTime = gameTime;
			this.lastCheckedPosition = myPos;
		}

		// 3. Absolute Timeout (30s)
		if (gameTime - this.lastMoveTime > 30) {
			this.CancelCurrentAction("Timeout");
			return;
		}

		// 4. Follow waypoints
		const waypoints = this.currentPath.GetWaypoints();
		if (this.currentWaypointIndex < waypoints.size()) {
			const wp = waypoints[this.currentWaypointIndex];
			humanoid.MoveTo(wp.Position);

			if (myPos.sub(wp.Position).Magnitude < 4) {
				this.currentWaypointIndex++;
				if (wp.Action === Enum.PathWaypointAction.Jump) humanoid.Jump = true;
			}
		} else {
			// Reached end of waypoints but not destination?
			humanoid.MoveTo(targetPos);
			if (myPos.sub(targetPos).Magnitude > 20) {
				this.currentPath = undefined; // Too far from final target, recalc
			}
		}
	}

	private async Think(playerData: PlayerData, mapGenerator: MapGenerator) {
		const context = this.GatherContext(playerData, mapGenerator);
		const prompt = PROMPTS[this.Skill];

		try {
			const decision = await this.llmService.GetDecision(this.Name, prompt, context);
			if (decision) {
				this.ExecuteAction(decision, playerData, mapGenerator);
			} else {
				this.State = "Idle";
			}
		} catch (e) {
			Logger.Warn("AIPlayer", `[${this.Name}] Thinking failed: ${e}`);
			this.State = "Idle";
		}
	}

	private CalculateSpotScore(vertex: BasePart): number {
		let totalScore = 0;
		const mapFolder = game.Workspace.FindFirstChild("Map");
		if (!mapFolder) return 0;

		// Settlement spots (vertices) touch up to 3 tiles
		for (let i = 1; i <= 3; i++) {
			const q = vertex.GetAttribute(`Tile${i}Q`) as number | undefined;
			const r = vertex.GetAttribute(`Tile${i}R`) as number | undefined;
			if (q === undefined) continue;

			// Find tile with these coordinates
			for (const tile of mapFolder.GetChildren()) {
				if (tile.IsA("Model") && tile.PrimaryPart) {
					if (tile.PrimaryPart.GetAttribute("Q") === q && tile.PrimaryPart.GetAttribute("R") === r) {
						const diceNum = tile.PrimaryPart.GetAttribute("DiceNumber") as number | undefined;
						const tileType = tile.PrimaryPart.GetAttribute("TileType") as string | undefined;

						if (diceNum && tileType !== "Desert") {
							// Probability score: 6 and 8 are best (5 dots), 2 and 12 are worst (1 dot)
							const score = 6 - math.abs(7 - diceNum);
							totalScore += score;
						}
						break;
					}
				}
			}
		}
		return totalScore;
	}

	private GatherContext(playerData: PlayerData, mapGenerator: MapGenerator): string {
		const resources = playerData.ResourceManager.Resources;
		const settlements = playerData.BuildingManager.Settlements;
		const buildings = playerData.BuildingManager.Buildings;

		let context = `My Name: ${this.Name}\n`;
		context += `Skill Level: ${this.Skill}\n`;
		context += `Resources in Backpack: Wood=${resources.Wood}, Brick=${resources.Brick}, Wheat=${resources.Wheat}, Wool=${resources.Wool}, Ore=${resources.Ore}\n`;

		// Resources on ground
		const groundResources: Record<string, number> = {};
		const resFolder = game.Workspace.FindFirstChild("Resources");
		if (resFolder) {
			// Get owned tiles using the proper system
			const ownedTileKeys = playerData.TileOwnershipManager.GetPlayerTiles(playerData.Player);
			const ownedSet = new Set<string>(ownedTileKeys);

			for (const res of resFolder.GetChildren()) {
				if (res.IsA("BasePart")) {
					const q = res.GetAttribute("TileQ") as number | undefined;
					const r = res.GetAttribute("TileR") as number | undefined;
					if (q === undefined || r === undefined) continue;

					const tileKey = `${q}_${r}`;
					if (ownedSet.has(tileKey)) {
						const resType = (res.GetAttribute("ResourceType") as string) ?? "Unknown";
						groundResources[resType] = (groundResources[resType] ?? 0) + 1;
					}
				}
			}
		}

		const groundList = [];
		for (const [rt, count] of pairs(groundResources)) {
			groundList.push(`${rt}=${count}`);
		}
		context += `Resources Grounded (Owned Tiles): ${groundList.size() > 0 ? groundList.join(", ") : "None"}\n`;
		context += `Settlements: ${settlements.size()}\n`;

		if (playerData.NeedsFirstSettlement) {
			context += `STATUS: Must build INITIAL SETTLEMENT.\n`;
			const spots: { name: string; score: number }[] = [];
			for (let i = 0; i < 15; i++) {
				const v = mapGenerator.GetRandomVertex();
				if (v && (v.GetAttribute("AdjacentTileCount") as number ?? 0) >= 2) {
					const score = this.CalculateSpotScore(v);
					spots.push({ name: v.Name, score: score });
				}
			}
			// Sort by score (descending) and take top 5
			spots.sort((a, b) => a.score > b.score);

			const suggestions: string[] = [];
			for (let i = 0; i < math.min(5, spots.size()); i++) {
				const s = spots[i];
				suggestions.push(`${s.name} (Score: ${s.score})`);
			}
			context += `Best Available Start Locations: ${suggestions.join(", ")}\n`;
			context += `(Score represents combined dice probability of adjacent tiles. Higher is better.)\n`;
		} else {
			context += `STATUS: Expanding.\n`;

			// Find potential expansion spots with scores
			const spots: { name: string; score: number }[] = [];
			for (let i = 0; i < 10; i++) {
				const v = mapGenerator.GetRandomVertex();
				if (v) {
					const score = this.CalculateSpotScore(v);
					spots.push({ name: v.Name, score: score });
				}
			}
			spots.sort((a, b) => a.score > b.score);

			const suggestions: string[] = [];
			for (let i = 0; i < math.min(5, spots.size()); i++) {
				const s = spots[i];
				suggestions.push(`${s.name} (Score: ${s.score})`);
			}
			context += `Potential Expansion Spots & Scores: ${suggestions.join(", ")}\n`;

			const suggestedEdges = [];
			if (settlements.size() > 0) {
				const s = settlements[math.random(0, settlements.size() - 1)];
				if (s && s.Position) {
					suggestedEdges.push(`Edge near ${s.Id}`);
				}
			}
			context += `Expansion Directions: ${suggestedEdges.join(", ")}\n`;
		}

		return context;
	}

	private ExecuteAction(decision: AIAction, playerData: PlayerData, mapGenerator: MapGenerator) {
		const action = (decision.action as string ?? "WAIT").upper();
		const reason = decision.reason ?? "No reason provided";
		const target = decision.target as string | undefined;

		Logger.Info("AIPlayer", `${this.Name} (${this.Skill}) Decided: ${action} because "${reason}"`);

		if (action === "WAIT" || action === "END_TURN") {
			this.State = "Idle";
			return;
		}

		if (action === "TRADE") {
			if (decision.resource_give && decision.resource_receive) {
				playerData.PortManager.ExecuteTrade(decision.resource_give, decision.resource_receive);
			}
			this.State = "Idle";
			return;
		}

		let targetPos: Vector3 | undefined;
		let buildingType: string | undefined;

		switch (action) {
			case "BUILD_SETTLEMENT": {
				buildingType = "Settlement";
				if (target) {
					const vertex = mapGenerator.FindVertexById(target);
					if (vertex) targetPos = vertex.Position;
				}
				if (!targetPos) {
					const v = mapGenerator.GetRandomVertex();
					if (v) targetPos = v.Position;
				}
				break;
			}
			case "BUILD_ROAD": {
				buildingType = "Road";
				const settlements = playerData.BuildingManager.Settlements;
				// Scan for vacant edges near settlements
				for (const s of settlements) {
					const edgesFolder = game.Workspace.FindFirstChild("Edges");
					if (!edgesFolder) break;
					for (const edge of edgesFolder.GetChildren()) {
						if (edge.IsA("BasePart")) {
							const dist = edge.Position.sub(s.Position).Magnitude;
							if (dist < 45) {
								const key = edge.GetAttribute("Key") as string;
								const buildingsFolder = game.Workspace.FindFirstChild("Buildings");
								let occupied = false;
								if (buildingsFolder) {
									for (const b of buildingsFolder.GetChildren()) {
										if (b.GetAttribute("Key") === key) {
											occupied = true;
											break;
										}
									}
								}
								if (!occupied) {
									targetPos = edge.Position;
									break;
								}
							}
						}
					}
					if (targetPos) break;
				}
				break;
			}
			case "BUILD_CITY": {
				buildingType = "City";
				const settlements = playerData.BuildingManager.Settlements;
				if (settlements.size() > 0) {
					const s = settlements[0];
					if (s && s.Type === "Settlement") targetPos = s.Position;
				}
				break;
			}
			case "COLLECT_RESOURCE": {
				const res = this.FindNearestOwnedResource(playerData);
				if (res) {
					this.taskQueue.push({ type: "COLLECT", part: res, position: res.Position });
					Logger.Info("AIPlayer", `${this.Name} queued collection of ${res.GetAttribute("ResourceType")}`);
				}
				break;
			}
		}

		if (targetPos && buildingType) {
			this.taskQueue.push({ type: "BUILD", buildingType, position: targetPos });
			Logger.Info("AIPlayer", `${this.Name} queued ${buildingType} at ${targetPos}`);
		} else if (action !== "COLLECT_RESOURCE") {
			Logger.Warn("AIPlayer", `${this.Name} couldn't find a valid target for ${action}`);
		}

		this.State = "Idle";
	}
}
