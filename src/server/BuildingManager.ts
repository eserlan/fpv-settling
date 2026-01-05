import { MapGenerator } from "./services/MapGenerator";
import { TileOwnershipManager } from "./services/TileOwnershipManager";

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const HttpService = game.GetService("HttpService");
import BuildingTypes from "shared/BuildingTypes";
import { ServerEvents } from "./ServerEvents";
import * as Logger from "shared/Logger";
import Blueprints from "shared/Blueprints";
import type { GameEntity } from "shared/GameEntity";
import { NetworkUtils } from "./NetworkUtils";

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
	IsTown?: boolean;
	IsFoundation?: boolean;
	RequiredResources?: Record<string, number>;
	DepositedResources?: Record<string, number>;
	OwnerId?: number;
	Model?: Model;
};

class BuildingManager {
	Player: GameEntity;
	PlayerColor: Color3;
	ResourceManager: import("./ResourceManager");
	PortManager?: import("./PortManager");
	Buildings: BuildingRecord[];
	Towns: BuildingRecord[];
	BuildingInProgress: BuildingRecord[];
	HasPlacedFirstTown: boolean;
	FoundationsById?: Record<number, BuildingRecord>;

	constructor(
		player: GameEntity,
		playerColor: Color3,
		resourceManager: import("./ResourceManager"),
		private mapGenerator: MapGenerator,
		private tileOwnershipManager: TileOwnershipManager,
	) {
		this.Player = player;
		this.PlayerColor = playerColor;
		this.ResourceManager = resourceManager;
		this.Buildings = [];
		this.Towns = [];
		this.BuildingInProgress = [];
		this.HasPlacedFirstTown = false;
	}

	SetPortManager(portManager: import("./PortManager")) {
		this.PortManager = portManager;
	}

