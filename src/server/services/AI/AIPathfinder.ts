import { PathfindingService } from "@rbxts/services";
import * as Logger from "shared/Logger";

export enum MoveResult {
    Continue,
    Arrived,
    Stuck,
    Timeout
}

export class AIPathfinder {
    private currentPath?: Path;
    private currentWaypointIndex: number = 0;
    private lastMoveTime: number = 0;

    private lastCheckedPosition?: Vector3;
    private lastPositionTime: number = 0;
    private lastPathComputeTime: number = 0;
    private consecutiveStuckCount: number = 0;

    public Reset() {
        this.currentPath = undefined;
        this.consecutiveStuckCount = 0;
        this.lastMoveTime = 0;
    }

    public Update(humanoid: Humanoid, targetPos: Vector3, gameTime: number, baseSpeed: number): MoveResult {
        const parentModel = humanoid.Parent as Model | undefined;
        const rootPart = parentModel?.PrimaryPart;
        if (!rootPart) return MoveResult.Stuck;

        const myPos = rootPart.Position;
        // Calculate XZ distance to ignore floating resources/height differences
        const diff = targetPos.sub(myPos);
        const totalDist = new Vector3(diff.X, 0, diff.Z).Magnitude;
        const verticalDist = math.abs(diff.Y);

        // Dynamic Speed
        let multiplier = 1;
        if (totalDist > 800) multiplier = 12.0;
        else if (totalDist > 400) multiplier = 8.0;
        else if (totalDist > 200) multiplier = 5.0;
        else if (totalDist > 100) multiplier = 3.0;
        else if (totalDist > 50) multiplier = 2.0;
        else if (totalDist > 25) multiplier = 1.4;

        humanoid.WalkSpeed = baseSpeed * multiplier;

        // Direct movement for close targets
        if (totalDist < 25) {
            const groundTarget = new Vector3(targetPos.X, myPos.Y, targetPos.Z);
            humanoid.MoveTo(groundTarget);
            this.currentPath = undefined;

            if (totalDist < 10 && (this.consecutiveStuckCount > 0)) {
                humanoid.Jump = true;
            }
            const arrivalThreshold = this.consecutiveStuckCount > 0 ? 3 : 2;
            return totalDist < arrivalThreshold ? MoveResult.Arrived : MoveResult.Continue;
        }

        if (!this.currentPath) {
            // Throttle recalculation on failure
            if (gameTime - (this.lastPathComputeTime ?? 0) < 2) {
                // humanoid.MoveTo(targetPos); // Still attempt direct move
                return MoveResult.Continue;
            }
            this.lastPathComputeTime = gameTime;

            const isStuck = this.consecutiveStuckCount > 4;
            const radius = isStuck ? 6 : 3;

            const newPath = PathfindingService.CreatePath({
                AgentRadius: radius,
                AgentHeight: 6,
                AgentCanJump: true,
                Costs: { Water: math.huge, Mud: 10 }
            });

            // Path to the GROUND position under the target to avoid "path impossible" errors for floating targets
            const groundTarget = new Vector3(targetPos.X, myPos.Y, targetPos.Z);
            const [success] = pcall(() => newPath.ComputeAsync(myPos, groundTarget));

            if (success && newPath.Status === Enum.PathStatus.Success) {
                this.currentPath = newPath;
                this.currentWaypointIndex = 0;
                this.lastMoveTime = gameTime;
            } else {
                // Fallback to direct move
                humanoid.MoveTo(targetPos);
                return MoveResult.Continue;
            }

            this.lastPositionTime = gameTime;
            this.lastCheckedPosition = myPos;
        }

        // Stuck Checks
        if (gameTime - this.lastPositionTime > 2) {
            const travelled = this.lastCheckedPosition ? myPos.sub(this.lastCheckedPosition).Magnitude : 10;
            if (travelled < 3) {
                this.consecutiveStuckCount++;
                if (this.consecutiveStuckCount >= 8) {
                    return MoveResult.Stuck;
                }
                this.currentPath = undefined; // Recalculate
                humanoid.Jump = true;

                const nudgeY = this.consecutiveStuckCount > 4 ? 10 : 0;
                const nudgeDir = new Vector3(math.random(-15, 15), nudgeY, math.random(-15, 15));
                humanoid.MoveTo(myPos.add(nudgeDir));

                this.lastPositionTime = gameTime;
                this.lastCheckedPosition = myPos;
                return MoveResult.Continue;
            }
            this.lastPositionTime = gameTime;
            this.lastCheckedPosition = myPos;
            this.consecutiveStuckCount = 0; // Reset if we moved enough
        }

        if (gameTime - this.lastMoveTime > 30) {
            return MoveResult.Timeout;
        }

        // Follow Path
        const waypoints = this.currentPath.GetWaypoints();
        if (this.currentWaypointIndex < waypoints.size()) {
            const wp = waypoints[this.currentWaypointIndex];
            humanoid.MoveTo(wp.Position);

            const wpDiff = wp.Position.sub(myPos);
            const wpDistXZ = new Vector3(wpDiff.X, 0, wpDiff.Z).Magnitude;
            const waypointThreshold = math.clamp(humanoid.WalkSpeed / 12, 4, 15);
            if (wpDistXZ < waypointThreshold) {
                this.currentWaypointIndex++;
                if (wp.Action === Enum.PathWaypointAction.Jump) humanoid.Jump = true;
            }
        } else {
            const groundTarget = new Vector3(targetPos.X, myPos.Y, targetPos.Z);
            humanoid.MoveTo(groundTarget);
            if (totalDist > 20) {
                this.currentPath = undefined; // Path ended but still far? Recompute
            }
        }

        return MoveResult.Continue;
    }
}
