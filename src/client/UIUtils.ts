// Utility functions for UI
const UserInputService = game.GetService("UserInputService");

/**
 * Makes a UI element draggable within its parent ScreenGui.
 * @param frame The Frame that will be moved.
 * @param handle The Frame that acts as the dragging handle (optional, defaults to frame).
 */
export function MakeDraggable(frame: Frame, handle: GuiObject = frame): void {
    handle.Active = true; // Ensure handle receives inputs

    handle.InputBegan.Connect((input) => {
        if (
            input.UserInputType === Enum.UserInputType.MouseButton1 ||
            input.UserInputType === Enum.UserInputType.Touch
        ) {
            const dragStart = input.Position;
            const startPos = frame.Position;
            let moveConnection: RBXScriptConnection | undefined;
            let endConnection: RBXScriptConnection | undefined;

            moveConnection = UserInputService.InputChanged.Connect((moveInput) => {
                if (
                    moveInput.UserInputType === Enum.UserInputType.MouseMovement ||
                    moveInput.UserInputType === Enum.UserInputType.Touch
                ) {
                    const delta = moveInput.Position.sub(dragStart);
                    frame.Position = new UDim2(
                        startPos.X.Scale,
                        startPos.X.Offset + delta.X,
                        startPos.Y.Scale,
                        startPos.Y.Offset + delta.Y
                    );
                }
            });

            endConnection = UserInputService.InputEnded.Connect((endInput) => {
                if (
                    endInput.UserInputType === Enum.UserInputType.MouseButton1 ||
                    endInput.UserInputType === Enum.UserInputType.Touch
                ) {
                    if (moveConnection) moveConnection.Disconnect();
                    if (endConnection) endConnection.Disconnect();
                }
            });
        }
    });
}
