import type { AIPlayerInterface } from "shared/GameEntity";
import type { PlayerData } from "./PlayerData";
import { LLMService, AIAction } from "./services/LLMService";
import { PROMPTS, SkillLevel } from "./AIPrompts";
import * as Logger from "shared/Logger";
import type { MapGenerator } from "./services/MapGenerator";

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

	// Pathfinding
	private currentPath?: Path;
	private currentWaypointIndex: number = 0;
	private lastMoveTime: number = 0;
	private lastCheckedPosition?: Vector3;
	private lastPositionTime: number = 0;

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
		let minDist = 150; // Max search distance for AI

		for (const res of resourcesFolder.GetChildren()) {
			if (res.IsA("BasePart")) {
				const q = res.GetAttribute("TileQ") as number;
				const r = res.GetAttribute("TileR") as number;

				// Check if AI owns this tile (via its settlements)
				let owns = false;
				for (const s of playerData.BuildingManager.Settlements) {
					// This is a bit expensive but accurate
					const dist = res.Position.sub(s.Position).Magnitude;
					if (dist < 45) { // Settlement claim radius
						owns = true;
						break;
					}
				}

				if (owns) {
					const dist = this.Character!.PrimaryPart!.Position.sub(res.Position).Magnitude;
					if (dist < minDist) {
						minDist = dist;
						nearest = res;
					}
				}
			}
		}

		return nearest;
	}

	public Update(deltaTime: number, playerData: PlayerData, mapGenerator: MapGenerator) {
		if (!this.Character || !this.Character.PrimaryPart) return;

		// 0. Detect Pulse Phase Transitions (must happen regardless of state)
		const pulseTimer = playerData.PulseTimer;
		if (pulseTimer !== -1) {
			const currentPhase = pulseTimer > 30 ? 0 : 1;
			if (currentPhase !== this.lastPulsePhase) {
				this.lastPulsePhase = currentPhase;
				this.thoughtPending = true;
				const phaseName = currentPhase === 0 ? "Pulse Reset" : "Mid-Pulse";
				Logger.Info("AIPlayer", `${this.Name} phase transition: ${phaseName} (pending thought)`);
			}
		}

		// Priority 1: Strategic Thinking (Pulse synchronized)
		if (this.State === "Idle") {
			if (this.thoughtPending || playerData.NeedsFirstSettlement) {
				this.thoughtPending = false;
				this.State = "Thinking";
				this.Think(playerData, mapGenerator);
				return;
			}
		}

		// Priority 2: Collect nearby resources on owned tiles
		if (this.State === "Idle") {
			const resource = this.FindNearestOwnedResource(playerData);
			if (resource) {
				this.pendingResource = resource;
				this.State = "MovingToResource";
				this.currentPath = undefined; // Force new path
				Logger.Info("AIPlayer", `${this.Name} → collecting ${resource.GetAttribute("ResourceType")}`);
			}
		}

		// Handle movement states (Both Resource and Build)
		if (this.State === "MovingToResource" || this.State === "Moving") {
			const targetPos = this.State === "MovingToResource" ? this.pendingResource?.Position : this.pendingAction?.position;

			if (!targetPos || (this.State === "MovingToResource" && !this.pendingResource?.Parent)) {
				this.pendingResource = undefined;
				this.currentPath = undefined;
				this.State = "Idle";
				return;
			}

			const humanoid = this.Character.FindFirstChildOfClass("Humanoid");
			if (humanoid) {
				this.FollowPath(humanoid, targetPos, playerData.GameTime);

				const dist = this.Character.PrimaryPart.Position.sub(targetPos).Magnitude;
				const arrivalThreshold = this.State === "MovingToResource" ? 8 : 12;

				if (dist < arrivalThreshold) {
					if (this.State === "MovingToResource") {
						this.pendingResource = undefined;
						this.State = "Idle";
					} else {
						this.State = "Executing";
						Logger.Info("AIPlayer", `${this.Name} arrived at build site.`);
					}
					this.currentPath = undefined;
				}
			}
			return;
		}

		// Handle action execution
		if (this.State === "Executing" && this.pendingAction) {
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
		}

		// Thinking block removed (now handled at top)
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
				Logger.Warn("AIPlayer", `${this.Name} hasn't progressed much, recomputing path...`);
				this.currentPath = undefined; // Force recalculate
				humanoid.Jump = true; // Try jumping out of it
				this.lastPositionTime = gameTime;
				this.lastCheckedPosition = myPos;
				return;
			}
			this.lastPositionTime = gameTime;
			this.lastCheckedPosition = myPos;
		}

		// 3. Absolute Timeout (30s)
		if (gameTime - this.lastMoveTime > 30) {
			Logger.Warn("AIPlayer", `${this.Name} absolute move timeout reached.`);
			this.currentPath = undefined;
			this.State = "Idle";
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

		// Call LLM
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
		context += `Resources: Wood=${resources.Wood}, Brick=${resources.Brick}, Wheat=${resources.Wheat}, Wool=${resources.Wool}, Ore=${resources.Ore}\n`;
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
		const action = decision.action ? (decision.action as string).upper() : "WAIT";
		const reason = decision.reason ?? "No reason provided";
		const target = decision.target ? (decision.target as string) : undefined;

		const resources = playerData.ResourceManager.Resources;

		Logger.Info("AIPlayer", `${this.Name} (${this.Skill}) Decided: ${action} because "${reason}"`);
		Logger.Info("AIPlayer", `${this.Name} Resources: W=${resources.Wood} B=${resources.Brick} Wh=${resources.Wheat} Wo=${resources.Wool} O=${resources.Ore}`);

		if (action === "WAIT" || action === "END_TURN") {
			this.State = "Idle";
			return;
		}

		let targetPos: Vector3 | undefined;
		let buildingType: string | undefined;

		switch (action) {
			case "BUILD_SETTLEMENT": {
				// Check resources - settlements always cost resources
				if (resources.Wood < 1 || resources.Brick < 1 || resources.Wheat < 1 || resources.Wool < 1) {
					Logger.Warn("AIPlayer", `${this.Name} can't afford Settlement (need 1 each of Wood, Brick, Wheat, Wool)`);
					this.State = "Idle";
					return;
				}

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
				// Check resources
				if (resources.Wood < 1 || resources.Brick < 1) {
					Logger.Warn("AIPlayer", `${this.Name} can't afford Road (need 1 Wood, 1 Brick)`);
					this.State = "Idle";
					return;
				}

				// Roads must connect to existing settlements or roads
				const settlements = playerData.BuildingManager.Settlements;
				if (settlements.size() === 0) {
					Logger.Warn("AIPlayer", `${this.Name} can't build Road (no settlements)`);
					this.State = "Idle";
					return;
				}

				// Scan for vacant edges near settlements
				buildingType = "Road";
				for (const s of settlements) {
					const edgesFolder = game.Workspace.FindFirstChild("Edges");
					if (!edgesFolder) break;

					// Find an edge that touches this settlement but has no road
					for (const edge of edgesFolder.GetChildren()) {
						if (edge.IsA("BasePart")) {
							const dist = edge.Position.sub(s.Position).Magnitude;
							if (dist < 45) { // Searching radius
								const key = edge.GetAttribute("Key") as string;

								// Check if already has a road
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

				if (!targetPos) {
					Logger.Warn("AIPlayer", `${this.Name} couldn't find vacant expansion edge`);
					this.State = "Idle";
					return;
				}
				break;
			}
			case "BUILD_CITY": {
				// Check resources
				if (resources.Ore < 3 || resources.Wheat < 2) {
					Logger.Warn("AIPlayer", `${this.Name} can't afford City (need 3 Ore, 2 Wheat)`);
					this.State = "Idle";
					return;
				}

				buildingType = "City";
				const settlements = playerData.BuildingManager.Settlements;
				if (settlements.size() > 0) {
					const s = settlements[0];
					if (s && s.Type === "Settlement") targetPos = s.Position;
				}
				break;
			}
			case "TRADE": {
				if (decision.resource_give && decision.resource_receive) {
					playerData.PortManager.ExecuteTrade(decision.resource_give, decision.resource_receive);
				}
				this.State = "Idle";
				return;
			}
		}

		if (targetPos && buildingType) {
			this.pendingAction = { type: buildingType, position: targetPos, actionData: decision };
			this.State = "Moving";
			Logger.Info("AIPlayer", `${this.Name} is moving to build ${buildingType}...`);
		} else {
			this.State = "Idle";
		}
	}
}
