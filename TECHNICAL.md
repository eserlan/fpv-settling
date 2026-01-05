# FPV Settler - Technical Overview

## Architecture

This document provides a technical overview of the FPV Settler game architecture.

## System Components

### 1. Resource Management System

**Location**: `src/server/ResourceManager.ts`, `src/shared/ResourceTypes.ts`

**Purpose**: Manages player resources (Wood, Brick, Wheat, Wool, Ore)

**Key Features**:
- Resource type definitions with max stack sizes
- Add/remove resource operations with overflow protection
- Resource requirement validation
- Starting resources: 0 (Players must gather from tiles)

**API**:

```lua
ResourceManager.new(player) -- Create manager for player
manager:AddResource(type, amount) -- Add resources
manager:RemoveResource(type, amount) -- Remove resources
manager:HasResources(costs) -- Check if player can afford
manager:GetResource(type) -- Get specific resource amount
```

### 2. Building System

**Location**: `src/server/BuildingManager.ts`, `src/shared/BuildingTypes.ts`

**Purpose**: Handles building construction and placement

**Building Types**:
- **Road**: Connects buildings (1 Wood, 1 Brick)
- **Town**: Claims nearby tiles (1 Wood, 1 Brick, 1 Wheat, 1 Wool)
- **City**: Upgrade from Town for double resources (2 Wheat, 3 Ore)

**Construction Flow**:
1. Player initiates building
2. System validates resources
3. Resources deducted
4. Building added to construction queue
5. Progress updates each frame
6. On completion, physical model created in workspace

**API**:

```lua
BuildingManager.new(player, resourceManager)
manager:StartBuilding(type, position) -- Begin construction
manager:UpdateBuildings(deltaTime) -- Progress buildings
manager:GetBuildings() -- Get completed buildings
```

### 3. NPC Management System

**Location**: `src/server/NPCManager.ts`, `src/shared/NPCTypes.ts`

**Purpose**: Manages worker and guard NPCs

**NPC Types**:
- **Worker**: Resource gatherers (2 Wheat, 1 Ore)
  - Gather rate: 5 resources/min
  - Maintenance: 1 Wheat/min
  - Health: 50, Speed: 16
  
- **Guard**: Town defenders (3 Wheat, 2 Ore)
  - Damage: 10, Range: 20, Detection: 50
  - Maintenance: 2 Wheat/min
  - Health: 100, Speed: 18

**NPC Lifecycle**:
1. Hire with resource cost
2. Create physical model in workspace
3. Update AI each frame (idle, gathering, attacking)
4. Pay maintenance costs every minute
5. Fire/remove when no longer needed

**API**:

```lua
NPCManager.new(player, resourceManager)
manager:HireNPC(type, position) -- Hire new NPC
manager:UpdateNPCs(deltaTime) -- Update AI
manager:PayMaintenance(minutes) -- Pay upkeep costs
manager:FireNPC(id) -- Remove NPC
```

### 4. Research System

**Location**: `src/server/ResearchManager.ts`, `src/shared/TechTree.ts`

**Purpose**: Technology research and upgrades

**Technologies**:
- **Tools**: +25% gather speed
- **Agriculture**: +50% production
- **Military**: +30% combat stats

**Research Flow**:
1. Check prerequisites met
2. Validate resource costs
3. Deduct resources
4. Progress over time
5. Apply modifiers on completion

### 5. Game Manager

**Location**: `src/server/GameManager.ts`

**Purpose**: Coordinates all systems and main game loop

**Responsibilities**:
- Initialize player managers on join
- Run main game loop (Pulse cycle)
- Update all systems each frame
- Configure first-person camera for players

### 6. Client Systems

#### Player Controller
**Location**: `src/client/PlayerController.ts`

**Purpose**: First-person camera and controls

**Features**:
- Mouse-look first-person camera
- WASD movement
- Building mode toggle (B key)
- Interaction with buildings (E key)

#### UI Manager
**Location**: `src/client/UIManager.ts`

**Purpose**: User interface display

**UI Elements**:
- Resource display
- Building menu
- Pulse timer and dice results

## Data Flow

### Resource Transaction Flow
```
Player Action → Server Validation → Resource Check → 
Transaction Execute → Update State → Notify Client
```

### Building Construction Flow
```
Place Request → Cost Check → Deduct Resources → 
Queue Building → Update Progress → Complete → Spawn Model
```

## Performance Considerations
- Throttled AI updates
- Client-side prediction for movement
- Efficient hexagonal math

## Rojo Project Structure
- `src/shared/` → `ReplicatedStorage.Shared`
- `src/server/` → `ServerScriptService.Server`
- `src/client/` → `StarterPlayer.StarterPlayerScripts.Client`