	StartBuilding(buildingType: string, position: Vector3, isFree = false): LuaTuple<[boolean, any]> {
		const buildingTypeData = BuildingTypes[buildingType];
		if (!buildingTypeData) return $tuple(false, "Invalid building type");



		let finalPosition = position;
		let finalRotation: Vector3 | undefined;
		let snapKey: string | undefined;

		if (buildingTypeData.IsTown) {
			const [nearestVertex, dist] = this.mapGenerator.FindNearestVertex(position);
			if (nearestVertex && dist < 15) {
				const adjCount = (nearestVertex.GetAttribute("AdjacentTileCount") as number) ?? 0;
				if (adjCount < 2) return $tuple(false, "Invalid town location (must touch 2+ hexes)");

				const adjLandCount = (nearestVertex.GetAttribute("AdjacentLandTileCount") as number) ?? 0;
				if (adjLandCount === 0) return $tuple(false, "Cannot build in the open sea!");

				snapKey = nearestVertex.GetAttribute("Key") as string;

				// Check if occupied
				const folder = game.Workspace.FindFirstChild("Towns");
				let existingTown: Model | undefined;

				if (folder) {
					for (const s of folder.GetChildren()) {
						if (s.IsA("Model") && s.GetAttribute("Key") === snapKey) {
							existingTown = s as Model;
							break;
						}
					}
				}

				if (buildingTypeData.RequiresTown) {
					if (!existingTown) return $tuple(false, "No town found at this location to upgrade");

					const ownerId = existingTown.GetAttribute("OwnerId") as number | undefined;
					if (ownerId !== this.Player.UserId) {
						return $tuple(false, "You don't own the town at this location");
					}

					const existingType = existingTown.Name.lower();
					if (existingType.find("city")[0] !== undefined) {
						return $tuple(false, "This town is already a city");
					}
				} else if (existingTown) {
					return $tuple(false, "Town already exists here");
				}

				if (!buildingTypeData.RequiresTown) {
					// DISTANCE RULE: Towns must be at least 2 edges apart from ALL other towns
					const MIN_TOWN_DISTANCE = 50;
					if (folder) {
						for (const s of folder.GetChildren()) {
							if (s.IsA("Model") && s.PrimaryPart) {
								const dist = nearestVertex.Position.sub(s.PrimaryPart.Position).Magnitude;
								if (dist < MIN_TOWN_DISTANCE) {
									const ownerName = s.GetAttribute("OwnerName") as string ?? "another player";
									return $tuple(false, `Too close to existing town (must be 2+ edges apart)`);
								}
							}
						}
					}

					// CONNECTION RULE: After first 2 towns, must be connected to a road
					if (this.Towns.size() >= 2) {
						if (!this.IsConnectedToRoad(nearestVertex, this.Player.UserId)) {
							return $tuple(false, "Town must be connected to one of your roads");
						}
					}
				}

				finalPosition = nearestVertex.Position;
			}
		} else if (buildingTypeData.IsRoad) {
			const [nearestEdge, dist] = this.mapGenerator.FindNearestEdge(position);
			if (nearestEdge && dist < 20) {
				const adjLandCount = (nearestEdge.GetAttribute("AdjacentLandTileCount") as number) ?? 0;
				if (adjLandCount === 0) return $tuple(false, "Cannot build in the open sea!");

				snapKey = nearestEdge.GetAttribute("Key") as string;

				// Check if occupied
				const folder = game.Workspace.FindFirstChild("Buildings");
				if (folder) {
					for (const b of folder.GetChildren()) {
						if (b.IsA("Model") && b.GetAttribute("Key") === snapKey) {
							return $tuple(false, "Road already exists here");
						}
					}
				}

				finalPosition = nearestEdge.Position;
				const [rx, ry, rz] = nearestEdge.CFrame.ToEulerAnglesXYZ();
				finalRotation = new Vector3(math.deg(rx), math.deg(ry), math.deg(rz));
			} else {
				return $tuple(false, "Could not find valid edge for road");
			}
		}

		// Always check and deduct resources (unless free)
		if (!isFree) {
			if (!this.ResourceManager.HasResources(buildingTypeData.Cost)) {
				Logger.Warn("BuildingManager", `${this.Player.Name} doesn't have resources for ${buildingType}`);
				return $tuple(false, "Not enough resources");
			}
			Logger.Info("BuildingManager", `${this.Player.Name} paying for ${buildingType}: ${HttpService.JSONEncode(buildingTypeData.Cost)}`);
			for (const [resourceType, amount] of pairs(buildingTypeData.Cost)) {
				this.ResourceManager.RemoveResource(resourceType, amount);
			}
		}

		const buildingId = this.Buildings.size() + 1;
		const building: BuildingRecord = {
			Id: buildingId,
			Type: buildingType,
			Position: finalPosition,
			Rotation: finalRotation,
			Progress: 0,
			BuildTime: buildingTypeData.BuildTime,
			Completed: false,
			Data: buildingTypeData,
			IsTown: buildingTypeData.IsTown,
			OwnerId: this.Player.UserId,
			SnapKey: snapKey,
		};

		if (buildingTypeData.BuildTime === 0) {
			building.Completed = true;
			this.Buildings.push(building);
			this.OnBuildingComplete(building);
		} else {
			this.BuildingInProgress.push(building);
			NetworkUtils.FireClient(this.Player, ServerEvents.ConstructionStarted, buildingId, buildingType, finalPosition);
		}

		if (buildingTypeData.IsTown && !this.HasPlacedFirstTown) {
			this.HasPlacedFirstTown = true;
		}
		return $tuple(true, buildingId);
	}

