// Import mocks before any other imports
import "../testUtils";

import { describe, it, expect } from "vitest";
import DiceMath, {
    ROBBER_NUMBER,
    MIN_ROLL,
    MAX_ROLL,
    DICE_OUTCOMES,
    DICE_PROBABILITY,
    TOTAL_COMBINATIONS,
    isValidDiceRoll,
    isRobberRoll,
    decomposeDiceRoll,
    createDiceRollResult,
    rollDice,
    getProbabilityNumerator,
    getProbabilityPercent,
    getProbabilityTier,
    getPipCount,
    getExpectedRolls,
    compareProbability,
    doesTileMatch,
    getMatchingTiles,
    shouldProduceResources,
    calculateTileValue,
    calculateTownValue,
    getNumberHeat,
    calculateRollVariance,
} from "../../src/shared/DiceMath";

describe("DiceMath", () => {
    describe("Constants", () => {
        it("should have correct Robber number", () => {
            expect(ROBBER_NUMBER).toBe(7);
        });

        it("should have correct roll range", () => {
            expect(MIN_ROLL).toBe(2);
            expect(MAX_ROLL).toBe(12);
        });

        it("should have 11 possible outcomes", () => {
            expect(DICE_OUTCOMES).toHaveLength(11);
        });

        it("should have total combinations of 36", () => {
            expect(TOTAL_COMBINATIONS).toBe(36);
        });

        it("should have probabilities summing to 36", () => {
            let sum = 0;
            for (let i = MIN_ROLL; i <= MAX_ROLL; i++) {
                sum += DICE_PROBABILITY[i];
            }
            expect(sum).toBe(36);
        });
    });

    describe("Dice Roll Validation", () => {
        it("should validate correct dice rolls", () => {
            for (let i = MIN_ROLL; i <= MAX_ROLL; i++) {
                expect(isValidDiceRoll(i)).toBe(true);
            }
        });

        it("should reject invalid dice rolls", () => {
            expect(isValidDiceRoll(1)).toBe(false);
            expect(isValidDiceRoll(13)).toBe(false);
            expect(isValidDiceRoll(0)).toBe(false);
            expect(isValidDiceRoll(-1)).toBe(false);
            expect(isValidDiceRoll(7.5)).toBe(false);
        });
    });

    describe("Robber Roll", () => {
        it("should identify 7 as robber roll", () => {
            expect(isRobberRoll(7)).toBe(true);
        });

        it("should not identify other numbers as robber roll", () => {
            expect(isRobberRoll(6)).toBe(false);
            expect(isRobberRoll(8)).toBe(false);
            expect(isRobberRoll(2)).toBe(false);
            expect(isRobberRoll(12)).toBe(false);
        });
    });

    describe("decomposeDiceRoll", () => {
        it("should decompose valid sums into two dice", () => {
            for (let sum = MIN_ROLL; sum <= MAX_ROLL; sum++) {
                const [die1, die2] = decomposeDiceRoll(sum);
                expect(die1).toBeGreaterThanOrEqual(1);
                expect(die1).toBeLessThanOrEqual(6);
                expect(die2).toBeGreaterThanOrEqual(1);
                expect(die2).toBeLessThanOrEqual(6);
                expect(die1 + die2).toBe(sum);
            }
        });

        it("should return [1,1] for invalid sums", () => {
            const [die1, die2] = decomposeDiceRoll(1);
            expect(die1).toBe(1);
            expect(die2).toBe(1);
        });
    });

    describe("createDiceRollResult", () => {
        it("should create correct result", () => {
            const result = createDiceRollResult(3, 4);
            expect(result.die1).toBe(3);
            expect(result.die2).toBe(4);
            expect(result.sum).toBe(7);
            expect(result.isRobber).toBe(true);
        });

        it("should identify non-robber rolls", () => {
            const result = createDiceRollResult(2, 4);
            expect(result.sum).toBe(6);
            expect(result.isRobber).toBe(false);
        });
    });

    describe("rollDice", () => {
        it("should use provided random function", () => {
            let callCount = 0;
            const mockRandom = () => {
                callCount++;
                return 4;
            };

            const result = rollDice(mockRandom);
            expect(callCount).toBe(2);
            expect(result.die1).toBe(4);
            expect(result.die2).toBe(4);
            expect(result.sum).toBe(8);
        });
    });

    describe("Probability Functions", () => {
        it("should get correct probability numerator", () => {
            expect(getProbabilityNumerator(2)).toBe(1);
            expect(getProbabilityNumerator(7)).toBe(6);
            expect(getProbabilityNumerator(12)).toBe(1);
            expect(getProbabilityNumerator(6)).toBe(5);
        });

        it("should return 0 for invalid rolls", () => {
            expect(getProbabilityNumerator(1)).toBe(0);
            expect(getProbabilityNumerator(13)).toBe(0);
        });

        it("should calculate correct percentages", () => {
            expect(getProbabilityPercent(7)).toBeCloseTo(16.67, 1);
            expect(getProbabilityPercent(2)).toBeCloseTo(2.78, 1);
            expect(getProbabilityPercent(6)).toBeCloseTo(13.89, 1);
        });

        it("should assign correct probability tiers", () => {
            expect(getProbabilityTier(2)).toBe("low");
            expect(getProbabilityTier(12)).toBe("low");
            expect(getProbabilityTier(5)).toBe("medium");
            expect(getProbabilityTier(9)).toBe("medium");
            expect(getProbabilityTier(6)).toBe("high");
            expect(getProbabilityTier(8)).toBe("high");
        });

        it("should get correct pip counts", () => {
            expect(getPipCount(6)).toBe(5);
            expect(getPipCount(8)).toBe(5);
            expect(getPipCount(2)).toBe(1);
            expect(getPipCount(7)).toBe(6);
        });

        it("should calculate expected rolls", () => {
            // In 36 rolls, expect 6 sevens
            expect(getExpectedRolls(7, 36)).toBe(6);
            // In 36 rolls, expect 1 two
            expect(getExpectedRolls(2, 36)).toBe(1);
        });

        it("should compare probabilities correctly", () => {
            expect(compareProbability(6, 2)).toBeGreaterThan(0);
            expect(compareProbability(2, 6)).toBeLessThan(0);
            expect(compareProbability(6, 8)).toBe(0);
        });
    });

    describe("Resource Spawning", () => {
        it("should match tile numbers", () => {
            expect(doesTileMatch(6, 6)).toBe(true);
            expect(doesTileMatch(6, 8)).toBe(false);
        });

        it("should filter matching tiles", () => {
            const tiles = [
                { Number: 6, Resource: "Wood" },
                { Number: 8, Resource: "Brick" },
                { Number: 6, Resource: "Wheat" },
                { Number: 9, Resource: "Ore" },
            ];

            const matching = getMatchingTiles(tiles, 6);
            expect(matching).toHaveLength(2);
            expect(matching[0].Resource).toBe("Wood");
            expect(matching[1].Resource).toBe("Wheat");
        });

        it("should determine when resources should be produced", () => {
            expect(shouldProduceResources(6)).toBe(true);
            expect(shouldProduceResources(8)).toBe(true);
            expect(shouldProduceResources(7)).toBe(false); // Robber
            expect(shouldProduceResources(1)).toBe(false); // Invalid
        });
    });

    describe("Statistics", () => {
        it("should calculate tile value", () => {
            expect(calculateTileValue(6)).toBe(5);
            expect(calculateTileValue(8)).toBe(5);
            expect(calculateTileValue(2)).toBe(1);
            expect(calculateTileValue(7)).toBe(0); // Robber
        });

        it("should calculate town value", () => {
            // Town touching 6, 8, and 9
            const value = calculateTownValue([6, 8, 9]);
            expect(value).toBe(5 + 5 + 4); // 14
        });

        it("should calculate number heat", () => {
            expect(getNumberHeat(6)).toBe(1); // Max heat
            expect(getNumberHeat(8)).toBe(1);
            expect(getNumberHeat(2)).toBeCloseTo(0.2);
            expect(getNumberHeat(7)).toBe(0); // Robber
        });

        it("should calculate roll variance", () => {
            // Perfect distribution would have 0 variance
            // Skewed distribution would have higher variance
            const balanced = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
            const skewed = [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7];

            expect(calculateRollVariance(balanced)).toBeLessThan(calculateRollVariance(skewed));
        });

        it("should return 0 variance for empty array", () => {
            expect(calculateRollVariance([])).toBe(0);
        });
    });

    describe("Default export", () => {
        it("should export all functions and constants", () => {
            expect(DiceMath.ROBBER_NUMBER).toBe(7);
            expect(DiceMath.isValidDiceRoll).toBeDefined();
            expect(DiceMath.getProbabilityPercent).toBeDefined();
            expect(DiceMath.calculateTownValue).toBeDefined();
        });
    });
});
