// ==UserScript==
// @name         Arras AFK Bot - Complete (Iframe Bots, Fixed Reconnect)
// @namespace    http://tampermonkey.net/
// @version      13.2.0
// @description  Full AFK bot with fluid movement, smart wall navigation, auto-reconnect, AND iframe bot instances (no separate windows!)
// @match        *://arras.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";

    // Are we running inside an iframe bot? If so, skip iframe-spawning features.
    var isInsideIframe = (window !== window.top);

    // ╔═══════════════════════════════════════════════════════════════════════╗
    // ║                    TABLE OF CONTENTS / QUICK FIND                   ║
    // ║                                                                     ║
    // ║  Search for these tags to jump to each section:                      ║
    // ║                                                                     ║
    // ║  [SECTION: BOT-SYSTEM]     - Bot windows + proxy assignment          ║
    // ║  [SECTION: COORD-DETECT]   - Canvas text coordinate detection       ║
    // ║  [SECTION: WEBSOCKET]      - WebSocket hook (intercepts game conn)  ║
    // ║  [SECTION: BROADCAST]      - BroadcastChannel & tab communication   ║
    // ║  [SECTION: VISIBILITY]     - Page visibility override (stay active) ║
    // ║  [SECTION: KEY-INTERCEPT]  - Keyboard event interception            ║
    // ║  [SECTION: MOUSE-INTERCEPT]- Mouse event interception               ║
    // ║  [SECTION: INPUT-HELPERS]  - Key simulation & mouse aim helpers     ║
    // ║  [SECTION: ENTER-HELPER]   - Press Enter helper (join/respawn)      ║
    // ║  [SECTION: STATE]          - Bot state variables                    ║
    // ║  [SECTION: TANK-UPGRADES]  - Tank upgrade paths & stat builds       ║
    // ║  [SECTION: MOVEMENT-CFG]   - Movement config (roam, summon, etc.)   ║
    // ║  [SECTION: DEATH-DETECT]   - Death detection & auto-respawn         ║
    // ║  [SECTION: BUILD-SEQ]      - Post-respawn build sequence            ║
    // ║  [SECTION: AI-CHATBOT]    - AI chatbot (Pollinations.ai, free)    ║
    // ║  [SECTION: MOVEMENT]       - Movement directions & fluid movement   ║
    // ║  [SECTION: WALL-DETECT]    - Wall detection & avoidance             ║
    // ║  [SECTION: GUI-HTML]       - GUI panel HTML & CSS                   ║
    // ║  [SECTION: GUI-WIRING]     - GUI event wiring (buttons, toggles)    ║
    // ║  [SECTION: GUI-UPDATES]    - Panel update functions                 ║
    // ║  [SECTION: GUI-HELPERS]    - GUI helper functions                   ║
    // ║  [SECTION: HOTKEYS]        - Keyboard hotkeys (ESC, [, ])           ║
    // ║  [SECTION: BOOT]           - Boot / initialization                  ║
    // ║                                                                     ║
    // ║  QUICK EDIT GUIDE:                                                  ║
    // ║  - To change default tank: search "selectedTankUpgrade"             ║
    // ║  - To add a new tank: add entry to tankUpgrades object              ║
    // ║  - To change a stat build: edit the "stats" field (format below)    ║
    // ║  - To change hotkeys: search [SECTION: HOTKEYS]                     ║
    // ║  - To change movement speed/timing: search [SECTION: MOVEMENT-CFG]  ║
    // ║  - To change GUI appearance: search [SECTION: GUI-HTML]             ║
    // ║                                                                     ║
    // ║  STAT FORMAT: "a/b/c/d/e/f/g/h"                                    ║
    // ║    a = Health Regen    (key 1)                                      ║
    // ║    b = Max Health      (key 2)                                      ║
    // ║    c = Body Damage     (key 3)                                      ║
    // ║    d = Bullet Speed    (key 4)                                      ║
    // ║    e = Bullet Penetration (key 5)                                   ║
    // ║    f = Bullet Damage   (key 6)                                      ║
    // ║    g = Reload          (key 7)                                      ║
    // ║    h = Movement Speed  (key 8)                                      ║
    // ║  M key maxes out the current stat being upgraded                    ║
    // ║                                                                     ║
    // ║  UPGRADE PATH FORMAT: "abc" where each letter = upgrade key:        ║
    // ║    Y = 1st option, U = 2nd, I = 3rd, H = 4th, J = 5th, K = 6th    ║
    // ║    1st letter = Tier 2 choice, 2nd = Tier 3, 3rd = Tier 4          ║
    // ║    Example: "huu" = Flank Guard(H) -> Tri-Angle(U) -> Booster(U)   ║
    // ║                                                                     ║
    // ║  TIER 2 TANKS (from Basic):                                         ║
    // ║    Y = Twin, U = Sniper, I = Machine Gun,                           ║
    // ║    H = Flank Guard, J = Director, K = Pounder                       ║
    // ╚═══════════════════════════════════════════════════════════════════════╝

    // =========================================================================
    // [SECTION: BOT-SYSTEM] Bot Iframe & Proxy System
    // Opens bot instances as hidden iframes embedded in the page.
    // Each iframe loads the game and runs the script independently.
    // Functions: createBotWindow(), removeBotWindow(), saveBotState()
    // Only runs in the TOP window.
    // =========================================================================
    // [SECTION: PROXY-LIST] SOCKS5 Proxy List
    // Each bot window can be routed through a different proxy using a proxy
    // extension (like FoxyProxy or Proxy SwitchyOmega).
    // Proxies are assigned round-robin to new bot windows.
    //
    // HOW TO USE WITH FOXYPROXY:
    //   1. Install FoxyProxy extension
    //   2. Add each proxy below as a SOCKS5 entry in FoxyProxy settings
    //   3. Set FoxyProxy to route by tab/pattern or use the assigned proxy
    //   4. Each bot window title shows which proxy it should use
    // =========================================================================
    var PROXY_LIST = [
        "socks5://192.252.209.155:14455",
        "socks5://192.252.208.67:14287",
        "socks5://123.54.197.16:21168",
        "socks5://142.54.228.193:4145",
        "socks5://123.54.197.19:22701",
        "socks5://123.54.197.25:21715",
        "socks5://123.54.197.50:21141",
        "socks5://123.54.197.53:22917",
        "socks5://142.54.231.38:4145",
        "socks5://123.54.197.20:21281",
        "socks5://170.233.30.33:4153",
        "socks5://104.200.152.30:4145",
        "socks5://221.202.27.194:10807",
        "socks5://203.189.154.129:1080",
        "socks5://123.54.197.52:20291",
        "socks5://58.187.104.67:1090",
        "socks5://208.65.90.3:4145",
        "socks5://123.54.197.21:20909",
        "socks5://174.77.111.198:49547",
        "socks5://123.54.197.24:20969",
        "socks5://98.191.0.47:4145",
        "socks5://98.182.147.97:4145",
        "socks5://123.54.197.51:21977"
    ];
    var nextProxyIndex = 0;

    // =========================================================================
    // [SECTION: BOT-IFRAMES] Bot Iframe System
    // Creates hidden iframes that load the game. Each iframe runs the
    // Tampermonkey script independently as a separate bot instance.
    //
    // Functions: createBotWindow(), removeBotWindow(), updateBotList()
    // Only runs in the TOP window.
    // =========================================================================
    if (!isInsideIframe) {

    window.botInstances = [];

    function saveBotState() {
        var botData = [];
        for (var i = 0; i < window.botInstances.length; i++) {
            var bot = window.botInstances[i];
            botData.push({ id: i, proxy: bot.proxy });
        }
        localStorage.setItem("arras-afk-bots", JSON.stringify(botData));
    }

    function removeBotWindow(index) {
        if (window.botInstances[index]) {
            var bot = window.botInstances[index];
            if (bot.iframe && bot.iframe.parentNode) {
                bot.iframe.parentNode.removeChild(bot.iframe);
            }
            window.botInstances.splice(index, 1);
            saveBotState();
            updateBotList();
            console.log("[AFK Bot] Removed bot iframe #" + (index + 1));
        }
    }

    function updateBotList() {
        var listEl = document.getElementById("bot-list");
        if (!listEl) return;

        listEl.innerHTML = "";
        for (var i = 0; i < window.botInstances.length; i++) {
            var bot = window.botInstances[i];
            var botItem = document.createElement("div");
            botItem.style.display = "flex";
            botItem.style.justifyContent = "space-between";
            botItem.style.alignItems = "center";
            botItem.style.padding = "6px";
            botItem.style.background = "rgba(10,10,26,0.6)";
            botItem.style.borderRadius = "6px";
            botItem.style.marginBottom = "4px";
            botItem.style.fontSize = "11px";

            var label = document.createElement("span");
            var proxyShort = bot.proxy ? bot.proxy.replace("socks5://", "") : "no proxy";
            var status = (bot.iframe && bot.iframe.parentNode) ? "running" : "stopped";
            label.textContent = "Bot #" + (i + 1) + " [" + proxyShort + "] (" + status + ")";
            label.style.color = status === "running" ? "#4caf50" : "#f44336";
            botItem.appendChild(label);

            var closeBtn = document.createElement("button");
            closeBtn.textContent = "✕";
            closeBtn.style.background = "#f44336";
            closeBtn.style.border = "none";
            closeBtn.style.color = "#fff";
            closeBtn.style.padding = "2px 8px";
            closeBtn.style.borderRadius = "4px";
            closeBtn.style.cursor = "pointer";
            closeBtn.style.fontSize = "11px";
            closeBtn.style.fontWeight = "bold";
            closeBtn.onclick = (function(idx) {
                return function() { removeBotWindow(idx); };
            })(i);
            botItem.appendChild(closeBtn);

            listEl.appendChild(botItem);
        }
    }

    function createBotWindow() {
        // Assign proxy round-robin
        var proxy = PROXY_LIST[nextProxyIndex % PROXY_LIST.length];
        nextProxyIndex++;

        // Create offscreen iframe loading the game
        var iframe = document.createElement("iframe");
        iframe.src = location.href;
        // Real size so canvas initializes, but offscreen and non-interactive
        iframe.style.cssText = "width:400px;height:300px;position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;border:none;";
        document.body.appendChild(iframe);

        var botIndex = window.botInstances.length;
        var botObj = {
            iframe: iframe,
            index: botIndex,
            proxy: proxy
        };
        window.botInstances.push(botObj);

        console.log("[AFK Bot] Created bot iframe #" + (botIndex + 1) + " with proxy: " + proxy);
        saveBotState();
        updateBotList();
        return botObj;
    }

    window.createBotWindow = createBotWindow;
    window.removeBotWindow = removeBotWindow;
    } // end if (!isInsideIframe)

    // =========================================================================
    // [SECTION: COORD-DETECT] Canvas Text Coordinate Detection
    // Hooks into CanvasRenderingContext2D to intercept text drawn on screen.
    // Reads coordinates from the game's coordinate display text.
    // Also detects "play" and "disconnect" states for auto-reconnect.
    // Key variables: detectedCoords, grid, coordDetectionDone
    // =========================================================================
    var detectedCoords = { x: 0, y: 0, hasData: false, rawText: "Searching..." };
    var coordUpdateCount = 0;
    var coordDetectionDone = false;
    var coordLastUpdateTime = 0;
    var textSamples = [];
    var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
    // Grid state
    var grid = { x: 0, y: 0 };
    var GRID_SCALE = 1;
    var lastDetectedPos = { x: 0, y: 0, time: Date.now() };

    // Wall/Obstacle tracking - improved system
    var wallMemory = {};
    var WALL_CHECK_INTERVAL = 400;
    var WALL_MOVE_THRESHOLD = 0.15;
    var lastWallCheck = { x: 0, y: 0, time: 0, dir: null };
    var wallAvoidanceMode = true;
    var wallAvoidanceDir = null;
    var wallAvoidanceStartTime = 0;
    var WALL_AVOIDANCE_TIMEOUT = 3000;

    // =========================================================================
    // -2b. BUTTON TRACKING & RECONNECT (improved reconnect system)
    // =========================================================================
    var buttonLocations = {};
    var respawnButtonPos = null;
    var reconnectButtonPos = null;
    var lastCanvasRect = null;

    var reconnectDetected = false;
    var disconnectDetected = false;
    var lastReconnectAttempt = 0;
    var RECONNECT_COOLDOWN = 0;

    // Camera transform tracking — captures the canvas transform matrix
    // so we can convert between screen coords and game-world coords
    var cameraTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; // current 2D affine matrix

    function screenToWorld(screenX, screenY) {
        // Inverse of affine: [a c e; b d f; 0 0 1]
        var det = cameraTransform.a * cameraTransform.d - cameraTransform.b * cameraTransform.c;
        if (Math.abs(det) < 0.0001) return { x: 0, y: 0 };
        var invA = cameraTransform.d / det;
        var invB = -cameraTransform.b / det;
        var invC = -cameraTransform.c / det;
        var invD = cameraTransform.a / det;
        var invE = (cameraTransform.c * cameraTransform.f - cameraTransform.d * cameraTransform.e) / det;
        var invF = (cameraTransform.b * cameraTransform.e - cameraTransform.a * cameraTransform.f) / det;
        return {
            x: invA * screenX + invC * screenY + invE,
            y: invB * screenX + invD * screenY + invF
        };
    }

    function worldToScreen(worldX, worldY) {
        return {
            x: cameraTransform.a * worldX + cameraTransform.c * worldY + cameraTransform.e,
            y: cameraTransform.b * worldX + cameraTransform.d * worldY + cameraTransform.f
        };
    }

    function hookCanvasText() {
        var proto = CanvasRenderingContext2D.prototype;

        // Hook setTransform to capture camera matrix
        var origSetTransform = proto.setTransform;
        proto.setTransform = function(a, b, c, d, e, f) {
            // Capture the game camera transform (not HUD/UI transforms)
            // Game camera has: non-trivial zoom (a != 1), and offset from center
            if (this.canvas && this.canvas.width > 100) {
                // The game camera transform has a zoom factor != 1 and shifts the view
                // HUD transforms are usually identity (a=1,d=1) or have b/c rotation
                if (a === d && b === 0 && c === 0 && a !== 1 && a > 0.01) {
                    cameraTransform.a = a; cameraTransform.b = b;
                    cameraTransform.c = c; cameraTransform.d = d;
                    cameraTransform.e = e; cameraTransform.f = f;
                }
            }
            return origSetTransform.apply(this, arguments);
        };

        var origFillText = proto.fillText;
        proto.fillText = function(text, x, y) {
            onCanvasText(text, x, y, this);
            return origFillText.apply(this, arguments);
        };

        var origStrokeText = proto.strokeText;
        proto.strokeText = function(text, x, y) {
            onCanvasText(text, x, y, this);
            return origStrokeText.apply(this, arguments);
        };
    }

    var lastCoordText = "";
    var playDetected = false; // Guard flag to prevent double Enter/L press

    function onCanvasText(text, x, y, ctx) {
        if (typeof text !== 'string') return;

        if (textSamples.indexOf(text) === -1 && textSamples.length < 50) {
            textSamples.push(text);
        }

        var lowerText = text.toLowerCase().trim();

        // Detect "PLAY" button - game reloaded successfully
        // Guard: only fire once per play screen (reset when we get coords back)
        if (lowerText === "play" && !playDetected) {
            playDetected = true;
            (async () => {
                console.log("[AFK Bot] Play detected. Waiting 3 seconds for game to load...");
                await delay(3000);
                pressEnter();
                await delay(200);
                await tapKey("KeyL", "l");
                await delay(200);
                runBuildSequence();
            })();
        }

        // Track text frequency for chat vs name detection
        if (chatbotEnabled) {
            // Only process text within the visible canvas viewport (skip off-screen renders)
            var cvs = ctx.canvas;
            var inViewport = !cvs || (x >= -50 && y >= -50 && x <= cvs.width + 50 && y <= cvs.height + 50);
            if (inViewport) {
                trackTextFrequency(text);
                // Store position for name-chat linking
                var now = Date.now();
                recentTextPositions.push({ text: text, x: x, y: y, time: now });
                // Keep only last 200 entries and last 2 seconds
                if (recentTextPositions.length > 200) recentTextPositions = recentTextPositions.slice(-100);
                if (isChatMessage(text)) {
                    onChatDetected(text, x, y);
                }
            }
        }

        // Track followed player's position using camera transform (independent of chatbot)
        if (followPlayerName) {
            var followLower = followPlayerName.toLowerCase();
            var textLower = text.toLowerCase();
            if (textLower.indexOf(followLower) !== -1) {
                // x, y from fillText are in the game's local coordinate space
                // Convert to screen coords using the current camera transform
                var screenPos = worldToScreen(x, y);
                var cvs2 = ctx.canvas;

                // Skip leaderboard: text on the right 25% of screen
                var isLeaderboard = false;
                if (cvs2) {
                    if (screenPos.x > cvs2.width * 0.70) isLeaderboard = true;
                }
                if (/^\d+[\.\)]\s/.test(text) || /^#\d+/.test(text)) isLeaderboard = true;

                if (!isLeaderboard) {
                    // Store both the game-world coords and screen coords
                    followPlayerPos = {
                        x: screenPos.x, y: screenPos.y, // screen position
                        worldX: x, worldY: y,             // game rendering coords
                        time: Date.now()
                    };
                    followRoaming = false;

                    // Calculate screen distance from center
                    if (cvs2) {
                        var fdx = screenPos.x - cvs2.width / 2;
                        var fdy = screenPos.y - cvs2.height / 2;
                        var fdist = Math.hypot(fdx, fdy);
                        followPlayerPos.screenDist = fdist;
                        if (fdist > 1) {
                            followPlayerPos.dirX = fdx / fdist;
                            followPlayerPos.dirY = fdy / fdist;
                        }
                    }

                    // Convert screen offset from center → world offset using camera zoom
                    // Screen center = bot's position, zoom = cameraTransform.a
                    if (cvs2 && Math.abs(cameraTransform.a) > 0.001) {
                        var worldOffX = (screenPos.x - cvs2.width / 2) / cameraTransform.a;
                        var worldOffY = (screenPos.y - cvs2.height / 2) / cameraTransform.d;
                        followLastSeenGrid = {
                            x: grid.x + worldOffX,
                            y: grid.y + worldOffY
                        };
                    }

                    if (!followPlayerPos._logged) {
                        var wPos = followLastSeenGrid || {x:0,y:0};
                        console.log("[AFK Bot] Following: '" + text + "' screen(" + screenPos.x.toFixed(0) + "," + screenPos.y.toFixed(0) + ") worldEst(" + wPos.x.toFixed(1) + "," + wPos.y.toFixed(1) + ") zoom=" + cameraTransform.a.toFixed(2));
                        followPlayerPos._logged = true;
                    }
                }
            }
        }

        // Detect "DISCONNECT" state
        if (lowerText === "disconnect" || lowerText === "disconnected" || lowerText.includes("disconnect")) {
            if (!disconnectDetected) {
                disconnectDetected = true;
                console.log("[AFK Bot] DISCONNECT detected - initiating reconnect...");
                handleReconnect();
            }
            return;
        }

        // Match coordinates format
        var coordMatch = text.match(/Coordinates:\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i);

        if (coordMatch) {
            var newX = parseFloat(coordMatch[1]);
            var newY = parseFloat(coordMatch[2]);

            detectedCoords.x = newX;
            detectedCoords.y = newY;
            detectedCoords.rawText = text;
            detectedCoords.hasData = true;
            coordUpdateCount++;
            coordLastUpdateTime = Date.now();

            grid.x = newX / GRID_SCALE;
            grid.y = newY / GRID_SCALE;

            if (!coordDetectionDone) {
                coordDetectionDone = true;
                console.log("[AFK Bot] Coordinates detected! Initial: " + text);
            }

            lastCoordText = text;
            if (typeof checkSummonArrival === 'function') checkSummonArrival();
            if (typeof throttledBroadcast === 'function') throttledBroadcast();

            // Reset flags when we have valid coords (we're in game)
            if (reconnectDetected || disconnectDetected || playDetected) {
                reconnectDetected = false;
                disconnectDetected = false;
                playDetected = false;
                console.log("[AFK Bot] Back in game - connection restored");
            }
        }
    }

    function handleReconnect() {
        var now = Date.now();
        if (now - lastReconnectAttempt < 10000) return;
        lastReconnectAttempt = now;

        console.log("[AFK Bot] Disconnect detected. Reloading page...");

        // Save flag so the bot knows to join back after the refresh
        sessionStorage.setItem('pendingAutoEnter', 'true');

        if (document.activeElement && document.activeElement.tagName === "INPUT") {
            document.activeElement.blur();
        }

        // Reload to get back to the play button
        window.location.reload();
    }

    // Install hooks immediately
    hookCanvasText();

    // Debug logging
    setTimeout(function() {
        var lastLoggedCoord = "";
        setInterval(function() {
            if (coordDetectionDone && detectedCoords.hasData) {
                var currentCoord = detectedCoords.x + "," + detectedCoords.y;
                if (currentCoord !== lastLoggedCoord) {
                    lastLoggedCoord = currentCoord;
                }
            }
        }, 1000);
    }, 500);

    // =========================================================================
    // [SECTION: WEBSOCKET] WebSocket Hook
    // Intercepts the game's WebSocket connection to monitor message count
    // and detect disconnections. The original WebSocket is wrapped.
    // Key variables: gameWebSocket, wsMsgCount
    // =========================================================================
    var gameWebSocket = null;
    var wsMsgCount = 0;

    var _OrigWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        var ws = protocols !== undefined
            ? new _OrigWebSocket(url, protocols)
            : new _OrigWebSocket(url);

        gameWebSocket = ws;
        console.log("[AFK Bot] WebSocket intercepted:", url);

        ws.addEventListener('message', function() { wsMsgCount++; });
        return ws;
    };
    window.WebSocket.prototype = _OrigWebSocket.prototype;
    window.WebSocket.prototype.constructor = window.WebSocket;
    window.WebSocket.CONNECTING = _OrigWebSocket.CONNECTING;
    window.WebSocket.OPEN = _OrigWebSocket.OPEN;
    window.WebSocket.CLOSING = _OrigWebSocket.CLOSING;
    window.WebSocket.CLOSED = _OrigWebSocket.CLOSED;

    function checkSummonArrival() {
        if (summonTarget && !roamReached) {
            var distToTarget = Math.hypot(grid.x - summonTarget.x, grid.y - summonTarget.y);
            if (distToTarget <= ROAM_RADIUS_MIN) {
                roamReached = true;
                roamCenter = { x: summonTarget.x, y: summonTarget.y };
                setStatus("Roaming near (" + summonTarget.x.toFixed(1) + ", " + summonTarget.y.toFixed(1) + ")");
            }
        }
    }

    // =========================================================================
    // [SECTION: BROADCAST] BroadcastChannel & Tab Communication
    // Allows multiple tabs/bots to communicate positions and commands.
    // Enables leader/follower mode where alt tabs follow the leader.
    // Key variables: altTabs, myTabId, isLeader, followLeader, botChannel
    // Functions: broadcastPosition(), claimLeader(), resignLeader(),
    //           autoFollowLeader(), getLeaderTab(), getAltCount()
    // =========================================================================
    var altTabs = {};
    var myTabId = Math.random().toString(36).substr(2, 8);
    var isLeader = false;
    console.log("[AFK Bot] Tab ID: " + myTabId);
    var followLeader = true;
    var botChannel = null;
    var lastBroadcastTime = 0;

    try {
        botChannel = new BroadcastChannel('arras-afk-bot-v13');
        botChannel.onmessage = function(event) {
            var msg = event.data;
            if (!msg || msg.tabId === myTabId) return;

            if (msg.type === 'position') {
                altTabs[msg.tabId] = {
                    gridX: msg.gridX,
                    gridY: msg.gridY,
                    isLeader: msg.isLeader,
                    hasRealData: msg.hasRealData,
                    lastSeen: Date.now()
                };
                if (!isLeader && followLeader && msg.isLeader && msg.hasRealData) {
                    autoFollowLeader(msg.gridX, msg.gridY);
                }
            } else if (msg.type === 'leader_claim') {
                if (isLeader) {
                    isLeader = false;
                    updateGUI();
                }
            } else if (msg.type === 'command') {
                if (!isLeader) {
                    executeRemoteCommand(msg.command, msg.value);
                }
            }
        };
    } catch(e) {
        console.log("[AFK Bot] BroadcastChannel not available:", e);
    }

    function executeRemoteCommand(command, value) {
        console.log("[AFK Bot] Executing command from leader:", command, value);
        switch(command) {
            case 'toggle_movement':
                movementEnabled = value !== undefined ? value : !movementEnabled;
                if (movementEnabled) {
                    currentDir = null;
                    currentMouseX = -1;
                    currentMouseY = -1;
                    setStatus("Moving (leader command)");
                } else {
                    releaseAllMovement();
                    currentDir = null;
                    setStatus("Stopped (leader command)");
                }
                updateGUI();
                break;
            case 'toggle_respawn':
                autoRespawnEnabled = value !== undefined ? value : !autoRespawnEnabled;
                updateGUI();
                break;
            case 'stop_all':
                movementEnabled = false;
                releaseAllMovement();
                currentDir = null;
                setStatus("Stopped by leader");
                updateGUI();
                break;
        }
    }

    function sendCommandToAlts(command, value) {
        if (!botChannel || !isLeader) return;
        try {
            botChannel.postMessage({
                type: 'command',
                tabId: myTabId,
                command: command,
                value: value
            });
        } catch(e) {}
    }

    function throttledBroadcast() {
        var now = Date.now();
        if (now - lastBroadcastTime < 25) return;
        lastBroadcastTime = now;
        broadcastPosition();
    }

    function broadcastPosition() {
        if (!botChannel) return;
        try {
            botChannel.postMessage({
                type: 'position',
                tabId: myTabId,
                gridX: grid.x,
                gridY: grid.y,
                isLeader: isLeader,
                hasRealData: detectedCoords.hasData
            });
        } catch(e) {}
    }

    function claimLeader() {
        isLeader = true;
        summonTarget = null;
        roamCenter = null;
        roamReached = false;
        if (botChannel) {
            try {
                botChannel.postMessage({ type: 'leader_claim', tabId: myTabId });
            } catch(e) {}
        }
        setStatus("LEADER — alts follow me");
        updateGUI();
    }

    function resignLeader() {
        isLeader = false;
        setStatus("Moving");
        updateGUI();
    }

    function autoFollowLeader(leaderGridX, leaderGridY) {
        if (!summonTarget) {
            doSummon(leaderGridX, leaderGridY);
            return;
        }
        if (!roamReached) {
            summonTarget.x = leaderGridX;
            summonTarget.y = leaderGridY;
            return;
        }

        var distToLeader = Math.hypot(grid.x - leaderGridX, grid.y - leaderGridY);
        if (distToLeader < LEADER_SAFE_DISTANCE) {
            return;
        }

        var distFromLeader = Math.hypot(roamCenter.x - leaderGridX, roamCenter.y - leaderGridY);
        if (distFromLeader > ROAM_RADIUS_MAX) {
            doSummon(leaderGridX, leaderGridY);
        }
    }

    function getLeaderTab() {
        var now = Date.now();
        for (var tabId in altTabs) {
            var tab = altTabs[tabId];
            if (now - tab.lastSeen > 5000) { delete altTabs[tabId]; continue; }
            if (tab.isLeader && tab.hasRealData) return tab;
        }
        return null;
    }

    function getAltCount() {
        var count = 0;
        var now = Date.now();
        for (var tabId in altTabs) {
            if (now - altTabs[tabId].lastSeen > 5000) { delete altTabs[tabId]; }
            else { count++; }
        }
        return count;
    }

    // =========================================================================
    // [SECTION: VISIBILITY] Page Visibility Override
    // Prevents the browser from throttling the tab when it's not focused.
    // Makes document.hidden always return false and blocks visibilitychange.
    // Also blocks beforeunload to prevent "are you sure?" popups.
    // =========================================================================
    Object.defineProperty(document, 'hidden', {
        get: function() { return false; },
        configurable: true
    });
    Object.defineProperty(document, 'visibilityState', {
        get: function() { return 'visible'; },
        configurable: true
    });

    var originalAddEventListener = document.addEventListener;
    document.addEventListener = function(type, listener, options) {
        if (type === 'visibilitychange') return;
        return originalAddEventListener.call(this, type, listener, options);
    };

    // Block beforeunload
    Object.defineProperty(window, "onbeforeunload", {
        get: function() { return null; },
        set: function() {},
    });
    var _origAddEventListener2 = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
        if (type === "beforeunload") return;
        return _origAddEventListener2.call(this, type, listener, options);
    };

    // =========================================================================
    // [SECTION: KEY-INTERCEPT] Keyboard Event Interception
    // Wraps keyboard event handlers so the game accepts simulated keypresses.
    // Makes isTrusted always appear true on key events.
    // =========================================================================
    var _origWindowAddEventListener = window.addEventListener;
    window.addEventListener = function() {
        var args = Array.prototype.slice.call(arguments);
        var type = args[0];
        if (type === "keydown" || type === "keyup") {
            var originalHandler = args[1];
            args[1] = function() {
                var real = arguments[0];
                var proxy = {
                    isTrusted: true,
                    key: real.key,
                    code: real.code,
                    shiftKey: real.shiftKey,
                    preventDefault: function() {},
                };
                return originalHandler.apply(this, [proxy]);
            };
        }
        return _origWindowAddEventListener.apply(this, args);
    };

    // =========================================================================
    // [SECTION: MOUSE-INTERCEPT] Mouse Event Interception
    // Wraps mouse event handlers so the game accepts simulated mouse moves.
    // Makes isTrusted always appear true on mouse events.
    // =========================================================================
    var _origDivAddEventListener = HTMLDivElement.prototype.addEventListener;
    HTMLDivElement.prototype.addEventListener = function() {
        var args = Array.prototype.slice.call(arguments);
        var type = args[0];
        if (type === "mousedown" || type === "mouseup" || type === "mousemove") {
            var originalHandler = args[1];
            args[1] = function() {
                var real = arguments[0];
                var proxy = {
                    isTrusted: true,
                    clientX: real.clientX,
                    clientY: real.clientY,
                    button: real.button,
                    preventDefault: function() {},
                };
                return originalHandler.apply(this, [proxy]);
            };
        }
        return _origDivAddEventListener.apply(this, args);
    };

    // =========================================================================
    // 3. KEY & MOUSE SIMULATION HELPERS
    // =========================================================================
    var activeKeys = {};
    var blockAllKeys = false; // Global gate: blocks ALL simulateKey dispatches (used during chat)
    function simulateKey(code, keyName, pressed) {
        if (blockAllKeys) return;
        if (activeKeys[code] === pressed) return;
        activeKeys[code] = pressed;
        var event = new KeyboardEvent(pressed ? "keydown" : "keyup", {
            key: keyName, code: code, bubbles: true, cancelable: true,
        });
        document.dispatchEvent(event);
    }

    function tapKey(code, keyName, duration) {
        duration = duration || 50;
        return new Promise(function(resolve) {
            activeKeys[code] = false;
            simulateKey(code, keyName, true);
            setTimeout(function() {
                simulateKey(code, keyName, false);
                resolve();
            }, duration);
        });
    }

    function releaseAllMovement() {
        simulateKey("KeyW", "w", false);
        simulateKey("KeyA", "a", false);
        simulateKey("KeyS", "s", false);
        simulateKey("KeyD", "d", false);
    }

    var cachedCanvas = null;
    function getCanvas() {
        if (!cachedCanvas || !document.contains(cachedCanvas)) {
            cachedCanvas = document.querySelector("#canvas canvas")
                        || document.querySelector("#canvas")
                        || document.querySelector("canvas");
        }
        return cachedCanvas;
    }

    // Smooth mouse aim
    var currentMouseX = -1;
    var currentMouseY = -1;
    var targetMouseX  = -1;
    var targetMouseY  = -1;
    var MOUSE_LERP_SPEED = 0.12;

    function simulateMouseMove(x, y) {
        var canvas = getCanvas();
        if (!canvas) return;
        canvas.dispatchEvent(new MouseEvent("mousemove", {
            clientX: x, clientY: y, button: 0,
            bubbles: true, cancelable: true, view: window,
        }));
    }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function updateMouseSmooth() {
        if (targetMouseX < 0 || targetMouseY < 0) return;
        if (currentMouseX < 0) { currentMouseX = targetMouseX; currentMouseY = targetMouseY; }
        currentMouseX = lerp(currentMouseX, targetMouseX, MOUSE_LERP_SPEED);
        currentMouseY = lerp(currentMouseY, targetMouseY, MOUSE_LERP_SPEED);
        simulateMouseMove(Math.round(currentMouseX), Math.round(currentMouseY));
    }

    // =========================================================================
    // [SECTION: ENTER-HELPER] Press Enter Helper
    // Simulates pressing Enter to join game / respawn after death.
    // Also triggers the build sequence after a short delay.
    // =========================================================================
    function pressEnter() {
        if (document.activeElement && document.activeElement.tagName === "INPUT") {
            document.activeElement.blur();
        }
        // Dispatch keydown
        var ev1 = new KeyboardEvent("keydown", {
            key: "Enter", code: "Enter", keyCode: 13, which: 13,
            bubbles: true, cancelable: true
        });
        document.dispatchEvent(ev1);

        // Dispatch keyup
        var ev2 = new KeyboardEvent("keyup", {
            key: "Enter", code: "Enter", keyCode: 13, which: 13,
            bubbles: true, cancelable: true
        });
        document.dispatchEvent(ev2);
        // NOTE: build sequence is NOT called here — it's called separately
        // by the play detection and death handler to avoid double execution.
    }

    // =========================================================================
    // [SECTION: STATE] Bot State Variables
    // - movementEnabled: whether the bot is actively moving (toggle with [)
    // - autoRespawnEnabled: whether bot auto-respawns on death (toggle with ])
    // - isDead: true briefly during death/respawn cycle
    // - buildSequenceRunning: true while upgrading tank after spawn
    // - deathCount / respawnCount: lifetime stats
    // =========================================================================
    var movementEnabled = true;
    var autoRespawnEnabled = true;
    var isDead = false;
    var buildSequenceRunning = false;
    var deathCount = 0;
    var respawnCount = 0;
    var lastStatus = "Idle";
    var lastCanvasActivity = Date.now();

    function setStatus(s) {
        lastStatus = s;
        updateStatusDisplay();
    }

    // =========================================================================
    // [SECTION: TANK-UPGRADES] Tank Upgrade Paths & Stat Builds
    //
    // HOW TO ADD/EDIT A TANK:
    //   "path": { name: "Display Name", path: "path", stats: "a/b/c/d/e/f/g/h", branch: "Branch Name" }
    //
    // HOW TO CHANGE DEFAULT TANK:
    //   Search for "selectedTankUpgrade" below and change the path string.
    //   Currently set to "huu" (Booster).
    // =========================================================================
    var tankUpgrades = {
  // --- No Upgrade (stay as Basic tank) ---
  "none": { name: "None (Stay Basic)", path: "", stats: "0/0/0/0/0/0/0/0", branch: "No Upgrade" },

  // --- Twin Branch (Y) ---
  // Twin(Y) -> Double Twin(Y): Triple Twin, Hewn Double, Auto-Double, Bent Double
  "yyy": { name: "Triple Twin", path: "yyy", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  "yyu": { name: "Hewn Double", path: "yyu", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  "yyi": { name: "Auto-Double", path: "yyi", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  "yyh": { name: "Bent Double", path: "yyh", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  // Twin(Y) -> Triple Shot(U): Penta Shot, Spreadshot, Bent Hybrid, Bent Double, Triplet
  "yuy": { name: "Penta Shot", path: "yuy", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  "yuu": { name: "Spreadshot", path: "yuu", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  "yui": { name: "Bent Hybrid", path: "yui", stats: "0/3/5/8/8/8/7/3", branch: "Twin (Y)" },
  "yuj": { name: "Triplet", path: "yuj", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  // Twin(Y) -> Gunner(I): Auto-Gunner, Nailgun, Auto-4, Machine Gunner, Gunner Trapper, Cyclone, Overgunner
  "yiy": { name: "Auto-Gunner", path: "yiy", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  "yiu": { name: "Nailgun", path: "yiu", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  "yii": { name: "Auto-4 (Twin)", path: "yii", stats: "0/3/5/8/8/8/7/3", branch: "Twin (Y)" },
  "yih": { name: "Machine Gunner", path: "yih", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  "yij": { name: "Gunner Trapper", path: "yij", stats: "0/3/2/8/8/9/9/3", branch: "Twin (Y)" },
  "yik": { name: "Cyclone (Twin)", path: "yik", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },
  // Twin(Y) -> Hexa Tank(H): Octo Tank, Cyclone, Hexa-Trapper
  "yhy": { name: "Octo Tank (Twin)", path: "yhy", stats: "0/0/0/9/9/9/9/6", branch: "Twin (Y)" },

  // --- Sniper Branch (U) ---
  // Sniper(U) -> Assassin(Y): Ranger, Falcon, Stalker, Auto-Assassin
  "uyy": { name: "Ranger", path: "uyy", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  "uyu": { name: "Falcon (Sniper)", path: "uyu", stats: "0/5/0/7/7/9/7/7", branch: "Sniper (U)" },
  "uyi": { name: "Stalker", path: "uyi", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  "uyh": { name: "Auto-Assassin", path: "uyh", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  // Sniper(U) -> Hunter(U): Predator, Poacher, Ordnance, Dual
  "uuy": { name: "Predator", path: "uuy", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  "uuu": { name: "Poacher", path: "uuu", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  "uui": { name: "Ordnance", path: "uui", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  // Sniper(U) -> Minigun(I): Streamliner, Crop Duster, Barricade, Nailgun
  "uiy": { name: "Streamliner", path: "uiy", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  "uiu": { name: "Crop Duster", path: "uiu", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  "uii": { name: "Barricade", path: "uii", stats: "0/3/2/8/8/9/9/3", branch: "Sniper (U)" },
  "uih": { name: "Nailgun (Sniper)", path: "uih", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  // Sniper(U) -> Rifle(H): Musket, Crossbow, Armsman
  "uhy": { name: "Musket", path: "uhy", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  "uhu": { name: "Crossbow", path: "uhu", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },
  "uhi": { name: "Armsman", path: "uhi", stats: "0/0/0/9/9/9/9/6", branch: "Sniper (U)" },

  // --- Machine Gun Branch (I) ---
  // Machine Gun(I) -> Gunner(Y): Auto-Gunner, Nailgun, Auto-4, Machine Gunner, Gunner Trapper, Cyclone, Overgunner
  "iyy": { name: "Auto-Gunner (MG)", path: "iyy", stats: "0/0/0/9/9/9/9/6", branch: "Machine Gun (I)" },
  "iyu": { name: "Nailgun (MG)", path: "iyu", stats: "0/0/0/9/9/9/9/6", branch: "Machine Gun (I)" },
  // Machine Gun(I) -> Artillery(U): Mortar, Ordnance, Beekeeper
  "iuy": { name: "Mortar", path: "iuy", stats: "0/0/0/9/9/9/9/6", branch: "Machine Gun (I)" },
  "iuu": { name: "Ordnance (MG)", path: "iuu", stats: "0/0/0/9/9/9/9/6", branch: "Machine Gun (I)" },
  "iui": { name: "Beekeeper", path: "iui", stats: "0/3/5/8/8/8/7/3", branch: "Machine Gun (I)" },
  // Machine Gun(I) -> Minigun(I): Streamliner, Nailgun, Crop Duster, Barricade
  "iiy": { name: "Streamliner (MG)", path: "iiy", stats: "0/0/0/9/9/9/9/6", branch: "Machine Gun (I)" },
  "iiu": { name: "Nailgun (MG Mini)", path: "iiu", stats: "0/0/0/9/9/9/9/6", branch: "Machine Gun (I)" },
  "iii": { name: "Crop Duster (MG)", path: "iii", stats: "0/0/0/9/9/9/9/6", branch: "Machine Gun (I)" },

  // --- Flank Guard Branch (H) ---
  // Flank Guard(H) -> Hexa Tank(Y): Octo Tank, Cyclone, Hexa-Trapper
  "hyy": { name: "Octo Tank", path: "hyy", stats: "0/0/0/9/9/9/9/6", branch: "Flank Guard (H)" },
  "hyu": { name: "Cyclone", path: "hyu", stats: "0/0/0/9/9/9/9/6", branch: "Flank Guard (H)" },
  "hyi": { name: "Hexa-Trapper", path: "hyi", stats: "0/3/2/8/8/9/9/3", branch: "Flank Guard (H)" },
  // Flank Guard(H) -> Tri-Angle(U): Fighter, Booster, Bomber, Auto-Tri-Angle, Surfer, Falcon, Eagle
  "huy": { name: "Fighter", path: "huy", stats: "0/5/0/7/7/9/7/7", branch: "Flank Guard (H)" },
  "huu": { name: "Booster", path: "huu", stats: "0/5/0/7/7/9/7/7", branch: "Flank Guard (H)" },
  "hui": { name: "Bomber", path: "hui", stats: "0/5/0/7/7/9/7/7", branch: "Flank Guard (H)" },
  "huh": { name: "Auto-Tri-Angle", path: "huh", stats: "0/5/0/7/7/9/7/7", branch: "Flank Guard (H)" },
  "huj": { name: "Surfer", path: "huj", stats: "0/5/0/7/7/9/7/7", branch: "Flank Guard (H)" },
  "huk": { name: "Falcon", path: "huk", stats: "0/5/0/7/7/9/7/7", branch: "Flank Guard (H)" },
  // Flank Guard(H) -> Auto-3(I): Auto-5, Mega-3, Auto-4, Banshee
  "hiy": { name: "Auto-5", path: "hiy", stats: "0/3/5/8/8/8/7/3", branch: "Flank Guard (H)" },
  "hiu": { name: "Mega-3", path: "hiu", stats: "0/3/5/8/8/8/7/3", branch: "Flank Guard (H)" },
  "hii": { name: "Auto-4", path: "hii", stats: "0/3/5/8/8/8/7/3", branch: "Flank Guard (H)" },
  "hih": { name: "Banshee", path: "hih", stats: "0/3/5/8/8/8/7/3", branch: "Flank Guard (H)" },
  // Flank Guard(H) -> Trap Guard(H): Gunner Trapper, Bushwhacker, Bomber, Conqueror, Bulwark
  "hhy": { name: "Gunner Trapper (Flank)", path: "hhy", stats: "0/3/2/8/8/9/9/3", branch: "Flank Guard (H)" },
  "hhu": { name: "Bushwhacker", path: "hhu", stats: "0/3/2/8/8/9/9/3", branch: "Flank Guard (H)" },
  // Flank Guard(H) -> Tri-Trapper(J): Septa-Trapper, Hexa-Trapper, Fortress, Architect
  "hjy": { name: "Septa-Trapper", path: "hjy", stats: "0/3/2/8/8/9/9/3", branch: "Flank Guard (H)" },
  "hju": { name: "Hexa-Trapper (Flank)", path: "hju", stats: "0/3/2/8/8/9/9/3", branch: "Flank Guard (H)" },
  "hji": { name: "Fortress (Flank)", path: "hji", stats: "0/3/2/8/8/9/9/3", branch: "Flank Guard (H)" },
  "hjh": { name: "Architect", path: "hjh", stats: "0/3/2/8/8/9/9/3", branch: "Flank Guard (H)" },

  // --- Director Branch (J) ---
  // Director(J) -> Overseer(Y): Overlord, Overtrapper, Overdrive, Auto-Overseer, Overgunner, Banshee, Commander
  "jyy": { name: "Overlord", path: "jyy", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  "jyu": { name: "Overtrapper", path: "jyu", stats: "0/3/5/8/8/9/6/3", branch: "Director (J)" },
  "jyi": { name: "Overdrive", path: "jyi", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  "jyh": { name: "Auto-Overseer", path: "jyh", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  "jyj": { name: "Overgunner", path: "jyj", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  "jyk": { name: "Banshee (Director)", path: "jyk", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  // Director(J) -> Cruiser(U): Battleship, Fortress, Carrier, Auto-Cruiser, Commander
  "juy": { name: "Battleship", path: "juy", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  "juu": { name: "Fortress (Director)", path: "juu", stats: "0/3/2/8/8/9/9/3", branch: "Director (J)" },
  "jui": { name: "Carrier", path: "jui", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  "juh": { name: "Auto-Cruiser", path: "juh", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  // Director(J) -> Underseer(I): Necromancer, Maleficitor
  "jiy": { name: "Necromancer", path: "jiy", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  "jiu": { name: "Maleficitor", path: "jiu", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },
  // Director(J) -> Spawner(H): Factory, Auto-Spawner
  "jhy": { name: "Factory", path: "jhy", stats: "0/3/5/8/8/8/7/3", branch: "Director (J)" },

  // --- Pounder Branch (K) ---
  // Pounder(K) -> Destroyer(Y): Conqueror, Annihilator, Hybrid, Constructor
  "kyy": { name: "Conqueror", path: "kyy", stats: "0/3/2/8/8/9/9/3", branch: "Pounder (K)" },
  "kyu": { name: "Annihilator", path: "kyu", stats: "0/6/9/9/9/9", branch: "Pounder (K)" },
  "kyi": { name: "Hybrid", path: "kyi", stats: "0/3/5/8/8/8/7/3", branch: "Pounder (K)" },
  "kyh": { name: "Constructor (Destroyer)", path: "kyh", stats: "0/3/2/8/8/9/9/3", branch: "Pounder (K)" },
  // Pounder(K) -> Builder(U): Constructor, Auto-Builder, Engineer, Boomer, Architect, Conqueror
  "kuy": { name: "Constructor (Builder)", path: "kuy", stats: "0/3/2/8/8/9/9/3", branch: "Pounder (K)" },
  "kuu": { name: "Auto-Builder", path: "kuu", stats: "0/3/2/8/8/9/9/3", branch: "Pounder (K)" },
  "kui": { name: "Engineer", path: "kui", stats: "0/3/2/8/8/9/9/3", branch: "Pounder (K)" },
  "kuh": { name: "Boomer", path: "kuh", stats: "0/3/2/8/8/9/9/3", branch: "Pounder (K)" },
  // Pounder(K) -> Artillery(I): Mortar, Ordnance, Beekeeper
  "kiy": { name: "Mortar (Pounder)", path: "kiy", stats: "0/0/0/9/9/9/9/6", branch: "Pounder (K)" },
  "kiu": { name: "Ordnance (Pounder)", path: "kiu", stats: "0/0/0/9/9/9/9/6", branch: "Pounder (K)" },
  "kii": { name: "Beekeeper (Pounder)", path: "kii", stats: "0/3/5/8/8/8/7/3", branch: "Pounder (K)" },
  // Pounder(K) -> Launcher(H): Skimmer, Twister, Swarmer, Sidewinder, Field Gun
  "khy": { name: "Skimmer", path: "khy", stats: "0/3/5/8/8/8/7/3", branch: "Pounder (K)" },
  "khu": { name: "Twister", path: "khu", stats: "0/3/5/8/8/8/7/3", branch: "Pounder (K)" },
  "khi": { name: "Swarmer", path: "khi", stats: "0/3/5/8/8/8/7/3", branch: "Pounder (K)" },
  "khh": { name: "Sidewinder", path: "khh", stats: "0/0/0/9/9/9/9/6", branch: "Pounder (K)" },
  "khj": { name: "Field Gun", path: "khj", stats: "0/0/0/9/9/9/9/6", branch: "Pounder (K)" }

    };

    var selectedTankUpgrade = "huu"; // Default to Booster

    // =========================================================================
    // [SECTION: MOVEMENT-CFG] Movement Configuration
    //
    // ROAMING SETTINGS:
    //   CENTER_BIAS_STRENGTH  - How strongly bot drifts toward map center (0 = none)
    //   ROAM_BIAS_MULTIPLIER  - Roam radius multiplier (adjustable via GUI slider)
    //   ROAM_RADIUS_MIN       - Min distance from roam center before turning back
    //   ROAM_RADIUS_MAX       - Max distance before forced return
    //   LEADER_SAFE_DISTANCE  - Min distance followers keep from leader
    //
    // DIRECTION TIMING:
    //   DIRECTION_HOLD_TIME_MIN/MAX - How long (ms) bot holds one direction
    //   DIRECTION_CHANGE_CHANCE     - Random chance to switch direction each tick
    // =========================================================================
    var CENTER_BIAS_STRENGTH = 0.;
    var ROAM_BIAS_MULTIPLIER = 0.3;
    var summonTarget = null;
    var ROAM_RADIUS_MIN = 1.5;
    var ROAM_RADIUS_MAX = 1.5;
    var LEADER_SAFE_DISTANCE = 1;
    var roamCenter = null;
    var roamReached = false;

    // Fluid movement settings
    var DIRECTION_HOLD_TIME_MIN = 250;
    var DIRECTION_HOLD_TIME_MAX = 500;
    var currentDirHoldUntil = 0;
    var DIRECTION_CHANGE_CHANCE = 0.05;

    function doSummon(x, y) {
        if (isLeader) return;
        summonTarget = { x: x, y: y };
        roamCenter = null;
        roamReached = false;
        wallAvoidanceMode = false;
        if (!movementEnabled) {
            movementEnabled = true;
            updateGUI();
        }
        setStatus("Summoned to (" + x.toFixed(1) + ", " + y.toFixed(1) + ")");
    }

    function cancelSummon() {
        summonTarget = null;
        roamCenter = null;
        roamReached = false;
        wallAvoidanceMode = false;
        setStatus("Moving");
    }

    // =========================================================================
    // [SECTION: DEATH-DETECT] Death Detection & Auto-Respawn
    // Monitors canvas text for "respawn" to detect when tank has died.
    // If autoRespawnEnabled is true, automatically presses Enter to respawn
    // and triggers the build sequence to re-upgrade the tank.
    // =========================================================================
    function waitForProto(cb) {
        var check = function() {
            var proto = CanvasRenderingContext2D.prototype;
            if (proto) cb(proto);
            else setTimeout(check, 0);
        };
        check();
    }

    waitForProto(function(proto) {
        var origFillText = proto.fillText;
        var origStrokeText = proto.strokeText;
        proto.fillText = function () {
            checkCanvasTextForDeath(arguments[0]);
            return origFillText.apply(this, arguments);
        };
        proto.strokeText = function () {
            checkCanvasTextForDeath(arguments[0]);
            return origStrokeText.apply(this, arguments);
        };
    });

    function checkCanvasTextForDeath(text) {
        if (typeof text !== "string") return;
        lastCanvasActivity = Date.now();
        if (text.toLowerCase().trim() === "respawn" && !isDead) {
            if (!autoRespawnEnabled) return;
            isDead = true;
            deathCount++;
            setStatus("Dead -- respawning...");
            buildSequenceRunning = true;
            releaseAllMovement();
            currentDir = null;

            setTimeout(function() {
                pressEnter();
            }, 10);

            setTimeout(function() {
                respawnCount++;
                setStatus("Running build sequence...");
                runBuildSequence(); // Only build call — pressEnter no longer triggers one
            }, 1000);
            // isDead stays true until build sequence completes (set false in runBuildSequence)
            // Old value of 500ms caused re-detection of "respawn" text before build finished
        }
    }

    // =========================================================================
    // [SECTION: BUILD-SEQ] Post-Respawn Build Sequence
    // Runs after spawning/respawning to upgrade to the selected tank.
    // Steps: 1) Press E to open upgrades 2) Press path keys 3) Hold M + digit keys for stats
    // =========================================================================
    async function runBuildSequence() {
        buildSequenceRunning = true;
        releaseAllMovement();
        currentDir = null;

        var upgrade = tankUpgrades[selectedTankUpgrade];
        if (!upgrade) {
            console.log("[AFK Bot] No upgrade selected, skipping build sequence");
            buildSequenceRunning = false;
            return;
        }

        console.log("[AFK Bot] Running build for: " + upgrade.name);

        // Upgrade to tank using the path (keys are queued by the game)
        // Generous delays between keys to avoid the game missing inputs
        for (var pi = 0; pi < upgrade.path.length; pi++) {
            var pathKey = upgrade.path[pi].toUpperCase();
            await tapKey("Key" + pathKey, pathKey.toLowerCase()); await delay(150);
        }

        // Apply stat distribution
        await delay(300);
        simulateKey("KeyM", "m", true);
        await delay(100);

        var statParts = upgrade.stats.split("/");
        for (var si = 0; si < statParts.length; si++) {
            var statNum = parseInt(statParts[si]) || 0;
            var digitKey = ((si % 8) + 1);
            for (var s = 0; s < statNum; s++) {
                await tapKey("Digit" + digitKey, ""); await delay(40);
            }
        }

        simulateKey("KeyM", "m", false);

        await delay(100);

        buildSequenceRunning = false;
        isDead = false; // Safe to reset now — build is done, won't re-trigger death handler
        if (movementEnabled) {
            setStatus(isLeader ? "LEADER — alts follow me" : "Moving");
        } else {
            setStatus("Idle (respawn active)");
        }

        // AI Chatbot: no auto-chat on spawn — only responds when others chat
    }

    // =========================================================================
    // [SECTION: AI-CHATBOT] AI Chatbot (Google Gemini)
    // Reads in-game chat messages and responds using Google Gemini API.
    // Stays silent if the API is unreachable or rate-limited.
    //
    // HOW TO SET UP:
    //   1. Get a free Gemini API key: https://aistudio.google.com/app/apikey
    //   2. Open the bot panel (ESC)
    //   3. Paste the API key in the field and toggle on
    //
    // HOW TO CUSTOMIZE:
    //   - Change the personality prompt in the GUI text field
    //   - Adjust CHATBOT_COOLDOWN to change how often it talks (ms)
    //   - Adjust CHATBOT_MAX_LENGTH for message length limit
    // =========================================================================
    var chatbotEnabled = (localStorage.getItem("arras-afk-chatbot-enabled") === "1");
    var geminiApiKey = localStorage.getItem("arras-afk-gemini-key") || "";
    var chatbotPersonality = localStorage.getItem("arras-afk-chatbot-personality") ||
        "You are a chill arras.io tank player. Keep responses under 60 characters. Be casual and natural, like a real player. No excessive slang. Never use profanity.";
    var geminiRateLimitUntil = 0;  // Timestamp when rate limit expires
    var CHATBOT_COOLDOWN = 5000;   // Min ms between chat messages (5 seconds)
    var CHATBOT_MAX_LENGTH = 180;  // Max characters per AI response (split into 60-char game messages, up to 3)
    var GAME_CHAT_LIMIT = 60;        // Game's per-message character limit
    var CHATBOT_TRIGGERS = ["fried bot", "clanker", "bot", "fried", "robot", "ai"]; // Bot responds to these keywords
    // Context clues: patterns that suggest someone is talking TO the bot
    // These trigger a response even without the bot's exact name
    var CHATBOT_CONTEXT_PATTERNS = [
        /are you (a |the )?bot/i,           // "are you a bot?"
        /are you real/i,                     // "are you real?"
        /you (a |the )?bot/i,               // "you a bot"
        /say something/i,                    // "say something"
        /can you (talk|speak|chat|type)/i,  // "can you talk?"
        /hello\?/i,                          // "hello?"
        /anyone there/i,                     // "anyone there?"
        /you alive/i,                        // "you alive?"
        /stop (moving|spinning|shooting)/i, // "stop moving"
        /hey (you|tank|dude|bro)/i,         // "hey you", "hey tank"
        /yo (you|tank)/i,                    // "yo tank"
        /what are you/i,                     // "what are you"
        /prove.*(not|you).*(bot|human)/i,   // "prove you're not a bot"
        /talk to me/i,                       // "talk to me"
        /respond/i,                          // "respond"
        /answer me/i                         // "answer me"
    ];
    var inConversation = false; // True when bot is actively chatting with someone
    var conversationPartner = null; // Name of the player we're chatting with
    var conversationTimeout = null; // Timer to end conversation after inactivity
    var chatDetectionReady = false; // False until startup delay passes
    var scriptLoadTime = Date.now(); // When the script loaded
    var lastBotChatTime = 0; // Track when bot last chatted (for reply detection)
    var lastChatTime = 0;
    var overrideRespondTo = localStorage.getItem("arras-afk-override-name") || ""; // Manual override: always respond to this player
    var followPlayerName = localStorage.getItem("arras-afk-follow-player") || ""; // Follow this player
    var followPlayerPos = null; // { x, y, time } - last known screen position of followed player
    var followLastSeenGrid = null; // { x, y } - game-world position estimate when player was last seen
    var followRoaming = false; // True when player left FOV, bot is roaming around last known position
    var followMouseEnabled = false; // Toggle: bot moves toward mouse cursor
    var mouseScreenX = 0; // Current mouse position on screen
    var mouseScreenY = 0;
    var mouseWorldLogTime = 0; // Throttle debug logging
    var recentTextPositions = []; // Track {text, x, y, time} for position-based name matching
    var detectedChatMessages = []; // Chat messages seen on canvas
    var lastDetectedChats = {};    // Dedup: text -> timestamp
    var ownSentMessages = {};      // Bot's own messages: text -> timestamp (ignore for 10s)

    // Local phrase bank — not currently used as fallback (bot stays silent on AI failure)
    var CHAT_PHRASES = {
        spawn: ["here we go", "back again", "round 2", "lets go", "im back", "ready up", "alright", "back for more"],
        death: ["oof", "gg", "ill be back", "not bad", "nice shot", "well played", "fair enough", "unlucky"],
        respond: ["lol", "good question", "hmm idk", "thats a tough one", "maybe", "haha nice", "good point", "honestly not sure", "fair enough", "interesting", "wait what", "lmao", "hold on", "you tell me"]
    };

    // Known non-chat text patterns to filter out
    var CHAT_IGNORE_PATTERNS = [
        /^coordinates:/i, /^score:/i, /^level\s/i, /^\d+$/, /^\d+\.\d+$/,
        /^play$/i, /^respawn$/i, /^disconnect/i, /^connecting/i,
        /^press/i, /^use\s/i, /^auto/i, /^game\sover/i, /^you\s/i,
        /^\(.*\)$/, /^[A-Z]{1,3}$/, /^[\d\s\/\.\,\-\+]+$/,
        /^arena\s/i, /^ffa$/i, /^maze$/i, /^teams?$/i, /^sandbox$/i,
        // Player name labels: "Name - Class: Score" or "Name - Class: 123.4k/m/b"
        /\s-\s.+:\s*[\d\.]+[kmbt]?$/i,
        // Player name with brackets like [φ [phi]] or [TAG]
        /\[.+\]/,
        // Game debug/stats overlays
        /\d+\s*FPS/i,                          // "59 FPS / 0.3 mspt"
        /\d+\.\d+\s*ms/i,                      // "104.6 ms wsi-kci-z #cpd"
        /mspt/i,                                // milliseconds per tick
        /^Rendering:/i,                         // "Rendering: o=440 z=288 t=0:0 h"
        /wsi-|kci-|#cpd/i,                      // network debug tokens
        /[oz]=\d+/i,                            // "o=440 z=288" render params
        /t=\d+:\d+/i,                           // "t=0:0" time debug
        /\d+\s*ms\s/i,                          // any "123 ms" pattern
        // Scores and numbers
        /^\d[\d,\.]*[kmbt]?$/i,                // pure score values: "64.01k", "1,234"
        /^\d+\/\d+/,                            // fractions: "3/5", "10/10"
        // Upgrade tank names (single capitalized words or short phrases)
        /^(Booster|Fighter|Overlord|Necromancer|Factory|Spike|Auto|Smasher|Landmine|Stalker|Ranger|Predator|Streamliner|Sprayer|Triplet|Penta|Spread|Octo|Battleship|Annihilator|Hybrid|Skimmer|Rocketeer|Manager|Destroyer|Gunner|Hunter|Twin|Sniper|Machine|Flank|Tri-?Angle|Assassin|Trapper|Basic|Pounder|Launcher|Constructor|Artillery|Mortar|Director|Overseer|Spawner|Cruiser|Carrier|Drone|Swarm|Hexa|Mega|Mini|Commander|Maleficitor|Conqueror|Redistributor|Ordnance|Bastion|Bulwark|Ception|Banshee|Falcon|Viper|Eagle|Vulture|Phoenix|Haven|Minotaur|Behemoth|Juggernaut|Titan|Colossus)$/i,
        // Stat upgrade labels
        /^(Health Regen|Max Health|Body Damage|Bullet Speed|Bullet Penetration|Bullet Damage|Reload|Movement Speed|Shield Regen|Shield Capacity|FOV|Drone Speed|Drone Health|Drone Penetration|Drone Damage|Drone Count|Respawn Rate)$/i,
        // Single/two word game UI labels (upgrades, menus, buttons)
        /^(Upgrade|Upgrades|Stats|Score|Class|Tank|Tanks|Max|Health|Damage|Speed|Reload|Regen|Shield|Penetration|Capacity|Bullet|Drone|Body|Movement|FOV|Level Up)$/i,
        // Text that's just 1-2 words with first letter capitalized (likely UI label not chat)
        /^[A-Z][a-z]+$/,
        // Broadcast/announcement patterns
        /^\[.*\]$/,                             // "[Server Message]"
        /has (joined|left|been)/i,              // "X has joined"
        /^server/i,                             // server messages
        /^wave\s/i,                             // "Wave 5"
        /^round\s/i,                            // "Round 3"
        /killed by|destroyed|eliminated/i,      // kill feed
        /^\w+\s(is|was|has)\s/,                 // status messages
        // Speed/debug values
        /^speed:/i, /^velocity:/i, /^ping:/i, /^latency:/i,
        /^\d+\.\d+x$/,                          // multiplier values: "1.5x"
        /^[+-]?\d+\.?\d*\s*[°%]/                // angles/percentages
    ];

    // Frequency tracker: tracks how often each text renders per second.
    // Player names render EVERY frame (~60/sec), chat bubbles render briefly then stop.
    // If text appears more than 10 times in 1 second, it's a name, not chat.
    var textFrequency = {};   // text -> { count, firstSeen, lastSeen }
    var knownNames = {};      // text -> true (permanently flagged as name after repeated detection)

    function trackTextFrequency(text) {
        var now = Date.now();
        if (!textFrequency[text]) {
            textFrequency[text] = { count: 1, firstSeen: now, lastSeen: now };
        } else {
            textFrequency[text].count++;
            textFrequency[text].lastSeen = now;
        }
        // If seen 3+ times, it's definitely NOT chat (names/UI render every frame)
        var entry = textFrequency[text];
        if (entry.count >= 3) {
            knownNames[text] = true;
        }
        // Clean old entries every 5 seconds
        if (now % 5000 < 50) {
            for (var key in textFrequency) {
                if (now - textFrequency[key].lastSeen > 3000) delete textFrequency[key];
            }
        }
    }

    // Detect chat messages from canvas text
    // Chat bubbles are short text strings that don't match game UI patterns
    // and don't render every frame like player names do
    function isChatMessage(text) {
        if (!text || text.length < 2 || text.length > 60) return false;
        // Skip bot's own messages (ignore for 10 seconds after sending)
        if (ownSentMessages[text] && Date.now() - ownSentMessages[text] < 10000) return false;
        // Skip known player names (rendered every frame)
        if (knownNames[text]) return false;
        for (var i = 0; i < CHAT_IGNORE_PATTERNS.length; i++) {
            if (CHAT_IGNORE_PATTERNS[i].test(text)) return false;
        }
        // Must contain at least one letter and look like human text
        if (!/[a-zA-Z]/.test(text)) return false;
        // Reject if it's mostly numbers/symbols (debug data)
        var letters = (text.match(/[a-zA-Z]/g) || []).length;
        if (letters < text.length * 0.3) return false;
        // Chat only renders once per appearance — anything seen 2+ times is NOT chat
        if (textFrequency[text] && textFrequency[text].count >= 2) return false;
        return true;
    }

    // Find the player name nearest to a chat bubble position
    // Chat renders above the player name, so we look for known names at similar X but lower Y
    function findSpeaker(chatX, chatY) {
        var now = Date.now();
        var bestName = null;
        var bestDist = 999999;
        for (var i = recentTextPositions.length - 1; i >= 0; i--) {
            var entry = recentTextPositions[i];
            if (now - entry.time > 500) break; // Only look at very recent renders
            // Check if this text is a known name (renders every frame)
            if (!knownNames[entry.text]) continue;
            // Name should be at similar X (within 100px) and below the chat (higher Y value)
            var dx = Math.abs(entry.x - chatX);
            var dy = entry.y - chatY; // positive = name is below chat
            if (dx < 100 && dy > 0 && dy < 200) {
                var dist = dx + dy;
                if (dist < bestDist) {
                    bestDist = dist;
                    // Extract just the player name (strip " - Class: Score" suffix)
                    var name = entry.text.replace(/\s-\s.+:\s*[\d\.]+[kmbt]?$/i, "").trim();
                    if (name.length > 0) bestName = name;
                }
            }
        }
        return bestName;
    }

    function onChatDetected(text, chatX, chatY) {
        var now = Date.now();
        // Ignore everything for the first 3 seconds after script loads
        if (!chatDetectionReady) {
            if (now - scriptLoadTime < 5000) return;
            chatDetectionReady = true;
            console.log("[AFK Bot] Chat detection ready (5s startup delay passed)");
        }
        // Dedup: same text within 5 seconds is a re-render
        if (lastDetectedChats[text] && now - lastDetectedChats[text] < 5000) return;
        lastDetectedChats[text] = now;

        // Clean old dedup entries
        for (var key in lastDetectedChats) {
            if (now - lastDetectedChats[key] > 10000) delete lastDetectedChats[key];
        }

        // DELAY response by 200ms — gives time for frequency tracker to flag names/debug
        // Real chat appears once or twice; names/debug repeat many times per second
        setTimeout(function() {
            if (knownNames[text]) {
                return; // silently skip known names
            }
            // After 500ms, anything seen 3+ times is NOT chat
            if (textFrequency[text] && textFrequency[text].count >= 3) {
                knownNames[text] = true;
                return; // silently skip repeated text
            }

            // Try to identify who said this
            var speaker = findSpeaker(chatX, chatY);
            console.log("[AFK Bot] Chat confirmed: " + text + (speaker ? " (from: " + speaker + ")" : " (unknown speaker)"));
            detectedChatMessages.push({ text: text, time: now, speaker: speaker });
            if (detectedChatMessages.length > 10) detectedChatMessages.shift();

            // Check if message triggers a response via keywords, context, or reply
            var lowerMsg = text.toLowerCase();
            var triggered = false;
            var triggerReason = "";

            // 1. Direct keyword triggers
            for (var ti = 0; ti < CHATBOT_TRIGGERS.length; ti++) {
                if (lowerMsg.indexOf(CHATBOT_TRIGGERS[ti]) !== -1) {
                    triggered = true;
                    triggerReason = "keyword: " + CHATBOT_TRIGGERS[ti];
                    break;
                }
            }

            // 2. Context clue patterns (someone talking TO the bot)
            if (!triggered) {
                for (var ci = 0; ci < CHATBOT_CONTEXT_PATTERNS.length; ci++) {
                    if (CHATBOT_CONTEXT_PATTERNS[ci].test(text)) {
                        triggered = true;
                        triggerReason = "context: " + CHATBOT_CONTEXT_PATTERNS[ci].source;
                        break;
                    }
                }
            }

            // 3. Conversation mode: only respond to the SAME identified person
            if (!triggered && inConversation && conversationPartner && speaker) {
                if (speaker === conversationPartner) {
                    triggered = true;
                    triggerReason = "in conversation with " + conversationPartner;
                }
            }

            // 3b. Manual override: always respond to this player
            if (!triggered && overrideRespondTo && speaker && speaker.toLowerCase() === overrideRespondTo.toLowerCase()) {
                triggered = true;
                triggerReason = "override: " + overrideRespondTo;
            }

            // 4. Reply detection: only if we know who spoke and they're the same conversation partner
            if (!triggered && lastBotChatTime > 0 && (Date.now() - lastBotChatTime < 15000) && speaker && conversationPartner && speaker === conversationPartner) {
                triggered = true;
                triggerReason = "reply from " + speaker;
            }

            if (triggered && chatbotEnabled && Date.now() - lastChatTime > CHATBOT_COOLDOWN) {
                // Respond right away and enter conversation mode
                inConversation = true;
                if (speaker) {
                    conversationPartner = speaker;
                } else if (!conversationPartner) {
                    // Don't start conversations with unknown speakers
                    // (unless triggered by keyword/context which is intentional)
                }
                // Reset conversation timeout — end conversation after 25s of no chat
                if (conversationTimeout) clearTimeout(conversationTimeout);
                conversationTimeout = setTimeout(function() {
                    inConversation = false;
                    conversationPartner = null;
                    console.log("[AFK Bot] Conversation ended (25s no chat)");
                }, 25000);
                console.log("[AFK Bot] Responding (" + triggerReason + ")");
                respondToChat(text);
            }
        }, 200);
    }

    // Send a chat message in-game by simulating keypresses
    var isChatSending = false; // Flag to pause movement during chat
    async function sendGameChat(message) {
        if (!message || buildSequenceRunning || isChatSending) return;
        message = message.substring(0, CHATBOT_MAX_LENGTH);

        // Split into chunks of GAME_CHAT_LIMIT (60 chars), breaking at word boundaries
        var chunks = [];
        while (message.length > 0) {
            if (message.length <= GAME_CHAT_LIMIT) {
                chunks.push(message);
                break;
            }
            // Find last space within the limit to break at a word
            var breakAt = message.lastIndexOf(" ", GAME_CHAT_LIMIT);
            if (breakAt < 20) breakAt = GAME_CHAT_LIMIT; // No good break point, hard cut
            chunks.push(message.substring(0, breakAt).trim());
            message = message.substring(breakAt).trim();
        }

        // Send each chunk as a separate game chat message
        for (var ci = 0; ci < chunks.length; ci++) {
            await sendSingleChat(chunks[ci]);
            if (ci < chunks.length - 1) await delay(800); // Brief pause between parts
        }
    }

    async function sendSingleChat(message) {
        if (!message || buildSequenceRunning || isChatSending) return;
        message = message.substring(0, GAME_CHAT_LIMIT);
        lastChatTime = Date.now();
        isChatSending = true;
        blockAllKeys = true; // Block ALL simulateKey dispatches (movement, etc.)

        console.log("[AFK Bot] Sending chat: " + message);

        // Store own message so we don't respond to our own chat bubble
        ownSentMessages[message] = Date.now();
        lastBotChatTime = Date.now(); // Track for reply detection
        // Clean old entries
        for (var key in ownSentMessages) {
            if (Date.now() - ownSentMessages[key] > 15000) delete ownSentMessages[key];
        }

        // Release all held movement keys before we block
        releaseAllMovement();
        await delay(200);

        // Temporarily unblock for Enter press, then re-block
        blockAllKeys = false;
        await tapKey("Enter", "Enter", 50);
        blockAllKeys = true;
        await delay(400);

        // Find the chat input element the game creates (body > input[type="text"])
        var chatInput = document.querySelector("body > input[type='text']");
        if (!chatInput) {
            // Sometimes it takes a moment to appear
            await delay(200);
            chatInput = document.querySelector("body > input[type='text']");
        }

        if (chatInput) {
            // Direct value injection into the DOM input
            chatInput.focus();
            chatInput.value = message;
            chatInput.dispatchEvent(new Event("input", { bubbles: true }));
            await delay(150);

            // Press Enter on the input to send (dispatch directly to the input)
            var enterDown = new KeyboardEvent("keydown", {
                key: "Enter", code: "Enter", keyCode: 13, which: 13,
                bubbles: true, cancelable: true
            });
            var enterUp = new KeyboardEvent("keyup", {
                key: "Enter", code: "Enter", keyCode: 13, which: 13,
                bubbles: true, cancelable: true
            });
            chatInput.dispatchEvent(enterDown);
            chatInput.dispatchEvent(enterUp);
            await delay(200);
        } else {
            // Fallback: type via window keypresses if input not found
            console.log("[AFK Bot] Chat input not found, trying keyboard fallback");
            for (var i = 0; i < message.length; i++) {
                var ch = message[i];
                var keyCode = ch.charCodeAt(0);
                window.dispatchEvent(new KeyboardEvent("keydown", {
                    key: ch, code: "Key" + ch.toUpperCase(), keyCode: keyCode,
                    bubbles: true, cancelable: true
                }));
                window.dispatchEvent(new KeyboardEvent("keyup", {
                    key: ch, code: "Key" + ch.toUpperCase(), keyCode: keyCode,
                    bubbles: true, cancelable: true
                }));
                await delay(30);
            }
            await delay(150);
            blockAllKeys = false;
            await tapKey("Enter", "Enter", 50);
            blockAllKeys = true;
            await delay(200);
        }

        blockAllKeys = false;
        isChatSending = false;
    }

    // Call Google Gemini API
    async function callGemini(prompt) {
        if (!geminiApiKey) {
            console.log("[AFK Bot] No Gemini API key set");
            return null;
        }
        // Skip if rate-limited (wait 60 seconds after a 429)
        if (Date.now() < geminiRateLimitUntil) {
            console.log("[AFK Bot] Rate-limited, waiting " + Math.ceil((geminiRateLimitUntil - Date.now()) / 1000) + "s");
            return null;
        }
        try {
            var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=" + geminiApiKey;
            console.log("[AFK Bot] Calling Gemini...");
            var controller = new AbortController();
            var timeoutId = setTimeout(function() { controller.abort(); }, 15000);
            var response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 60, temperature: 0.9 }
                })
            });
            clearTimeout(timeoutId);
            if (response.status === 429) {
                console.log("[AFK Bot] Gemini rate limited! Pausing for 60s");
                geminiRateLimitUntil = Date.now() + 60000;
                return null;
            }
            if (response.ok) {
                var data = await response.json();
                var text = "";
                if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                    text = data.candidates[0].content.parts[0].text || "";
                }
                text = text.trim().replace(/[\n\r"]/g, " ").replace(/\*\*/g, "").trim();
                console.log("[AFK Bot] Gemini raw: " + text.substring(0, 100));
                if (text.length < 2 || text.length > 200) return null;
                // Take first sentence if too long
                var firstLine = text.split(/[.!?]\s/)[0];
                if (firstLine.length > CHATBOT_MAX_LENGTH) firstLine = firstLine.substring(0, CHATBOT_MAX_LENGTH);
                if (firstLine.length < 2) return null;
                console.log("[AFK Bot] Gemini reply: " + firstLine);
                return firstLine;
            } else {
                var errText = await response.text();
                console.log("[AFK Bot] Gemini status " + response.status + ": " + errText.substring(0, 100));
            }
        } catch (e) {
            console.log("[AFK Bot] Gemini error: " + (e.name === "AbortError" ? "timed out 15s" : e.message));
        }
        return null;
    }

    // Get a random phrase from the local phrase bank (fallback)
    function getLocalPhrase(category) {
        var phrases = CHAT_PHRASES[category] || CHAT_PHRASES.respond;
        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    // Blocked words/phrases — response gets silently dropped if it contains any of these
    var BLOCKED_RESPONSE_WORDS = [
        "crack me", "crack you", "breed", "moan", "daddy", "mommy",
        "sexy", "horny", "fuck", "shit", "dick", "cock", "pussy",
        "cum", "orgasm", "naked", "nude", "undress", "strip",
        "suck", "blow me", "touch me", "kiss me", "lick",
        "sex", "porn", "nsfw", "boner", "erect",
        "ass", "boob", "tit", "slut", "whore"
    ];

    function isResponseAppropriate(text) {
        var lower = text.toLowerCase();
        for (var i = 0; i < BLOCKED_RESPONSE_WORDS.length; i++) {
            if (lower.indexOf(BLOCKED_RESPONSE_WORDS[i]) !== -1) {
                console.log("[AFK Bot] Blocked inappropriate response: " + text);
                return false;
            }
        }
        return true;
    }

    // Get AI response — tries Gemini, stays silent if it fails or is inappropriate
    async function getAIResponse(prompt) {
        var reply = await callGemini(prompt);
        if (reply && reply.length > 1 && reply.length <= CHATBOT_MAX_LENGTH + 10) {
            if (!isResponseAppropriate(reply)) return null;
            return reply;
        }
        console.log("[AFK Bot] AI failed, staying silent");
        return null;
    }

    // Respond to a detected chat message
    async function respondToChat(incomingText) {
        if (!chatbotEnabled) return;
        // Lock cooldown immediately so no second message can start while API is loading
        lastChatTime = Date.now();
        var prompt = "You're a bot in arras.io. Chat: \"" + incomingText + "\" Reply under 180 chars. Engage with what they said. No slang. Keep it PG. Just the reply.";
        var reply = await getAIResponse(prompt, "respond");
        if (reply) {
            await sendGameChat(reply);
        }
    }

    // Generate a contextual message for game events
    async function chatOnEvent(eventType) {
        if (!chatbotEnabled) return;
        var now = Date.now();
        if (now - lastChatTime < CHATBOT_COOLDOWN) return;
        // Lock cooldown immediately so no second message can start while API is loading
        lastChatTime = now;

        var tankName = tankUpgrades[selectedTankUpgrade] ? tankUpgrades[selectedTankUpgrade].name : "Basic";
        var fallbackCategory = eventType.includes("died") || eventType.includes("death") ? "death" : "spawn";
        var prompt = chatbotPersonality + "\n\n" +
            "You are playing arras.io as a " + tankName + " tank. " +
            "Event: " + eventType + ". " +
            "Send a short chat message (under " + CHATBOT_MAX_LENGTH + " characters). " +
            "Just the message text, no quotes, no explanation.";
        var reply = await getAIResponse(prompt, fallbackCategory);
        if (reply) {
            await sendGameChat(reply);
        }
    }

    // =========================================================================
    // [SECTION: MOVEMENT] Movement Directions & Fluid Movement Loop
    // 8-direction movement using WASD keys. The bot picks a direction,
    // holds it for a random time, then picks a new one.
    // DIRECTIONS array maps key combos to direction vectors.
    // =========================================================================
    var DIRECTIONS = [
        { keys: ["KeyW"],          dx:  0, dy: -1, name: "N"  },
        { keys: ["KeyS"],          dx:  0, dy:  1, name: "S"  },
        { keys: ["KeyA"],          dx: -1, dy:  0, name: "W"  },
        { keys: ["KeyD"],          dx:  1, dy:  0, name: "E"  },
        { keys: ["KeyW", "KeyA"],  dx: -1, dy: -1, name: "NW" },
        { keys: ["KeyW", "KeyD"],  dx:  1, dy: -1, name: "NE" },
        { keys: ["KeyS", "KeyA"],  dx: -1, dy:  1, name: "SW" },
        { keys: ["KeyS", "KeyD"],  dx:  1, dy:  1, name: "SE" },
    ];

    var DIR_VECTORS = DIRECTIONS.map(function(d) {
        var len = Math.hypot(d.dx, d.dy);
        return { dx: d.dx / len, dy: d.dy / len };
    });

    var KEY_NAMES = { "KeyW": "w", "KeyA": "a", "KeyS": "s", "KeyD": "d", "Backquote": "`" };
    var AIM_DISTANCE = 200;
    var currentDir = null;
    var currentDirIndex = -1;

    function setAimTarget(dx, dy) {
        var canvas = getCanvas();
        if (!canvas) return;
        var rect = canvas.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top  + rect.height / 2;
        // Scale aim distance to canvas size so it works in small iframes too
        var aimDist = Math.min(AIM_DISTANCE, Math.min(rect.width, rect.height) * 0.4);
        var len = Math.hypot(dx, dy) || 1;
        targetMouseX = cx + (dx / len) * aimDist;
        targetMouseY = cy + (dy / len) * aimDist;
    }

    // =========================================================================
    // [SECTION: MOVEMENT-LOGIC] Smart Direction Picker (Fluid + Wall-Aware)
    // pickBiasedDirection() - chooses best direction considering:
    //   summon target, roam center, leader position, wall memory
    // =========================================================================
    function getTargetDirection() {
        var targetX = 0;
        var targetY = 0;

        if (summonTarget && !roamReached) {
            targetX = summonTarget.x;
            targetY = summonTarget.y;
        } else if (roamCenter) {
            targetX = roamCenter.x;
            targetY = roamCenter.y;
        }

        var toTargetX = targetX - grid.x;
        var toTargetY = targetY - grid.y;
        var distToTarget = Math.hypot(toTargetX, toTargetY);

        if (distToTarget < 0.5) return null;

        return {
            x: toTargetX / distToTarget,
            y: toTargetY / distToTarget,
            dist: distToTarget
        };
    }

    function pickDirectionIndex(preferredDx, preferredDy, excludeIndices) {
        excludeIndices = excludeIndices || [];

        var bestIndex = -1;
        var bestScore = -999;

        for (var i = 0; i < DIRECTIONS.length; i++) {
            if (excludeIndices.indexOf(i) !== -1) continue;

            var dir = DIR_VECTORS[i];
            var dot = dir.dx * preferredDx + dir.dy * preferredDy;

            var wallKey = DIRECTIONS[i].name;
            if (wallMemory[wallKey] && Date.now() - wallMemory[wallKey].time < 10000) {
                dot -= 2.0;
            }

            dot += (Math.random() - 0.5) * 0.3;

            if (dot > bestScore) {
                bestScore = dot;
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    function getPerpendicularDirections(dirIndex) {
        var perpendiculars = {
            0: [2, 3], 1: [2, 3], 2: [0, 1], 3: [0, 1],
            4: [3, 1], 5: [2, 1], 6: [3, 0], 7: [2, 0],
        };
        return perpendiculars[dirIndex] || [0, 1];
    }

    function pickBiasedDirection() {
        // Follow mouse mode — move toward mouse cursor using camera transform
        if (followMouseEnabled) {
            var canvas = getCanvas();
            if (canvas) {
                var rect = canvas.getBoundingClientRect();
                // Convert mouse screen position to canvas pixel position
                var canvasX = (mouseScreenX - rect.left) * (canvas.width / rect.width);
                var canvasY = (mouseScreenY - rect.top) * (canvas.height / rect.height);
                // Convert canvas pixel position to game world coordinates
                var mouseWorld = screenToWorld(canvasX, canvasY);
                // Direction from bot's position to mouse world position
                var mwdx = mouseWorld.x - grid.x;
                var mwdy = mouseWorld.y - grid.y;
                var mwDist = Math.hypot(mwdx, mwdy);
                // Debug: log mouse world position periodically
                if (!mouseWorldLogTime || Date.now() - mouseWorldLogTime > 2000) {
                    mouseWorldLogTime = Date.now();
                    console.log("[AFK Bot] Mouse world: (" + mouseWorld.x.toFixed(1) + "," + mouseWorld.y.toFixed(1) + ") bot: (" + grid.x.toFixed(1) + "," + grid.y.toFixed(1) + ") zoom:" + cameraTransform.a.toFixed(2));
                }
                if (mwDist > 2) {
                    return pickDirectionIndex(mwdx / mwDist, mwdy / mwDist);
                }
            }
        }

        // Follow player mode
        if (followPlayerName && followPlayerPos) {
            var timeSinceSeen = Date.now() - followPlayerPos.time;

            // Player is visible — use the pre-calculated direction from screen center
            if (timeSinceSeen < 1000 && followPlayerPos.dirX !== undefined) {
                if (followPlayerPos.screenDist > 80) {
                    return pickDirectionIndex(followPlayerPos.dirX, followPlayerPos.dirY);
                }
            }
            // Player left FOV — roam toward their last known game-world position
            else if (followLastSeenGrid && timeSinceSeen < 30000) {
                followRoaming = true;
                var toLastX = followLastSeenGrid.x - grid.x;
                var toLastY = followLastSeenGrid.y - grid.y;
                var distToLast = Math.hypot(toLastX, toLastY);
                if (distToLast > 1) {
                    return pickDirectionIndex(toLastX / distToLast, toLastY / distToLast);
                }
                return Math.floor(Math.random() * DIRECTIONS.length);
            }
        }

        var targetDir = getTargetDirection();

        if (wallAvoidanceMode) {
            var now = Date.now();
            if (now - wallAvoidanceStartTime > WALL_AVOIDANCE_TIMEOUT) {
                wallAvoidanceMode = false;
                wallAvoidanceDir = null;
            } else if (wallAvoidanceDir !== null) {
                return wallAvoidanceDir;
            }
        }

        if (!targetDir) {
            var toCenterX = -grid.x;
            var toCenterY = -grid.y;
            var distToCenter = Math.hypot(toCenterX, toCenterY);
            if (distToCenter > 1) {
                return pickDirectionIndex(toCenterX / distToCenter, toCenterY / distToCenter);
            }
            return Math.floor(Math.random() * DIRECTIONS.length);
        }

        if (roamReached && !isLeader) {
            var leader = getLeaderTab();
            if (leader) {
                var distToLeader = Math.hypot(grid.x - leader.gridX, grid.y - leader.gridY);
                if (distToLeader < LEADER_SAFE_DISTANCE) {
                    var awayX = grid.x - leader.gridX;
                    var awayY = grid.y - leader.gridY;
                    var awayDist = Math.hypot(awayX, awayY) || 1;
                    return pickDirectionIndex(awayX / awayDist, awayY / awayDist);
                }
            }
        }

        if (roamReached && roamCenter) {
            var distFromRoam = targetDir.dist;
            if (distFromRoam < ROAM_RADIUS_MIN) {
                return pickDirectionIndex(-targetDir.x, -targetDir.y);
            } else if (distFromRoam > ROAM_RADIUS_MAX * ROAM_BIAS_MULTIPLIER) {
                return pickDirectionIndex(targetDir.x, targetDir.y);
            } else {
                var perpDirs = [
                    { x: -targetDir.y, y: targetDir.x },
                    { x: targetDir.y, y: -targetDir.x }
                ];
                var chosen = perpDirs[Math.floor(Math.random() * 2)];
                chosen.x = chosen.x * 0.9 + targetDir.x * 0.9;
                chosen.y = chosen.y * 0.9 + targetDir.y * 0.9;
                return pickDirectionIndex(chosen.x, chosen.y);
            }
        }

        return pickDirectionIndex(targetDir.x, targetDir.y);
    }

    // =========================================================================
    // [SECTION: WALL-DETECT] Wall Detection & Avoidance
    // Detects when bot is stuck by checking if position hasn't changed.
    // Picks perpendicular direction to escape walls.
    // =========================================================================
    function checkForWall() {
        if (!currentDir || !coordDetectionDone || !movementEnabled || buildSequenceRunning) return;

        var now = Date.now();
        var timeSinceCheck = now - lastWallCheck.time;

        if (timeSinceCheck >= WALL_CHECK_INTERVAL && lastWallCheck.dir !== null) {
            var distMoved = Math.hypot(grid.x - lastWallCheck.x, grid.y - lastWallCheck.y);

            if (distMoved < WALL_MOVE_THRESHOLD && currentDirIndex === lastWallCheck.dir) {
                var wallKey = DIRECTIONS[currentDirIndex].name;
                wallMemory[wallKey] = { time: now, x: grid.x, y: grid.y };
                console.log("[AFK Bot] Wall detected in direction: " + wallKey);

                wallAvoidanceMode = true;
                wallAvoidanceStartTime = now;

                var perpDirs = getPerpendicularDirections(currentDirIndex);
                var chosenPerp = perpDirs[Math.floor(Math.random() * perpDirs.length)];

                if (wallMemory[DIRECTIONS[chosenPerp].name] &&
                    now - wallMemory[DIRECTIONS[chosenPerp].name].time < 8000) {
                    chosenPerp = perpDirs[0] === chosenPerp ? perpDirs[1] : perpDirs[0];
                }

                wallAvoidanceDir = chosenPerp;
                currentDirHoldUntil = 0;
            } else if (distMoved >= WALL_MOVE_THRESHOLD) {
                if (wallAvoidanceMode) {
                    wallAvoidanceMode = false;
                    wallAvoidanceDir = null;
                }
            }
        }

        lastWallCheck.x = grid.x;
        lastWallCheck.y = grid.y;
        lastWallCheck.time = now;
        lastWallCheck.dir = currentDirIndex;
    }

    // =========================================================================
    // 10. MAIN MOVEMENT LOOP (Fluid)
    // =========================================================================
    function fluidMovementLoop() {
        if (!movementEnabled || buildSequenceRunning || isChatSending) return;

        // Follow mode: stop moving when close to target
        if (followPlayerName && followPlayerPos && Date.now() - followPlayerPos.time < 1000) {
            if (followPlayerPos.screenDist !== undefined && followPlayerPos.screenDist < 80) {
                releaseAllMovement();
                currentDir = null;
                return;
            }
        }

        checkForWall();

        var now = Date.now();
        var shouldChangeDir = false;

        if (now >= currentDirHoldUntil) {
            shouldChangeDir = true;
        } else if (Math.random() < DIRECTION_CHANGE_CHANCE) {
            shouldChangeDir = true;
        }

        if (shouldChangeDir || currentDir === null) {
            releaseAllMovement();

            var dirIndex = pickBiasedDirection();
            currentDirIndex = dirIndex;
            currentDir = DIRECTIONS[dirIndex];

            var holdTime = DIRECTION_HOLD_TIME_MIN +
                Math.random() * (DIRECTION_HOLD_TIME_MAX - DIRECTION_HOLD_TIME_MIN);

            if (wallAvoidanceMode) {
                holdTime = Math.min(holdTime, 800);
            }
            // When following a player or mouse, update direction faster
            if (followMouseEnabled || (followPlayerName && followPlayerPos && Date.now() - followPlayerPos.time < 1000)) {
                holdTime = Math.min(holdTime, 150);
            }

            currentDirHoldUntil = now + holdTime;

            for (var k = 0; k < currentDir.keys.length; k++) {
                var code = currentDir.keys[k];
                simulateKey(code, KEY_NAMES[code], true);
            }

            setAimTarget(currentDir.dx, currentDir.dy);
        }
    }

    // =========================================================================
    // [SECTION: GUI-HTML] GUI Panel HTML & CSS
    // The entire control panel UI. Opens with ESC key.
    // To change colors/sizes: edit the CSS in style.textContent below.
    // To add new controls: add HTML in the panel innerHTML section.
    // =========================================================================
    var menuOpen = false;
    var cpCanvas = null;
    var cpCtx = null;

    function injectCSS() {
        var style = document.createElement("style");
        style.textContent = [
            "#afk-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:999998; }",
            "#afk-overlay.open { display:block; }",
            "#afk-panel { display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:999999; width:420px; max-height:90vh; overflow-y:auto; background:rgba(22,22,28,0.97); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:20px; font-family:'Segoe UI',Arial,sans-serif; color:#e0e0e0; box-shadow:0 12px 40px rgba(0,0,0,0.7); user-select:none; }",
            "#afk-panel.open { display:block; }",
            "#afk-panel h2 { margin:0 0 14px 0; font-size:17px; font-weight:700; text-align:center; color:#64b5f6; letter-spacing:0.5px; }",
            "#afk-panel .section { margin-bottom:12px; padding:12px; background:rgba(10,10,26,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; }",
            "#afk-panel .section h3 { margin:0 0 10px 0; font-size:13px; font-weight:600; color:#90a4ae; text-transform:uppercase; letter-spacing:1px; }",
            "#afk-panel .toggle-row { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06); }",
            "#afk-panel .toggle-row:last-of-type { border-bottom:none; }",
            "#afk-panel .toggle-label { font-size:14px; font-weight:600; }",
            ".afk-switch { width:44px; height:24px; border-radius:12px; background:#444; position:relative; cursor:pointer; transition:background 0.2s; flex-shrink:0; }",
            ".afk-switch.on { background:#4caf50; }",
            ".afk-switch::after { content:''; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform 0.2s; }",
            ".afk-switch.on::after { transform:translateX(20px); }",
            "#afk-panel .stat-row { display:flex; justify-content:space-between; padding:3px 0; font-size:13px; }",
            "#afk-panel .stat-label { color:#888; }",
            "#afk-panel .stat-value { color:#ddd; font-weight:600; }",
            "#afk-panel .btn { display:block; width:100%; padding:9px 0; margin-bottom:6px; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:bold; color:#fff; transition:opacity 0.2s; }",
            "#afk-panel .btn:hover { opacity:0.85; }",
            ".btn-summon { background:linear-gradient(135deg,#ff9800,#f57c00); }",
            ".btn-cancel { background:linear-gradient(135deg,#f44336,#d32f2f); }",
            ".btn-reset { background:linear-gradient(135deg,#2196f3,#1976d2); }",
            ".btn-leader { background:linear-gradient(135deg,#ab47bc,#7b1fa2); }",
            "#afk-panel .btn-row { display:flex; gap:6px; }",
            "#afk-panel .btn-row .btn { flex:1; }",
            "#afk-panel .hint { text-align:center; margin-top:8px; font-size:11px; color:#546e7a; font-style:italic; }",
            "#afk-indicator { position:fixed; top:10px; right:10px; z-index:999997; display:flex; align-items:center; gap:6px; background:rgba(22,22,28,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:5px 10px; font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#999; cursor:pointer; user-select:none; }",
            "#afk-indicator:hover { background:rgba(40,40,50,0.9); }",
            ".afk-ind-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }",
            "#afk-panel .grid-box { width:100%; height:200px; background:#0a0a1a; border:1px solid rgba(255,255,255,0.08); border-radius:8px; margin:8px 0; }",
            "#afk-panel .input-row { display:flex; gap:8px; margin-bottom:8px; align-items:center; }",
            "#afk-panel .input-row label { color:#90a4ae; min-width:30px; font-size:13px; }",
            "#afk-panel .input-row input { flex:1; padding:6px 10px; background:#0a0a1a; border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff; font-size:13px; }",
            "#afk-panel .input-row input:focus { outline:none; border-color:#4caf50; }",
            ".cam-badge { display:inline-block; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:6px; }",
            ".cam-badge.live { background:#4caf50; color:#fff; }",
            ".cam-badge.detect { background:#ff9800; color:#fff; }",
            ".cam-badge.off { background:#f44336; color:#fff; }",
            "#afk-panel .slider-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }",
            "#afk-panel .slider-label { font-size:13px; font-weight:600; color:#e0e0e0; }",
            "#afk-panel .slider-value { font-size:12px; color:#4caf50; font-weight:bold; }",
            ".roam-slider { width:100%; padding:8px 0; cursor:pointer; -webkit-appearance:none; appearance:none; background:transparent; }",
            ".roam-slider::-webkit-slider-track { background:#1a1a3e; height:4px; border-radius:2px; }",
            ".roam-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:14px; height:14px; border-radius:50%; background:#4caf50; cursor:pointer; }",
            ".roam-slider::-moz-range-track { background:#1a1a3e; height:4px; border-radius:2px; }",
            ".roam-slider::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:#4caf50; cursor:pointer; border:none; }",
        ].join("\n");
        document.head.appendChild(style);
    }

    function buildGUI() {
        injectCSS();

        var indicator = document.createElement("div");
        indicator.id = "afk-indicator";
        indicator.title = "Press ESC to open panel";
        indicator.innerHTML =
            '<span class="afk-ind-dot" id="ind-dot" style="background:#4caf50"></span>' +
            '<span id="ind-label">AFK: Active</span>' +
            '<span id="ind-cam" style="margin-left:4px;font-size:10px;color:#666">COORD:--</span>';
        indicator.addEventListener("click", toggleMenu);
        document.body.appendChild(indicator);

        var overlay = document.createElement("div");
        overlay.id = "afk-overlay";
        overlay.addEventListener("click", toggleMenu);
        document.body.appendChild(overlay);

        var panel = document.createElement("div");
        panel.id = "afk-panel";
        panel.innerHTML = [
            '<h2>AFK Bot v13.2 (Complete)</h2>',
            '<div class="section">',
            '  <div class="toggle-row">',
            '    <span class="toggle-label">Movement</span>',
            '    <div class="afk-switch on" id="sw-movement"></div>',
            '  </div>',
            '  <div class="toggle-row">',
            '    <span class="toggle-label">Follow Mouse <small>(\\)</small></span>',
            '    <div class="afk-switch" id="sw-follow-mouse"></div>',
            '  </div>',
            '  <div class="toggle-row">',
            '    <span class="toggle-label">Auto-Respawn</span>',
            '    <div class="afk-switch on" id="sw-respawn"></div>',
            '  </div>',
            '</div>',
            '',
            '<div class="section">',
            '  <h3>Tank Upgrade</h3>',
            '  <label style="display:block;font-size:12px;color:#90a4ae;margin-bottom:6px;">Select tank to upgrade to on respawn:</label>',
            '  <select id="tank-select" style="width:100%;padding:8px;background:#0a0a1a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px;">',
            '  </select>',
            '  <div style="margin-top:8px;font-size:11px;color:#888;">',
            '    <div>Path: <span id="tank-path" style="color:#4caf50;">--</span></div>',
            '    <div>Stats: <span id="tank-stats" style="color:#4caf50;">--</span></div>',
            '  </div>',
            '</div>',
            '',
            // Bot Windows section - only shown in top window
            (isInsideIframe ? '' : [
            '<div class="section">',
            '  <h3>Bot Iframes + Proxies</h3>',
            '  <p><button id="btn-create-bot" class="btn btn-summon">+ Create Bot Iframe</button></p>',
            '  <p style="font-size:11px;color:#888;">Each iframe runs a separate bot instance inside this page.<br/>No popups needed.</p>',
            '  <div id="bot-list" style="margin-top:8px;max-height:150px;overflow-y:auto;"></div>',
            '  <p style="font-size:11px;color:#666;margin-top:6px;">Proxies available: ' + PROXY_LIST.length + ' | Next: #' + (nextProxyIndex + 1) + '</p>',
            '</div>',
            ].join('\n')),
            '',
            '<div class="section">',
            '  <h3>AI Chatbot (Gemini)</h3>',
            '  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">',
            '    <label style="color:#ccc;font-size:13px;">Enable</label>',
            '    <input type="checkbox" id="chatbot-toggle" ' + (chatbotEnabled ? 'checked' : '') + '>',
            '  </div>',
            '  <div style="margin-bottom:8px;">',
            '    <label style="color:#888;font-size:11px;">Gemini API Key (<a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#4fc3f7;">Get one free</a>)</label>',
            '    <input type="password" id="gemini-key" value="' + geminiApiKey + '" placeholder="Paste API key here" style="width:100%;padding:6px;margin-top:4px;background:#1a1a2e;color:#fff;border:1px solid #333;border-radius:4px;font-size:11px;">',
            '  </div>',
            '  <div style="margin-bottom:8px;">',
            '    <label style="color:#888;font-size:11px;">Personality Prompt</label>',
            '    <textarea id="chatbot-personality" rows="3" style="width:100%;padding:6px;margin-top:4px;background:#1a1a2e;color:#fff;border:1px solid #333;border-radius:4px;font-size:11px;resize:vertical;">' + chatbotPersonality.replace(/'/g, "&#39;") + '</textarea>',
            '  </div>',
            '  <div style="margin-bottom:8px;">',
            '    <label style="color:#888;font-size:11px;">Always respond to (override)</label>',
            '    <input type="text" id="override-respond-to" value="' + overrideRespondTo + '" placeholder="Player name (leave empty for auto)" style="width:100%;padding:6px;margin-top:4px;background:#1a1a2e;color:#fff;border:1px solid #333;border-radius:4px;font-size:11px;">',
            '  </div>',
            '  <div style="margin-bottom:8px;">',
            '    <label style="color:#888;font-size:11px;">Follow player (move toward them)</label>',
            '    <input type="text" id="follow-player-name" value="' + followPlayerName + '" placeholder="Player name to follow (leave empty to disable)" style="width:100%;padding:6px;margin-top:4px;background:#1a1a2e;color:#fff;border:1px solid #333;border-radius:4px;font-size:11px;">',
            '  </div>',
            '  <div style="margin-bottom:4px;">',
            '    <button id="btn-test-chat" class="btn btn-summon" style="font-size:11px;padding:4px 12px;">Test Chat</button>',
            '    <span id="chatbot-status" style="color:#888;font-size:11px;margin-left:8px;"></span>',
            '  </div>',
            '  <p style="font-size:11px;color:#666;">Uses Google Gemini. Tracks who is chatting. Auto-pauses 60s on rate limit.</p>',
            '</div>',
            '',
            '<div class="section">',
            '  <h3>Roaming Control</h3>',
            '  <div class="slider-row">',
            '    <span class="slider-label">Roam Distance</span>',
            '    <span class="slider-value" id="roam-value">1.0x</span>',
            '  </div>',
            '  <input type="range" id="roam-slider" min="0.3" max="2.0" step="0.1" value="1.0" class="roam-slider">',
            '  <div class="hint" style="margin-top:6px;font-style:normal;font-size:12px">',
            '    Lower = tight roaming, Higher = more spread out',
            '  </div>',
            '</div>',
            '',
            '<div class="section">',
            '  <h3>Status</h3>',
            '  <div class="stat-row"><span class="stat-label">State</span><span class="stat-value" id="s-state">Idle</span></div>',
            '  <div class="stat-row"><span class="stat-label">Grid Position</span><span class="stat-value" id="s-grid">(0.0, 0.0)</span></div>',
            '  <div class="stat-row"><span class="stat-label">Coordinate Tracking</span><span class="stat-value" id="s-cam">Scanning...</span></div>',
            '  <div class="stat-row"><span class="stat-label">Deaths / Respawns</span><span class="stat-value" id="s-deaths">0 / 0</span></div>',
            '  <div class="stat-row"><span class="stat-label">Connection</span><span class="stat-value" id="s-connection">Connected</span></div>',
            '</div>',
            '',
            '<div class="section">',
            '  <h3>Leader / Follower</h3>',
            '  <div class="stat-row"><span class="stat-label">This Tab</span><span class="stat-value" id="s-role">Follower</span></div>',
            '  <div class="stat-row"><span class="stat-label">Connected Alts</span><span class="stat-value" id="s-alts">0</span></div>',
            '  <button class="btn btn-leader" id="btn-leader">Become Leader</button>',
            '  <button class="btn btn-cancel" id="btn-resign" style="display:none">Resign Leader</button>',
            '</div>',
            '',
            '<div class="section">',
            '  <h3>Alt Minimap</h3>',
            '  <canvas id="map-canvas" width="200" height="200" style="width:100%;border:1px solid #333;border-radius:6px;background:#0a0a1a;"></canvas>',
            '</div>',
            '',
            '<div class="section">',
            '  <h3>Manual Summon</h3>',
            '  <div class="input-row">',
            '    <label>X:</label><input type="number" id="inp-x" value="0" step="1">',
            '    <label>Y:</label><input type="number" id="inp-y" value="0" step="1">',
            '  </div>',
            '  <button class="btn btn-summon" id="btn-summon">Summon to Coords</button>',
            '  <div class="btn-row">',
            '    <button class="btn btn-cancel" id="btn-cancel">Cancel Summon</button>',
            '    <button class="btn btn-reset" id="btn-reset">Send to (0,0)</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="hint">Press <b>ESC</b> to close • <b>[</b> move • <b>]</b> respawn • <b>\\</b> follow mouse • Tab: ' + myTabId + '</div>',
        ].join("\n");
        document.body.appendChild(panel);

        // Wire toggles
        document.getElementById("sw-movement").addEventListener("click", function() {
            movementEnabled = !movementEnabled;
            if (movementEnabled) {
                currentDir = null; currentMouseX = -1; currentMouseY = -1;
                setStatus("Moving");
            } else {
                releaseAllMovement(); currentDir = null;
                setStatus(autoRespawnEnabled ? "Idle (respawn active)" : "Idle");
            }
            updateGUI();
        });

        document.getElementById("sw-follow-mouse").addEventListener("click", function() {
            followMouseEnabled = !followMouseEnabled;
            setStatus(followMouseEnabled ? "Following mouse" : "Moving");
            updateGUI();
        });

        document.getElementById("sw-respawn").addEventListener("click", function() {
            autoRespawnEnabled = !autoRespawnEnabled;
            if (!movementEnabled) {
                setStatus(autoRespawnEnabled ? "Idle (respawn active)" : "Idle");
            }
            updateGUI();
        });

        // Bot window button (only in top window)
        if (!isInsideIframe) {
            document.getElementById("btn-create-bot").addEventListener("click", function() {
                var bot = window.createBotWindow();
                if (bot) setStatus("Opened bot window #" + (bot.index + 1) + " | " + bot.proxy);
            });
        }

        // Tank selection dropdown
        var tankSelect = document.getElementById("tank-select");
        if (tankSelect) {
            // Populate tank options grouped by branch
            var currentBranch = "";
            var currentGroup = null;
            for (var tankId in tankUpgrades) {
                if (tankUpgrades.hasOwnProperty(tankId)) {
                    var tank = tankUpgrades[tankId];
                    if (tank.branch && tank.branch !== currentBranch) {
                        currentBranch = tank.branch;
                        currentGroup = document.createElement("optgroup");
                        currentGroup.label = "── " + currentBranch + " ──";
                        tankSelect.appendChild(currentGroup);
                    }
                    var opt = document.createElement("option");
                    opt.value = tankId;
                    opt.textContent = tank.name;
                    (currentGroup || tankSelect).appendChild(opt);
                }
            }

            tankSelect.value = selectedTankUpgrade;

            tankSelect.addEventListener("change", function() {
                selectedTankUpgrade = this.value;
                updateTankDisplay();
                console.log("[AFK Bot] Selected tank: " + tankUpgrades[selectedTankUpgrade].name);
            });
        }

        // Wire buttons
        document.getElementById("btn-summon").addEventListener("click", function() {
            var x = parseFloat(document.getElementById("inp-x").value) || 0;
            var y = parseFloat(document.getElementById("inp-y").value) || 0;
            doSummon(x, y);
        });
        document.getElementById("btn-cancel").addEventListener("click", cancelSummon);
        document.getElementById("btn-reset").addEventListener("click", function() { doSummon(0, 0); });
        document.getElementById("btn-leader").addEventListener("click", claimLeader);
        document.getElementById("btn-resign").addEventListener("click", resignLeader);

        // Roaming slider
        var roamSlider = document.getElementById("roam-slider");
        if (roamSlider) {
            roamSlider.addEventListener("input", function() {
                ROAM_BIAS_MULTIPLIER = parseFloat(this.value);
                var valueEl = document.getElementById("roam-value");
                if (valueEl) valueEl.textContent = ROAM_BIAS_MULTIPLIER.toFixed(1) + "x";
            });
        }

        // AI Chatbot controls
        var chatbotToggle = document.getElementById("chatbot-toggle");
        if (chatbotToggle) {
            chatbotToggle.addEventListener("change", function() {
                chatbotEnabled = this.checked;
                localStorage.setItem("arras-afk-chatbot-enabled", chatbotEnabled ? "1" : "0");
                var statusEl = document.getElementById("chatbot-status");
                if (statusEl) statusEl.textContent = chatbotEnabled ? "Active" : "Off";
            });
        }

        var geminiKeyInput = document.getElementById("gemini-key");
        if (geminiKeyInput) {
            geminiKeyInput.addEventListener("change", function() {
                geminiApiKey = this.value.trim();
                localStorage.setItem("arras-afk-gemini-key", geminiApiKey);
                var statusEl = document.getElementById("chatbot-status");
                if (statusEl) statusEl.textContent = geminiApiKey ? "Key saved" : "No key";
            });
            geminiKeyInput.addEventListener("keydown", function(e) { e.stopPropagation(); });
            geminiKeyInput.addEventListener("keyup", function(e) { e.stopPropagation(); });
        }

        var personalityInput = document.getElementById("chatbot-personality");
        if (personalityInput) {
            personalityInput.addEventListener("change", function() {
                chatbotPersonality = this.value.trim();
                localStorage.setItem("arras-afk-chatbot-personality", chatbotPersonality);
            });
            personalityInput.addEventListener("keydown", function(e) { e.stopPropagation(); });
            personalityInput.addEventListener("keyup", function(e) { e.stopPropagation(); });
        }

        var overrideInput = document.getElementById("override-respond-to");
        if (overrideInput) {
            overrideInput.addEventListener("change", function() {
                overrideRespondTo = this.value.trim();
                localStorage.setItem("arras-afk-override-name", overrideRespondTo);
                var statusEl = document.getElementById("chatbot-status");
                if (statusEl) statusEl.textContent = overrideRespondTo ? "Override: " + overrideRespondTo : "Auto mode";
            });
            overrideInput.addEventListener("keydown", function(e) { e.stopPropagation(); });
            overrideInput.addEventListener("keyup", function(e) { e.stopPropagation(); });
        }

        var followInput = document.getElementById("follow-player-name");
        if (followInput) {
            followInput.addEventListener("change", function() {
                followPlayerName = this.value.trim();
                localStorage.setItem("arras-afk-follow-player", followPlayerName);
                followPlayerPos = null; // Reset position when name changes
                var statusEl = document.getElementById("chatbot-status");
                if (statusEl) statusEl.textContent = followPlayerName ? "Following: " + followPlayerName : "Not following";
            });
            followInput.addEventListener("keydown", function(e) { e.stopPropagation(); });
            followInput.addEventListener("keyup", function(e) { e.stopPropagation(); });
        }

        var testChatBtn = document.getElementById("btn-test-chat");
        if (testChatBtn) {
            testChatBtn.addEventListener("click", async function() {
                var statusEl = document.getElementById("chatbot-status");
                if (statusEl) statusEl.textContent = "Testing...";
                var prompt = chatbotPersonality + "\n\nSay a short greeting for an arras.io game (under 40 chars). Just the message, no quotes, no explanation.";
                var reply = await getAIResponse(prompt, "spawn");
                if (reply) {
                    if (statusEl) statusEl.textContent = "OK: " + reply;
                    await sendGameChat(reply);
                } else {
                    if (statusEl) statusEl.textContent = "Error - using local phrases";
                }
            });
        }

        // Prevent input keystrokes from reaching game
        var inputs = panel.querySelectorAll("input[type='number']");
        for (var ii = 0; ii < inputs.length; ii++) {
            inputs[ii].addEventListener("keydown", function(e) { e.stopPropagation(); });
            inputs[ii].addEventListener("keyup", function(e) { e.stopPropagation(); });
        }

        cpCanvas = document.getElementById("map-canvas");
        if (cpCanvas) cpCtx = cpCanvas.getContext("2d");
    }

    // =========================================================================
    // [SECTION: GUI-UPDATES] Panel Update Functions
    // toggleMenu(), updateTankDisplay(), updatePanel()
    // =========================================================================
    function toggleMenu() {
        menuOpen = !menuOpen;
        var panel = document.getElementById("afk-panel");
        var overlay = document.getElementById("afk-overlay");
        if (panel) panel.classList.toggle("open", menuOpen);
        if (overlay) overlay.classList.toggle("open", menuOpen);
        if (menuOpen) updatePanel();
    }

    function updateTankDisplay() {
        var upgrade = tankUpgrades[selectedTankUpgrade];
        if (!upgrade) return;

        var pathEl = document.getElementById("tank-path");
        var statsEl = document.getElementById("tank-stats");

        if (pathEl) pathEl.textContent = upgrade.path;
        if (statsEl) statsEl.textContent = upgrade.stats;
    }

    function updatePanel() {
        if (!menuOpen) return;

        var el = function(id) { return document.getElementById(id); };
        updateTankDisplay();

        var sState = el("s-state");
        var sGrid = el("s-grid");
        var sCam = el("s-cam");
        var sDeaths = el("s-deaths");
        var sRole = el("s-role");
        var sAlts = el("s-alts");
        var btnLdr = el("btn-leader");
        var btnRes = el("btn-resign");
        var sConnection = el("s-connection");

        if (sState) sState.textContent = lastStatus;
        if (sGrid) sGrid.textContent = "(" + grid.x.toFixed(1) + ", " + grid.y.toFixed(1) + ")";
        if (sCam) {
            if (coordDetectionDone && detectedCoords.hasData) {
                sCam.innerHTML = '<span class="cam-badge live">LIVE</span> ' + coordUpdateCount + ' updates';
            } else {
                sCam.innerHTML = '<span class="cam-badge detect">SCANNING</span>';
            }
        }
        if (sDeaths) sDeaths.textContent = deathCount + " / " + respawnCount;
        if (sConnection) {
            if (disconnectDetected || reconnectDetected) {
                sConnection.textContent = "Reconnecting...";
                sConnection.style.color = "#f44336";
            } else {
                sConnection.textContent = "Connected";
                sConnection.style.color = "#4caf50";
            }
        }
        if (sRole) sRole.textContent = isLeader ? "LEADER" : "Follower";
        if (sAlts) sAlts.textContent = getAltCount();
        if (btnLdr && btnRes) {
            btnLdr.style.display = isLeader ? "none" : "block";
            btnRes.style.display = isLeader ? "block" : "none";
        }

        var swMove = document.getElementById("sw-movement");
        var swResp = document.getElementById("sw-respawn");
        var swFollowMouse = document.getElementById("sw-follow-mouse");
        if (swMove) swMove.classList.toggle("on", movementEnabled);
        if (swResp) swResp.classList.toggle("on", autoRespawnEnabled);
        if (swFollowMouse) swFollowMouse.classList.toggle("on", followMouseEnabled);

        var roamVal = document.getElementById("roam-value");
        if (roamVal) roamVal.textContent = ROAM_BIAS_MULTIPLIER.toFixed(1) + "x";

        drawMinimap();
    }

    function drawMinimap() {
        if (!cpCanvas || !cpCtx) return;
        var ctx = cpCtx;
        var w = cpCanvas.width;
        var h = cpCanvas.height;
        ctx.clearRect(0, 0, w, h);

        // Map scale: game coords roughly -40 to 40 on each axis
        var mapScale = 40;
        function toMapX(gx) { return w / 2 + (gx / mapScale) * (w / 2); }
        function toMapY(gy) { return h / 2 + (gy / mapScale) * (h / 2); }

        // Draw grid lines
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
        ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Draw alts as blue dots
        var now = Date.now();
        for (var tabId in altTabs) {
            var tab = altTabs[tabId];
            if (now - tab.lastSeen > 5000) continue;
            var ax = toMapX(tab.gridX);
            var ay = toMapY(tab.gridY);
            ctx.fillStyle = tab.isLeader ? "#ffeb3b" : "#42a5f5";
            ctx.beginPath();
            ctx.arc(ax, ay, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw self as green dot
        ctx.fillStyle = "#4caf50";
        ctx.beginPath();
        ctx.arc(toMapX(grid.x), toMapY(grid.y), 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw follow target as red dot (if we have their estimated world position)
        if (followPlayerName && followLastSeenGrid) {
            ctx.fillStyle = "#f44336";
            ctx.beginPath();
            ctx.arc(toMapX(followLastSeenGrid.x), toMapY(followLastSeenGrid.y), 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#f44336";
            ctx.font = "9px sans-serif";
            ctx.fillText(followPlayerName, toMapX(followLastSeenGrid.x) + 6, toMapY(followLastSeenGrid.y) + 3);
        }
    }

    // =========================================================================
    // [SECTION: GUI-HELPERS] GUI Helper Functions
    // updateGUI() - updates indicator dot + label, updateStatusDisplay()
    // =========================================================================
    function updateGUI() {
        var dot = document.getElementById("ind-dot");
        if (dot) {
            dot.style.background = (movementEnabled || autoRespawnEnabled) ? "#4caf50" : "#f44336";
        }

        var indLabel = document.getElementById("ind-label");
        if (indLabel) {
            var active = [];
            if (movementEnabled) active.push("Move");
            if (autoRespawnEnabled) active.push("Resp");
            if (isLeader) active.push("Leader");
            indLabel.textContent = active.length > 0 ? "AFK: " + active.join("+") : "AFK: OFF";
        }

        updateStatusDisplay();
    }

    function updateStatusDisplay() {
        var indCam = document.getElementById("ind-cam");
        if (indCam) {
            if (coordDetectionDone && detectedCoords.hasData) {
                indCam.textContent = "COORD:" + coordUpdateCount;
                indCam.style.color = "#4caf50";
            } else {
                indCam.textContent = "COORD:SCAN";
                indCam.style.color = "#f44336";
            }
        }
        updatePanel();
    }

    // =========================================================================
    // [SECTION: HOTKEYS] Keyboard Hotkeys
    // ESC = Open/close panel, [ = Toggle movement, ] = Toggle auto-respawn
    // To add a new hotkey: add "if (e.code === ...)" block below
    // =========================================================================
    document.addEventListener("keydown", function(e) {
        if (e.code === "Escape") {
            e.stopPropagation();
            e.preventDefault();
            toggleMenu();
        }

        if (e.code === "BracketLeft") {
            movementEnabled = !movementEnabled;
            if (movementEnabled) {
                currentDir = null; currentMouseX = -1; currentMouseY = -1;
                setStatus("Moving");
            } else {
                releaseAllMovement(); currentDir = null;
                setStatus(autoRespawnEnabled ? "Idle (respawn active)" : "Idle");
            }
            updateGUI();
        }

        if (e.code === "BracketRight") {
            autoRespawnEnabled = !autoRespawnEnabled;
            if (!movementEnabled) {
                setStatus(autoRespawnEnabled ? "Idle (respawn active)" : "Idle");
            }
            updateGUI();
        }

        // Backslash toggles follow-mouse mode
        if (e.code === "Backslash") {
            followMouseEnabled = !followMouseEnabled;
            console.log("[AFK Bot] Follow mouse: " + (followMouseEnabled ? "ON" : "OFF"));
            setStatus(followMouseEnabled ? "Following mouse" : "Moving");
            updateGUI();
        }
    }, true);

    // Track mouse position for follow-mouse mode
    document.addEventListener("mousemove", function(e) {
        mouseScreenX = e.clientX;
        mouseScreenY = e.clientY;
    });

    // =========================================================================
    // [SECTION: BOOT] Boot / Initialization
    // Starts all main loops: movement(50ms), mouse(16ms), status(500ms)
    // =========================================================================
    function boot() {
        buildGUI();
        updateGUI();
        lastCanvasActivity = Date.now();

        // Note: Bot iframes are NOT auto-restored on reload.
        // User clicks "+ Create Bot Iframe" manually after reload.

        // Main movement loop
        setInterval(fluidMovementLoop, 50);

        // Smooth mouse updates
        setInterval(function() {
            if (movementEnabled) updateMouseSmooth();
        }, 16);

        setInterval(updateStatusDisplay, 500);

        // Clean up old alt tab entries
        setInterval(function() {
            var now = Date.now();
            for (var tabId in altTabs) {
                if (now - altTabs[tabId].lastSeen > 10000) delete altTabs[tabId];
            }
        }, 5000);

        // Clean up old wall memory
        setInterval(function() {
            var now = Date.now();
            for (var wallKey in wallMemory) {
                if (now - wallMemory[wallKey].time > 15000) {
                    delete wallMemory[wallKey];
                }
            }
        }, 5000);

        console.log("[AFK Bot] v13.2 active — Full features + Iframe Bots + Fixed Reconnect");
        console.log("[AFK Bot] Tab ID: " + myTabId);
        console.log("=== HOTKEYS ===");
        console.log("ESC  - Open/close panel");
        console.log("[    - Toggle Movement");
        console.log("]    - Toggle Auto-Respawn");
        console.log("=== FEATURES ===");
        console.log("✓ Fluid movement with wall avoidance");
        console.log("✓ Auto-reconnect on disconnect");
        console.log("✓ Bot instances as iframes (no separate windows)");
        console.log("✓ Leader/follower mode");
        console.log("✓ Coordinate tracking & auto-respawn");
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(boot, 2000);
    } else {
        document.addEventListener("DOMContentLoaded", function() { setTimeout(boot, 2000); });
    }
})();
