// Server-side Research Manager
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const TechTree = require(ReplicatedStorage.Shared.TechTree) as typeof import("shared/TechTree");
const Network = require(ReplicatedStorage.Shared.Network) as typeof import("shared/Network");
const Logger = require(ReplicatedStorage.Shared.Logger) as typeof import("shared/Logger");

class ResearchManager {
	Player: Player;
	ResourceManager: import("./ResourceManager");
	ResearchedTechs: string[];
	CurrentResearch?: string;
	ResearchProgress: number;

	constructor(player: Player, resourceManager: import("./ResourceManager")) {
		this.Player = player;
		this.ResourceManager = resourceManager;
		this.ResearchedTechs = [];
		this.CurrentResearch = undefined;
		this.ResearchProgress = 0;
	}

	// Start researching a technology
	StartResearch(techName: string) {
		const tech = TechTree[techName];
		if (!tech) {
			Logger.Warn("ResearchManager", `Invalid technology: ${techName}`);
			return $tuple(false, "Invalid technology");
		}

		// Check if already researched
		if (this.HasResearched(techName)) {
			return $tuple(false, "Already researched");
		}

		// Check prerequisites
		for (const prereq of tech.Prerequisites) {
			if (!this.HasResearched(prereq)) {
				return $tuple(false, `Missing prerequisite: ${prereq}`);
			}
		}

		// Check if player has enough resources
		if (!this.ResourceManager.HasResources(tech.Cost)) {
			return $tuple(false, "Not enough resources");
		}

		// Check if already researching something
		if (this.CurrentResearch) {
			return $tuple(false, `Already researching: ${this.CurrentResearch}`);
		}

		// Remove research cost
		for (const [resourceType, amount] of pairs(tech.Cost)) {
			this.ResourceManager.RemoveResource(resourceType, amount);
		}

		// Start research
		this.CurrentResearch = techName;
		this.ResearchProgress = 0;

		Network.FireClient(this.Player, "ResearchStarted", techName, tech.ResearchTime);

		return $tuple(true, techName);
	}

	// Update research progress
	UpdateResearch(deltaTime: number) {
		if (!this.CurrentResearch) {
			return;
		}

		const tech = TechTree[this.CurrentResearch];
		this.ResearchProgress += deltaTime;

		if (this.ResearchProgress >= tech.ResearchTime) {
			// Research completed
			this.CompleteResearch(this.CurrentResearch);
		}
	}

	// Complete research
	CompleteResearch(techName: string) {
		this.ResearchedTechs.push(techName);
		Logger.Info("ResearchManager", `Research completed: ${techName} for player: ${this.Player.Name}`);

		// Apply effects
		const tech = TechTree[techName];
		this.ApplyTechEffect(techName, tech);

		this.CurrentResearch = undefined;
		this.ResearchProgress = 0;

		Network.FireClient(this.Player, "ResearchCompleted", techName);
	}

	// Apply technology effect
	ApplyTechEffect(techName: string, tech: import("shared/TechTree").TechInfo) {
		// Tech effects are passive and are checked when needed
		// For example, building costs are reduced when constructing
		// This method could trigger events or update player stats
		Logger.Debug(
			"ResearchManager",
			`Applied tech effect: ${tech.Effect} with modifier: ${tech.Modifier ?? "N/A"}`,
		);
	}

	// Check if a technology has been researched
	HasResearched(techName: string) {
		for (const tech of this.ResearchedTechs) {
			if (tech === techName) {
				return true;
			}
		}
		return false;
	}

	// Get research progress as percentage
	GetResearchProgress() {
		if (!this.CurrentResearch) {
			return 0;
		}

		const tech = TechTree[this.CurrentResearch];
		return (this.ResearchProgress / tech.ResearchTime) * 100;
	}

	// Get all researched technologies
	GetResearchedTechs() {
		return this.ResearchedTechs;
	}

	// Get current research
	GetCurrentResearch() {
		return this.CurrentResearch;
	}

	// Get tech modifier for a specific effect
	// Note: Currently uses multiplicative stacking for all effects
	// Future improvement: Use additive stacking for cost reduction effects
	GetModifier(effectType: string) {
		let modifier = 1;

		for (const techName of this.ResearchedTechs) {
			const tech = TechTree[techName];
			if (tech.Effect === effectType && tech.Modifier) {
				// Multiplicative stacking (e.g., 1.25 * 1.5 = 1.875)
				// Works well for speed/production bonuses
				// For cost reduction, consider additive in future versions
				modifier *= tech.Modifier;
			}
		}

		return modifier;
	}
}

export = ResearchManager;
