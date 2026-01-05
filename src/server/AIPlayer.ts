import type { AIPlayerInterface } from "shared/GameEntity";
import type { PlayerData } from "./PlayerData";
import { SkillLevel } from "shared/GameTypes";
import * as Logger from "shared/Logger";
import type { MapGenerator } from "./services/MapGenerator";
import { ServerEvents } from "./ServerEvents";
import type { GameState } from "./GameState";
import type { MarketManager } from "./services/MarketManager";
import { MarketOffer } from "shared/MarketTypes";
import { ServerGameState } from "./services/ServerGameState";
import { BuildingManager } from "./services/BuildingManager";

import { AIPathfinder, MoveResult } from "./services/AI/AIPathfinder";
import { AIStrategist } from "./services/AI/AIStrategist";
import { AIEconomy } from "./services/AI/AIEconomy";

export class AIPlayer implements AIPlayerInterface {
	public UserId: number;
	public Name: string;
	public Character?: Model;
	public IsAI = true;
	public Skill: SkillLevel;
	private baseWalkSpeed: number = 20.8;

	// AI Logic State
	public State: "Idle" | "Thinking" | "Moving" | "Executing" | "MovingToResource" = "Idle";
	private pendingAction?: { type: string, position: Vector3, resourceKey?: string };
	private pendingResource?: BasePart;
	private lastPulsePhase: number = 1;
	private thoughtPending: boolean = false;
	private taskQueue: Array<{ type: "BUILD" | "COLLECT", buildingType?: string, position: Vector3, resourceKey?: string }> = [];

	private spawnTime?: number;
	private lastIdleThinkTime?: number;
	private static readonly STARTUP_DELAY = 15;

	// Sub-Systems
	private pathfinder: AIPathfinder;
	private strategist: AIStrategist;
	private economy: AIEconomy;

	constructor(
		id: number,
		name: string,
		skill: SkillLevel = "Intermediate",
		components?: {
			strategist: AIStrategist,
			economy: AIEconomy,
			pathfinder: AIPathfinder
		}
	) {
		this.UserId = id;
		this.Name = name;
		this.Skill = skill;

		if (components) {
			this.strategist = components.strategist;
			this.economy = components.economy;
			this.pathfinder = components.pathfinder;
		} else {
			// Fallback for easy instantiation if needed, or legacy
			this.pathfinder = new AIPathfinder();
			this.strategist = new AIStrategist(id, name);
			this.economy = new AIEconomy(id, name);
		}
	}

	public Kick(message?: string) {
		Logger.Info("AIPlayer", `${this.Name} kicked: ${message}`);
	}

	public RecordFailedPlacement(pos: Vector3) {
		this.strategist.RecordFailedPlacement(pos);
	}

	public Spawn(position: Vector3) {
		if (this.Character) {
			this.Character.Destroy();
		}

		// Setup Model (Simplified for brevity, reusing existing logic structure)
		const charModel = this.CreateCharacterModel(position);
		this.Character = charModel;

		Logger.Info("AIPlayer", `Spawned ${this.Name} (${this.Skill}) at ${position}`);
	}

