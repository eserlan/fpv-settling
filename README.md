# FPV Settling

A first-person view Roblox game inspired by The Settlers, featuring resource management, building construction, NPC hiring, and technology research.

## Features

### 🎮 Gameplay
- **First-Person View**: Immersive first-person camera control with mouse look
- **Resource Management**: Gather and manage five key resources:
  - **Wood**: Basic building material from forests
  - **Brick**: Construction material from hills
  - **Wheat**: Grain from fields for towns
  - **Wool**: From pastures for trading
  - **Ore**: Iron ore from mountains for advanced construction

### ⚓ Port Trading System
Trade resources at advantageous rates by building towns on port intersections:
- **Bank Trading (4:1)**: Available to all players - trade 4 of any resource for 1 of any other
- **Generic Ports (3:1)**: Trade 3 of any resource for 1 of any other (marked with ❓)
- **Specialized Ports (2:1)**: Trade 2 of a specific resource for 1 of any other
  - Wood Port (🌲): 2 Wood → 1 of any resource
  - Brick Port (🧱): 2 Brick → 1 of any resource
  - Wheat Port (🌾): 2 Wheat → 1 of any resource
  - Ore Port (⛏): 2 Ore → 1 of any resource
  - Wool Port (🧶): 2 Wool → 1 of any resource
- **Harbor Master Bonus**: Own 3+ ports to unlock special abilities and recognition
- **Port Control**: Build towns on coastal intersections marked by port icons to gain trading advantages

### 🏗️ Building System
Build and manage your town with various structures:
- **Roads**: Connect towns and increase travel speed
- **Houses**: Provide housing for workers
- **Storage**: Store resources safely with increased capacity
- **Barracks**: Train and house guards for defense
- **Workshops**: Research new technologies

### 👷 NPC Management
Hire and maintain helpers to expand your town:
- **Workers**: Gather resources and construct buildings
- **Guards**: Defend your town from threats

Each NPC requires:
- Initial hiring cost (Gold + Food)
- Ongoing maintenance (Food per minute)

### 🔬 Technology Research
Unlock powerful upgrades through research:
- **Improved Tools**: Increase resource gathering speed by 25%
- **Stone Work**: Unlock advanced stone buildings
- **Agriculture**: Boost food production by 50%
- **Military Training**: Enhance guard effectiveness by 30%
- **Advanced Engineering**: Reduce building costs by 20%
- **Trading**: Unlock trading posts and better exchange rates

## 🛠️ Development Setup

**New to the project? Start here:**
- 🚀 [Quick Start Guide](QUICKSTART.md) - Get running in 5 minutes
- 📖 [Setup Guide](SETUP.md) - Detailed development environment setup
- 🏗️ [Technical Overview](TECHNICAL.md) - Architecture and system design
- 🤝 [Contributing Guide](CONTRIBUTING.md) - How to contribute

### Prerequisites
- [Rojo](https://rojo.space/) - Syncs project files with Roblox Studio
- [Node.js](https://nodejs.org/) - Required for roblox-ts
- [roblox-ts](https://roblox-ts.com/) - TypeScript to Luau compiler
- Roblox Studio

### Installation

1. Clone the repository:
```bash
git clone https://github.com/eserlan/fpv-settling.git
cd fpv-settling
```

2. Install Rojo (if not already installed):
```bash
# Using Cargo
cargo install rojo

# Or download from https://github.com/rojo-rbx/rojo/releases
```

3. Install dependencies and start the roblox-ts compiler (in watch mode):
```bash
npm install
npm run watch
```

4. Start Rojo server:
```bash
rojo serve
```

5. Open Roblox Studio and install the Rojo plugin from:
   https://www.roblox.com/library/13916111004/Rojo-7

6. In Roblox Studio, click the Rojo plugin button and connect to localhost:34872

7. Your project files will now sync automatically!

## 📁 Project Structure

```
fpv-settling/
├── default.project.json     # Rojo project configuration
├── src/
│   ├── client/              # Client-side scripts
│   │   ├── PlayerController.ts     # First-person camera & controls
│   │   ├── UIManager.ts            # User interface
│   │   └── TradeUI.ts              # Port trading interface
│   ├── server/              # Server-side scripts
│   │   ├── GameManager.ts          # Main game loop
│   │   ├── ResourceManager.ts      # Resource management
│   │   ├── BuildingManager.ts      # Building construction
│   │   ├── PortManager.ts          # Port trading & ownership
│   │   ├── MapGenerator.ts         # Hexagonal map with ports
│   │   ├── NPCManager.ts           # NPC hiring & AI
│   │   └── ResearchManager.ts      # Technology research
│   └── shared/              # Shared modules
│       ├── ResourceTypes.ts        # Resource definitions
│       ├── BuildingTypes.ts        # Building definitions
│       ├── PortTypes.ts            # Port definitions & trade ratios
│       ├── NPCTypes.ts             # NPC definitions
│       └── TechTree.ts             # Technology tree
└── README.md
```

## 🎯 Controls

- **WASD**: Move character
- **Shift**: Sprint
- **Mouse**: Look around (first-person view)
- **B**: Open blueprint book
- **T**: Open trade menu (port/bank trading)
- **E**: Deposit resources into foundations
- **Alt+C**: Open dev panel

## 🚀 Future Development

Planned features and improvements:
- [ ] Multiplayer support
- [ ] More building types (farms, mines, trading posts)
- [ ] Enemy AI and combat system
- [ ] Advanced pathfinding for NPCs
- [ ] Seasons and weather effects
- [ ] Trading between players
- [ ] Quest system
- [ ] Achievements and progression
- [ ] Enhanced graphics and particle effects
- [ ] Sound effects and music

## 📝 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For questions or suggestions, please open an issue on GitHub.
