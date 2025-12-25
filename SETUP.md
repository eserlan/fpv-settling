# Setup Guide for FPV Settling

This guide will help you set up the development environment and start working on the FPV Settling game.

## Prerequisites

Before you begin, ensure you have:
- **Roblox Studio** installed ([Download here](https://www.roblox.com/create))
- **Rojo** for syncing files between your file system and Roblox Studio

## Step 1: Install Rojo

### Option 1: Using Aftman (Recommended)
```bash
# Install Aftman if you don't have it
# Visit: https://github.com/LPGhatguy/aftman

# Install Rojo via Aftman
aftman add rojo-rbx/rojo
aftman install
```

### Option 2: Using Cargo (Rust)
```bash
cargo install rojo
```

### Option 3: Download Binary
Download the latest release from:
https://github.com/rojo-rbx/rojo/releases

Extract and add to your PATH.

### Verify Installation
```bash
rojo --version
```

## Step 2: Clone the Repository

```bash
git clone https://github.com/eserlan/fpv-settling.git
cd fpv-settling
```

## Step 3: Install Rojo Plugin in Roblox Studio

1. Open Roblox Studio
2. Navigate to the Roblox marketplace
3. Install the **Rojo 7** plugin from:
   https://www.roblox.com/library/13916111004/Rojo-7
4. Restart Roblox Studio after installation

## Step 4: Start Rojo Server

In your terminal, navigate to the project directory and start the Rojo server:

```bash
cd fpv-settling
rojo serve
```

You should see output like:
```
Rojo server listening on port 34872
```

**Keep this terminal window open** while you work on the project.

## Step 5: Connect Roblox Studio to Rojo

1. Open Roblox Studio
2. Create a new **Baseplate** place or open an existing place
3. In the toolbar, click the **Rojo** plugin button
4. Click **Connect**
5. The default address `localhost:34872` should work
6. Click **Sync In**

You should now see your project structure appear in Roblox Studio:
- `ReplicatedStorage/Shared/` - Contains shared modules
- `ServerScriptService/Server/` - Contains server scripts
- `StarterPlayer/StarterPlayerScripts/Client/` - Contains client scripts

## Step 6: Test the Game

1. In Roblox Studio, click **Play** (F5)
2. You should see:
   - First-person camera view
   - Resource display UI in the top-left
   - Building menu in the top-right
   - Controls help at the bottom
   - Console messages confirming system initialization

## Project Structure

```
fpv-settling/
├── default.project.json          # Rojo configuration
├── src/
│   ├── client/                   # Client-side code
│   │   ├── init.client.lua       # Client entry point
│   │   ├── PlayerController.lua  # First-person controls
│   │   └── UIManager.lua         # User interface
│   ├── server/                   # Server-side code
│   │   ├── init.server.lua       # Server entry point
│   │   ├── GameManager.lua       # Main game loop
│   │   ├── ResourceManager.lua   # Resource system
│   │   ├── BuildingManager.lua   # Building system
│   │   ├── NPCManager.lua        # NPC/Worker system
│   │   └── ResearchManager.lua   # Technology research
│   └── shared/                   # Shared code
│       ├── ResourceTypes.lua     # Resource definitions
│       ├── BuildingTypes.lua     # Building definitions
│       ├── NPCTypes.lua          # NPC definitions
│       └── TechTree.lua          # Tech tree data
└── README.md
```

## Development Workflow

### Making Changes

1. Edit Lua files in your favorite code editor (VS Code recommended)
2. Save the file
3. The Rojo server will automatically detect changes
4. In Roblox Studio, changes sync automatically (if you see "Rojo Connected")
5. Test your changes by clicking Play in Roblox Studio

### Recommended VS Code Extensions

- **Roblox LSP** - Lua language server for Roblox
- **Selene** - Lua linter
- **StyLua** - Lua formatter

### Using Git

```bash
# Check status
git status

# Add changes
git add .

# Commit
git commit -m "Description of changes"

# Push
git push origin main
```

## Troubleshooting

### Rojo won't connect
- Ensure Rojo server is running (`rojo serve`)
- Check that port 34872 is not blocked by firewall
- Try restarting Roblox Studio

### Changes not appearing in Studio
- Verify Rojo shows "Connected" in Studio
- Try clicking "Sync In" again in the Rojo plugin
- Restart the Rojo server

### Script errors in Studio
- Check the Output window (View → Output)
- Verify all required modules are properly synced
- Ensure file structure matches `default.project.json`

### Module not found errors
- Ensure all parent folders are synced
- Check that paths in `require()` statements are correct
- Try stopping and restarting the game in Studio

## Game Controls (In-Game)

- **WASD** - Move character
- **Mouse** - Look around (first-person view)
- **B** - Toggle build mode
- **H** - Hire worker
- **G** - Hire guard
- **R** - Open research menu

## Next Steps

Now that you have the development environment set up:

1. Explore the codebase to understand how systems work
2. Try modifying resource values in `ResourceTypes.lua`
3. Add a new building type in `BuildingTypes.lua`
4. Create a new technology in `TechTree.lua`
5. Enhance the UI in `UIManager.lua`

## Resources

- [Rojo Documentation](https://rojo.space/docs)
- [Roblox Developer Hub](https://create.roblox.com/docs)
- [Lua Learning Resources](https://www.lua.org/manual/5.1/)
- [Roblox API Reference](https://create.roblox.com/docs/reference/engine)

## Getting Help

- Check the [GitHub Issues](https://github.com/eserlan/fpv-settling/issues)
- Read the [Rojo Discord](https://discord.gg/rojo)
- Visit the [Roblox Developer Forum](https://devforum.roblox.com)

Happy developing! 🎮
