import type { AIPlayerInterface } from "shared/GameEntity";
import type { PlayerData } from "./PlayerData";
import { LLMService, AIAction } from "./services/LLMService";
import { PROMPTS, SkillLevel } from "./AIPrompts";
import * as Logger from "shared/Logger";
import type { MapGenerator } from "./services/MapGenerator";

export class AIPlayer implements AIPlayerInterface {
	public UserId: number;
	public Name: string;
	public Character?: Model;
	public IsAI = true;
	public Skill: SkillLevel;

	// AI Logic State
	public NextActionTime: number = 0;
	public State: "Idle" | "Thinking" | "Executing" = "Idle";

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

		// Color based on skill level
		if (this.Skill === "Beginner") {
			torso.Color = Color3.fromRGB(100, 255, 100); // Green
		} else if (this.Skill === "Intermediate") {
			torso.Color = Color3.fromRGB(100, 100, 255); // Blue
		} else {
			torso.Color = Color3.fromRGB(255, 100, 100); // Red (Expert)
		}

		torso.Anchored = false;
		torso.Position = position;
		torso.Parent = model;

		const head = new Instance("Part");
		head.Name = "Head";
		head.Size = new Vector3(1, 1, 1);
		head.Shape = Enum.PartType.Ball;
		head.Color = Color3.fromRGB(200, 200, 200);
		head.Position = position.add(new Vector3(0, 1.5, 0));
		head.Parent = model;

		const weld = new Instance("WeldConstraint");
		weld.Part0 = torso;
		weld.Part1 = head;
		weld.Parent = torso;

		const humanoid = new Instance("Humanoid");
		humanoid.DisplayName = `[${this.Skill}] ${this.Name}`;
		humanoid.Parent = model;

		model.PrimaryPart = torso;
		model.Parent = game.Workspace;
		this.Character = model;
	}

	public Update(deltaTime: number, playerData: PlayerData, mapGenerator: MapGenerator) {
		// Only run logic periodically to avoid spamming API
		if (playerData.GameTime < this.NextActionTime) return;

		// Set next check time
		// Beginners think slower, Experts think faster (simulated)
		let thinkDelay = 5;
		if (this.Skill === "Beginner") thinkDelay = 8;
		else if (this.Skill === "Expert") thinkDelay = 3;

		if (this.State === "Thinking") {
			this.NextActionTime = playerData.GameTime + 0.5;
			return;
		} else {
			this.NextActionTime = playerData.GameTime + thinkDelay;
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
			}
		} catch (e) {
			Logger.Warn("AIPlayer", `Thinking failed: ${e}`);
		} finally {
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
			// Provide some random valid vertices as options
			// In a real implementation, we'd list all valid available spots
			const validOptions = [];
			for(let i=0; i<3; i++) {
				const v = mapGenerator.GetRandomVertex();
				if (v) validOptions.push(v.Name); // Assuming Name is Vertex_ID
			}
			context += `Available Settlement Spots: ${validOptions.join(", ")}\n`;
		} else {
			context += `STATUS: Normal Play.\n`;
			const validOptions = [];
			// Simplified: Suggest building near existing settlements (expansion) or just random spots
			// Ideally we would traverse the graph from our existing settlements
			for(let i=0; i<3; i++) {
				const v = mapGenerator.GetRandomVertex();
				if (v) validOptions.push(v.Name);
			}
			context += `Potential Expansion Spots (Simplified): ${validOptions.join(", ")}\n`;
		}

		return context;
	}

	private ExecuteAction(decision: AIAction, playerData: PlayerData, mapGenerator: MapGenerator) {
		Logger.Info("AIPlayer", `${this.Name} (${this.Skill}) Decided: ${decision.action} because "${decision.reason}"`);

		switch (decision.action) {
			case "BUILD_SETTLEMENT": {
				if (decision.target) {
					// We need to find the position from the target ID
					const vertex = mapGenerator.FindVertexById(decision.target);
					if (vertex) {
						playerData.BuildingManager.StartBuilding("Settlement", vertex.Position);
						if (playerData.NeedsFirstSettlement) playerData.NeedsFirstSettlement = false;
					}
				} else {
					// Fallback if LLM didn't give target
					const v = mapGenerator.GetRandomVertex();
					if (v) {
						playerData.BuildingManager.StartBuilding("Settlement", v.Position);
						playerData.NeedsFirstSettlement = false;
					}
				}
				break;
			}
			case "BUILD_ROAD": {
				// Road building requires finding a random edge (simplified)
				// In a real game, this would need graph traversal to find connected edges
				const edge = mapGenerator.GetRandomEdge();
				if (edge) {
					// Road building is just calling StartBuilding with "Road"
					// We assume the game logic handles connectivity checks or we just try
					playerData.BuildingManager.StartBuilding("Road", edge.Position);
				}
				break;
			}
			case "BUILD_CITY": {
				// Cities replace settlements. We need to find a settlement we own.
				const settlements = playerData.BuildingManager.Settlements;
				if (settlements.size() > 0) {
					// Try to upgrade the first one
					const s = settlements[0];
					if (s && s.Type === "Settlement") {
						playerData.BuildingManager.StartBuilding("City", s.Position);
					}
				}
				break;
			}
			case "TRADE": {
				if (decision.resource_give && decision.resource_receive) {
					// Try to trade with the PortManager (Bank/Ports)
					playerData.PortManager.ExecuteTrade(decision.resource_give, decision.resource_receive);
				}
				break;
			}
			case "WAIT":
				// Do nothing
				break;
		}
	}
}
