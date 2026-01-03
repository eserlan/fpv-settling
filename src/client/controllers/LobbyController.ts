import { Controller, OnStart } from "@flamework/core";
import { Workspace, Players } from "@rbxts/services";
import { ClientEvents } from "../ClientEvents";
import * as Logger from "shared/Logger";

@Controller({})
export class LobbyController implements OnStart {
    onStart() {
        Logger.Info("LobbyController", "Initialized");

        // Listen for all clicks on "RemoveAI" buttons in the world SurfaceGuis
        // We'll use a DescendantAdded listener to catch dynamically created buttons
        Workspace.WaitForChild("Lobby").DescendantAdded.Connect((descendant) => {
            this.setupButton(descendant);
        });

        // Setup existing buttons
        Workspace.WaitForChild("Lobby").GetDescendants().forEach(d => this.setupButton(d));
    }

    private setupButton(instance: Instance) {
        if (instance.IsA("TextButton") && instance.Name === "RemoveAI") {
            Logger.Info("LobbyController", `Found RemoveAI button for Room ${instance.GetAttribute("RoomId")}`);
            instance.MouseButton1Click.Connect(() => {
                const roomId = instance.GetAttribute("RoomId") as number;
                const aiUserId = instance.GetAttribute("AIUserId") as number;

                if (roomId !== undefined && aiUserId !== undefined) {
                    Logger.Info("LobbyController", `Button clicked: Removing AI ${aiUserId} from Room ${roomId}`);
                    ClientEvents.RemoveAIRoom.fire(roomId, aiUserId);
                }
            });
        }
    }
}
