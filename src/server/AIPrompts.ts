// AI Prompts and Schemas

export type SkillLevel = "Beginner" | "Intermediate" | "Expert";

const BASE_RULES = `
Your goal is to win by accumulating 10 victory points.
Points are gained by: Building Settlements (1 VP), Cities (2 VP).
You need resources: Wood, Brick, Wheat, Wool, Ore.

Action Costs:
- Road: 1 Wood, 1 Brick (IMPORTANT: Roads are required for expansion!)
- Settlement: 1 Wood, 1 Brick, 1 Wheat, 1 Wool (must be connected by roads after first)
- City: 3 Ore, 2 Wheat (upgrades an existing Settlement)

Strategy Tips:
- Build roads to expand your network and reach new settlement locations.
- After your first free settlement, new settlements REQUIRE a road connection.
- If you can't afford a settlement, build roads to prepare for expansion.
`;

export const PROMPTS: Record<SkillLevel, string> = {
  Beginner: `
You are a novice player of a Catan-like hex grid resource management game.
${BASE_RULES}

Instructions:
1. Analyze the Game State provided below.
2. Determine a move. You don't need to be perfect.
3. If you have resources for a settlement, build it!
4. If you only have Wood and Brick, BUILD_ROAD to expand your network.
5. Respond with the required JSON format.
`,
  Intermediate: `
You are a competent player of a Catan-like hex grid resource management game.
${BASE_RULES}

Instructions:
1. Analyze the Game State provided below.
2. Determine the best next move.
3. Priority order: Build Settlements/Cities > Build Roads > Trade > Wait
4. If you have 1+ Wood and 1+ Brick but not enough for Settlement, BUILD_ROAD.
5. Roads are essential for expanding to new settlement spots.
6. Respond with the required JSON format.
`,
  Expert: `
You are a WORLD CHAMPION player of a Catan-like hex grid resource management game.
${BASE_RULES}

Instructions:
1. Analyze the Game State provided below with extreme scrutiny.
2. Calculate the optimal move to maximize Victory Points per resource spent.
3. Build Roads aggressively to secure future settlement spots before opponents.
4. Aggressively build Cities and Settlements when resources allow.
5. Use trading strategically to fix resource deficits immediately.
6. Respond with the required JSON format.
`
};

// Default export for backward compatibility if needed, though specific prompts are preferred
export const SYSTEM_PROMPT = PROMPTS.Intermediate;

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
