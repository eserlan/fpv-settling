/**
 * ResearchMath - Pure functions for technology research calculations
 * 
 * This module contains pure functions (no Roblox dependencies) for:
 * - Prerequisite validation
 * - Research progress calculations
 * - Tech modifier stacking
 * - Unlock validation
 * 
 * Used by ResearchManager and research UI
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Technology definition */
export type TechInfo = {
    Name: string;
    Description: string;
    Cost: Record<string, number>;
    ResearchTime: number;
    Prerequisites: string[];
    Effect: string;
    Modifier?: number;
    Unlocks?: string[];
};

/** Tech tree (all available technologies) */
export type TechTree = Record<string, TechInfo>;

/** Research state for a player */
export type ResearchState = {
    researched: string[];
    currentResearch?: string;
    researchProgress: number;
};

/** Validation result for starting research */
export type StartResearchResult = {
    canStart: boolean;
    errorMessage?: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH STATE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create initial research state
 */
export const createResearchState = (): ResearchState => ({
    researched: [],
    currentResearch: undefined,
    researchProgress: 0,
});

/**
 * Check if a technology has been researched
 */
export const hasResearched = (state: ResearchState, techName: string): boolean => {
    return state.researched.includes(techName);
};

/**
 * Check if currently researching anything
 */
export const isResearching = (state: ResearchState): boolean => {
    return state.currentResearch !== undefined;
};

/**
 * Get list of all researched technologies
 */
export const getResearchedTechs = (state: ResearchState): string[] => {
    return [...state.researched];
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREREQUISITE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if all prerequisites for a tech are met
 */
export const hasPrerequisites = (
    state: ResearchState,
    tech: TechInfo
): boolean => {
    for (const prereq of tech.Prerequisites) {
        if (!hasResearched(state, prereq)) {
            return false;
        }
    }
    return true;
};

/**
 * Get missing prerequisites for a tech
 */
export const getMissingPrerequisites = (
    state: ResearchState,
    tech: TechInfo
): string[] => {
    const missing: string[] = [];
    for (const prereq of tech.Prerequisites) {
        if (!hasResearched(state, prereq)) {
            missing.push(prereq);
        }
    }
    return missing;
};

/**
 * Check if a tech is available to research (all prereqs met, not yet researched)
 */
export const isTechAvailable = (
    state: ResearchState,
    techName: string,
    tech: TechInfo
): boolean => {
    if (hasResearched(state, techName)) {
        return false;
    }
    return hasPrerequisites(state, tech);
};

/**
 * Get all techs currently available to research
 */
export const getAvailableTechs = (
    state: ResearchState,
    techTree: TechTree
): string[] => {
    const available: string[] = [];
    for (const techName in techTree) {
        if (isTechAvailable(state, techName, techTree[techName])) {
            available.push(techName);
        }
    }
    return available;
};

/**
 * Detect circular dependencies in tech prerequisites
 * Returns the circular path if found, undefined otherwise
 */
export const detectCircularDependency = (
    techTree: TechTree,
    startTech: string,
    visited: string[] = []
): string[] | undefined => {
    if (visited.includes(startTech)) {
        return [...visited, startTech];
    }

    const tech = techTree[startTech];
    if (!tech) {
        return undefined;
    }

    for (const prereq of tech.Prerequisites) {
        const circular = detectCircularDependency(
            techTree,
            prereq,
            [...visited, startTech]
        );
        if (circular) {
            return circular;
        }
    }

    return undefined;
};

/**
 * Validate entire tech tree for circular dependencies
 */
export const validateTechTree = (
    techTree: TechTree
): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    for (const techName in techTree) {
        const circular = detectCircularDependency(techTree, techName);
        if (circular) {
            errors.push(`Circular dependency: ${circular.join(" -> ")}`);
        }

        // Check that all prerequisites exist
        for (const prereq of techTree[techName].Prerequisites) {
            if (!techTree[prereq]) {
                errors.push(`${techName} has unknown prerequisite: ${prereq}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH PROGRESS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate research progress as a percentage
 */
export const calculateResearchProgress = (
    currentTime: number,
    totalTime: number
): number => {
    if (totalTime <= 0) return 100;
    return math.min(100, (currentTime / totalTime) * 100);
};

/**
 * Calculate remaining research time
 */
export const calculateRemainingTime = (
    currentProgress: number,
    totalTime: number
): number => {
    return math.max(0, totalTime - currentProgress);
};

/**
 * Check if research is complete
 */
export const isResearchComplete = (
    currentProgress: number,
    totalTime: number
): boolean => {
    return currentProgress >= totalTime;
};

/**
 * Update research progress
 */
export const updateResearchProgress = (
    state: ResearchState,
    deltaTime: number,
    techTree: TechTree
): { newState: ResearchState; completed?: string } => {
    if (!state.currentResearch) {
        return { newState: state };
    }

    const tech = techTree[state.currentResearch];
    if (!tech) {
        return { newState: state };
    }

    const newProgress = state.researchProgress + deltaTime;

    if (isResearchComplete(newProgress, tech.ResearchTime)) {
        // Research completed
        return {
            newState: {
                researched: [...state.researched, state.currentResearch],
                currentResearch: undefined,
                researchProgress: 0,
            },
            completed: state.currentResearch,
        };
    }

    // Still in progress
    return {
        newState: {
            ...state,
            researchProgress: newProgress,
        },
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FOR STARTING RESEARCH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate if a player can start researching a tech
 */
export const canStartResearch = (
    state: ResearchState,
    techName: string,
    tech: TechInfo | undefined,
    hasRequiredResources: boolean
): StartResearchResult => {
    if (!tech) {
        return { canStart: false, errorMessage: "Invalid technology" };
    }

    if (hasResearched(state, techName)) {
        return { canStart: false, errorMessage: "Already researched" };
    }

    if (isResearching(state)) {
        return {
            canStart: false,
            errorMessage: `Already researching: ${state.currentResearch}`,
        };
    }

    if (!hasPrerequisites(state, tech)) {
        const missing = getMissingPrerequisites(state, tech);
        return {
            canStart: false,
            errorMessage: `Missing prerequisites: ${missing.join(", ")}`,
        };
    }

    if (!hasRequiredResources) {
        return { canStart: false, errorMessage: "Not enough resources" };
    }

    return { canStart: true };
};

// ═══════════════════════════════════════════════════════════════════════════════
// TECH MODIFIERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate the combined modifier for an effect type
 * Uses multiplicative stacking (e.g., 1.25 * 1.5 = 1.875)
 */
export const calculateModifier = (
    state: ResearchState,
    techTree: TechTree,
    effectType: string
): number => {
    let modifier = 1;

    for (const techName of state.researched) {
        const tech = techTree[techName];
        if (tech && tech.Effect === effectType && tech.Modifier !== undefined) {
            modifier *= tech.Modifier;
        }
    }

    return modifier;
};

/**
 * Calculate additive modifier (for things like cost reduction)
 * Sums the (1 - modifier) values
 */
export const calculateAdditiveModifier = (
    state: ResearchState,
    techTree: TechTree,
    effectType: string
): number => {
    let totalReduction = 0;

    for (const techName of state.researched) {
        const tech = techTree[techName];
        if (tech && tech.Effect === effectType && tech.Modifier !== undefined) {
            // For cost reduction, modifier < 1 means reduction
            // e.g., 0.8 means 20% cost reduction
            totalReduction += 1 - tech.Modifier;
        }
    }

    // Cap at 90% reduction (modifier = 0.1)
    return math.max(0.1, 1 - totalReduction);
};

/**
 * Get all buildings unlocked by researched techs
 */
export const getUnlockedBuildings = (
    state: ResearchState,
    techTree: TechTree
): string[] => {
    const unlocked: string[] = [];

    for (const techName of state.researched) {
        const tech = techTree[techName];
        if (tech && tech.Unlocks) {
            for (const building of tech.Unlocks) {
                if (!unlocked.includes(building)) {
                    unlocked.push(building);
                }
            }
        }
    }

    return unlocked;
};

/**
 * Check if a building is unlocked
 */
export const isBuildingUnlocked = (
    state: ResearchState,
    techTree: TechTree,
    buildingName: string
): boolean => {
    return getUnlockedBuildings(state, techTree).includes(buildingName);
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
    // Research state
    createResearchState,
    hasResearched,
    isResearching,
    getResearchedTechs,

    // Prerequisites
    hasPrerequisites,
    getMissingPrerequisites,
    isTechAvailable,
    getAvailableTechs,
    detectCircularDependency,
    validateTechTree,

    // Research progress
    calculateResearchProgress,
    calculateRemainingTime,
    isResearchComplete,
    updateResearchProgress,

    // Validation
    canStartResearch,

    // Modifiers
    calculateModifier,
    calculateAdditiveModifier,
    getUnlockedBuildings,
    isBuildingUnlocked,
};
