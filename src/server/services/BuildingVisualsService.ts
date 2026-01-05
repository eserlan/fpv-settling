import { Service } from "@flamework/core";
import { BuildingRecord } from "shared/GameTypes";
import Blueprints from "shared/Blueprints";
import { PlayerData } from "../PlayerData";
import BuildingTypes from "shared/BuildingTypes";

@Service({})
export class BuildingVisualsService {

    public CreateFoundationModel(playerData: PlayerData, foundation: BuildingRecord) {
        const model = new Instance("Model");
        model.Name = `${playerData.Player.Name}_Foundation_${foundation.Type}_${foundation.Id}`;
        const size = foundation.Blueprint?.Size ?? new Vector3(5, 4, 5);

        const part = new Instance("Part");
        part.Name = "FoundationBase";
        part.Size = size;
        part.CFrame = new CFrame(foundation.Position.add(new Vector3(0, size.Y / 2, 0))).mul(
            CFrame.Angles(math.rad(foundation.Rotation?.X ?? 0), math.rad(foundation.Rotation?.Y ?? 0), math.rad(foundation.Rotation?.Z ?? 0)),
        );
        part.Anchored = true;
        part.CanCollide = false;
        part.Transparency = 0.7;
        part.Color = playerData.Color;
        part.Material = Enum.Material.ForceField;
        part.CollisionGroup = "Obstacles";
        part.Parent = model;

        const modifier = new Instance("PathfindingModifier");
        modifier.PassThrough = true;
        modifier.Parent = part;

        const progressBg = new Instance("Part");
        progressBg.Name = "ProgressBar";
        progressBg.Size = new Vector3(6, 0.3, 0.3);
        progressBg.Position = foundation.Position.add(new Vector3(0, size.Y + 2, 0));
        progressBg.Anchored = true;
        progressBg.CanCollide = false;
        progressBg.Color = Color3.fromRGB(50, 50, 50);
        progressBg.Parent = model;

        const progressFill = new Instance("Part");
        progressFill.Name = "Fill";
        progressFill.Size = new Vector3(0.1, 0.4, 0.4);
        progressFill.Position = progressBg.Position.sub(new Vector3(progressBg.Size.X / 2 - 0.05, 0, 0));
        progressFill.Anchored = true;
        progressFill.CanCollide = false;
        progressFill.Color = Color3.fromRGB(100, 255, 100);
        progressFill.Material = Enum.Material.Neon;
        progressFill.Parent = model;

        const billboard = new Instance("BillboardGui");
        billboard.Name = "ResourceDisplay";
        billboard.Size = new UDim2(0, 150, 0, 80);
        billboard.StudsOffset = new Vector3(0, size.Y + 4, 0);
        billboard.AlwaysOnTop = true;
        billboard.Adornee = part;
        billboard.Parent = part;

        const resourceLabel = new Instance("TextLabel");
        resourceLabel.Name = "Resources";
        resourceLabel.Size = new UDim2(1, 0, 1, 0);
        resourceLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
        resourceLabel.BackgroundTransparency = 0.3;
        resourceLabel.TextColor3 = new Color3(1, 1, 1);
        resourceLabel.Font = Enum.Font.GothamBold;
        resourceLabel.TextSize = 14;
        resourceLabel.TextWrapped = true;
        resourceLabel.Parent = billboard;

        let resourceText = "Needs:\n";
        for (const [resource, amount] of pairs(foundation.RequiredResources ?? {})) {
            const icon = Blueprints.ResourceIcons[resource] ?? "";
            const deposited = foundation.DepositedResources?.[resource] ?? 0;
            resourceText = `${resourceText}${icon} ${deposited}/${amount}\n`;
        }
        resourceLabel.Text = resourceText;

        const folderName = foundation.IsTown ? "Towns" : "Buildings";
        const folder = (game.Workspace.FindFirstChild(folderName) as Folder) ?? new Instance("Folder", game.Workspace);
        folder.Name = folderName;
        model.Parent = folder;
        model.PrimaryPart = part;
        part.SetAttribute("FoundationId", foundation.Id);
        part.SetAttribute("OwnerId", foundation.OwnerId);
        part.SetAttribute("Key", foundation.SnapKey);
        foundation.Model = model;
    }

