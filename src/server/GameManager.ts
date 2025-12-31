// Main Game Manager Server Script
const Players = game.GetService("Players");
const RunService = game.GetService("RunService");

const ResourceManager = require(script.Parent!.WaitForChild("ResourceManager")) as typeof import("./ResourceManager");
const BuildingManager = require(script.Parent!.WaitForChild("BuildingManager")) as typeof import("./BuildingManager");
const NPCManager = require(script.Parent!.WaitForChild("NPCManager")) as typeof import("./NPCManager");
const ResearchManager = require(script.Parent!.WaitForChild("ResearchManager")) as typeof import("./ResearchManager");
const NetworkHandler = require(script.Parent!.WaitForChild("NetworkHandler")) as typeof import("./NetworkHandler");
const MapGenerator = require(script.Parent!.WaitForChild("MapGenerator")) as typeof import("./MapGenerator");
const PulseManager = require(script.Parent!.WaitForChild("PulseManager")) as typeof import("./PulseManager");
const CollectionManager = require(script.Parent!.WaitForChild("CollectionManager")) as typeof import("./CollectionManager");
const LogService = require(script.Parent!.WaitForChild("LogService")) as typeof import("./LogService");
const TileOwnershipManager = require(script.Parent!.WaitForChild("TileOwnershipManager")) as typeof import("./TileOwnershipManager");

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Logger = require(ReplicatedStorage.Shared.Logger) as typeof import("shared/Logger");

type PlayerData = {
	Player: Player;
	ResourceManager: import("./ResourceManager");
	BuildingManager: import("./BuildingManager");
	NPCManager: import("./NPCManager");
	ResearchManager: import("./ResearchManager");
	GameTime: number;
	Settlements: unknown[];
	NeedsFirstSettlement: boolean;
};

const GameManager = {
	PlayerData: {} as Record<number, PlayerData>,
};

// Generate the procedural map
MapGenerator.Generate();

// Initialize the Pulse system
PulseManager.Initialize();
PulseManager.SetGameManager(GameManager);

const onPlayerAdded = (player: Player) => {
	Logger.Info("GameManager", `Player joined: ${player.Name}`);

	// Initialize collection/inventory for this player
	CollectionManager.InitPlayer(player);

	// Create managers for this player
	const resourceManager = new ResourceManager(player);
	const buildingManager = new BuildingManager(player, resourceManager);
	const npcManager = new NPCManager(player, resourceManager);
	const researchManager = new ResearchManager(player, resourceManager);

	GameManager.PlayerData[player.UserId] = {
		Player: player,
		ResourceManager: resourceManager,
		BuildingManager: buildingManager,
		NPCManager: npcManager,
		ResearchManager: researchManager,
		GameTime: 0,
		Settlements: [],
		NeedsFirstSettlement: true, // Player must place first settlement
	};

	// Setup player character
	player.CharacterAdded.Connect((character) => {
		const humanoid = character.WaitForChild("Humanoid") as Humanoid;
		humanoid.WalkSpeed = 16;

		// Notify player they need to place their first settlement
		const playerData = GameManager.PlayerData[player.UserId];
		if (playerData && playerData.NeedsFirstSettlement) {
			Logger.Info("GameManager", `${player.Name} needs to place first settlement (Press B)`);
		}
	});
};

// Clean up player data when they leave
const onPlayerRemoving = (player: Player) => {
	Logger.Info("GameManager", `Player leaving: ${player.Name}`);
	CollectionManager.RemovePlayer(player);
	delete GameManager.PlayerData[player.UserId];
};

// Game update loop
let lastUpdate = tick();
RunService.Heartbeat.Connect(() => {
	const currentTime = tick();
	const deltaTime = currentTime - lastUpdate;
	lastUpdate = currentTime;

	// Update the Pulse system (global timer)
	PulseManager.Update(deltaTime);

	// Update resource collection
	CollectionManager.Update(deltaTime);

	// Update all player systems
	for (const [userId, playerData] of pairs(GameManager.PlayerData)) {
		playerData.GameTime += deltaTime;

		// Update building construction
		playerData.BuildingManager.UpdateBuildings(deltaTime);

		// Update NPCs
		playerData.NPCManager.UpdateNPCs(deltaTime);

		// Update research
		playerData.ResearchManager.UpdateResearch(deltaTime);

		// Pay NPC maintenance every minute
		if (playerData.GameTime % 60 < deltaTime) {
			playerData.NPCManager.PayMaintenance(1);
		}
	}
});

// Connect player events
Players.PlayerAdded.Connect(onPlayerAdded);
Players.PlayerRemoving.Connect(onPlayerRemoving);

// Handle existing players (in case script loads after players join)
for (const player of Players.GetPlayers()) {
	onPlayerAdded(player);
}

// Initialize Network Handler
NetworkHandler.Init(GameManager);

Logger.Info("GameManager", "Game Manager initialized!");

export = GameManager;
