/**
 * ResourceMath - Pure mathematical functions for resource calculations
 * 
 * This module contains pure functions (no Roblox dependencies) for:
 * - Resource validation and constraints
 * - Inventory calculations (totals, caps, etc.)
 * - Cost validation and affordability checks
 * 
 * Used by ResourceManager, CollectionManager, and BuildingManager
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Maximum stack size for any resource */
export const MAX_STACK_SIZE = 50;

/** Threshold for Robber penalty (more than this triggers half-loss) */
export const ROBBER_PENALTY_THRESHOLD = 7;

/** Starting resources for new players */
export const STARTING_RESOURCES: Readonly<Record<string, number>> = {
    Wood: 2,
    Brick: 2,
    Wheat: 1,
    Wool: 1,
    Ore: 0,
};

/** All valid resource types */
export const RESOURCE_TYPES = ["Wood", "Brick", "Wheat", "Ore", "Wool"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Player inventory (resource type -> amount) */
export type Inventory = Record<string, number>;

/** Resource cost for construction/research */
export type ResourceCost = Record<string, number>;

/** Result of an add resource operation */
export type AddResourceResult = {
    success: boolean;
    amountAdded: number;
    overflow: number;
    newTotal: number;
};

/** Result of a remove resource operation */
export type RemoveResourceResult = {
    success: boolean;
    amountRemoved: number;
    shortage: number;
    newTotal: number;
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a resource type is valid
 */
export const isValidResourceType = (resourceType: string): boolean => {
    return RESOURCE_TYPES.includes(resourceType as ResourceType);
};

/**
 * Create an empty inventory with all resource types at 0
 */
export const createEmptyInventory = (): Inventory => {
    const inventory: Inventory = {};
    for (const resourceType of RESOURCE_TYPES) {
        inventory[resourceType] = 0;
    }
    return inventory;
};

/**
 * Create an inventory with starting resources
 */
export const createStartingInventory = (): Inventory => {
    return { ...STARTING_RESOURCES };
};

/**
 * Clone an inventory (to avoid mutation)
 */
export const cloneInventory = (inventory: Inventory): Inventory => {
    const clone: Inventory = {};
    for (const key in inventory) {
        clone[key] = inventory[key];
    }
    return clone;
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the total count of all resources in an inventory
 */
export const getTotalResourceCount = (inventory: Inventory): number => {
    let total = 0;
    for (const key in inventory) {
        total += inventory[key] ?? 0;
    }
    return total;
};

/**
 * Get the amount of a specific resource (returns 0 if not found)
 */
export const getResourceAmount = (inventory: Inventory, resourceType: string): number => {
    return inventory[resourceType] ?? 0;
};

/**
 * Check if inventory has at least the specified amount of a resource
 */
export const hasResource = (
    inventory: Inventory,
    resourceType: string,
    amount: number
): boolean => {
    return getResourceAmount(inventory, resourceType) >= amount;
};

/**
 * Check if inventory has all required resources for a cost
 */
export const hasResources = (inventory: Inventory, cost: ResourceCost): boolean => {
    for (const resourceType in cost) {
        const required = cost[resourceType];
        const available = getResourceAmount(inventory, resourceType);
        if (available < required) {
            return false;
        }
    }
    return true;
};

/**
 * Calculate how many times a player can afford a certain cost
 */
export const countAffordable = (inventory: Inventory, cost: ResourceCost): number => {
    let minAffordable = math.huge;

    for (const resourceType in cost) {
        const required = cost[resourceType];
        if (required <= 0) continue;

        const available = getResourceAmount(inventory, resourceType);
        const times = math.floor(available / required);
        minAffordable = math.min(minAffordable, times);
    }

    return minAffordable === math.huge ? 0 : minAffordable;
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE MODIFICATION (returns new values, doesn't mutate)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate result of adding resources (respects max stack)
 */
export const calculateAddResource = (
    currentAmount: number,
    addAmount: number,
    maxStack: number = MAX_STACK_SIZE
): AddResourceResult => {
    const availableSpace = maxStack - currentAmount;
    const actualAdd = math.min(addAmount, math.max(0, availableSpace));
    const overflow = addAmount - actualAdd;
    const newTotal = currentAmount + actualAdd;

    return {
        success: actualAdd > 0,
        amountAdded: actualAdd,
        overflow,
        newTotal,
    };
};

/**
 * Calculate result of removing resources
 */
export const calculateRemoveResource = (
    currentAmount: number,
    removeAmount: number
): RemoveResourceResult => {
    const actualRemove = math.min(removeAmount, currentAmount);
    const shortage = removeAmount - actualRemove;
    const newTotal = currentAmount - actualRemove;

    return {
        success: actualRemove === removeAmount,
        amountRemoved: actualRemove,
        shortage,
        newTotal,
    };
};

/**
 * Apply a cost to an inventory (returns new inventory, doesn't mutate)
 * Returns undefined if cannot afford
 */
export const applyCost = (inventory: Inventory, cost: ResourceCost): Inventory | undefined => {
    if (!hasResources(inventory, cost)) {
        return undefined;
    }

    const newInventory = cloneInventory(inventory);
    for (const resourceType in cost) {
        newInventory[resourceType] -= cost[resourceType];
    }
    return newInventory;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROBBER PENALTY CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a player should lose resources to the Robber (more than 7 cards)
 */
export const shouldApplyRobberPenalty = (inventory: Inventory): boolean => {
    return getTotalResourceCount(inventory) > ROBBER_PENALTY_THRESHOLD;
};

/**
 * Calculate how many resources should be lost to the Robber
 * (Half of total, rounded down)
 */
export const calculateRobberLoss = (inventory: Inventory): number => {
    const total = getTotalResourceCount(inventory);
    if (total <= ROBBER_PENALTY_THRESHOLD) {
        return 0;
    }
    return math.floor(total / 2);
};

/**
 * Get resource counts as an array for random selection
 * Returns array of [resourceType, count] pairs for resources with count > 0
 */
export const getResourcesForRandomSelection = (
    inventory: Inventory
): Array<[string, number]> => {
    const result: Array<[string, number]> = [];
    for (const resourceType in inventory) {
        const count = inventory[resourceType];
        if (count > 0) {
            result.push([resourceType, count]);
        }
    }
    return result;
};

/**
 * Calculate which resources to remove randomly for Robber penalty
 * Returns a map of resourceType -> amount to remove
 * 
 * Note: This is deterministic given the same random seed
 * In production, use actual random selection
 */
export const calculateRandomRobberLoss = (
    inventory: Inventory,
    lossTally: number,
    randomPicker: (max: number) => number
): Record<string, number> => {
    const losses: Record<string, number> = {};
    const tempInventory = cloneInventory(inventory);

    for (let i = 0; i < lossTally; i++) {
        const total = getTotalResourceCount(tempInventory);
        if (total === 0) break;

        // Pick a random position in the total
        const pick = randomPicker(total);
        let acc = 0;

        for (const resourceType in tempInventory) {
            const amount = tempInventory[resourceType];
            if (amount > 0) {
                acc += amount;
                if (acc >= pick) {
                    // Remove one of this resource
                    tempInventory[resourceType] -= 1;
                    losses[resourceType] = (losses[resourceType] ?? 0) + 1;
                    break;
                }
            }
        }
    }

    return losses;
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the missing resources to afford a cost
 * Returns empty object if can afford
 */
export const getMissingResources = (
    inventory: Inventory,
    cost: ResourceCost
): ResourceCost => {
    const missing: ResourceCost = {};

    for (const resourceType in cost) {
        const required = cost[resourceType];
        const available = getResourceAmount(inventory, resourceType);
        if (available < required) {
            missing[resourceType] = required - available;
        }
    }

    return missing;
};

/**
 * Format inventory as a readable string
 */
export const formatInventory = (inventory: Inventory): string => {
    const parts: string[] = [];
    for (const resourceType of RESOURCE_TYPES) {
        const amount = inventory[resourceType] ?? 0;
        if (amount > 0) {
            parts.push(`${resourceType}: ${amount}`);
        }
    }
    return parts.size() > 0 ? parts.join(", ") : "Empty";
};

/**
 * Format a cost as a readable string
 */
export const formatCost = (cost: ResourceCost): string => {
    const parts: string[] = [];
    for (const resourceType in cost) {
        const amount = cost[resourceType];
        if (amount > 0) {
            parts.push(`${amount} ${resourceType}`);
        }
    }
    return parts.size() > 0 ? parts.join(", ") : "Free";
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
    // Constants
    MAX_STACK_SIZE,
    ROBBER_PENALTY_THRESHOLD,
    STARTING_RESOURCES,
    RESOURCE_TYPES,

    // Validation
    isValidResourceType,
    createEmptyInventory,
    createStartingInventory,
    cloneInventory,

    // Inventory calculations
    getTotalResourceCount,
    getResourceAmount,
    hasResource,
    hasResources,
    countAffordable,

    // Resource modification
    calculateAddResource,
    calculateRemoveResource,
    applyCost,

    // Robber penalty
    shouldApplyRobberPenalty,
    calculateRobberLoss,
    getResourcesForRandomSelection,
    calculateRandomRobberLoss,

    // Utilities
    getMissingResources,
    formatInventory,
    formatCost,
};
