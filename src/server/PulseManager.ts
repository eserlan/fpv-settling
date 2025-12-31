// THE PULSE - Resource Collection System
// Every 60 seconds, a global dice roll happens and resources spawn on matching tiles

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");

const TileTypes = require(ReplicatedStorage.Shared.TileTypes) as typeof import("shared/TileTypes");
const ResourceTypes = require(ReplicatedStorage.Shared.ResourceTypes) as typeof import("shared/ResourceTypes");
const Logger = require(ReplicatedStorage.Shared.Logger) as typeof import("shared/Logger");

// Configuration
const PULSE_INTERVAL = 60; // Seconds between pulses
const DICE_ROLL_DURATION = 3; // Seconds for dice animation

// Catan-style number distribution (excludes 7 - robber)
// Numbers 6 and 8 are most common, 2 and 12 are rare
const NUMBER_DISTRIBUTION = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

// State
let pulseTimer = PULSE_INTERVAL;
let isRolling = false;
const tileNumbers: Record<string, number> = {}; // Maps tile coordinates to numbers
let gameStarted = false; // Pulse doesn't start until all players place settlements
let GameManagerRef: { PlayerData: Record<number, { BuildingManager: { HasPlacedFirstSettlement: boolean } }> } | undefined;

// Events
const events = (ReplicatedStorage.FindFirstChild("Events") as Folder) ?? new Instance("Folder", ReplicatedStorage);
events.Name = "Events";

const PulseEvent = (events.FindFirstChild("PulseEvent") as RemoteEvent) ?? new Instance("RemoteEvent", events);
PulseEvent.Name = "PulseEvent";

const TimerEvent = (events.FindFirstChild("TimerEvent") as RemoteEvent) ?? new Instance("RemoteEvent", events);
TimerEvent.Name = "TimerEvent";

const SystemMessageEvent = (events.FindFirstChild("SystemMessageEvent") as RemoteEvent) ?? new Instance("RemoteEvent", events);
SystemMessageEvent.Name = "SystemMessageEvent";

// Roll 2d6 dice
const rollDice = () => {
	const die1 = math.random(1, 6);
	const die2 = math.random(1, 6);
	return $tuple(die1, die2, die1 + die2);
};

