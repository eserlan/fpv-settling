import { Service, OnStart } from "@flamework/core";
import { Players, Workspace } from "@rbxts/services";
import * as Logger from "shared/Logger";
import { ServerEvents } from "../ServerEvents";
import { RoomPlayer, RoomState } from "shared/Events";
import { NetworkUtils } from "../NetworkUtils";
import { GameService } from "./GameService";
import { SkillLevel } from "shared/GameTypes";

@Service({})
export class LobbyService implements OnStart {
    private rooms: Map<number, RoomState> = new Map();
    private playerToRoom: Map<number, number> = new Map();

    constructor(private gameService: GameService) {
        for (let i = 1; i <= 8; i++) {
            this.rooms.set(i, { id: i, players: [], isGameStarted: false });
        }
    }

    onStart() {
        Logger.Info("LobbyService", "Initialized");

        // Connect Networking
        ServerEvents.JoinRoom.connect((player, roomId) => this.JoinRoom(player, roomId));
        ServerEvents.LeaveRoom.connect((player) => this.LeaveRoom(player));
        ServerEvents.AddAIRoom.connect((player, roomId, skill) => this.AddAI(roomId, skill as SkillLevel));
        ServerEvents.RemoveAIRoom.connect((player, roomId, aiUserId) => this.RemoveAI(roomId, aiUserId));
        ServerEvents.StartRoomGame.connect((player, roomId) => this.StartGame(roomId));

        Players.PlayerRemoving.Connect((player) => this.LeaveRoom(player));

        // Setup visuals interaction (Pads and Prompts)
        task.delay(5, () => this.SetupPhysicalInteractions());
    }

    private SetupPhysicalInteractions() {
        const lobby = Workspace.FindFirstChild("Lobby");
        if (!lobby) return;

        const roomsFolder = lobby.FindFirstChild("Rooms");
        if (!roomsFolder) return;

        for (const roomModel of roomsFolder.GetChildren()) {
            const roomId = roomModel.GetAttribute("RoomId") as number;

            // Pad behavior
            const pad = roomModel.FindFirstChild("Pad") as BasePart;
            if (pad) {
                pad.Touched.Connect((hit) => {
                    const character = hit.Parent;
                    if (character && character.IsA("Model")) {
                        const player = Players.GetPlayerFromCharacter(character);
                        if (player) {
                            this.JoinRoom(player, roomId);
                        }
                    }
                });

                pad.TouchEnded.Connect((hit) => {
                    const character = hit.Parent;
                    if (character && character.IsA("Model")) {
                        const player = Players.GetPlayerFromCharacter(character);
                        if (player) {
                            // Wait a moment for limbs to settle, then check if ANY part is still on the pad
                            task.delay(0.1, () => {
                                if (!player || !player.Parent) return;
                                const char = player.Character;
                                if (!char) return;

                                // Check if players is still physically on the pad
                                const parts = Workspace.GetPartsInPart(pad);
                                let stillOnPad = false;
                                for (const part of parts) {
                                    if (part.IsDescendantOf(char)) {
                                        stillOnPad = true;
                                        break;
                                    }
                                }

                                if (!stillOnPad && this.playerToRoom.get(player.UserId) === roomId) {
                                    this.LeaveRoom(player);
                                }
                            });
                        }
                    }
                });
            }

            // Prompt behavior
            const startButton = roomModel.FindFirstChild("StartButton") as BasePart;
            if (startButton) {
                const prompt = startButton.FindFirstChildOfClass("ProximityPrompt");
                if (prompt) {
                    prompt.Triggered.Connect((player) => {
                        const roomId = prompt.GetAttribute("RoomId") as number;
                        this.StartGame(roomId);
                    });
                }
            }

            const aiButton = roomModel.FindFirstChild("AIButton") as BasePart;
            if (aiButton) {
                const prompt = aiButton.FindFirstChildOfClass("ProximityPrompt");
                if (prompt) {
                    prompt.Triggered.Connect((player) => {
                        const roomId = prompt.GetAttribute("RoomId") as number;
                        const skills: SkillLevel[] = ["Beginner", "Intermediate", "Expert"];
                        this.AddAI(roomId, skills[math.random(0, skills.size() - 1)]);
                    });
                }
            }
        }
    }

