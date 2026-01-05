import { OnStart, Service, Dependency } from "@flamework/core";
import { GameService } from "./GameService";
import { ServerEvents } from "../ServerEvents";
import { NetworkUtils } from "../NetworkUtils";
import { MarketOffer, ResourceDict } from "shared/MarketTypes";
import { ResourceType } from "shared/TradeMath";
import ResourceTypes from "shared/ResourceTypes";
import * as Logger from "shared/Logger";
import { HttpService } from "@rbxts/services";

@Service({})
export class MarketManager implements OnStart {
    private offers: MarketOffer[] = [];
    public OnOfferPosted?: (offer: MarketOffer) => void;
    private readonly MAX_TRADES_PER_PLAYER = 3;

    constructor() { }

    onStart() {
        ServerEvents.PostMarketOffer.connect((player, giveResources, wantType, wantAmount) => {
            this.PostOffer(player.UserId, giveResources, wantType as ResourceType, wantAmount);
        });

        ServerEvents.AcceptMarketOffer.connect((player, offerId) => {
            this.AcceptOffer(player.UserId, offerId);
        });

        ServerEvents.CancelMarketOffer.connect((player, offerId) => {
            this.CancelOffer(player.UserId, offerId);
        });

        Logger.Info("MarketManager", "Market Manager initialized");
    }

    public GetOffers(): MarketOffer[] {
        return this.offers;
    }

    public PostOffer(posterId: number, giveResources: ResourceDict, wantType: ResourceType, wantAmount: number): boolean {
        const gameService = Dependency<GameService>();
        const playerData = gameService.PlayerData[posterId];
        if (!playerData) return false;

        const playerActiveTrades = this.offers.filter(o => o.posterId === posterId).size();
        if (playerActiveTrades >= this.MAX_TRADES_PER_PLAYER) {
            NetworkUtils.FireClient(playerData.Player as Player, ServerEvents.SystemMessageEvent, "You already have 3 active trades!");
            return false;
        }

        // Check if player has all resources
        for (const [res, amt] of pairs(giveResources)) {
            if (playerData.ResourceManager.GetResource(res as string) < (amt as number)) {
                NetworkUtils.FireClient(playerData.Player as Player, ServerEvents.SystemMessageEvent, `Insufficient ${res} to post trade!`);
                return false;
            }
        }

        // Lock all resources in escrow
        for (const [res, amt] of pairs(giveResources)) {
            playerData.ResourceManager.RemoveResource(res as string, amt as number);
        }

        const offer: MarketOffer = {
            id: HttpService.GenerateGUID(false),
            posterId: posterId,
            posterName: playerData.Player.Name,
            giveResources,
            wantType,
            wantAmount,
            timestamp: os.time(),
        };

        this.offers.push(offer);
        Logger.Info("MarketManager", `[${playerData.Player.Name}] Posted trade for ${wantAmount} ${wantType}`);
        this.BroadcastUpdate();

        if (this.OnOfferPosted) this.OnOfferPosted(offer);

        // Broadcast to chat
        let giveStr = "";
        for (const [res, amt] of pairs(giveResources)) {
            if ((amt as number) > 0) {
                const icon = ResourceTypes.Get(res as string)?.Icon ?? "";
                giveStr += `${amt}${icon} `;
            }
        }
        const wantIcon = ResourceTypes.Get(wantType)?.Icon ?? "";
        const message = `[GLOBAL MARKET] ${playerData.Player.Name} posted a trade: GIVE ${giveStr}↔ WANT ${wantAmount}${wantIcon}`;
        NetworkUtils.Broadcast(ServerEvents.SystemMessageEvent, message);

        return true;
    }

    public AcceptOffer(accepterId: number, offerId: string): boolean {
        const offerIndex = this.offers.findIndex(o => o.id === offerId);
        if (offerIndex === -1) return false;

        const offer = this.offers[offerIndex];
        if (offer.posterId === accepterId) {
            return false; // Cannot accept your own offer
        }

        const gameService = Dependency<GameService>();
        const accepterData = gameService.PlayerData[accepterId];
        const posterData = gameService.PlayerData[offer.posterId];
        if (!accepterData) return false;

        if (accepterData.ResourceManager.GetResource(offer.wantType) < offer.wantAmount) {
            if (typeIs(accepterData.Player, "Instance")) {
                NetworkUtils.FireClient(accepterData.Player as Player, ServerEvents.SystemMessageEvent, "Insufficient resources to accept trade!");
            }
            return false;
        }

        // Process swap
        // 1. Accepter pays wantAmount
        accepterData.ResourceManager.RemoveResource(offer.wantType, offer.wantAmount);
        // 2. Accepter receives giveResources (already removed from poster)
        for (const [res, amt] of pairs(offer.giveResources)) {
            accepterData.ResourceManager.AddResource(res as string, amt as number);
        }

        // 3. Poster receives wantAmount
        if (posterData) {
            posterData.ResourceManager.AddResource(offer.wantType, offer.wantAmount);
        }

        this.offers.remove(offerIndex);
        Logger.Info("MarketManager", `[${accepterData.Player.Name}] Accepted trade from ${offer.posterName}`);

        // Notify poster privately
        if (posterData && typeIs(posterData.Player, "Instance")) {
            NetworkUtils.FireClient(posterData.Player as Player, ServerEvents.SystemMessageEvent, `${accepterData.Player.Name} accepted your trade!`);
        }

        // Broadcast to everyone
        NetworkUtils.Broadcast(ServerEvents.SystemMessageEvent, `[GLOBAL MARKET] ${accepterData.Player.Name} accepted ${offer.posterName}'s trade!`);

        this.BroadcastUpdate();
        return true;
    }

    public CancelOffer(posterId: number, offerId: string): boolean {
        const offerIndex = this.offers.findIndex(o => o.id === offerId);
        if (offerIndex === -1) return false;

        const offer = this.offers[offerIndex];
        if (offer.posterId !== posterId) return false;

        const gameService = Dependency<GameService>();
        const playerData = gameService.PlayerData[posterId];
        if (playerData) {
            // Return all resources from escrow
            for (const [res, amt] of pairs(offer.giveResources)) {
                playerData.ResourceManager.AddResource(res as string, amt as number);
            }
        }

        this.offers.remove(offerIndex);
        Logger.Info("MarketManager", `[${offer.posterName}] Cancelled trade offer.`);
        this.BroadcastUpdate();
        return true;
    }

    private BroadcastUpdate() {
        NetworkUtils.Broadcast(ServerEvents.MarketUpdate, this.offers);
    }
}
