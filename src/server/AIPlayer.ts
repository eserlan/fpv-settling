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
	public NextActionTime: number = 0;
	public State: "Idle" | "Thinking" | "Moving" | "Executing" | "MovingToResource" = "Idle";
	private pendingAction?: { type: string, position: Vector3, actionData?: AIAction };
	private pendingResource?: BasePart;
	private lastActedPulse: number = -1;
	private actionsThisPulse: number = 0;

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

		// Priority 1: Collect nearby resources on owned tiles
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
			this.NextActionTime = playerData.GameTime + 5; // Short pause after building
			return;
		}

		// Thinking: Every 30 seconds when Idle
		if (this.State === "Idle" && playerData.GameTime >= this.NextActionTime) {
			this.State = "Thinking";
			this.Think(playerData, mapGenerator);
			this.NextActionTime = playerData.GameTime + 30; // Think every 30s
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
			const validOptions = [];
			for (let i = 0; i < 8; i++) {
				const v = mapGenerator.GetRandomVertex();
				if (v && (v.GetAttribute("AdjacentTileCount") as number ?? 0) >= 2) {
					validOptions.push(v.Name);
				}
			}
			context += `Suggested Start Locations: ${validOptions.join(", ")}\n`;
		} else {
			context += `STATUS: Expanding.\n`;

			// Find nearby expansion vertices (connected to roads)
			const validSpots = [];
			for (let i = 0; i < 5; i++) {
				const v = mapGenerator.GetRandomVertex();
				if (v) validSpots.push(v.Name);
			}
			context += `Potential Expansion Spots (Vertices): ${validSpots.join(", ")}\n`;

			// Find connected edges for roads
			const suggestedEdges = [];
			if (settlements.size() > 0) {
				const s = settlements[math.random(0, settlements.size() - 1)];
				if (s && s.Position) {
					// We could find specific adjacent edges here, but for now just hint at expanding from this settlement
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
