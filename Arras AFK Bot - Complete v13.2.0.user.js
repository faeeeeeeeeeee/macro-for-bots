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
    // ║  [SECTION: IFRAME-BOTS]    - Iframe bot system (spawn sub-tabs)     ║
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
    // [SECTION: IFRAME-BOTS] Iframe Bot System
    // Creates bot instances as iframes instead of separate browser windows.
    // Each bot runs the same script in a sub-tab within the page.
    // Functions: createBotIframe(), removeBotInstance(), saveBotState()
    // Only runs in the TOP window — iframes skip this entire block.
    // =========================================================================
    if (!isInsideIframe) {
    var botIframes = document.createElement("div");
    botIframes.id = "botIframes";
    botIframes.style.position = "fixed";
    botIframes.style.bottom = "20px";
    botIframes.style.right = "20px";
    botIframes.style.zIndex = 999998;
    botIframes.style.display = "flex";
    botIframes.style.flexDirection = "column";
    botIframes.style.gap = "10px";
    document.body.appendChild(botIframes);

    window.botInstances = [];

    function saveBotState() {
        var botData = [];
        for (var i = 0; i < window.botInstances.length; i++) {
            var bot = window.botInstances[i];
            botData.push({
                id: i,
                width: bot.container.offsetWidth,
                height: bot.container.offsetHeight
            });
        }
        localStorage.setItem("arras-afk-bots", JSON.stringify(botData));
    }

    function removeBotInstance(index) {
        if (window.botInstances[index]) {
            var bot = window.botInstances[index];
            if (bot.container.parentNode) {
                bot.container.parentNode.removeChild(bot.container);
            }
            window.botInstances.splice(index, 1);
            saveBotState();
            updateBotList();
        }
    }

    function updateBotList() {
        var listEl = document.getElementById("bot-list");
        if (!listEl) return;

        listEl.innerHTML = "";
        for (var i = 0; i < window.botInstances.length; i++) {
            var botItem = document.createElement("div");
            botItem.style.display = "flex";
            botItem.style.justifyContent = "space-between";
            botItem.style.alignItems = "center";
            botItem.style.padding = "6px";
            botItem.style.background = "rgba(10,10,26,0.6)";
            botItem.style.borderRadius = "6px";
            botItem.style.marginBottom = "4px";
            botItem.style.fontSize = "12px";

            var label = document.createElement("span");
            label.textContent = "Bot #" + (i + 1);
            label.style.color = "#ccc";
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
                return function() {
                    removeBotInstance(idx);
                };
            })(i);
            botItem.appendChild(closeBtn);

            listEl.appendChild(botItem);
        }
    }

    function createBotIframe() {
        // Create container for iframe + resize handle + close button
        var container = document.createElement("div");
        container.style.position = "relative";
        container.style.width = "300px";
        container.style.height = "200px";
        container.style.display = "flex";
        container.style.flexDirection = "column";

        // Create header with close button
        var header = document.createElement("div");
        header.style.position = "absolute";
        header.style.top = "0";
        header.style.right = "0";
        header.style.zIndex = "1001";
        header.style.padding = "4px";
        header.style.cursor = "pointer";

        var closeBtn = document.createElement("div");
        closeBtn.style.background = "#f44336";
        closeBtn.style.color = "#fff";
        closeBtn.style.width = "20px";
        closeBtn.style.height = "20px";
        closeBtn.style.display = "flex";
        closeBtn.style.alignItems = "center";
        closeBtn.style.justifyContent = "center";
        closeBtn.style.borderRadius = "3px";
        closeBtn.style.fontSize = "14px";
        closeBtn.style.fontWeight = "bold";
        closeBtn.style.cursor = "pointer";
        closeBtn.textContent = "✕";
        header.appendChild(closeBtn);
        container.appendChild(header);

        var iframe = document.createElement("iframe");
        iframe.src = location.href;
        iframe.style.flex = "1";
        iframe.style.border = "2px solid #4caf50";
        iframe.style.borderRadius = "8px";
        iframe.style.background = "#0a0a1a";
        iframe.style.margin = "0";
        iframe.style.padding = "0";
        iframe.title = "Bot Instance #" + (window.botInstances.length + 1);
        container.appendChild(iframe);

        // Create resize handle
        var resizeHandle = document.createElement("div");
        resizeHandle.style.position = "absolute";
        resizeHandle.style.bottom = "0";
        resizeHandle.style.right = "0";
        resizeHandle.style.width = "15px";
        resizeHandle.style.height = "15px";
        resizeHandle.style.background = "linear-gradient(135deg, transparent 50%, #4caf50 50%)";
        resizeHandle.style.cursor = "nwse-resize";
        resizeHandle.style.zIndex = "1000";
        container.appendChild(resizeHandle);

        // Make resizable
        var isResizing = false;
        var startX = 0;
        var startY = 0;
        var startWidth = 300;
        var startHeight = 200;

        resizeHandle.addEventListener("mousedown", function(e) {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = container.offsetWidth;
            startHeight = container.offsetHeight;
            e.preventDefault();
        });

        document.addEventListener("mousemove", function(e) {
            if (!isResizing) return;
            var newWidth = startWidth + (e.clientX - startX);
            var newHeight = startHeight + (e.clientY - startY);
            if (newWidth > 150) container.style.width = newWidth + "px";
            if (newHeight > 120) container.style.height = newHeight + "px";
        });

        document.addEventListener("mouseup", function() {
            isResizing = false;
        });

        botIframes.appendChild(container);

        var botIndex = window.botInstances.length;
        var botObj = {
            iframe: iframe,
            contentWindow: iframe.contentWindow,
            index: botIndex,
            container: container
        };

        window.botInstances.push(botObj);

        // Close button handler
        closeBtn.addEventListener("click", function() {
            removeBotInstance(botIndex);
        });

        // Setup bot window
        setTimeout(function() {
            var win = iframe.contentWindow;
            win.__is_bot = true;
            win.botIndex = botObj.index;

            win.channel = {
                message: function() {},
                reconnect: function() {
                    setTimeout(function() {
                        try {
                            var pressEnterEvent = new KeyboardEvent("keydown", {
                                key: "Enter",
                                code: "Enter",
                                keyCode: 13,
                                bubbles: true,
                                cancelable: true
                            });
                            win.document.dispatchEvent(pressEnterEvent);
                        } catch(e) {}
                    }, 50);
                }
            };
        }, 500);

        console.log("[AFK Bot] Created bot iframe #" + (window.botInstances.length));
        saveBotState();
        updateBotList();
        return botObj;
    }

    window.createBotIframe = createBotIframe;
    window.removeBotInstance = removeBotInstance;
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

    function hookCanvasText() {
        var proto = CanvasRenderingContext2D.prototype;

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
    function simulateKey(code, keyName, pressed) {
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
            setTimeout(function() { isDead = false; }, 500);
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
        for (var pi = 0; pi < upgrade.path.length; pi++) {
            var pathKey = upgrade.path[pi].toUpperCase();
            await tapKey("Key" + pathKey, pathKey.toLowerCase()); await delay(30);
        }

        // Apply stat distribution
        await delay(20);
        simulateKey("KeyM", "m", true);
        await delay(10);

        var statParts = upgrade.stats.split("/");
        for (var si = 0; si < statParts.length; si++) {
            var statNum = parseInt(statParts[si]) || 0;
            var digitKey = ((si % 8) + 1);
            for (var s = 0; s < statNum; s++) {
                await tapKey("Digit" + digitKey, ""); await delay(10);
            }
        }

        simulateKey("KeyM", "m", false);

        await delay(20);

        buildSequenceRunning = false;
        if (movementEnabled) {
            setStatus(isLeader ? "LEADER — alts follow me" : "Moving");
        } else {
            setStatus("Idle (respawn active)");
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
        if (!movementEnabled || buildSequenceRunning) return;

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
            // Bot Iframes section - only shown in top window (not inside iframes)
            (isInsideIframe ? '' : [
            '<div class="section">',
            '  <h3>Bot Iframes</h3>',
            '  <p><button id="btn-create-iframe" class="btn btn-summon">+ Create Bot Tab</button></p>',
            '  <p style="font-size:12px;color:#888;">Bots persist after reload!<br/>Click ✕ on bot frame to close</p>',
            '  <div id="bot-list" style="margin-top:8px;max-height:120px;overflow-y:auto;"></div>',
            '</div>',
            ].join('\n')),
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
            '<div class="hint">Press <b>ESC</b> to close • <b>[</b> move • <b>]</b> respawn • Tab: ' + myTabId + '</div>',
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

        document.getElementById("sw-respawn").addEventListener("click", function() {
            autoRespawnEnabled = !autoRespawnEnabled;
            if (!movementEnabled) {
                setStatus(autoRespawnEnabled ? "Idle (respawn active)" : "Idle");
            }
            updateGUI();
        });

        // Bot iframe button (only in top window)
        if (!isInsideIframe) {
            document.getElementById("btn-create-iframe").addEventListener("click", function() {
                window.createBotIframe();
                setStatus("Created bot iframe");
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
        if (swMove) swMove.classList.toggle("on", movementEnabled);
        if (swResp) swResp.classList.toggle("on", autoRespawnEnabled);

        var roamVal = document.getElementById("roam-value");
        if (roamVal) roamVal.textContent = ROAM_BIAS_MULTIPLIER.toFixed(1) + "x";
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
    }, true);

    // =========================================================================
    // [SECTION: BOOT] Boot / Initialization
    // Starts all main loops: movement(50ms), mouse(16ms), status(500ms)
    // =========================================================================
    function boot() {
        buildGUI();
        updateGUI();
        lastCanvasActivity = Date.now();

        // Restore bot instances from localStorage (only in top window)
        if (!isInsideIframe) {
            try {
                var savedBots = localStorage.getItem("arras-afk-bots");
                if (savedBots) {
                    var botData = JSON.parse(savedBots);
                    for (var i = 0; i < botData.length; i++) {
                        var bot = createBotIframe();
                        if (botData[i].width && botData[i].height) {
                            bot.container.style.width = botData[i].width + "px";
                            bot.container.style.height = botData[i].height + "px";
                        }
                    }
                    console.log("[AFK Bot] Restored " + botData.length + " bot instances");
                }
            } catch(e) {
                console.log("[AFK Bot] Could not restore bots:", e);
            }
        }

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
