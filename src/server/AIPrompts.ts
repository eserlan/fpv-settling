import { SkillLevel } from "shared/GameTypes";

const BASE_RULES = `
Your goal is to win by accumulating 10 victory points.
Points are gained by: Building Settlements (1 VP), Cities (2 VP).
You need resources: Wood, Brick, Wheat, Wool, Ore.

Action Costs:
- Road: 1 Wood, 1 Brick (IMPORTANT: Roads are required for expansion!)
- Settlement: 1 Wood, 1 Brick, 1 Wheat, 1 Wool (must be connected by roads after first)
- City: 3 Ore, 2 Wheat (upgrades an existing Settlement)

Note on Resources:
- 'Resources in Backpack' are what you have right now.
- 'Resources Grounded' are items on the ground near your settlements that your worker is currently moving to pick up. Factor these into your planning!

Strategy Tips:
- Build roads to expand your network and reach new settlement locations.
- After your first settlement, new settlements REQUIRE a road connection.
- Use 'Scores' provided in the game state to find the best spots. Higher scores means more resources.
- A score of 8-12 is excellent, 4-7 is okay, <4 is poor.
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
3. Priority order: Collect Resources > Build Settlements/Cities > Build Roads > Trade > Wait
4. Use 'COLLECT_RESOURCE' if you see grounded resources that you need for your next build.
5. If you have 1+ Wood and 1+ Brick but not enough for Settlement, BUILD_ROAD.
6. Roads are essential for expanding to new settlement spots.
7. Respond with the required JSON format.
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
      "enum": ["BUILD_SETTLEMENT", "BUILD_ROAD", "BUILD_CITY", "END_TURN", "TRADE", "WAIT", "COLLECT_RESOURCE"]
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