const PulseManager = {
	// Assign numbers to tiles (called after map generation)
	AssignTileNumbers() {
		const mapFolder = workspace.FindFirstChild("Map");
		if (!mapFolder) {
			return;
		}

		// Create a shuffled copy of the number distribution
		const numbers = new Array<number>();
		for (const n of NUMBER_DISTRIBUTION) {
			numbers.push(n);
		}

		// Shuffle
		for (let i = numbers.size(); i >= 2; i -= 1) {
			const j = math.random(1, i);
			const currentIndex = i - 1;
			const swapIndex = j - 1;
			const temp = numbers[currentIndex];
			numbers[currentIndex] = numbers[swapIndex];
			numbers[swapIndex] = temp;
		}

		let numberIndex = 0;

		for (const tile of mapFolder.GetChildren()) {
			if (tile.IsA("Model") && tile.PrimaryPart) {
				const tileType = tile.PrimaryPart.GetAttribute("TileType") as string | undefined;

				// Desert gets no number
				if (tileType !== "Desert") {
					const q = tile.PrimaryPart.GetAttribute("Q") as number;
					const r = tile.PrimaryPart.GetAttribute("R") as number;
					const key = `${q}_${r}`;

					const number = numbers[numberIndex] ?? numbers[0];
					tileNumbers[key] = number;
					tile.PrimaryPart.SetAttribute("DiceNumber", number);

					// Update the visible dice label
					const labelGui = tile.PrimaryPart.FindFirstChild("TileLabel");
					if (labelGui && labelGui.IsA("BillboardGui")) {
						const diceLabel = labelGui.FindFirstChild("DiceNumber");
						if (diceLabel && diceLabel.IsA("TextLabel")) {
							diceLabel.Text = `🎲 ${number}`;
							// Highlight 6 and 8 (most common rolls) in red
							if (number === 6 || number === 8) {
								diceLabel.TextColor3 = Color3.fromRGB(255, 100, 100);
							}
						}
					}

					numberIndex = (numberIndex % numbers.size()) + 1;
				}
			}
		}

		Logger.Info("PulseManager", "Assigned numbers to tiles");
	},

	// Get tiles that match a dice roll
	GetMatchingTiles(diceTotal: number) {
		const matching = new Array<Model>();
		const mapFolder = workspace.FindFirstChild("Map");
		if (!mapFolder) {
			return matching;
		}

		for (const tile of mapFolder.GetChildren()) {
			if (tile.IsA("Model") && tile.PrimaryPart) {
				const number = tile.PrimaryPart.GetAttribute("DiceNumber");
				if (number === diceTotal) {
					matching.push(tile);
				}
			}
		}

		return matching;
	},

	// Execute a pulse (dice roll and resource spawn)
	ExecutePulse() {
		if (isRolling) {
			return;
		}
		isRolling = true;

		// Roll the dice
		const [die1, die2, total] = rollDice();

		Logger.Info("PulseManager", `THE PULSE! Rolled ${die1} + ${die2} = ${total}`);

		// Broadcast to all clients for visual effects
		PulseEvent.FireAllClients("RollStart", die1, die2, total);

		// Wait for animation
		task.wait(DICE_ROLL_DURATION);

		// Get matching tiles and spawn resources
		const matchingTiles = PulseManager.GetMatchingTiles(total);

		if (total === 7) {
			// Robber! (TODO: Implement robber mechanics)
			Logger.Warn("PulseManager", "ROBBER! No resources this pulse.");
			PulseEvent.FireAllClients("Robber");
			SystemMessageEvent.FireAllClients("🏴‍☠️ Robber! No resources this round.");
		} else {
			Logger.Info("PulseManager", `${matchingTiles.size()} tiles match!`);

			// Track spawned resources for the message
			const spawnedResources: Record<string, number> = {};

			for (const tile of matchingTiles) {
				const tileType = tile.PrimaryPart?.GetAttribute("TileType") as string | undefined;
				if (!tileType) {
					continue;
				}
				const [resourceKey, resourceData] = ResourceTypes.GetByTileType(tileType);

				if (resourceKey && resourceData) {
					PulseManager.SpawnResource(tile, resourceKey, resourceData);
					spawnedResources[resourceKey] = (spawnedResources[resourceKey] ?? 0) + 1;
				}
			}

			// Send system message about spawned resources
			if (matchingTiles.size() > 0) {
				const resourceList = new Array<string>();
				for (const [resource, count] of pairs(spawnedResources)) {
					resourceList.push(`${count}x ${resource}`);
				}
				const message = `🎲 Rolled ${total}! Spawned: ${resourceList.join(", ")}`;
				SystemMessageEvent.FireAllClients(message);
			} else {
				SystemMessageEvent.FireAllClients(`🎲 Rolled ${total} - No matching tiles`);
			}

			PulseEvent.FireAllClients("RollComplete", die1, die2, total, matchingTiles.size());
		}

		isRolling = false;
		pulseTimer = PULSE_INTERVAL;
	},

	// Spawn a physical resource on a tile
	SpawnResource(tile: Model, resourceKey: string, resourceData: import("shared/ResourceTypes").ResourceInfo) {
		const tilePos = tile.PrimaryPart!.Position;

		// Random position on the tile
		const angle = math.random() * math.pi * 2;
		const dist = math.random(5, 20);
		const spawnPos = tilePos.add(Vector3.new(math.cos(angle) * dist, 10, math.sin(angle) * dist));

		// Create physical resource
		const resource = new Instance("Part");
		resource.Name = `Resource_${resourceKey}`;
		resource.Size = Vector3.new(3, 3, 3);
		resource.Position = spawnPos;
		resource.Color = resourceData.Color;
		resource.Material = resourceData.Material;
		resource.Anchored = false; // Will fall and can be picked up
		resource.CanCollide = true;

		// Add attributes for collection
		resource.SetAttribute("ResourceType", resourceKey);
		resource.SetAttribute("Amount", 1);
		resource.SetAttribute("TileQ", tile.PrimaryPart!.GetAttribute("Q"));
		resource.SetAttribute("TileR", tile.PrimaryPart!.GetAttribute("R"));
		resource.SetAttribute("SpawnTime", os.time());

		// Add glow effect
		const light = new Instance("PointLight");
		light.Color = resourceData.Color;
		light.Brightness = 2;
		light.Range = 8;
		light.Parent = resource;

		// Add to resources folder
		const resourcesFolder = (workspace.FindFirstChild("Resources") as Folder) ?? new Instance("Folder", workspace);
		resourcesFolder.Name = "Resources";
		resource.Parent = resourcesFolder;

		// Resources NO LONGER auto-destroy - they persist until collected
		// Tile ownership will be checked by CollectionManager

		Logger.Debug("PulseManager", `Spawned ${resourceKey} at tile`);
	},

	Update(deltaTime: number) {
		if (isRolling) {
			return;
		}

		// Check if game has started (all players placed settlements)
		if (!gameStarted) {
			if (allPlayersReady()) {
				gameStarted = true;
				pulseTimer = PULSE_INTERVAL;
				Logger.Info("PulseManager", "All players ready! Starting pulse timer...");
				TimerEvent.FireAllClients(math.floor(pulseTimer));
			} else {
				// Show "waiting for players" status
				TimerEvent.FireAllClients(-1); // -1 means waiting
				return;
			}
		}

		pulseTimer -= deltaTime;

		// Broadcast timer to clients every second
		if (math.floor(pulseTimer) !== math.floor(pulseTimer + deltaTime)) {
			TimerEvent.FireAllClients(math.floor(pulseTimer));
		}

		if (pulseTimer <= 0) {
			PulseManager.ExecutePulse();
		}
	},

	// Set reference to GameManager (called from GameManager)
	SetGameManager(gm: { PlayerData: Record<number, { BuildingManager: { HasPlacedFirstSettlement: boolean } }> }) {
		GameManagerRef = gm;
	},

	// Initialize
	Initialize() {
		Logger.Info("PulseManager", "Initialized - Waiting for players to place settlements...");

		// Assign numbers after a short delay to ensure map is generated
		task.delay(1, () => {
			PulseManager.AssignTileNumbers();
		});
	},

	// Get current timer value
	GetTimer() {
		return pulseTimer;
	},

	// Force a pulse (for testing)
	ForcePulse() {
		pulseTimer = 0;
	},
};

// Check if all players have placed their first settlement
const allPlayersReady = () => {
	if (!GameManagerRef) {
		return false;
	}

	const players = Players.GetPlayers();
	if (players.size() === 0) {
		return false;
	}

	for (const player of players) {
		const playerData = GameManagerRef.PlayerData[player.UserId];
		if (!playerData) {
			return false;
		}
		if (!playerData.BuildingManager) {
			return false;
		}
		if (!playerData.BuildingManager.HasPlacedFirstSettlement) {
			return false;
		}
	}

	return true;
};

// Dev panel event handler
const DevEvent = (events.FindFirstChild("DevEvent") as RemoteEvent) ?? new Instance("RemoteEvent", events);
DevEvent.Name = "DevEvent";

DevEvent.OnServerEvent.Connect((player, action) => {
	if (action === "ForcePulse") {
		Logger.Info("PulseManager", `Force pulse triggered by ${player.Name}`);
		PulseManager.ForcePulse();
	}
});

export = PulseManager;
