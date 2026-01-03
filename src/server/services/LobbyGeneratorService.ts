import { Service, OnStart } from "@flamework/core";
import { Workspace } from "@rbxts/services";
import * as SharedLogger from "shared/Logger";

@Service({})
export class LobbyGeneratorService implements OnStart {
    onStart() {
        SharedLogger.Info("LobbyGeneratorService", "Initialized");
    }

    public GenerateLobby() {
        const lobbyFolder = (Workspace.FindFirstChild("Lobby") as Folder) ?? new Instance("Folder", Workspace);
        lobbyFolder.Name = "Lobby";
        lobbyFolder.ClearAllChildren();

        const platform = new Instance("Part");
        platform.Name = "LobbyPlatform";
        platform.Size = new Vector3(80, 2, 80);
        platform.Position = new Vector3(0, 100, 0);
        platform.Anchored = true;
        platform.Color = new Color3(0.5, 0.5, 0.5);
        platform.Material = Enum.Material.Concrete;
        platform.Parent = lobbyFolder;

        const spawn = new Instance("SpawnLocation");
        spawn.Name = "LobbySpawn";
        spawn.Size = new Vector3(12, 1, 12);
        spawn.Position = new Vector3(0, 101.5, 0);
        spawn.Anchored = true;
        spawn.CanCollide = false;
        spawn.Transparency = 0;
        spawn.Parent = lobbyFolder;

        // Add walls
        const wallHeight = 20;
        const wallThickness = 2;
        const offset = 40 - wallThickness / 2;

        const walls = [
            { size: new Vector3(80, wallHeight, wallThickness), pos: new Vector3(0, 100 + wallHeight / 2, -offset) },
            { size: new Vector3(80, wallHeight, wallThickness), pos: new Vector3(0, 100 + wallHeight / 2, offset) },
            { size: new Vector3(wallThickness, wallHeight, 80), pos: new Vector3(-offset, 100 + wallHeight / 2, 0) },
            { size: new Vector3(wallThickness, wallHeight, 80), pos: new Vector3(offset, 100 + wallHeight / 2, 0) },
        ];

        walls.forEach((w, i) => {
            const wall = new Instance("Part");
            wall.Name = `Wall_${i}`;
            wall.Size = w.size;
            wall.Position = w.pos;
            wall.Anchored = true;
            wall.Transparency = 0.5;
            wall.Color = new Color3(0.3, 0.3, 0.3);
            wall.Parent = lobbyFolder;
        });

        // Add Rooms (8 total, 2 per wall)
        const roomFolder = new Instance("Folder");
        roomFolder.Name = "Rooms";
        roomFolder.Parent = lobbyFolder;

        for (let i = 1; i <= 8; i++) {
            const room = new Instance("Folder");
            room.Name = `Room_${i}`;
            room.SetAttribute("RoomId", i);
            room.Parent = roomFolder;

            // Determine wall and position along wall
            const wallIndex = math.floor((i - 1) / 2); // 0, 1, 2, 3
            const subIndex = (i - 1) % 2; // 0, 1
            const posOnWall = subIndex === 0 ? -20 : 20;

            let roomPos = new Vector3(0, 100, 0);
            let wallFacing = new Vector3(0, 0, 1);

            if (wallIndex === 0) { // Top Wall (North)
                roomPos = new Vector3(posOnWall, 101, -38); // On the face (center is -39, thickness 2)
                wallFacing = new Vector3(0, 0, 1); // Facing inward
            } else if (wallIndex === 1) { // Bottom Wall (South)
                roomPos = new Vector3(posOnWall, 101, 38);
                wallFacing = new Vector3(0, 0, -1);
            } else if (wallIndex === 2) { // Left Wall (West)
                roomPos = new Vector3(-38, 101, posOnWall);
                wallFacing = new Vector3(1, 0, 0);
            } else if (wallIndex === 3) { // Right Wall (East)
                roomPos = new Vector3(38, 101, posOnWall);
                wallFacing = new Vector3(-1, 0, 0);
            }

            // Registration Pad (Sized to avoid corner overlap)
            // Pad touches wall face at 38 and extends inward
            const padWidth = 10;
            const padDepth = 8;
            const pad = new Instance("Part");
            pad.Name = "Pad";
            pad.Size = new Vector3(padWidth, 0.4, padDepth);
            // Center the pad so it touches the wall and extends into the lobby (inward is -Z in lookAt)
            pad.CFrame = CFrame.lookAt(roomPos, roomPos.add(wallFacing)).mul(new CFrame(0, 0, -padDepth / 2));
            pad.Anchored = true;
            pad.Color = Color3.fromRGB(50, 50, 70);
            pad.Material = Enum.Material.Glass;
            pad.Transparency = 0.5;
            pad.SetAttribute("RoomId", i);
            pad.Parent = room;

            // Wall Label (SurfaceGui on a larger thin plate)
            const labelPart = new Instance("Part");
            labelPart.Name = "LabelPart";
            labelPart.Size = new Vector3(14, 10, 0.05); // Larger surface
            // Position slightly OFFSET from wall to prevent Z-fighting and ensure clicks hit the panel
            labelPart.Position = roomPos.add(new Vector3(0, 11, 0)).add(wallFacing.mul(0.1));
            labelPart.CFrame = CFrame.lookAt(labelPart.Position, labelPart.Position.add(wallFacing));
            labelPart.Anchored = true;
            labelPart.Transparency = 0.99; // Nearly invisible but physically "there" for rays
            labelPart.CanCollide = true;
            labelPart.CanQuery = true;
            labelPart.Parent = room;

            const surfaceGui = new Instance("SurfaceGui");
            surfaceGui.Name = "Display";
            surfaceGui.Face = Enum.NormalId.Front;
            surfaceGui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
            surfaceGui.PixelsPerStud = 50;
            surfaceGui.LightInfluence = 0;
            surfaceGui.Active = true; // Make it interactive
            surfaceGui.Adornee = labelPart;
            surfaceGui.Parent = labelPart;

            const labelFrame = new Instance("Frame");
            labelFrame.Name = "Frame";
            labelFrame.Size = new UDim2(1, 0, 1, 0);
            labelFrame.BackgroundColor3 = new Color3(0, 0, 0);
            labelFrame.BackgroundTransparency = 0.2;
            labelFrame.Parent = surfaceGui;

            const title = new Instance("TextLabel");
            title.Name = "Title";
            title.Size = new UDim2(1, 0, 0.2, 0);
            title.Position = new UDim2(0, 0, 0.05, 0);
            title.Text = `ROOM ${i}`;
            title.TextColor3 = new Color3(1, 1, 1);
            title.BackgroundTransparency = 1;
            title.Font = Enum.Font.GothamBlack;
            title.TextSize = 64; // Bigger text
            title.Parent = labelFrame;

            const status = new Instance("TextLabel");
            status.Name = "Status";
            status.Size = new UDim2(1, -60, 0.7, 0);
            status.Position = new UDim2(0, 30, 0.25, 0);
            status.Text = "Waiting for players...";
            status.TextColor3 = Color3.fromRGB(200, 200, 200);
            status.BackgroundTransparency = 1;
            status.Font = Enum.Font.Gotham;
            status.TextSize = 40; // Bigger text
            status.TextXAlignment = Enum.TextXAlignment.Left;
            status.TextYAlignment = Enum.TextYAlignment.Top;
            status.TextWrapped = true;
            status.Parent = labelFrame;

            // Start Button (Chest height)
            const button = new Instance("Part");
            button.Name = "StartButton";
            button.Size = new Vector3(3, 1, 0.4);
            button.Position = roomPos.add(new Vector3(0, 4, 0)).add(wallFacing.mul(0.2));
            button.CFrame = CFrame.lookAt(button.Position, button.Position.add(wallFacing));
            button.Color = Color3.fromRGB(0, 180, 0);
            button.Material = Enum.Material.Neon;
            button.CanCollide = false;
            button.Anchored = true;
            button.Parent = room;

            const prompt = new Instance("ProximityPrompt");
            prompt.ActionText = "Launch Game";
            prompt.ObjectText = `Room ${i}`;
            prompt.HoldDuration = 1;
            prompt.RequiresLineOfSight = false;
            prompt.Parent = button;
            prompt.SetAttribute("RoomId", i);

            // AI Button (Just below Start)
            const aiButton = new Instance("Part");
            aiButton.Name = "AIButton";
            aiButton.Size = new Vector3(1.5, 0.5, 0.2);
            aiButton.Position = button.Position.sub(new Vector3(0, 1.2, 0));
            aiButton.CFrame = CFrame.lookAt(aiButton.Position, aiButton.Position.add(wallFacing));
            aiButton.Color = Color3.fromRGB(200, 200, 50);
            aiButton.Material = Enum.Material.SmoothPlastic;
            aiButton.Anchored = true;
            aiButton.Parent = room;

            const aiPrompt = new Instance("ProximityPrompt");
            aiPrompt.ActionText = "Add AI Bot";
            aiPrompt.RequiresLineOfSight = false;
            aiPrompt.Parent = aiButton;
            aiPrompt.SetAttribute("RoomId", i);
        }

        SharedLogger.Info("LobbyGeneratorService", "Lobby generated with 8 rooms");
    }
}
