// Server-side Port Manager
// Handles port ownership and trading logic

import PortTypes, { StandardPortConfiguration, DEFAULT_TRADE_RATIO, PortLocation } from "shared/PortTypes";
import ResourceTypes from "shared/ResourceTypes";
import { ServerEvents } from "./ServerEvents";
import * as Logger from "shared/Logger";
import ResourceManager = require("./ResourceManager");

// Events handled by Flamework automatically


class PortManager {
	Player: Player;
	ResourceManager: ResourceManager;
	PortLocations: PortLocation[];
	OwnedPorts: string[]; // List of port types owned by this player

	constructor(player: Player, resourceManager: ResourceManager) {
		this.Player = player;
		this.ResourceManager = resourceManager;
		this.PortLocations = [];
		this.OwnedPorts = [];
	}

	// Check if player owns a specific port type or generic port
	HasPort(portType: string): boolean {
		return this.OwnedPorts.includes(portType);
	}

	// Get best available trade ratio for a given resource
	GetBestTradeRatio(resourceType: string): number {
		// Check if player has a specialized port for this resource
		const specializedPort = `${resourceType}Port`;
		if (this.HasPort(specializedPort)) {
			return 2; // Specialized port: 2:1
		}

		// Check if player has a generic port
		if (this.HasPort("GenericPort")) {
			return 3; // Generic port: 3:1
		}

		// Default bank trade
		return DEFAULT_TRADE_RATIO; // 4:1
	}

	// Execute a trade using port or bank
	ExecuteTrade(
		giveResourceType: string,
		receiveResourceType: string,
		amount: number = 1,
	): [boolean, string] {
		// Validate resources
		if (!ResourceTypes.Get(giveResourceType) || !ResourceTypes.Get(receiveResourceType)) {
			return $tuple(false, "Invalid resource type");
		}

		if (giveResourceType === receiveResourceType) {
			return $tuple(false, "Cannot trade same resource type");
		}

		// Get the best available trade ratio for the given resource
		const tradeRatio = this.GetBestTradeRatio(giveResourceType);
		const totalCost = tradeRatio * amount;

		// Check if player has enough resources
		if (this.ResourceManager.GetResource(giveResourceType) < totalCost) {
			Logger.Warn(
				"PortManager",
				`${this.Player.Name} doesn't have enough ${giveResourceType} to trade (needs ${totalCost}, has ${this.ResourceManager.GetResource(giveResourceType)})`,
			);
			return $tuple(false, `Not enough ${giveResourceType}. Need ${totalCost}, have ${this.ResourceManager.GetResource(giveResourceType)}`);
		}

		// Remove the resources being traded
		const removed = this.ResourceManager.RemoveResource(giveResourceType, totalCost);
		if (!removed) {
			return $tuple(false, "Failed to remove resources");
		}

		// Add the received resources
		const added = this.ResourceManager.AddResource(receiveResourceType, amount);
		if (!added) {
			// Rollback the trade if we can't add the resource
			this.ResourceManager.AddResource(giveResourceType, totalCost);
			return $tuple(false, "Failed to add resources (inventory full?)");
		}

		Logger.Info(
			"PortManager",
			`${this.Player.Name} traded ${totalCost} ${giveResourceType} for ${amount} ${receiveResourceType} (ratio: ${tradeRatio}:1)`,
		);

		// Notify client of successful trade
		ServerEvents.TradeCompleted.fire(this.Player, giveResourceType, totalCost, receiveResourceType, amount, tradeRatio);
		ServerEvents.SystemMessageEvent.fire(
			this.Player,
			`📦 Trade Success: ${totalCost} ${giveResourceType} -> ${amount} ${receiveResourceType}`,
		);

		return $tuple(true, "Trade successful");
	}

	// Called when a player builds a settlement on a port intersection
	ClaimPort(position: Vector3, settlementId: string) {
		// Find any port that has a vertex near this position
		for (const portLocation of this.PortLocations) {
			for (const vertex of portLocation.Vertices) {
				const distance = position.sub(vertex).Magnitude;
				if (distance < 5) {
					// Within 5 studs of a port vertex
					// Check if port is already owned by this player
					if (!this.HasPort(portLocation.PortType)) {
						this.OwnedPorts.push(portLocation.PortType);
						portLocation.OwnerUserId = this.Player.UserId;

						Logger.Info(
							"PortManager",
							`${this.Player.Name} claimed ${portLocation.PortType} at settlement ${settlementId}`,
						);

						// Notify client about port ownership
						ServerEvents.PortClaimed.fire(this.Player, portLocation.PortType);

						// Check for Harbor Master bonus
						this.CheckHarborMaster();
					}
					break;
				}
			}
		}
	}

	// Calculate Harbor Master points (Settlement = 1 point, City = 2 points)
	GetHarborMasterPoints(): number {
		return this.OwnedPorts.size();
	}

	// Check if player should receive Harbor Master bonus
	CheckHarborMaster() {
		const points = this.GetHarborMasterPoints();
		if (points >= 3) {
			Logger.Info("PortManager", `${this.Player.Name} has ${points} ports - Harbor Master candidate!`);
			ServerEvents.HarborMasterUpdate.fire(this.Player, points);
		}
	}

	// Get all owned ports
	GetOwnedPorts(): string[] {
		return this.OwnedPorts;
	}

	// Set port locations (called during map generation)
	SetPortLocations(locations: PortLocation[]) {
		this.PortLocations = locations;
	}

	// Get port locations for visualization
	GetPortLocations(): PortLocation[] {
		return this.PortLocations;
	}
}


export = PortManager;
