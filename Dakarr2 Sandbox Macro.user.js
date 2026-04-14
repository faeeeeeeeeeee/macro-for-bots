// ==UserScript==
// @name         Dakarr2 Sandbox Macro
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Build macro for dakarr2.cc sandbox server with pointer-lock fix. Press P to run macro.
// @match        *://dakarr2.cc/*
// @match        *://*.dakarr2.cc/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";

    // =========================================================================
    // 0. POINTER-LOCK TRACKING
    //    Keep track of whichever element currently owns the pointer lock so we
    //    can dispatch synthetic mouse events on it (regular dispatches on
    //    document/body are swallowed while pointer lock is active).
    // =========================================================================
    let pointerLockTarget = null;

    document.addEventListener("pointerlockchange", function () {
        pointerLockTarget = document.pointerLockElement || null;
    });

    // =========================================================================
    // 1. isTrusted BYPASS — keyboard events
    //    Many .io games reject synthetic KeyboardEvents whose isTrusted is
    //    false.  We wrap every keydown/keyup handler so it receives a proxy
    //    object with isTrusted forced to true.
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
                    keyCode: real.keyCode,
                    which: real.which,
                    shiftKey: real.shiftKey,
                    ctrlKey: real.ctrlKey,
                    altKey: real.altKey,
                    metaKey: real.metaKey,
                    repeat: real.repeat,
                    preventDefault: function () {},
                    stopPropagation: function () {},
                };
                return originalHandler.apply(this, [proxy]);
            };
        }
        return _origWindowAddEventListener.apply(this, args);
    };

    // =========================================================================
    // 2. isTrusted BYPASS — mouse events (on divs / canvas wrappers)
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
                    movementX: real.movementX,
                    movementY: real.movementY,
                    button: real.button,
                    buttons: real.buttons,
                    preventDefault: function () {},
                    stopPropagation: function () {},
                };
                return originalHandler.apply(this, [proxy]);
            };
        }
        return _origDivAddEventListener.apply(this, args);
    };

    const _origCanvasAddEventListener = HTMLCanvasElement.prototype.addEventListener;
    HTMLCanvasElement.prototype.addEventListener = function (...args) {
        const type = args[0];
        if (type === "mousedown" || type === "mouseup" || type === "mousemove") {
            const originalHandler = args[1];
            args[1] = function (...handlerArgs) {
                const real = handlerArgs[0];
                const proxy = {
                    isTrusted: true,
                    clientX: real.clientX,
                    clientY: real.clientY,
                    movementX: real.movementX,
                    movementY: real.movementY,
                    button: real.button,
                    buttons: real.buttons,
                    preventDefault: function () {},
                    stopPropagation: function () {},
                };
                return originalHandler.apply(this, [proxy]);
            };
        }
        return _origCanvasAddEventListener.apply(this, args);
    };

    // =========================================================================
    // 3. KEY SIMULATION HELPERS
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
        return new Promise(function (resolve) {
            activeKeys[code] = false;
            simulateKey(code, keyName, true);
            setTimeout(function () {
                simulateKey(code, keyName, false);
                resolve();
            }, duration);
        });
    }

    // =========================================================================
    // 4. MOUSE-CLICK SIMULATION (pointer-lock aware)
    //    When the page holds a pointer lock the browser silently drops
    //    MouseEvents dispatched on anything other than the locked element.
    //    We detect the lock and target the correct element automatically.
    // =========================================================================
    let cachedCanvas = null;
    function getCanvas() {
        if (!cachedCanvas || !document.contains(cachedCanvas)) {
            cachedCanvas =
                document.querySelector("#canvas canvas") ||
                document.querySelector("#canvas") ||
                document.querySelector("canvas");
        }
        return cachedCanvas;
    }

    function simulateLeftClick() {
        // Prefer the pointer-locked element, then the canvas, then body.
        const target = pointerLockTarget || getCanvas() || document.body;

        const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

        target.dispatchEvent(
            new MouseEvent("mousedown", {
                button: 0,
                buttons: 1,
                clientX: center.x,
                clientY: center.y,
                bubbles: true,
                cancelable: true,
                view: window,
            })
        );

        setTimeout(function () {
            target.dispatchEvent(
                new MouseEvent("mouseup", {
                    button: 0,
                    buttons: 0,
                    clientX: center.x,
                    clientY: center.y,
                    bubbles: true,
                    cancelable: true,
                    view: window,
                })
            );
        }, 60);
    }

    // =========================================================================
    // 5. THE MACRO
    //    Sequence (all in order):
    //      1. Hold  ` (Backquote)
    //      2. Press 2
    //      3. Release `
    //      4. Press I
    //      5. Hold  M
    //      6. Press 6  5  4  7  3
    //      7. Release M
    //      8. Left-click
    // =========================================================================
    let macroRunning = false;

    async function runMacro() {
        if (macroRunning) return;
        macroRunning = true;
        console.log("[Dakarr2 Macro] Running build sequence...");

        var delay = function (ms) {
            return new Promise(function (r) {
                setTimeout(r, ms);
            });
        };

        // 1. Hold backtick
        simulateKey("Backquote", "`", true);
        await delay(80);

        // 2. Press 2
        await tapKey("Digit2", "2");
        await delay(80);

        // 3. Release backtick
        simulateKey("Backquote", "`", false);
        await delay(100);

        // 4. Press I
        await tapKey("KeyI", "i");
        await delay(100);

        // 5. Hold M
        simulateKey("KeyM", "m", true);
        await delay(80);

        // 6. Press 6, 5, 4, 7, 3
        await tapKey("Digit6", "6");
        await delay(80);
        await tapKey("Digit5", "5");
        await delay(80);
        await tapKey("Digit4", "4");
        await delay(80);
        await tapKey("Digit7", "7");
        await delay(80);
        await tapKey("Digit3", "3");
        await delay(80);

        // 7. Release M
        simulateKey("KeyM", "m", false);
        await delay(100);

        // 8. Left-click
        simulateLeftClick();

        macroRunning = false;
        console.log("[Dakarr2 Macro] Build sequence complete.");
    }

    // =========================================================================
    // 6. HOTKEY  (press P to fire the macro)
    // =========================================================================
    document.addEventListener(
        "keydown",
        function (e) {
            if (e.code === "KeyP" && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                runMacro();
            }
        },
        true
    );

    // =========================================================================
    // 7. BOOT MESSAGE
    // =========================================================================
    function boot() {
        console.log("[Dakarr2 Macro] v1.0.0 loaded for sandbox server");
        console.log("[Dakarr2 Macro] Press P to run build macro");
        console.log(
            "[Dakarr2 Macro] Sequence: ` hold → 2 → ` release → I → M hold → 6 5 4 7 3 → M release → left-click"
        );
    }

    if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
    ) {
        setTimeout(boot, 1000);
    } else {
        document.addEventListener("DOMContentLoaded", function () {
            setTimeout(boot, 1000);
        });
    }
})();
