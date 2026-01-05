import { BlueprintInfo } from "./Blueprints";

export type SkillLevel = "Beginner" | "Intermediate" | "Expert";

export type BuildingRecord = {
    Id: number;
    Type: string;
    Position: Vector3;
    Rotation?: Vector3;
    SnapKey?: string;
    Progress: number;
    BuildTime?: number;
    Completed?: boolean;
    Data?: unknown;
    Blueprint?: BlueprintInfo;
    IsTown?: boolean;
    IsFoundation?: boolean;
    RequiredResources?: Record<string, number>;
    DepositedResources?: Record<string, number>;
    OwnerId?: number;
    Model?: Model;
};