	private CreateCharacterModel(position: Vector3): Model {
		// Logic same as original, just moved to helper for readability
		let bodyColor: Color3 = this.Skill === "Beginner" ? Color3.fromRGB(100, 255, 100) :
			(this.Skill === "Intermediate" ? Color3.fromRGB(100, 150, 255) : Color3.fromRGB(255, 80, 80));

		const SCALE = 1.3;
		const model = new Instance("Model");
		model.Name = this.Name;

		const root = new Instance("Part");
		root.Name = "HumanoidRootPart";
		root.Size = new Vector3(2 * SCALE, 2 * SCALE, 1 * SCALE);
		root.Position = position.add(new Vector3(0, 3 * SCALE, 0));
		root.Transparency = 1;
		root.CanCollide = false;
		root.Anchored = false;
		root.Parent = model;

		const torso = new Instance("Part");
		torso.Name = "Torso";
		torso.Size = new Vector3(2 * SCALE, 2 * SCALE, 1 * SCALE);
		torso.Position = root.Position;
		torso.Color = bodyColor;
		torso.CanCollide = true;
		torso.Anchored = false;
		torso.Parent = model;

		const head = new Instance("Part");
		head.Name = "Head";
		head.Size = new Vector3(1.2 * SCALE, 1.2 * SCALE, 1.2 * SCALE); // Square head
		head.Position = torso.Position.add(new Vector3(0, 1.6 * SCALE, 0));
		head.Color = bodyColor; // Same as body color
		head.CanCollide = false;
		head.Parent = model;

		const face = new Instance("Decal");
		face.Name = "face";
		face.Texture = "rbxasset://textures/face.png";
		face.Face = Enum.NormalId.Front;
		face.Parent = head;

		// Limbs
		const leftArm = new Instance("Part");
		leftArm.Name = "Left Arm";
		leftArm.Size = new Vector3(1 * SCALE, 2 * SCALE, 1 * SCALE);
		leftArm.Position = torso.Position.add(new Vector3(-1.5 * SCALE, 0, 0));
		leftArm.Color = bodyColor;
		leftArm.Parent = model;

		const rightArm = new Instance("Part");
		rightArm.Name = "Right Arm";
		rightArm.Size = new Vector3(1 * SCALE, 2 * SCALE, 1 * SCALE);
		rightArm.Position = torso.Position.add(new Vector3(1.5 * SCALE, 0, 0));
		rightArm.Color = bodyColor;
		rightArm.Parent = model;

		const leftLeg = new Instance("Part");
		leftLeg.Name = "Left Leg";
		leftLeg.Size = new Vector3(1 * SCALE, 2 * SCALE, 1 * SCALE);
		leftLeg.Position = torso.Position.add(new Vector3(-0.5 * SCALE, -2 * SCALE, 0));
		leftLeg.Color = bodyColor;
		leftLeg.Parent = model;

		const rightLeg = new Instance("Part");
		rightLeg.Name = "Right Leg";
		rightLeg.Size = new Vector3(1 * SCALE, 2 * SCALE, 1 * SCALE);
		rightLeg.Position = torso.Position.add(new Vector3(0.5 * SCALE, -2 * SCALE, 0));
		rightLeg.Color = bodyColor;
		rightLeg.Parent = model;

		// I will copy the weld/collision logic to ensure it works.
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

		// Handle collisions
		for (const part of model.GetDescendants()) {
			if (part.IsA("BasePart")) {
				part.CollisionGroup = "SelectableAI";
				part.Anchored = false;
				part.CanCollide = (part.Name === "Torso"); // Only torso collides with world for basic setup
			}
		}

		const humanoid = new Instance("Humanoid");
		humanoid.DisplayName = `[${this.Skill}] ${this.Name}`;
		this.baseWalkSpeed = 16 * SCALE;
		humanoid.WalkSpeed = this.baseWalkSpeed;
		humanoid.Parent = model;

		model.PrimaryPart = root;
		model.Parent = game.Workspace;

		return model;
	}

