// Server-side Building Manager
// Handles construction of buildings including settlements that claim tiles

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const BuildingTypes = require(ReplicatedStorage.Shared.BuildingTypes) as typeof import("shared/BuildingTypes");
const Network = require(ReplicatedStorage.Shared.Network) as typeof import("shared/Network");
const Logger = require(ReplicatedStorage.Shared.Logger) as typeof import("shared/Logger");

// TileOwnershipManager will be required when needed to avoid circular deps
let TileOwnershipManager: typeof import("./TileOwnershipManager") | undefined;
const getTileOwnershipManager = () => {
	if (!TileOwnershipManager) {
		TileOwnershipManager = require(script.Parent!.WaitForChild("TileOwnershipManager")) as typeof import("./TileOwnershipManager");
	}
	return TileOwnershipManager;
};

// MapGenerator provides vertex snapping
const MapGenerator = require(script.Parent!.WaitForChild("MapGenerator")) as typeof import("./MapGenerator");

type BuildingRecord = {
	Id: number;
	Type: string;
	Position: Vector3;
	Rotation?: Vector3;
	SnapKey?: string;
	Progress: number;
	BuildTime?: number;
	Completed?: boolean;
	Data?: unknown;
	Blueprint?: import("shared/Blueprints").BlueprintInfo;
	IsSettlement?: boolean;
	IsFoundation?: boolean;
	RequiredResources?: Record<string, number>;
	DepositedResources?: Record<string, number>;
	OwnerId?: number;
	Model?: Model;
};

class BuildingManager {
	Player: Player;
	ResourceManager: import("./ResourceManager");
	Buildings: BuildingRecord[];
	Settlements: BuildingRecord[];
	BuildingInProgress: BuildingRecord[];
	HasPlacedFirstSettlement: boolean;
	FoundationsById?: Record<number, BuildingRecord>;

	constructor(player: Player, resourceManager: import("./ResourceManager")) {
		this.Player = player;
		this.ResourceManager = resourceManager;
		this.Buildings = [];
		this.Settlements = [];
		this.BuildingInProgress = [];
		this.HasPlacedFirstSettlement = false;
	}

	// Start building construction
	StartBuilding(buildingType: string, position: Vector3) {
		const buildingTypeData = BuildingTypes[buildingType];
		if (!buildingTypeData) {
			Logger.Warn("BuildingManager", `Invalid building type: ${buildingType}`);
			return $tuple(false, "Invalid building type");
		}

		let finalPosition = position;

		// Snap settlements to hex vertices (pre-calculated markers)
		if (buildingTypeData.IsSettlement) {
			const [nearestVertex, dist] = MapGenerator.FindNearestVertex(position);
			if (nearestVertex) {
				finalPosition = nearestVertex.Position;
				Logger.Debug("BuildingManager", `Snapped to vertex ${nearestVertex.Name} (dist: ${math.floor(dist)})`);
			}
		}

		// First settlement is FREE
		const isFreeFirstSettlement = buildingTypeData.IsSettlement && !this.HasPlacedFirstSettlement;

		// Check if player has enough resources (unless free first settlement)
		if (!isFreeFirstSettlement) {
			if (!this.ResourceManager.HasResources(buildingTypeData.Cost)) {
				Logger.Warn(
					"BuildingManager",
					`${this.Player.Name} doesn't have enough resources for ${buildingType}`,
				);
				return $tuple(false, "Not enough resources");
			}

			// Remove resources
			for (const [resourceType, amount] of pairs(buildingTypeData.Cost)) {
				this.ResourceManager.RemoveResource(resourceType, amount);
			}
		} else {
			Logger.Info("BuildingManager", `${this.Player.Name} placing FREE first settlement!`);
		}

		// Create building instance
		const buildingId = this.Buildings.size() + 1;
		const building: BuildingRecord = {
			Id: buildingId,
			Type: buildingType,
			Position: finalPosition, // Use snapped position for settlements
			Progress: 0,
			BuildTime: buildingTypeData.BuildTime,
			Completed: false,
			Data: buildingTypeData,
			IsSettlement: buildingTypeData.IsSettlement,
		};

		// If instant build (BuildTime = 0), complete immediately
		if (buildingTypeData.BuildTime === 0) {
			building.Completed = true;
			this.Buildings.push(building);
			this.OnBuildingComplete(building);
		} else {
			this.BuildingInProgress.push(building);
			Network.FireClient(this.Player, "ConstructionStarted", buildingId, buildingType, finalPosition);
		}

		// Mark first settlement as placed
		if (buildingTypeData.IsSettlement && !this.HasPlacedFirstSettlement) {
			this.HasPlacedFirstSettlement = true;
		}

		return $tuple(true, buildingId);
	}

