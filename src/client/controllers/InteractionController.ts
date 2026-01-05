import { Players, Workspace, UserInputService, RunService } from "@rbxts/services";
import * as Logger from "shared/Logger";
import { ClientEvents } from "client/ClientEvents";

const player = Players.LocalPlayer;

export class InteractionController {
    private nearbyFoundation: { Id: number; Model: Model; Part: BasePart } | undefined;
    private promptFrame: Frame | undefined;
    private screenGui: ScreenGui | undefined;

    constructor() {
        this.CreateDepositPrompt();
        RunService.RenderStepped.Connect(() => this.Update());
    }

    private CreateDepositPrompt() {
        this.screenGui = new Instance("ScreenGui");
        this.screenGui.Name = "DepositPrompt";
        this.screenGui.ResetOnSpawn = false;
        this.screenGui.Parent = player.WaitForChild("PlayerGui") as PlayerGui;

        const frame = new Instance("Frame");
        frame.Name = "PromptFrame";
        frame.Size = new UDim2(0, 300, 0, 60);
        frame.Position = new UDim2(0.5, -150, 0.6, 0);
        frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
        frame.BackgroundTransparency = 0.3;
        frame.BorderSizePixel = 0;
        frame.Visible = false;
        frame.Parent = this.screenGui;

        const corner = new Instance("UICorner");
        corner.CornerRadius = new UDim(0, 10);
        corner.Parent = frame;

        const label = new Instance("TextLabel");
        label.Name = "Text";
        label.Size = new UDim2(1, 0, 1, 0);
        label.BackgroundTransparency = 1;
        label.TextColor3 = new Color3(1, 1, 1);
        label.Font = Enum.Font.GothamBold;
        label.TextSize = 18;
        label.Text = "Press E to deposit resource";
        label.Parent = frame;

        this.promptFrame = frame;
    }

    private FindNearbyFoundation() {
        const character = player.Character;
        if (!character || !character.PrimaryPart) return undefined;

        const playerPos = character.PrimaryPart.Position;
        let closest: { Id: number; Model: Model; Part: BasePart } | undefined;
        let closestDist = 15;
        let foundCount = 0;

        // Search Workspace (optimized: check specific folders if possible, but fallback to general like original)
        const possibleContainers = [Workspace, Workspace.FindFirstChild("Buildings"), Workspace.FindFirstChild("Towns")];

        for (const container of possibleContainers) {
            if (!container) continue;
            for (const model of container.GetChildren()) {
                if (model.IsA("Model")) {
                    const basePart = model.FindFirstChild("FoundationBase");
                    if (basePart && basePart.IsA("BasePart")) {
                        const foundationId = basePart.GetAttribute("FoundationId");
                        const ownerId = basePart.GetAttribute("OwnerId");

                        if (foundationId !== undefined) {
                            foundCount += 1;
                            const dist = basePart.Position.sub(playerPos).Magnitude;
                            if (ownerId === player.UserId && dist < closestDist) {
                                closestDist = dist;
                                closest = {
                                    Id: foundationId as number,
                                    Model: model,
                                    Part: basePart,
                                };
                            }
                        }
                    }
                }
            }
        }

        (_G as Record<string, unknown>).FoundFoundations = foundCount;
        return closest;
    }

    public Update() {
        const lastFoundation = this.nearbyFoundation;
        this.nearbyFoundation = this.FindNearbyFoundation();

        if (this.nearbyFoundation && !lastFoundation) {
            Logger.Info("InteractionController", `[${player.Name}] Now NEAR foundation: ${this.nearbyFoundation.Id}`);
        }

        if (this.nearbyFoundation && this.promptFrame) {
            this.promptFrame.Visible = true;
            const textLabel = this.promptFrame.FindFirstChild("Text") as TextLabel;
            if (textLabel) textLabel.Text = "Press E to deposit resources";
        } else if (this.promptFrame) {
            this.promptFrame.Visible = false;
        }
    }

    public HandleInput(input: InputObject): boolean {
        if (input.KeyCode === Enum.KeyCode.E) {
            if (this.nearbyFoundation) {
                Logger.Debug("InteractionController", `Pressing E near foundation: ${this.nearbyFoundation.Id}`);
                const resourcesToTry = ["Wood", "Brick", "Wheat", "Wool", "Ore"];
                for (const resourceType of resourcesToTry) {
                    ClientEvents.DepositResource.fire(this.nearbyFoundation.Id, resourceType);
                }
                return true;
            } else {
                // Debug logging for why it failed
                const totalFound = (_G as Record<string, number>).FoundFoundations ?? 0;
                if (totalFound === 0) {
                    Logger.Debug("InteractionController", "Pressing E, but NO foundations found.");
                } else {
                    Logger.Debug("InteractionController", `Pressing E, found ${totalFound} foundations, but none close enough.`);
                }
            }
        }
        return false;
    }
}
