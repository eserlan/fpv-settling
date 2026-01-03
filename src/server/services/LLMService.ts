import { Service } from "@flamework/core";
const HttpService = game.GetService("HttpService");
import * as Logger from "shared/Logger";
import { SECRETS } from "../Secrets";

export interface AIAction {
	action: "BUILD_SETTLEMENT" | "BUILD_ROAD" | "BUILD_CITY" | "END_TURN" | "TRADE" | "WAIT";
	target?: string;
	resource_give?: string;
	resource_receive?: string;
	reason?: string;
}

const DEFAULT_MODEL = "gemini-3-flash-preview";
const GATEWAY_URL = "http://localhost:8765/v1/decide";

@Service({})
export class LLMService {
	private requestQueue: { prompt: string; callback: (response: AIAction | undefined) => void }[] = [];
	private isProcessing = false;

	public async GetDecision(systemPrompt: string, gameStatePrompt: string): Promise<AIAction | undefined> {
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
			const result = this.CallGateway(request.prompt, DEFAULT_MODEL);
			request.callback(result);
			this.isProcessing = false;
			this.ProcessQueue();
		});
	}

	private CallGateway(prompt: string, model: string): AIAction | undefined {
		try {
			const response = HttpService.RequestAsync({
				Url: GATEWAY_URL,
				Method: "POST",
				Headers: { "Content-Type": "application/json" },
				Body: HttpService.JSONEncode({
					prompt: prompt,
					model: model,
					apiKey: SECRETS.GEMINI_API_KEY
				}),
			});

			if (response.Success) {
				const result = HttpService.JSONDecode(response.Body) as AIAction;
				return result;
			} else {
				Logger.Warn("LLMService", `Gateway Error: ${response.StatusCode} - ${response.StatusMessage}`);
				return this.MockDecision();
			}
		} catch (e) {
			Logger.Warn("LLMService", `Gateway Connection Failed: ${e}. Is log_server.py running?`);
			return this.MockDecision();
		}
	}

	private MockDecision(): AIAction {
		// Much more aggressive when gateway isn't available
		const roll = math.random();
		if (roll < 0.7) {
			Logger.Info("LLMService", "Mock: Building settlement");
			return { action: "BUILD_SETTLEMENT", reason: "Mock: Building settlement (gateway offline)" };
		}
		if (roll < 0.9) {
			Logger.Info("LLMService", "Mock: Building road");
			return { action: "BUILD_ROAD", reason: "Mock: Building road (gateway offline)" };
		}
		Logger.Info("LLMService", "Mock: Waiting");
		return { action: "WAIT", reason: "Mock: Waiting briefly" };
	}
}