	PlaceFoundation(blueprintName: string, position: Vector3, rotation?: Vector3, snapKey?: string) {
		const blueprint = Blueprints.Buildings[blueprintName];
		if (!blueprint) return $tuple(false, "Invalid blueprint");

		const foundationId = this.Buildings.size() + 1;
		const foundation: BuildingRecord = {
			Id: foundationId,
			Type: blueprintName,
			Position: position,
			Rotation: rotation ?? new Vector3(0, 0, 0),
			SnapKey: snapKey,
			Blueprint: blueprint,
			IsFoundation: true,
			IsTown: blueprint.ClaimsTiles || blueprintName === "Town",
			RequiredResources: {},
			DepositedResources: {},
			Progress: 0,
			Completed: false,
			OwnerId: this.Player.UserId,
		};

		if (blueprint.PlacementType === "edge" && snapKey) {
			const edgeFolder = game.Workspace.FindFirstChild("Edges");
			const edge = edgeFolder?.FindFirstChild(snapKey) as BasePart;
			if (edge) {
				const landCount = (edge.GetAttribute("AdjacentLandTileCount") as number) ?? 0;
				if (landCount === 0) return $tuple(false, "Cannot build on the open sea!");
			}
		} else if (blueprint.PlacementType === "3-way") {
			const [nearestVertex, dist] = this.mapGenerator.FindNearestVertex(position);
			if (nearestVertex) {
				const landCount = (nearestVertex.GetAttribute("AdjacentLandTileCount") as number) ?? 0;
				if (landCount === 0) return $tuple(false, "Cannot build in the open sea!");
			}
		}

		if (foundation.IsTown) {
			const [nearestVertex, dist] = this.mapGenerator.FindNearestVertex(position);
			if (nearestVertex && dist < 15) {
				const adjCount = (nearestVertex.GetAttribute("AdjacentTileCount") as number) ?? 0;
				if (adjCount >= 2) {
					// CONNECTION RULE: After first 2 towns, must be connected to a road
					if (this.Towns.size() >= 2) {
						if (!this.IsConnectedToRoad(nearestVertex, this.Player.UserId)) {
							return $tuple(false, "Town must be connected to one of your roads");
						}
					}
					foundation.Position = nearestVertex.Position;
				}
			}
		}

		for (const [resource, amount] of pairs(blueprint.Cost)) {
			foundation.RequiredResources![resource] = amount;
			foundation.DepositedResources![resource] = 0;
		}

		this.CreateFoundationModel(foundation);
		this.Buildings.push(foundation);
		this.FoundationsById = this.FoundationsById ?? {};
		this.FoundationsById[foundationId] = foundation;

		if (blueprintName === "Town" && !this.HasPlacedFirstTown) this.HasPlacedFirstTown = true;
		NetworkUtils.FireClient(this.Player, ServerEvents.FoundationPlaced, foundationId, blueprintName, position, foundation.RequiredResources ?? {});
		return $tuple(true, foundationId);
	}

	DepositResource(foundationId: number, resourceType: string) {
		const foundation = this.FoundationsById?.[foundationId];
		if (!foundation) return $tuple(false, "Foundation not found");
		if (foundation.Completed) return $tuple(false, "Already completed");

		const required = foundation.RequiredResources?.[resourceType] ?? 0;
		const deposited = foundation.DepositedResources?.[resourceType] ?? 0;
		if (deposited >= required) return $tuple(false, "Resource not needed");

		foundation.DepositedResources![resourceType] = deposited + 1;

		let totalRequired = 0;
		let totalDeposited = 0;
		for (const [resource, req] of pairs(foundation.RequiredResources ?? {})) {
			totalRequired += req;
			totalDeposited += foundation.DepositedResources?.[resource] ?? 0;
		}
		foundation.Progress = totalDeposited / totalRequired;
		this.UpdateFoundationVisual(foundation);

		if (foundation.Progress >= 1) {
			foundation.Completed = true;
			this.OnBuildingComplete(foundation);
		}

		NetworkUtils.FireClient(this.Player, ServerEvents.ResourceDeposited, foundationId, resourceType, foundation.Progress);
		return $tuple(true, "");
	}

