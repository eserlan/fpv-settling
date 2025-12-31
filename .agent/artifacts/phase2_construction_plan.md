# Phase 2: Construction System

## Overview
Players place a foundation, then physically bring resources to it. As resources are deposited, the ghost building fills in and eventually completes.

## Key Changes

### 1. Foundation State (Server - BuildingManager)
- Foundation tracks: `RequiredResources`, `DepositedResources`, `Progress`
- Foundation remains as ghost until all resources deposited
- `DepositResource(foundationId, resourceType)` function

### 2. Foundation Model (Server - BuildingManager)
- Ghost/transparent version of building
- Progress bar floating above
- Resource icons showing what's still needed
- Fills in (becomes less transparent) as progress increases

### 3. Player Interaction (Client - PlayerController)
- When near a foundation, show "Press E to deposit [resource]"
- E key deposits one resource at a time
- Only deposit if player has the resource

### 4. Visual Feedback
- Foundation has pulsing glow
- Progress bar above foundation
- Particle effects when depositing
- Completion celebration when done

### 5. Road Connections
- Roads must connect to existing settlement or road
- Visual connection lines between buildings

## Implementation Order
1. Update BuildingManager.PlaceFoundation to NOT auto-complete
2. Add foundation ghost model with progress visuals
3. Add DepositResource server function
4. Add client-side deposit interaction (E key near foundation)
5. Update CollectionManager to remove resources on deposit
6. Add completion logic when all resources deposited
7. Add road connection validation
