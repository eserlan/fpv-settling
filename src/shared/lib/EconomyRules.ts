import BuildingTypes from "shared/BuildingTypes";

/**
 * Checks if the inventory contains enough resources to cover the cost.
 * @param inventory The player's current resources.
 * @param cost The cost to check against.
 * @returns True if affordable, false otherwise.
 */
export function canAfford(inventory: Record<string, number>, cost: Record<string, number>): boolean {
    for (const [resourceType, amount] of pairs(cost)) {
        const have = inventory[resourceType] ?? 0;
        if (have < amount) {
            return false;
        }
    }
    return true;
}

/**
 * Calculates the missing resources needed to afford a cost.
 * @param inventory The player's current resources.
 * @param cost The target cost.
 * @returns A record of missing resources and amounts. Empty if affordable.
 */
export function getMissingResources(inventory: Record<string, number>, cost: Record<string, number>): Record<string, number> {
    const missing: Record<string, number> = {};
    for (const [resourceType, amount] of pairs(cost)) {
        const have = inventory[resourceType] ?? 0;
        if (have < amount) {
            missing[resourceType] = amount - have;
        }
    }
    return missing;
}

/**
 * Helper to get the cost of a building type.
 * @param buildingType The type name (e.g. "Town", "Road").
 * @returns The cost record or undefined if invalid type.
 */
export function getBuildingCost(buildingType: string): Record<string, number> | undefined {
    // Check main BuildingTypes
    // Note: BuildingTypes Keys might not match buildingType string exactly if casing differs? 
    // Usually they match.
    // We cast to any to access dynamic index safely for compilation, usually BuildingTypes[buildingType] works.
    const data = BuildingTypes[buildingType as keyof typeof BuildingTypes];
    return data?.Cost;
}
