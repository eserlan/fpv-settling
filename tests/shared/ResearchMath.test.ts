// Import mocks before any other imports
import "../testUtils";

import { describe, it, expect } from "vitest";
import ResearchMath, {
    createResearchState,
    hasResearched,
    isResearching,
    getResearchedTechs,
    hasPrerequisites,
    getMissingPrerequisites,
    isTechAvailable,
    getAvailableTechs,
    detectCircularDependency,
    validateTechTree,
    calculateResearchProgress,
    calculateRemainingTime,
    isResearchComplete,
    updateResearchProgress,
    canStartResearch,
    calculateModifier,
    calculateAdditiveModifier,
    getUnlockedBuildings,
    isBuildingUnlocked,
    TechInfo,
    TechTree,
    ResearchState,
} from "../../src/shared/ResearchMath";

// Sample tech tree for testing
const sampleTechTree: TechTree = {
    BasicTools: {
        Name: "Basic Tools",
        Description: "Improves resource gathering",
        Cost: { Wood: 2, Ore: 1 },
        ResearchTime: 30,
        Prerequisites: [],
        Effect: "GatherSpeed",
        Modifier: 1.25,
    },
    AdvancedTools: {
        Name: "Advanced Tools",
        Description: "Further improves gathering",
        Cost: { Wood: 3, Ore: 2 },
        ResearchTime: 60,
        Prerequisites: ["BasicTools"],
        Effect: "GatherSpeed",
        Modifier: 1.5,
    },
    Masonry: {
        Name: "Masonry",
        Description: "Unlocks stone buildings",
        Cost: { Brick: 5, Ore: 2 },
        ResearchTime: 45,
        Prerequisites: [],
        Effect: "UnlockBuilding",
        Unlocks: ["StoneWall", "Tower"],
    },
    CastleArchitecture: {
        Name: "Castle Architecture",
        Description: "Build castles",
        Cost: { Brick: 10, Ore: 5 },
        ResearchTime: 120,
        Prerequisites: ["Masonry", "BasicTools"],
        Effect: "UnlockBuilding",
        Unlocks: ["Castle"],
    },
    CostReduction: {
        Name: "Cost Reduction",
        Description: "Reduces building costs",
        Cost: { Wheat: 3 },
        ResearchTime: 30,
        Prerequisites: [],
        Effect: "BuildingCost",
        Modifier: 0.8, // 20% reduction
    },
};

