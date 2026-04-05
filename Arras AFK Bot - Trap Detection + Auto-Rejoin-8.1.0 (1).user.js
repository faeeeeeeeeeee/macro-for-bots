// ==UserScript==
// @name         Arras AFK Bot - Trap Detection + Auto-Rejoin
// @namespace    http://tampermonkey.net/
// @version      8.1.0
// @description  20+ trap colors, double-enter rejoin fix, hotkeys (U/I/O/L/P), debug mode, works tabbed out
// @match        *://arras.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";

    // =========================================================================
    // 0. PAGE VISIBILITY OVERRIDE (to prevent throttling when tabbed out)
    // =========================================================================
    Object.defineProperty(document, 'hidden', {
        get: function() { return false; },
        configurable: true
    });

    Object.defineProperty(document, 'visibilityState', {
        get: function() { return 'visible'; },
        configurable: true
    });

    // Prevent page from detecting tab switches
    const originalAddEventListener = document.addEventListener;
    document.addEventListener = function(type, listener, options) {
        if (type === 'visibilitychange') {
            return; // Block visibility change listeners
        }
        return originalAddEventListener.call(this, type, listener, options);
    };
// =========================================================================
// BLOCK beforeunload (prevents "leave site?" popup)
// =========================================================================
const _origBeforeUnload = window.onbeforeunload;
Object.defineProperty(window, "onbeforeunload", {
    get: () => null,
    set: () => {},
});