    public JoinRoom(player: Player, roomId: number) {
        // Prevent spam if already in this room
        if (this.playerToRoom.get(player.UserId) === roomId) return;

        this.LeaveRoom(player);

        const room = this.rooms.get(roomId);
        if (!room || room.isGameStarted) return;
        if (room.players.size() >= 4) {
            NetworkUtils.FireClient(player, ServerEvents.SystemMessageEvent, "Room is full!");
            return;
        }

        room.players.push({
            name: player.Name,
            userId: player.UserId,
            isAI: false,
            isActive: true
        });

        this.playerToRoom.set(player.UserId, roomId);
        this.UpdateRoomDisplay(roomId);
        Logger.Info("LobbyService", `${player.Name} stepped on Room ${roomId} pad`);
    }

    public LeaveRoom(player: Player) {
        const roomId = this.playerToRoom.get(player.UserId);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (room) {
            room.players = room.players.filter(p => p.userId !== player.UserId);
            this.UpdateRoomDisplay(roomId);
            Logger.Info("LobbyService", `${player.Name} stepped off Room ${roomId} pad`);
        }

        this.playerToRoom.delete(player.UserId);
    }

    private GenerateAIName(): string {
        const decorations = ["xX_", "oO_", "ii_", "v_", "The", "Epic", "Elite", "Super", "Real", "Pure"];
        const descriptors = ["Mega", "Blox", "Brick", "Sheep", "Road", "Build", "Trade", "Dark", "Gold", "Hyper"];
        const roots = ["Master", "Slayer", "Warrior", "Legend", "Lord", "Catan", "Noob", "Pro", "Tycoon", "Settler"];
        const suffixes = ["_YT", "123", "99", "HD", "Gaming", "XD", "PvP", "LP", "007", "_Playz"];

        const dec = decorations[math.random(0, decorations.size() - 1)];
        const des = descriptors[math.random(0, descriptors.size() - 1)];
        const root = roots[math.random(0, roots.size() - 1)];
        const suf = suffixes[math.random(0, suffixes.size() - 1)];

        // Mix it up to create varied "Roblox-style" usernames
        const roll = math.random(1, 4);
        if (roll === 1) return `${dec}${root}${suf} `;
        if (roll === 2) return `${des}${root}${suf} `;
        if (roll === 3) return `${dec}${des}${root} `;
        return `${des}${root} `;
    }

    public AddAI(roomId: number, skill: SkillLevel) {
        const room = this.rooms.get(roomId);
        if (!room || room.isGameStarted) return;
        if (room.players.size() >= 4) return;

        const aiId = -(room.players.size() + 1 + (roomId * 10)); // Unique negative ID
        room.players.push({
            name: this.GenerateAIName(),
            userId: aiId,
            isAI: true,
            skill: skill,
            isActive: true
        });

        this.UpdateRoomDisplay(roomId);
    }

    public RemoveAI(roomId: number, aiUserId: number) {
        const room = this.rooms.get(roomId);
        if (!room || room.isGameStarted) return;

        room.players = room.players.filter(root => root.userId !== aiUserId);
        this.UpdateRoomDisplay(roomId);
    }

    public StartGame(roomId: number) {
        const room = this.rooms.get(roomId);
        if (!room || room.isGameStarted || room.players.size() === 0) return;

        room.isGameStarted = true;
        this.UpdateRoomDisplay(roomId);

        Logger.Info("LobbyService", `Starting game for Room ${roomId} with ${room.players.size()} entities`);

        this.gameService.StartRoomGame(room.players.map(p => ({
            userId: p.userId,
            name: p.name,
            isAI: p.isAI,
            skill: p.skill
        })));
    }

    private UpdateRoomDisplay(roomId: number) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const lobby = Workspace.FindFirstChild("Lobby");
        const roomsFolder = lobby?.FindFirstChild("Rooms");
        const roomModel = roomsFolder?.FindFirstChild(`Room_${roomId} `);

