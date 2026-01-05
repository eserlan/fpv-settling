import { Service } from "@flamework/core";
import { MapGenerator } from "./MapGenerator";
import { TileOwnershipManager } from "./TileOwnershipManager";
import { BuildingVisualsService } from "./BuildingVisualsService";

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const HttpService = game.GetService("HttpService");
import BuildingTypes from "shared/BuildingTypes";
import { ServerEvents } from "../ServerEvents";
import * as Logger from "shared/Logger";
import Blueprints from "shared/Blueprints";
import type { GameEntity } from "shared/GameEntity";
import { NetworkUtils } from "../NetworkUtils";
import { ServerGameState } from "./ServerGameState";
import { validateTownPlacement, validateRoadPlacement, validateCityPlacement } from "shared/lib/GameRules";
import { BuildingRecord } from "shared/GameTypes";
import type { PlayerData } from "../PlayerData";

@Service({})
export class BuildingManager {
	constructor(
		private mapGenerator: MapGenerator,
		private tileOwnershipManager: TileOwnershipManager,
		private serverGameState: ServerGameState,
		private buildingVisualsService: BuildingVisualsService,
	) { }

	StartBuilding(playerData: PlayerData, buildingType: string, position: Vector3, isFree = false): LuaTuple<[boolean, any]> {
		const buildingTypeData = BuildingTypes[buildingType];
		if (!buildingTypeData) return $tuple(false, "Invalid building type");

		let finalPosition = position;
		let finalRotation: Vector3 | undefined;
		let snapKey: string | undefined;

		if (buildingTypeData.IsTown) {
			const [nearestVertex, dist] = this.mapGenerator.FindNearestVertex(position);
			if (nearestVertex && dist < 15) {
				const vertexKey = nearestVertex.GetAttribute("Key") as string;

				if (buildingTypeData.RequiresTown) {
					// City Upgrade Check
					const validation = validateCityPlacement(this.serverGameState, playerData.Player.UserId, vertexKey);
					if (!validation.valid) return $tuple(false, validation.reason ?? "Invalid city placement");
				} else {
					// Town Placement Check
					const validation = validateTownPlacement(this.serverGameState, playerData.Player.UserId, vertexKey, false, playerData.NeedsFirstTown === false);
					if (!validation.valid) return $tuple(false, validation.reason ?? "Invalid town placement");
				}

				snapKey = vertexKey;
				finalPosition = nearestVertex.Position;
			}
		} else if (buildingTypeData.IsRoad) {
			const [nearestEdge, dist] = this.mapGenerator.FindNearestEdge(position);
			if (nearestEdge && dist < 20) {
				const edgeKey = nearestEdge.GetAttribute("Key") as string;

				const validation = validateRoadPlacement(this.serverGameState, playerData.Player.UserId, edgeKey, false);
				if (!validation.valid) return $tuple(false, validation.reason ?? "Invalid road placement");

				snapKey = edgeKey;
				finalPosition = nearestEdge.Position;
				const [rx, ry, rz] = nearestEdge.CFrame.ToEulerAnglesXYZ();
				finalRotation = new Vector3(math.deg(rx), math.deg(ry), math.deg(rz));
			} else {
				return $tuple(false, "Could not find valid edge for road");
			}
		}

		// Always check and deduct resources (unless free)
		if (!isFree) {
			if (!playerData.ResourceManager.HasResources(buildingTypeData.Cost)) {
				Logger.Warn("BuildingManager", `${playerData.Player.Name} doesn't have resources for ${buildingType}`);
				return $tuple(false, "Not enough resources");
			}
			Logger.Info("BuildingManager", `${playerData.Player.Name} paying for ${buildingType}: ${HttpService.JSONEncode(buildingTypeData.Cost)}`);
			for (const [resourceType, amount] of pairs(buildingTypeData.Cost)) {
				playerData.ResourceManager.RemoveResource(resourceType, amount);
			}
		}

		const buildingId = playerData.Buildings.size() + 1;
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
			OwnerId: playerData.Player.UserId,
			SnapKey: snapKey,
		};

		if (buildingTypeData.BuildTime === 0) {
			building.Completed = true;
			playerData.Buildings.push(building);
			this.OnBuildingComplete(playerData, building);
		} else {
			playerData.BuildingsInProgress.push(building);
			NetworkUtils.FireClient(playerData.Player, ServerEvents.ConstructionStarted, buildingId, buildingType, finalPosition);
		}

