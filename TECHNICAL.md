# FPV Settling - Technical Overview

## Architecture

This document provides a technical overview of the FPV Settling game architecture.

## System Components

### 1. Resource Management System

**Location**: `src/server/ResourceManager.lua`, `src/shared/ResourceTypes.lua`

**Purpose**: Manages player resources (Wood, Stone, Food, Gold)

**Key Features**:
- Resource type definitions with max stack sizes
- Add/remove resource operations with overflow protection
- Resource requirement validation
- Starting resources (50 Wood, 30 Stone, 20 Food, 100 Gold)

**API**:
```lua
ResourceManager.new(player) -- Create manager for player
manager:AddResource(type, amount) -- Add resources
manager:RemoveResource(type, amount) -- Remove resources
manager:HasResources(costs) -- Check if player can afford
manager:GetResource(type) -- Get specific resource amount
```

### 2. Building System

**Location**: `src/server/BuildingManager.lua`, `src/shared/BuildingTypes.lua`

**Purpose**: Handles building construction and placement

**Building Types**:
- **Road**: Fast travel paths (5 Wood, 10 Stone, 5s build)
- **House**: Worker housing (50 Wood, 30 Stone, 30s build)
- **Storage**: Resource storage (30 Wood, 20 Stone, 20s build)
- **Barracks**: Guard quarters (40 Wood, 50 Stone, 100 Gold, 40s build)
- **Workshop**: Research facility (60 Wood, 40 Stone, 150 Gold, 50s build)

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

**Location**: `src/server/NPCManager.lua`, `src/shared/NPCTypes.lua`

**Purpose**: Manages worker and guard NPCs

**NPC Types**:
- **Worker**: Resource gatherers (50 Gold, 10 Food to hire)
  - Gather rate: 5 resources/min
  - Maintenance: 1 Food/min
  - Health: 50, Speed: 16
  
- **Guard**: Settlement defenders (100 Gold, 15 Food to hire)
  - Damage: 10, Range: 20, Detection: 50
  - Maintenance: 2 Food/min
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

**Location**: `src/server/ResearchManager.lua`, `src/shared/TechTree.lua`

**Purpose**: Technology research and upgrades

**Technologies**:
- **Improved Tools**: +25% gather speed (100 Gold, 60s)
- **Stone Work**: Unlock stone buildings (150 Gold, 50 Stone, 90s)
- **Agriculture**: +50% food production (120 Gold, 30 Wood, 75s)
- **Military**: +30% guard effectiveness (200 Gold, 120s)
- **Advanced Engineering**: -20% building costs (250 Gold, 100 Stone, 150s)
- **Trading**: Unlock trading posts (180 Gold, 90s)

**Research Flow**:
1. Check prerequisites met
2. Validate resource costs
3. Deduct resources
4. Progress over time
5. Apply modifiers on completion

**API**:
```lua
ResearchManager.new(player, resourceManager)
manager:StartResearch(techName) -- Begin research
manager:UpdateResearch(deltaTime) -- Progress research
manager:HasResearched(techName) -- Check completion
manager:GetModifier(effectType) -- Get cumulative modifier
```

### 5. Game Manager

**Location**: `src/server/GameManager.lua`

**Purpose**: Coordinates all systems and main game loop

**Responsibilities**:
- Initialize player managers on join
- Run main game loop (Heartbeat)
- Update all systems each frame
- Handle maintenance payments every 60 seconds
- Configure first-person camera for players

**Game Loop**:
```lua
Every frame:
  - Update building construction progress
  - Update NPC AI behaviors
  - Update research progress
  
Every 60 seconds:
  - Pay NPC maintenance costs
```

### 6. Client Systems

#### Player Controller
**Location**: `src/client/PlayerController.lua`

**Purpose**: First-person camera and controls

**Features**:
- Mouse-look first-person camera
- WASD movement (inherited from Roblox humanoid)
- Building mode toggle (B key)
- Hire commands (H for worker, G for guard)
- Camera pitch/yaw with mouse sensitivity

#### UI Manager
**Location**: `src/client/UIManager.lua`

**Purpose**: User interface display

**UI Elements**:
- Resource display (top-left)
- Building menu (top-right)
- Help/controls (bottom-center)

## Data Flow

### Resource Transaction Flow
```
Player Action → Server Validation → Resource Check → 
Transaction Execute → Update State → (Future: Notify Client)
```

### Building Construction Flow
```
Place Request → Cost Check → Deduct Resources → 
Queue Building → Update Progress → Complete → Spawn Model
```

### NPC Hiring Flow
```
Hire Request → Cost Check → Deduct Resources → 
Create NPC → Spawn Model → Add to Management
```

### Research Flow
```
Research Request → Prerequisite Check → Cost Check → 
Deduct Resources → Progress Over Time → Complete → Apply Effects
```

## Future Enhancements

### Immediate Priorities
1. **RemoteEvents**: Implement client-server communication
   - Client requests actions via RemoteEvents
   - Server validates and updates state
   - Server fires events to update client UI

2. **Building Placement**: 
   - Visual preview on client
   - Collision detection
   - Snap to grid
   - Rotation controls

3. **Resource Gathering**:
   - Resource nodes in world
   - Worker pathfinding to nodes
   - Gather animation and feedback

### Architecture Improvements

1. **Event System**: 
   ```lua
   Events/
     BuildingCompleted.lua
     ResourceChanged.lua
     NPCHired.lua
   ```

2. **Data Persistence**:
   - Save player progress
   - DataStoreService integration
   - Async load on join

3. **Networking Layer**:
   ```lua
   Shared/
     Network/
       Events.lua
       Requests.lua
   ```

## Performance Considerations

- Buildings update only during construction
- NPC AI updates can be throttled (every few frames)
- Resource UI updates on change, not every frame
- Use object pooling for NPC models
- Spatial partitioning for NPC detection

## Testing Checklist

When testing new features:
- [ ] Test with 0 resources
- [ ] Test with maximum resources
- [ ] Test concurrent actions
- [ ] Test player leaving during action
- [ ] Test with multiple players (future)
- [ ] Check for memory leaks
- [ ] Profile performance impact

## Code Standards

- All server-side validation
- Client is untrusted
- Clear error messages
- Descriptive variable names
- Comment complex logic
- Use type checking where helpful

## Rojo Project Structure

The `default.project.json` maps:
- `src/shared/` → `ReplicatedStorage.Shared`
- `src/server/` → `ServerScriptService.Server`
- `src/client/` → `StarterPlayer.StarterPlayerScripts.Client`

## Dependencies

Currently using only Roblox built-in services:
- `Players` - Player management
- `RunService` - Game loop
- `UserInputService` - Input handling
- `Workspace` - Game world

No external packages required (intentionally kept simple).