    public UpdateFoundationVisual(foundation: BuildingRecord) {
        if (!foundation.Model) return;
        const basePart = foundation.Model.FindFirstChild("FoundationBase");
        if (!basePart || !basePart.IsA("BasePart")) return;

        basePart.Transparency = 0.7 - foundation.Progress * 0.5;

        const progressBar = foundation.Model.FindFirstChild("ProgressBar");
        if (progressBar && progressBar.IsA("BasePart")) {
            const fill = foundation.Model.FindFirstChild("Fill");
            if (fill && fill.IsA("BasePart")) {
                const fillWidth = math.max(0.1, progressBar.Size.X * foundation.Progress);
                fill.Size = new Vector3(fillWidth, fill.Size.Y, fill.Size.Z);
                fill.Position = progressBar.Position.sub(new Vector3((progressBar.Size.X - fillWidth) / 2, 0, 0));
            }
        }

        const resourceDisplay = basePart.FindFirstChild("ResourceDisplay");
        if (resourceDisplay && resourceDisplay.IsA("BillboardGui")) {
            const resourceLabel = resourceDisplay.FindFirstChild("Resources");
            if (resourceLabel && resourceLabel.IsA("TextLabel")) {
                let resourceText = "Needs:\n";
                for (const [resource, required] of pairs(foundation.RequiredResources ?? {})) {
                    const icon = Blueprints.ResourceIcons[resource] ?? "";
                    const deposited = foundation.DepositedResources?.[resource] ?? 0;
                    const status = deposited >= required ? "✓" : "";
                    resourceText = `${resourceText}${icon} ${deposited}/${required} ${status}\n`;
                }
                resourceLabel.Text = resourceText;
            }
        }
    }

