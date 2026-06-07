(async () => {
    const { Worker } = await import("worker_threads");
    const { WebSocketServer } = await import("ws");
    const { pack, unpack } = await import("msgpackr");
    const http = await import("http");
    const path = await import("path");
    const fs = await import("fs");

    // === AUTO-LOGGING: all output goes to a timestamped log file ===
    const logDir = path.resolve("logs");
    try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
    const logName = `bot_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    const logPath = path.join(logDir, logName);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const origLog = console.log;
    const origErr = console.error;
    function ts() { return new Date().toISOString(); }
    console.log = (...args) => {
        const line = `[${ts()}] ${args.join(' ')}`;
        origLog.apply(console, args);
        logStream.write(line + '\n');
    };
    console.error = (...args) => {
        const line = `[${ts()}] ERROR: ${args.join(' ')}`;
        origErr.apply(console, args);
        logStream.write(line + '\n');
    };
    console.log(`Logging to: ${logPath}`);

    // Cache game assets once — shared across all worker threads

    let cachedWasm = null;
    let cachedScript = null;
    async function cacheGameAssets() {
        try {
            const fetch = (await import('node-fetch')).default;
            console.log('Caching arras.io game assets...');
            const [wasmResp, htmlResp] = await Promise.all([
                fetch('https://arras.io/app.wasm'),
                fetch('https://arras.io')
            ]);
            cachedWasm = Buffer.from(await wasmResp.arrayBuffer()).toString('base64');
            const html = await htmlResp.text();
            const scriptStart = html.indexOf('<script>');
            if (scriptStart !== -1) {
                let s = html.slice(scriptStart + 8);
                const scriptEnd = s.indexOf('</script');
                if (scriptEnd !== -1) cachedScript = s.slice(0, scriptEnd);
            }
            console.log(`Cached: wasm=${cachedWasm ? (cachedWasm.length / 1024).toFixed(0) + 'KB' : 'FAIL'}, script=${cachedScript ? (cachedScript.length / 1024).toFixed(0) + 'KB' : 'FAIL'}`);
        } catch (e) {
            console.log('Warning: Could not cache game assets, workers will fetch individually:', e.message);
        }
    }
    await cacheGameAssets();

    const PROXY = "http://budget-v6.whiteproxies.com:27020";
    const prod = false;

    let GEMINI_API_KEY = "";
    let CHATBOT_PERSONALITY = "You are a chill arras.io tank player. Keep responses under 60 characters. Be casual and natural, like a real player. No excessive slang. Never use profanity.";

    // =========================================================================
    // PROXY SCRAPER — auto-fetch and test free proxies
    // =========================================================================
    const fetch = (await import('node-fetch')).default;
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    const { SocksProxyAgent } = await import('socks-proxy-agent');

    let scrapedProxies = []; // { url, type, speed }
    let proxyIdx = 0;
    let scrapingInProgress = false;

    async function scrapeProxies() {
        if (scrapingInProgress) return;
        scrapingInProgress = true;
        console.log('\n[Proxy Scraper] Fetching proxy lists...');
        const candidates = [];

        // Source 1: ProxyScrape HTTPS
        try {
            const r = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=3000&country=all&ssl=yes&anonymity=all');
            const text = await r.text();
            text.trim().split('\n').map(l => l.trim()).filter(l => l.includes(':')).forEach(l => candidates.push({ addr: l, type: 'http' }));
        } catch(e) {}

        // Source 2: Geonode HTTPS
        try {
            const r = await fetch('https://proxylist.geonode.com/api/proxy-list?limit=100&page=1&sort_by=lastChecked&sort_type=desc&protocols=https');
            const json = await r.json();
            if (json.data) json.data.forEach(p => candidates.push({ addr: p.ip + ':' + p.port, type: 'http' }));
        } catch(e) {}

        // Source 3: SOCKS4
        try {
            const r = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=3000&country=all');
            const text = await r.text();
            text.trim().split('\n').map(l => l.trim()).filter(l => l.includes(':')).forEach(l => candidates.push({ addr: l, type: 'socks4' }));
        } catch(e) {}

        // Source 4: SOCKS5
        try {
            const r = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=3000&country=all');
            const text = await r.text();
            text.trim().split('\n').map(l => l.trim()).filter(l => l.includes(':')).forEach(l => candidates.push({ addr: l, type: 'socks5' }));
        } catch(e) {}

        console.log(`[Proxy Scraper] Got ${candidates.length} candidates. Testing...`);

        // Shuffle and test in batches of 50
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        const alreadyHave = new Set(scrapedProxies.map(p => p.url));
        const toTest = candidates.filter(c => {
            const url = (c.type === 'http' ? 'http://' : c.type + '://') + c.addr;
            return !alreadyHave.has(url);
        });

        // Test in batches of 60, stop after finding 40+ working
        let found = 0;
        for (let batch = 0; batch < toTest.length && found < 40; batch += 60) {
            const chunk = toTest.slice(batch, batch + 60);
            const results = await Promise.allSettled(chunk.map(async ({ addr, type }) => {
                const url = (type === 'http' ? 'http://' : type + '://') + addr;
                const agent = type === 'http' ? new HttpsProxyAgent(url) : new SocksProxyAgent(url);
                const start = Date.now();
                const ac = new AbortController();
                const t = setTimeout(() => ac.abort(), 6000);
                try {
                    const resp = await fetch('https://arras.io', { agent, signal: ac.signal });
                    clearTimeout(t);
                    if (resp.status === 200) {
                        const elapsed = Date.now() - start;
                        return { url, type, speed: elapsed };
                    }
                    throw new Error('status ' + resp.status);
                } catch(e) {
                    clearTimeout(t);
                    throw e;
                }
            }));

            for (const r of results) {
                if (r.status === 'fulfilled' && !alreadyHave.has(r.value.url)) {
                    scrapedProxies.push(r.value);
                    alreadyHave.add(r.value.url);
                    found++;
                }
            }
            console.log(`[Proxy Scraper] Batch done. Found ${found} working so far (${scrapedProxies.length} total).`);
        }

        // Sort by speed (fastest first)
        scrapedProxies.sort((a, b) => a.speed - b.speed);
        console.log(`[Proxy Scraper] Done. ${scrapedProxies.length} working proxies available.`);
        if (scrapedProxies.length > 0) {
            console.log(`[Proxy Scraper] Fastest: ${scrapedProxies[0].url} (${scrapedProxies[0].speed}ms)`);
            console.log(`[Proxy Scraper] Slowest: ${scrapedProxies[scrapedProxies.length - 1].url} (${scrapedProxies[scrapedProxies.length - 1].speed}ms)`);
        }
        scrapingInProgress = false;
    }

    // Track proxy failures — blacklist scraped proxies after 3 failed connections
    const proxyFailures = new Map(); // url -> failure count
    const blacklistedProxies = new Set();

    function recordProxyFailure(proxyUrl) {
        if (!proxyUrl || proxyUrl === PROXY) return; // never blacklist whiteproxies
        const count = (proxyFailures.get(proxyUrl) || 0) + 1;
        proxyFailures.set(proxyUrl, count);
        if (count >= 2) {
            blacklistedProxies.add(proxyUrl);
            scrapedProxies = scrapedProxies.filter(p => p.url !== proxyUrl);
            console.log(`[Proxy] Blacklisted ${proxyUrl} after ${count} failures (${scrapedProxies.length} scraped remain)`);
        }
    }

    function recordProxySuccess(proxyUrl) {
        if (!proxyUrl || proxyUrl === PROXY) return;
        proxyFailures.delete(proxyUrl); // reset on success
    }

    function getNextProxy() {
        // Primary: whiteproxies (rotating, unlimited)
        // Overflow: cycle through scraped proxies
        if (scrapedProxies.length === 0) {
            return { type: 'http', url: PROXY };
        }
        // Alternate: 2/3 through whiteproxies, 1/3 through scraped
        proxyIdx++;
        if (proxyIdx % 3 !== 0) {
            return { type: 'http', url: PROXY };
        }
        const scraped = scrapedProxies[(proxyIdx / 3 - 1) % scrapedProxies.length];
        return { type: scraped.type, url: scraped.url };
    }

    // Scrape proxies on startup (non-blocking)
    scrapeProxies();
    // Re-scrape every 10 minutes (free proxies die fast)
    setInterval(() => {
        scrapedProxies = [];
        proxyIdx = 0;
        proxyFailures.clear();
        blacklistedProxies.clear();
        scrapeProxies();
    }, 10 * 60 * 1000);

    // HTTP SERVER
    const server = http.createServer((req, res) => {
        res.writeHead(426, {"Content-Type": "text/plain"});
        res.end("pluh");
    });

    // WS SERVER
    function randint(a, b) {
        return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    // =========================================================================
    // GLOBAL bot state — persists across controller reconnects
    // =========================================================================
    let workers = []; // { worker, config, respawns, killed, role }

    // =========================================================================
    // BOT ROLES — diversified behavior
    // =========================================================================
    const BOT_ROLES = ['pvp']; // ALL bots are PvP — no other roles
    // No follower role — all bots are autonomous
    let roleIdx = 0;

    // Tanks per role
    // All auto-turret tanks (fire automatically, no E needed)
    const AUTO_TANKS = ['mega3', 'auto5', 'auto4'];

    function getNextRole() {
        const role = BOT_ROLES[roleIdx % BOT_ROLES.length];
        roleIdx++;
        return role;
    }

    function getTankForRole(role) {
        return AUTO_TANKS[Math.floor(Math.random() * AUTO_TANKS.length)];
    }

    function getNameForRole(role) {
        return 'Fried pvp';
    }

    // Broadcast all bot positions to every bot every 500ms (IFF — friendly fire prevention)
    setInterval(() => {
        const allPositions = workers.filter(e => e.pos).map(e => ({ x: e.pos.x, y: e.pos.y }));
        if (allPositions.length < 2) return; // no point if only 1 bot
        for (const entry of workers) {
            // Send all OTHER bots' positions (exclude self)
            const others = allPositions.filter(p => !entry.pos || Math.hypot(p.x - entry.pos.x, p.y - entry.pos.y) > 5);
            try { entry.worker.postMessage({ type: 'friendly_positions', positions: others }); } catch(e) {}
        }
    }, 500);

    function spawnBot(config, respawns) {
        const spawnTime = Date.now();
        const worker = new Worker(path.resolve("index.js"));
        const entry = { worker, config, respawns: respawns || 0, killed: false };
        workers.push(entry);

        // Send role-based tank selection
        worker.postMessage({ type: "tankselect", tank: config.tank });

        const startMsg = { type: "start", config };
        if (cachedWasm) startMsg.cachedWasm = cachedWasm;
        if (cachedScript) startMsg.cachedScript = cachedScript;
        worker.postMessage(startMsg);

        // Listen for status messages from worker
        const botProxyUrl = config.proxy && config.proxy.url;
        worker.on('message', (msg) => {
            if (msg && msg.type === 'status') {
                const elapsed = Date.now() - spawnTime;
                if (msg.event === 'connected') {
                    console.log(`Bot connected in ${elapsed}ms: ${msg.detail}`);
                    recordProxySuccess(botProxyUrl);
                } else if (msg.event === 'spawned') {
                    console.log(`Bot joined game in ${elapsed}ms`);
                    entry.inGame = true;
                    broadcastCounts();
                } else if (msg.event === 'died') {
                    entry.inGame = false;
                    broadcastCounts();
                } else if (msg.event === 'gave_up' || msg.event === 'banned') {
                    recordProxyFailure(botProxyUrl);
                    entry.inGame = false;
                    broadcastCounts();
                }
            } else if (msg && msg.type === 'bot_position') {
                // Store this bot's position for IFF broadcasting
                entry.pos = { x: msg.x, y: msg.y };
            }
        });

        // Auto-rejoin: if worker exits, respawn with a FRESH proxy
        worker.on('exit', (code) => {
            workers = workers.filter(e => e.worker !== worker);
            broadcastCounts();
            if (entry.killed) return;

            // Record failure if bot never connected successfully
            if (!entry.inGame) recordProxyFailure(botProxyUrl);

            if (entry.respawns < 3) {
                const delay = entry.respawns < 2 ? 2000 : 4000;
                // Get a NEW proxy for the respawn — don't reuse the same dead one
                const newProxy = getNextProxy();
                const newConfig = { ...config, proxy: newProxy };
                console.log(`Bot exited (code ${code}). Retrying in ${delay/1000}s with new proxy (attempt ${entry.respawns + 1}/3)`);
                setTimeout(() => {
                    spawnBot(newConfig, entry.respawns + 1);
                }, delay);
            } else {
                console.log('Bot used all 3 rejoin attempts, giving up.');
                recordProxyFailure(botProxyUrl);
            }
        });

        worker.on('error', (err) => {
            console.log('Worker error:', err.message);
        });

        return worker;
    }

    function broadcastCounts() {
        const total = workers.length;
        const inGame = workers.filter(e => e.inGame).length;
        // Broadcast to all connected controllers
        wss.clients.forEach(client => {
            if (client.readyState === 1) {
                try { client.send(pack(['S', 'botcount', total, inGame])); } catch(e) {}
            }
        });
    }

    function killAllBots() {
        for (const entry of workers) {
            entry.killed = true;
            try { entry.worker.postMessage({ type: "destroy" }); } catch(e) {}
            try { entry.worker.terminate(); } catch(e) {}
        }
        workers = [];
        console.log('All bots killed.');
        broadcastCounts();
    }

    // =========================================================================
    // WebSocket — controller connections
    // =========================================================================
    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws, req) => {
        const addr = req.socket.remoteAddress;
        console.log(addr, "connected");

        let challenge;
        let verified = false;

        function packet(...args) {
            ws.send(pack(args));
        }

        ws.on("message", (msg) => {
            try {
                const data = unpack(msg);
                const type = data.shift();

                switch (type) {
                    case "M":
                        if (challenge || data[0] != 72011) {
                            ws.close();
                            return;
                        }
                        challenge = randint(0b1000000000, 0b1111111111);
                        packet("M", challenge);
                        break;
                        
                    case "C":
                        if (data[0] == (challenge ^ 845)) {
                            verified = true;
                            console.log(addr, "verified —", workers.length, "existing bots");
                        } else {
                            ws.close();
                            console.log(addr, "true noob");
                        }
                        break;

                    case "F":
                        if (verified) {
                            const proxyInfo = getNextProxy();
                            const proxyLabel = proxyInfo.url === PROXY ? 'whiteproxies' : proxyInfo.url.replace(/\/\/.*@/, '//***@').slice(0, 40);
                            // Use role from controller if provided, otherwise fallback to rotation
                            const role = (data[1] && ['pvp', 'wanderer', 'chatbot'].includes(data[1])) ? data[1] : getNextRole();
                            const roleTank = getTankForRole(role);
                            console.log(`spawning ${role} bot (${roleTank}) via ${proxyLabel}`);

                            const config = {
                                id: 0,
                                proxy: proxyInfo,
                                hash: "#" + data[0],
                                name: getNameForRole(role),
                                stats: [0, 0, 0, 0, 0, 0, 0, 9],
                                type: "autonomous",
                                autoRespawn: true,
                                keys: [],
                                keysHold: [],
                                tank: roleTank,
                                role: role,
                                chatSpam: "",
                                squadId: data[0],
                                reconnectAttempts: 3,
                                reconnectDelay: 3000,
                                geminiApiKey: GEMINI_API_KEY,
                                chatbotPersonality: CHATBOT_PERSONALITY,
                            };

                            spawnBot(config, 0);
                        }
                        break;

                    case "B":
                        if (verified) {
                            killAllBots();
                        }
                        break;
                        
                    case "G":
                        if (verified && data[0] && typeof data[0] === 'object') {
                            if (data[0].apiKey !== undefined) GEMINI_API_KEY = data[0].apiKey;
                            if (data[0].personality !== undefined) CHATBOT_PERSONALITY = data[0].personality;
                            for (const entry of workers) {
                                entry.worker.postMessage({
                                    type: "chatbot_config",
                                    geminiApiKey: GEMINI_API_KEY,
                                    chatbotPersonality: CHATBOT_PERSONALITY,
                                });
                            }
                            console.log("Chatbot config updated", GEMINI_API_KEY ? "(key set)" : "(key empty)");
                        }
                        break;
                }
            } catch (e) {
                console.error(e);
            }
        });

        ws.on("close", () => {
            console.log(addr, "disconnected — bots kept alive (" + workers.length + " running)");
        });
    });


    const port = prod ? process.env.PORT : 65535;
    server.listen(port, () => {
        console.log("arras.io - build 6 (worker_threads)");
        console.log("Listening on", port);
    });
})();
