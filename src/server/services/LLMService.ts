import { Service } from "@flamework/core";
const HttpService = game.GetService("HttpService");
import * as Logger from "shared/Logger";

export interface AIAction {
	action: "BUILD_SETTLEMENT" | "BUILD_ROAD" | "BUILD_CITY" | "END_TURN" | "TRADE" | "WAIT";
	target?: string; // Vertex_ID or Edge_ID
	resource_give?: string;
	resource_receive?: string;
	reason?: string; // Thought process
}

interface GeminiPart {
	text?: string;
}

interface GeminiContent {
	parts?: GeminiPart[];
}

interface GeminiCandidate {
	content?: GeminiContent;
}

interface GeminiResponse {
	candidates?: GeminiCandidate[];
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
// Note: In a real production environment, the API key should be stored in ScriptService or environment variables.
// For this prototype, we assume it's set in an environment variable or config.
const API_KEY = ""; // User must provide this

@Service({})
export class LLMService {
	private requestQueue: { prompt: string; callback: (response: AIAction | undefined) => void }[] = [];
	private isProcessing = false;

	public async GetDecision(systemPrompt: string, gameStatePrompt: string): Promise<AIAction | undefined> {
		if (API_KEY === "") {
			// Fallback mock behavior if no key is present
			Logger.Warn("LLMService", "No API Key configured. Using Mock fallback.");
			return this.MockDecision(gameStatePrompt);
		}

		return new Promise((resolve) => {
			this.requestQueue.push({
				prompt: `${systemPrompt}\n\nCurrent Game State:\n${gameStatePrompt}`,
				callback: resolve,
			});
			this.ProcessQueue();
		});
	}

	private ProcessQueue() {
		if (this.isProcessing || this.requestQueue.size() === 0) return;

		this.isProcessing = true;
		const request = this.requestQueue.shift();
		if (!request) {
			this.isProcessing = false;
			return;
		}

		task.spawn(() => {
			const result = this.CallGemini(request.prompt);
			request.callback(result);
			this.isProcessing = false;
			this.ProcessQueue();
		});
	}

	private CallGemini(prompt: string): AIAction | undefined {
		const body = {
			contents: [
				{
					parts: [
						{ text: prompt },
					],
				},
			],
			generationConfig: {
				response_mime_type: "application/json",
			},
		};

		try {
			const response = HttpService.RequestAsync({
				Url: `${GEMINI_API_URL}?key=${API_KEY}`,
				Method: "POST",
				Headers: {
					"Content-Type": "application/json",
				},
				Body: HttpService.JSONEncode(body),
			});

			if (response.Success) {
				const data = HttpService.JSONDecode(response.Body) as unknown as GeminiResponse;
				if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
					const textValue = data.candidates[0].content.parts[0].text;
					if (typeIs(textValue, "string")) {
						let text = textValue;

						// Clean up markdown code blocks if present
						text = text.gsub("```json", "")[0]; // Remove start
						text = text.gsub("```", "")[0];     // Remove end
						text = text.gsub("^%s+", "")[0];    // Trim left
						text = text.gsub("%s+$", "")[0];    // Trim right

						// Parse the JSON response
						return HttpService.JSONDecode(text) as AIAction;
					}
				}
			} else {
				Logger.Warn("LLMService", `API Error: ${response.StatusCode} - ${response.StatusMessage}`);
			}
		} catch (e) {
			Logger.Warn("LLMService", `Http Request Failed: ${e}`);
		}

		return undefined;
	}

	private MockDecision(gameState: string): AIAction {
		// Simple heuristic fallback for testing without API key
		// Randomly decide to end turn or try to build something
		const roll = math.random();
		if (roll < 0.1) {
			return { action: "BUILD_SETTLEMENT", reason: "Mock: Random chance" };
		} else if (roll < 0.2) {
			return { action: "BUILD_ROAD", reason: "Mock: Random chance" };
		}
		return { action: "WAIT", reason: "Mock: Waiting for resources" };
	}
}
