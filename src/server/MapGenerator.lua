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
			
			-- Get asset pack from ReplicatedStorage
			local assetPack = ReplicatedStorage:FindFirstChild("Supers Asset Pack!")
			local baseY = HEIGHT
			
			-- Helper function to clone and place an asset with automatic height adjustment
			-- Optional scale parameter to resize the asset
			local function placeAsset(assetPath, position, scale)
				if not assetPack then return nil end
				scale = scale or 1
				
				local asset = assetPack
				for _, pathPart in ipairs(string.split(assetPath, "/")) do
					asset = asset and asset:FindFirstChild(pathPart)
				end
				
				if asset and (asset:IsA("Model") or asset:IsA("BasePart")) then
					local clone = asset:Clone()
					
					-- Apply scale to all parts first
					if clone:IsA("Model") then
						for _, part in ipairs(clone:GetDescendants()) do
							if part:IsA("BasePart") then
								part.Size = part.Size * scale
								part.Anchored = true
							end
						end
					else
						clone.Size = clone.Size * scale
						clone.Anchored = true
					end
					
					-- Calculate bounding box to find the bottom of the asset
					local minY = math.huge
					local refPos = Vector3.new(0, 0, 0)
					
					if clone:IsA("Model") then
						-- Find bounding box after scaling
						for _, part in ipairs(clone:GetDescendants()) do
							if part:IsA("BasePart") then
								local bottomY = part.Position.Y - part.Size.Y / 2
								if bottomY < minY then
									minY = bottomY
									refPos = part.Position
								end
							end
						end
						
						-- Calculate offset to place bottom at target position
						local yOffset = position.Y - minY
						
						-- Move all parts by the offset
						for _, part in ipairs(clone:GetDescendants()) do
							if part:IsA("BasePart") then
								part.Position = Vector3.new(
									part.Position.X - refPos.X + position.X,
									part.Position.Y + yOffset,
									part.Position.Z - refPos.Z + position.Z
								)
							end
						end
					else
						-- For single part, position so bottom sits on target
						local yOffset = clone.Size.Y / 2
						clone.Position = position + Vector3.new(0, yOffset, 0)
					end
					
					clone.Parent = hex
					return clone
				end
				return nil
			end
			
			-- Add terrain features based on tile type using asset pack
			if tileData.Name == "Forest" then
				-- Add trees from asset pack (random count between 6-12)
				local treeCount = math.random(6, 12)
				for i = 1, treeCount do
					local angle = math.rad(math.random(0, 360))
					local dist = math.random(8, 25)
					local pos = worldPos + Vector3.new(math.cos(angle) * dist, baseY, math.sin(angle) * dist)
					
					-- Randomly pick one of 4 tree variants
					local treeNum = math.random(1, 4)
					local tree = placeAsset("Trees/Non Smooth pine tree/ModelOfANiceTree" .. treeNum, pos)
					if not tree then
						-- Fallback: basic tree
						local trunk = Instance.new("Part")
						trunk.Size = Vector3.new(2, 12, 2)
						trunk.Position = pos + Vector3.new(0, 6, 0)
						trunk.Color = Color3.fromRGB(101, 67, 33)
						trunk.Material = Enum.Material.Wood
						trunk.Anchored = true
						trunk.Parent = hex
					end
				end
				
			elseif tileData.Name == "Fields" then
				-- Add grass/wheat from asset pack
				local grassCount = math.random(8, 16)
				for i = 1, grassCount do
					local angle = math.rad(math.random(0, 360))
					local dist = math.random(5, 22)
					local pos = worldPos + Vector3.new(math.cos(angle) * dist, baseY, math.sin(angle) * dist)
					
					local grass = placeAsset("Grass/Grass", pos)
					if not grass then
						-- Fallback: basic wheat
						local stalk = Instance.new("Part")
						stalk.Shape = Enum.PartType.Cylinder
						stalk.Size = Vector3.new(6, 1, 1)
						stalk.Position = pos + Vector3.new(0, 3, 0)
						stalk.Orientation = Vector3.new(0, 0, 90)
						stalk.Color = Color3.fromRGB(218, 165, 32)
						stalk.Material = Enum.Material.Grass
						stalk.Anchored = true
						stalk.Parent = hex
					end
				end
				
			elseif tileData.Name == "Pasture" then
				-- Add bushes and grass for pasture
				for i = 1, 3 do
					local angle = math.rad(i * 120 + math.random(-15, 15))
					local dist = math.random(8, 20)
					local pos = worldPos + Vector3.new(math.cos(angle) * dist, baseY, math.sin(angle) * dist)
					
					local bushType = (i % 2 == 0) and "Bushes/Purple Bush" or "Bushes/Red Bush"
					local bush = placeAsset(bushType, pos)
					if not bush then
						-- Fallback: basic sheep shape
						local body = Instance.new("Part")
						body.Shape = Enum.PartType.Ball
						body.Size = Vector3.new(6, 4, 8)
						body.Position = pos + Vector3.new(0, 2, 0)
						body.Color = Color3.fromRGB(255, 255, 255)
						body.Material = Enum.Material.SmoothPlastic
						body.Anchored = true
						body.Parent = hex
					end
				end
				
			elseif tileData.Name == "Hills" then
				-- Add hills from asset pack (2-4 hills)
				local hillCount = math.random(1, 3)
				for i = 1, hillCount do
					local angle = math.rad(math.random(0, 360))
					local dist = math.random(5, 18)
					local pos = worldPos + Vector3.new(math.cos(angle) * dist, baseY, math.sin(angle) * dist)
					
					local hill = placeAsset("Hill/Hill1", pos, 1/2)
				if not hill then
					-- Fallback: basic hill shape
					local fallbackHill = Instance.new("Part")
					fallbackHill.Shape = Enum.PartType.Ball
					local sz = math.random(12, 20)
					fallbackHill.Size = Vector3.new(sz, sz/2, sz)
					fallbackHill.Position = pos + Vector3.new(0, sz/4 - 2, 0)
					fallbackHill.Color = tileData.Color
					fallbackHill.Material = Enum.Material.Ground
					fallbackHill.Anchored = true
					fallbackHill.Parent = hex
				end
				end
				
			elseif tileData.Name == "Mountains" then
				-- Add large rocks from asset pack (2-4 rocks, scaled 5x)
				local rockCount = math.random(2, 4)
				local lastRockNum = 0
				for i = 1, rockCount do
					local angle = math.rad(math.random(0, 360))
					local dist = math.random(0, 20)
					local pos = worldPos + Vector3.new(math.cos(angle) * dist, baseY, math.sin(angle) * dist)
					
					-- Randomly pick rock 1-4, but never the same as last one
					local rockNum = math.random(1, 4)
					while rockNum == lastRockNum do
						rockNum = math.random(1, 4)
					end
					lastRockNum = rockNum
					
					local rock = placeAsset("Rocks/Rock" .. rockNum, pos, 5)
					if not rock then
						-- Fallback: basic peak
						local peak = Instance.new("Part")
						local ps = math.random(10, 18)
						peak.Size = Vector3.new(ps, ps * 1.5, ps)
						peak.Position = pos + Vector3.new(0, ps * 0.5, 0)
						peak.Rotation = Vector3.new(math.random(-10, 10), math.random(0, 360), math.random(-10, 10))
						peak.Color = Color3.fromRGB(105, 105, 105)
						peak.Material = Enum.Material.Slate
						peak.Anchored = true
						peak.Parent = hex
					end
				end
			end
			-- Desert tiles remain barren (no features)
			
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
