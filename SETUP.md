# Setup Guide for FPV Settling

This guide will help you set up the development environment and start working on the FPV Settling game.

## Prerequisites

Before you begin, ensure you have:
- **Roblox Studio** installed (via **Vinegar** on Linux)
- **Rojo** for syncing files between your file system and Roblox Studio
- **Node.js** (for the roblox-ts compiler)
- **roblox-ts** (TypeScript-to-Luau build tool)
- **Aftman** (Highly recommended for Linux/Nobara)

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

### Nobara/Fedora Specific (Alternative)
On Nobara, you can also install via `cargo` (ensure you have `gcc-c++` and `openssl-devel`):
```bash
sudo dnf install gcc-c++ openssl-devel
cargo install rojo
```

## Step 2: Clone the Repository

```bash
git clone https://github.com/eserlan/fpv-settling.git
cd fpv-settling
```

## Step 3: Install Roblox Studio & Rojo Plugin

### Windows/macOS
1. Download from [Roblox Create](https://www.roblox.com/create).
2. Install the **Rojo 7** plugin.

### Linux (Nobara/Fedora) - Using Vinegar
Roblox Studio is not officially supported on Linux, but **Vinegar** is the recommended choice for Nobara:

1. **Install Vinegar via Flatpak**:
   ```bash
   flatpak install flathub org.vinegarhq.Vinegar
   ```
2. **Setup Studio**:
   - Open Vinegar from your application menu.
   - Select **Install Studio**.
   - Note: If using the Flatpak version, ensure it has permissions to access your project directory (use `Flatseal` to manage permissions if needed).

3. **Install Rojo Plugin in Studio**:
   
   There are several ways to install the Rojo plugin:

   #### Option A: From Roblox Marketplace (Easiest)
   - Open Roblox Studio via Vinegar.
   - In a web browser, visit the [Rojo 7 Plugin](https://www.roblox.com/library/13916111004/Rojo-7) page.
   - Click **Get** to add the plugin to your account.
   - Restart Roblox Studio—the plugin should appear in the **Plugins** toolbar.

   #### Option B: Manual Installation from GitHub (Recommended for Linux)
   If the marketplace doesn't work properly on Linux, install manually:

   1. **Download the plugin file**:
      - Go to the [Rojo Releases page](https://github.com/rojo-rbx/rojo/releases).
      - Download the file named `Rojo.rbxm` from the latest release's **Assets** section.

   2. **Locate your Roblox plugins folder**:
      - **Vinegar (Flatpak)**: The plugins folder is typically at:
        ```
        ~/.var/app/org.vinegarhq.Vinegar/data/vinegar/prefixes/studio/drive_c/users/<username>/AppData/Local/Roblox/Plugins
        ```
      - **Note**: Replace `<username>` with your Wine username (often `steamuser` or your Linux username).
      - You can also check Vinegar's Studio Data directory via its settings/logs.

   3. **Copy the plugin**:
      ```bash
      # Example for Flatpak Vinegar (adjust path as needed)
      cp ~/Downloads/Rojo.rbxm ~/.var/app/org.vinegarhq.Vinegar/data/vinegar/prefixes/studio/drive_c/users/steamuser/AppData/Local/Roblox/Plugins/
      ```

   4. **Restart Roblox Studio** to load the plugin.

   #### Verify Plugin Installation
   - Open Roblox Studio.
   - Look for a **Rojo** button in the **Plugins** tab of the ribbon toolbar.
   - If you see it, the plugin is installed correctly!

## Step 4: Install roblox-ts Dependencies

Install npm dependencies and start the TypeScript compiler in watch mode:

```bash
npm install
npm run watch
```

Keep the watch process running while you work. It will output compiled Luau to `out/`.

## Step 5: Start Rojo Server

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
│   │   ├── init.client.ts        # Client entry point
│   │   ├── PlayerController.ts   # First-person controls
│   │   └── UIManager.ts          # User interface
│   ├── server/                   # Server-side code
│   │   ├── init.server.ts        # Server entry point
│   │   ├── GameManager.ts        # Main game loop
│   │   ├── ResourceManager.ts    # Resource system
│   │   ├── BuildingManager.ts    # Building system
│   │   ├── NPCManager.ts         # NPC/Worker system
│   │   └── ResearchManager.ts    # Technology research
│   └── shared/                   # Shared code
│       ├── ResourceTypes.ts      # Resource definitions
│       ├── BuildingTypes.ts      # Building definitions
│       ├── NPCTypes.ts           # NPC definitions
│       ├── TechTree.ts           # Tech tree data
│       └── TileTypes.ts          # Terrain/Resource definitions
└── README.md

## Procedural World Generation

The game now features a **Settlers-inspired procedural map**:
- **Hexagonal Grid**: Built on an axial coordinate system.
- **Biomes**: Includes Forest, Fields, Pasture, Hills, Mountains, and Desert.
- **Resource Distribution**: Tile frequency matches strategy board game standards for balanced early-to-mid game play.
- **Dynamic Elevation**: Mountains and hills have physical height in the world to aid navigation and visual appeal.
- **Attribute System**: Each tile part has attributes (`TileType`, `Resource`, `Q`, `R`) that systems can query.
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

## Rojo CLI Deployment Workflow

For Linux developers using **Sober** or wanting to deploy directly to a Roblox server, use the standalone Rojo CLI.

### 1. Configure Authentication
Create a `.env` file in the project root to store your credentials (already ignored in `.gitignore`):

```bash
ROBLOX_COOKIE="your_full_roblosecurity_cookie"
DEV_PLACE_ID="your_target_place_id"
```

#### How to get your credentials:
- **ROBLOX_COOKIE**:
    1. Log into your Roblox account in a web browser.
    2. Open Developer Tools (`F12` or `Ctrl+Shift+I`).
    3. Navigate to the **Application** (or **Storage**) tab and select **Cookies** -> `https://www.roblox.com`.
    4. Find the `.ROBLOSECURITY` cookie and copy its **entire** value (it starts with `_|WARNING:-DO-NOT-SHARE`).
- **DEV_PLACE_ID**:
    1. Open your game's page on the Roblox website.
    2. The ID is the long string of numbers in the URL: `roblox.com/games/123456789/...`
    3. Alternatively, find it in the **Creator Dashboard** under the game's **Experiences** tab.

> [!CAUTION]
> Never share your `.ROBLOSECURITY` cookie with anyone. It gives full access to your account.

### 2. VS Code Task Integration
The project includes a VS Code build task in `.vscode/tasks.json`.

- **Push/Upload**: Press `Ctrl + Shift + B`
- This runs: `source .env && rojo upload --asset-id $DEV_PLACE_ID --cookie "$ROBLOX_COOKIE"`

### 3. Linux/Sober Workflow
1. Edit code in VS Code.
2. Press `Ctrl + Shift + B` to push changes to your Dev Place.
3. Launch **Sober** to playtest on the live server.

## Troubleshooting

### Rojo won't connect
- Ensure Rojo server is running (`rojo serve`)
- Check that port 34872 is not blocked by firewall
- **Linux Tip**: If using Vinegar/Flatpak, ensure the browser and Studio can "see" each other. Usually `localhost` works, but some network namespaces in Flatpak might require using `127.0.0.1` or checking your `hosts` file.
- Try restarting Roblox Studio

### Linux: Studio Performance on Nobara
- If you experience lag, check Vinegar's settings to use **Vulkan** instead of OpenGL.
- Ensure your GPU drivers (Nvidia/AMD) are up to date via the Nobara Update System.

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
2. Try modifying resource values in `ResourceTypes.ts`
3. Add a new building type in `BuildingTypes.ts`
4. Create a new technology in `TechTree.ts`
5. Enhance the UI in `UIManager.ts`

## Resources

- [Rojo Documentation](https://rojo.space/docs)
- [Roblox Developer Hub](https://create.roblox.com/docs)
- [roblox-ts Documentation](https://roblox-ts.com/docs)
- [Roblox API Reference](https://create.roblox.com/docs/reference/engine)

## Getting Help

- Check the [GitHub Issues](https://github.com/eserlan/fpv-settling/issues)
- Read the [Rojo Discord](https://discord.gg/rojo)
- Visit the [Roblox Developer Forum](https://devforum.roblox.com)

Happy developing! 🎮
