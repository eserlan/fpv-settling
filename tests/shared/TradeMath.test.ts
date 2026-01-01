// Import mocks before any other imports
import "../testUtils";

import { describe, it, expect } from "vitest";
import TradeMath, {
    DEFAULT_TRADE_RATIO,
    GENERIC_PORT_RATIO,
    SPECIALIZED_PORT_RATIO,
    RESOURCE_TYPES,
    isValidResource,
    validateTradeRequest,
    getSpecializedPortName,
    isSpecializedPortFor,
    getBestTradeRatio,
    getBestPortFor,
    calculateTradeCost,
    calculateReceiveAmount,
    canAffordTrade,
    calculateTrade,
    calculatePortSavings,
    getTradeRatioDescription,
} from "../../src/shared/TradeMath";

describe("TradeMath", () => {
    describe("Constants", () => {
        it("should have correct trade ratios", () => {
            expect(DEFAULT_TRADE_RATIO).toBe(4);
            expect(GENERIC_PORT_RATIO).toBe(3);
            expect(SPECIALIZED_PORT_RATIO).toBe(2);
        });

        it("should have 5 resource types", () => {
            expect(RESOURCE_TYPES).toHaveLength(5);
            expect(RESOURCE_TYPES).toContain("Wood");
            expect(RESOURCE_TYPES).toContain("Brick");
            expect(RESOURCE_TYPES).toContain("Wheat");
            expect(RESOURCE_TYPES).toContain("Ore");
            expect(RESOURCE_TYPES).toContain("Wool");
        });
    });

    describe("isValidResource", () => {
        it("should return true for valid resources", () => {
            expect(isValidResource("Wood")).toBe(true);
            expect(isValidResource("Brick")).toBe(true);
            expect(isValidResource("Wheat")).toBe(true);
            expect(isValidResource("Ore")).toBe(true);
            expect(isValidResource("Wool")).toBe(true);
        });

        it("should return false for invalid resources", () => {
            expect(isValidResource("Gold")).toBe(false);
            expect(isValidResource("Stone")).toBe(false);
            expect(isValidResource("")).toBe(false);
            expect(isValidResource("wood")).toBe(false); // Case sensitive
        });
    });

    describe("validateTradeRequest", () => {
        it("should return undefined for valid trade", () => {
            expect(validateTradeRequest("Wood", "Brick", 1)).toBeUndefined();
            expect(validateTradeRequest("Ore", "Wheat", 5)).toBeUndefined();
        });

        it("should reject invalid give resource", () => {
            const error = validateTradeRequest("Gold", "Wood", 1);
            expect(error).toContain("Invalid give resource");
        });

        it("should reject invalid receive resource", () => {
            const error = validateTradeRequest("Wood", "Gold", 1);
            expect(error).toContain("Invalid receive resource");
        });

        it("should reject same resource trade", () => {
            const error = validateTradeRequest("Wood", "Wood", 1);
            expect(error).toContain("Cannot trade same resource type");
        });

        it("should reject zero or negative amounts", () => {
            expect(validateTradeRequest("Wood", "Brick", 0)).toContain("positive");
            expect(validateTradeRequest("Wood", "Brick", -1)).toContain("positive");
        });

        it("should reject non-integer amounts", () => {
            expect(validateTradeRequest("Wood", "Brick", 1.5)).toContain("whole number");
        });
    });

    describe("getSpecializedPortName", () => {
        it("should create correct port names", () => {
            expect(getSpecializedPortName("Wood")).toBe("WoodPort");
            expect(getSpecializedPortName("Brick")).toBe("BrickPort");
            expect(getSpecializedPortName("Wheat")).toBe("WheatPort");
            expect(getSpecializedPortName("Ore")).toBe("OrePort");
            expect(getSpecializedPortName("Wool")).toBe("WoolPort");
        });
    });

    describe("isSpecializedPortFor", () => {
        it("should match correct port to resource", () => {
            expect(isSpecializedPortFor("WoodPort", "Wood")).toBe(true);
            expect(isSpecializedPortFor("BrickPort", "Brick")).toBe(true);
        });

        it("should not match incorrect port to resource", () => {
            expect(isSpecializedPortFor("WoodPort", "Brick")).toBe(false);
            expect(isSpecializedPortFor("GenericPort", "Wood")).toBe(false);
        });
    });

    describe("getBestTradeRatio", () => {
        it("should return 2 for specialized port", () => {
            expect(getBestTradeRatio("Wood", ["WoodPort"])).toBe(2);
            expect(getBestTradeRatio("Brick", ["BrickPort", "GenericPort"])).toBe(2);
        });

        it("should return 3 for generic port", () => {
            expect(getBestTradeRatio("Wood", ["GenericPort"])).toBe(3);
            expect(getBestTradeRatio("Ore", ["WoodPort", "GenericPort"])).toBe(3);
        });

        it("should return 4 for no ports (bank trade)", () => {
            expect(getBestTradeRatio("Wood", [])).toBe(4);
            expect(getBestTradeRatio("Wood", ["BrickPort"])).toBe(4);
        });

        it("should prefer specialized over generic", () => {
            expect(getBestTradeRatio("Wood", ["WoodPort", "GenericPort"])).toBe(2);
        });
    });

    describe("getBestPortFor", () => {
        it("should return specialized port if owned", () => {
            expect(getBestPortFor("Wood", ["WoodPort"])).toBe("WoodPort");
            expect(getBestPortFor("Brick", ["BrickPort", "GenericPort"])).toBe("BrickPort");
        });

        it("should return GenericPort if no specialized", () => {
            expect(getBestPortFor("Wood", ["GenericPort"])).toBe("GenericPort");
            expect(getBestPortFor("Ore", ["WoodPort", "GenericPort"])).toBe("GenericPort");
        });

        it("should return undefined for no ports", () => {
            expect(getBestPortFor("Wood", [])).toBeUndefined();
            expect(getBestPortFor("Wood", ["BrickPort"])).toBeUndefined();
        });
    });

    describe("calculateTradeCost", () => {
        it("should calculate correct costs", () => {
            expect(calculateTradeCost(1, 4)).toBe(4);
            expect(calculateTradeCost(2, 3)).toBe(6);
            expect(calculateTradeCost(5, 2)).toBe(10);
        });
    });

    describe("calculateReceiveAmount", () => {
        it("should calculate correct receive amounts", () => {
            expect(calculateReceiveAmount(4, 4)).toBe(1);
            expect(calculateReceiveAmount(8, 4)).toBe(2);
            expect(calculateReceiveAmount(6, 3)).toBe(2);
        });

        it("should round down for partial trades", () => {
            expect(calculateReceiveAmount(5, 4)).toBe(1);
            expect(calculateReceiveAmount(7, 3)).toBe(2);
            expect(calculateReceiveAmount(3, 4)).toBe(0);
        });
    });

    describe("canAffordTrade", () => {
        it("should return true when can afford", () => {
            expect(canAffordTrade(10, 5)).toBe(true);
            expect(canAffordTrade(5, 5)).toBe(true);
        });

        it("should return false when cannot afford", () => {
            expect(canAffordTrade(4, 5)).toBe(false);
            expect(canAffordTrade(0, 1)).toBe(false);
        });
    });

    describe("calculateTrade", () => {
        it("should return complete calculation for valid trade", () => {
            const result = calculateTrade({
                giveResource: "Wood",
                receiveResource: "Brick",
                amount: 2,
                ownedPorts: ["WoodPort"],
            });

            expect(result.isValid).toBe(true);
            expect(result.tradeRatio).toBe(2);
            expect(result.totalCost).toBe(4);
            expect(result.receiveAmount).toBe(2);
        });

        it("should use bank trade when no ports", () => {
            const result = calculateTrade({
                giveResource: "Wood",
                receiveResource: "Brick",
                amount: 1,
                ownedPorts: [],
            });

            expect(result.isValid).toBe(true);
            expect(result.tradeRatio).toBe(4);
            expect(result.totalCost).toBe(4);
        });

        it("should return error for invalid trade", () => {
            const result = calculateTrade({
                giveResource: "Wood",
                receiveResource: "Wood",
                amount: 1,
                ownedPorts: [],
            });

            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toBeDefined();
        });
    });

    describe("calculatePortSavings", () => {
        it("should calculate savings correctly", () => {
            // Specialized port (2:1): save 2 resources per trade
            expect(calculatePortSavings(1, 2)).toBe(2);
            expect(calculatePortSavings(2, 2)).toBe(4);

            // Generic port (3:1): save 1 resource per trade
            expect(calculatePortSavings(1, 3)).toBe(1);
            expect(calculatePortSavings(3, 3)).toBe(3);

            // Bank trade (4:1): no savings
            expect(calculatePortSavings(1, 4)).toBe(0);
        });
    });

    describe("getTradeRatioDescription", () => {
        it("should return correct descriptions", () => {
            expect(getTradeRatioDescription(2)).toContain("Specialized");
            expect(getTradeRatioDescription(3)).toContain("Generic");
            expect(getTradeRatioDescription(4)).toContain("Bank");
        });
    });

    describe("Default export", () => {
        it("should export all functions", () => {
            expect(TradeMath.isValidResource).toBeDefined();
            expect(TradeMath.getBestTradeRatio).toBeDefined();
            expect(TradeMath.calculateTrade).toBeDefined();
            expect(TradeMath.DEFAULT_TRADE_RATIO).toBe(4);
        });
    });
});