	UpdateFoundationVisual(foundation: BuildingRecord) {
		if (!foundation.Model) return;
		const basePart = foundation.Model.FindFirstChild("FoundationBase");
		if (!basePart || !basePart.IsA("BasePart")) return;

		basePart.Transparency = 0.7 - foundation.Progress * 0.5;
		// Removed color shift to preserve player identity

		const progressBar = foundation.Model.FindFirstChild("ProgressBar");
		if (progressBar && progressBar.IsA("BasePart")) {
			const fill = foundation.Model.FindFirstChild("Fill");
			if (fill && fill.IsA("BasePart")) {
				const fillWidth = math.max(0.1, progressBar.Size.X * foundation.Progress);
				fill.Size = new Vector3(fillWidth, fill.Size.Y, fill.Size.Z);
				fill.Position = progressBar.Position.sub(new Vector3((progressBar.Size.X - fillWidth) / 2, 0, 0));
			}
		}

		const resourceDisplay = basePart.FindFirstChild("ResourceDisplay");
		if (resourceDisplay && resourceDisplay.IsA("BillboardGui")) {
			const resourceLabel = resourceDisplay.FindFirstChild("Resources");
			if (resourceLabel && resourceLabel.IsA("TextLabel")) {
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

	GetFoundationNear(position: Vector3, maxDistance = 15) {
		for (const building of this.Buildings) {
			if (building.IsFoundation && !building.Completed) {
				const dist = building.Position.sub(position).Magnitude;
				if (dist <= maxDistance) return building;
			}
		}
		return undefined;
	}

	CreateFoundationModel(foundation: BuildingRecord) {
		const model = new Instance("Model");
		model.Name = `${this.Player.Name}_Foundation_${foundation.Type}_${foundation.Id}`;
		const size = foundation.Blueprint?.Size ?? new Vector3(5, 4, 5);

		const part = new Instance("Part");
		part.Name = "FoundationBase";
		part.Size = size;
		part.CFrame = new CFrame(foundation.Position.add(new Vector3(0, size.Y / 2, 0))).mul(
			CFrame.Angles(math.rad(foundation.Rotation?.X ?? 0), math.rad(foundation.Rotation?.Y ?? 0), math.rad(foundation.Rotation?.Z ?? 0)),
		);
		part.Anchored = true;
		part.CanCollide = false;
		part.Transparency = 0.7;
		part.Color = this.PlayerColor;
		part.Material = Enum.Material.ForceField;
		part.CollisionGroup = "Obstacles";
		part.Parent = model;

		// Add PathfindingModifier to ignore for pathing
		const modifier = new Instance("PathfindingModifier");
		modifier.PassThrough = true;
		modifier.Parent = part;

		const progressBg = new Instance("Part");
		progressBg.Name = "ProgressBar";
		progressBg.Size = new Vector3(6, 0.3, 0.3);
		progressBg.Position = foundation.Position.add(new Vector3(0, size.Y + 2, 0));
		progressBg.Anchored = true;
		progressBg.CanCollide = false;
		progressBg.Color = Color3.fromRGB(50, 50, 50);
		progressBg.Parent = model;

		const progressFill = new Instance("Part");
		progressFill.Name = "Fill";
		progressFill.Size = new Vector3(0.1, 0.4, 0.4);
		progressFill.Position = progressBg.Position.sub(new Vector3(progressBg.Size.X / 2 - 0.05, 0, 0));
		progressFill.Anchored = true;
		progressFill.CanCollide = false;
		progressFill.Color = Color3.fromRGB(100, 255, 100);
		progressFill.Material = Enum.Material.Neon;
		progressFill.Parent = model;

		const billboard = new Instance("BillboardGui");
		billboard.Name = "ResourceDisplay";
		billboard.Size = new UDim2(0, 150, 0, 80);
		billboard.StudsOffset = new Vector3(0, size.Y + 4, 0);
		billboard.AlwaysOnTop = true;
		billboard.Adornee = part;
		billboard.Parent = part;

		const resourceLabel = new Instance("TextLabel");
		resourceLabel.Name = "Resources";
		resourceLabel.Size = new UDim2(1, 0, 1, 0);
		resourceLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
		resourceLabel.BackgroundTransparency = 0.3;
		resourceLabel.TextColor3 = new Color3(1, 1, 1);
		resourceLabel.Font = Enum.Font.GothamBold;
		resourceLabel.TextSize = 14;
		resourceLabel.TextWrapped = true;
		resourceLabel.Parent = billboard;

		let resourceText = "Needs:\n";
		for (const [resource, amount] of pairs(foundation.RequiredResources ?? {})) {
			const icon = Blueprints.ResourceIcons[resource] ?? "";
			const deposited = foundation.DepositedResources?.[resource] ?? 0;
			resourceText = `${resourceText}${icon} ${deposited}/${amount}\n`;
		}
		resourceLabel.Text = resourceText;

		const folderName = foundation.IsTown ? "Towns" : "Buildings";
		const folder = (game.Workspace.FindFirstChild(folderName) as Folder) ?? new Instance("Folder", game.Workspace);
		folder.Name = folderName;
		model.Parent = folder;
		model.PrimaryPart = part;
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
				building.Completed = true;
				this.Buildings.push(building);
				this.BuildingInProgress.remove(i - 1);
				this.OnBuildingComplete(building);
			}
		}
	}

	OnBuildingComplete(building: BuildingRecord) {
		if (building.Model) {
			building.Model.Destroy();
			building.Model = undefined;
		}
		Logger.Info("BuildingManager", `[${this.Player.Name}] Completed building ${building.Type} (ID: ${building.Id})`);
		this.CreateBuildingModel(building);
		if (building.IsTown) {
			// If this is a City, replace the old Town record
			if (building.Type === "City") {
				const existingIndex = this.Towns.findIndex(t => t.SnapKey === building.SnapKey && t.Type === "Town");
				if (existingIndex !== -1) {
					const oldTown = this.Towns[existingIndex];
					if (oldTown.Model) oldTown.Model.Destroy();
					this.Towns.remove(existingIndex);

					// Also remove from general buildings list
					const bIndex = this.Buildings.findIndex(b => b.SnapKey === building.SnapKey && b.Type === "Town");
					if (bIndex !== -1) this.Buildings.remove(bIndex);
				}

				// Also must remove the physical Town from workspace
				const folder = game.Workspace.FindFirstChild("Towns");
				if (folder) {
					for (const s of folder.GetChildren()) {
						if (s.IsA("Model") && s.GetAttribute("Key") === building.SnapKey) {
							if (s.Name.lower().find("city")[0] === undefined) { // Don't delete self!
								s.Destroy();
							}
						}
					}
				}
			}

			const townId = `${this.Player.UserId}_${building.Id}`;
			const claimedTiles = this.tileOwnershipManager.ClaimTilesNearTown(this.Player, building.Position, townId);
			this.Towns.push(building);
			if (this.PortManager) this.PortManager.ClaimPort(building.Position, townId);
		}
		NetworkUtils.FireClient(this.Player, ServerEvents.ConstructionCompleted, building.Id, building.Type);
	}

	CreateBuildingModel(building: BuildingRecord) {
		const model = new Instance("Model");
		model.Name = `${this.Player.Name}_${building.Type}_${building.Id}`;
		const buildingData = building.Blueprint ?? building.Data ?? {};
		const size = (buildingData as { Size?: Vector3 }).Size ?? new Vector3(5, 4, 5);

		let baseCFrame = new CFrame(building.Position);
		if (building.Rotation) baseCFrame = baseCFrame.mul(CFrame.Angles(math.rad(building.Rotation.X), math.rad(building.Rotation.Y), math.rad(building.Rotation.Z)));

		const part = new Instance("Part");
		part.Size = size;
		part.CFrame = baseCFrame.mul(new CFrame(0, size.Y / 2, 0));
		part.Anchored = true;
		part.CollisionGroup = "Obstacles";
		part.Parent = model;
		part.Color = this.PlayerColor;

		if (building.Type === "Town") {
			part.Size = new Vector3(5, 4, 5);
			part.CFrame = baseCFrame.mul(new CFrame(0, 2, 0));
			part.Color = Color3.fromRGB(220, 200, 160);
			const roof1 = new Instance("WedgePart");
			roof1.Size = new Vector3(6, 2.5, 3);
			roof1.CFrame = baseCFrame.mul(new CFrame(0, 5.25, -1.5));
			roof1.Anchored = true;
			roof1.Color = this.PlayerColor;
			roof1.Parent = model;
			const roof2 = new Instance("WedgePart");
			roof2.Size = new Vector3(6, 2.5, 3);
			roof2.CFrame = baseCFrame.mul(new CFrame(0, 5.25, 1.5)).mul(CFrame.Angles(0, math.pi, 0));
			roof2.Anchored = true;
			roof2.Color = this.PlayerColor;
			roof2.Parent = model;
			const door = new Instance("Part");
			door.Size = new Vector3(1.2, 2.5, 0.3);
			door.CFrame = baseCFrame.mul(new CFrame(0, 1.25, 2.6));
			door.Anchored = true;
			door.Color = Color3.fromRGB(101, 67, 33);
			door.Parent = model;
		} else if (building.Type === "Road") {
			part.Size = new Vector3(37, 0.5, 3);
			part.CFrame = baseCFrame;
			part.Color = this.PlayerColor;
			part.Material = Enum.Material.Concrete;
		}

		// Ensure ALL parts of the building are in the Obstacles group and ignored by pathfinding
		for (const p of model.GetDescendants()) {
			if (p.IsA("BasePart")) {
				p.CollisionGroup = "Obstacles";
				const modifier = new Instance("PathfindingModifier");
				modifier.PassThrough = true;
				modifier.Parent = p;
			}
		}

		const folderName = building.IsTown ? "Towns" : "Buildings";
		const folder = (game.Workspace.FindFirstChild(folderName) as Folder) ?? new Instance("Folder", game.Workspace);
		folder.Name = folderName;
		model.Parent = folder;
		model.PrimaryPart = part;
		building.Model = model;

		// Set attributes on both Model and Part for easy access
		model.SetAttribute("OwnerId", building.OwnerId ?? this.Player.UserId);
		model.SetAttribute("Key", building.SnapKey);
		part.SetAttribute("Key", building.SnapKey);
		part.SetAttribute("OwnerId", building.OwnerId ?? this.Player.UserId);

		// Add owner label above the building
		// Add owner label ONLY for Towns (Roads are just colored)
		if (building.Type === "Town" || building.Type === "City") {
			const ownerBillboard = new Instance("BillboardGui");
			ownerBillboard.Name = "OwnerLabel";
			ownerBillboard.Size = new UDim2(0, 100, 0, 30);
			ownerBillboard.StudsOffset = new Vector3(0, size.Y + 2, 0);
			ownerBillboard.AlwaysOnTop = true;
			ownerBillboard.Adornee = part;
			ownerBillboard.Parent = part;

			const ownerText = new Instance("TextLabel");
			ownerText.Name = "OwnerName";
			ownerText.Size = new UDim2(1, 0, 1, 0);
			ownerText.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
			ownerText.BackgroundTransparency = 0.3;
			ownerText.TextColor3 = new Color3(1, 1, 1);
			ownerText.TextScaled = true;
			ownerText.Font = Enum.Font.GothamBold;
			ownerText.Text = this.Player.Name;
			ownerText.Parent = ownerBillboard;
		}

		return model;
	}

	GetBuildings() { return this.Buildings; }
	GetTowns() { return this.Towns; }
	GetBuildingsInProgress() { return this.BuildingInProgress; }

	private IsConnectedToRoad(vertex: BasePart, ownerId: number): boolean {
		const vertexKey = vertex.GetAttribute("Key") as string;
		if (!vertexKey) return false;

		const edgeFolder = game.Workspace.FindFirstChild("Edges");
		const buildingsFolder = game.Workspace.FindFirstChild("Buildings");
		if (!edgeFolder || !buildingsFolder) return false;

		// Find all edges touching this vertex
		for (const edge of edgeFolder.GetChildren()) {
			if (edge.IsA("BasePart")) {
				if (edge.GetAttribute("Vertex1") === vertexKey || edge.GetAttribute("Vertex2") === vertexKey) {
					const edgeKey = edge.GetAttribute("Key") as string;

					// Check if there's a road owned by the player on this edge
					for (const building of buildingsFolder.GetChildren()) {
						if (building.IsA("Model") && building.GetAttribute("Key") === edgeKey) {
							if (building.GetAttribute("OwnerId") === ownerId) {
								return true;
							}
						}
					}
				}
			}
		}

		return false;
	}

	GetScore(): number {
		let total = 0;
		for (const b of this.Buildings) {
			if (b.Completed) {
				const typeData = BuildingTypes[b.Type as keyof typeof BuildingTypes];
				const points = b.Blueprint?.Points ?? typeData?.Points ?? 0;
				total += points;
			}
		}
		return total;
	}
}

export = BuildingManager;
