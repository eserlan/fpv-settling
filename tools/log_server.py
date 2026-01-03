#!/usr/bin/env python3
"""
Local log server and AI Gateway for FPV Settling
Receives HTTP POST requests from Roblox Server.

Endpoints:
  POST /log     - Writes to game.log and terminal
  POST /v1/decide - Forwards to Gemini 3 via Google GenAI SDK
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
import json
import os
import sys

# Import our new AI Gateway
try:
    import ai_gateway
    HAS_GATEWAY = True
except ImportError:
    HAS_GATEWAY = False
    print("WARNING: ai_gateway.py not found. AI features will be disabled.")

LOG_FILE = "game.log"
PORT = 8765

class Colors:
    DEBUG = '\033[90m'
    INFO = '\033[92m'
    WARN = '\033[93m'
    ERROR = '\033[91m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def get_color(level):
    return getattr(Colors, level.upper(), Colors.RESET)

class RequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        if self.path == "/log":
            self.handle_log(body)
        elif self.path == "/v1/decide":
            self.handle_ai_decision(body)
        else:
            self.send_response(404)
            self.end_headers()

    def handle_log(self, body):
        try:
            data = json.loads(body)
            timestamp = datetime.now().strftime("%H:%M:%S")
            level = data.get("level", "INFO")
            source = data.get("source", "Unknown")
            message = data.get("message", "")
            player = data.get("player", "")
            is_server = data.get("isServer", False)
            
            origin = "SERVER" if is_server else player
            
            color = get_color(level)
            console_line = f"{Colors.BOLD}[{timestamp}]{Colors.RESET} {color}[{level:5}]{Colors.RESET} [{origin}] [{source}] {message}"
            print(console_line)
            
            file_line = f"[{timestamp}] [{level:5}] [{origin}] [{source}] {message}\n"
            with open(LOG_FILE, "a") as f:
                f.write(file_line)
            
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
        except Exception as e:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"{Colors.BOLD}[{timestamp}]{Colors.RESET} {Colors.ERROR}Error processing log: {e}{Colors.RESET}")
            self.send_response(400)
            self.end_headers()

    def handle_ai_decision(self, body):
        if not HAS_GATEWAY:
            self.send_error_response(500, "AI Gateway module missing")
            return

        try:
            data = json.loads(body)
            prompt = data.get("prompt", "")
            model = data.get("model", "gemini-3-flash-preview")
            api_key = data.get("apiKey")

            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"{Colors.BOLD}[{timestamp}]{Colors.RESET} {Colors.INFO}[Server]{Colors.RESET} AI Decision Request for {model}")
            
            result_text = ai_gateway.get_ai_decision(prompt, model, api_key)
            
            if result_text:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(result_text.encode('utf-8'))
            else:
                self.send_error_response(500, "Empty response from AI")

        except ValueError as ve:
            self.send_error_response(401, str(ve))
        except Exception as e:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"{Colors.BOLD}[{timestamp}]{Colors.RESET} {Colors.ERROR}AI Decision Handler Error: {e}{Colors.RESET}")
            self.send_error_response(500, str(e))

    def send_error_response(self, code, message):
        self.send_response(code)
        self.end_headers()
        self.wfile.write(message.encode('utf-8'))

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Server running")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    print(f"{Colors.BOLD}{'='*50}{Colors.RESET}")
    print(f"{Colors.BOLD}FPV Settling - Log Server & AI Gateway{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*50}{Colors.RESET}")
    print(f"Listening on: {Colors.INFO}http://0.0.0.0:{PORT}{Colors.RESET}")
    print(f"Log file: {Colors.INFO}{os.path.abspath(LOG_FILE)}{Colors.RESET}")
    
    try:
        server = HTTPServer(("0.0.0.0", PORT), RequestHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n{Colors.WARN}Server stopped{Colors.RESET}")
        sys.exit(0)
