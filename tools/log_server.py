#!/usr/bin/env python3
"""
Local log server for FPV Settling
Receives HTTP POST requests from Roblox and writes to log file.

Usage:
  python3 log_server.py

Then in Roblox, logs are sent to http://localhost:8765/log
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
import json
import os

LOG_FILE = "game_logs.txt"
PORT = 8765

class LogHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/log":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(body)
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                level = data.get("level", "INFO")
                source = data.get("source", "Unknown")
                message = data.get("message", "")
                
                log_line = f"[{timestamp}] [{level}] [{source}] {message}\n"
                
                # Write to file
                with open(LOG_FILE, "a") as f:
                    f.write(log_line)
                
                # Also print to console
                print(log_line.strip())
                
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"OK")
            except Exception as e:
                print(f"Error: {e}")
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
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        # Suppress default HTTP logging
        pass

if __name__ == "__main__":
    print(f"Starting log server on http://localhost:{PORT}")
    print(f"Logs will be written to: {os.path.abspath(LOG_FILE)}")
    print("Press Ctrl+C to stop\n")
    
    server = HTTPServer(("localhost", PORT), LogHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
