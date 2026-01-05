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
    });

    describe("GetResourceNeeds", () => {
        it("should calculate missing resources", () => {
            const have = { Wood: 1, Brick: 0 }; // Missing 1 Brick for Road
            const needs = economy.GetResourceNeeds("Road", have);
            expect(needs["Brick"]).toBe(1);
            expect(needs["Wood"]).toBeUndefined();
        });
    });

    describe("TryTradeForNeeds", () => {
        it("should post market offer if surplus exists", () => {
            // Need Brick for Road. Have 5 Wood.
            mockResourceManager.Resources = { Wood: 5, Brick: 0, Wheat: 0, Wool: 0, Ore: 0 };
            mockPortManager.GetBestTradeRatio = () => 4;

            economy.TryTradeForNeeds(mockPlayerData, "Road", mockMarketManager as any);

            // Favor Market over Port
            expect(mockMarketManager.PostOffer).toHaveBeenCalledWith(userId, { Wood: 1 }, "Brick", 1);
            expect(mockPortManager.ExecuteTrade).not.toHaveBeenCalled();
        });

        it("should trade surplus via Port if market limit reached", () => {
            // Need Brick for Road. Have 5 Wood.
            mockResourceManager.Resources = { Wood: 5, Brick: 0, Wheat: 0, Wool: 0, Ore: 0 };
            mockPortManager.GetBestTradeRatio = () => 4;

            // Mock market limit (already have 4 offers by me)
            mockMarketManager.GetOffers.mockReturnValue([
                { posterId: userId }, { posterId: userId }, { posterId: userId }, { posterId: userId }
            ] as any);

            economy.TryTradeForNeeds(mockPlayerData, "Road", mockMarketManager as any);

            expect(mockPortManager.ExecuteTrade).toHaveBeenCalledWith("Wood", "Brick");
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

    describe("TryPortBalance", () => {
        it("should execute port trade for extreme surplus", () => {
            // Need Wood, Have 6 Brick
            mockResourceManager.Resources = { Wood: 0, Brick: 6, Wheat: 0, Wool: 0, Ore: 0 };
            economy.TryPortBalance(mockPlayerData);
            expect(mockPortManager.ExecuteTrade).toHaveBeenCalledWith("Brick", "Wood");
        });

        it("should not trade if surplus is minor (<= 5)", () => {
            mockResourceManager.Resources = { Wood: 0, Brick: 5, Wheat: 0, Wool: 0, Ore: 0 };
            economy.TryPortBalance(mockPlayerData);
            expect(mockPortManager.ExecuteTrade).not.toHaveBeenCalled();
        });
    });
});
