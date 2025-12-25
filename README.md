# FPV Settling

A first-person view Roblox game inspired by The Settlers, featuring resource management, building construction, NPC hiring, and technology research.

## Features

### 🎮 Gameplay
- **First-Person View**: Immersive first-person camera control with mouse look
- **Resource Management**: Gather and manage four key resources:
  - **Wood**: Basic building material
  - **Stone**: Durable construction material
  - **Food**: Sustain your workers and guards
  - **Gold**: Currency for hiring and trading

### 🏗️ Building System
Build and manage your settlement with various structures:
- **Roads**: Connect settlements and increase travel speed
- **Houses**: Provide housing for workers
- **Storage**: Store resources safely with increased capacity
- **Barracks**: Train and house guards for defense
- **Workshops**: Research new technologies

### 👷 NPC Management
Hire and maintain helpers to expand your settlement:
- **Workers**: Gather resources and construct buildings
- **Guards**: Defend your settlement from threats

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

3. Start Rojo server:
```bash
rojo serve
```

4. Open Roblox Studio and install the Rojo plugin from:
   https://www.roblox.com/library/13916111004/Rojo-7

5. In Roblox Studio, click the Rojo plugin button and connect to localhost:34872

6. Your project files will now sync automatically!

## 📁 Project Structure

```
fpv-settling/
├── default.project.json     # Rojo project configuration
├── src/
│   ├── client/              # Client-side scripts
│   │   ├── PlayerController.lua    # First-person camera & controls
│   │   └── UIManager.lua           # User interface
│   ├── server/              # Server-side scripts
│   │   ├── GameManager.lua         # Main game loop
│   │   ├── ResourceManager.lua     # Resource management
│   │   ├── BuildingManager.lua     # Building construction
│   │   ├── NPCManager.lua          # NPC hiring & AI
│   │   └── ResearchManager.lua     # Technology research
│   └── shared/              # Shared modules
│       ├── ResourceTypes.lua       # Resource definitions
│       ├── BuildingTypes.lua       # Building definitions
│       ├── NPCTypes.lua            # NPC definitions
│       └── TechTree.lua            # Technology tree
└── README.md
```

## 🎯 Controls

- **WASD**: Move character
- **Mouse**: Look around (first-person view)
- **B**: Toggle build mode
- **H**: Hire worker
- **G**: Hire guard
- **R**: Open research menu

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
