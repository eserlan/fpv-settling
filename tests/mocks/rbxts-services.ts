export const PathfindingService = {
    CreatePath: (params: any) => ({
        ComputeAsync: (start: any, end: any) => { },
        GetWaypoints: () => [],
        Status: "Success"
    })
};

export const RunService = {
    IsServer: () => true,
    IsClient: () => false,
};

export const Players = {
    LocalPlayer: undefined,
    GetPlayers: () => [],
};
