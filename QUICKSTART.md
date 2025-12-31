# Quick Start Guide

Get started with FPV Settling in 5 minutes!

## Prerequisites
- Roblox Studio installed
- Basic familiarity with Roblox

## 5-Minute Setup

### 1. Install Rojo (choose one method)

**Option A: Using Aftman (recommended)**
```bash
aftman add rojo-rbx/rojo
aftman install
```

**Option B: Direct download**
Download from: https://github.com/rojo-rbx/rojo/releases

### 2. Clone and Start

```bash
# Clone the repository
git clone https://github.com/eserlan/fpv-settling.git
cd fpv-settling

# Start Rojo server
rojo serve
```

Keep this terminal open!

### 3. Connect Roblox Studio

1. Open Roblox Studio
2. Create a new **Baseplate** place
3. Install Rojo plugin: https://www.roblox.com/library/13916111004/Rojo-7
4. Click **Rojo** button in toolbar → **Connect** → **Sync In**

### 4. Play!

Press **F5** to start the game. You should see:
- ✅ Resource display (top-left)
- ✅ Building menu (top-right)
- ✅ Controls help (bottom)
- ✅ First-person camera

## Basic Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look around |
| B | Toggle build mode |
| H | Hire worker |
| G | Hire guard |
| R | Open research |

## Your First Actions

1. **Check your resources** (top-left UI)
   - Starting: 50 Wood, 30 Stone, 20 Food, 100 Gold

2. **Hire a worker** (Press H)
   - Cost: 50 Gold, 10 Food
   - Workers gather resources

3. **Build a road** (Press B, then click)
   - Cost: 5 Wood, 10 Stone
   - Takes 5 seconds to build

4. **Research technology** (Press R - once implemented)
   - Unlock upgrades and new buildings

## What's Next?

- Read [SETUP.md](SETUP.md) for detailed development setup
- Check [TECHNICAL.md](TECHNICAL.md) for architecture details
- See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute

## Common Issues

**"Rojo won't connect"**
- Ensure `rojo serve` is running
- Check port 34872 isn't blocked

**"Can't see my code changes"**
- Save your .ts files
- Ensure `npm run watch` (roblox-ts) is running
- Click "Sync In" in Rojo plugin
- Check Output window for errors

**"Script errors in Output"**
- This is normal for initial alpha version
- Most core systems work despite warnings
- Full multiplayer integration coming soon

## Need Help?

- 📖 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/eserlan/fpv-settling/issues)
- 💬 [Rojo Discord](https://discord.gg/rojo)

Enjoy building your settlement! 🏰
