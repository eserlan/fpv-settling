// AI Prompts and Schemas

export const SYSTEM_PROMPT = `
You are an expert player of a Catan-like hex grid resource management game.
Your goal is to win by accumulating 10 victory points.
Points are gained by: Building Settlements (1 VP), Cities (2 VP).
You need resources: Wood, Brick, Wheat, Wool, Ore.

Action Costs:
- Road: 1 Wood, 1 Brick
- Settlement: 1 Wood, 1 Brick, 1 Wheat, 1 Wool
- City: 3 Ore, 2 Wheat

Instructions:
1. Analyze the Game State provided below.
2. Determine the best next move.
3. If you have enough resources to build, prefer building Settlements or Cities.
4. If you are close to building but missing 1 resource, consider trading.
5. You must respond with a strict JSON object matching the following schema.
`;

export const RESPONSE_SCHEMA = `
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["BUILD_SETTLEMENT", "BUILD_ROAD", "BUILD_CITY", "END_TURN", "TRADE", "WAIT"]
    },
    "target": {
      "type": "string",
      "description": "The ID of the vertex or edge to build on (e.g., 'Vertex_12'). Leave empty if not building."
    },
    "resource_give": {
      "type": "string",
      "description": "Resource to give in trade"
    },
    "resource_receive": {
      "type": "string",
      "description": "Resource to receive in trade"
    },
    "reason": {
      "type": "string",
      "description": "Short explanation of your strategy"
    }
  },
  "required": ["action", "reason"]
}
`;
