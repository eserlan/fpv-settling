// HEXAGONAL MAP GENERATOR (Catan-Style with Exact Frequencies)
const ReplicatedStorage = game.GetService("ReplicatedStorage");
import TileTypes from "shared/TileTypes";
import PortTypes, { StandardPortConfiguration, PortLocation } from "shared/PortTypes";

const HEX_SIZE = 40; // Radius: center to corner
const HEIGHT = 4;

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

const createHexagon = (name: string, position: Vector3, color: Color3, material?: Enum.Material) => {
	const model = new Instance("Model");
	model.Name = name;

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

		part.CFrame = new CFrame(position.add(new Vector3(0, HEIGHT / 2, 0))).mul(CFrame.Angles(0, math.rad(i * 60), 0));
		part.Parent = model;

		if (i === 0) {
			model.PrimaryPart = part;
		}
	}

	return model;
};

// Add a label above the hex (includes dice number if available)
const addLabel = (hex: Model, text: string) => {
	const billboard = new Instance("BillboardGui");
	billboard.Name = "TileLabel";
	billboard.Size = new UDim2(0, 120, 0, 50);
	billboard.StudsOffset = new Vector3(0, 10, 0);
	billboard.AlwaysOnTop = true;
	billboard.Adornee = hex.PrimaryPart;
	billboard.Parent = hex.PrimaryPart;

	// Terrain name
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

	// Dice number (will be updated after assignment)
	const diceLabel = new Instance("TextLabel");
	diceLabel.Name = "DiceNumber";
	diceLabel.Size = new UDim2(1, 0, 0.5, 0);
	diceLabel.Position = new UDim2(0, 0, 0.5, 0);
	diceLabel.BackgroundTransparency = 0.3;
	diceLabel.BackgroundColor3 = new Color3(0.2, 0.2, 0.2);
	diceLabel.TextColor3 = Color3.fromRGB(255, 200, 100); // Gold/yellow for dice number
	diceLabel.TextScaled = true;
	diceLabel.Font = Enum.Font.GothamBold;
	diceLabel.Text = "";
	diceLabel.Parent = billboard;
};

// Convert axial coordinates (q, r) to world position
const axialToWorld = (q: number, r: number) => {
	const x = HEX_SIZE * 2 * (q + r / 2);
	const z = HEX_SIZE * math.sqrt(3) * r;
	return new Vector3(x, 0, z);
};

// Create an EXACT tile pool based on frequencies (no duplicates beyond frequency)
const createExactTilePool = () => {
	const pool = new Array<string>();
	const tiles = TileTypes as unknown as Record<string, import("shared/TileTypes").TileInfo>;
	for (const [key, data] of pairs(tiles)) {
		for (let i = 1; i <= data.Frequency; i += 1) {
			pool.push(key);
		}
	}

	// Shuffle the pool
	for (let i = pool.size(); i >= 2; i -= 1) {
		const j = math.random(1, i);
		const swapIndex = j - 1;
		const currentIndex = i - 1;
		const temp = pool[currentIndex];
		pool[currentIndex] = pool[swapIndex];
		pool[swapIndex] = temp;
	}

	return pool;
};

