/**
 * DiceMath - Pure functions for dice roll calculations
 * 
 * This module contains pure functions (no Roblox dependencies) for:
 * - Dice roll probability calculations
 * - Resource spawn outcome determination
 * - Seven roll (Robber activation) logic
 * 
 * Used by PulseManager and game state management
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Number that triggers the Robber */
export const ROBBER_NUMBER = 7;

/** Minimum dice roll value (2d6) */
export const MIN_ROLL = 2;

/** Maximum dice roll value (2d6) */
export const MAX_ROLL = 12;

/** All possible dice outcomes from 2d6 */
export const DICE_OUTCOMES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type DiceOutcome = (typeof DICE_OUTCOMES)[number];

/**
 * Probability distribution for 2d6 dice rolls
 * Key = sum, Value = number of ways to roll that sum out of 36
 */
export const DICE_PROBABILITY: Readonly<Record<number, number>> = {
    2: 1,   // 1/36 = 2.78%
    3: 2,   // 2/36 = 5.56%
    4: 3,   // 3/36 = 8.33%
    5: 4,   // 4/36 = 11.11%
    6: 5,   // 5/36 = 13.89%
    7: 6,   // 6/36 = 16.67%
    8: 5,   // 5/36 = 13.89%
    9: 4,   // 4/36 = 11.11%
    10: 3,  // 3/36 = 8.33%
    11: 2,  // 2/36 = 5.56%
    12: 1,  // 1/36 = 2.78%
};

/** Total combinations for 2d6 */
export const TOTAL_COMBINATIONS = 36;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Result of a single dice roll */
export type DiceRollResult = {
    die1: number;
    die2: number;
    sum: number;
    isRobber: boolean;
};

/** Tile number configuration for resources */
export type TileNumber = 2 | 3 | 4 | 5 | 6 | 8 | 9 | 10 | 11 | 12;

/** Probability tier for visual indicators */
export type ProbabilityTier = "low" | "medium" | "high";

// ═══════════════════════════════════════════════════════════════════════════════
// DICE ROLL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate that a dice roll is in valid range
 */
export const isValidDiceRoll = (roll: number): boolean => {
    return math.floor(roll) === roll && roll >= MIN_ROLL && roll <= MAX_ROLL;
};

/**
 * Check if a roll triggers the Robber
 */
export const isRobberRoll = (roll: number): boolean => {
    return roll === ROBBER_NUMBER;
};

/**
 * Get individual dice values from sum (for display)
 * Returns one possible combination
 */
export const decomposeDiceRoll = (sum: number): [number, number] => {
    if (sum < MIN_ROLL || sum > MAX_ROLL) {
        return [1, 1]; // Invalid, return minimum
    }

    // Return a balanced split when possible
    const half = math.floor(sum / 2);
    const die1 = math.max(1, math.min(6, half));
    const die2 = sum - die1;

    // Ensure die2 is also valid
    if (die2 < 1 || die2 > 6) {
        // Adjust if needed
        if (die2 < 1) {
            return [sum - 1, 1];
        }
        return [sum - 6, 6];
    }

    return [die1, die2];
};

/**
 * Create a dice roll result from two die values
 */
export const createDiceRollResult = (die1: number, die2: number): DiceRollResult => {
    const sum = die1 + die2;
    return {
        die1,
        die2,
        sum,
        isRobber: isRobberRoll(sum),
    };
};

/**
 * Generate a random dice roll using provided random function
 * 
 * @param randomDie - Function that returns 1-6
 * @returns DiceRollResult
 */
