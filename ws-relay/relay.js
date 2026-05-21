// arras-ws-relay: WebSocket relay for arras.io bot connections
// Routes through SOCKS5 proxies to bypass Cloudflare IP restrictions.
//
// How it works:
//   1. Bot iframe's WebSocket hook rewrites the game URL:
//      wss://game-server → wss://your-relay.onrender.com/?target=wss://game-server
//   2. Relay picks a SOCKS5 proxy (round-robin) and connects through it
//   3. All messages are piped bidirectionally (binary, transparent)
//   4. Game server sees the proxy's residential IP, not yours or the relay's
//
// Environment variables:
//   PORT            - listen port (default 3000, Render sets this)
//   MAX_CONNECTIONS - max simultaneous relay connections (default 20)
//   PROXY_LIST      - comma-separated SOCKS5 proxies, e.g.:
//                     socks5://1.2.3.4:1080,socks5://5.6.7.8:4145
//                     If empty, connects directly (won't bypass Cloudflare)

const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

let SocksProxyAgent;
try {
    SocksProxyAgent = require("socks-proxy-agent").SocksProxyAgent;
} catch (e) {
    console.warn("socks-proxy-agent not installed — proxy routing disabled");
}

const PORT = process.env.PORT || 3000;
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || "20", 10);

// Parse proxy list from environment
const PROXY_LIST = (process.env.PROXY_LIST || "")
    .split(",")
    .map(p => p.trim())
    .filter(p => p.length > 0);

let nextProxyIndex = 0;
let activeConnections = 0;

function getNextProxy() {
    if (PROXY_LIST.length === 0) return null;
    const proxy = PROXY_LIST[nextProxyIndex % PROXY_LIST.length];
    nextProxyIndex++;
    return proxy;
}

// Valid WebSocket close codes: 1000-1015 or 3000-4999
function isValidCloseCode(code) {
    return (code >= 1000 && code <= 1015) || (code >= 3000 && code <= 4999);
}

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");

    if (req.url === "/" || req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            status: "ok",
            connections: activeConnections,
            maxConnections: MAX_CONNECTIONS,
            proxies: PROXY_LIST.length,
            proxyMode: PROXY_LIST.length > 0 ? "socks5" : "direct"
        }));
        return;
    }
    res.writeHead(404);
    res.end("Not found");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (clientWs, req) => {
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

    // Pick a proxy (round-robin) or connect directly
    const proxy = getNextProxy();
    const wsOptions = {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Origin": "https://arras.io"
        }
    };

    if (proxy && SocksProxyAgent) {
        wsOptions.agent = new SocksProxyAgent(proxy);
        console.log(`[+] Relay → ${target} via ${proxy} (active: ${activeConnections})`);
    } else {
        console.log(`[+] Relay → ${target} DIRECT (active: ${activeConnections})`);
    }

    const gameWs = new WebSocket(target, wsOptions);

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

    // Client → Game
    clientWs.on("message", (data, isBinary) => {
        if (gameOpen) {
            gameWs.send(data, { binary: isBinary });
        } else {
            pendingMessages.push(data);
        }
    });

    // Game → Client
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
            const safeCode = isValidCloseCode(code) ? code : 1000;
            clientWs.close(safeCode, reason ? reason.toString().slice(0, 120) : "");
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
    console.log(`Proxies: ${PROXY_LIST.length > 0 ? PROXY_LIST.length + " SOCKS5" : "NONE (direct mode)"}`);
    if (PROXY_LIST.length > 0) {
        PROXY_LIST.forEach((p, i) => console.log(`  [${i}] ${p}`));
    }
    console.log(`Health: http://localhost:${PORT}/health`);

    // Self-ping to prevent Render free tier from sleeping
    if (process.env.RENDER_EXTERNAL_URL || process.env.RENDER) {
        const selfUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        setInterval(() => {
            const httpMod = require(selfUrl.startsWith("https") ? "https" : "http");
            httpMod.get(`${selfUrl}/health`, () => {}).on("error", () => {});
        }, 4 * 60 * 1000);
        console.log("Self-ping enabled (every 4 min)");
    }
});
