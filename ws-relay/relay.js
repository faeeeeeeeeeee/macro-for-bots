// arras-ws-relay: WebSocket relay for arras.io bot connections
// Deploy to Render/Railway/Fly.io to give bots a different IP.
//
// How it works:
//   1. Bot iframe's WebSocket hook rewrites the game URL:
//      wss://game-server.arras.io/path → wss://your-relay.onrender.com/relay?target=wss://game-server.arras.io/path
//   2. Relay opens a WebSocket to the real game server
//   3. All messages are piped bidirectionally (binary, transparent)
//   4. Game server sees the relay's IP, not yours
//
// Deploy to Render:
//   1. Push this repo to GitHub
//   2. Go to https://render.com → New → Web Service
//   3. Connect your repo, set Root Directory to "ws-relay"
//   4. Build Command: npm install
//   5. Start Command: node relay.js
//   6. Plan: Free
//   7. Done! Your relay URL will be: wss://your-service-name.onrender.com

const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 3000;
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || "20", 10);

let activeConnections = 0;

const server = http.createServer((req, res) => {
    // CORS headers for health check
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");

    if (req.url === "/" || req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            status: "ok",
            connections: activeConnections,
            maxConnections: MAX_CONNECTIONS
        }));
        return;
    }
    res.writeHead(404);
    res.end("Not found");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (clientWs, req) => {
    // Extract target game server URL from query parameter
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const target = urlObj.searchParams.get("target");

    if (!target) {
        clientWs.close(4000, "Missing ?target= parameter");
        return;
    }

    // Only allow arras.io game server connections
    try {
        const targetUrl = new URL(target);
        const host = targetUrl.hostname.toLowerCase();
        if (!host.includes("arras") && !host.includes("uvwx")) {
            clientWs.close(4001, "Only arras.io targets allowed");
            return;
        }
    } catch (e) {
        clientWs.close(4002, "Invalid target URL");
        return;
    }

    if (activeConnections >= MAX_CONNECTIONS) {
        clientWs.close(4003, "Too many connections");
        return;
    }

    activeConnections++;
    console.log(`[+] Relay → ${target} (active: ${activeConnections})`);

    // Connect to the real game server with browser-like headers
    const gameWs = new WebSocket(target, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Origin": "https://arras.io"
        }
    });

    let clientOpen = true;
    let gameOpen = false;
    const pendingMessages = [];

    gameWs.binaryType = "arraybuffer";

    gameWs.on("open", () => {
        gameOpen = true;
        for (const msg of pendingMessages) {
            gameWs.send(msg);
        }
        pendingMessages.length = 0;
    });

    // Client → Game (forward everything, binary-safe)
    clientWs.on("message", (data, isBinary) => {
        if (gameOpen) {
            gameWs.send(data, { binary: isBinary });
        } else {
            pendingMessages.push(data);
        }
    });

    // Game → Client (forward everything, binary-safe)
    gameWs.on("message", (data, isBinary) => {
        if (clientOpen && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: isBinary });
        }
    });

    clientWs.on("close", () => {
        clientOpen = false;
        activeConnections = Math.max(0, activeConnections - 1);
        console.log(`[-] Client disconnected (active: ${activeConnections})`);
        if (gameWs.readyState === WebSocket.OPEN || gameWs.readyState === WebSocket.CONNECTING) {
            gameWs.close();
        }
    });

    gameWs.on("close", (code, reason) => {
        gameOpen = false;
        if (clientOpen && clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(code || 1000, reason ? reason.toString().slice(0, 120) : "");
        }
    });

    clientWs.on("error", (err) => {
        console.error("[!] Client error:", err.message);
        clientOpen = false;
        activeConnections = Math.max(0, activeConnections - 1);
        if (gameWs.readyState === WebSocket.OPEN) gameWs.close();
    });

    gameWs.on("error", (err) => {
        console.error("[!] Game error:", err.message);
        gameOpen = false;
        if (clientOpen && clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(4004, "Game server error");
        }
    });
});

server.listen(PORT, () => {
    console.log(`arras-ws-relay listening on port ${PORT}`);
    console.log(`Max connections: ${MAX_CONNECTIONS}`);
    console.log(`Health: http://localhost:${PORT}/health`);

    // Self-ping to prevent Render free tier from sleeping (pings every 4 minutes)
    if (process.env.RENDER_EXTERNAL_URL || process.env.RENDER) {
        const selfUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        setInterval(() => {
            const http = require(selfUrl.startsWith("https") ? "https" : "http");
            http.get(`${selfUrl}/health`, () => {}).on("error", () => {});
        }, 4 * 60 * 1000);
        console.log("Self-ping enabled (every 4 min to prevent sleep)");
    }
});
