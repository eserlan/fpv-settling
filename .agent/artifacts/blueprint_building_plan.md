# Blueprint Building System - Implementation Plan

## Overview
A new building system where players open a Blueprint Book (B key), select what to build, place a foundation, and then physically bring resources to construct the building.

## Components

### 1. Blueprint Book UI (`BlueprintBookUI.lua`)
- **Trigger**: Press B to toggle
- **Layout**: Grid showing all available blueprints
- **Each Blueprint Card shows**:
  - Building icon/preview
  - Building name
  - Resource costs (with icons)
  - Whether player can afford it (greyed out if not)
- **Buildings**: Settlement, City, Road
- **Click to select**, then enter placement mode

### 2. Foundation Placement
- **After selecting blueprint**, show ghost preview that follows mouse
- **Snap to valid vertices**:
  - Settlements/Cities → 3-way vertices (where 3 hexes meet)
  - Roads → 2-way vertices (edge midpoints, between 2 hexes)
- **Visual feedback**: Green = valid, Red = invalid
- **Click to place foundation**

### 3. Foundation Object
- Physical marker in world showing where building will go
- Shows transparent/ghost version of the building
- Displays remaining required materials as floating icons
- Color: semi-transparent, slightly glowing

### 4. Construction Process
- **Player collects resources** from terrain
- **Walk to foundation** with resources in inventory
- **Click on foundation** to deposit materials
- Each deposited resource visually fills in part of the ghost
- **When all resources deposited** → Building completes with particle effect

## File Changes

### New Files
- `src/client/BlueprintBookUI.lua` - Blueprint selection UI
- `src/shared/Blueprints.lua` - Blueprint definitions (consolidate from BuildingTypes)
- `src/server/ConstructionManager.lua` - Handle foundation placement and resource deposits

### Modified Files
- `src/client/PlayerController.lua` - B key opens blueprint book instead of build mode
- `src/server/BuildingManager.lua` - Integrate with new construction system
- `src/shared/BuildingTypes.lua` - Add building mesh/model info

## Blueprint Definitions
```lua
Blueprints = {
    Settlement = {
        Name = "Settlement",
        Icon = "🏠",
        Description = "A small village settlement",
        PlacementType = "3-way", -- 3-way vertex (3 hexes meet)
        Cost = {Wood = 1, Brick = 1, Wheat = 1, Wool = 1},
        BuildTime = 0, -- Instant when materials placed
        Model = "SettlementGhost", -- Ghost model while building
    },
    City = {
        Name = "City",
        Icon = "🏰",
        Description = "Upgrade a settlement to a city",
        PlacementType = "3-way",
        RequiresExisting = "Settlement", -- Must upgrade from settlement
        Cost = {Wheat = 2, Ore = 3},
        Model = "CityGhost",
    },
    Road = {
        Name = "Road",
        Icon = "🛤️",
        Description = "Connect your settlements",
        PlacementType = "2-way", -- 2-way vertex (edge midpoint)
        Cost = {Wood = 1, Brick = 1},
        Model = "RoadGhost",
    }
}
```

## UI Mockup
```
┌─────────────────────────────────────────┐
│           📖 BLUEPRINT BOOK            │
├─────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │   🏠    │ │   🏰    │ │   🛤️    │    │
│ │Settlement│ │  City   │ │  Road   │    │
│ │         │ │         │ │         │    │
│ │🪵1 🧱1  │ │🌾2 ⛏️3 │ │🪵1 🧱1  │    │
│ │🌾1 🧶1  │ │         │ │         │    │
│ └─────────┘ └─────────┘ └─────────┘    │
│                                         │
│     [Click blueprint to select]         │
│              [ESC to close]             │
└─────────────────────────────────────────┘
```

## Implementation Order
1. Create `Blueprints.lua` with definitions
2. Create `BlueprintBookUI.lua` 
3. Update `PlayerController.lua` to open blueprint book
4. Create foundation placement preview system
5. Create ghost building visuals
6. Implement resource deposit mechanic
7. Add completion effects

## Vertex System (Already Exists)
- 3-way vertices: Have `AdjacentTileCount >= 3` attribute
- 2-way vertices: Have `AdjacentTileCount == 2` attribute
- Use `MapGenerator.FindNearestVertex()` for snapping