		if (buildingTypeData.IsTown && playerData.NeedsFirstTown) {
			playerData.NeedsFirstTown = false;
		}
		return $tuple(true, buildingId);
	}

	PlaceFoundation(playerData: PlayerData, blueprintName: string, position: Vector3, rotation?: Vector3, snapKey?: string) {
		const blueprint = Blueprints.Buildings[blueprintName];
		if (!blueprint) return $tuple(false, "Invalid blueprint");

		const foundationId = playerData.Buildings.size() + 1;
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
			OwnerId: playerData.Player.UserId,
		};

		if (blueprint.PlacementType === "edge" && snapKey) {
			const validation = validateRoadPlacement(this.serverGameState, playerData.Player.UserId, snapKey, false);
			if (!validation.valid) return $tuple(false, validation.reason ?? "Invalid road placement");
		} else if (blueprint.PlacementType === "3-way") {
			const [nearestVertex, dist] = this.mapGenerator.FindNearestVertex(position);
			if (nearestVertex) {
				const vertexKey = nearestVertex.GetAttribute("Key") as string;
				const validation = validateTownPlacement(this.serverGameState, playerData.Player.UserId, vertexKey, false, playerData.NeedsFirstTown === false);
				// Lenient check for generic 3-ways for now, mostly relying on land check
				const landCount = (nearestVertex.GetAttribute("AdjacentLandTileCount") as number) ?? 0;
				if (landCount === 0) return $tuple(false, "Cannot build in the open sea!");
			}
		}

		if (foundation.IsTown) {
			const [nearestVertex, dist] = this.mapGenerator.FindNearestVertex(position);
			if (nearestVertex && dist < 15) {
				const vertexKey = nearestVertex.GetAttribute("Key") as string;
				const validation = validateTownPlacement(this.serverGameState, playerData.Player.UserId, vertexKey, false, playerData.NeedsFirstTown === false);
				if (!validation.valid) return $tuple(false, validation.reason ?? "Invalid town placement");

				foundation.Position = nearestVertex.Position;
			}
		}

		for (const [resource, amount] of pairs(blueprint.Cost)) {
			foundation.RequiredResources![resource] = amount;
			foundation.DepositedResources![resource] = 0;
		}

		this.buildingVisualsService.CreateFoundationModel(playerData, foundation);
		playerData.Buildings.push(foundation);
		// Note: We don't have a FoundationsById map on PlayerData, we just iterate Buildings for now or add it if slowness
		// For simplicity, iterating Buildings to find foundation is O(N) but N is small.

		if (blueprintName === "Town" && playerData.NeedsFirstTown) playerData.NeedsFirstTown = false;
		NetworkUtils.FireClient(playerData.Player, ServerEvents.FoundationPlaced, foundationId, blueprintName, position, foundation.RequiredResources ?? {});
		return $tuple(true, foundationId);
	}

	DepositResource(playerData: PlayerData, foundationId: number, resourceType: string) {
		const foundation = playerData.Buildings.find(b => b.Id === foundationId && !!b.IsFoundation);
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
		this.buildingVisualsService.UpdateFoundationVisual(foundation);

		if (foundation.Progress >= 1) {
			foundation.Completed = true;
			this.OnBuildingComplete(playerData, foundation);
		}

		NetworkUtils.FireClient(playerData.Player, ServerEvents.ResourceDeposited, foundationId, resourceType, foundation.Progress);
		return $tuple(true, "");
	}





	UpdateBuildings(playerData: PlayerData, deltaTime: number) {
		for (let i = playerData.BuildingsInProgress.size(); i >= 1; i -= 1) {
			const building = playerData.BuildingsInProgress[i - 1];
			building.Progress += deltaTime;
			if (building.Progress >= (building.BuildTime ?? 0)) {
				building.Completed = true;
				playerData.Buildings.push(building);
				playerData.BuildingsInProgress.remove(i - 1);
				this.OnBuildingComplete(playerData, building);
			}
		}
	}

	OnBuildingComplete(playerData: PlayerData, building: BuildingRecord) {
		this.buildingVisualsService.DestroyBuildingModel(building);
		Logger.Info("BuildingManager", `[${playerData.Player.Name}] Completed building ${building.Type} (ID: ${building.Id})`);
		this.buildingVisualsService.CreateBuildingModel(playerData, building);
		if (building.IsTown) {
			// If this is a City, replace the old Town record
			if (building.Type === "City") {
				const existingIndex = playerData.Towns.findIndex(t => t.SnapKey === building.SnapKey && t.Type === "Town");
				if (existingIndex !== -1) {
					const oldTown = playerData.Towns[existingIndex];
					if (oldTown.Model) oldTown.Model.Destroy();
					playerData.Towns.remove(existingIndex);

					// Also remove from general buildings list
					const bIndex = playerData.Buildings.findIndex(b => b.SnapKey === building.SnapKey && b.Type === "Town");
					if (bIndex !== -1) playerData.Buildings.remove(bIndex);

					if (building.SnapKey) {
						this.serverGameState.RemoveBuilding(building.SnapKey);
					}
				}

				// Also must remove the physical Town from workspace
				const folder = game.Workspace.FindFirstChild("Towns");
				if (folder) {
					for (const s of folder.GetChildren()) {
						if (s.IsA("Model") && s.GetAttribute("Key") === building.SnapKey) {
							if (s.Name.lower().find("city")[0] === undefined) {
								s.Destroy();
							}
						}
					}
				}
			}

			const townId = `${playerData.Player.UserId}_${building.Id}`;
			const claimedTiles = this.tileOwnershipManager.ClaimTilesNearTown(playerData.Player, building.Position, townId);
			playerData.Towns.push(building);
			playerData.PortManager.ClaimPort(building.Position, townId);
		}

		if (building.SnapKey) {
			this.serverGameState.RegisterBuilding({
				Id: building.Id,
				OwnerId: playerData.Player.UserId,
				Type: building.Type as "Town" | "City" | "Road",
				Key: building.SnapKey,
				Position: building.Position
			});
		}

		NetworkUtils.FireClient(playerData.Player, ServerEvents.ConstructionCompleted, building.Id, building.Type);
	}



	GetScore(playerData: PlayerData): number {
		let total = 0;
		for (const b of playerData.Buildings) {
			if (b.Completed) {
				const typeData = BuildingTypes[b.Type as keyof typeof BuildingTypes];
				const points = b.Blueprint?.Points ?? typeData?.Points ?? 0;
				total += points;
			}
		}
		return total;
	}
}