	public Update(deltaTime: number, playerData: PlayerData, mapGenerator: MapGenerator, marketManager: MarketManager, gameState: ServerGameState, buildingManager: BuildingManager) {
		if (!this.Character || !this.Character.PrimaryPart) return;

		// Startup delay
		if (!this.spawnTime) this.spawnTime = playerData.GameTime;
		if (playerData.GameTime - this.spawnTime < AIPlayer.STARTUP_DELAY) return;

		// Pulse Logic - trigger thought on phase change
		const pulseTimer = playerData.PulseTimer;
		if (pulseTimer !== -1) {
			const currentPhase = pulseTimer > 30 ? 0 : 1;
			if (currentPhase !== this.lastPulsePhase) {
				this.lastPulsePhase = currentPhase;
				this.thoughtPending = true;
			}
		}

		// Idle re-evaluation: If idle with no tasks, think again after a short delay
		// This ensures AI reacts to newly dropped resources quickly
		if (this.State === "Idle" && this.taskQueue.size() === 0 && !this.thoughtPending) {
			if (!this.lastIdleThinkTime) this.lastIdleThinkTime = playerData.GameTime;

			// Re-think every 3 seconds when idle
			if (playerData.GameTime - this.lastIdleThinkTime > 3) {
				this.thoughtPending = true;
				this.lastIdleThinkTime = playerData.GameTime;
			}
		}

		if (this.State === "Idle") {
			// 1. Think
			if (this.thoughtPending || (pulseTimer !== -1 && playerData.NeedsFirstTown && this.taskQueue.size() === 0)) {
				this.thoughtPending = false;
				this.State = "Thinking";

				// Delegate Decision
				const newTasks = this.strategist.DecideAction(
					playerData,
					mapGenerator,
					gameState,
					(b, r) => this.economy.CanAfford(b, r)
				);
				this.taskQueue = [...this.taskQueue, ...newTasks];

				// Also do economy checks
				const target = this.strategist.GetTargetBuilding(playerData, mapGenerator, gameState);
				if (target) {
					this.economy.TryTradeForNeeds(playerData, target.type as any, marketManager);
				}

				this.economy.TryMarketTrade(playerData, marketManager);
				this.economy.TryPortBalance(playerData);

				this.State = "Idle"; // Instant think finish
				return;
			}

			// 2. Process Queue
			if (this.taskQueue.size() > 0) {
				const task = this.taskQueue.shift()!;
				this.pendingAction = { type: task.buildingType ?? "", position: task.position, resourceKey: task.resourceKey };

				// Logic to find part/resource if needed
				if (task.type === "COLLECT") {
					Logger.Info("AIPlayer", `${this.Name} starting to move to COLLECT at ${task.position}`);
				}

				this.State = task.type === "BUILD" ? "Moving" : "MovingToResource";
				this.pathfinder.Reset();
				return;
			}

			// 3. Opportunistic Resource (Legacy fallback if Strategy didn't fill queue or specific resource logic)
			// Strategy's "DecideAction" covers this now.
		}

		// Movement
		if (this.State === "MovingToResource" || this.State === "Moving") {
			let targetPos = this.pendingAction?.position;

			// Refresh position from physical part for resource collection
			if (this.State === "MovingToResource" && this.pendingAction?.resourceKey) {
				const resourcesFolder = game.Workspace.FindFirstChild("Resources");
				if (resourcesFolder) {
					const part = resourcesFolder.FindFirstChild(this.pendingAction.resourceKey);
					if (part && part.IsA("BasePart")) {
						targetPos = part.Position;
					}
				}
			}

			if (!targetPos) {
				this.CancelCurrentAction("Target invalid");
				return;
			}

			const humanoid = this.Character.FindFirstChildOfClass("Humanoid");
			if (humanoid) {
				const result = this.pathfinder.Update(humanoid, targetPos, playerData.GameTime, this.baseWalkSpeed);

				if (result === MoveResult.Arrived) {
					if (this.State === "MovingToResource") {
						this.State = "Idle";
						Logger.Info("AIPlayer", `${this.Name} arrived at resource!`);
					} else {
						this.State = "Executing";
						Logger.Info("AIPlayer", `${this.Name} arrived at construction site.`);
					}
				} else if (result === MoveResult.Stuck || result === MoveResult.Timeout) {
					Logger.Warn("AIPlayer", `${this.Name} failed to move: ${result}`);
					this.CancelCurrentAction(result === MoveResult.Stuck ? "Stuck" : "Timeout");
				}
			}
			return;
		}

		// Execution
		if (this.State === "Executing") {
			if (this.pendingAction && this.pendingAction.type !== "") {
				const { type: actionType, position } = this.pendingAction;
				const [success, result] = buildingManager.StartBuilding(playerData, actionType, position);

				if (success) {
					Logger.Info("AIPlayer", `${this.Name} built ${actionType}!`);
					if (playerData.NeedsFirstTown && actionType === "Town") {
						playerData.NeedsFirstTown = false;
					}
				} else {
					Logger.Warn("AIPlayer", `${this.Name} failed to build ${actionType}: ${result}`);
					if (actionType === "Town") {
						this.strategist.RecordFailedPlacement(position);
					}
				}
			}
			this.pendingAction = undefined;
			this.State = "Idle";
			return;
		}

		if (this.State === "Thinking") {
			this.State = "Idle";
		}
	}

	public EvaluateMarketOffer(offer: MarketOffer, playerData: PlayerData, marketManager: MarketManager) {
		this.economy.EvaluateMarketOffer(offer, playerData, marketManager);
	}

	public GetTaskQueueSize() { return this.taskQueue.size(); }

	private CancelCurrentAction(reason: string) {
		this.pendingAction = undefined;
		this.pendingResource = undefined;
		this.pathfinder.Reset();
		this.State = "Idle";
		if (reason === "Stuck" || reason === "Timeout") {
			this.taskQueue = [];
		}
	}

	public HandleSetupTurn(step: "Town1" | "Road1" | "Town2" | "Road2", mapGenerator: MapGenerator, gameService: GameState, gameState: ServerGameState, buildingManager: BuildingManager) {
		task.delay(1.0, () => {
			if (step.sub(1, 4) === "Town") {
				const bestPos = this.strategist.GetBestTownSpot(mapGenerator, true, gameState);
				if (bestPos) gameService.OnSetupPlacement(this.UserId, "Town", bestPos);
			} else {
				const playerData = gameService.PlayerData[this.UserId];
				if (playerData) {
					const towns = playerData.Towns;
					const lastTown = towns[towns.size() - 1];
					if (lastTown) {
						// Pass isSetupTurn=true and the lastTown's SnapKey for proper validation
						const lastTownKey = lastTown.SnapKey;
						const bestRoad = this.strategist.GetBestRoadSpot(playerData, gameState, lastTown.Position, true, lastTownKey);
						if (bestRoad) {
							gameService.OnSetupPlacement(this.UserId, "Road", bestRoad);
						} else {
							Logger.Warn("AIPlayer", `${this.Name} could not find valid road spot during setup! LastTownKey: ${lastTownKey}`);
						}
					} else {
						Logger.Warn("AIPlayer", `${this.Name} has no towns during Road setup step!`);
					}
				}
			}
		});
	}
}