const MapGenerator = {
	PortLocations: [] as PortLocation[],

	Generate(rings = 2) {
		// Default: 2 rings = 19 hexes (standard Catan)
		const mapFolder = (game.Workspace.FindFirstChild("Map") as Folder) ?? new Instance("Folder", game.Workspace);
		mapFolder.Name = "Map";
		mapFolder.ClearAllChildren();

		// Create exact tile pool (respects frequencies)
		const tilePool = createExactTilePool();
		let tileIndex = 0;

		// Generate hexes in axial coordinates
		for (let q = -rings; q <= rings; q += 1) {
			const r1 = math.max(-rings, -q - rings);
			const r2 = math.min(rings, -q + rings);

			for (let r = r1; r <= r2; r += 1) {
				const worldPos = axialToWorld(q, r);

				// Get tile from exact pool (or fallback if pool exhausted)
				const typeKey = tilePool[tileIndex] ?? "Desert";
				const tileData = TileTypes[typeKey];

				let material: Enum.Material = Enum.Material.Grass;
				if (tileData.Name === "Mountains") {
					material = Enum.Material.Slate;
				} else if (tileData.Name === "Desert") {
					material = Enum.Material.Sand;
				} else if (tileData.Name === "Hills") {
					material = Enum.Material.Ground;
				}

				const hex = createHexagon(`Tile_${q}_${r}`, worldPos, tileData.Color, material);
				hex.Parent = mapFolder;

				// Add terrain label
				addLabel(hex, tileData.Name);

				// Get asset pack from ReplicatedStorage
				const assetPack = ReplicatedStorage.FindFirstChild("Supers Asset Pack!");
				const baseY = HEIGHT;

				// Helper function to clone and place an asset with automatic height adjustment
				// Optional scale parameter to resize the asset
				const placeAsset = (assetPath: string, position: Vector3, scale = 1) => {
					if (!assetPack) {
						return undefined;
					}

					let asset: Instance | undefined = assetPack;
					for (const pathPart of string.split(assetPath, "/")) {
						asset = asset?.FindFirstChild(pathPart);
					}

					if (asset && (asset.IsA("Model") || asset.IsA("BasePart"))) {
						const clone = asset.Clone();

						// Apply scale to all parts first
						if (clone.IsA("Model")) {
							for (const part of clone.GetDescendants()) {
								if (part.IsA("BasePart")) {
									part.Size = part.Size.mul(scale);
									part.Anchored = true;
								}
							}
						} else if (clone.IsA("BasePart")) {
							clone.Size = clone.Size.mul(scale);
							clone.Anchored = true;
						}

						// Calculate bounding box to find the bottom of the asset
						let minY = math.huge;
						let refPos = new Vector3(0, 0, 0);

						if (clone.IsA("Model")) {
							// Find bounding box after scaling
							for (const part of clone.GetDescendants()) {
								if (part.IsA("BasePart")) {
									const bottomY = part.Position.Y - part.Size.Y / 2;
									if (bottomY < minY) {
										minY = bottomY;
										refPos = part.Position;
									}
								}
							}

							// Calculate offset to place bottom at target position
							const yOffset = position.Y - minY;

							// Move all parts by the offset
							for (const part of clone.GetDescendants()) {
								if (part.IsA("BasePart")) {
									part.Position = new Vector3(
										part.Position.X - refPos.X + position.X,
										part.Position.Y + yOffset,
										part.Position.Z - refPos.Z + position.Z,
									);
								}
							}
						} else if (clone.IsA("BasePart")) {
							// For single part, position so bottom sits on target
							const yOffset = clone.Size.Y / 2;
							clone.Position = position.add(new Vector3(0, yOffset, 0));
						}

						clone.Parent = hex;
						return clone;
					}
					return undefined;
				};

				// Add terrain features based on tile type using asset pack
				if (tileData.Name === "Forest") {
					// Add trees from asset pack (random count between 6-12)
					const treeCount = math.random(6, 12);
					for (let i = 1; i <= treeCount; i += 1) {
						const angle = math.rad(math.random(0, 360));
						const dist = math.random(8, 25);
						const pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));

						// Randomly pick one of 4 tree variants
						const treeNum = math.random(1, 4);
						const tree = placeAsset(`Trees/Tree${treeNum}`, pos);
						if (!tree) {
							// Fallback: basic tree
							const trunk = new Instance("Part");
							trunk.Size = new Vector3(2, 12, 2);
							trunk.Position = pos.add(new Vector3(0, 6, 0));
							trunk.Color = Color3.fromRGB(101, 67, 33);
							trunk.Material = Enum.Material.Wood;
							trunk.Anchored = true;
							trunk.Parent = hex;
						}
					}
				} else if (tileData.Name === "Fields") {
					// Add grass/wheat from asset pack
					const grassCount = math.random(8, 16);
					for (let i = 1; i <= grassCount; i += 1) {
						const angle = math.rad(math.random(0, 360));
						const dist = math.random(5, 22);
						const pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));

						const grass = placeAsset("Grass/Grass", pos);
						if (!grass) {
							// Fallback: basic wheat
							const stalk = new Instance("Part");
							stalk.Shape = Enum.PartType.Cylinder;
							stalk.Size = new Vector3(6, 1, 1);
							stalk.Position = pos.add(new Vector3(0, 3, 0));
							stalk.Orientation = new Vector3(0, 0, 90);
							stalk.Color = Color3.fromRGB(218, 165, 32);
							stalk.Material = Enum.Material.Grass;
							stalk.Anchored = true;
							stalk.Parent = hex;
						}
					}
				} else if (tileData.Name === "Pasture") {
					// Add sheep from asset pack (4-9 sheep)
					const sheepCount = math.random(4, 9);
					const placedPositions = new Array<Vector3>();
					const minDistance = 8; // Minimum distance between sheep

					for (let i = 1; i <= sheepCount; i += 1) {
						let pos = worldPos;
						let attempts = 0;
						const maxAttempts = 20;

						// Try to find a position that doesn't overlap with existing sheep
						do {
							const angle = math.rad(math.random(0, 360));
							const dist = math.random(5, 25);
							pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));

							let tooClose = false;
							for (const existingPos of placedPositions) {
								if (pos.sub(existingPos).Magnitude < minDistance) {
									tooClose = true;
									break;
								}
							}

							attempts += 1;
							if (!tooClose) {
								break;
							}
						} while (attempts < maxAttempts);

						// Only place if we found a valid position
						if (attempts < maxAttempts) {
							placedPositions.push(pos);

							const sheep = placeAsset("Animals/Sheep", pos, 0.5); // 50% size
							if (sheep && sheep.IsA("Model")) {
								// Apply random Y rotation using PivotTo
								const randomAngle = math.rad(math.random(0, 360));
								const currentPivot = sheep.GetPivot();
								const rotatedCFrame = new CFrame(currentPivot.Position).mul(CFrame.Angles(0, randomAngle, 0));
								sheep.PivotTo(rotatedCFrame);
							} else if (!sheep) {
								// Fallback: basic sheep shape
								const body = new Instance("Part");
								body.Shape = Enum.PartType.Ball;
								body.Size = new Vector3(6, 4, 8);
								body.Position = pos.add(new Vector3(0, 2, 0));
								body.Color = Color3.fromRGB(255, 255, 255);
								body.Material = Enum.Material.SmoothPlastic;
								body.Anchored = true;
								body.Parent = hex;
							}
						}
					}
				} else if (tileData.Name === "Hills") {
					// Add hills from asset pack (2-4 hills)
					const hillCount = math.random(1, 3);
					for (let i = 1; i <= hillCount; i += 1) {
						const angle = math.rad(math.random(0, 360));
						const dist = math.random(5, 18);
						const pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));

						const hill = placeAsset("Hill/Hill1", pos, 1 / 2);
						if (!hill) {
							// Fallback: basic hill shape
							const fallbackHill = new Instance("Part");
							fallbackHill.Shape = Enum.PartType.Ball;
							const sz = math.random(12, 20);
							fallbackHill.Size = new Vector3(sz, sz / 2, sz);
							fallbackHill.Position = pos.add(new Vector3(0, sz / 4 - 2, 0));
							fallbackHill.Color = tileData.Color;
							fallbackHill.Material = Enum.Material.Ground;
							fallbackHill.Anchored = true;
							fallbackHill.Parent = hex;
						}
					}
				} else if (tileData.Name === "Mountains") {
					// Add large rocks from asset pack (2-4 rocks, scaled 5x)
					const rockCount = math.random(2, 4);
					let lastRockNum = 0;
					for (let i = 1; i <= rockCount; i += 1) {
						const angle = math.rad(math.random(0, 360));
						const dist = math.random(0, 20);
						const pos = worldPos.add(new Vector3(math.cos(angle) * dist, baseY, math.sin(angle) * dist));

						// Randomly pick rock 1-4, but never the same as last one
						let rockNum = math.random(1, 4);
						while (rockNum === lastRockNum) {
							rockNum = math.random(1, 4);
						}
						lastRockNum = rockNum;

						const rock = placeAsset(`Rocks/Rock${rockNum}`, pos, 5);
						if (!rock) {
							// Fallback: basic peak
							const peak = new Instance("Part");
							const ps = math.random(10, 18);
							peak.Size = new Vector3(ps, ps * 1.5, ps);
							peak.Position = pos.add(new Vector3(0, ps * 0.5, 0));
							peak.Rotation = new Vector3(
								math.random(-10, 10),
								math.random(0, 360),
								math.random(-10, 10),
							);
							peak.Color = Color3.fromRGB(105, 105, 105);
							peak.Material = Enum.Material.Slate;
							peak.Anchored = true;
							peak.Parent = hex;
						}
					}
				}
				// Desert tiles remain barren (no features)

				// Store gameplay data
				if (hex.PrimaryPart) {
					hex.PrimaryPart.SetAttribute("TileType", tileData.Name);
					hex.PrimaryPart.SetAttribute("Resource", tileData.Resource ?? "");
					hex.PrimaryPart.SetAttribute("Q", q);
					hex.PrimaryPart.SetAttribute("R", r);
				}

				tileIndex += 1;
			}
		}

		// Create hex vertices and edges
		MapGenerator.CreateVerticesAndEdges(mapFolder);

		// Create ports on coastal edges
		MapGenerator.CreatePorts();
	},

	CreateVerticesAndEdges(mapFolder: Folder) {
		const vertices: Record<string, VertexData> = {};
		const vertexFolder = (game.Workspace.FindFirstChild("Vertices") as Folder) ?? new Instance("Folder", game.Workspace);
		vertexFolder.Name = "Vertices";
		vertexFolder.ClearAllChildren();

		const edgeFolder = (game.Workspace.FindFirstChild("Edges") as Folder) ?? new Instance("Folder", game.Workspace);
		edgeFolder.Name = "Edges";
		edgeFolder.ClearAllChildren();

		const edges: Record<string, EdgeData> = {};

		// For each hex, calculate its 6 corner positions and edges
		for (const tile of mapFolder.GetChildren()) {
			if (tile.IsA("Model") && tile.PrimaryPart) {
				const center = tile.PrimaryPart.Position;
				const q = tile.PrimaryPart.GetAttribute("Q") as number;
				const r = tile.PrimaryPart.GetAttribute("R") as number;
				const cornerRadius = HEX_SIZE * 1.15; // Adjusted for the visual hex shape

				const tileVertexKeys = new Array<string>();

				// Generate 6 vertices for this hex
				for (let i = 0; i <= 5; i += 1) {
					const angle = math.pi / 3 * i + math.pi / 6;
					const vx = center.X + cornerRadius * math.cos(angle);
					const vz = center.Z + cornerRadius * math.sin(angle);

					const gridSize = 8;
					const keyX = math.floor(vx / gridSize + 0.5);
					const keyZ = math.floor(vz / gridSize + 0.5);
					const key = `${keyX}_${keyZ}`;
					tileVertexKeys[i] = key;

					if (!vertices[key]) {
						vertices[key] = {
							Position: new Vector3(vx, HEIGHT + 0.5, vz),
							AdjacentTiles: [],
						};
					}
					vertices[key].AdjacentTiles.push({ Q: q, R: r });
				}

				// Generate 6 edges for this hex
				for (let i = 0; i <= 5; i += 1) {
					const key1 = tileVertexKeys[i];
					const key2 = tileVertexKeys[(i + 1) % 6];

					// Create a unique key for the edge by sorting vertex keys
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

		// First, build the neighbor map
		const vertexNeighbors: Record<string, string[]> = {};
		for (const [key] of pairs(edges)) {
			const vKeyParts = string.split(key, ":");
			const v1Key = vKeyParts[0] ?? vKeyParts[1];
			const v2Key = vKeyParts[1] ?? vKeyParts[2];
			if (!v1Key || !v2Key) {
				continue;
			}
			vertexNeighbors[v1Key] = vertexNeighbors[v1Key] ?? [];
			vertexNeighbors[v1Key].push(v2Key);

			vertexNeighbors[v2Key] = vertexNeighbors[v2Key] ?? [];
			vertexNeighbors[v2Key].push(v1Key);
		}

		// Create vertex markers with neighbor info
		let vertexId = 1;
		for (const [key, data] of pairs(vertices)) {
			const adjCount = data.AdjacentTiles.size();
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
			marker.SetAttribute("AdjacentTileCount", adjCount);

			// Store adjacent tile coordinates for ownership claiming
			for (let i = 0; i < data.AdjacentTiles.size(); i += 1) {
				const tile = data.AdjacentTiles[i];
				marker.SetAttribute(`Tile${i + 1}Q`, tile.Q);
				marker.SetAttribute(`Tile${i + 1}R`, tile.R);
			}

			// Store neighbor keys for distance rule
			const neighbors = vertexNeighbors[key] ?? [];
			for (let i = 0; i < neighbors.size(); i += 1) {
				marker.SetAttribute(`Neighbor_${i + 1}`, neighbors[i]);
			}

			vertexId += 1;
		}

		// Create edge markers
		let edgeId = 1;
		for (const [key, data] of pairs(edges)) {
			const adjCount = data.AdjacentTiles.size();
			const marker = new Instance("Part");
			marker.Name = `Edge_${edgeId}`;
			marker.Size = new Vector3(37, 1, 3); // ~80% of vertex-to-vertex distance (~46 studs)
			marker.Position = data.Center;
			marker.Anchored = true;
			marker.CanCollide = false;
			marker.Transparency = 1;

			// Align with the line between v1 and v2
			marker.CFrame = CFrame.lookAt(data.Center, data.V1).mul(CFrame.Angles(0, math.rad(90), 0));

			marker.Parent = edgeFolder;
			marker.SetAttribute("EdgeId", edgeId);
			marker.SetAttribute("Key", key);
			// Store vertex keys for connection logic
			const vKeys = string.split(key, ":");
			const vertex1 = vKeys[0] ?? vKeys[1];
			const vertex2 = vKeys[1] ?? vKeys[2];
			marker.SetAttribute("Vertex1", vertex1);
			marker.SetAttribute("Vertex2", vertex2);
			marker.SetAttribute("AdjacentTileCount", adjCount);
			edgeId += 1;
		}

		print(`[MapGenerator] Created ${vertexId - 1} vertices and ${edgeId - 1} edges`);
	},

	// Get all vertices (for building placement)
	GetVertices() {
		const vertices = new Array<BasePart>();
		const vertexFolder = game.Workspace.FindFirstChild("Vertices");
		if (vertexFolder) {
			for (const v of vertexFolder.GetChildren()) {
				if (v.IsA("BasePart")) {
					vertices.push(v);
				}
			}
		}
		return vertices;
	},

	// Find nearest vertex to a position
	FindNearestVertex(position: Vector3) {
		const vertices = MapGenerator.GetVertices();
		let nearest: BasePart | undefined;
		let nearestDist = math.huge;

		for (const vertex of vertices) {
			const dist = new Vector3(position.X, 0, position.Z).sub(new Vector3(vertex.Position.X, 0, vertex.Position.Z)).Magnitude;
			if (dist < nearestDist) {
				nearestDist = dist;
				nearest = vertex;
			}
		}

		return $tuple(nearest, nearestDist);
	},

	// Generate port locations on coastal edges
	CreatePorts() {
		const edgeFolder = game.Workspace.FindFirstChild("Edges");
		if (!edgeFolder) {
			return;
		}

		const vertexFolder = game.Workspace.FindFirstChild("Vertices");
		if (!vertexFolder) {
			return;
		}

		const portFolder = (game.Workspace.FindFirstChild("Ports") as Folder) ?? new Instance("Folder", game.Workspace);
		portFolder.Name = "Ports";
		portFolder.ClearAllChildren();

		// Pre-index vertices for faster lookup
		const vertexMap = new Map<string, BasePart>();
		for (const v of vertexFolder.GetChildren()) {
			if (v.IsA("BasePart")) {
				const key = v.GetAttribute("Key") as string;
				if (key) {
					vertexMap.set(key, v);
				}
			}
		}

		// Find coastal edges (edges with only 1 adjacent tile)
		const coastalEdges: BasePart[] = [];
		for (const edge of edgeFolder.GetChildren()) {
			if (edge.IsA("BasePart")) {
				const adjCount = edge.GetAttribute("AdjacentTileCount") as number;
				if (adjCount === 1) {
					coastalEdges.push(edge);
				}
			}
		}

		// Attempt to place all 9 ports (multiple tries if randomness fails)
		const MAX_ATTEMPTS = 50;
		let success = false;

		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
			// Shuffle coastal edges
			for (let i = coastalEdges.size(); i >= 2; i -= 1) {
				const j = math.random(1, i);
				const temp = coastalEdges[i - 1];
				coastalEdges[i - 1] = coastalEdges[j - 1];
				coastalEdges[j - 1] = temp;
			}

			// Place ports from the standard configuration
			MapGenerator.PortLocations = [];
			const forbiddenVertices = new Set<string>();

			for (const edge of coastalEdges) {
				if (MapGenerator.PortLocations.size() >= StandardPortConfiguration.size()) {
					break;
				}

				const v1Key = edge.GetAttribute("Vertex1") as string;
				const v2Key = edge.GetAttribute("Vertex2") as string;

				if (!v1Key || !v2Key) {
					continue;
				}

				// Distance Rule: No vertex of this edge can be forbidden
				if (forbiddenVertices.has(v1Key) || forbiddenVertices.has(v2Key)) {
					continue;
				}

				const v1Part = vertexMap.get(v1Key);
				const v2Part = vertexMap.get(v2Key);

				if (!v1Part || !v2Part) {
					continue;
				}

				// Port rule: Settlement must be placed where 2 or 3 tiles meet
				const v1Adj = (v1Part.GetAttribute("AdjacentTileCount") as number) ?? 0;
				const v2Adj = (v2Part.GetAttribute("AdjacentTileCount") as number) ?? 0;

				if (v1Adj < 2 && v2Adj < 2) {
					continue;
				}

				const portType = StandardPortConfiguration[MapGenerator.PortLocations.size()];
				const portInfo = PortTypes[portType];

				// Store port location temporarily
				MapGenerator.PortLocations.push({
					PortType: portType,
					Position: edge.Position,
					Vertices: [v1Part.Position, v2Part.Position] as [Vector3, Vector3],
					Edge: edge, // Temporary storage for marker creation
				} as unknown as PortLocation);

				// Mark vertices and their neighbors as forbidden
				forbiddenVertices.add(v1Key);
				forbiddenVertices.add(v2Key);

				for (let n = 1; n <= 3; n += 1) {
					const neighbor = v1Part.GetAttribute(`Neighbor_${n}`) as string;
					if (neighbor) {
						forbiddenVertices.add(neighbor);
					}
				}
				for (let n = 1; n <= 3; n += 1) {
					const neighbor = v2Part.GetAttribute(`Neighbor_${n}`) as string;
					if (neighbor) {
						forbiddenVertices.add(neighbor);
					}
				}
			}

			if (MapGenerator.PortLocations.size() === StandardPortConfiguration.size()) {
				success = true;
				break;
			}
		}

		if (!success) {
			warn(`[MapGenerator] Failed to place all 9 ports after ${MAX_ATTEMPTS} attempts. Placed ${MapGenerator.PortLocations.size()}`);
		}

		// Create markers for placed ports
		for (const port of MapGenerator.PortLocations) {
			const edge = (port as unknown as { Edge: BasePart }).Edge;
			const portType = port.PortType;
			const portInfo = PortTypes[portType];

			// Create port marker at the edge center
			const portMarker = new Instance("Part");
			portMarker.Name = `Port_${portType}`;
			portMarker.Size = new Vector3(8, 6, 8);
			portMarker.Position = edge.Position.add(new Vector3(0, 3, 0));
			portMarker.Anchored = true;
			portMarker.Color = portInfo.Color;
			portMarker.Material = Enum.Material.Neon;
			portMarker.Transparency = 0.3;
			portMarker.Parent = portFolder;

			// Add port label
			const billboard = new Instance("BillboardGui");
			billboard.Name = "PortLabel";
			billboard.Size = new UDim2(0, 150, 0, 60);
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
	},

	// Get port locations for PortManager
	GetPortLocations(): PortLocation[] {
		return MapGenerator.PortLocations;
	},
};

export = MapGenerator;
