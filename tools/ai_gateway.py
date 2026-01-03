import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load .env file from the project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Import the shared schema if possible (or just define it here for robustness)
RESPONSE_SCHEMA = {
  "type": "OBJECT",
  "properties": {
    "action": {
      "type": "STRING",
      "enum": ["BUILD_SETTLEMENT", "BUILD_ROAD", "BUILD_CITY", "END_TURN", "TRADE", "WAIT"]
    },
    "target": {
      "type": "STRING"
    },
    "resource_give": {
      "type": "STRING"
    },
    "resource_receive": {
      "type": "STRING"
    },
    "reason": {
      "type": "STRING"
    }
  },
  "required": ["action", "reason"]
}

class Colors:
    DEBUG = '\033[90m'
    INFO = '\033[92m'
    WARN = '\033[93m'
    ERROR = '\033[91m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def get_ai_decision(prompt, model_id, api_key=None):
    """
    Calls the Gemini 3 Flash API using the Google GenAI SDK.
    """
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")
        print(f"{Colors.DEBUG}[AI-Gateway] No API Key in request, using key from .env: {'Found' if api_key else 'NOT FOUND'}{Colors.RESET}")
    else:
        print(f"{Colors.DEBUG}[AI-Gateway] Using API Key provided in request (length: {len(api_key)}){Colors.RESET}")

    if not api_key:
        print(f"{Colors.ERROR}[AI-Gateway] ERROR: No Gemini API Key configured!{Colors.RESET}")
        raise ValueError("No Gemini API Key configured. Please add GEMINI_API_KEY to your .env file or Roblox Secrets.")

    try:
        print(f"{Colors.INFO}[AI-Gateway] Initializing Gemini Client...{Colors.RESET}")
        client = genai.Client(api_key=api_key)
        
        print(f"{Colors.INFO}[AI-Gateway] Sending request to {model_id}...{Colors.RESET}")
        
        # We explicitly request JSON and provide the schema for Gemini 3
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RESPONSE_SCHEMA,
                thinking_config=types.ThinkingConfig(include_thoughts=True)
            )
        )

        if not response or not response.text:
            print(f"{Colors.WARN}[AI-Gateway] Received empty response from Gemini.{Colors.RESET}")
            return None

        # Sometimes Gemini wraps JSON in markdown for some reason even with response_mime_type
        clean_text = response.text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:-3].strip()
        elif clean_text.startswith("```"):
            clean_text = clean_text[3:-3].strip()

        print(f"{Colors.INFO}[AI-Gateway] Success! Decision received.{Colors.RESET}")
        return clean_text

    except Exception as e:
        print(f"{Colors.ERROR}[AI-Gateway] SDK Exception: {e}{Colors.RESET}")
        raise e
