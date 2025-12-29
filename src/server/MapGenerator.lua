-- HEXAGONAL MAP GENERATOR (Catan-Style with Exact Frequencies)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TileTypes = require(ReplicatedStorage.Shared.TileTypes)

local MapGenerator = {}

local HEX_SIZE = 40  -- Radius: center to corner
local HEIGHT = 4

-- Creates a single hexagon at a given position
local function createHexagon(name, position, color, material)
	local model = Instance.new("Model")
	model.Name = name
	
	local rectWidth = HEX_SIZE * 2
	local rectDepth = (HEX_SIZE * 2) / math.sqrt(3)
	
	for i = 0, 2 do
		local part = Instance.new("Part")
		part.Name = "Segment_" .. i
		part.Size = Vector3.new(rectWidth, HEIGHT, rectDepth)
		part.Anchored = true
		part.Color = color
		part.Material = material or Enum.Material.SmoothPlastic
		part.TopSurface = Enum.SurfaceType.Smooth
		part.BottomSurface = Enum.SurfaceType.Smooth
		
		part.CFrame = CFrame.new(position + Vector3.new(0, HEIGHT/2, 0)) * CFrame.Angles(0, math.rad(i * 60), 0)
		part.Parent = model
		
		if i == 0 then model.PrimaryPart = part end
	end
	
	return model
end

-- Add a label above the hex
local function addLabel(hex, text)
	local billboard = Instance.new("BillboardGui")
	billboard.Size = UDim2.new(0, 100, 0, 40)
	billboard.StudsOffset = Vector3.new(0, 10, 0)
	billboard.AlwaysOnTop = true
	billboard.Adornee = hex.PrimaryPart
	billboard.Parent = hex.PrimaryPart
	
	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(1, 0, 1, 0)
	label.BackgroundTransparency = 0.3
	label.BackgroundColor3 = Color3.new(0, 0, 0)
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextScaled = true
	label.Font = Enum.Font.GothamBold
	label.Text = text
	label.Parent = billboard
end

-- Convert axial coordinates (q, r) to world position
local function axialToWorld(q, r)
	local x = HEX_SIZE * 2 * (q + r/2)
	local z = HEX_SIZE * math.sqrt(3) * r
	return Vector3.new(x, 0, z)
end

-- Create an EXACT tile pool based on frequencies (no duplicates beyond frequency)
local function createExactTilePool()
	local pool = {}
	for key, data in pairs(TileTypes) do
		for i = 1, data.Frequency do
			table.insert(pool, key)
		end
	end
	
	-- Shuffle the pool
	for i = #pool, 2, -1 do
		local j = math.random(1, i)
		pool[i], pool[j] = pool[j], pool[i]
	end
	
	return pool
end

-- Generate a hexagonal-shaped map with N rings around center
function MapGenerator.Generate(rings)
	rings = rings or 2 -- Default: 2 rings = 19 hexes (standard Catan)
	
	local mapFolder = workspace:FindFirstChild("Map") or Instance.new("Folder", workspace)
	mapFolder.Name = "Map"
	mapFolder:ClearAllChildren()
	
	-- Create exact tile pool (respects frequencies)
	local tilePool = createExactTilePool()
	local tileIndex = 1
	
	-- Generate hexes in axial coordinates
	for q = -rings, rings do
		local r1 = math.max(-rings, -q - rings)
		local r2 = math.min(rings, -q + rings)
		
		for r = r1, r2 do
			local worldPos = axialToWorld(q, r)
			
			-- Get tile from exact pool (or fallback if pool exhausted)
			local typeKey = tilePool[tileIndex] or "Desert"
			local tileData = TileTypes[typeKey]
			
			local material = Enum.Material.Grass
			if tileData.Name == "Mountains" then material = Enum.Material.Slate
			elseif tileData.Name == "Desert" then material = Enum.Material.Sand
			elseif tileData.Name == "Hills" then material = Enum.Material.Ground
			end
			
			local hex = createHexagon(
				"Tile_" .. q .. "_" .. r,
				worldPos,
				tileData.Color,
				material
			)
			hex.Parent = mapFolder
			
			-- Add terrain label
			addLabel(hex, tileData.Name)
			
			-- Store gameplay data
			hex.PrimaryPart:SetAttribute("TileType", tileData.Name)
			hex.PrimaryPart:SetAttribute("Resource", tileData.Resource or "")
			hex.PrimaryPart:SetAttribute("Q", q)
			hex.PrimaryPart:SetAttribute("R", r)
			
			tileIndex = tileIndex + 1
		end
	end
end

return MapGenerator