	// New Blueprint Building System: Place a foundation
	PlaceFoundation(blueprintName: string, position: Vector3, rotation?: Vector3, snapKey?: string) {
		const Blueprints = require(ReplicatedStorage.Shared.Blueprints) as typeof import("shared/Blueprints");
		const blueprint = Blueprints.Buildings[blueprintName];

		if (!blueprint) {
			Logger.Warn("BuildingManager", `Invalid blueprint: ${blueprintName}`);
			return $tuple(false, "Invalid blueprint");
		}

		// Create the foundation/ghost building
		// Note: Resources are not deducted here - they're deposited one by one via DepositResource
		const foundationId = this.Buildings.size() + 1;
		const foundation: BuildingRecord = {
			Id: foundationId,
			Type: blueprintName,
			Position: position,
			Rotation: rotation ?? Vector3.new(0, 0, 0),
			SnapKey: snapKey,
			Blueprint: blueprint,
			IsFoundation: true,
			IsSettlement: blueprint.ClaimsTiles || blueprintName === "Settlement",
			RequiredResources: {}, // Copy of blueprint cost
			DepositedResources: {}, // Track what's been deposited
			Progress: 0, // 0 to 1
			Completed: false,
			OwnerId: this.Player.UserId,
		};

		// Copy required resources from blueprint
		for (const [resource, amount] of pairs(blueprint.Cost)) {
			foundation.RequiredResources![resource] = amount;
			foundation.DepositedResources![resource] = 0;
		}

		// Create physical foundation model
		this.CreateFoundationModel(foundation);

		this.Buildings.push(foundation);

		// Store foundation by ID for easy lookup
		this.FoundationsById = this.FoundationsById ?? {};
		this.FoundationsById[foundationId] = foundation;

		// Mark first settlement as placed (for tracking, not for free resources)
		if (blueprintName === "Settlement" && !this.HasPlacedFirstSettlement) {
			this.HasPlacedFirstSettlement = true;
		}

		// Notify client about new foundation
		Network.FireClient(this.Player, "FoundationPlaced", foundationId, blueprintName, position, foundation.RequiredResources);

		Logger.Info(
			"BuildingManager",
			`${this.Player.Name} placed foundation for ${blueprintName} (ID: ${foundationId})`,
		);
		return $tuple(true, foundationId);
	}

	// Deposit a resource into a foundation
	DepositResource(foundationId: number, resourceType: string) {
		const foundation = this.FoundationsById?.[foundationId];
		if (!foundation) {
			Logger.Warn("BuildingManager", `Foundation not found: ${foundationId}`);
			return $tuple(false, "Foundation not found");
		}

		if (foundation.Completed) {
			return $tuple(false, "Already completed");
		}

		// Check if this resource is needed
		const required = foundation.RequiredResources?.[resourceType] ?? 0;
		const deposited = foundation.DepositedResources?.[resourceType] ?? 0;

		if (deposited >= required) {
			return $tuple(false, "Resource not needed");
		}

		// Deposit the resource
		foundation.DepositedResources![resourceType] = deposited + 1;

		// Calculate progress
		let totalRequired = 0;
		let totalDeposited = 0;
		for (const [resource, req] of pairs(foundation.RequiredResources ?? {})) {
			totalRequired += req;
			totalDeposited += foundation.DepositedResources?.[resource] ?? 0;
		}
		foundation.Progress = totalDeposited / totalRequired;

		// Update the visual
		this.UpdateFoundationVisual(foundation);

		// Check if complete
		if (foundation.Progress >= 1) {
			foundation.Completed = true;
			this.OnBuildingComplete(foundation);
			Logger.Info("BuildingManager", `Foundation completed: ${foundation.Type}`);
		}

		// Notify client
		Network.FireClient(this.Player, "ResourceDeposited", foundationId, resourceType, foundation.Progress);

		Logger.Debug(
			"BuildingManager",
			`Deposited ${resourceType} into foundation ${foundationId} (Progress: ${math.floor(
				foundation.Progress * 100,
			)}%)`,
		);
		return $tuple(true, "");
	}

