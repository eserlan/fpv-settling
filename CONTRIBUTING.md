# Contributing to FPV Settling

Thank you for your interest in contributing to FPV Settling! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and constructive in all interactions
- Welcome newcomers and help them get started
- Focus on what is best for the community and the project

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:
- Clear title describing the problem
- Steps to reproduce the bug
- Expected behavior vs actual behavior
- Screenshots or error messages if applicable
- Your Roblox Studio version and OS

### Suggesting Features

Feature suggestions are welcome! Please create an issue with:
- Clear description of the feature
- Use cases and benefits
- Potential implementation approach
- Any relevant examples from other games

### Pull Requests

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub
   git clone https://github.com/YOUR-USERNAME/fpv-settling.git
   cd fpv-settling
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Make your changes**
   - Follow the code style guidelines below
   - Write clear, commented code
   - Test your changes thoroughly

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: Description of your changes"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Describe your changes clearly

## Code Style Guidelines

### Lua Style

- **Indentation**: Use tabs (default for Roblox)
- **Naming Conventions**:
  - `PascalCase` for classes and modules
  - `camelCase` for functions and variables
  - `UPPER_SNAKE_CASE` for constants
  - Descriptive names over short names

```lua
-- Good
local ResourceManager = {}
local function calculateTotalCost(buildings)
    local GOLD_MULTIPLIER = 1.5
end

-- Avoid
local rm = {}
local function calc(b)
    local gm = 1.5
end
```

### Comments

- Add comments for complex logic
- Document function parameters and return values
- Use `--` for single-line comments
- Use `--[[  ]]` for multi-line comments

```lua
-- Calculate building cost with research modifiers applied
-- @param buildingType string - The type of building
-- @param researchManager ResearchManager - Player's research state
-- @return table - Modified cost table
function calculateCost(buildingType, researchManager)
    -- Implementation
end
```

### Module Structure

```lua
-- Module description
local ModuleName = {}
ModuleName.__index = ModuleName

-- Constructor
function ModuleName.new(params)
    local self = setmetatable({}, ModuleName)
    -- Initialize
    return self
end

-- Public methods
function ModuleName:PublicMethod()
    -- Implementation
end

-- Private functions (local)
local function privateFunction()
    -- Implementation
end

return ModuleName
```

## Project Structure

When adding new files:

- **Client scripts** → `src/client/`
- **Server scripts** → `src/server/`
- **Shared modules** → `src/shared/`
- **Data definitions** → `src/shared/` (e.g., BuildingTypes, NPCTypes)

## Testing

Before submitting a PR:

1. Test in Roblox Studio with Rojo sync
2. Check for script errors in Output window
3. Test with both client and server
4. Verify no performance issues
5. Test edge cases (e.g., zero resources, invalid inputs)

## Areas for Contribution

### High Priority
- [ ] Implement RemoteEvents for client-server communication
- [ ] Add actual building placement system with collision detection
- [ ] Improve NPC AI pathfinding
- [ ] Add resource gathering mechanics
- [ ] Create visual feedback for building construction

### Medium Priority
- [ ] Add sound effects
- [ ] Improve UI animations and polish
- [ ] Add more building types
- [ ] Implement save/load system
- [ ] Add tutorial system

### Low Priority (Nice to Have)
- [ ] Particle effects for construction
- [ ] Day/night cycle
- [ ] Weather system
- [ ] More detailed building models
- [ ] Achievement system

## Architecture Overview

### Game Flow

```
Player Joins
    ↓
GameManager creates managers for player
    ↓
Client initializes UI and controls
    ↓
Game Loop Updates:
    - Building construction progress
    - NPC AI and behavior
    - Research progress
    - Maintenance costs
```

### Manager Responsibilities

- **GameManager**: Coordinates all systems, main game loop
- **ResourceManager**: Tracks player resources, validates transactions
- **BuildingManager**: Handles building placement and construction
- **NPCManager**: Manages NPC hiring, AI, and maintenance
- **ResearchManager**: Technology unlocks and modifiers

### Client-Server Communication

Currently implemented as local testing. For full multiplayer:
- Add RemoteEvents in ReplicatedStorage
- Server validates all actions
- Client sends requests, server updates state
- Server fires events to update client UI

## Documentation

When adding new features:
- Update README.md if it changes gameplay
- Update SETUP.md if it affects setup
- Add comments in code for complex logic
- Consider adding examples

## Questions?

If you have questions about contributing:
- Check existing issues and pull requests
- Create a new issue with the "question" label
- Join discussions in pull requests

Thank you for contributing to FPV Settling! 🎮
