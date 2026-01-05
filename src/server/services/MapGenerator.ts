import { Service, OnStart } from "@flamework/core";
const ReplicatedStorage = game.GetService("ReplicatedStorage");
import TileTypes from "shared/TileTypes";
import PortTypes, { StandardPortConfiguration, PortLocation } from "shared/PortTypes";
import * as HexMath from "shared/HexMath";
import * as Logger from "shared/Logger";
import { RobberManager } from "./RobberManager";

const PhysicsService = game.GetService("PhysicsService");
const Players = game.GetService("Players");

const HEX_SIZE = HexMath.HEX_SIZE;
const HEIGHT = HexMath.HEX_HEIGHT;

type VertexData = {
	Position: Vector3;
	AdjacentTiles: Array<{ Q: number; R: number }>;
};

type EdgeData = {
	V1: Vector3;
	V2: Vector3;
	Center: Vector3;
	AdjacentTiles: Array<{ Q: number; R: number }>;
};

@Service({})
export class MapGenerator implements OnStart {
	private PortLocations: PortLocation[] = [];
	constructor(private robberManager: RobberManager) { }
	private rng = new Random();

	onStart() {
		// Set up collision groups for resource dropping
		pcall(() => {
			PhysicsService.RegisterCollisionGroup("Resources");
			PhysicsService.RegisterCollisionGroup("TileRims");
			PhysicsService.RegisterCollisionGroup("SelectableAI");
			PhysicsService.RegisterCollisionGroup("Obstacles");

			// TileRims should only collide with Resources
			PhysicsService.CollisionGroupSetCollidable("TileRims", "Default", false);
			PhysicsService.CollisionGroupSetCollidable("TileRims", "Resources", true);
			PhysicsService.CollisionGroupSetCollidable("TileRims", "SelectableAI", false); // AI ignores rims

			// SelectableAI (AI + NPCs)
			PhysicsService.CollisionGroupSetCollidable("SelectableAI", "SelectableAI", false); // Walk through each other
			PhysicsService.CollisionGroupSetCollidable("SelectableAI", "Resources", false);    // Walk through resources
			PhysicsService.CollisionGroupSetCollidable("SelectableAI", "Obstacles", false);    // Walk through obstacles
			PhysicsService.CollisionGroupSetCollidable("SelectableAI", "Default", true);       // Walk on ground
			// Note: They will collide with players (Default) by default unless we move players to a group

			// Obstacles
			PhysicsService.CollisionGroupSetCollidable("Obstacles", "Default", true); // Players collide with obstacles
			PhysicsService.CollisionGroupSetCollidable("Obstacles", "Resources", false); // Resources pass through obstacles to land on ground
		});
	}

	private createHexagon(name: string, position: Vector3, color: Color3, material?: Enum.Material) {
		const assetRoot = ReplicatedStorage.FindFirstChild("Assets");
		const basePlateFolder = assetRoot?.FindFirstChild("BasePlate");
		const hexTemplate = basePlateFolder?.FindFirstChild("Hexagon");

		const finalModel = new Instance("Model");
		finalModel.Name = name;

		const targetPos = position.add(new Vector3(0, HEIGHT / 2, 0));
		const targetCFrame = new CFrame(targetPos);

		if (hexTemplate && (hexTemplate.IsA("BasePart") || hexTemplate.IsA("Model"))) {
			const clone = hexTemplate.Clone();
			clone.Name = "MainContent";
			clone.Parent = finalModel;

			const HEX_ASSET_TARGET_WIDTH = 92.5;

			if (clone.IsA("Model")) {
				const [size] = clone.GetBoundingBox();
				const maxDim = math.max(size.X, size.Z);
				const ratio = HEX_ASSET_TARGET_WIDTH / (maxDim || 1);

				for (const part of clone.GetDescendants()) {
					if (part.IsA("BasePart")) {
						(part as BasePart).Size = (part as BasePart).Size.mul(ratio);
						(part as BasePart).Color = color;
						if (material) (part as BasePart).Material = material;
						(part as BasePart).Anchored = true;
					}
				}
				const [cf] = clone.GetBoundingBox();
				const displacement = targetCFrame.Position.sub(cf.Position);
				clone.PivotTo(clone.GetPivot().add(displacement));
				if (clone.PrimaryPart) {
					finalModel.PrimaryPart = clone.PrimaryPart;
				} else {
					const firstPart = clone.FindFirstChildWhichIsA("BasePart") as BasePart | undefined;
					if (firstPart) finalModel.PrimaryPart = firstPart;
				}
			} else if (clone.IsA("BasePart")) {
				const maxDim = math.max(clone.Size.X, clone.Size.Z);
				const ratio = HEX_ASSET_TARGET_WIDTH / (maxDim || 1);
				clone.Size = (clone as BasePart).Size.mul(ratio);
				clone.CFrame = targetCFrame;
				clone.Color = color;
				if (material) clone.Material = material;
				clone.Anchored = true;
				finalModel.PrimaryPart = clone;
			}

			return finalModel;
		}

		// Procedural Fallback
		const rectWidth = HEX_SIZE * 2;
		const rectDepth = (HEX_SIZE * 2) / math.sqrt(3);

		for (let i = 0; i <= 2; i += 1) {
			const part = new Instance("Part");
			part.Name = `Segment_${i}`;
			part.Size = new Vector3(rectWidth, HEIGHT, rectDepth);
			part.Anchored = true;
			part.Color = color;
			part.Material = material ?? Enum.Material.SmoothPlastic;
			part.TopSurface = Enum.SurfaceType.Smooth;
			part.BottomSurface = Enum.SurfaceType.Smooth;

			part.CFrame = targetCFrame.mul(CFrame.Angles(0, math.rad(i * 60), 0));
			part.Parent = finalModel;

			if (i === 0) {
				finalModel.PrimaryPart = part;
			}
		}

		return finalModel;
	}

