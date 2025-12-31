// Server-side NPC Manager
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const NPCTypes = require(ReplicatedStorage.Shared.NPCTypes) as typeof import("shared/NPCTypes");
const Network = require(ReplicatedStorage.Shared.Network) as typeof import("shared/Network");
const Logger = require(ReplicatedStorage.Shared.Logger) as typeof import("shared/Logger");

type NPCRecord = {
	Id: number;
	Type: string;
	Position: Vector3;
	Health: number;
	MaxHealth: number;
	State: string;
	Target?: Instance;
	Data: import("shared/NPCTypes").NPCInfo;
	Model?: Model;
};

class NPCManager {
	Player: Player;
	ResourceManager: import("./ResourceManager");
	NPCs: NPCRecord[];
	NextNPCId: number;

	constructor(player: Player, resourceManager: import("./ResourceManager")) {
		this.Player = player;
		this.ResourceManager = resourceManager;
		this.NPCs = [];
		this.NextNPCId = 1;
	}

	// Hire a new NPC
	HireNPC(npcType: string, position?: Vector3) {
		const npcInfo = NPCTypes[npcType];
		if (!npcInfo) {
			Logger.Warn("NPCManager", `Invalid NPC type: ${npcType}`);
			return $tuple(false, "Invalid NPC type");
		}

		// Check if player has enough resources to hire
		if (!this.ResourceManager.HasResources(npcInfo.HireCost)) {
			return $tuple(false, "Not enough resources to hire");
		}

		// Remove hiring cost
		for (const [resourceType, amount] of pairs(npcInfo.HireCost)) {
			this.ResourceManager.RemoveResource(resourceType, amount);
		}

		// Create NPC
		const npc: NPCRecord = {
			Id: this.NextNPCId,
			Type: npcType,
			Position: position ?? Vector3.new(0, 5, 0),
			Health: npcInfo.Health,
			MaxHealth: npcInfo.Health,
			State: "Idle",
			Target: undefined,
			Data: npcInfo,
		};

		this.NextNPCId += 1;
		this.NPCs.push(npc);

		// Create physical NPC model
		this.CreateNPCModel(npc);

		Network.FireClient(this.Player, "NPCHired", npc.Id, npcType, position);

		return $tuple(true, npc.Id);
	}

	// Create the physical NPC model
	CreateNPCModel(npc: NPCRecord) {
		const model = new Instance("Model");
		model.Name = `${npc.Type}_${npc.Id}`;

		// Create simple humanoid model
		const torso = new Instance("Part");
		torso.Name = "Torso";
		torso.Size = Vector3.new(2, 2, 1);
		torso.Position = npc.Position;
		torso.Anchored = false;

		// Color based on NPC type
		if (npc.Type === "Worker") {
			torso.BrickColor = new BrickColor("Bright yellow");
		} else if (npc.Type === "Guard") {
			torso.BrickColor = new BrickColor("Bright red");
		}

		torso.Parent = model;

		const head = new Instance("Part");
		head.Name = "Head";
		head.Size = Vector3.new(1, 1, 1);
		head.Shape = Enum.PartType.Ball;
		head.Position = npc.Position.add(Vector3.new(0, 1.5, 0));
		head.BrickColor = new BrickColor("Light orange");
		head.Parent = model;

		// Create neck weld
		const weld = new Instance("WeldConstraint");
		weld.Part0 = torso;
		weld.Part1 = head;
		weld.Parent = torso;

		// Add humanoid
		const humanoid = new Instance("Humanoid");
		humanoid.MaxHealth = npc.MaxHealth;
		humanoid.Health = npc.Health;
		humanoid.WalkSpeed = npc.Data.Speed;
		humanoid.Parent = model;

		model.Parent = workspace;
		model.PrimaryPart = torso;
		npc.Model = model;

		return model;
	}

	// Update NPCs (AI, movement, resource gathering)
	UpdateNPCs(deltaTime: number) {
		for (const npc of this.NPCs) {
			if (npc.Type === "Worker") {
				this.UpdateWorker(npc, deltaTime);
			} else if (npc.Type === "Guard") {
				this.UpdateGuard(npc, deltaTime);
			}
		}
	}

	// Worker AI logic
	UpdateWorker(worker: NPCRecord, _deltaTime: number) {
		if (worker.State === "Idle") {
			// Simple idle behavior - could be expanded to gather resources
			// For now, workers just exist and consume food
		} else if (worker.State === "Gathering") {
			// Gathering logic would go here
		}
	}

	// Guard AI logic
	UpdateGuard(guard: NPCRecord, _deltaTime: number) {
		if (guard.State === "Idle") {
			// Patrol or watch for threats
		} else if (guard.State === "Attacking") {
			// Attack logic would go here
		}
	}

	// Pay maintenance costs for all NPCs
	PayMaintenance(minutes: number) {
		let totalWheat = 0;

		for (const npc of this.NPCs) {
			totalWheat += npc.Data.MaintenanceCost.Wheat * minutes;
		}

		// Check if player has enough food
		if (this.ResourceManager.GetResource("Wheat") >= totalWheat) {
			this.ResourceManager.RemoveResource("Wheat", totalWheat);
			return true;
		}

		// Not enough food - NPCs might leave or become unhappy
		Logger.Warn("NPCManager", "Not enough food to maintain NPCs!");
		return false;
	}

	// Get all NPCs
	GetNPCs() {
		return this.NPCs;
	}

	// Get NPC by ID
	GetNPC(npcId: number) {
		for (const npc of this.NPCs) {
			if (npc.Id === npcId) {
				return npc;
			}
		}
		return undefined;
	}

	// Fire/remove an NPC
	FireNPC(npcId: number) {
		for (let i = 0; i < this.NPCs.size(); i += 1) {
			const npc = this.NPCs[i];
			if (npc.Id === npcId) {
				if (npc.Model) {
					npc.Model.Destroy();
				}
				this.NPCs.remove(i);
				return true;
			}
		}
		return false;
	}
}

export = NPCManager;
