
const Players = game.GetService("Players");
import { ClientEvents } from "./ClientEvents";
import * as Logger from "shared/Logger";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

// Create Lobby UI
const screenGui = new Instance("ScreenGui");
screenGui.Name = "LobbyUI";
screenGui.ResetOnSpawn = false;
screenGui.Enabled = true;
screenGui.Parent = playerGui;

const lobbyFrame = new Instance("Frame");
lobbyFrame.Name = "LobbyFrame";
lobbyFrame.Size = new UDim2(0, 400, 0, 300);
lobbyFrame.Position = new UDim2(0.5, -200, 0.5, -150);
lobbyFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40);
lobbyFrame.BorderSizePixel = 4;
lobbyFrame.BorderColor3 = Color3.fromRGB(100, 100, 100);
lobbyFrame.Parent = screenGui;

const title = new Instance("TextLabel");
title.Name = "Title";
title.Size = new UDim2(1, 0, 0, 60);
title.Text = "Game Lobby";
title.TextSize = 36;
title.Font = Enum.Font.GothamBlack;
title.TextColor3 = Color3.fromRGB(255, 255, 255);
title.BackgroundColor3 = Color3.fromRGB(60, 60, 60);
title.BorderSizePixel = 0;
title.Parent = lobbyFrame;

const statusLabel = new Instance("TextLabel");
statusLabel.Name = "StatusLabel";
statusLabel.Size = new UDim2(1, 0, 0, 40);
statusLabel.Position = new UDim2(0, 0, 0, 80);
statusLabel.Text = "Waiting for players...";
statusLabel.TextSize = 20;
statusLabel.Font = Enum.Font.Gotham;
statusLabel.TextColor3 = Color3.fromRGB(200, 200, 200);
statusLabel.BackgroundTransparency = 1;
statusLabel.Parent = lobbyFrame;

const readyCountLabel = new Instance("TextLabel");
readyCountLabel.Name = "ReadyCount";
readyCountLabel.Size = new UDim2(1, 0, 0, 40);
readyCountLabel.Position = new UDim2(0, 0, 0, 120);
readyCountLabel.Text = "Players Ready: 0/0";
readyCountLabel.TextSize = 24;
readyCountLabel.Font = Enum.Font.GothamBold;
readyCountLabel.TextColor3 = Color3.fromRGB(255, 200, 100);
readyCountLabel.BackgroundTransparency = 1;
readyCountLabel.Parent = lobbyFrame;

const readyButton = new Instance("TextButton");
readyButton.Name = "ReadyButton";
readyButton.Size = new UDim2(0, 200, 0, 60);
readyButton.Position = new UDim2(0.5, -100, 0.8, -30);
readyButton.Text = "NOT READY";
readyButton.TextSize = 24;
readyButton.Font = Enum.Font.GothamBold;
readyButton.BackgroundColor3 = Color3.fromRGB(200, 50, 50);
readyButton.TextColor3 = Color3.fromRGB(255, 255, 255);
readyButton.Parent = lobbyFrame;

const corner = new Instance("UICorner");
corner.CornerRadius = new UDim(0, 8);
corner.Parent = readyButton;

let isReady = false;

readyButton.MouseButton1Click.Connect(() => {
    isReady = !isReady;
    updateButtonState();
    ClientEvents.ToggleReady.fire();
});

function updateButtonState() {
    if (isReady) {
        readyButton.Text = "READY!";
        readyButton.BackgroundColor3 = Color3.fromRGB(50, 200, 50);
    } else {
        readyButton.Text = "NOT READY";
        readyButton.BackgroundColor3 = Color3.fromRGB(200, 50, 50);
    }
}

ClientEvents.LobbyUpdate.connect((readyCount, totalCount) => {
    readyCountLabel.Text = `Players Ready: ${readyCount}/${totalCount}`;
    if (readyCount === totalCount && totalCount > 0) {
        statusLabel.Text = "Starting game soon...";
        statusLabel.TextColor3 = Color3.fromRGB(50, 200, 50);
    } else {
        statusLabel.Text = "Waiting for all players to be ready...";
        statusLabel.TextColor3 = Color3.fromRGB(200, 200, 200);
    }
});

ClientEvents.GameStart.connect(() => {
    screenGui.Enabled = false;
    Logger.Info("LobbyUI", "Game Started - Hiding Lobby UI");
});

Logger.Info("LobbyUI", "Initialized");
