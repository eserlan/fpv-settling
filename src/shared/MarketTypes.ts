import { ResourceType } from "./TradeMath";

export type ResourceDict = Record<string, number>;

export interface MarketOffer {
    id: string;
    posterId: number;
    posterName: string;
    giveResources: ResourceDict;
    wantType: ResourceType;
    wantAmount: number;
    timestamp: number;
}

export interface MarketState {
    offers: MarketOffer[];
}
