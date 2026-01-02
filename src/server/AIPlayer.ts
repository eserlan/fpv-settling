import type { AIPlayerInterface } from "shared/GameEntity";
import type { PlayerData } from "./PlayerData";

export class AIPlayer implements AIPlayerInterface {
	public UserId: number;
	public Name: string;
	public Character?: Model;
	public IsAI = true;

	// AI Logic State
	public NextActionTime: number = 0;
	public State: "Idle" | "Thinking" | "Acting" = "Idle";

	constructor(id: number, name: string) {
		this.UserId = id;
		this.Name = name;
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
		torso.Color = Color3.fromRGB(100, 100, 255); // Blue-ish for AI
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
		humanoid.DisplayName = `[AI] ${this.Name}`;
		humanoid.Parent = model;

		model.PrimaryPart = torso;
		model.Parent = game.Workspace;
		this.Character = model;
	}

	public Update(deltaTime: number, playerData: PlayerData, mapGenerator: any) {
		if (playerData.GameTime < this.NextActionTime) return;

		// Set next think time (random 2-5 seconds)
		this.NextActionTime = playerData.GameTime + math.random(2, 5);

		// Simple behavior: If has resources for settlement, try to build one
		const buildingManager = playerData.BuildingManager;
		const resourceManager = playerData.ResourceManager;

		if (playerData.NeedsFirstSettlement) {
			// Try to find a random valid spot
			const randomVertex = mapGenerator.GetRandomVertex();
			if (randomVertex) {
				const [success] = buildingManager.StartBuilding("Settlement", randomVertex.Position);
				if (success) {
					print(`[AI] ${this.Name} built initial settlement at ${randomVertex.Position}`);
					playerData.NeedsFirstSettlement = false;
				}
			}
		} else {
			// Normal gameplay logic
			// 1. Check if can build road
			if (resourceManager.HasResources({ Wood: 1, Brick: 1 })) {
				// Simplified: Just build at current location (needs better pathfinding)
				// For now, maybe just gather resources passively or trade
			}

			// 2. Check if can build settlement
			if (resourceManager.HasResources({ Wood: 1, Brick: 1, Wheat: 1, Wool: 1 })) {
				const randomVertex = mapGenerator.GetRandomVertex();
				if (randomVertex) {
					buildingManager.StartBuilding("Settlement", randomVertex.Position);
				}
			}
		}
	}
}
