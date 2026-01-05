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

let currentTurnUserId: number | undefined;
let currentTurnStep: string | undefined;
let isSetupPhase = false;
let lastScores: { userId: number; name: string; score: number }[] = [];

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

const turnPanel = new Instance("Frame");
turnPanel.Name = "TurnPanel";
turnPanel.Size = new UDim2(1, -10, 0, 40);
turnPanel.Position = new UDim2(0, 5, 0, 40);
turnPanel.BackgroundColor3 = Color3.fromRGB(40, 40, 60);
turnPanel.BackgroundTransparency = 0.4;
turnPanel.BorderSizePixel = 0;
turnPanel.Visible = false;
turnPanel.Parent = mainFrame;

const turnCorner = new Instance("UICorner");
turnCorner.CornerRadius = new UDim(0, 6);
turnCorner.Parent = turnPanel;

const turnIcon = new Instance("TextLabel");
turnIcon.Name = "Icon";
turnIcon.Size = new UDim2(0, 30, 1, 0);
turnIcon.Position = new UDim2(0, 5, 0, 0);
turnIcon.BackgroundTransparency = 1;
turnIcon.Text = "👉";
turnIcon.TextSize = 18;
turnIcon.Parent = turnPanel;

const turnLabel = new Instance("TextLabel");
turnLabel.Name = "TurnLabel";
turnLabel.Size = new UDim2(1, -40, 1, 0);
turnLabel.Position = new UDim2(0, 35, 0, 0);
turnLabel.BackgroundTransparency = 1;
turnLabel.TextColor3 = Color3.fromRGB(200, 200, 255);
turnLabel.Font = Enum.Font.GothamMedium;
turnLabel.TextSize = 13;
turnLabel.TextXAlignment = Enum.TextXAlignment.Left;
turnLabel.Text = "Waiting for game...";
turnLabel.Parent = turnPanel;

const playerList = new Instance("ScrollingFrame");
playerList.Name = "PlayerList";
playerList.Size = new UDim2(1, -10, 1, -85);
playerList.Position = new UDim2(0, 5, 0, 80);
playerList.BackgroundTransparency = 1;
playerList.ScrollBarThickness = 2;
playerList.CanvasSize = new UDim2(0, 0, 0, 0);
playerList.Parent = mainFrame;

const layout = new Instance("UIListLayout");
layout.Padding = new UDim(0, 4);
layout.SortOrder = Enum.SortOrder.LayoutOrder;
layout.Parent = playerList;

const updateScores = (scores: { userId: number; name: string; score: number }[]) => {
    lastScores = scores;
    playerList.ClearAllChildren();

    const layout = new Instance("UIListLayout");
    layout.Padding = new UDim(0, 4);
    layout.SortOrder = Enum.SortOrder.LayoutOrder;
    layout.Parent = playerList;

    // Sort scores descending
    scores.sort((a, b) => a.score > b.score);

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

        // Highlight if it's their turn in setup phase
        if (isSetupPhase && data.userId === currentTurnUserId) {
            entry.BackgroundTransparency = 0.8;
            entry.BackgroundColor3 = Color3.fromRGB(255, 255, 150);
            nameLabel.TextColor3 = Color3.fromRGB(255, 255, 150);

            // Add a small bulb or indicator
            const turnIndicator = new Instance("Frame");
            turnIndicator.Size = new UDim2(0, 4, 0.6, 0);
            turnIndicator.Position = new UDim2(0, 0, 0.2, 0);
            turnIndicator.BackgroundColor3 = Color3.fromRGB(255, 215, 0);
            turnIndicator.BorderSizePixel = 0;
            turnIndicator.Parent = entry;
        }
    }

    playerList.CanvasSize = new UDim2(0, 0, 0, scores.size() * 34);

    // Adjust frame height based on player count and if setup phase
    const baseHeight = isSetupPhase ? 90 : 50;
    const targetHeight = math.clamp(baseHeight + scores.size() * 34, 50, 500);
    TweenService.Create(mainFrame, new TweenInfo(0.3), { Size: new UDim2(0, 220, 0, targetHeight) }).Play();
};

const updateTurnDisplay = () => {
    if (isSetupPhase && currentTurnUserId !== undefined) {
        turnPanel.Visible = true;
        playerList.Position = new UDim2(0, 5, 0, 85);
        playerList.Size = new UDim2(1, -10, 1, -90);

        const currentPlayerName = lastScores.find(s => s.userId === currentTurnUserId)?.name ?? "Player";
        const stepName = currentTurnStep?.gsub("%d", "")[0] ?? "Structure";
        turnLabel.Text = `${currentPlayerName}: Place ${stepName}`;

        if (currentTurnUserId === player.UserId) {
            turnLabel.TextColor3 = Color3.fromRGB(255, 255, 150);
            turnPanel.BackgroundColor3 = Color3.fromRGB(60, 60, 40);
        } else {
            turnLabel.TextColor3 = Color3.fromRGB(200, 200, 255);
            turnPanel.BackgroundColor3 = Color3.fromRGB(40, 40, 60);
        }
    } else {
        turnPanel.Visible = false;
        playerList.Position = new UDim2(0, 5, 0, 40);
        playerList.Size = new UDim2(1, -10, 1, -45);
    }
    updateScores(lastScores);
};

ClientEvents.ScoresUpdate.connect((scores) => {
    updateScores(scores);
});

ClientEvents.SetupTurnUpdate.connect((userId, step) => {
    isSetupPhase = true;
    currentTurnUserId = userId;
    currentTurnStep = step;
    updateTurnDisplay();
});

ClientEvents.TimerEvent.connect((seconds) => {
    if (seconds > 0 && isSetupPhase) {
        isSetupPhase = false;
        updateTurnDisplay();
    }
});

ClientEvents.GameStart.connect(() => {
    screenGui.Enabled = true;
    isSetupPhase = false; // Will be set true by SetupTurnUpdate if it comes
});

screenGui.Enabled = false; // Wait for GameStart

Logger.Info("ScoreboardUI", "Initialized");

export = {};