	// Update foundation visual based on progress
	UpdateFoundationVisual(foundation: BuildingRecord) {
		if (!foundation.Model) {
			return;
		}

		const basePart = foundation.Model.FindFirstChild("FoundationBase");
		if (!basePart || !basePart.IsA("BasePart")) {
			return;
		}

		// Reduce transparency as progress increases (0.7 at 0%, 0.2 at 100%)
		basePart.Transparency = 0.7 - foundation.Progress * 0.5;

		// Change color as it completes
		const greenAmount = math.floor(200 + foundation.Progress * 55);
		basePart.Color = Color3.fromRGB(100, greenAmount, 100 + (1 - foundation.Progress) * 155);

		// Update progress bar if exists
		const progressBar = foundation.Model.FindFirstChild("ProgressBar");
		if (progressBar && progressBar.IsA("BasePart")) {
			const fill = foundation.Model.FindFirstChild("Fill");
			if (fill && fill.IsA("BasePart")) {
				const fillWidth = math.max(0.1, progressBar.Size.X * foundation.Progress);
				fill.Size = Vector3.new(fillWidth, fill.Size.Y, fill.Size.Z);
				// Move fill to correct position
				fill.Position = progressBar.Position.sub(Vector3.new((progressBar.Size.X - fillWidth) / 2, 0, 0));
			}
		}

		// Update resource display text
		const resourceDisplay = basePart.FindFirstChild("ResourceDisplay");
		if (resourceDisplay && resourceDisplay.IsA("BillboardGui")) {
			const resourceLabel = resourceDisplay.FindFirstChild("Resources");
			if (resourceLabel && resourceLabel.IsA("TextLabel")) {
				const Blueprints = require(ReplicatedStorage.Shared.Blueprints) as typeof import("shared/Blueprints");
				let resourceText = "Needs:\n";
				for (const [resource, required] of pairs(foundation.RequiredResources ?? {})) {
					const icon = Blueprints.ResourceIcons[resource] ?? "";
					const deposited = foundation.DepositedResources?.[resource] ?? 0;
					const status = deposited >= required ? "✓" : "";
					resourceText = `${resourceText}${icon} ${deposited}/${required} ${status}\n`;
				}
				resourceLabel.Text = resourceText;
			}
		}
	}

	// Get foundation at position (for client interaction)
	GetFoundationNear(position: Vector3, maxDistance = 15) {
		for (const building of this.Buildings) {
			if (building.IsFoundation && !building.Completed) {
				const dist = building.Position.sub(position).Magnitude;
				if (dist <= maxDistance) {
					return building;
				}
			}
		}
		return undefined;
	}

