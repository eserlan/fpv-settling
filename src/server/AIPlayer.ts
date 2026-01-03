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

	private llmService: LLMService;

	constructor(id: number, name: string, skill: SkillLevel = "Intermediate") {
		this.UserId = id;
		this.Name = name;
		this.Skill = skill;
		this.llmService = new LLMService();
	}

	public Kick(message?: string) {
		// No-op for AI
		print(`AI Player ${this.Name} kicked: ${message}`);
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

		// 0. Resource Gathering Check (High Priority)
		if (this.State === "Idle" || this.State === "Thinking") {
			const resource = this.FindNearestOwnedResource(playerData);
			if (resource) {
				this.pendingResource = resource;
				this.State = "MovingToResource";
				Logger.Info("AIPlayer", `${this.Name} moving to collect ${resource.GetAttribute("ResourceType")}...`);
			}
		}

		if (this.State === "MovingToResource" && this.pendingResource) {
			if (!this.pendingResource.Parent) {
				this.pendingResource = undefined;
				this.State = "Idle";
				return;
			}

			const humanoid = this.Character.FindFirstChildOfClass("Humanoid");
			if (humanoid) {
				humanoid.MoveTo(this.pendingResource.Position);
				const dist = this.Character.PrimaryPart.Position.sub(this.pendingResource.Position).Magnitude;
				if (dist < 8) {
					// CollectionManager should handle it if proximity is right
					// We'll call it ourselves via the Service if we want to be explicit,
					// but let's assume the CollectionManager onTick handles it too.
					// Actually, CollectionManager onTick only checks real players.
					// So let's rely on a more explicit call if we can get it, but for now 
					// we just wait 1s and hope it works if we reach it.
					// INSTEAD: Let's let the manager handle it by updating it too.
					this.State = "Idle";
					this.NextActionTime = playerData.GameTime + 1;
				}
			}
		}

		// 1. Handle Movement with Pathfinding
		if (this.State === "Moving" && this.pendingAction) {
			const humanoid = this.Character.FindFirstChildOfClass("Humanoid");
			if (humanoid) {
				// If we don't have a path yet, create one
				if (!this.currentPath) {
					this.currentPath = PathfindingService.CreatePath({
						AgentRadius: 2,
						AgentHeight: 5,
						AgentCanJump: true,
						AgentCanClimb: false,
					});

					const startPos = this.Character.PrimaryPart.Position;
					const [success] = pcall(() => {
						this.currentPath!.ComputeAsync(startPos, this.pendingAction!.position);
					});

					if (!success || this.currentPath.Status !== Enum.PathStatus.Success) {
						// Fallback to direct movement
						Logger.Warn("AIPlayer", `${this.Name} pathfinding failed, using direct movement`);
						humanoid.MoveTo(this.pendingAction.position);
						this.currentPath = undefined;
					} else {
						this.currentWaypointIndex = 0;
					}
				}

				// Follow waypoints
				if (this.currentPath && this.currentPath.Status === Enum.PathStatus.Success) {
					const waypoints = this.currentPath.GetWaypoints();
					if (this.currentWaypointIndex < waypoints.size()) {
						const waypoint = waypoints[this.currentWaypointIndex];
						humanoid.MoveTo(waypoint.Position);

						const distToWaypoint = this.Character.PrimaryPart.Position.sub(waypoint.Position).Magnitude;
						if (distToWaypoint < 3) {
							this.currentWaypointIndex++;
							if (waypoint.Action === Enum.PathWaypointAction.Jump) {
								humanoid.Jump = true;
							}
						}
					} else {
						// Reached end of path
						this.currentPath = undefined;
						this.currentWaypointIndex = 0;
					}
				} else {
					// Direct movement fallback
					humanoid.MoveTo(this.pendingAction.position);
				}

				// Check distance to final target
				const dist = this.Character.PrimaryPart.Position.sub(this.pendingAction.position).Magnitude;
				if (dist < 8) {
					this.State = "Executing";
					this.currentPath = undefined;
					this.currentWaypointIndex = 0;
					Logger.Info("AIPlayer", `${this.Name} reached destination, starting construction...`);
				}
			}
		}

		// 2. Handle Action Execution
		if (this.State === "Executing" && this.pendingAction) {
			const { type: actionType, position } = this.pendingAction;
			playerData.BuildingManager.StartBuilding(actionType, position);
			if (playerData.NeedsFirstSettlement && actionType === "Settlement") {
				playerData.NeedsFirstSettlement = false;
			}

			this.pendingAction = undefined;
			this.State = "Idle";
			this.actionsThisPulse++;
			this.NextActionTime = playerData.GameTime + 2; // Pause after building
			return;
		}

		// 3. Pulse Synchronization Check
		// AI can act up to 2 times per pulse (60s chunks)
		const currentPulse = math.floor(playerData.GameTime / 60);
		if (currentPulse !== this.lastActedPulse) {
			// New pulse started, reset counter
			this.lastActedPulse = currentPulse;
			this.actionsThisPulse = 0;
		}

		if (this.actionsThisPulse >= 2) return; // Max 2 actions per pulse

		// 4. Thinking Logic
		if (playerData.GameTime < this.NextActionTime) return;

		if (this.State === "Thinking") {
			this.NextActionTime = playerData.GameTime + 0.5;
			return;
		}

		if (this.State === "Idle") {
			this.State = "Thinking";
			this.Think(playerData, mapGenerator);
		}
	}

	private async Think(playerData: PlayerData, mapGenerator: MapGenerator) {
		const context = this.GatherContext(playerData, mapGenerator);
		const prompt = PROMPTS[this.Skill];

		// Call LLM
		try {
			const decision = await this.llmService.GetDecision(prompt, context);
			if (decision) {
				this.ExecuteAction(decision, playerData, mapGenerator);
			} else {
				this.State = "Idle";
			}
		} catch (e) {
			Logger.Warn("AIPlayer", `Thinking failed: ${e}`);
			this.State = "Idle";
		}
	}

	private GatherContext(playerData: PlayerData, mapGenerator: MapGenerator): string {
		const resources = playerData.ResourceManager.Resources;
		const settlements = playerData.BuildingManager.Settlements.size();

		let context = `My Name: ${this.Name}\n`;
		context += `Skill Level: ${this.Skill}\n`;
		context += `Resources: Wood=${resources.Wood}, Brick=${resources.Brick}, Wheat=${resources.Wheat}, Wool=${resources.Wool}, Ore=${resources.Ore}\n`;
		context += `Victory Points (Estimated): ${settlements}\n`;

		if (playerData.NeedsFirstSettlement) {
			context += `STATUS: Must build INITIAL SETTLEMENT.\n`;
			const validOptions = [];
			for (let i = 0; i < 5; i++) {
				const v = mapGenerator.GetRandomVertex();
				if (v) validOptions.push(v.Name);
			}
			context += `Available Settlement Spots: ${validOptions.join(", ")}\n`;
		} else {
			context += `STATUS: Normal Play.\n`;
			const validOptions = [];
			for (let i = 0; i < 5; i++) {
				const v = mapGenerator.GetRandomVertex();
				if (v) validOptions.push(v.Name);
			}
			context += `Potential Expansion Spots: ${validOptions.join(", ")}\n`;
		}

		return context;
	}

	private ExecuteAction(decision: AIAction, playerData: PlayerData, mapGenerator: MapGenerator) {
		const action = decision.action ? (decision.action as string).upper() : "WAIT";
		const reason = decision.reason ?? "No reason provided";
		const target = decision.target ? (decision.target as string).upper() : undefined;

		Logger.Info("AIPlayer", `${this.Name} (${this.Skill}) Decided: ${action} because "${reason}"`);

		if (action === "WAIT" || action === "END_TURN") {
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
				const edge = mapGenerator.GetRandomEdge();
				if (edge) targetPos = edge.Position;
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
			Logger.Info("AIPlayer", `${this.Name} is moving to ${targetPos} to build ${buildingType}...`);
		} else {
			this.State = "Idle";
		}
	}
}
