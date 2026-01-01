// Import mocks before any other imports
import "../testUtils";

import { describe, it, expect } from "vitest";
import ResourceMath, {
    MAX_STACK_SIZE,
    ROBBER_PENALTY_THRESHOLD,
    STARTING_RESOURCES,
    RESOURCE_TYPES,
    isValidResourceType,
    createEmptyInventory,
    createStartingInventory,
    cloneInventory,
    getTotalResourceCount,
    getResourceAmount,
    hasResource,
    hasResources,
    countAffordable,
    calculateAddResource,
    calculateRemoveResource,
    applyCost,
    shouldApplyRobberPenalty,
    calculateRobberLoss,
    getResourcesForRandomSelection,
    calculateRandomRobberLoss,
    getMissingResources,
    formatInventory,
    formatCost,
} from "../../src/shared/ResourceMath";

describe("ResourceMath", () => {
    describe("Constants", () => {
        it("should have correct MAX_STACK_SIZE", () => {
            expect(MAX_STACK_SIZE).toBe(50);
        });

        it("should have correct ROBBER_PENALTY_THRESHOLD", () => {
            expect(ROBBER_PENALTY_THRESHOLD).toBe(7);
        });

        it("should have 5 resource types", () => {
            expect(RESOURCE_TYPES).toHaveLength(5);
        });

        it("should have correct starting resources", () => {
            expect(STARTING_RESOURCES.Wood).toBe(2);
            expect(STARTING_RESOURCES.Brick).toBe(2);
            expect(STARTING_RESOURCES.Wheat).toBe(1);
            expect(STARTING_RESOURCES.Wool).toBe(1);
            expect(STARTING_RESOURCES.Ore).toBe(0);
        });
    });

    describe("isValidResourceType", () => {
        it("should return true for valid resources", () => {
            expect(isValidResourceType("Wood")).toBe(true);
            expect(isValidResourceType("Brick")).toBe(true);
            expect(isValidResourceType("Wheat")).toBe(true);
            expect(isValidResourceType("Ore")).toBe(true);
            expect(isValidResourceType("Wool")).toBe(true);
        });

        it("should return false for invalid resources", () => {
            expect(isValidResourceType("Gold")).toBe(false);
            expect(isValidResourceType("")).toBe(false);
            expect(isValidResourceType("wood")).toBe(false);
        });
    });

    describe("Inventory Creation", () => {
        it("should create empty inventory", () => {
            const inv = createEmptyInventory();
            expect(getTotalResourceCount(inv)).toBe(0);
            for (const type of RESOURCE_TYPES) {
                expect(inv[type]).toBe(0);
            }
        });

        it("should create starting inventory", () => {
            const inv = createStartingInventory();
            expect(inv.Wood).toBe(2);
            expect(inv.Brick).toBe(2);
            expect(inv.Wheat).toBe(1);
            expect(inv.Wool).toBe(1);
            expect(inv.Ore).toBe(0);
        });

        it("should clone inventory without mutation", () => {
            const original = { Wood: 5, Brick: 3, Wheat: 0, Ore: 0, Wool: 0 };
            const clone = cloneInventory(original);

            clone.Wood = 10;

            expect(original.Wood).toBe(5);
            expect(clone.Wood).toBe(10);
        });
    });

    describe("Inventory Calculations", () => {
        describe("getTotalResourceCount", () => {
            it("should return 0 for empty inventory", () => {
                expect(getTotalResourceCount(createEmptyInventory())).toBe(0);
            });

            it("should sum all resources", () => {
                const inv = { Wood: 5, Brick: 3, Wheat: 2, Ore: 1, Wool: 4 };
                expect(getTotalResourceCount(inv)).toBe(15);
            });

            it("should return correct total for starting resources", () => {
                expect(getTotalResourceCount(createStartingInventory())).toBe(6);
            });
        });

        describe("getResourceAmount", () => {
            it("should return correct amount", () => {
                const inv = { Wood: 5, Brick: 0 };
                expect(getResourceAmount(inv, "Wood")).toBe(5);
                expect(getResourceAmount(inv, "Brick")).toBe(0);
            });

            it("should return 0 for missing resource", () => {
                expect(getResourceAmount({}, "Wood")).toBe(0);
            });
        });

        describe("hasResource", () => {
            it("should return true when has enough", () => {
                const inv = { Wood: 5 };
                expect(hasResource(inv, "Wood", 5)).toBe(true);
                expect(hasResource(inv, "Wood", 3)).toBe(true);
            });

            it("should return false when not enough", () => {
                const inv = { Wood: 5 };
                expect(hasResource(inv, "Wood", 6)).toBe(false);
                expect(hasResource(inv, "Brick", 1)).toBe(false);
            });
        });

        describe("hasResources", () => {
            it("should return true when has all resources", () => {
                const inv = { Wood: 5, Brick: 3, Wheat: 2, Ore: 0, Wool: 0 };
                expect(hasResources(inv, { Wood: 1, Brick: 1 })).toBe(true);
                expect(hasResources(inv, { Wood: 5, Brick: 3 })).toBe(true);
            });

            it("should return false when missing any resource", () => {
                const inv = { Wood: 5, Brick: 3 };
                expect(hasResources(inv, { Wood: 6, Brick: 1 })).toBe(false);
                expect(hasResources(inv, { Wood: 1, Ore: 1 })).toBe(false);
            });

            it("should return true for empty cost", () => {
                expect(hasResources({}, {})).toBe(true);
            });
        });

        describe("countAffordable", () => {
            it("should count how many times can afford", () => {
                const inv = { Wood: 10, Brick: 6 };
                expect(countAffordable(inv, { Wood: 2, Brick: 2 })).toBe(3);
                expect(countAffordable(inv, { Wood: 1 })).toBe(10);
            });

            it("should return 0 when cannot afford any", () => {
                const inv = { Wood: 1 };
                expect(countAffordable(inv, { Wood: 2 })).toBe(0);
            });

            it("should handle empty cost", () => {
                expect(countAffordable({ Wood: 5 }, {})).toBe(0);
            });
        });
    });

    describe("Resource Modification", () => {
        describe("calculateAddResource", () => {
            it("should add full amount when space available", () => {
                const result = calculateAddResource(10, 5);
                expect(result.success).toBe(true);
                expect(result.amountAdded).toBe(5);
                expect(result.overflow).toBe(0);
                expect(result.newTotal).toBe(15);
            });

            it("should cap at max stack", () => {
                const result = calculateAddResource(45, 10);
                expect(result.success).toBe(true);
                expect(result.amountAdded).toBe(5);
                expect(result.overflow).toBe(5);
                expect(result.newTotal).toBe(50);
            });

            it("should return no success when already full", () => {
                const result = calculateAddResource(50, 5);
                expect(result.success).toBe(false);
                expect(result.amountAdded).toBe(0);
                expect(result.overflow).toBe(5);
            });

            it("should support custom max stack", () => {
                const result = calculateAddResource(8, 5, 10);
                expect(result.amountAdded).toBe(2);
                expect(result.newTotal).toBe(10);
            });
        });

        describe("calculateRemoveResource", () => {
            it("should remove full amount when available", () => {
                const result = calculateRemoveResource(10, 5);
                expect(result.success).toBe(true);
                expect(result.amountRemoved).toBe(5);
                expect(result.shortage).toBe(0);
                expect(result.newTotal).toBe(5);
            });

            it("should remove only available amount", () => {
                const result = calculateRemoveResource(3, 5);
                expect(result.success).toBe(false);
                expect(result.amountRemoved).toBe(3);
                expect(result.shortage).toBe(2);
                expect(result.newTotal).toBe(0);
            });

            it("should handle zero removal", () => {
                const result = calculateRemoveResource(5, 0);
                expect(result.success).toBe(true);
                expect(result.amountRemoved).toBe(0);
            });
        });

        describe("applyCost", () => {
            it("should apply cost and return new inventory", () => {
                const inv = { Wood: 5, Brick: 3, Wheat: 0, Ore: 0, Wool: 0 };
                const result = applyCost(inv, { Wood: 2, Brick: 1 });

                expect(result).toBeDefined();
                expect(result!.Wood).toBe(3);
                expect(result!.Brick).toBe(2);
                expect(inv.Wood).toBe(5); // Original unchanged
            });

            it("should return undefined when cannot afford", () => {
                const inv = { Wood: 1 };
                const result = applyCost(inv, { Wood: 5 });
                expect(result).toBeUndefined();
            });
        });
    });

    describe("Robber Penalty", () => {
        describe("shouldApplyRobberPenalty", () => {
            it("should return true when more than 7 resources", () => {
                expect(shouldApplyRobberPenalty({ Wood: 8 })).toBe(true);
                expect(shouldApplyRobberPenalty({ Wood: 4, Brick: 4 })).toBe(true);
            });

            it("should return false when 7 or fewer", () => {
                expect(shouldApplyRobberPenalty({ Wood: 7 })).toBe(false);
                expect(shouldApplyRobberPenalty({ Wood: 3, Brick: 4 })).toBe(false);
                expect(shouldApplyRobberPenalty({})).toBe(false);
            });
        });

        describe("calculateRobberLoss", () => {
            it("should return half (rounded down) for large inventories", () => {
                expect(calculateRobberLoss({ Wood: 8 })).toBe(4);
                expect(calculateRobberLoss({ Wood: 9 })).toBe(4);
                expect(calculateRobberLoss({ Wood: 10 })).toBe(5);
                expect(calculateRobberLoss({ Wood: 15 })).toBe(7);
            });

            it("should return 0 for small inventories", () => {
                expect(calculateRobberLoss({ Wood: 7 })).toBe(0);
                expect(calculateRobberLoss({ Wood: 5 })).toBe(0);
                expect(calculateRobberLoss({})).toBe(0);
            });
        });

        describe("getResourcesForRandomSelection", () => {
            it("should return only non-zero resources", () => {
                const inv = { Wood: 5, Brick: 0, Wheat: 3 };
                const result = getResourcesForRandomSelection(inv);

                expect(result.length).toBe(2);
                expect(result).toContainEqual(["Wood", 5]);
                expect(result).toContainEqual(["Wheat", 3]);
            });

            it("should return empty array for empty inventory", () => {
                expect(getResourcesForRandomSelection({})).toHaveLength(0);
            });
        });

        describe("calculateRandomRobberLoss", () => {
            it("should remove specified number of resources", () => {
                const inv = { Wood: 5, Brick: 5 };
                let pickIndex = 0;
                const picks = [1, 1, 1]; // Always pick first

                const losses = calculateRandomRobberLoss(inv, 3, () => picks[pickIndex++]);

                const totalLost = Object.values(losses).reduce((a, b) => a + b, 0);
                expect(totalLost).toBe(3);
            });

            it("should not remove more than available", () => {
                const inv = { Wood: 2 };
                const losses = calculateRandomRobberLoss(inv, 5, () => 1);

                expect(losses.Wood).toBe(2);
            });
        });
    });

    describe("Utility Functions", () => {
        describe("getMissingResources", () => {
            it("should return missing amounts", () => {
                const inv = { Wood: 3, Brick: 1 };
                const missing = getMissingResources(inv, { Wood: 5, Brick: 3 });

                expect(missing.Wood).toBe(2);
                expect(missing.Brick).toBe(2);
            });

            it("should return empty for affordable cost", () => {
                const inv = { Wood: 5 };
                const missing = getMissingResources(inv, { Wood: 3 });

                expect(Object.keys(missing)).toHaveLength(0);
            });
        });

        describe("formatInventory", () => {
            it("should format non-zero resources", () => {
                const inv = { Wood: 5, Brick: 3, Wheat: 0, Ore: 0, Wool: 0 };
                const result = formatInventory(inv);

                expect(result).toContain("Wood: 5");
                expect(result).toContain("Brick: 3");
                expect(result).not.toContain("Wheat");
            });

            it("should return 'Empty' for empty inventory", () => {
                expect(formatInventory(createEmptyInventory())).toBe("Empty");
            });
        });

        describe("formatCost", () => {
            it("should format costs", () => {
                const result = formatCost({ Wood: 1, Brick: 2 });
                expect(result).toContain("1 Wood");
                expect(result).toContain("2 Brick");
            });

            it("should return 'Free' for empty cost", () => {
                expect(formatCost({})).toBe("Free");
            });
        });
    });

    describe("Default export", () => {
        it("should export all functions and constants", () => {
            expect(ResourceMath.MAX_STACK_SIZE).toBe(50);
            expect(ResourceMath.createEmptyInventory).toBeDefined();
            expect(ResourceMath.hasResources).toBeDefined();
            expect(ResourceMath.calculateRobberLoss).toBeDefined();
        });
    });
});