        const labelPart = roomModel?.FindFirstChild("LabelPart");
        const display = labelPart?.FindFirstChild("Display") as SurfaceGui;
        const frame = display?.FindFirstChild("Frame") as Frame;

        if (frame) {
            // Clean up old status/rows
            frame.GetChildren().forEach(child => {
                if (child.Name !== "Title" && !child.IsA("UIListLayout") && !child.IsA("UIPadding")) {
                    child.Destroy();
                }
            });

            // Ensure layout exists
            let layout = frame.FindFirstChildOfClass("UIListLayout");
            if (!layout) {
                layout = new Instance("UIListLayout");
                layout.SortOrder = Enum.SortOrder.LayoutOrder;
                layout.Padding = new UDim(0, 5);
                layout.Parent = frame;
            }

            let padding = frame.FindFirstChildOfClass("UIPadding");
            if (!padding) {
                padding = new Instance("UIPadding");
                padding.PaddingTop = new UDim(0, 100); // Below Title
                padding.PaddingLeft = new UDim(0, 20);
                padding.PaddingRight = new UDim(0, 20);
                padding.Parent = frame;
            }

            if (room.isGameStarted) {
                const status = new Instance("TextLabel");
                status.Name = "StatusLabel";
                status.Size = new UDim2(1, 0, 0, 50);
                status.Text = "GAME IN PROGRESS";
                status.TextColor3 = Color3.fromRGB(50, 255, 50);
                status.BackgroundTransparency = 1;
                status.Font = Enum.Font.GothamBold;
                status.TextSize = 40;
                status.Parent = frame;
            } else if (room.players.size() === 0) {
                const status = new Instance("TextLabel");
                status.Name = "StatusLabel";
                status.Size = new UDim2(1, 0, 0, 50);
                status.Text = "Waiting for players...";
                status.TextColor3 = Color3.fromRGB(200, 200, 200);
                status.BackgroundTransparency = 1;
                status.Font = Enum.Font.Gotham;
                status.TextSize = 32;
                status.Parent = frame;
            } else {
                room.players.forEach((p, idx) => {
                    const row = new Instance("Frame");
                    row.Name = `PlayerRow_${p.userId} `;
                    row.Size = new UDim2(1, 0, 0, 50);
                    row.BackgroundTransparency = 1;
                    row.LayoutOrder = idx;
                    row.Parent = frame;

                    const nameLabel = new Instance("TextLabel");
                    nameLabel.Size = new UDim2(0.8, 0, 1, 0);
                    const participantType = p.isAI ? `[AI ${p.skill}]` : "[Player]";
                    nameLabel.Text = `${participantType} ${p.name} `;
                    nameLabel.TextColor3 = new Color3(1, 1, 1);
                    nameLabel.TextSize = 32;
                    nameLabel.Font = Enum.Font.Gotham;
                    nameLabel.TextXAlignment = Enum.TextXAlignment.Left;
                    nameLabel.BackgroundTransparency = 1;
                    nameLabel.Parent = row;

                    if (p.isAI) {
                        const deleteBtn = new Instance("TextButton");
                        deleteBtn.Name = "RemoveAI";
                        deleteBtn.Size = new UDim2(0, 60, 0, 60); // Larger
                        deleteBtn.Position = new UDim2(1, -70, 0, -5);
                        deleteBtn.Text = "X";
                        deleteBtn.TextColor3 = new Color3(1, 1, 1);
                        deleteBtn.BackgroundColor3 = Color3.fromRGB(200, 50, 50);
                        deleteBtn.AutoButtonColor = true;
                        deleteBtn.Font = Enum.Font.GothamBold;
                        deleteBtn.TextSize = 32;
                        deleteBtn.SetAttribute("AIUserId", p.userId);
                        deleteBtn.SetAttribute("RoomId", roomId);
                        deleteBtn.Parent = row;

                        const corner = new Instance("UICorner");
                        corner.CornerRadius = new UDim(0, 4);
                        corner.Parent = deleteBtn;
                    }
                });
            }
        }

        // Also sync to clients for any other UI (Flamework handles serialization)
        NetworkUtils.Broadcast(ServerEvents.RoomUpdate, roomId, room);
    }
}
