// ==UserScript==
// @name         Conisu's Controller v4
// @namespace    http://tampermonkey.net/
// @version      v4.2
// @description  Advanced Arras.io bot controller — full tank database
// @author       Conisu + Starflex
// @match        *://arras.io/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const tanks = {
        basic:               { name: "Basic",                build: "" },
        pursuer:             { name: "Pursuer",              build: "8/9/0/0/0/0/0/9/8/8" },
        shotgun:             { name: "Shotgun",              build: "0/4/6/7/7/7/7/4" },
        penta:               { name: "Penta Shot",           build: "0/4/6/7/7/7/7/4" },
        spread:              { name: "Spreadshot",           build: "0/4/6/7/7/7/7/4" },
        octo:                { name: "Octo Tank",            build: "0/4/6/7/7/7/7/4" },
        autogunner:          { name: "Auto Gunner",          build: "0/4/6/7/7/7/7/4" },
        triplet:             { name: "Triplet",              build: "0/4/6/7/7/7/7/4" },
        predator:            { name: "Predator",             build: "0/4/6/7/7/7/7/4" },
        triplex:             { name: "Triplex",              build: "0/4/6/7/7/7/7/4" },
        quadruplex:          { name: "Quadruplex",           build: "0/4/6/7/7/7/7/4" },
        machinegunner:       { name: "Machine Gunner",       build: "0/4/6/7/7/7/7/4" },
        cyclone:             { name: "Cyclone",              build: "0/4/6/7/7/7/7/4" },
        factory:             { name: "Factory",              build: "0/4/6/7/7/7/7/4" },
        septatrap:           { name: "Septa Trapper",        build: "0/6/0/9/9/9/9" },
        anni:                { name: "Annihilator",          build: "0/4/6/7/7/7/7/4" },
        obliterator:         { name: "Obliterator",          build: "0/4/6/7/7/7/7/4" },
        compound:            { name: "Compound",             build: "0/4/6/7/7/7/7/4" },
        wiper:               { name: "Wiper",                build: "0/4/6/7/7/7/7/4" },
        stomper:             { name: "Stomper",              build: "0/4/6/7/7/7/7/4" },
        autoanni:            { name: "Auto Anni",            build: "0/4/6/7/7/7/7/4" },
        shaver:              { name: "Shaver",               build: "0/4/6/7/7/7/7/4" },
        eradicator:          { name: "Eradicator",           build: "0/4/6/7/7/7/7/4" },
        whirlwind:           { name: "Whirlwind",            build: "9/9/0/0/0/0/9" },
        tempest:             { name: "Tempest",              build: "9/9/0/0/0/0/9" },
        septamech:           { name: "Septa Mech",           build: "9/9/0/0/0/0/9" },
        doubleequalizer:     { name: "Double Equalizer",     build: "9/9/0/0/0/0/9" },
        rigger:              { name: "Rigger",               build: "9/9/0/0/0/0/9" },
        doublespread:        { name: "Double Spread",        build: "9/9/0/0/0/0/9" },
        palisade:            { name: "Palisade",             build: "9/9/0/0/0/0/9" },
        megasmasher:         { name: "Mega Smasher",         build: "9/12/0/0/0/0/0/12/3/6" },
        spike:               { name: "Spike",                build: "9/12/0/0/0/0/0/12/3/6" },
        autoshasher:         { name: "Auto Smasher",         build: "9/12/0/0/0/0/0/12/3/6" },
        landmine:            { name: "Landmine",             build: "9/12/0/0/0/0/0/12/3/6" },
        thorn:               { name: "Thorn",                build: "9/12/0/0/0/0/0/12/3/6" },
        megaspike:           { name: "Mega Spike",           build: "12/12/0/0/0/0/0/7/3/8" },
        claymore:            { name: "Claymore",             build: "9/12/0/0/0/0/0/12/3/6" },
        spear:               { name: "Spear",                build: "9/12/0/0/0/0/0/12/3/6" },
        prick:               { name: "Prick",                build: "9/12/0/0/0/0/0/12/3/6" },
        slammer:             { name: "Slammer",              build: "8/10/12/0/0/0/0/12" },
        basher:              { name: "Basher",               build: "8/10/12/0/0/0/0/12" },
        phys:                { name: "Physicist",            build: "9/12/0/0/0/0/0/12/3/6" },
        toppler:             { name: "Toppler",              build: "0/4/6/7/7/7/7/4" },
        autooperator:        { name: "Auto Operator",        build: "0/4/6/7/7/7/7/4" },
        lorry:               { name: "Lorry",                build: "0/4/6/7/7/7/7/4" },
        gale:                { name: "Gale",                 build: "2/2/2/8/6/8/9/5/0/0" },
        crackshot:           { name: "Crackshot",            build: "2/2/2/8/6/8/9/5/0/0" },
        engineer:            { name: "Engineer",             build: "0/4/6/7/7/7/7/4" },
        assembler:           { name: "Assembler",            build: "0/4/6/7/7/7/7/4" },
        architect:           { name: "Architect",            build: "0/4/6/7/7/7/7/4" },
        auto5:               { name: "Auto 5",               build: "0/4/6/7/7/7/7/4" },
        mega3:               { name: "Mega 3",               build: "0/4/6/7/7/7/7/4" },
        auto6:               { name: "Auto 6",               build: "0/4/6/7/7/7/7/4" },
        auto7:               { name: "Auto 7",               build: "0/4/6/7/7/7/7/4" },
        mega5:               { name: "Mega 5",               build: "0/4/6/7/7/7/7/4" },
        autoauto4:           { name: "Auto Auto 4",          build: "0/4/6/7/7/7/7/4" },
        hurler3:             { name: "Hurler 3",             build: "0/4/6/7/7/7/7/4" },
        batter4:             { name: "Batter 4",             build: "0/4/6/7/7/7/7/4" },
        skimmer:             { name: "Skimmer",              build: "0/4/6/7/7/7/7/4" },
        twister:             { name: "Twister",              build: "0/4/6/7/7/7/7/4" },
        swarmer:             { name: "Swarmer",              build: "0/4/6/7/7/7/7/4" },
        sidewinder:          { name: "Sidewinder",           build: "0/4/6/7/7/7/7/4" },
        fieldgun:            { name: "Field Gun",            build: "0/4/6/7/7/7/7/4" },
        spinner:             { name: "Spinner",              build: "0/4/6/7/7/7/7/4" },
        helix_ar:            { name: "Helix",                build: "0/4/6/7/7/7/7/4" },
        hypertwister:        { name: "Hyper Twister",        build: "0/4/6/7/7/7/7/4" },
        gyro:                { name: "Gyro",                 build: "0/4/6/7/7/7/7/4" },
        coli:                { name: "Coli",                 build: "0/4/6/7/7/7/7/4" },
        hyperskimmer:        { name: "Hyper Skimmer",        build: "0/4/6/7/7/7/7/4" },
        skidder:             { name: "Skidder",              build: "0/4/6/7/7/7/7/4" },
        ream:                { name: "Ream",                 build: "0/4/6/7/7/7/7/4" },
        hyperswarmer:        { name: "Hyper Swarmer",        build: "0/4/6/7/7/7/7/4" },
        molotov:             { name: "Molotov",              build: "0/4/6/7/7/7/7/4" },
        firework:            { name: "Firework",             build: "0/4/6/7/7/7/7/4" },
        levi:                { name: "Levi",                 build: "0/4/6/7/7/7/7/4" },
        hypercluster:        { name: "Hyper Cluster",        build: "0/4/6/7/7/7/7/4" },
        neutron:             { name: "Neutron",              build: "0/4/6/7/7/7/7/4" },
        overczar:            { name: "OverCzar",             build: "0/4/6/7/7/7/7/4" },
        tyrant:              { name: "Tyrant",               build: "0/4/6/7/7/7/7/4" },
        autooverlord:        { name: "Auto Overlord",        build: "0/4/6/7/7/7/7/4" },
        megaautooverseer:    { name: "Mega Auto Overseer",   build: "0/4/6/7/7/7/7/4" },
        tripleautooverseer:  { name: "Triple Auto Overseer", build: "0/4/6/7/7/7/7/4" },
        autooverdrive:       { name: "Auto Overdrive",       build: "0/4/6/7/7/7/7/4" },
        headman:             { name: "Headman",              build: "0/4/6/7/7/7/7/4" },
        overcheese:          { name: "Overcheese",           build: "0/4/6/7/7/7/7/4" },
        overstorm:           { name: "Overstorm",            build: "0/4/6/7/7/7/7/4" },
        diviner:             { name: "Diviner",              build: "0/4/6/7/7/7/7/4" },
        autonecro:           { name: "Auto Necro",           build: "0/4/6/7/7/7/7/4" },
        necrodrive:          { name: "Necrodrive",           build: "0/4/6/7/7/7/7/4" },
        megaautounderdrive:  { name: "Mega Auto Underdrive", build: "0/4/6/7/7/7/7/4" },
        tripleautounderdrive:{ name: "Triple Auto Underdrive",build: "0/4/6/7/7/7/7/4" },
        pentamancer:         { name: "Pentamancer",          build: "0/4/6/7/7/7/7/4" },
        pentadrive:          { name: "Pentadrive",           build: "0/4/6/7/7/7/7/4" },
        warlock:             { name: "Warlock",              build: "0/4/6/7/7/7/7/4" },
        autopentaseer:       { name: "Auto Pentaseer",       build: "0/4/6/7/7/7/7/4" },
        warship:             { name: "Warship",              build: "0/4/6/7/7/7/7/4" },
        battlerdrive:        { name: "Battler Drive",        build: "0/4/6/7/7/7/7/4" },
        bismarck:            { name: "Bismarck",             build: "0/4/6/7/7/7/7/4" },
        proddrive:           { name: "Prod Drive",           build: "0/4/6/7/7/7/7/4" },
        manufacture:         { name: "Manufacture",          build: "0/4/6/7/7/7/7/4" },
        dirigible:           { name: "Dirigible",            build: "0/4/6/7/7/7/7/4" },
        autobattleship:      { name: "Auto Battleship",      build: "0/4/6/7/7/7/7/4" },
        autoprod:            { name: "Auto Prod",            build: "0/4/6/7/7/7/7/4" },
        autocruiserdrive:    { name: "Auto Cruiser Drive",   build: "0/4/6/7/7/7/7/4" },
        rocket:              { name: "Rocket",               build: "8/8/0/0/0/0/8/8/2/8" },
        fighter:             { name: "Fighter",              build: "2/2/2/8/6/8/9/5/0/0" },
        bomber:              { name: "Bomber",               build: "0/2/3/7/7/7/7/7" },
        autotriangle:        { name: "Auto Triangle",        build: "0/2/3/7/7/7/7/7" },
        surfer:              { name: "Surfer",               build: "0/2/3/7/7/7/7/7" },
        eagle:               { name: "Eagle",                build: "0/2/3/7/7/7/7/7" },
        phoenix:             { name: "Phoenix",              build: "0/2/3/7/7/7/7/7" },
        vulture:             { name: "Vulture",              build: "0/2/3/7/7/7/7/7" },
        browser:             { name: "Browser",              build: "0/2/3/7/7/7/7/7" },
        surferdrive:         { name: "Surfer Drive",         build: "0/2/3/7/7/7/7/7" },
        roller:              { name: "Roller",               build: "0/2/3/7/7/7/7/7" },
        strider:             { name: "Strider",              build: "0/2/3/7/7/7/7/7" },
        megaautotriangle:    { name: "Mega Auto Triangle",   build: "0/2/3/7/7/7/7/7" },
        tripleautotriangle:  { name: "Triple Auto Triangle", build: "0/2/3/7/7/7/7/7" },
        autofighter:         { name: "Auto Fighter",         build: "0/2/3/7/7/7/7/7" },
        autobomber:          { name: "Auto Bomber",          build: "0/2/3/7/7/7/7/7" },
        kicker:              { name: "Kicker",               build: "0/2/3/7/7/7/7/7" },
        electrocutor:        { name: "Electrocutor",         build: "0/2/3/7/7/7/7/7" },
        autoeagle:           { name: "Auto Eagle",           build: "0/2/3/7/7/7/7/7" },
        griffin:             { name: "Griffin",              build: "0/2/3/7/7/7/7/7" },
    };

    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        #cc-root * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }

        #cc-root {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: clamp(340px, 38vw, 520px); max-height: 90vh;
            background: #faf9ff; border-radius: 20px; border: 1.5px solid #e2dff7;
            box-shadow: 0 8px 48px rgba(130,100,200,0.13), 0 2px 12px rgba(130,100,200,0.08);
            display: flex; flex-direction: column; overflow: hidden; z-index: 999999;
            user-select: none; color: #2a2540;
        }

        #cc-root .cc-bar { height: 3px; background: linear-gradient(90deg,#b5b0f7,#f7b5d6,#b5e8f5,#b5f7d0); flex-shrink: 0; }

        #cc-root .cc-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 18px 10px; cursor: grab; flex-shrink: 0;
        }
        #cc-root .cc-header:active { cursor: grabbing; }
        #cc-root .cc-title { display: flex; align-items: center; gap: 9px; }
        #cc-root .cc-title svg { flex-shrink: 0; }
        #cc-root .cc-title-text { font-size: 16px; font-weight: 600; color: #2a2540; letter-spacing: -0.2px; }
        #cc-root .cc-title-sub  { font-size: 11px; color: #a09bc2; margin-top: 1px; }

        #cc-root .cc-status {
            display: flex; align-items: center; gap: 6px; padding: 5px 11px;
            border-radius: 999px; font-size: 12px; font-weight: 500;
            background: #fde8e8; color: #c0525a; border: 1px solid #f4c5c8;
            transition: background 0.3s, color 0.3s;
        }
        #cc-root .cc-status.connected { background: #e6f9f0; color: #2f9e6e; border-color: #b3ecd4; }
        #cc-root .cc-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

        #cc-root .cc-body {
            flex: 1; overflow-y: auto; padding: 6px 16px 16px;
            scrollbar-width: thin; scrollbar-color: #ddd9f7 transparent;
        }
        #cc-root .cc-body::-webkit-scrollbar { width: 5px; }
        #cc-root .cc-body::-webkit-scrollbar-thumb { background: #ddd9f7; border-radius: 99px; }

        #cc-root .cc-section { margin-bottom: 14px; }
        #cc-root .cc-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #b0aad0; margin-bottom: 7px; }
        #cc-root .cc-row { display: flex; gap: 8px; }

        #cc-root .cc-btn {
            flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
            padding: 9px 12px; border: 1.5px solid transparent; border-radius: 10px;
            font-size: 12.5px; font-weight: 500; cursor: pointer;
            transition: transform 0.1s, filter 0.15s; white-space: nowrap;
        }
        #cc-root .cc-btn:hover  { filter: brightness(0.95); }
        #cc-root .cc-btn:active { transform: scale(0.97); }
        #cc-root .cc-btn-purple { background: #eeedfe; color: #534ab7; border-color: #d4d0f8; }
        #cc-root .cc-btn-pink   { background: #fbeaf0; color: #993556; border-color: #f4c0d1; }
        #cc-root .cc-btn-teal   { background: #e1f5ee; color: #0f6e56; border-color: #9fe1cb; }
        #cc-root .cc-btn-blue   { background: #e6f1fb; color: #185fa5; border-color: #b5d4f4; }
        #cc-root .cc-btn-amber  { background: #faeeda; color: #854f0b; border-color: #fac775; }
        #cc-root .cc-btn-red    { background: #fcebeb; color: #a32d2d; border-color: #f7c1c1; }

        #cc-root input[type="text"],
        #cc-root input[type="search"] {
            width: 100%; padding: 9px 12px; border: 1.5px solid #e2dff7;
            border-radius: 10px; background: #fff; color: #2a2540;
            font-size: 13px; outline: none; transition: border-color 0.15s;
        }
        #cc-root input[type="text"]:focus,
        #cc-root input[type="search"]:focus { border-color: #b5b0f7; }

        #cc-root .cc-tank-category {
            padding: 5px 12px 3px; font-size: 9px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 1px; color: #c5bff0;
            background: #f8f7ff; border-bottom: 1px solid #f2f0fc;
            position: sticky; top: 0;
        }

        #cc-tank-list {
            max-height: 220px; overflow-y: auto; border: 1.5px solid #e2dff7;
            border-radius: 10px; background: #fff; margin-top: 7px;
            scrollbar-width: thin; scrollbar-color: #ddd9f7 transparent;
        }
        #cc-tank-list::-webkit-scrollbar { width: 4px; }
        #cc-tank-list::-webkit-scrollbar-thumb { background: #ddd9f7; border-radius: 99px; }

        #cc-root .cc-tank-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f2f0fc;
            transition: background 0.1s;
        }
        #cc-root .cc-tank-item:last-child { border-bottom: none; }
        #cc-root .cc-tank-item:hover      { background: #f5f3ff; }
        #cc-root .cc-tank-item.selected   { background: #eeedfe; }
        #cc-root .cc-tank-name  { font-size: 13px; font-weight: 500; color: #2a2540; }
        #cc-root .cc-tank-item.selected .cc-tank-name { color: #534ab7; }
        #cc-root .cc-tank-build { font-size: 10px; color: #b0aad0; font-family: 'Courier New', monospace; margin-top: 1px; }
        #cc-root .cc-tank-check {
            width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #d4d0f8;
            background: #fff; flex-shrink: 0; margin-left: 8px;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s, border-color 0.15s;
        }
        #cc-root .cc-tank-item.selected .cc-tank-check { background: #7f77dd; border-color: #7f77dd; }

        #cc-root .cc-toggle-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; background: #fff; border: 1.5px solid #e2dff7;
            border-radius: 10px; margin-bottom: 6px; cursor: pointer;
        }
        #cc-root .cc-toggle-row:last-child { margin-bottom: 0; }
        #cc-root .cc-toggle-left { display: flex; align-items: center; gap: 9px; }
        #cc-root .cc-toggle-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        #cc-root .cc-toggle-label { font-size: 13px; font-weight: 500; color: #2a2540; }
        #cc-root .cc-toggle-desc  { font-size: 11px; color: #b0aad0; }

        #cc-root .cc-switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
        #cc-root .cc-switch input { display: none; }
        #cc-root .cc-switch-track { position: absolute; inset: 0; border-radius: 99px; background: #e2dff7; transition: background 0.2s; }
        #cc-root .cc-switch input:checked + .cc-switch-track { background: #7f77dd; }
        #cc-root .cc-switch-thumb { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
        #cc-root .cc-switch input:checked ~ .cc-switch-thumb { transform: translateX(16px); }

        #cc-root .cc-stats { display: flex; gap: 8px; margin-bottom: 10px; }
        #cc-root .cc-stat { flex: 1; background: #fff; border: 1.5px solid #e2dff7; border-radius: 10px; padding: 9px 12px; text-align: center; }
        #cc-root .cc-stat-value { font-size: 20px; font-weight: 600; color: #534ab7; line-height: 1; }
        #cc-root .cc-stat-label { font-size: 10px; color: #b0aad0; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }

        #cc-log {
            background: #fff; border: 1.5px solid #e2dff7; border-radius: 10px;
            padding: 9px 12px; font-size: 11.5px; font-family: 'Courier New', monospace;
            color: #7a75a0; max-height: 100px; overflow-y: auto; line-height: 1.6;
            scrollbar-width: thin; scrollbar-color: #ddd9f7 transparent;
        }
        #cc-log::-webkit-scrollbar { width: 4px; }
        #cc-log::-webkit-scrollbar-thumb { background: #ddd9f7; border-radius: 99px; }
        #cc-log .log-time { color: #c5bff0; }

        #cc-root .cc-divider { height: 1px; background: #f0eefa; margin: 4px 0 14px; }

        /* Slider styling */
        #cc-root input[type="range"] {
            -webkit-appearance: none; appearance: none;
            width: 100%; height: 4px; border-radius: 99px;
            background: #e2dff7; outline: none; cursor: pointer;
        }
        #cc-root input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 16px; height: 16px; border-radius: 50%;
            background: #7f77dd; cursor: pointer;
            box-shadow: 0 1px 4px rgba(127,119,221,0.4);
        }
        #cc-root input[type="range"]::-moz-range-thumb {
            width: 16px; height: 16px; border-radius: 50%;
            background: #7f77dd; cursor: pointer; border: none;
            box-shadow: 0 1px 4px rgba(127,119,221,0.4);
        }
        .cc-slider-row { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
        .cc-slider-val { font-size: 11px; color: #7f77dd; font-weight: 600; min-width: 32px; text-align: right; }
        .cc-slider-labels { display: flex; justify-content: space-between; font-size: 10px; color: #c5bff0; margin-top: 2px; }

        #cc-root.cc-hidden { display: none !important; }
    `);

    const svg = {
        robot:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7f77dd" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="3"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><circle cx="9" cy="14" r="1.5" fill="#7f77dd" stroke="none"/><circle cx="15" cy="14" r="1.5" fill="#f7b5d6" stroke="none"/><path d="M9 17h6"/></svg>`,
        spawn:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
        kill:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
        corner:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
        target:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
        refresh: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>`,
        mouse:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="2" width="10" height="16" rx="5"/><line x1="12" y1="6" x2="12" y2="10"/></svg>`,
        meat:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a10 7 0 0 1 10 7c0 4-2 6-5 7l-5 6-5-6c-3-1-5-3-5-7a10 7 0 0 1 10-7z"/></svg>`,
        respawn: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>`,
        check:   `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        hash:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
        fire:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
        spin:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`,
        aim:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>`,
    };

    const root = document.createElement('div');
    root.id = 'cc-root';
    root.innerHTML = `
        <div class="cc-bar"></div>

        <div class="cc-header" id="cc-drag-handle">
            <div class="cc-title">
                ${svg.robot}
                <div>
                    <div class="cc-title-text">Bot Commander</div>
                    <div class="cc-title-sub">Press \` to hide / show</div>
                </div>
            </div>
            <div class="cc-status" id="cc-status">
                <div class="cc-status-dot"></div>
                <span id="cc-status-text">Connecting</span>
            </div>
        </div>

        <div class="cc-body">

            <div class="cc-stats">
                <div class="cc-stat">
                    <div class="cc-stat-value" id="cc-bot-count">0</div>
                    <div class="cc-stat-label">Active bots</div>
                </div>
                <div class="cc-stat">
                    <div class="cc-stat-value" id="cc-pos-x">—</div>
                    <div class="cc-stat-label">Player X</div>
                </div>
                <div class="cc-stat">
                    <div class="cc-stat-value" id="cc-pos-y">—</div>
                    <div class="cc-stat-label">Player Y</div>
                </div>
            </div>

            <div class="cc-section">
                <div class="cc-label">Server</div>
                <div class="cc-row" style="margin-bottom:8px">
                    <div style="position:relative;flex:1">
                        <div style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:#b0aad0">${svg.hash}</div>
                        <input type="text" id="cc-hash" placeholder="Server hash (e.g. ca3008)" style="padding-left:30px">
                    </div>
                </div>
                <div class="cc-row" style="margin-bottom:8px">
                    <input type="text" id="cc-server-url" placeholder="Bot server URL (ws:// or wss://)">
                </div>
                <div class="cc-row">
                    <button class="cc-btn cc-btn-purple" id="cc-reconnect">
                        ${svg.refresh} Reconnect
                    </button>
                    <button class="cc-btn cc-btn-red" id="cc-kill-all">
                        ${svg.kill} Kill all bots
                    </button>
                </div>
            </div>

            <div class="cc-divider"></div>

            <div class="cc-section">
                <div class="cc-label">Tank selection <span id="cc-tank-count" style="font-weight:400;color:#c5bff0"></span></div>
                <input type="search" id="cc-search" placeholder="Search tanks…">
                <div id="cc-tank-list"></div>
            </div>

            <div class="cc-divider"></div>

            <div class="cc-section">
                <div class="cc-label">Spawn bots</div>
                <div class="cc-row">
                    <button class="cc-btn cc-btn-teal" id="cc-spawn1">${svg.spawn} +1</button>
                    <button class="cc-btn cc-btn-teal" id="cc-spawn5">${svg.spawn} +5</button>
                    <button class="cc-btn cc-btn-teal" id="cc-spawn10">${svg.spawn} +10</button>
                </div>
            </div>

            <div class="cc-section">
                <div class="cc-label">Bot controls</div>
                <div class="cc-row">
                    <button class="cc-btn cc-btn-blue" id="cc-corner">
                        ${svg.corner} Top-left corner
                    </button>
                    <button class="cc-btn cc-btn-pink" id="cc-to-me">
                        ${svg.target} My position
                    </button>
                </div>
            </div>

            <div class="cc-divider"></div>

            <div class="cc-section">
                <div class="cc-label">Options</div>

                <label class="cc-toggle-row" for="cc-mbs">
                    <div class="cc-toggle-left">
                        <div class="cc-toggle-icon" style="background:#eeedfe">${svg.mouse}</div>
                        <div>
                            <div class="cc-toggle-label">Mouse control</div>
                            <div class="cc-toggle-desc">Press L to start</div>
                        </div>
                    </div>
                    <label class="cc-switch">
                        <input type="checkbox" id="cc-mbs" checked>
                        <div class="cc-switch-track"></div>
                        <div class="cc-switch-thumb"></div>
                    </label>
                </label>

                <label class="cc-toggle-row" for="cc-feeding">
                    <div class="cc-toggle-left">
                        <div class="cc-toggle-icon" style="background:#faeeda">${svg.meat}</div>
                        <div>
                            <div class="cc-toggle-label">Feeding mode</div>
                            <div class="cc-toggle-desc">Hold right click</div>
                        </div>
                    </div>
                    <label class="cc-switch">
                        <input type="checkbox" id="cc-feeding">
                        <div class="cc-switch-track"></div>
                        <div class="cc-switch-thumb"></div>
                    </label>
                </label>

                <label class="cc-toggle-row" for="cc-respawn">
                    <div class="cc-toggle-left">
                        <div class="cc-toggle-icon" style="background:#e1f5ee">${svg.respawn}</div>
                        <div>
                            <div class="cc-toggle-label">Auto respawn</div>
                            <div class="cc-toggle-desc">Respawn on death</div>
                        </div>
                    </div>
                    <label class="cc-switch">
                        <input type="checkbox" id="cc-respawn" checked>
                        <div class="cc-switch-track"></div>
                        <div class="cc-switch-thumb"></div>
                    </label>
                </label>

                <label class="cc-toggle-row" for="cc-autofire">
                    <div class="cc-toggle-left">
                        <div class="cc-toggle-icon" style="background:#fcebeb">${svg.fire}</div>
                        <div>
                            <div class="cc-toggle-label">Auto fire</div>
                            <div class="cc-toggle-desc">Bots hold E on spawn</div>
                        </div>
                    </div>
                    <label class="cc-switch">
                        <input type="checkbox" id="cc-autofire">
                        <div class="cc-switch-track"></div>
                        <div class="cc-switch-thumb"></div>
                    </label>
                </label>

                <label class="cc-toggle-row" for="cc-autospin">
                    <div class="cc-toggle-left">
                        <div class="cc-toggle-icon" style="background:#eeedfe">${svg.spin}</div>
                        <div>
                            <div class="cc-toggle-label">Auto spin</div>
                            <div class="cc-toggle-desc">Bots hold C on spawn</div>
                        </div>
                    </div>
                    <label class="cc-switch">
                        <input type="checkbox" id="cc-autospin">
                        <div class="cc-switch-track"></div>
                        <div class="cc-switch-thumb"></div>
                    </label>
                </label>
            </div>

            <div class="cc-divider"></div>

            <div class="cc-section">
                <div class="cc-label">${svg.aim} &nbsp;Aim smoothing</div>
                <div style="background:#fff;border:1.5px solid #e2dff7;border-radius:10px;padding:10px 12px;">
                    <div class="cc-slider-row">
                        <input type="range" id="cc-smoothing" min="0.05" max="1" step="0.05" value="0.2">
                        <span class="cc-slider-val" id="cc-smooth-val">0.20</span>
                    </div>
                    <div class="cc-slider-labels">
                        <span>Smooth</span>
                        <span>Instant</span>
                    </div>
                </div>
            </div>

            <div class="cc-divider"></div>

            <div class="cc-section">
                <div class="cc-label">Console</div>
                <div id="cc-log">Ready — connect to the bot server to begin.</div>
            </div>

        </div>
    `;

    document.body.appendChild(root);

    const $  = id => document.getElementById(id);
    const el = {
        status:     $('cc-status'),
        statusText: $('cc-status-text'),
        botCount:   $('cc-bot-count'),
        posX:       $('cc-pos-x'),
        posY:       $('cc-pos-y'),
        hash:       $('cc-hash'),
        serverUrl:  $('cc-server-url'),
        reconnect:  $('cc-reconnect'),
        killAll:    $('cc-kill-all'),
        search:     $('cc-search'),
        tankList:   $('cc-tank-list'),
        tankCount:  $('cc-tank-count'),
        spawn1:     $('cc-spawn1'),
        spawn5:     $('cc-spawn5'),
        spawn10:    $('cc-spawn10'),
        corner:     $('cc-corner'),
        toMe:       $('cc-to-me'),
        mbs:        $('cc-mbs'),
        feeding:    $('cc-feeding'),
        respawn:    $('cc-respawn'),
        autofire:   $('cc-autofire'),
        autospin:   $('cc-autospin'),
        smoothing:  $('cc-smoothing'),
        smoothVal:  $('cc-smooth-val'),
        log:        $('cc-log'),
        dragHandle: $('cc-drag-handle'),
    };

    function log(msg) {
        const t = new Date().toLocaleTimeString('en', { hour12: false });
        const line = document.createElement('div');
        line.innerHTML = `<span class="log-time">${t}</span>  ${msg}`;
        el.log.prepend(line);
        console.log(`[CC] ${msg}`);
    }

    // Drag
    let dragging = false, dragOX = 0, dragOY = 0;
    el.dragHandle.addEventListener('mousedown', e => {
        dragging = true;
        dragOX = e.clientX - root.offsetLeft;
        dragOY = e.clientY - root.offsetTop;
        root.style.transform = 'none';
    });
    document.addEventListener('mouseup', () => { dragging = false; });
    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        root.style.left = `${e.clientX - dragOX}px`;
        root.style.top  = `${e.clientY - dragOY}px`;
    });

    // Aim smoothing slider display
    el.smoothing.addEventListener('input', e => {
        el.smoothVal.textContent = parseFloat(e.target.value).toFixed(2);
    });

    // Tank list
    const CATEGORIES = [
        { label: "Basic",              keys: ["basic"] },
        { label: "Shooters",           keys: ["pursuer","shotgun","penta","spread","octo","autogunner","triplet","predator","triplex","quadruplex","machinegunner","cyclone","factory","septatrap"] },
        { label: "Annihilator",        keys: ["anni","obliterator","compound","wiper","stomper","autoanni","shaver","eradicator"] },
        { label: "Crash / Cyclone",    keys: ["whirlwind","tempest","septamech","doubleequalizer","rigger","doublespread","palisade"] },
        { label: "Smashers",           keys: ["megasmasher","spike","autoshasher","landmine","thorn","megaspike","claymore","spear","prick","slammer","basher","phys"] },
        { label: "DPS",                keys: ["toppler","autooperator","lorry","gale","crackshot"] },
        { label: "Builders",           keys: ["engineer","assembler","architect"] },
        { label: "Auto Tanks",         keys: ["auto5","mega3","auto6","auto7","mega5","autoauto4","hurler3","batter4"] },
        { label: "Launchers",          keys: ["skimmer","twister","swarmer","sidewinder","fieldgun"] },
        { label: "AR Launchers",       keys: ["spinner","helix_ar","hypertwister","gyro","coli","hyperskimmer","skidder","ream","hyperswarmer","molotov","firework","levi","hypercluster","neutron"] },
        { label: "Drones",             keys: ["overczar","tyrant","autooverlord","megaautooverseer","tripleautooverseer","autooverdrive","headman","overcheese","overstorm"] },
        { label: "Necromancer",        keys: ["diviner","autonecro","necrodrive","megaautounderdrive","tripleautounderdrive","pentamancer","pentadrive","warlock","autopentaseer"] },
        { label: "Carrier",            keys: ["warship","battlerdrive","bismarck","proddrive","manufacture","dirigible","autobattleship","autoprod","autocruiserdrive"] },
        { label: "Tri-Angle",          keys: ["rocket","fighter","bomber","autotriangle","surfer","eagle","phoenix","vulture"] },
        { label: "AR Tri-Angle",       keys: ["browser","surferdrive","roller","strider","megaautotriangle","tripleautotriangle","autofighter","autobomber","kicker","electrocutor","autoeagle","griffin"] },
    ];

    let selectedTank = 'septatrap';

    function renderTanks(query = '') {
        el.tankList.innerHTML = '';
        const q = query.toLowerCase().trim();
        if (q) {
            const matches = Object.entries(tanks).filter(([, t]) => t.name.toLowerCase().includes(q));
            el.tankCount.textContent = `(${matches.length} results)`;
            matches.forEach(([id, t]) => el.tankList.appendChild(makeItem(id, t)));
        } else {
            el.tankCount.textContent = `(${Object.keys(tanks).length} total)`;
            CATEGORIES.forEach(cat => {
                const hdr = document.createElement('div');
                hdr.className = 'cc-tank-category';
                hdr.textContent = cat.label;
                el.tankList.appendChild(hdr);
                cat.keys.forEach(id => {
                    if (tanks[id]) el.tankList.appendChild(makeItem(id, tanks[id]));
                });
            });
        }
    }

    function makeItem(id, t) {
        const item = document.createElement('div');
        item.className = 'cc-tank-item' + (selectedTank === id ? ' selected' : '');
        item.innerHTML = `
            <div>
                <div class="cc-tank-name">${t.name}</div>
                <div class="cc-tank-build">${t.build || 'Default'}</div>
            </div>
            <div class="cc-tank-check">${selectedTank === id ? svg.check : ''}</div>
        `;
        item.addEventListener('click', () => {
            selectedTank = id;
            renderTanks(el.search.value);
            log(`Tank selected: ${t.name}`);
            packet('Z', id);
        });
        return item;
    }

    renderTanks();
    el.search.addEventListener('input', e => renderTanks(e.target.value));

    // State
    let ws         = null;
    let verified   = false;
    let botCount   = 0;
    let playerX    = 0;
    let playerY    = 0;
    let mouseX     = 0;
    let mouseY     = 0;
    let mouseDown  = false;
    let rMouseDown = false;
    let keys       = {};
    let uiVisible  = true;

    let gameScale    = 1;
    let gameFOV      = 46;
    let canvasWidth  = 1920;
    let canvasHeight = 1080;

    function updateStats() {
        el.botCount.textContent = botCount;
        el.posX.textContent     = playerX ? Math.round(playerX) : '—';
        el.posY.textContent     = playerY ? Math.round(playerY) : '—';
    }

    // WebSocket
    function packet(...args) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(msgpack.encode(args));
        }
    }

    function setStatus(connected) {
        el.status.classList.toggle('connected', connected);
        el.statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }

    const DEFAULT_SERVER = 'wss://congenial-tribble-694rwpw6jrw9fp54-8082.app.github.dev';
    el.serverUrl.value = localStorage.getItem('cc-server-url') || DEFAULT_SERVER;
    el.serverUrl.addEventListener('change', () => {
        localStorage.setItem('cc-server-url', el.serverUrl.value.trim());
        log('Server URL saved.');
    });

    function getServerUrl() {
        return el.serverUrl.value.trim() || DEFAULT_SERVER;
    }

    function connect() {
        const url = getServerUrl();
        log(`Connecting to ${url}…`);
        setStatus(false);
        el.statusText.textContent = 'Connecting';
        ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            log('WebSocket open.');
            packet('M', 72011);
        };

        ws.onmessage = m => {
            const data = msgpack.decode(new Uint8Array(m.data));
            const type = data.shift();
            if (type === 'M') {
                packet('C', data[0] ^ 845);
                verified = true;
                setStatus(true);
                log('Verified — server ready.');
            }
        };

        ws.onclose = () => {
            verified = false;
            setStatus(false);
            log('Disconnected. Retrying in 5s…');
            setTimeout(connect, 5000);
        };
    }

    // Bot actions
    function spawnBots(n) {
        if (!verified) { log('Not connected.'); return; }
        const hash         = el.hash.value.replace('#', '') || location.hash.slice(1);
        const autoFire     = el.autofire.checked ? 1 : 0;
        const autoSpin     = el.autospin.checked ? 1 : 0;
        const aimSmoothing = parseFloat(el.smoothing.value);

        packet('Z', Array(n).fill(selectedTank));
        for (let i = 0; i < n; i++) {
            packet('F', hash, autoFire, autoSpin, aimSmoothing);
            botCount++;
        }
        updateStats();
        log(`Spawned ${n} bot(s) as ${tanks[selectedTank].name} | autofire:${!!autoFire} autospin:${!!autoSpin} smooth:${aimSmoothing.toFixed(2)}`);
    }

    function killAll() {
        packet('B');
        botCount = 0;
        updateStats();
        log('All bots killed.');
    }

    // Position loop
    function sendPos() {
        if (!verified) return;

        const canvas = document.querySelector('#canvas canvas') || document.querySelector('#canvas');
        if (canvas) {
            canvasWidth  = canvas.clientWidth  || canvasWidth;
            canvasHeight = canvas.clientHeight || canvasHeight;
        }

        let mouseWorldX = mouseX;
        let mouseWorldY = mouseY;

        if (playerX !== 0 || playerY !== 0) {
            const aspect      = canvasHeight / canvasWidth;
            const worldWidth  = gameFOV;
            const worldHeight = gameFOV * aspect;
            mouseWorldX = (mouseX / canvasWidth  - 0.5) * worldWidth;
            mouseWorldY = (mouseY / canvasHeight - 0.5) * worldHeight;
        }

        packet(
            'A',
            playerX, playerY,
            mouseWorldX, mouseWorldY,
            mouseDown  ? 1 : 0,
            rMouseDown ? 1 : 0,
            el.mbs.checked     ? 1 : 0,
            el.feeding.checked ? 1 : 0,
            keys['ShiftLeft']  ? 1 : 0
        );
    }

    // Coordinate capture
    const _strokeText = CanvasRenderingContext2D.prototype.strokeText;
    CanvasRenderingContext2D.prototype.strokeText = function (...a) {
        if (a[0] && a[0].includes('Coordinates:')) {
            try {
                const m = a[0].match(/Coordinates: \(([^)]+)\)/);
                if (m) {
                    const [x, y] = m[1].split(', ').map(parseFloat);
                    playerX = x; playerY = y;
                    updateStats();
                }
            } catch (_) {}
        }
        return _strokeText.apply(this, a);
    };

    // Scale capture
    const _setTransform = CanvasRenderingContext2D.prototype.setTransform;
    CanvasRenderingContext2D.prototype.setTransform = function (a, b, c, d, e, f) {
        if (Math.abs(a) > 0.5 && Math.abs(a) < 100) {
            gameScale = Math.abs(a);
            const cv = document.querySelector('#canvas canvas');
            if (cv) {
                const fov = cv.width / gameScale;
                if (fov > 10 && fov < 200) gameFOV = fov;
            }
        }
        return _setTransform.apply(this, arguments);
    };

    // Input
    function isPanelFocused() {
        const active = document.activeElement;
        return active && root.contains(active);
    }

    root.addEventListener('keydown', e => {
        if (e.code === 'Backquote') { e.preventDefault(); toggleUI(); return; }
        e.stopPropagation();
    }, true);
    root.addEventListener('keyup',    e => e.stopPropagation(), true);
    root.addEventListener('keypress', e => e.stopPropagation(), true);

    window.addEventListener('keydown', e => {
        if (isPanelFocused()) return;
        keys[e.code] = true;
        if (e.code === 'Backquote') { e.preventDefault(); toggleUI(); }
    });
    window.addEventListener('keyup', e => {
        if (isPanelFocused()) return;
        keys[e.code] = false;
    });

    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    document.addEventListener('mousedown', e => {
        if (e.button === 0) mouseDown  = true;
        if (e.button === 2) rMouseDown = true;
    });
    document.addEventListener('mouseup', e => {
        if (e.button === 0) mouseDown  = false;
        if (e.button === 2) rMouseDown = false;
    });
    document.addEventListener('contextmenu', e => {
        if (!root.contains(e.target)) e.preventDefault();
    });

    // Buttons
    el.reconnect.onclick = () => { if (ws) ws.close(); connect(); };
    el.killAll.onclick   = killAll;
    el.spawn1.onclick    = () => spawnBots(1);
    el.spawn5.onclick    = () => spawnBots(5);
    el.spawn10.onclick   = () => spawnBots(10);

    el.corner.onclick = () => {
        packet('A', -9999, -9999, 0, 0, 0, 0, 1, 0, 0);
        log('Bots sent to top-left.');
    };

    el.toMe.onclick = () => {
        log(`Sending bots to (${Math.round(playerX)}, ${Math.round(playerY)})`);
    };

    function toggleUI() {
        uiVisible = !uiVisible;
        root.classList.toggle('cc-hidden', !uiVisible);
    }

    setInterval(sendPos, 33);
    connect();
    log('Conisu Controller v4.2 loaded.');
    log('Press ` to toggle the UI.');

})();