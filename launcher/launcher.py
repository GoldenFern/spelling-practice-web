"""One-click launcher for the spelling practice web app.

Serves ``webapp/build`` on a fixed local port, opens it in an Edge app window
(no address bar), and exits after a period without requests so no hidden
process lingers forever.

The fixed port matters: IndexedDB data is bound to the origin
``http://127.0.0.1:<port>``, so the port must not change between runs.

Usage:
    pythonw launcher.py [--port 8756] [--idle-minutes 90]
"""

from __future__ import annotations

import argparse
import ctypes
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_NAME = "拼写练习"
HEALTH_PATH = "/__launcher__/health"
HEALTH_MARKER = "spelling-practice"
DEFAULT_PORT = 8756
DEFAULT_IDLE_MINUTES = 90

# 由请求线程更新，看门狗线程读取
_last_activity = time.monotonic()
_activity_lock = threading.Lock()


def _touch_activity() -> None:
    global _last_activity
    with _activity_lock:
        _last_activity = time.monotonic()


def _idle_seconds() -> float:
    with _activity_lock:
        return time.monotonic() - _last_activity


def show_error(message: str) -> None:
    """Show a blocking error dialog (Windows) or print to stderr."""
    if sys.platform == "win32":
        ctypes.windll.user32.MessageBoxW(0, message, APP_NAME, 0x10)
    else:
        print(message, file=sys.stderr)


class LauncherHandler(SimpleHTTPRequestHandler):
    """Static file handler with SPA fallback and a health endpoint."""

    server_version = "SpellingPracticeLauncher/1.0"

    def do_GET(self) -> None:  # noqa: N802 (http.server naming)
        _touch_activity()
        path = self.path.split("?", 1)[0]

        if path == HEALTH_PATH:
            body = json.dumps({"app": HEALTH_MARKER, "pid": os.getpid()}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # SPA fallback: BrowserRouter paths such as /gallery must return index.html
        target = Path(self.directory) / path.lstrip("/")
        if not target.is_file() and not (target.is_dir() and (target / "index.html").is_file()):
            self.path = "/index.html"

        super().do_GET()

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        # 无控制台窗口，静默即可
        _touch_activity()


def existing_instance_alive(port: int, timeout: float = 1.5) -> bool:
    """Return True if our launcher is already serving on the port."""
    url = f"http://127.0.0.1:{port}{HEALTH_PATH}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return payload.get("app") == HEALTH_MARKER
    except Exception:
        return False


def port_in_use(port: int, timeout: float = 1.0) -> bool:
    """Return True if anything is listening on the local port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def find_edge() -> str | None:
    candidates = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    return None


def open_app_window(url: str) -> None:
    """Open the app in an Edge app window, falling back to the default browser."""
    edge = find_edge()
    if edge:
        subprocess.Popen(
            [edge, f"--app={url}", "--window-size=1280,900", "--no-first-run", "--no-default-browser-check"],
            close_fds=True,
        )
    else:
        webbrowser.open(url)


def idle_watchdog(server: ThreadingHTTPServer, idle_minutes: float) -> None:
    """Shut the server down after a long period without requests."""
    while True:
        time.sleep(60)
        if _idle_seconds() > idle_minutes * 60:
            server.shutdown()
            return


def main() -> int:
    parser = argparse.ArgumentParser(description="One-click launcher for the spelling practice web app.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--idle-minutes", type=float, default=DEFAULT_IDLE_MINUTES)
    parser.add_argument("--no-window", action="store_true", help="仅启动本地服务，不打开浏览器窗口（测试用）")
    args = parser.parse_args()

    webapp_dir = Path(__file__).resolve().parents[1]
    build_dir = webapp_dir / "build"
    if not (build_dir / "index.html").is_file():
        show_error(f"未找到构建产物：{build_dir}\n请先运行 scripts/webapp_build.ps1 构建前端。")
        return 1

    url = f"http://127.0.0.1:{args.port}/"

    if existing_instance_alive(args.port):
        if not args.no_window:
            open_app_window(url)
        return 0

    if port_in_use(args.port):
        show_error(f"端口 {args.port} 已被其他程序占用，无法启动 {APP_NAME}。")
        return 1

    handler = lambda *handler_args, **handler_kwargs: LauncherHandler(  # noqa: E731
        *handler_args, directory=str(build_dir), **handler_kwargs
    )
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    server.daemon_threads = True

    watchdog = threading.Thread(target=idle_watchdog, args=(server, args.idle_minutes), daemon=True)
    watchdog.start()

    if not args.no_window:
        open_app_window(url)
    try:
        server.serve_forever(poll_interval=1.0)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