	private addLabel(hex: Model, text: string) {
		const billboard = new Instance("BillboardGui");
		billboard.Name = "TileLabel";
		billboard.Size = new UDim2(0, 120, 0, 50);
		billboard.StudsOffset = new Vector3(0, 10, 0);
		billboard.AlwaysOnTop = true;
		billboard.Adornee = hex.PrimaryPart;
		billboard.Parent = hex.PrimaryPart;

		const nameLabel = new Instance("TextLabel");
		nameLabel.Name = "TerrainName";
		nameLabel.Size = new UDim2(1, 0, 0.5, 0);
		nameLabel.BackgroundTransparency = 0.3;
		nameLabel.BackgroundColor3 = new Color3(0, 0, 0);
		nameLabel.TextColor3 = new Color3(1, 1, 1);
		nameLabel.TextScaled = true;
		nameLabel.Font = Enum.Font.GothamBold;
		nameLabel.Text = text;
		nameLabel.Parent = billboard;

		const diceLabel = new Instance("TextLabel");
		diceLabel.Name = "DiceNumber";
		diceLabel.Size = new UDim2(1, 0, 0.5, 0);
		diceLabel.Position = new UDim2(0, 0, 0.5, 0);
		diceLabel.BackgroundTransparency = 0.3;
		diceLabel.BackgroundColor3 = new Color3(0.2, 0.2, 0.2);
		diceLabel.TextColor3 = Color3.fromRGB(255, 200, 100);
		diceLabel.TextScaled = true;
		diceLabel.Font = Enum.Font.GothamBold;
		diceLabel.Text = "";
		diceLabel.Parent = billboard;
	}

	private addDropRim(hex: Model, position: Vector3) {
		const rimCount = 6;
		const rimHeight = 20;
		const rimThickness = 2;
		const radius = HEX_SIZE - 2; // Slightly inside to ensure it catches rolls

		const rimFolder = new Instance("Folder");
		rimFolder.Name = "PhysicsBorders";
		rimFolder.Parent = hex;

		for (let i = 0; i < rimCount; i++) {
			const angle = (math.pi / 3) * i + (math.pi / 6);
			const nextAngle = (math.pi / 3) * (i + 1) + (math.pi / 6);

			const p1 = new Vector3(math.cos(angle) * radius, 0, math.sin(angle) * radius);
			const p2 = new Vector3(math.cos(nextAngle) * radius, 0, math.sin(nextAngle) * radius);

			const midPoint = p1.add(p2).div(2);
			const dist = p1.sub(p2).Magnitude;

			const rim = new Instance("Part");
			rim.Name = "TileRim";
			rim.Size = new Vector3(rimThickness, rimHeight, dist);
			rim.CFrame = CFrame.lookAt(position.add(midPoint).add(new Vector3(0, rimHeight / 2 + HEIGHT, 0)), position.add(p2).add(new Vector3(0, rimHeight / 2 + HEIGHT, 0)));
			rim.Transparency = 1;
			rim.Anchored = true;
			rim.CanCollide = true;
			rim.CollisionGroup = "TileRims";
			rim.Parent = rimFolder;
		}
	}

