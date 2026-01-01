/**
 * TradeMath - Pure mathematical functions for trading calculations
 * 
 * This module contains pure functions (no Roblox dependencies) for:
 * - Trade ratio calculations
 * - Resource validation
 * - Trade cost calculations
 * 
 * Used by both client (TradeUI) and server (PortManager)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Default trade ratio without any port (bank trade) */
export const DEFAULT_TRADE_RATIO = 4;

/** Trade ratio with a generic port (3:1) */
export const GENERIC_PORT_RATIO = 3;

/** Trade ratio with a specialized port (2:1) */
export const SPECIALIZED_PORT_RATIO = 2;

/** All valid resource types */
export const RESOURCE_TYPES = ["Wood", "Brick", "Wheat", "Ore", "Wool"] as const;
export type ResourceType = typeof RESOURCE_TYPES[number];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Trade request parameters */
export type TradeRequest = {
    giveResource: string;
    receiveResource: string;
    amount: number;
    ownedPorts: string[];
};

/** Trade calculation result */
export type TradeCalculation = {
    isValid: boolean;
    errorMessage?: string;
    tradeRatio: number;
    totalCost: number;
    receiveAmount: number;
};

/** Port ownership info for ratio calculation */
export type PortOwnership = {
    hasGenericPort: boolean;
    hasSpecializedPort: (resourceType: string) => boolean;
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a resource type is valid
 */
export const isValidResource = (resourceType: string): boolean => {
    return RESOURCE_TYPES.includes(resourceType as ResourceType);
};

/**
 * Validate a trade request
 * Returns an error message if invalid, undefined if valid
 */
export const validateTradeRequest = (
    giveResource: string,
    receiveResource: string,
    amount: number
): string | undefined => {
    if (!isValidResource(giveResource)) {
        return `Invalid give resource: ${giveResource}`;
    }

    if (!isValidResource(receiveResource)) {
        return `Invalid receive resource: ${receiveResource}`;
    }

    if (giveResource === receiveResource) {
        return "Cannot trade same resource type";
    }

    if (amount <= 0) {
        return "Trade amount must be positive";
    }

    if (!Number.isInteger(amount)) {
        return "Trade amount must be a whole number";
    }

    return undefined;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE RATIO FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the specialized port name for a resource type
 * Example: "Wood" -> "WoodPort"
 */
export const getSpecializedPortName = (resourceType: string): string => {
    return `${resourceType}Port`;
};

/**
 * Check if a port is specialized for a given resource
 */
export const isSpecializedPortFor = (portType: string, resourceType: string): boolean => {
    return portType === getSpecializedPortName(resourceType);
};

/**
 * Calculate the best trade ratio for a resource based on owned ports
 * 
 * @param resourceType - The resource being given up
 * @param ownedPorts - List of port types owned by the player
 * @returns The best available trade ratio (2, 3, or 4)
 */
export const getBestTradeRatio = (resourceType: string, ownedPorts: string[]): number => {
    // Check for specialized port first (best ratio: 2:1)
    const specializedPort = getSpecializedPortName(resourceType);
    if (ownedPorts.includes(specializedPort)) {
        return SPECIALIZED_PORT_RATIO;
    }

    // Check for generic port (3:1)
    if (ownedPorts.includes("GenericPort")) {
        return GENERIC_PORT_RATIO;
    }

    // Default bank trade (4:1)
    return DEFAULT_TRADE_RATIO;
};

/**
 * Get the port type that provides the best ratio for a resource
 * Returns undefined if only bank trade is available
 */
export const getBestPortFor = (resourceType: string, ownedPorts: string[]): string | undefined => {
    const specializedPort = getSpecializedPortName(resourceType);
    if (ownedPorts.includes(specializedPort)) {
        return specializedPort;
    }

    if (ownedPorts.includes("GenericPort")) {
        return "GenericPort";
    }

    return undefined;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE CALCULATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate the cost to receive a certain amount of resources
 * 
 * @param receiveAmount - How many resources the player wants to receive
 * @param tradeRatio - The trade ratio (e.g., 4 means 4:1)
 * @returns The total amount of resources that must be given
 */
export const calculateTradeCost = (receiveAmount: number, tradeRatio: number): number => {
    return receiveAmount * tradeRatio;
};

/**
 * Calculate how many resources can be received for a given amount
 * 
 * @param giveAmount - How many resources the player is willing to give
 * @param tradeRatio - The trade ratio (e.g., 4 means 4:1)
 * @returns The amount of resources that can be received (rounded down)
 */
export const calculateReceiveAmount = (giveAmount: number, tradeRatio: number): number => {
    return math.floor(giveAmount / tradeRatio);
};

/**
 * Check if a player can afford a trade
 * 
 * @param currentAmount - Current amount of the resource being traded away
 * @param neededAmount - Amount needed for the trade
 */
export const canAffordTrade = (currentAmount: number, neededAmount: number): boolean => {
    return currentAmount >= neededAmount;
};

/**
 * Calculate a complete trade with all details
 * 
 * @param request - The trade request parameters
 * @returns Full calculation with validation, ratio, and costs
 */
export const calculateTrade = (request: TradeRequest): TradeCalculation => {
    // Validate the request
    const validationError = validateTradeRequest(
        request.giveResource,
        request.receiveResource,
        request.amount
    );

    if (validationError) {
        return {
            isValid: false,
            errorMessage: validationError,
            tradeRatio: DEFAULT_TRADE_RATIO,
            totalCost: 0,
            receiveAmount: 0,
        };
    }

    // Calculate trade ratio and costs
    const tradeRatio = getBestTradeRatio(request.giveResource, request.ownedPorts);
    const totalCost = calculateTradeCost(request.amount, tradeRatio);

    return {
        isValid: true,
        tradeRatio,
        totalCost,
        receiveAmount: request.amount,
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
// SAVINGS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate how many resources a player saves by using a port vs bank trade
 * 
 * @param amount - Number of resources to receive
 * @param actualRatio - The ratio the player has (2, 3, or 4)
 * @returns Resources saved compared to bank trade (4:1)
 */
export const calculatePortSavings = (amount: number, actualRatio: number): number => {
    const bankCost = calculateTradeCost(amount, DEFAULT_TRADE_RATIO);
    const actualCost = calculateTradeCost(amount, actualRatio);
    return bankCost - actualCost;
};

/**
 * Get a description of the trade ratio source
 */
export const getTradeRatioDescription = (ratio: number): string => {
    if (ratio === SPECIALIZED_PORT_RATIO) {
        return "Specialized Port (2:1)";
    }
    if (ratio === GENERIC_PORT_RATIO) {
        return "Generic Port (3:1)";
    }
    return "Bank Trade (4:1)";
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
    // Constants
    DEFAULT_TRADE_RATIO,
    GENERIC_PORT_RATIO,
    SPECIALIZED_PORT_RATIO,
    RESOURCE_TYPES,

    // Validation
    isValidResource,
    validateTradeRequest,

    // Port functions
    getSpecializedPortName,
    isSpecializedPortFor,
    getBestTradeRatio,
    getBestPortFor,

    // Trade calculations
    calculateTradeCost,
    calculateReceiveAmount,
    canAffordTrade,
    calculateTrade,

    // Utilities
    calculatePortSavings,
    getTradeRatioDescription,
};
