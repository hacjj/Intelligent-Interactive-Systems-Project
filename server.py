#!/usr/bin/env python3
"""
DriveHUD Full-Stack Python Backend Server
Author: Utkarsh Dev (3149895)
Module: Intelligent Interactive Systems — University of Birmingham

Serves the DriveHUD OEM Cockpit & Projected AR-Windshield HUD alongside
stateful JSON REST API endpoints powered by `drivehud_engine.py`:
  - GET  /api/state       : Vehicle subsystems, Bayesian expected-loss matrix, and FSM trace
  - GET  /api/benchmark   : Run N=120 empirical Monte Carlo policy comparison benchmark
  - POST /api/benchmark   : Run custom-seed / custom-N policy comparison benchmark
  - POST /api/command     : Process driver voice command through decision-theoretic router
  - POST /api/repair      : Process wake-word-free open-mic repair / passenger noise guard
  - POST /api/timeout     : Commit pending Prosodic-Gate slot after 4.0s non-objection window
  - POST /api/environment : Update vehicle speed, cabin noise dB, weather, or Baseline OEM mode
  - POST /api/reset       : Reset cockpit telemetry and state machine
"""

from __future__ import annotations

import json
import os
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict

from drivehud_engine import DriveHUDEngine, run_policy_benchmark

ENGINE = DriveHUDEngine()
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))


class DriveHUDRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=WORKSPACE_DIR, **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()

    def _send_json(self, payload: Dict[str, Any], status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw) if raw else {}

    def do_GET(self) -> None:
        if self.path.startswith("/api/state"):
            self._send_json(ENGINE.get_snapshot())
            return
        if self.path.startswith("/api/benchmark"):
            self._send_json(run_policy_benchmark(seed=42, n_trials=120))
            return
        if self.path == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self) -> None:
        try:
            data = self._read_json()
        except Exception as exc:
            self._send_json({"error": f"Invalid JSON: {exc}"}, status=HTTPStatus.BAD_REQUEST)
            return

        if self.path == "/api/command":
            intended = str(data.get("intended_utterance", "Navigate to fourteen Oak Road"))
            asr_text = str(data.get("asr_transcript", intended))
            raw_conf = float(data.get("raw_confidence", 0.65))
            explicit_alt = data.get("explicit_alt")
            result = ENGINE.receive_command(
                intended_utterance=intended,
                asr_transcript=asr_text,
                raw_confidence=raw_conf,
                explicit_alt=str(explicit_alt) if explicit_alt else None,
            )
            self._send_json(result)
            return

        if self.path == "/api/repair":
            utterance = str(data.get("utterance", ""))
            result = ENGINE.receive_open_mic_repair(utterance)
            self._send_json(result)
            return

        if self.path == "/api/timeout":
            result = ENGINE.expire_repair_window()
            self._send_json(result)
            return

        if self.path == "/api/environment":
            result = ENGINE.update_environment(
                speed_mph=data.get("speed_mph"),
                cabin_noise_db=data.get("cabin_noise_db"),
                weather=data.get("weather"),
                baseline_oem_mode=data.get("baseline_oem_mode"),
            )
            self._send_json(result)
            return

        if self.path == "/api/benchmark":
            seed = int(data.get("seed", 42))
            n_trials = max(30, min(1000, int(data.get("n_trials", 120))))
            self._send_json(run_policy_benchmark(seed=seed, n_trials=n_trials))
            return

        if self.path == "/api/reset":
            result = ENGINE.reset()
            self._send_json(result)
            return

        self._send_json({"error": f"Unknown endpoint: {self.path}"}, status=HTTPStatus.NOT_FOUND)

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stdout.write(f"[DriveHUD Server] {self.address_string()} - {fmt % args}\n")
        sys.stdout.flush()


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), DriveHUDRequestHandler)
    print(f"DriveHUD MSc Full-Stack Server running at http://localhost:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down DriveHUD server.")
        server.server_close()


if __name__ == "__main__":
    main()