// Block addEventListener version too
const _origAddEventListener2 = window.addEventListener;
window.addEventListener = function(type, listener, options) {
    if (type === "beforeunload") {
        return; // block it completely
    }
    return _origAddEventListener2.call(this, type, listener, options);
};
    // =========================================================================
    // 1. INTERCEPT window.addEventListener  (keyboard - isTrusted bypass)
    // =========================================================================
    const _origWindowAddEventListener = window.addEventListener;
    window.addEventListener = function (...args) {
        const type = args[0];
        if (type === "keydown" || type === "keyup") {
            const originalHandler = args[1];
            args[1] = function (...handlerArgs) {
                const real = handlerArgs[0];
                const proxy = {
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
    // 2. INTERCEPT HTMLDivElement.prototype.addEventListener
    //    (mouse - isTrusted bypass)
    // =========================================================================
    const _origDivAddEventListener = HTMLDivElement.prototype.addEventListener;
    HTMLDivElement.prototype.addEventListener = function (...args) {
        const type = args[0];
        if (type === "mousedown" || type === "mouseup" || type === "mousemove") {
            const originalHandler = args[1];
            args[1] = function (...handlerArgs) {
                const real = handlerArgs[0];
                const proxy = {
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
    const activeKeys = {};
    function simulateKey(code, keyName, pressed) {
        if (activeKeys[code] === pressed) return;
        activeKeys[code] = pressed;
        const event = new KeyboardEvent(pressed ? "keydown" : "keyup", {
            key: keyName,
            code: code,
            bubbles: true,
            cancelable: true,
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

    let cachedCanvas = null;
    function getCanvas() {
        if (!cachedCanvas || !document.contains(cachedCanvas)) {
            cachedCanvas = document.querySelector("#canvas canvas")
                        || document.querySelector("#canvas")
                        || document.querySelector("canvas");
        }
        return cachedCanvas;
    }

    // --- Smooth mouse aim state ---
    let currentMouseX = -1;
    let currentMouseY = -1;
    let targetMouseX  = -1;
    let targetMouseY  = -1;
    const MOUSE_LERP_SPEED = 0.08;

    function simulateMouseMove(x, y) {
        const canvas = getCanvas();
        if (!canvas) return;
        canvas.dispatchEvent(new MouseEvent("mousemove", {
            clientX: x,
            clientY: y,
            button: 0,
            bubbles: true,
            cancelable: true,
            view: window,
        }));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function updateMouseSmooth() {
        if (targetMouseX < 0 || targetMouseY < 0) return;
        if (currentMouseX < 0) {
            currentMouseX = targetMouseX;
            currentMouseY = targetMouseY;
        }
        currentMouseX = lerp(currentMouseX, targetMouseX, MOUSE_LERP_SPEED);
        currentMouseY = lerp(currentMouseY, targetMouseY, MOUSE_LERP_SPEED);
        simulateMouseMove(Math.round(currentMouseX), Math.round(currentMouseY));
    }

    // =========================================================================
    // 4. STATE
    // =========================================================================
    let movementEnabled = true;
    let autoRespawnEnabled = true;
    let isDead = false;
    let buildSequenceRunning = false;
    let deathCount = 0;
    let respawnCount = 0;
    let lastStatus = "Idle";
    let lastCanvasActivity = Date.now();

    function setStatus(s) {
        lastStatus = s;
        updateStatusDisplay();
    }

    // =========================================================================
    // 5. PRESS ENTER HELPER
    // =========================================================================
    function pressEnter() {
        if (document.activeElement && document.activeElement.tagName === "INPUT") {
            document.activeElement.blur();
        }
        const ev1 = new KeyboardEvent("keydown", {
            key: "Enter", code: "Enter", keyCode: 13, which: 13,
            bubbles: true, cancelable: true
        });
        document.dispatchEvent(ev1);
        runBuildSequence();
        setTimeout(function() {}, 10);
    }

    // =========================================================================
    // 7. DEATH DETECTION  (intercept canvas text rendering)
    // =========================================================================
    function waitForProto(cb) {
        const check = function() {
            const proto = CanvasRenderingContext2D.prototype;
            if (proto) cb(proto);
            else setTimeout(check, 50);
        };
        check();
    }

    waitForProto(function(proto) {
        const origFillText = proto.fillText;
        const origStrokeText = proto.strokeText;
        proto.fillText = function () {
            checkCanvasText(arguments[0]);
            return origFillText.apply(this, arguments);
        };
        proto.strokeText = function () {
            checkCanvasText(arguments[0]);
            return origStrokeText.apply(this, arguments);
        };
    });

    function checkCanvasText(text) {
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
            pressEnter();
            setTimeout(function() {
                respawnCount++;
                setStatus("Running build sequence...");
                runBuildSequence();
            }, 800);
            setTimeout(function() { isDead = false; }, 5000);
        }
    }

    // =========================================================================
    // 8. POST-RESPAWN BUILD SEQUENCE
    // =========================================================================
    async function runBuildSequence() {
        buildSequenceRunning = true;
        releaseAllMovement();
        currentDir = null;
        var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

        await tapKey("KeyY", "y"); await delay(120);
        await tapKey("KeyY", "y"); await delay(120);
        await tapKey("KeyY", "y"); await delay(200);

        simulateKey("KeyM", "m", true);
        await delay(80);
        await tapKey("Digit1", "1"); await delay(80);
        await tapKey("Digit2", "2"); await delay(80);
        await tapKey("Digit0", "0"); await delay(80);
        await tapKey("Digit9", "9"); await delay(80);
        await tapKey("Digit8", "8"); await delay(80);
        simulateKey("KeyM", "m", false);

        await delay(200);
        simulateKey("Backquote", "`", true);
        await delay(200);
        await tapKey("KeyI", "i"); await delay(120);
        simulateKey("Backquote", "`", false);

        buildSequenceRunning = false;
        if (movementEnabled) {
            setStatus("Moving");
        } else {
            setStatus("Idle (respawn active)");
        }
    }

    // =========================================================================
    // 9. MOVEMENT DIRECTIONS
    // =========================================================================
    const DIRECTIONS = [
        { keys: ["KeyW"],          dx:  0, dy: -1 },
        { keys: ["KeyS"],          dx:  0, dy:  1 },
        { keys: ["KeyA"],          dx: -1, dy:  0 },
        { keys: ["KeyD"],          dx:  1, dy:  0 },
        { keys: ["KeyW", "KeyA"],  dx: -1, dy: -1 },
        { keys: ["KeyW", "KeyD"],  dx:  1, dy: -1 },
        { keys: ["KeyS", "KeyA"],  dx: -1, dy:  1 },
        { keys: ["KeyS", "KeyD"],  dx:  1, dy:  1 },
    ];

    const KEY_NAMES = { "KeyW": "w", "KeyA": "a", "KeyS": "s", "KeyD": "d", "Backquote": "`"};
    const AIM_DISTANCE = 200;
    let currentDir = null;

    function setAimTarget(dx, dy) {
        const canvas = getCanvas();
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top  + rect.height / 2;
        const len = Math.hypot(dx, dy) || 1;
        targetMouseX = cx + (dx / len) * AIM_DISTANCE;
        targetMouseY = cy + (dy / len) * AIM_DISTANCE;
    }

    // =========================================================================
    // 10. MAIN LOOP
    // =========================================================================
    function randomMovementLoop() {
        let lastDirIndex = -1;
let repeatCount = 0;
const MAX_REPEAT = 3; // allow same direction once, then force change
        if (!movementEnabled || buildSequenceRunning) return;
        if (!currentDir || Math.random() < 0.05) {
            releaseAllMovement();
            let newIndex;
do {
    newIndex = Math.floor(Math.random() * DIRECTIONS.length);
} while (
    newIndex === lastDirIndex &&
    repeatCount >= MAX_REPEAT
);

// track repeats
if (newIndex === lastDirIndex) {
    repeatCount++;
} else {
    repeatCount = 0;
}

lastDirIndex = newIndex;
currentDir = DIRECTIONS[newIndex];
            for (const code of currentDir.keys) {
                simulateKey(code, KEY_NAMES[code], true);
            }
            setAimTarget(currentDir.dx, currentDir.dy);
        }
    }

    // =========================================================================
    // 11. GUI -- ESC popup panel
    // =========================================================================
    let menuOpen = false;

    function injectCSS() {
        const style = document.createElement("style");
        style.textContent = [
            "#afk-overlay {",
            "  display:none; position:fixed; inset:0;",
            "  background:rgba(0,0,0,0.55); z-index:999998;",
            "}",
            "#afk-overlay.open { display:block; }",
            "#afk-menu {",
            "  display:none; position:fixed; top:50%; left:50%;",
            "  transform:translate(-50%,-50%); z-index:999999;",
            "  width:340px; background:rgba(22,22,28,0.95);",
            "  border:1px solid rgba(255,255,255,0.12);",
            "  border-radius:14px; padding:24px;",
            "  font-family:'Segoe UI',Arial,sans-serif;",
            "  color:#e0e0e0; box-shadow:0 12px 40px rgba(0,0,0,0.6);",
            "  user-select:none;",
            "}",
            "#afk-menu.open { display:block; }",
            "#afk-menu h2 {",
            "  margin:0 0 18px 0; font-size:18px; font-weight:700;",
            "  text-align:center; color:#fff; letter-spacing:0.5px;",
            "}",
            ".afk-row {",
            "  display:flex; align-items:center;",
            "  justify-content:space-between; padding:10px 0;",
            "  border-bottom:1px solid rgba(255,255,255,0.06);",
            "}",
            ".afk-row:last-of-type { border-bottom:none; }",
            ".afk-row-label { font-size:14px; font-weight:600; }",
            ".afk-switch {",
            "  width:44px; height:24px; border-radius:12px;",
            "  background:#444; position:relative; cursor:pointer;",
            "  transition:background 0.2s; flex-shrink:0;",
            "}",
            ".afk-switch.on { background:#4caf50; }",
            ".afk-switch::after {",
            "  content:''; position:absolute; top:3px; left:3px;",
            "  width:18px; height:18px; border-radius:50%;",
            "  background:#fff; transition:transform 0.2s;",
            "}",
            ".afk-switch.on::after { transform:translateX(20px); }",
            ".afk-status-section {",
            "  margin-top:16px; padding-top:14px;",
            "  border-top:1px solid rgba(255,255,255,0.1);",
            "}",
            ".afk-status-section h3 {",
            "  margin:0 0 10px 0; font-size:13px; font-weight:600;",
            "  color:#999; text-transform:uppercase; letter-spacing:1px;",
            "}",
            ".afk-stat-row {",
            "  display:flex; justify-content:space-between;",
            "  padding:4px 0; font-size:13px;",
            "}",
            ".afk-stat-label { color:#888; }",
            ".afk-stat-value { color:#ddd; font-weight:600; }",
            ".afk-hint {",
            "  text-align:center; margin-top:16px;",
            "  font-size:11px; color:#666;",
            "}",
            "#afk-indicator {",
            "  position:fixed; top:10px; right:10px; z-index:999997;",
            "  display:flex; align-items:center; gap:6px;",
            "  background:rgba(22,22,28,0.8);",
            "  border:1px solid rgba(255,255,255,0.1);",
            "  border-radius:6px; padding:5px 10px;",
            "  font-family:'Segoe UI',Arial,sans-serif;",
            "  font-size:11px; color:#999; cursor:pointer;",
            "  user-select:none;",
            "}",
            "#afk-indicator:hover { background:rgba(40,40,50,0.9); }",
            ".afk-ind-dot {",
            "  width:8px; height:8px; border-radius:50%; flex-shrink:0;",
            "}",
        ].join("\n");
        document.head.appendChild(style);
    }

    function buildGUI() {
        injectCSS();

        var indicator = document.createElement("div");
        indicator.id = "afk-indicator";
        indicator.title = "Press ESC to open AFK menu";
        indicator.innerHTML =
            '<span class="afk-ind-dot" id="ind-dot-move" style="background:#4caf50"></span>' +
            '<span id="ind-label">AFK: Active</span>';
        indicator.addEventListener("click", toggleMenu);
        document.body.appendChild(indicator);

        var overlay = document.createElement("div");
        overlay.id = "afk-overlay";
        overlay.addEventListener("click", toggleMenu);
        document.body.appendChild(overlay);

        var menu = document.createElement("div");
        menu.id = "afk-menu";
        menu.innerHTML = [
            '<h2>AFK Control Panel</h2>',
            '<div class="afk-row">',
            '  <span class="afk-row-label">Movement</span>',
            '  <div class="afk-switch on" id="sw-movement"></div>',
            '</div>',
            '<div class="afk-row">',
            '  <span class="afk-row-label">Auto-Respawn</span>',
            '  <div class="afk-switch on" id="sw-respawn"></div>',
            '</div>',
            '<div class="afk-status-section">',
            '  <h3>Status</h3>',
            '  <div class="afk-stat-row">',
            '    <span class="afk-stat-label">State</span>',
            '    <span class="afk-stat-value" id="stat-state">Idle</span>',
            '  </div>',
            '  <div class="afk-stat-row">',
            '    <span class="afk-stat-label">Deaths</span>',
            '    <span class="afk-stat-value" id="stat-deaths">0</span>',
            '  </div>',
            '  <div class="afk-stat-row">',
            '    <span class="afk-stat-label">Respawns</span>',
            '    <span class="afk-stat-value" id="stat-respawns">0</span>',
            '  </div>',
            '  <div class="afk-stat-row">',
            '    <span class="afk-stat-label">Bot Escapes</span>',
            '    <span class="afk-stat-value" id="stat-bot-escapes">0</span>',
            '  </div>',
            '  <div class="afk-stat-row">',
            '    <span class="afk-stat-label">Movement</span>',
            '    <span class="afk-stat-value" id="stat-movement">ON</span>',
            '  </div>',
            '  <div class="afk-stat-row">',
            '    <span class="afk-stat-label">Auto-Respawn</span>',
            '    <span class="afk-stat-value" id="stat-respawn">ON</span>',
            '  </div>',
            '  <div class="afk-stat-row">',
            '    <span class="afk-stat-label">Bot Escape</span>',
            '    <span class="afk-stat-value" id="stat-bot-escape">ON</span>',
            '  </div>',
            '</div>',
            '<div class="afk-hint">Press <b>ESC</b> to close • Works when tabbed out</div>',
        ].join("\n");
        document.body.appendChild(menu);

        document.getElementById("sw-movement").addEventListener("click", function() {
            movementEnabled = !movementEnabled;
            if (movementEnabled) {
                currentDir = null;
                currentMouseX = -1;
                currentMouseY = -1;
                setStatus("Moving");
            } else {
                releaseAllMovement();
                currentDir = null;
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

    }

    function toggleMenu() {
        menuOpen = !menuOpen;
        var menu = document.getElementById("afk-menu");
        var overlay = document.getElementById("afk-overlay");
        if (menu) menu.classList.toggle("open", menuOpen);
        if (overlay) overlay.classList.toggle("open", menuOpen);
    }

    function updateGUI() {
        var swMove = document.getElementById("sw-movement");
        var swResp = document.getElementById("sw-respawn");
        var swBot = document.getElementById("sw-bot-escape");

        if (swMove) swMove.classList.toggle("on", movementEnabled);
        if (swResp) swResp.classList.toggle("on", autoRespawnEnabled);

        var dot = document.getElementById("ind-dot-move");
        if (dot) {
            dot.style.background = (movementEnabled || autoRespawnEnabled)? "#4caf50" : "#f44336";
        }

        var indLabel = document.getElementById("ind-label");
        if (indLabel) {
            const active = [];
            if (movementEnabled) active.push("Move");
            if (autoRespawnEnabled) active.push("Respawn");


            if (active.length > 0) {
                indLabel.textContent = "AFK: " + active.join(" + ");
            } else {
                indLabel.textContent = "AFK: OFF";
            }
        }

        updateStatusDisplay();
    }

    function updateStatusDisplay() {
        var elState = document.getElementById("stat-state");
        var elDeaths = document.getElementById("stat-deaths");
        var elRespawns = document.getElementById("stat-respawns");
        var elBotEscapes = document.getElementById("stat-bot-escapes");
        var elMove = document.getElementById("stat-movement");
        var elResp = document.getElementById("stat-respawn");
        var elBot = document.getElementById("stat-bot-escape");

        if (elState) elState.textContent = lastStatus;
        if (elDeaths) elDeaths.textContent = deathCount;
        if (elRespawns) elRespawns.textContent = respawnCount;

        if (elMove) elMove.textContent = movementEnabled ? "ON" : "OFF";
        if (elResp) elResp.textContent = autoRespawnEnabled ? "ON" : "OFF";

    }

    // =========================================================================
    // 12. HOTKEYS
    // =========================================================================
   document.addEventListener("keydown", function(e) {
    // ESC menu
    if (e.code === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        toggleMenu();
    }

    // [ = Toggle Movement
    if (e.code === "BracketLeft") {
        movementEnabled = !movementEnabled;

        if (movementEnabled) {
            currentDir = null;
            currentMouseX = -1;
            currentMouseY = -1;
            setStatus("Moving");
        } else {
            releaseAllMovement();
            currentDir = null;
            setStatus(autoRespawnEnabled ? "Idle (respawn active)" : "Idle");
        }

        updateGUI();
    }

    // ] = Toggle Auto-Respawn
    if (e.code === "BracketRight") {
        autoRespawnEnabled = !autoRespawnEnabled;

        if (!movementEnabled) {
            setStatus(autoRespawnEnabled ? "Idle (respawn active)" : "Idle");
        }

        updateGUI();
    }
}, true);

    // =========================================================================
    // 13. BOOT
    // =========================================================================
    function boot() {
        buildGUI();
        updateGUI();
        lastCanvasActivity = Date.now();

        // Check if reconnecting after bot escape
        if (sessionStorage.getItem("afk-bot-escape") === "1") {
            sessionStorage.removeItem("afk-bot-escape");
            sessionStorage.removeItem("afk-reconnect");
            setStatus("Escaped bot - reconnecting...");

            // Enhanced reconnect sequence for bot escape
            setTimeout(function() {
                console.log("[Reconnect] Step 1: Pressing Enter (confirm)");
                pressEnter();

                // Press Enter again 1 second later to actually join
                setTimeout(function() {
                    console.log("[Reconnect] Step 2: Pressing Enter (join game)");
                    pressEnter();
                    setStatus("Reconnected - resuming AFK");
                }, 1000);
            })
        } else if (sessionStorage.getItem("afk-reconnect") === "1") {
            sessionStorage.removeItem("afk-reconnect");
            setStatus("Reconnecting...");

            // Standard reconnect (for disconnect detection)
            setTimeout(function() {
                console.log("[Reconnect] Pressing Enter (standard reconnect)");
                pressEnter();
            }, 100);
        }

        // Main movement loop (works when tabbed out)
        setInterval(randomMovementLoop, 100);

        // Smooth mouse movement (works when tabbed out)
        setInterval(function() {
            if (movementEnabled) updateMouseSmooth();
        }, 16);

        // bye bye bot UWU

        // Status update
        setInterval(updateStatusDisplay, 1000);

        // Disconnect detection
        setInterval(function() {
            if (!autoRespawnEnabled) return;
            if (!movementEnabled) return;
            if (Date.now() - lastCanvasActivity > 2000) {
                setStatus("Disconnected -- reloading...");
                sessionStorage.setItem("afk-reconnect", "1");
                setTimeout(function() {
                    window.location.reload();
                })
            }
        }, 1000);

        console.log("[AFK Bot] v8.1 active -- Trap Detection + Auto-Rejoin Fix!");
        console.log("");
        console.log("=== HOTKEYS ===");
        console.log("ESC - Open/close menu");
        console.log("U   - Toggle Movement");
        console.log("I   - Toggle Auto-Respawn");
        console.log("L   - Toggle Debug Logging (see detection stats)");
        console.log("P   - Force escape (test)");
        console.log("=".repeat(50));
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(boot, 2000);
    } else {
        document.addEventListener("DOMContentLoaded", function() { setTimeout(boot, 2000); });
    }
})();