describe("ResearchMath", () => {
    describe("Research State", () => {
        it("should create empty research state", () => {
            const state = createResearchState();
            expect(state.researched).toHaveLength(0);
            expect(state.currentResearch).toBeUndefined();
            expect(state.researchProgress).toBe(0);
        });

        it("should check if tech is researched", () => {
            const state: ResearchState = {
                researched: ["BasicTools"],
                currentResearch: undefined,
                researchProgress: 0,
            };
            expect(hasResearched(state, "BasicTools")).toBe(true);
            expect(hasResearched(state, "AdvancedTools")).toBe(false);
        });

        it("should check if currently researching", () => {
            expect(isResearching(createResearchState())).toBe(false);
            expect(
                isResearching({
                    researched: [],
                    currentResearch: "BasicTools",
                    researchProgress: 10,
                })
            ).toBe(true);
        });

        it("should return copy of researched techs", () => {
            const state: ResearchState = {
                researched: ["BasicTools", "Masonry"],
                currentResearch: undefined,
                researchProgress: 0,
            };
            const techs = getResearchedTechs(state);
            expect(techs).toEqual(["BasicTools", "Masonry"]);

            // Modifying returned array shouldn't affect original
            techs.push("NewTech");
            expect(state.researched).toHaveLength(2);
        });
    });

    describe("Prerequisite Validation", () => {
        it("should check if all prerequisites are met", () => {
            const state: ResearchState = {
                researched: ["BasicTools"],
                currentResearch: undefined,
                researchProgress: 0,
            };

            expect(hasPrerequisites(state, sampleTechTree["AdvancedTools"])).toBe(true);
            expect(hasPrerequisites(state, sampleTechTree["CastleArchitecture"])).toBe(false);
        });

        it("should return true for tech with no prerequisites", () => {
            const state = createResearchState();
            expect(hasPrerequisites(state, sampleTechTree["BasicTools"])).toBe(true);
        });

        it("should get missing prerequisites", () => {
            const state = createResearchState();
            const missing = getMissingPrerequisites(state, sampleTechTree["CastleArchitecture"]);

            expect(missing).toContain("Masonry");
            expect(missing).toContain("BasicTools");
            expect(missing).toHaveLength(2);
        });

        it("should check tech availability", () => {
            const state: ResearchState = {
                researched: ["BasicTools"],
                currentResearch: undefined,
                researchProgress: 0,
            };

            expect(isTechAvailable(state, "AdvancedTools", sampleTechTree["AdvancedTools"])).toBe(true);
            expect(isTechAvailable(state, "BasicTools", sampleTechTree["BasicTools"])).toBe(false); // Already researched
            expect(isTechAvailable(state, "CastleArchitecture", sampleTechTree["CastleArchitecture"])).toBe(false); // Missing prereqs
        });

        it("should get all available techs", () => {
            const state = createResearchState();
            const available = getAvailableTechs(state, sampleTechTree);

            expect(available).toContain("BasicTools");
            expect(available).toContain("Masonry");
            expect(available).toContain("CostReduction");
            expect(available).not.toContain("AdvancedTools"); // Needs BasicTools
        });
    });

    describe("Circular Dependency Detection", () => {
        it("should return undefined for valid tech tree", () => {
            const circular = detectCircularDependency(sampleTechTree, "CastleArchitecture");
            expect(circular).toBeUndefined();
        });

        it("should detect circular dependencies", () => {
            const circularTree: TechTree = {
                TechA: {
                    Name: "A",
                    Description: "",
                    Cost: {},
                    ResearchTime: 10,
                    Prerequisites: ["TechB"],
                    Effect: "",
                },
                TechB: {
                    Name: "B",
                    Description: "",
                    Cost: {},
                    ResearchTime: 10,
                    Prerequisites: ["TechA"],
                    Effect: "",
                },
            };

            const circular = detectCircularDependency(circularTree, "TechA");
            expect(circular).toBeDefined();
            expect(circular).toContain("TechA");
            expect(circular).toContain("TechB");
        });

        it("should validate entire tech tree", () => {
            const result = validateTechTree(sampleTechTree);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it("should report missing prerequisites", () => {
            const invalidTree: TechTree = {
                TechA: {
                    Name: "A",
                    Description: "",
                    Cost: {},
                    ResearchTime: 10,
                    Prerequisites: ["NonExistent"],
                    Effect: "",
                },
            };

            const result = validateTechTree(invalidTree);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain("NonExistent");
        });
    });

    describe("Research Progress", () => {
        it("should calculate progress percentage", () => {
            expect(calculateResearchProgress(15, 30)).toBe(50);
            expect(calculateResearchProgress(0, 30)).toBe(0);
            expect(calculateResearchProgress(30, 30)).toBe(100);
            expect(calculateResearchProgress(40, 30)).toBe(100); // Capped at 100
        });

        it("should calculate remaining time", () => {
            expect(calculateRemainingTime(15, 30)).toBe(15);
            expect(calculateRemainingTime(0, 30)).toBe(30);
            expect(calculateRemainingTime(30, 30)).toBe(0);
            expect(calculateRemainingTime(40, 30)).toBe(0);
        });

        it("should check if research is complete", () => {
            expect(isResearchComplete(15, 30)).toBe(false);
            expect(isResearchComplete(30, 30)).toBe(true);
            expect(isResearchComplete(35, 30)).toBe(true);
        });

        it("should update research progress", () => {
            const state: ResearchState = {
                researched: [],
                currentResearch: "BasicTools",
                researchProgress: 10,
            };

            const { newState, completed } = updateResearchProgress(state, 10, sampleTechTree);

            expect(completed).toBeUndefined();
            expect(newState.researchProgress).toBe(20);
            expect(newState.currentResearch).toBe("BasicTools");
        });

        it("should complete research when time reached", () => {
            const state: ResearchState = {
                researched: [],
                currentResearch: "BasicTools",
                researchProgress: 25,
            };

            const { newState, completed } = updateResearchProgress(state, 10, sampleTechTree);

            expect(completed).toBe("BasicTools");
            expect(newState.researched).toContain("BasicTools");
            expect(newState.currentResearch).toBeUndefined();
            expect(newState.researchProgress).toBe(0);
        });
    });

    describe("Start Research Validation", () => {
        it("should allow starting valid research", () => {
            const state = createResearchState();
            const result = canStartResearch(state, "BasicTools", sampleTechTree["BasicTools"], true);

            expect(result.canStart).toBe(true);
        });

        it("should reject already researched tech", () => {
            const state: ResearchState = {
                researched: ["BasicTools"],
                currentResearch: undefined,
                researchProgress: 0,
            };
            const result = canStartResearch(state, "BasicTools", sampleTechTree["BasicTools"], true);

            expect(result.canStart).toBe(false);
            expect(result.errorMessage).toContain("Already researched");
        });

        it("should reject when already researching", () => {
            const state: ResearchState = {
                researched: [],
                currentResearch: "Masonry",
                researchProgress: 10,
            };
            const result = canStartResearch(state, "BasicTools", sampleTechTree["BasicTools"], true);

            expect(result.canStart).toBe(false);
            expect(result.errorMessage).toContain("Already researching");
        });

        it("should reject missing prerequisites", () => {
            const state = createResearchState();
            const result = canStartResearch(
                state,
                "AdvancedTools",
                sampleTechTree["AdvancedTools"],
                true
            );

            expect(result.canStart).toBe(false);
            expect(result.errorMessage).toContain("Missing prerequisites");
        });

        it("should reject if not enough resources", () => {
            const state = createResearchState();
            const result = canStartResearch(state, "BasicTools", sampleTechTree["BasicTools"], false);

            expect(result.canStart).toBe(false);
            expect(result.errorMessage).toContain("Not enough resources");
        });
    });

    describe("Tech Modifiers", () => {
        it("should calculate multiplicative modifier", () => {
            const state: ResearchState = {
                researched: ["BasicTools", "AdvancedTools"],
                currentResearch: undefined,
                researchProgress: 0,
            };

            const modifier = calculateModifier(state, sampleTechTree, "GatherSpeed");
            expect(modifier).toBeCloseTo(1.875); // 1.25 * 1.5
        });

        it("should return 1 for no matching effects", () => {
            const state = createResearchState();
            const modifier = calculateModifier(state, sampleTechTree, "GatherSpeed");
            expect(modifier).toBe(1);
        });

        it("should calculate additive modifier with cap", () => {
            const state: ResearchState = {
                researched: ["CostReduction"],
                currentResearch: undefined,
                researchProgress: 0,
            };

            const modifier = calculateAdditiveModifier(state, sampleTechTree, "BuildingCost");
            expect(modifier).toBeCloseTo(0.8); // 1 - 0.2
        });
    });

    describe("Building Unlocks", () => {
        it("should get unlocked buildings", () => {
            const state: ResearchState = {
                researched: ["Masonry", "CastleArchitecture"],
                currentResearch: undefined,
                researchProgress: 0,
            };

            const unlocked = getUnlockedBuildings(state, sampleTechTree);
            expect(unlocked).toContain("StoneWall");
            expect(unlocked).toContain("Tower");
            expect(unlocked).toContain("Castle");
        });

        it("should check if building is unlocked", () => {
            const state: ResearchState = {
                researched: ["Masonry"],
                currentResearch: undefined,
                researchProgress: 0,
            };

            expect(isBuildingUnlocked(state, sampleTechTree, "Tower")).toBe(true);
            expect(isBuildingUnlocked(state, sampleTechTree, "Castle")).toBe(false);
        });
    });

    describe("Default export", () => {
        it("should export all functions", () => {
            expect(ResearchMath.createResearchState).toBeDefined();
            expect(ResearchMath.hasResearched).toBeDefined();
            expect(ResearchMath.canStartResearch).toBeDefined();
            expect(ResearchMath.calculateModifier).toBeDefined();
        });
    });
});