	private createExactTilePool() {
		const pool = new Array<string>();
		const tiles = TileTypes as unknown as Record<string, unknown>;
		for (const [key, data] of pairs(tiles)) {
			const t = data as import("shared/TileTypes").TileInfo;
			for (let i = 1; i <= t.Frequency; i += 1) {
				pool.push(key as string);
			}
		}

		for (let i = pool.size(); i >= 2; i -= 1) {
			const j = math.random(1, i);
			const swapIndex = j - 1;
			const currentIndex = i - 1;
			const temp = pool[currentIndex];
			pool[currentIndex] = pool[swapIndex];
			pool[swapIndex] = temp;
		}

		return pool;
	}

	public axialToWorld(q: number, r: number) {
		const pos = HexMath.axialToWorld(q, r, HEX_SIZE);
		return new Vector3(pos.x, 0, pos.z);
	}

	public Generate(rings = 2) {
		const lobbyFolder = game.Workspace.FindFirstChild("Lobby");
		if (lobbyFolder) lobbyFolder.Destroy();

		const mapFolder = (game.Workspace.FindFirstChild("Map") as Folder) ?? new Instance("Folder", game.Workspace);
		mapFolder.Name = "Map";
		mapFolder.ClearAllChildren();

		const tilePool = this.createExactTilePool();
		let tileIndex = 0;

		const assetPack = ReplicatedStorage.FindFirstChild("Assets");
		const baseY = HEIGHT;

		const placeAsset = (assetPath: string, parent: Instance, position: Vector3, scale = 1) => {
			if (!assetPack) return undefined;

			let asset: Instance | undefined;

			// 1. Try exact path
			let current: Instance | undefined = assetPack;
			for (const pathPart of string.split(assetPath, "/")) {
				current = current?.FindFirstChild(pathPart);
			}
			asset = current;

			// 2. Fallback: Try swapping "Trees" <-> "Tree" in the folder name only
			if (!asset) {
				const parts = string.split(assetPath, "/");
				if (parts.size() >= 2) {
					const folderName = parts[0];
					const fileName = parts[parts.size() - 1];

					let fallbackFolder: string | undefined;
					if (folderName === "Trees") fallbackFolder = "Tree";
					else if (folderName === "Tree") fallbackFolder = "Trees";

					if (fallbackFolder) {
						const currentFolder = assetPack.FindFirstChild(fallbackFolder);
						asset = currentFolder?.FindFirstChild(fileName);
					}
				}

				// Final check: Just look for the file name directly in Assets if still not found
				if (!asset) {
					const parts = string.split(assetPath, "/");
					const fileName = parts[parts.size() - 1];
					asset = assetPack.FindFirstChild(fileName);
				}
			}

			if (asset && (asset.IsA("Model") || asset.IsA("BasePart"))) {
				const clone = asset.Clone();

				// IMMEDIATELY anchor all parts after cloning - before physics can ever touch them
				// This is critical: physics evaluates on the next frame after parenting,
				// so we must anchor before ANY other operations
				const anchorAllParts = (obj: Instance, canCollide = false, isObstacleAsset = false) => {
					if (obj.IsA("BasePart")) {
						obj.Anchored = true;
						obj.CanCollide = canCollide;
						if (isObstacleAsset) obj.CollisionGroup = "Obstacles";
					}
					for (const child of obj.GetDescendants()) {
						if (child.IsA("BasePart")) {
							(child as BasePart).Anchored = true;
							(child as BasePart).CanCollide = canCollide;
							if (isObstacleAsset) (child as BasePart).CollisionGroup = "Obstacles";
						}
					}
				};

				const isObstacle = string.find(assetPath, "Tree")[0] !== undefined ||
					string.find(assetPath, "Rock")[0] !== undefined ||
					string.find(assetPath, "Hill")[0] !== undefined;

				// Anchor immediately after clone
				anchorAllParts(clone, isObstacle, isObstacle);

				if (isObstacle) {
					for (const p of clone.GetDescendants()) {
						if (p.IsA("BasePart")) {
							const modifier = new Instance("PathfindingModifier");
							modifier.PassThrough = true;
							modifier.Parent = p;
						}
					}
					if (clone.IsA("BasePart")) {
						const modifier = new Instance("PathfindingModifier");
						modifier.PassThrough = true;
						modifier.Parent = clone;
					}
				}

				// Now scale and position (parts are already anchored, so no physics issues)
				if (clone.IsA("Model")) {
					if ("ScaleTo" in clone) {
						(clone as unknown as { ScaleTo(scale: number): void }).ScaleTo(scale);
					} else {
						const modelClone = clone as Model;
						const pivot = modelClone.GetPivot();
						for (const part of modelClone.GetDescendants()) {
							if (part.IsA("BasePart")) {
								const p = part as BasePart;
								p.Size = p.Size.mul(scale);
								const offset = p.Position.sub(pivot.Position).mul(scale);
								p.Position = pivot.Position.add(offset);
							}
						}
					}

					// Robust placement: Move the model so its bottom bounding box face is at position.Y
					const currentPivot = clone.GetPivot();
					const [cf, size] = clone.GetBoundingBox();
					const bottomY = cf.Position.Y - size.Y / 2;
					const yOffset = position.Y - bottomY;

					// Calculate displacement needed to move the bottom to position.Y and center horizontally
					const displacement = new Vector3(
						position.X - cf.Position.X,
						yOffset,
						position.Z - cf.Position.Z
					);
					clone.PivotTo(currentPivot.add(displacement));
				} else if (clone.IsA("BasePart")) {
					clone.Size = clone.Size.mul(scale);
					const yOffset = clone.Size.Y / 2;
					// Preserve rotation when positioning
					const rotation = clone.CFrame.Rotation;
					clone.CFrame = new CFrame(position.X, position.Y + yOffset, position.Z).mul(rotation);
				}

				// Parent to workspace (already anchored, so safe)
				clone.Parent = parent;

				// Final safety pass - re-anchor everything just in case ScaleTo or other operations reset anything
				anchorAllParts(clone, isObstacle, isObstacle);

				return clone;
			} else {
				Logger.Warn("MapGenerator", `Asset not found: ${assetPath}`);
				return undefined;
			}
		};

		for (let q = -rings; q <= rings; q += 1) {
			const r1 = math.max(-rings, -q - rings);
			const r2 = math.min(rings, -q + rings);

			for (let r = r1; r <= r2; r += 1) {
				const worldPos = this.axialToWorld(q, r);
				const typeKey = tilePool[tileIndex] ?? "Desert";
				const tileData = TileTypes[typeKey];

				let material: Enum.Material = Enum.Material.Grass;
				if (tileData.Name === "Mountains") material = Enum.Material.Slate;
				else if (tileData.Name === "Desert") material = Enum.Material.Sand;
				else if (tileData.Name === "Hills") material = Enum.Material.Ground;

				const hex = this.createHexagon(`Tile_${q}_${r}`, worldPos, tileData.Color, material);
				hex.Parent = mapFolder;
				this.addLabel(hex as Model, tileData.Name);
				if (tileData.Name !== "Desert") {
					this.addDropRim(hex as Model, worldPos);
				}

				if (hex.PrimaryPart) {
					hex.PrimaryPart.SetAttribute("TileType", tileData.Name);
					hex.PrimaryPart.SetAttribute("Resource", tileData.Resource ?? "");
					hex.PrimaryPart.SetAttribute("Q", q);
					hex.PrimaryPart.SetAttribute("R", r);
				}

				if (tileData.Name === "Forest") {
					const treePositions: Vector3[] = [];
					const numTrees = this.rng.NextInteger(1, 2);
					for (let i = 1; i <= numTrees; i += 1) {
						let pos = worldPos;
						let tooClose = true;
						let attempts = 0;

						while (tooClose && attempts < 10) {
							const angle = math.rad(this.rng.NextNumber(0, 360));
							const dist = this.rng.NextNumber(12, 30);
							pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));

							tooClose = false;
							for (const otherPos of treePositions) {
								if (pos.sub(otherPos).Magnitude < 18) {
									tooClose = true;
									break;
								}
							}
							attempts++;
						}

						treePositions.push(pos);
						const treeIndex = this.rng.NextInteger(1, 4);
						// Tree2 is uniquely huge in the source assets compared to others
						const treeScale = (treeIndex === 2) ? 0.02 : 1;

						const tree = placeAsset(`Trees/Tree${treeIndex}`, hex, pos, treeScale);
						if (tree && tree.IsA("Model")) {
							tree.PivotTo(tree.GetPivot().mul(CFrame.Angles(0, math.rad(this.rng.NextNumber(0, 360)), 0)));
						}
					}
				} else if (tileData.Name === "Fields") {
					for (let i = 1; i <= math.random(12, 20); i += 1) {
						const angle = math.rad(math.random(0, 360));
						const dist = math.random(5, 25);
						const pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));
						placeAsset("Grass/Grass", hex, pos, 1.0);
					}
				} else if (tileData.Name === "Pasture") {
					for (let i = 1; i <= this.rng.NextInteger(4, 8); i += 1) {
						const angle = math.rad(this.rng.NextNumber(0, 360));
						const dist = this.rng.NextNumber(5, 25);
						const pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));
						const sheep = placeAsset("Animals/Sheep", hex, pos, 0.65);
						if (sheep && sheep.IsA("PVInstance")) {
							// Give the sheep a random rotation so they aren't all facing the same way
							const randomRotation = CFrame.Angles(0, math.rad(this.rng.NextNumber(0, 360)), 0);
							sheep.PivotTo(sheep.GetPivot().mul(randomRotation));
						}
					}
				}
				else if (tileData.Name === "Desert") {
					if (hex.PrimaryPart) {
						this.robberManager.SetDesertLocation(q, r, hex.PrimaryPart.Position);
					}
				}
				else if (tileData.Name === "Hills") {
					for (let i = 1; i <= math.random(1, 3); i += 1) {
						const angle = math.rad(math.random(0, 360));
						const dist = math.random(5, 18);
						const pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));
						placeAsset("Hill/Hill1", hex, pos, 0.67);
					}
				} else if (tileData.Name === "Mountains") {
					for (let i = 1; i <= math.random(2, 4); i += 1) {
						const angle = math.rad(math.random(0, 360));
						const dist = math.random(0, 20);
						const pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));
						placeAsset(`Rocks/Rock${math.random(1, 4)}`, hex, pos, 2.5);
					}
				}

				tileIndex += 1;
			}
		}

		// Create two rings of sea tiles outside the game map
		const seaTileData = TileTypes["Sea"];
		let seaTileCount = 0;
		for (let seaRing = 1; seaRing <= 2; seaRing++) {
			const currentRing = rings + seaRing;
			for (let q = -currentRing; q <= currentRing; q += 1) {
				const r1 = math.max(-currentRing, -q - currentRing);
				const r2 = math.min(currentRing, -q + currentRing);

				for (let r = r1; r <= r2; r += 1) {
					// Skip tiles that are inside the game map
					const distFromCenter = math.max(math.abs(q), math.abs(r), math.abs(-q - r));
					if (distFromCenter <= rings) continue;

					const worldPos = this.axialToWorld(q, r);
					const seaPos = worldPos.add(new Vector3(0, -1, 0)); // Lowered slightly

					// First ring around island is lighter blue
					const col = seaRing === 1 ? Color3.fromHex("#4DA6FF") : seaTileData.Color;
					const hex = this.createHexagon(`Sea_${q}_${r}`, seaPos, col, Enum.Material.Water);
					hex.Parent = mapFolder;
					seaTileCount += 1;

					if (hex.PrimaryPart) {
						hex.PrimaryPart.SetAttribute("TileType", seaTileData.Name);
						hex.PrimaryPart.SetAttribute("Resource", "");
						hex.PrimaryPart.SetAttribute("Q", q);
						hex.PrimaryPart.SetAttribute("R", r);
						hex.PrimaryPart.SetAttribute("IsSea", true);
					}
				}
			}
		}
		Logger.Info("MapGenerator", `Created ${seaTileCount} sea tiles in ${2} outer rings.`);

		this.CreateVerticesAndEdges(mapFolder);
		this.CreatePorts();
	}

	private CreateVerticesAndEdges(mapFolder: Folder) {
		const vertices: Record<string, VertexData> = {};
		const vertexFolder = (game.Workspace.FindFirstChild("Vertices") as Folder) ?? new Instance("Folder", game.Workspace);
		vertexFolder.Name = "Vertices";
		vertexFolder.ClearAllChildren();

		const edgeFolder = (game.Workspace.FindFirstChild("Edges") as Folder) ?? new Instance("Folder", game.Workspace);
		edgeFolder.Name = "Edges";
		edgeFolder.ClearAllChildren();

		const edges: Record<string, EdgeData> = {};

		for (const tile of mapFolder.GetChildren()) {
			if (tile.IsA("Model") && tile.PrimaryPart) {
				const center = tile.PrimaryPart.Position;
				const q = tile.PrimaryPart.GetAttribute("Q") as number;
				const r = tile.PrimaryPart.GetAttribute("R") as number;
				const isSea = tile.PrimaryPart.GetAttribute("IsSea") === true;

				const tileVertexKeys = new Array<string>();
				const verticesArr = HexMath.getHexVertices(center.X, center.Z, HEX_SIZE);
				for (let i = 0; i < 6; i += 1) {
					const vx = verticesArr[i].x;
					const vz = verticesArr[i].z;
					const key = HexMath.makeVertexKey(vx, vz);
					tileVertexKeys.push(key);

					if (!vertices[key]) {
						vertices[key] = {
							Position: new Vector3(vx, HEIGHT + 0.5, vz),
							AdjacentTiles: [],
						};
					}
					vertices[key].AdjacentTiles.push({ Q: q, R: r });
				}

				for (let i = 0; i <= 5; i += 1) {
					const key1 = tileVertexKeys[i];
					const key2 = tileVertexKeys[(i + 1) % 6];
					const eKey = key1 < key2 ? `${key1}:${key2}` : `${key2}:${key1}`;

					if (!edges[eKey]) {
						const v1 = vertices[key1].Position;
						const v2 = vertices[key2].Position;
						edges[eKey] = {
							V1: v1,
							V2: v2,
							Center: v1.add(v2).div(2),
							AdjacentTiles: [],
						};
					}
					edges[eKey].AdjacentTiles.push({ Q: q, R: r });
				}
			}
		}

		const vertexNeighbors: Record<string, string[]> = {};
		for (const [key] of pairs(edges)) {
			const vKeyParts = string.split(key, ":");
			const v1Key = vKeyParts[0];
			const v2Key = vKeyParts[1];
			if (!v1Key || !v2Key) continue;
			vertexNeighbors[v1Key] = vertexNeighbors[v1Key] ?? [];
			vertexNeighbors[v1Key].push(v2Key);
			vertexNeighbors[v2Key] = vertexNeighbors[v2Key] ?? [];
			vertexNeighbors[v2Key].push(v1Key);
		}

		let vertexId = 1;
		for (const [key, data] of pairs(vertices)) {
			const marker = new Instance("Part");
			marker.Name = `Vertex_${vertexId}`;
			marker.Shape = Enum.PartType.Ball;
			marker.Size = new Vector3(3, 3, 3);
			marker.Position = data.Position;
			marker.Anchored = true;
			marker.CanCollide = false;
			marker.Transparency = 1;
			marker.Parent = vertexFolder;
			marker.SetAttribute("VertexId", vertexId);
			marker.SetAttribute("Key", key);
			marker.SetAttribute("AdjacentTileCount", data.AdjacentTiles.size());

			// Count ONLY land tiles
			let landTileCount = 0;
			for (const tile of data.AdjacentTiles) {
				const tileObj = mapFolder.FindFirstChild(`Tile_${tile.Q}_${tile.R}`);
				if (tileObj) landTileCount += 1;
			}
			marker.SetAttribute("AdjacentLandTileCount", landTileCount);


			for (let i = 0; i < data.AdjacentTiles.size(); i += 1) {
				const tile = data.AdjacentTiles[i];
				marker.SetAttribute(`Tile${i + 1}Q`, tile.Q);
				marker.SetAttribute(`Tile${i + 1}R`, tile.R);
			}

			const neighbors = vertexNeighbors[key] ?? [];
			for (let i = 0; i < neighbors.size(); i += 1) {
				marker.SetAttribute(`Neighbor_${i + 1}`, neighbors[i]);
			}
			vertexId += 1;
		}

		let edgeId = 1;
		for (const [key, data] of pairs(edges)) {
			const marker = new Instance("Part");
			marker.Name = `Edge_${edgeId}`;
			marker.Size = new Vector3(37, 1, 3);
			marker.Position = data.Center;
			marker.Anchored = true;
			marker.CanCollide = false;
			marker.Transparency = 1;
			marker.CFrame = CFrame.lookAt(data.Center, data.V1).mul(CFrame.Angles(0, math.rad(90), 0));
			marker.Parent = edgeFolder;
			marker.SetAttribute("EdgeId", edgeId);
			marker.SetAttribute("Key", key);
			const vKeys = string.split(key, ":");
			marker.SetAttribute("Vertex1", vKeys[0]);
			marker.SetAttribute("Vertex2", vKeys[1]);
			marker.SetAttribute("AdjacentTileCount", data.AdjacentTiles.size());

			// Count ONLY land tiles to identify coastal edges for ports
			let landTileCount = 0;
			for (const tile of data.AdjacentTiles) {
				const tileObj = mapFolder.FindFirstChild(`Tile_${tile.Q}_${tile.R}`);
				if (tileObj) landTileCount += 1;
			}
			marker.SetAttribute("AdjacentLandTileCount", landTileCount);

			edgeId += 1;
		}
	}

	private CreatePorts() {
		const edgeFolder = game.Workspace.FindFirstChild("Edges");
		const vertexFolder = game.Workspace.FindFirstChild("Vertices");
		const mapFolder = game.Workspace.FindFirstChild("Map") as Folder;
		if (!edgeFolder || !vertexFolder || !mapFolder) return;

		const portFolder = (game.Workspace.FindFirstChild("Ports") as Folder) ?? new Instance("Folder", game.Workspace);
		portFolder.Name = "Ports";
		portFolder.ClearAllChildren();

		const vertexMap = new Map<string, BasePart>();
		for (const v of vertexFolder.GetChildren()) {
			if (v.IsA("BasePart")) {
				const key = v.GetAttribute("Key") as string;
				if (key) vertexMap.set(key, v);
			}
		}

		const coastalEdges: BasePart[] = [];
		for (const edge of edgeFolder.GetChildren()) {
			if (edge.IsA("BasePart")) {
				// A coastal edge is one with exactly one LAND tile neighbor
				const landTileCount = edge.GetAttribute("AdjacentLandTileCount") as number;
				if (landTileCount === 1) {
					coastalEdges.push(edge);
				}
			}
		}

		const MAX_ATTEMPTS = 50;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
			for (let i = coastalEdges.size(); i >= 2; i -= 1) {
				const j = math.random(1, i);
				const temp = coastalEdges[i - 1];
				coastalEdges[i - 1] = coastalEdges[j - 1];
				coastalEdges[j - 1] = temp;
			}

			this.PortLocations = [];
			const forbiddenVertices = new Set<string>();

			for (const edge of coastalEdges) {
				if (this.PortLocations.size() >= StandardPortConfiguration.size()) break;
				const v1Key = edge.GetAttribute("Vertex1") as string;
				const v2Key = edge.GetAttribute("Vertex2") as string;
				if (!v1Key || !v2Key || forbiddenVertices.has(v1Key) || forbiddenVertices.has(v2Key)) continue;

				const v1Part = vertexMap.get(v1Key);
				const v2Part = vertexMap.get(v2Key);
				if (!v1Part || !v2Part) continue;

				if (((v1Part.GetAttribute("AdjacentTileCount") as number) ?? 0) < 2 && ((v2Part.GetAttribute("AdjacentTileCount") as number) ?? 0) < 2) continue;

				const portType = StandardPortConfiguration[this.PortLocations.size()];
				this.PortLocations.push({
					PortType: portType,
					Position: edge.Position,
					Vertices: [v1Part.Position, v2Part.Position] as [Vector3, Vector3],
				} as unknown as PortLocation);

				forbiddenVertices.add(v1Key);
				forbiddenVertices.add(v2Key);
				for (let n = 1; n <= 3; n += 1) {
					const neighbor = v1Part.GetAttribute(`Neighbor_${n}`) as string;
					if (neighbor) forbiddenVertices.add(neighbor);
					const neighbor2 = v2Part.GetAttribute(`Neighbor_${n}`) as string;
					if (neighbor2) forbiddenVertices.add(neighbor2);
				}
			}

			if (this.PortLocations.size() === StandardPortConfiguration.size()) break;
		}

		for (const port of this.PortLocations) {
			const portInfo = PortTypes[port.PortType];
			const portMarker = new Instance("Part");
			portMarker.Name = `Port_${port.PortType}`;
			portMarker.Size = new Vector3(8, 6, 8);
			portMarker.Position = port.Position.add(new Vector3(0, 3, 0));
			portMarker.Anchored = true;
			portMarker.Color = portInfo.Color;
			portMarker.Material = Enum.Material.Neon;
			portMarker.Transparency = 0.3;
			portMarker.Parent = portFolder;

			const billboard = new Instance("BillboardGui");
			billboard.Name = "PortLabel";
			billboard.Size = new UDim2(0, 60, 0, 60);
			billboard.StudsOffset = new Vector3(0, 4, 0);
			billboard.AlwaysOnTop = true;
			billboard.Adornee = portMarker;
			billboard.Parent = portMarker;

			const label = new Instance("TextLabel");
			label.Size = new UDim2(1, 0, 1, 0);
			label.BackgroundColor3 = new Color3(0, 0, 0);
			label.BackgroundTransparency = 0.3;
			label.TextColor3 = new Color3(1, 1, 1);
			label.TextScaled = true;
			label.Font = Enum.Font.GothamBold;
			label.Text = `${portInfo.Icon}\n${portInfo.TradeRatio}:1`;
			label.Parent = billboard;
		}
	}

	public GetPortLocations(): PortLocation[] {
		return this.PortLocations;
	}

	public FindNearestVertex(position: Vector3): [BasePart | undefined, number] {
		const vertexFolder = game.Workspace.FindFirstChild("Vertices");
		if (!vertexFolder) return [undefined, math.huge];

		let closestVertex: BasePart | undefined;
		let closestDist = math.huge;

		for (const vertex of vertexFolder.GetChildren()) {
			if (vertex.IsA("BasePart")) {
				const dist = vertex.Position.sub(position).Magnitude;
				if (dist < closestDist) {
					closestDist = dist;
					closestVertex = vertex;
				}
			}
		}

		return [closestVertex, closestDist];
	}

	public GetRandomVertex(): BasePart | undefined {
		const vertexFolder = game.Workspace.FindFirstChild("Vertices");
		if (!vertexFolder) return undefined;

		const children = vertexFolder.GetChildren();
		if (children.size() === 0) return undefined;

		const randomIdx = math.random(1, children.size()) - 1;
		return children[randomIdx] as BasePart;
	}

	public GetRandomEdge(): BasePart | undefined {
		const edgeFolder = game.Workspace.FindFirstChild("Edges");
		if (!edgeFolder) return undefined;

		const children = edgeFolder.GetChildren();
		if (children.size() === 0) return undefined;

		const randomIdx = math.random(1, children.size()) - 1;
		return children[randomIdx] as BasePart;
	}

	public FindNearestEdge(position: Vector3): [BasePart | undefined, number] {
		const edgeFolder = game.Workspace.FindFirstChild("Edges");
		if (!edgeFolder) return [undefined, math.huge];

		let closestEdge: BasePart | undefined;
		let closestDist = math.huge;

		for (const edge of edgeFolder.GetChildren()) {
			if (edge.IsA("BasePart")) {
				const dist = edge.Position.sub(position).Magnitude;
				if (dist < closestDist) {
					closestDist = dist;
					closestEdge = edge;
				}
			}
		}

		return [closestEdge, closestDist];
	}

	public FindVertexById(id: string): BasePart | undefined {
		const vertexFolder = game.Workspace.FindFirstChild("Vertices");
		if (!vertexFolder) return undefined;

		// Case-insensitive search
		for (const child of vertexFolder.GetChildren()) {
			if (child.Name.lower() === id.lower()) {
				return child as BasePart;
			}
		}

		return vertexFolder.FindFirstChild(id) as BasePart;
	}

	public GetAdjacentTilesToVertex(vertex: BasePart): Model[] {
		const tiles: Model[] = [];
		const mapFolder = game.Workspace.FindFirstChild("Map");
		if (!mapFolder) return tiles;

		const adjCount = (vertex.GetAttribute("AdjacentTileCount") as number) ?? 0;
		for (let i = 1; i <= adjCount; i++) {
			const q = vertex.GetAttribute(`Tile${i}Q`) as number;
			const r = vertex.GetAttribute(`Tile${i}R`) as number;
			const tile = mapFolder.FindFirstChild(`Tile_${q}_${r}`);
			if (tile && tile.IsA("Model")) {
				tiles.push(tile);
			}
		}
		return tiles;
	}
}