    public CreateBuildingModel(playerData: PlayerData, building: BuildingRecord) {
        const model = new Instance("Model");
        model.Name = `${playerData.Player.Name}_${building.Type}_${building.Id}`;
        const buildingData = building.Blueprint ?? building.Data ?? {};
        const size = (buildingData as { Size?: Vector3 }).Size ?? new Vector3(5, 4, 5);

        let baseCFrame = new CFrame(building.Position);
        if (building.Rotation) baseCFrame = baseCFrame.mul(CFrame.Angles(math.rad(building.Rotation.X), math.rad(building.Rotation.Y), math.rad(building.Rotation.Z)));

        const part = new Instance("Part");
        part.Size = size;
        part.CFrame = baseCFrame.mul(new CFrame(0, size.Y / 2, 0));
        part.Anchored = true;
        part.CollisionGroup = "Obstacles";
        part.Parent = model;
        part.Color = playerData.Color;

        if (building.Type === "Town") {
            part.Size = new Vector3(5, 4, 5);
            part.CFrame = baseCFrame.mul(new CFrame(0, 2, 0));
            part.Color = Color3.fromRGB(220, 200, 160);
            const roof1 = new Instance("WedgePart");
            roof1.Size = new Vector3(6, 2.5, 3);
            roof1.CFrame = baseCFrame.mul(new CFrame(0, 5.25, -1.5));
            roof1.Anchored = true;
            roof1.Color = playerData.Color;
            roof1.Parent = model;
            const roof2 = new Instance("WedgePart");
            roof2.Size = new Vector3(6, 2.5, 3);
            roof2.CFrame = baseCFrame.mul(new CFrame(0, 5.25, 1.5)).mul(CFrame.Angles(0, math.pi, 0));
            roof2.Anchored = true;
            roof2.Color = playerData.Color;
            roof2.Parent = model;
            const door = new Instance("Part");
            door.Size = new Vector3(1.2, 2.5, 0.3);
            door.CFrame = baseCFrame.mul(new CFrame(0, 1.25, 2.6));
            door.Anchored = true;
            door.Color = Color3.fromRGB(101, 67, 33);
            door.Parent = model;
        } else if (building.Type === "City") {
            // Main Hall (Slightly larger than Town)
            part.Size = new Vector3(8, 6, 8);
            part.CFrame = baseCFrame.mul(new CFrame(-2, 3, 0));
            part.Color = Color3.fromRGB(210, 190, 150);

            // Tower Spire
            const tower = new Instance("Part");
            tower.Name = "Tower";
            tower.Size = new Vector3(5, 14, 5);
            tower.CFrame = baseCFrame.mul(new CFrame(4.5, 7, 0));
            tower.Color = Color3.fromRGB(190, 170, 130);
            tower.Anchored = true;
            tower.Parent = model;

            // Main Hall Roof (Team Color)
            const roof1 = new Instance("WedgePart");
            roof1.Size = new Vector3(9, 4, 4.5);
            roof1.CFrame = baseCFrame.mul(new CFrame(-2, 8, -2.25));
            roof1.Anchored = true;
            roof1.Color = playerData.Color;
            roof1.Parent = model;
            const roof2 = new Instance("WedgePart");
            roof2.Size = new Vector3(9, 4, 4.5);
            roof2.CFrame = baseCFrame.mul(new CFrame(-2, 8, 2.25)).mul(CFrame.Angles(0, math.pi, 0));
            roof2.Anchored = true;
            roof2.Color = playerData.Color;
            roof2.Parent = model;

            // Tower Peak (Team Color)
            const peak = new Instance("Part");
            peak.Name = "TowerPeak";
            peak.Size = new Vector3(6, 2, 6);
            peak.CFrame = baseCFrame.mul(new CFrame(4.5, 15, 0));
            peak.Anchored = true;
            peak.Color = playerData.Color;
            peak.Parent = model;

            // Flagpole
            const pole = new Instance("Part");
            pole.Name = "Flagpole";
            pole.Size = new Vector3(0.5, 8, 0.5);
            pole.Position = peak.Position.add(new Vector3(0, 5, 0));
            pole.Color = Color3.fromRGB(200, 200, 200);
            pole.Anchored = true;
            pole.Parent = model;

            // Flag (Team Color)
            const flag = new Instance("Part");
            flag.Name = "Flag";
            flag.Size = new Vector3(3, 2.5, 0.2);
            flag.Position = pole.Position.add(new Vector3(1.7, 2.5, 0));
            flag.Color = playerData.Color;
            flag.Anchored = true;
            flag.Parent = model;

            // Windows for detail
            for (let i = 0; i < 2; i++) {
                const window = new Instance("Part");
                window.Size = new Vector3(0.1, 1.5, 1);
                window.CFrame = baseCFrame.mul(new CFrame(-6.1, 3.5, i === 0 ? -2 : 2));
                window.Color = Color3.fromRGB(100, 150, 255);
                window.Transparency = 0.3;
                window.Anchored = true;
                window.Parent = model;
            }
        } else if (building.Type === "Road") {
            part.Size = new Vector3(37, 0.5, 3);
            part.CFrame = baseCFrame;
            part.Color = playerData.Color;
            part.Material = Enum.Material.Concrete;
        }

        for (const p of model.GetDescendants()) {
            if (p.IsA("BasePart")) {
                p.CollisionGroup = "Obstacles";
                const modifier = new Instance("PathfindingModifier");
                modifier.PassThrough = true;
                modifier.Parent = p;
            }
        }

        const folderName = building.IsTown ? "Towns" : "Buildings";
        const folder = (game.Workspace.FindFirstChild(folderName) as Folder) ?? new Instance("Folder", game.Workspace);
        folder.Name = folderName;
        model.Parent = folder;
        model.PrimaryPart = part;
        building.Model = model;

        model.SetAttribute("OwnerId", building.OwnerId ?? playerData.Player.UserId);
        model.SetAttribute("Key", building.SnapKey);
        part.SetAttribute("Key", building.SnapKey);
        part.SetAttribute("OwnerId", building.OwnerId ?? playerData.Player.UserId);

        if (building.Type === "Town" || building.Type === "City") {
            const ownerBillboard = new Instance("BillboardGui");
            ownerBillboard.Name = "OwnerLabel";
            ownerBillboard.Size = new UDim2(0, 100, 0, 30);
            ownerBillboard.StudsOffset = new Vector3(0, size.Y + 2, 0);
            ownerBillboard.AlwaysOnTop = true;
            ownerBillboard.Adornee = part;
            ownerBillboard.Parent = part;

            const ownerText = new Instance("TextLabel");
            ownerText.Name = "OwnerName";
            ownerText.Size = new UDim2(1, 0, 1, 0);
            ownerText.BackgroundColor3 = Color3.fromRGB(30, 30, 30);
            ownerText.BackgroundTransparency = 0.3;
            ownerText.TextColor3 = new Color3(1, 1, 1);
            ownerText.TextScaled = true;
            ownerText.Font = Enum.Font.GothamBold;
            ownerText.Text = playerData.Player.Name;
            ownerText.Parent = ownerBillboard;
        }

        return model;
    }

    public DestroyBuildingModel(building: BuildingRecord) {
        if (building.Model) {
            building.Model.Destroy();
            building.Model = undefined;
        }
    }
}
