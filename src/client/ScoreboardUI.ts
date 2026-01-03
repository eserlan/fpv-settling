// Scoreboard UI Component
const Players = game.GetService("Players");
const TweenService = game.GetService("TweenService");
import { ClientEvents } from "./ClientEvents";
import * as Logger from "shared/Logger";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

// UI elements
const screenGui = new Instance("ScreenGui");
screenGui.Name = "ScoreboardUI";
screenGui.ResetOnSpawn = false;
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
screenGui.Parent = playerGui;

const mainFrame = new Instance("Frame");
mainFrame.Name = "MainFrame";
mainFrame.Size = new UDim2(0, 220, 0, 45); // Start small
mainFrame.Position = new UDim2(1, -230, 0, 320); // Below building menu
mainFrame.BackgroundColor3 = Color3.fromRGB(20, 20, 25);
mainFrame.BackgroundTransparency = 0.2;
mainFrame.BorderSizePixel = 0;
mainFrame.Parent = screenGui;

const corner = new Instance("UICorner");
corner.CornerRadius = new UDim(0, 8);
corner.Parent = mainFrame;

const stroke = new Instance("UIStroke");
stroke.Color = Color3.fromRGB(100, 100, 120);
stroke.Thickness = 1.5;
stroke.Transparency = 0.5;
stroke.Parent = mainFrame;

const title = new Instance("TextLabel");
title.Name = "Title";
title.Size = new UDim2(1, 0, 0, 35);
title.BackgroundTransparency = 1;
title.Text = "🏆 SCOREBOARD";
title.TextColor3 = Color3.fromRGB(255, 215, 0); // Gold
title.Font = Enum.Font.GothamBold;
title.TextSize = 16;
title.Parent = mainFrame;

const divider = new Instance("Frame");
divider.Name = "Divider";
divider.Size = new UDim2(0.9, 0, 0, 1);
divider.Position = new UDim2(0.05, 0, 0, 35);
divider.BackgroundColor3 = Color3.fromRGB(255, 215, 0);
divider.BackgroundTransparency = 0.6;
divider.BorderSizePixel = 0;
divider.Parent = mainFrame;

const playerList = new Instance("ScrollingFrame");
playerList.Name = "PlayerList";
playerList.Size = new UDim2(1, -10, 1, -45);
playerList.Position = new UDim2(0, 5, 0, 40);
playerList.BackgroundTransparency = 1;
playerList.ScrollBarThickness = 2;
playerList.CanvasSize = new UDim2(0, 0, 0, 0);
playerList.Parent = mainFrame;

const layout = new Instance("UIListLayout");
layout.Padding = new UDim(0, 4);
layout.SortOrder = Enum.SortOrder.LayoutOrder;
layout.Parent = playerList;

const updateScores = (scores: { userId: number; name: string; score: number }[]) => {
    playerList.ClearAllChildren();

    const layout = new Instance("UIListLayout");
    layout.Padding = new UDim(0, 4);
    layout.SortOrder = Enum.SortOrder.LayoutOrder;
    layout.Parent = playerList;

    // Sort scores descending
    scores.sort((a, b) => b.score > a.score);

    for (let i = 0; i < scores.size(); i++) {
        const data = scores[i];
        const entry = new Instance("Frame");
        entry.Name = data.name;
        entry.Size = new UDim2(1, 0, 0, 30);
        entry.BackgroundTransparency = 1;
        entry.LayoutOrder = i;
        entry.Parent = playerList;

        const nameLabel = new Instance("TextLabel");
        nameLabel.Name = "PlayerName";
        nameLabel.Size = new UDim2(0.7, 0, 1, 0);
        nameLabel.Position = new UDim2(0.05, 0, 0, 0);
        nameLabel.BackgroundTransparency = 1;
        nameLabel.Text = data.name;
        nameLabel.TextColor3 = Color3.fromRGB(230, 230, 230);
        nameLabel.Font = Enum.Font.Gotham;
        nameLabel.TextSize = 14;
        nameLabel.TextXAlignment = Enum.TextXAlignment.Left;
        nameLabel.Parent = entry;

        const scoreLabel = new Instance("TextLabel");
        scoreLabel.Name = "Score";
        scoreLabel.Size = new UDim2(0.2, 0, 1, 0);
        scoreLabel.Position = new UDim2(0.75, 0, 0, 0);
        scoreLabel.BackgroundTransparency = 1;
        scoreLabel.Text = tostring(data.score);
        scoreLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
        scoreLabel.Font = Enum.Font.GothamBold;
        scoreLabel.TextSize = 16;
        scoreLabel.TextXAlignment = Enum.TextXAlignment.Right;
        scoreLabel.Parent = entry;

        if (data.userId === player.UserId) {
            nameLabel.TextColor3 = Color3.fromRGB(100, 255, 100);
            scoreLabel.TextColor3 = Color3.fromRGB(100, 255, 100);
        }
    }

    playerList.CanvasSize = new UDim2(0, 0, 0, scores.size() * 34);

    // Adjust frame height based on player count
    const targetHeight = math.clamp(50 + scores.size() * 34, 50, 400);
    TweenService.Create(mainFrame, new TweenInfo(0.3), { Size: new UDim2(0, 220, 0, targetHeight) }).Play();
};

ClientEvents.ScoresUpdate.connect((scores) => {
    updateScores(scores);
});

ClientEvents.GameStart.connect(() => {
    screenGui.Enabled = true;
});

screenGui.Enabled = false; // Wait for GameStart

Logger.Info("ScoreboardUI", "Initialized");

export = {};