	// Create foundation/ghost model with progress indicators
	CreateFoundationModel(foundation: BuildingRecord) {
		const model = new Instance("Model");
		model.Name = `${this.Player.Name}_Foundation_${foundation.Type}_${foundation.Id}`;

		const size = foundation.Blueprint?.Size ?? Vector3.new(5, 4, 5);

		// Main ghost building
		const part = new Instance("Part");
		part.Name = "FoundationBase";
		part.Size = size;
		part.CFrame = CFrame.new(foundation.Position.add(Vector3.new(0, size.Y / 2, 0))).mul(
			CFrame.Angles(
				math.rad(foundation.Rotation?.X ?? 0),
				math.rad(foundation.Rotation?.Y ?? 0),
				math.rad(foundation.Rotation?.Z ?? 0),
			),
		);
		part.Anchored = true;
		part.CanCollide = false;
		part.Transparency = 0.7; // Start very transparent
		part.Color = Color3.fromRGB(100, 200, 255); // Light blue ghost
		part.Material = Enum.Material.ForceField;
		part.Parent = model;

		// Progress bar background
		const progressBg = new Instance("Part");
		progressBg.Name = "ProgressBar";
		progressBg.Size = Vector3.new(6, 0.3, 0.3);
		progressBg.Position = foundation.Position.add(Vector3.new(0, size.Y + 2, 0));
		progressBg.Anchored = true;
		progressBg.CanCollide = false;
		progressBg.Color = Color3.fromRGB(50, 50, 50);
		progressBg.Material = Enum.Material.SmoothPlastic;
		progressBg.Parent = model;

		// Progress bar fill
		const progressFill = new Instance("Part");
		progressFill.Name = "Fill";
		progressFill.Size = Vector3.new(0.1, 0.4, 0.4); // Starts small
		progressFill.Position = progressBg.Position.sub(Vector3.new(progressBg.Size.X / 2 - 0.05, 0, 0));
		progressFill.Anchored = true;
		progressFill.CanCollide = false;
		progressFill.Color = Color3.fromRGB(100, 255, 100); // Green
		progressFill.Material = Enum.Material.Neon;
		progressFill.Parent = model;

		// Billboard for resource requirements
		const billboard = new Instance("BillboardGui");
		billboard.Name = "ResourceDisplay";
		billboard.Size = UDim2.new(0, 150, 0, 80);
		billboard.StudsOffset = Vector3.new(0, size.Y + 4, 0);
		billboard.AlwaysOnTop = true;
		billboard.Adornee = part;
		billboard.Parent = part;

		const resourceLabel = new Instance("TextLabel");
		resourceLabel.Name = "Resources";
		resourceLabel.Size = UDim2.new(1, 0, 1, 0);
		resourceLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
		resourceLabel.BackgroundTransparency = 0.3;
		resourceLabel.TextColor3 = Color3.new(1, 1, 1);
		resourceLabel.Font = Enum.Font.GothamBold;
		resourceLabel.TextSize = 14;
		resourceLabel.TextWrapped = true;
		resourceLabel.Parent = billboard;

		// Build resource text
		const Blueprints = require(ReplicatedStorage.Shared.Blueprints) as typeof import("shared/Blueprints");
		let resourceText = "Needs:\n";
		for (const [resource, amount] of pairs(foundation.RequiredResources ?? {})) {
			const icon = Blueprints.ResourceIcons[resource] ?? "";
			const deposited = foundation.DepositedResources?.[resource] ?? 0;
			resourceText = `${resourceText}${icon} ${deposited}/${amount}\n`;
		}
		resourceLabel.Text = resourceText;

		// Put in appropriate folder
		const folderName = foundation.IsSettlement ? "Settlements" : "Buildings";
		const folder = (workspace.FindFirstChild(folderName) as Folder) ?? new Instance("Folder", workspace);
		folder.Name = folderName;
		model.Parent = folder;
		model.PrimaryPart = part;

		// Store reference to foundation ID on the model for interaction
		part.SetAttribute("FoundationId", foundation.Id);
		part.SetAttribute("OwnerId", foundation.OwnerId);
		part.SetAttribute("Key", foundation.SnapKey);

		foundation.Model = model;
	}

	UpdateBuildings(deltaTime: number) {
		for (let i = this.BuildingInProgress.size(); i >= 1; i -= 1) {
			const building = this.BuildingInProgress[i - 1];
			building.Progress += deltaTime;

			if (building.Progress >= (building.BuildTime ?? 0)) {
				// Building completed
				building.Completed = true;
				this.Buildings.push(building);
				this.BuildingInProgress.remove(i - 1);
				this.OnBuildingComplete(building);
			}
		}
	}

	// Called when a building is completed
	OnBuildingComplete(building: BuildingRecord) {
		Logger.Info("BuildingManager", `Building completed: ${building.Type} for player: ${this.Player.Name}`);

		// Remove foundation model if it exists
		if (building.Model) {
			building.Model.Destroy();
			building.Model = undefined;
		}

		// Create physical building in workspace
		this.CreateBuildingModel(building);

		// If it's a settlement, claim nearby tiles
		if (building.IsSettlement) {
			const settlementId = `${this.Player.UserId}_${building.Id}`;
			const ownership = getTileOwnershipManager();
			const claimedTiles = ownership.ClaimTilesNearSettlement(this.Player, building.Position, settlementId);

			this.Settlements.push(building);
			Logger.Info("BuildingManager", `Settlement claimed ${claimedTiles.size()} tiles`);
		}

		Network.FireClient(this.Player, "ConstructionCompleted", building.Id, building.Type);
	}

