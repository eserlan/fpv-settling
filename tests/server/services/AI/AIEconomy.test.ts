import "../../../../tests/testUtils";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AIEconomy } from "../../../../src/server/services/AI/AIEconomy";

// Mocks
const mockPortManager = {
    GetBestTradeRatio: (res: string) => 4,
    ExecuteTrade: vi.fn().mockReturnValue([true, "Traded"]),
};

const mockResourceManager = {
    Resources: { Wood: 0, Brick: 0, Wheat: 0, Wool: 0, Ore: 0 } as Record<string, number>,
};

const mockMarketManager = {
    GetOffers: vi.fn().mockReturnValue([]),
    PostOffer: vi.fn().mockReturnValue(true),
    AcceptOffer: vi.fn().mockReturnValue(true),
};

const mockPlayerData = {
    ResourceManager: mockResourceManager,
    PortManager: mockPortManager,
} as any;

describe("AIEconomy", () => {
    let economy: AIEconomy;
    const userId = 123;

    beforeEach(() => {
        economy = new AIEconomy(userId, "TestBot");
        // Reset mocks
        mockResourceManager.Resources = { Wood: 0, Brick: 0, Wheat: 0, Wool: 0, Ore: 0 };
        mockPortManager.ExecuteTrade.mockClear();
        mockMarketManager.GetOffers.mockReturnValue([]);
        mockMarketManager.PostOffer.mockClear();
        mockMarketManager.AcceptOffer.mockClear();
    });

    describe("CanAfford", () => {
        it("should correctly identify affordable buildings", () => {
            const rich = { Wood: 5, Brick: 5, Wheat: 5, Wool: 5, Ore: 5 };
            expect(economy.CanAfford("Road", rich)).toBe(true);
            expect(economy.CanAfford("Town", rich)).toBe(true);
            expect(economy.CanAfford("City", rich)).toBe(true);

            const poor = { Wood: 0, Brick: 0, Wheat: 0, Wool: 0, Ore: 0 };
            expect(economy.CanAfford("Road", poor)).toBe(false);
        });

        it("should check specific requirements", () => {
            const roadOnly = { Wood: 1, Brick: 1, Wheat: 0, Wool: 0, Ore: 0 };
            expect(economy.CanAfford("Road", roadOnly)).toBe(true);
            expect(economy.CanAfford("Town", roadOnly)).toBe(false);

            const cityOnly = { Wheat: 2, Ore: 3, Wood: 0, Brick: 0, Wool: 0 };
            expect(economy.CanAfford("City", cityOnly)).toBe(true);
        });
    });

    describe("GetResourceNeeds", () => {
        it("should calculate missing resources", () => {
            const have = { Wood: 1, Brick: 0 }; // Missing 1 Brick for Road
            const needs = economy.GetResourceNeeds("Road", have);
            expect(needs["Brick"]).toBe(1);
            expect(needs["Wood"]).toBeUndefined();
        });

        it("should return empty if affordable", () => {
            const have = { Wood: 1, Brick: 1 };
            const needs = economy.GetResourceNeeds("Road", have);
            expect(Object.keys(needs).length).toBe(0);
        });
    });

    describe("TryTradeForNeeds", () => {
        it("should trade surplus via Port if ratio met", () => {
            // Need Brick for Road. Have 5 Wood. Ratio is 4.
            mockResourceManager.Resources = { Wood: 5, Brick: 0, Wheat: 0, Wool: 0, Ore: 0 };
            mockPortManager.GetBestTradeRatio = () => 4;

            economy.TryTradeForNeeds(mockPlayerData, "Road", mockMarketManager as any);

            expect(mockPortManager.ExecuteTrade).toHaveBeenCalledWith("Wood", "Brick");
        });

        it("should post market offer if port trade not possible", () => {
            // Need Brick. Have 2 Wood (not enough for port 4:1).
            mockResourceManager.Resources = { Wood: 2, Brick: 0, Wheat: 0, Wool: 0, Ore: 0 };
            mockPortManager.GetBestTradeRatio = () => 4;

            // Should try to post 1 Wood for 1 Brick
            mockMarketManager.GetOffers.mockReturnValue([]); // No existing offers

            economy.TryTradeForNeeds(mockPlayerData, "Road", mockMarketManager as any);

            expect(mockMarketManager.PostOffer).toHaveBeenCalledWith(userId, { Wood: 1 }, "Brick", 1);
        });
    });

    describe("TryMarketTrade", () => {
        it("should accept favorable offers", () => {
            mockResourceManager.Resources = { Wood: 0, Brick: 5 }; // Need Wood, Have Brick surplus

            // Offer: Give Wood, Want Brick
            const offer = {
                id: "offer1",
                posterId: 999,
                giveResources: { Wood: 1 },
                wantType: "Brick",
                wantAmount: 1
            };
            mockMarketManager.GetOffers.mockReturnValue([offer]);

            economy.TryMarketTrade(mockPlayerData, mockMarketManager as any);

            expect(mockMarketManager.AcceptOffer).toHaveBeenCalledWith(userId, "offer1");
        });
    });
});