export const rollDice = (randomDie: () => number): DiceRollResult => {
    const die1 = randomDie();
    const die2 = randomDie();
    return createDiceRollResult(die1, die2);
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROBABILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the exact probability of rolling a specific number (as a fraction of 36)
 */
export const getProbabilityNumerator = (roll: number): number => {
    return DICE_PROBABILITY[roll] ?? 0;
};

/**
 * Get the probability of rolling a specific number as a percentage
 */
export const getProbabilityPercent = (roll: number): number => {
    const numerator = getProbabilityNumerator(roll);
    return (numerator / TOTAL_COMBINATIONS) * 100;
};

/**
 * Get the probability tier for visual display
 */
export const getProbabilityTier = (roll: number): ProbabilityTier => {
    const numerator = getProbabilityNumerator(roll);
    if (numerator <= 2) return "low";
    if (numerator <= 4) return "medium";
    return "high";
};

/**
 * Get the number of "pips" to display (common Catan visual style)
 * 6 and 8 get 5 pips (most likely after 7), 2 and 12 get 1 pip (least likely)
 */
export const getPipCount = (roll: number): number => {
    return getProbabilityNumerator(roll);
};

/**
 * Get expected rolls per game based on number of turns
 * Useful for game balance calculations
 */
export const getExpectedRolls = (roll: number, totalRolls: number): number => {
    const probability = getProbabilityNumerator(roll) / TOTAL_COMBINATIONS;
    return probability * totalRolls;
};

/**
 * Compare two numbers by probability (for sorting tiles)
 * Higher probability = higher value
 */
export const compareProbability = (roll1: number, roll2: number): number => {
    return getProbabilityNumerator(roll1) - getProbabilityNumerator(roll2);
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE SPAWNING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a tile number matches the dice roll
 */
export const doesTileMatch = (tileNumber: number, diceRoll: number): boolean => {
    return tileNumber === diceRoll;
};

/**
 * Filter tiles that match a dice roll
 */
export const getMatchingTiles = <T extends { Number: number }>(
    tiles: T[],
    diceRoll: number
): T[] => {
    return tiles.filter((tile) => doesTileMatch(tile.Number, diceRoll));
};

/**
 * Check if a roll should produce resources (non-robber)
 */
export const shouldProduceResources = (roll: number): boolean => {
    return !isRobberRoll(roll) && isValidDiceRoll(roll);
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate the expected resource production value of a tile placement
 * Higher numbers = more expected resources over time
 */
export const calculateTileValue = (tileNumber: number): number => {
    if (tileNumber === ROBBER_NUMBER) return 0;
    return getProbabilityNumerator(tileNumber);
};

/**
 * Calculate the combined value of multiple tiles (e.g., for a town)
 */
export const calculateTownValue = (tileNumbers: number[]): number => {
    let total = 0;
    for (const num of tileNumbers) {
        total += calculateTileValue(num);
    }
    return total;
};

/**
 * Get the "heat" of a number for color coding
 * Returns 0-1 where 1 is the hottest (6/8) and 0 is coldest (2/12)
 */
export const getNumberHeat = (roll: number): number => {
    if (roll === ROBBER_NUMBER) return 0;
    const max = 5; // Maximum pip count (6 and 8)
    return getProbabilityNumerator(roll) / max;
};

/**
 * Calculate variance metric for a set of rolls
 * Useful for detecting "lucky" or "unlucky" dice
 */
export const calculateRollVariance = (rolls: number[]): number => {
    if (rolls.size() === 0) return 0;

    // Calculate expected distribution
    const total = rolls.size();
    const actual: Record<number, number> = {};

    for (const roll of rolls) {
        actual[roll] = (actual[roll] ?? 0) + 1;
    }

    // Compare to expected
    let variance = 0;
    for (let i = MIN_ROLL; i <= MAX_ROLL; i++) {
        const expected = (getProbabilityNumerator(i) / TOTAL_COMBINATIONS) * total;
        const actualCount = actual[i] ?? 0;
        variance += (actualCount - expected) ** 2;
    }

    return variance / DICE_OUTCOMES.length;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
    // Constants
    ROBBER_NUMBER,
    MIN_ROLL,
    MAX_ROLL,
    DICE_OUTCOMES,
    DICE_PROBABILITY,
    TOTAL_COMBINATIONS,

    // Dice roll functions
    isValidDiceRoll,
    isRobberRoll,
    decomposeDiceRoll,
    createDiceRollResult,
    rollDice,

    // Probability functions
    getProbabilityNumerator,
    getProbabilityPercent,
    getProbabilityTier,
    getPipCount,
    getExpectedRolls,
    compareProbability,

    // Resource spawning
    doesTileMatch,
    getMatchingTiles,
    shouldProduceResources,

    // Statistics
    calculateTileValue,
    calculateTownValue,
    getNumberHeat,
    calculateRollVariance,
};
