import { PlayerData } from "../../PlayerData";
import { MarketManager } from "../MarketManager";
import { ResourceDict, MarketOffer } from "shared/MarketTypes";
import { ResourceType } from "shared/TradeMath";
import * as Logger from "shared/Logger";
import { canAfford, getMissingResources, getBuildingCost } from "shared/lib/EconomyRules";
import { SkillLevel } from "shared/GameTypes";

export class AIEconomy {
    private userId: number;
    private name: string;
    private skill: SkillLevel;

    constructor(userId: number, name: string, skill: SkillLevel = "Intermediate") {
        this.userId = userId;
        this.name = name;
        this.skill = skill;
    }

    public CanAfford(building: string, resources: Record<string, number>): boolean {
        const cost = getBuildingCost(building);
        if (!cost) return false;
        return canAfford(resources, cost);
    }

    public GetResourceNeeds(targetType: string, resources: Record<string, number>): Record<string, number> {
        const cost = getBuildingCost(targetType);
        if (!cost) return {};
        return getMissingResources(resources, cost);
    }

    public TryPortBalance(playerData: PlayerData) {
        const res = playerData.ResourceManager.Resources;
        // Port balancing is a last resort: if > 5 of anything, trade for something we have < 1
        for (const [r, amt] of pairs(res)) {
            if ((amt as number) > 5) {
                // Find shortage
                for (const [missing, mAmt] of pairs(res)) {
                    if ((mAmt as number) < 1) {
                        playerData.PortManager.ExecuteTrade(r as string, missing as string);
                        Logger.Info("AIPlayer", `Port Balance: ${r} -> ${missing}`);
                        return;
                    }
                }
            }
        }
    }

    public TryTradeForNeeds(playerData: PlayerData, targetType: "City" | "Town" | "Road", marketManager: MarketManager) {
        const resources = playerData.ResourceManager.Resources;
        const needs = this.GetResourceNeeds(targetType, resources);

        let nextNeed: string | undefined;
        for (const [res, _] of pairs(needs)) {
            nextNeed = res as string;
            break;
        }
        if (!nextNeed) return;

        // Find surplus
        const surpluses: { res: string, amt: number }[] = [];
        const targetCost = getBuildingCost(targetType);
        if (!targetCost) return;

        for (const [res, amt] of pairs(resources)) {
            const neededForTarget = targetCost[res as string] ?? 0;
            if ((amt as number) > neededForTarget) {
                surpluses.push({ res: res as string, amt: (amt as number) - neededForTarget });
            }
        }

        if (surpluses.size() === 0) return;

        // Sort surpluses by amount descending
        surpluses.sort((a, b) => a.amt > b.amt);

        // 1. Try Posting to Market first (better rates: 1:1)
        const myActiveOffers = marketManager.GetOffers().filter(o => o.posterId === this.userId);
        if (myActiveOffers.size() < 4) { // Increased limit
            const alreadySeeking = myActiveOffers.some(o => o.wantType === nextNeed);
            if (!alreadySeeking) {
                for (const surplus of surpluses) {
                    if (surplus.amt >= 1) {
                        const giveDict: ResourceDict = { [surplus.res]: 1 };
                        const success = marketManager.PostOffer(this.userId, giveDict, nextNeed as ResourceType, 1);
                        if (success) {
                            Logger.Info("AIPlayer", `${this.name} posted market trade: 1 ${surplus.res} for 1 ${nextNeed}`);
                            return;
                        }
                    }
                }
            }
        }

        // 2. Try Port Trade as fallback (worse rates: 4:1, 3:1, 2:1)
        for (const surplus of surpluses) {
            const ratio = playerData.PortManager.GetBestTradeRatio(surplus.res);
            if (surplus.amt >= ratio) {
                const [success] = playerData.PortManager.ExecuteTrade(surplus.res, nextNeed);
                if (success) {
                    Logger.Info("AIPlayer", `${this.name} traded surplus ${surplus.res} for needed ${nextNeed} (Port)`);
                    return;
                }
            }
        }
    }

    public TryMarketTrade(playerData: PlayerData, marketManager: MarketManager) {
        const resources = playerData.ResourceManager.Resources;
        const activeOffers = marketManager.GetOffers();

        // Priority 1: Fill needs
        for (const offer of activeOffers) {
            if (offer.posterId === this.userId) continue;

            let totalGive = 0;
            for (const [_, amt] of pairs(offer.giveResources)) totalGive += (amt as number);

            // Skill-based Thresholds
            const keepThreshold = this.skill === "Expert" ? 3 : (this.skill === "Beginner" ? 1 : 2);
            const wantLimit = this.skill === "Expert" ? 1 : 2;

            if (totalGive >= 1 && (resources[offer.wantType] ?? 0) >= keepThreshold) {
                let helpsMe = false;
                for (const [res, amt] of pairs(offer.giveResources)) {
                    // Expert only takes what they strictly need (< 1)
                    // Beginner takes anything they don't have a ton of (< 3)
                    const needLimit = this.skill === "Expert" ? 1 : (this.skill === "Beginner" ? 3 : 2);
                    if ((resources[res as string] ?? 0) < needLimit && (amt as number) > 0) {
                        helpsMe = true;
                        break;
                    }
                }

                if (helpsMe) {
                    const success = marketManager.AcceptOffer(this.userId, offer.id);
                    if (success) {
                        Logger.Info("AIPlayer", `${this.name} accepted market trade for ${offer.wantAmount} ${offer.wantType}`);
                        return;
                    }
                }
            }
        }

        // Priority 2: Balancing
        const myActiveCount = activeOffers.filter(o => o.posterId === this.userId).size();
        if (myActiveCount < 3) { // Increased from 2
            for (const [res, amt] of pairs(resources)) {
                if ((amt as number) > 3) { // Decreased from 4
                    for (const [neededRes, neededAmt] of pairs(resources)) {
                        if ((neededAmt as number) < 2 && neededRes !== res) { // Increased from <= 1
                            const giveDict: ResourceDict = { [res as string]: 1 };
                            const success = marketManager.PostOffer(this.userId, giveDict, neededRes as ResourceType, 1);
                            if (success) {
                                Logger.Info("AIPlayer", `${this.name} posted balancing trade: 1 ${res} for 1 ${neededRes}`);
                                return;
                            }
                        }
                    }
                }
            }
        }
    }

    public EvaluateMarketOffer(offer: MarketOffer, playerData: PlayerData, marketManager: MarketManager) {
        if (offer.posterId === this.userId) return;

        const resources = playerData.ResourceManager.Resources;
        const have = resources[offer.wantType] ?? 0;
        if (have > 2) {
            this.TryMarketTrade(playerData, marketManager);
        }
    }
}
