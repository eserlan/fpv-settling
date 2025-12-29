# The Pulse - Implementation Plan

## Overview
A Roblox-ified Catan resource collection system where dice rolls happen globally every 60 seconds, spawning physical resources that players must manually collect.

---

## Phase 1: The Pulse System

### 1.1 PulseManager (Server)
- 60-second countdown timer
- Random dice roll (2d6, values 2-12)
- Broadcasts roll result to all clients
- Triggers resource spawning on matching tiles

### 1.2 Dice Hologram (Client)
- Giant hologram dice in the sky
- Visual animation when rolling
- Display countdown timer
- Show result prominently

### 1.3 Number Tokens
- Each hex tile gets a number (2-12, weighted like Catan)
- Numbers displayed on tiles
- Desert gets no number (robber tile)

---

## Phase 2: Physical Resources

### 2.1 Resource Items
- Physical 3D items for each resource type:
  - Brick (red brick pile)
  - Wood (log bundle)
  - Wheat (wheat bundle)
  - Ore (ore rocks)
  - Wool (wool bale)
- Spawn on matching tiles during pulse
- Collectible via proximity/interaction

### 2.2 ResourceManager (Server)
- Spawn resources at settlement locations
- Track spawned resources
- Handle collection
- Player inventory system

### 2.3 Collection Mechanics
- Walk near to collect
- Optional: Drone fetching system
- Visual/audio feedback on collection

---

## Phase 3: Building System

### 3.1 Foundation Placement
- Players can place "Foundation" markers
- Validates placement (vertices of hexes)
- Shows ghost preview before placement
- Enforces distance rules

### 3.2 Construction
- Foundations require resources to complete:
  - Settlement: 1 Brick, 1 Wood, 1 Wheat, 1 Wool
  - City (upgrade): 2 Wheat, 3 Ore
- Players bring physical resources to site
- Interact to "deposit" resources
- Building completes when all resources delivered

### 3.3 Roads
- Connect settlements along hex edges
- Cost: 1 Brick, 1 Wood
- Speed boost when traveling on roads
- Visual highway/walkway appearance

### 3.4 No-Build Zones
- Visual red zones around enemy structures
- 2-intersection rule enforced in 3D
- Shows when trying to place foundations

---

## File Structure

```
src/
├── server/
│   ├── PulseManager.lua      -- Pulse timer, dice roll, triggers
│   ├── ResourceManager.lua   -- Resource spawning, collection
│   ├── BuildingManager.lua   -- Foundations, construction
│   └── GameManager.lua       -- Orchestrates everything
├── client/
│   ├── PulseUI.lua           -- Dice hologram, timer display
│   ├── BuildingUI.lua        -- Foundation preview, building UI
│   └── InventoryUI.lua       -- Resource inventory display
└── shared/
    ├── TileTypes.lua         -- Already exists
    ├── ResourceTypes.lua     -- Already exists
    ├── BuildingTypes.lua     -- Already exists
    └── Network.lua           -- Remote events/functions
```

---

## Implementation Order

1. ✅ Map generation (done!)
2. [ ] Add number tokens to tiles
3. [ ] PulseManager - basic timer
4. [ ] Client dice hologram UI
5. [ ] Physical resource items
6. [ ] Resource spawning on pulse
7. [ ] Collection system
8. [ ] Player inventory
9. [ ] Foundation placement
10. [ ] Building construction
11. [ ] Roads and speed boost
12. [ ] No-build zones

---

## Getting Started

First step: Add number tokens to tiles and create the basic PulseManager.
