#!/usr/bin/env python3
"""
Local log server for FPV Settling
Receives HTTP POST requests from Roblox Server and writes to log file.

Architecture:
  Client (Roblox) → RemoteEvent → Server (Roblox) → HTTP POST → This Server

Usage:
  python3 log_server.py

Then in Roblox Studio:
  1. Enable HTTP Requests: Home → Game Settings → Security → Allow HTTP Requests
  2. Start the game - logs will appear here and in game_logs.txt
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
import json
import os
import sys

LOG_FILE = "game_logs.txt"
PORT = 8765

# ANSI colors for terminal output
class Colors:
    DEBUG = '\033[90m'  # Gray
    INFO = '\033[92m'   # Green
    WARN = '\033[93m'   # Yellow
    ERROR = '\033[91m'  # Red
    RESET = '\033[0m'
    BOLD = '\033[1m'

def get_color(level):
    return getattr(Colors, level.upper(), Colors.RESET)

class LogHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/log":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(body)
                timestamp = datetime.now().strftime("%H:%M:%S")
                level = data.get("level", "INFO")
                source = data.get("source", "Unknown")
                message = data.get("message", "")
                player = data.get("player", "")
                is_server = data.get("isServer", False)
                
                # Format player/source info
                origin = "SERVER" if is_server else player
                
                # Console output with colors
                color = get_color(level)
                console_line = f"{Colors.BOLD}[{timestamp}]{Colors.RESET} " \
                               f"{color}[{level:5}]{Colors.RESET} " \
                               f"[{origin}] [{source}] {message}"
                print(console_line)
                
                # File output (no colors)
                file_line = f"[{timestamp}] [{level:5}] [{origin}] [{source}] {message}\n"
                with open(LOG_FILE, "a") as f:
                    f.write(file_line)
                
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"OK")
            except Exception as e:
                print(f"{Colors.ERROR}Error processing log: {e}{Colors.RESET}")
                self.send_response(400)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Log server running")
        elif self.path == "/":
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"""
            <html>
            <head><title>FPV Settling Log Server</title></head>
            <body style="font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px;">
                <h1>FPV Settling Log Server</h1>
                <p>Status: <span style="color: #4ec9b0;">Running</span></p>
                <p>Logs are being written to: game_logs.txt</p>
                <p>View this terminal for real-time colored logs.</p>
            </body>
            </html>
            """)
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        # Suppress default HTTP logging
        pass

if __name__ == "__main__":
    print(f"{Colors.BOLD}{'='*50}{Colors.RESET}")
    print(f"{Colors.BOLD}FPV Settling - Log Server{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*50}{Colors.RESET}")
    print(f"Listening on: {Colors.INFO}http://localhost:{PORT}{Colors.RESET}")
    print(f"Log file: {Colors.INFO}{os.path.abspath(LOG_FILE)}{Colors.RESET}")
    print(f"Health check: {Colors.INFO}http://localhost:{PORT}/health{Colors.RESET}")
    print(f"\n{Colors.WARN}Make sure to enable HTTP Requests in Roblox Studio:{Colors.RESET}")
    print(f"  Home → Game Settings → Security → Allow HTTP Requests")
    print(f"\n{Colors.BOLD}Waiting for logs...{Colors.RESET}\n")
    
    try:
        server = HTTPServer(("0.0.0.0", PORT), LogHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n{Colors.WARN}Server stopped{Colors.RESET}")
        sys.exit(0)
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"{Colors.ERROR}Error: Port {PORT} is already in use!{Colors.RESET}")
            print(f"Kill the existing process or use a different port.")
        else:
            print(f"{Colors.ERROR}Error: {e}{Colors.RESET}")
        sys.exit(1)