	// Create the physical building model
	CreateBuildingModel(building: BuildingRecord) {
		const model = new Instance("Model");
		model.Name = `${this.Player.Name}_${building.Type}_${building.Id}`;

		// Get size from Blueprint (new system) or Data (old system)
		const buildingData = building.Blueprint ?? building.Data ?? {};
		const size = (buildingData as { Size?: Vector3 }).Size ?? Vector3.new(5, 4, 5);

		// Base CFrame for entire building
		let baseCFrame = CFrame.new(building.Position);
		if (building.Rotation) {
			baseCFrame = baseCFrame.mul(
				CFrame.Angles(math.rad(building.Rotation.X), math.rad(building.Rotation.Y), math.rad(building.Rotation.Z)),
			);
		}

		const part = new Instance("Part");
		part.Size = size;
		part.CFrame = baseCFrame.mul(CFrame.new(0, size.Y / 2, 0));
		part.Anchored = true;
		part.Parent = model;

		// Color based on building type
		if (building.Type === "Settlement") {
			// Create a proper house shape!
			// Base/walls
			part.Size = Vector3.new(5, 4, 5);
			part.CFrame = baseCFrame.mul(CFrame.new(0, 2, 0));
			part.Color = Color3.fromRGB(220, 200, 160); // Cream walls
			part.Material = Enum.Material.SmoothPlastic;

			// Roof - using 2 wedges to form A-frame
			const roofHeight = 2.5;
			const roofOverhang = 0.5;

			// Left side of roof
			const roof1 = new Instance("WedgePart");
			roof1.Size = Vector3.new(5 + roofOverhang * 2, roofHeight, 3);
			roof1.CFrame = baseCFrame.mul(CFrame.new(0, 4 + roofHeight / 2, -1.5));
			roof1.Anchored = true;
			roof1.Color = Color3.fromRGB(139, 69, 19); // Brown roof
			roof1.Material = Enum.Material.Wood;
			roof1.Parent = model;

			// Right side of roof (rotated 180 degrees around Y)
			const roof2 = new Instance("WedgePart");
			roof2.Size = Vector3.new(5 + roofOverhang * 2, roofHeight, 3);
			roof2.CFrame = baseCFrame.mul(CFrame.new(0, 4 + roofHeight / 2, 1.5)).mul(CFrame.Angles(0, math.pi, 0));
			roof2.Anchored = true;
			roof2.Color = Color3.fromRGB(139, 69, 19); // Brown roof
			roof2.Material = Enum.Material.Wood;
			roof2.Parent = model;

			// Door
			const door = new Instance("Part");
			door.Size = Vector3.new(1.2, 2.5, 0.3);
			door.CFrame = baseCFrame.mul(CFrame.new(0, 1.25, 2.6));
			door.Anchored = true;
			door.Color = Color3.fromRGB(101, 67, 33); // Dark wood door
			door.Material = Enum.Material.Wood;
			door.Parent = model;

			// Window
			const window = new Instance("Part");
			window.Size = Vector3.new(1, 1, 0.2);
			window.CFrame = baseCFrame.mul(CFrame.new(1.5, 2.5, 2.6));
			window.Anchored = true;
			window.Color = Color3.fromRGB(135, 206, 235); // Light blue glass
			window.Material = Enum.Material.Glass;
			window.Transparency = 0.3;
			window.Parent = model;
		} else if (building.Type === "City") {
			part.Color = Color3.fromRGB(80, 80, 80); // Stone grey
			part.Material = Enum.Material.Slate;
		} else if (building.Type === "Road") {
			part.Size = Vector3.new(37, 1, 3);
			part.CFrame = baseCFrame.mul(CFrame.new(0, 0.1, 0));
			part.Color = Color3.fromRGB(100, 80, 60); // Dirt road
			part.Material = Enum.Material.Ground;
		} else if (building.Type === "House") {
			part.Color = Color3.fromRGB(200, 100, 80); // Red house
			part.Material = Enum.Material.Brick;
		} else if (building.Type === "Storage") {
			part.Color = Color3.fromRGB(180, 140, 60); // Yellow storage
			part.Material = Enum.Material.Wood;
		}

		// Put in appropriate folder
		const folderName = building.IsSettlement ? "Settlements" : "Buildings";
		const folder = (workspace.FindFirstChild(folderName) as Folder) ?? new Instance("Folder", workspace);
		folder.Name = folderName;
		model.Parent = folder;
		model.PrimaryPart = part;

		building.Model = model;
		part.SetAttribute("Key", building.SnapKey);
		part.SetAttribute("OwnerId", building.OwnerId);

		return model;
	}

	// Get all completed buildings
	GetBuildings() {
		return this.Buildings;
	}

	// Get settlements
	GetSettlements() {
		return this.Settlements;
	}

	// Get buildings currently under construction
	GetBuildingsInProgress() {
		return this.BuildingInProgress;
	}
}

export = BuildingManager;
