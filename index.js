(async () => {
  // Import modules in a way that works for both CJS and ESM package layouts
  const wsModule = await import('ws');
  const WebSocket = wsModule.WebSocket || wsModule.default || wsModule;
  const httpsProxyModule = await import('https-proxy-agent');
  const HttpsProxyAgent = httpsProxyModule.HttpsProxyAgent || httpsProxyModule.default || httpsProxyModule;
  const socksProxyModule = await import('socks-proxy-agent');
  const SocksProxyAgent = socksProxyModule.SocksProxyAgent || socksProxyModule.default || socksProxyModule;
  const url = await import('url');
  //const fs = await import('fs');
  const fetchModule = await import('node-fetch');
  const realFetch = fetchModule.default || fetchModule;
  // FetchResponse no longer needed — using plain objects for response mocking

  // Support both worker_threads (parentPort) and child_process (process.send)
  const { parentPort } = await import('worker_threads').catch(() => ({ parentPort: null }));

  // ===== CHECK FOR COMMAND LINE ARGUMENTS =====
  const args = process.argv.slice(2);

  // Ensure variables are declared
  let autoStartCount = 0;
  let autoStartMode = false;

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      autoStartCount = parseInt(args[i + 1]);
      autoStartMode = true;
      break;
    }
  }

  process.on('uncaughtException', function (e) { console.log(e) });
  process.on('unhandledRejection', function (e) { console.log('Unhandled rejection:', e) });

  function notifyParent(event, detail) {
      try {
          if (parentPort) {
            parentPort.postMessage({ type: 'status', event, detail });
          } else if (process.send) {
            process.send({ type: 'status', event, detail });
          }
      } catch (e) {}
  }
  // --- WORKER PROCESS (Bot logic) ---
  let isPaused = false;
  let currentBotInterface = {};
  // Mutable chatbot config — updated by process messages
  let liveChatbotConfig = { geminiApiKey: '', chatbotPersonality: '' };
  let devastate = () => {};
  let target = {};
  let botConfig = null; // stored from 'start' message so tankselect handler can check role

  // Cached game assets from server (set before arras IIFE runs)
  let _cachedWasm = null, _cachedScript = null;
  let startAssetLoading = null; // set by arras IIFE

  //const names = fs.readFileSync("names.txt").toString().split("\n");

  const builds = {
    // Glass cannon: 0 defense, all bullet stats + speed for dodge
    // Stats: BodyDmg/Health/BulletSpd/BulletHP/BulletPen/BulletDmg/Reload/MoveSpd/ShieldRegen/ShieldHP
    // 42 total points, 9 max per stat
    basic: "0/0/9/3/9/9/9/3/0/0",
    triangle: "0/0/9/3/9/9/9/3/0/0",
    smasher: "9/12/0/0/0/0/0/12/3/6",
    pvp_auto: "0/0/9/3/9/9/9/3/0/0",
    pvp_drone: "0/0/9/3/9/9/9/3/0/0",
    farm: "0/0/9/3/9/9/9/3/0/0"
  };
  
  const upgrade_map = {
    1: 50,
    2: 90,
    3: 120,
    4: 180
  };

  const tanks = {
    basic: {
      path: "",
      build: ""
    },

    // OTHER
    pursuer: {
      path: "uyiy",
      build: "8/9/0/0/0/0/0/9/8/8"
    },
    anni: {
      path: "kyu",
      build: builds.basic
    },
    shotgun: {
      path: "kj",
      build: builds.basic
    },
    penta: {
      path: "yuy",
      build: builds.basic
    },
    spread: {
      path: "yuu",
      build: builds.basic
    },
    octo: {
      path: "hyyc",
      build: builds.farm
    },
    autogunner: {
      path: "iiy",
      build: builds.basic
    },
    triplet: {
      path: "yuj",
      build: builds.basic
    },
    predator: {
      path: "uuy",
      build: builds.basic
    },
    ranger: {
      path: "uyy",
      build: builds.basic
    },
    triplex: {
      path: "yjy",
      build: builds.basic
    },
    quadruplex: {
      path: "yju",
      build: builds.basic
    },
    machinegunner: {
      path: "iih",
      build: builds.basic
    },
    cyclone: {
      path: "hyuc",
      build: builds.farm
    },
    factory: {
      path: "jhy",
      build: builds.pvp_drone
    },
    septatrap: {
      path: "hjic",
      build: "0/6/0/9/9/9/9"
    },

    // ANNIES
    obliterator: {
      path: "vkyuy",
      build: builds.basic
    },
    compound: {
      path: "kyui",
      build: builds.basic
    },
    wiper: {
      path: "kyuj",
      build: builds.basic
    },
    stomper: {
      path: ["k", "y", "u", [1, 3]],
      build: builds.basic
    },
    autoanni: {
      path: ["k", "y", "u", [2, 3]],
      build: builds.pvp_auto
    },
    shaver: {
      path: ["k", "y", "u", [2, 4]],
      build: builds.basic
    },
    eradicator: {
      path: ["k", "y", "u", [1, 4]],
      build: builds.basic
    },

    // FOR CRASH
    whirlwind: {
      path: "chyuk",
      build: "9/9/0/0/0/0/9"
    },
    tempest: {
      path: "chyuh",
      build: "9/9/0/0/0/0/9"
    },
    septamech: {
      path: "chjkh",
      build: "9/9/0/0/0/0/9"
    },
    doubleequalizer: {
      path: "yjyk",
      build: "9/9/0/0/0/0/9"
    },
    rigger: {
      path: "yjkk",
      build: "9/9/0/0/0/0/9"
    },
    doublespread: {
      path: "yuuy",
      build: "9/9/0/0/0/0/9"
    },
    palisade: {
      path: ["h", "j", "y", [3, 3]],
      build: "9/9/0/0/0/0/9"
    },

    // SMASHERS
    megasmasher: {
      path: ["r", [3, 3], "y"],
      build: builds.smasher
    },
    spike: {
      path: ["r", [3, 3], "u"],
      build: builds.smasher
    },
    autoshasher: {
      path: ["r", [3, 3], "i"],
      build: builds.smasher
    },
    landmine: {
      path: ["r", [3, 3], "h"],
      build: builds.smasher
    },

    thorn: {
      path: ["r", [2, 3], "u", "y"],
      build: builds.smasher
    },
    megaspike: {
      path: ["r", [2, 3], "u", "u"],
      build: "12/12/0/0/0/0/0/7/3/8" // bc its faster by default
    },
    claymore: {
      path: ["r", [2, 3], "u", "i"],
      build: builds.smasher
    },
    spear: {
      path: ["r", [2, 3], "u", "j"],
      build: builds.smasher
    },
    prick: {
      path: ["r", [2, 3], "u", "k"],
      build: builds.smasher
    },

    slammer: {
      path: [[2, 3], "k", "y"],
      build: "8/10/12/0/0/0/0/12"
    },
    basher: {
      path: [[2, 3], "j", "j"],
      build: "8/10/12/0/0/0/0/12"
    },
    phys: {
      path: [[2, 3], [3, 3]],
      build: builds.smasher
    },

    // DPS
    toppler: {
      path: "uijh",
      build: builds.basic
    },
    crack: {
      path: "yuyj",
      build: builds.basic
    },
    autooperator: {
      path: [[1, 3], "j", "j", [2, 3]],
      build: builds.basic
    },
    lorry: {
      path: "ihyy",
      build: builds.basic
    },

    // BUILDERS
    engineer: {
      path: "kui",
      build: builds.basic
    },
    assembler: {
      path: "kuj",
      build: builds.basic
    },
    architect: {
      path: "kuk",
      build: builds.basic
    },

    // AUTO
    auto5: {
      path: "hiy",
      build: builds.pvp_auto
    },
    mega3: {
      path: "hiu",
      build: builds.pvp_auto
    },
    auto6: {
      path: "hiiy",
      build: builds.pvp_auto
    },

    auto7: {
      path: "hiyy",
      build: builds.pvp_auto
    },
    mega5: {
      path: "hiyu",
      build: builds.pvp_auto
    },
    auto4: {
      path: "hii",
      build: builds.pvp_auto
    },
    autoauto4: {
      path: "hiii",
      build: builds.pvp_auto
    },
    hurler3: {
      path: "hiui",
      build: builds.basic
    },
    batter4: {
      path: "hiiu",
      build: builds.basic
    },

    // LAUNCHERS
    skimmer: {
      path: "khy",
      build: builds.basic
    },
    twister: {
      path: "khu",
      build: builds.basic
    },
    swarmer: {
      path: "khi",
      build: builds.basic
    },
    sidewinder: {
      path: "khh",
      build: builds.basic
    },
    fieldgun: {
      path: "khj",
      build: builds.basic
    },

    // AR LAUNCHERS
    spinner: {
      path: "khju",
      build: builds.basic
    },
    helix_ar: {
      path: "khuh",
      build: builds.basic
    },
    hypertwister: {
      path: "khui",
      build: builds.basic
    },
    gyro: {
      path: "khuk",
      build: builds.basic
    },
    coli: {
      path: ["k", "h", "u", [3, 3]],
      build: builds.basic
    },

    hyperskimmer: {
      path: "khyi",
      build: builds.basic
    },
    skidder: {
      path: "khjy",
      build: builds.basic
    },
    ream: {
      path: "khyh",
      build: builds.basic
    },

    hyperswarmer: {
      path: "khih",
      build: builds.basic
    },
    molotov: {
      path: "khij",
      build: builds.basic
    },

    firework: {
      path: "khky",
      build: builds.basic
    },
    levi: {
      path: "khkh",
      build: builds.basic
    },

    hypercluster: {
      path: ["k", "h", [4, 2], "h"],
      build: builds.basic
    },
    neutron: {
      path: ["k", "h", [4, 2], [1, 4]],
      build: builds.basic
    },

    // DRONES
    banshee: {
      path: "jyh",
      build: builds.pvp_drone
    },
    overczar: {
      path: "jyyy",
      build: builds.pvp_drone
    },
    tyrant: {
      path: "jyyk",
      build: builds.pvp_drone
    },
    autooverlord: {
      path: "jyyj",
      build: builds.pvp_drone
    },
    megaautooverseer: {
      path: "jyiy",
      build: builds.pvp_drone
    },
    tripleautooverseer: {
      path: "jyiu",
      build: builds.pvp_drone
    },
    autooverdrive: {
      path: "jyhh",
      build: builds.pvp_drone
    },
    headman: {
      path: "jkyy",
      build: builds.basic
    },
    overcheese: {
      path: "jkyu",
      build: builds.basic
    },
    overstorm: {
      path: "jjyu",
      build: builds.basic
    },

    // NECRO
    diviner: {
      path: "jiyy",
      build: builds.basic
    },
    autonecro: {
      path: "jiyi",
      build: builds.pvp_drone
    },
    necrodrive: {
      path: "jiyh",
      build: builds.basic
    },
    megaautounderdrive: {
      path: "jiiy",
      build: builds.basic
    },
    tripleautounderdrive: {
      path: "jiiu",
      build: builds.basic
    },

    pentamancer: {
      path: "jiky",
      build: builds.basic
    },
    pentadrive: {
      path: "jikh",
      build: builds.basic
    },
    warlock: {
      path: "jikj",
      build: builds.basic
    },
    autopentaseer: {
      path: "jiki",
      build: builds.basic
    },

    // CARRIER
    warship: {
      path: "juuy",
      build: builds.basic
    },
    battlerdrive: {
      path: "jjiu",
      build: builds.basic
    },
    bismarck: {
      path: "juku",
      build: builds.basic
    },
    proddrive: {
      path: "jjjj",
      build: builds.basic
    },
    manufacture: {
      path: "jukj",
      build: builds.basic
    },
    dirigible: {
      path: "jukk",
      build: builds.basic
    },
    autobattleship: {
      path: "juhh",
      build: builds.basic
    },
    autoprod: {
      path: "juki",
      build: builds.basic
    },
    autocruiserdrive: {
      path: "jjih",
      build: builds.basic
    },


    // TRI ANGLE
    rocket: {
      path: "huuy",
      build: "8/8/0/0/0/0/8/8/2/8"
    },
    fighter: {
      path: "huy",
      build: builds.triangle
    },
    bomber: {
      path: "huh",
      build: builds.triangle
    },
    autotriangle: {
      path: "huj",
      build: builds.triangle
    },
    surfer: {
      path: "huk",
      build: builds.triangle
    },
    eagle: {
      path: "kk",
      build: builds.triangle
    },
    phoenix: {
      path: "ihu",
      build: builds.triangle
    },
    vulture: {
      path: "uij",
      build: builds.triangle
    },

    // ARMS RACE TRI ANGLE
    // surfer
    browser: {
      path: "huky",
      build: builds.triangle
    },
    surferdrive: {
      path: "huki",
      build: builds.triangle
    },
    roller: {
      path: "hukh",
      build: builds.triangle
    },
    strider: {
      path: "hukk",
      build: builds.triangle
    },

    // auto tri angle
    megaautotriangle: {
      path: "hujy",
      build: builds.triangle
    },
    tripleautotriangle: {
      path: "huju",
      build: builds.triangle
    },
    autofighter: {
      path: "huji",
      build: builds.triangle
    },
    autobomber: {
      path: "hujk",
      build: builds.triangle
    },

    // taser
    kicker: {
      path: "uikj",
      build: builds.triangle
    },
    electrocutor: {
      path: "uiki",
      build: builds.triangle
    },

    // eagle
    autoeagle: {
      path: "kkk",
      build: builds.triangle
    },
    griffin: {
      path: "kkh",
      build: builds.triangle
    }
  };

  const options = { start: () => { } };

  WebAssembly.instantiateStreaming = false
  const arras = (function () {
    const log = function () {
      global.console.log(`[headless]`, ...arguments)
    }

    let app = false
    const wasm = function () {
      return {
        arrayBuffer: function () {
          return app
        }
      }
    }
    let lastStatus = 0, statusData = ''
    function patchStatusClients(data) {
      // Game servers now use maxClients=0 (unlimited capacity).
      // No need to patch client counts — just pass through.
      return data;
    }
    const getStatus = function (f, s) {
      let now = global.performance.now()
      if (statusData && now - lastStatus < 15000) {
        return {
          then: function () {
            return {
              then: function (f) {
                if (statusData.trimStart().startsWith('<')) return;
                try {
                  let i = patchStatusClients(JSON.parse(statusData))
                  s(i)
                  f(i)
                } catch(e) {}
              }
            }
          }
        }
      }
      let then = function () { }
      realFetch(f).then(x => x.text()).then(x => {
        statusData = x
        if (x && x.trimStart().startsWith('<')) return;
        try {
          let i = patchStatusClients(JSON.parse(x))
          s(i)
          then(i)
        } catch (err) {
          log('Failed to parse status response as JSON in getStatus:', err)
        }
      })
      return {
        then: function () {
          return {
            then: function (f) {
              then = f
            }
          }
        }
      }
    }

    let ready = false, script = false, o = [], then = function (f) {
      if (ready) {
        f();
      } else {
        o.push(f);
      }
    };

    const initializeAndRunQueue = function () {
      ready = true;
      //log('Headless arras ready.');
      for (let i = 0, l = o.length; i < l; i++) {
        o[i]();
      }
      o = [];
      then = function (f) {
        f();
      };
    }

    let prerequisites = 0;
    const onPrerequisiteLoaded = function () {
      prerequisites++;
      if (prerequisites === 2) {
        initializeAndRunQueue();
      }
    }

    function loadWasm() {
      if (_cachedWasm) {
        app = _cachedWasm;
        onPrerequisiteLoaded();
        return;
      }
      realFetch('https://arras.io/app.wasm').then(x => {
        x.arrayBuffer().then(x => {
          app = x;
          onPrerequisiteLoaded();
        })
      });
    }

    function loadScript2() {
      if (_cachedScript) {
        script = _cachedScript;
        onPrerequisiteLoaded();
        return;
      }

      const activateBot = (scriptContent) => {
        script = scriptContent;
        onPrerequisiteLoaded();
      };

      const extractScriptFromHtml = (html) => {
        const scriptTagStart = html.indexOf('<script>');
        if (scriptTagStart === -1) {
          log('Error: Could not find <script> tag in content.');
          return null;
        }
        let scriptContent = html.slice(scriptTagStart + 8);
        const scriptTagEnd = scriptContent.indexOf('</script');
        if (scriptTagEnd === -1) {
          log('Error: Could not find closing </script> tag.');
          return null;
        }
        scriptContent = scriptContent.slice(0, scriptTagEnd);
        return scriptContent;
      };

      realFetch('https://arras.io').then(x => x.text()).then(html => {
        const extractedScript = extractScriptFromHtml(html);
        if (extractedScript) {
          activateBot(extractedScript);
        }
      }).catch(err => {
        log('FATAL: Could not fetch from arras.io. Please check network or use a valid cache file.', err);
      });
    }

    // Defer loading until we check for cached assets from server
    let assetsLoaded = false;
    startAssetLoading = function() {
      if (assetsLoaded) return;
      assetsLoaded = true;
      loadWasm();
      loadScript2();
    };
    // If no cached assets arrive within 200ms, fetch normally
    setTimeout(startAssetLoading, 200);

    // id is used to assign unique incremental ids when creating bots
    let id = 0;

    let trigger = {};
    const run = function (x, config, oa) {
      const log = function () {
        global.console.log(`[headless ${config.id}]`, ...arguments)
      }

      const internalBotInterface = {
        log: log,
        simulateKey: (code) => {
          if (trigger.keydown && trigger.keyup) {
            trigger.keydown(code);
            setTimeout(() => trigger.keyup(code), 50);
          }
        }
      };

      let destroy = function () {
        if (destroyed) { return }
        log('Destroying instance...')
        if (gameSocket && gameSocket.readyState < 3) {
          gameSocket.close()
          gameSocket = false
        }
        destroyed = true
      }, destroyed = false
      devastate = destroy;

      const setInterval = new Proxy(global.setInterval, {
        apply: function (a, b, c) {
          if (destroyed) { return }
          return Reflect.apply(a, b, c)
        }
      }), setTimeout = new Proxy(global.setTimeout, {
        apply: function (a, b, c) {
          if (destroyed) { return }
          return Reflect.apply(a, b, c)
        }
      })
      const h = function (o) {
        return new Proxy(o, {
          get: function (a, b, c) {
            let d = Reflect.get(a, b, c)
            return d
          }, set: function (a, b, c) {
            return Reflect.set(a, b, c)
          }
        })
      }
      const handleListener = function (type, f) {
        listeners[type] = f
      }
      const listeners = {}
      trigger = {
        mousemove: function (clientX, clientY) {
          if (listeners.mousemove) {
            listeners.mousemove({
              isTrusted: true,
              clientX: clientX,
              clientY: clientY
            })
          }
        },
        mousedown: function (clientX, clientY, button) {
          if (listeners.mousedown) {
            listeners.mousedown({
              isTrusted: true,
              clientX: clientX,
              clientY: clientY,
              button: button
            })
          }
        },
        mouseup: function (clientX, clientY, button) {
          if (listeners.mouseup) {
            listeners.mouseup({
              isTrusted: true,
              clientX: clientX,
              clientY: clientY,
              button: button
            })
          }
        },
        keydown: function (code, repeat) {
          if (listeners.keydown) {
            const key = code === 'Enter' ? 'Enter' : code === 'Escape' ? 'Escape' : code === 'Tab' ? 'Tab' : code === 'Backspace' ? 'Backspace' : code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code;
            const keyCode = code === 'Enter' ? 13 : code === 'Escape' ? 27 : code === 'Tab' ? 9 : code === 'Backspace' ? 8 : code === 'Space' ? 32 : code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? 48 + parseInt(code.slice(5)) : 0;
            listeners.keydown({
              isTrusted: true,
              code: code,
              key: key,
              keyCode: keyCode,
              which: keyCode,
              repeat: repeat || false,
              preventDefault: function () { }
            })
          }
        },
        keyup: function (code, repeat) {
          if (listeners.keyup) {
            const key = code === 'Enter' ? 'Enter' : code === 'Escape' ? 'Escape' : code === 'Tab' ? 'Tab' : code === 'Backspace' ? 'Backspace' : code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code;
            const keyCode = code === 'Enter' ? 13 : code === 'Escape' ? 27 : code === 'Tab' ? 9 : code === 'Backspace' ? 8 : code === 'Space' ? 32 : code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? 48 + parseInt(code.slice(5)) : 0;
            listeners.keyup({
              isTrusted: true,
              code: code,
              key: key,
              keyCode: keyCode,
              which: keyCode,
              repeat: repeat || false,
              preventDefault: function () { }
            })
          }
        }
      }

      global.window = global.parent = global.top = {
        WebAssembly,
        googletag: {
          cmd: {
            push: function (f) { try { f(); } catch (e) { } }
          },
          defineSlot: function () { return this; },
          addService: function () { return this; },
          display: function () { return this; },
          pubads: function () { return this; },
          enableSingleRequest: function () { return this; },
          collapseEmptyDivs: function () { return this; },
          enableServices: function () { return this; }
        },
        arrasAdDone: true
      };

      global.crypto = global.window.crypto = {
        getRandomValues: function (a) { return a }
      };
      global.addEventListener = global.window.addEventListener = function (type, f) {
        handleListener(type, f, global.window)
      };
      global.removeEventListener = global.window.removeEventListener = function (type, f) {
      };
      global.Image = global.window.Image = function () {
        return {}
      };

      let inputs = [], setValue = function (str) {
        for (let i = 0, l = inputs.length; i < l; i++) {
          inputs[i].value = str
        }
      }
      let position = [0, 0, 5], died = false, died2 = false, ignore = false, disconnected = false, connected = false, inGame = false, upgrade = false, reconnectCount = 0;
      let _respawnInterval = null; // track respawn interval so onJoin can kill it
      let _upgrading = false; // lock flag — blocks ALL other input during upgrade sequence

      let innerWidth = global.window.innerWidth = 500
      let innerHeight = global.window.innerHeight = 500

      let st = 2, lx = 0, gd = 1, canvasRef = {}, sr = 1, s = 1;

      const g = function () {
        let w = innerWidth;
        let h = innerHeight;
        if (!canvasRef.width) canvasRef.width = w;
        if (w * 0.5625 > h) {
          s = 888.888888888 / w;
        } else {
          s = 500 / h;
        }
        sr = canvasRef.width / w;
      };
      g();

      global.document = global.window.document = (function () {
        const emptyFunc = () => { };
        const emptyStyle = { setProperty: emptyFunc };

        // --- Color classification for entity detection ---
        // Exact theme colors from user's arras.io theme pack
        // Returns: 'blue','green','red','purple' (player teams), 'shape' (food), 'barrel','wall','bg','neutral','unknown'
        const THEME_COLORS = [
          // Player/team colors — these are TARGETS
          { r: 60,  g: 164, b: 203, name: 'blue' },    // Blue team #3ca4cb
          { r: 138, g: 188, b: 63,  name: 'green' },   // Green team #8abc3f
          { r: 224, g: 62,  b: 65,  name: 'red' },     // Red team #e03e41
          { r: 204, g: 102, b: 156, name: 'purple' },   // Purple team #cc669c
          // Shape/food colors — IGNORE these
          { r: 232, g: 235, b: 247, name: 'shape' },    // Eggs #e8ebf7
          { r: 239, g: 199, b: 75,  name: 'shape' },    // Squares #efc74b
          { r: 231, g: 137, b: 109, name: 'shape' },    // Triangles #e7896d
          { r: 141, g: 106, b: 223, name: 'shape' },    // Pentagons #8d6adf
          { r: 122, g: 219, b: 186, name: 'shape' },    // Hexagons #7adbba
          { r: 239, g: 153, b: 195, name: 'shape' },    // Crashers #ef99c3
          // Non-entity colors — NOT in list, so they fall through to 'unknown' and are fully ignored
          // Barrels #a7a7af rgb(167,167,175) — removed, too close to bg/wall, causes false detections
          // Walls #a4a4ad rgb(164,164,173) — removed, wall detection uses fillRect not arc
          // Background #999999 rgb(153,153,153) — removed, was causing bot to flee toward border
          // Neutral #fdf380 rgb(253,243,128) — keep to avoid targeting neutral entities
          { r: 253, g: 243, b: 128, name: 'neutral' },   // Neutral #fdf380
          // Rogues #726f6f rgb(114,111,111) — keep to avoid targeting rogues
          { r: 114, g: 111, b: 111, name: 'neutral' },   // Rogues #726f6f
        ];
        const COLOR_TOLERANCE = 30; // allow ±30 for rendering variations/alpha blending/damage flash
        function classifyColor(r, g, b) {
          let bestMatch = 'unknown';
          let bestDist = COLOR_TOLERANCE * 3; // max total channel diff allowed
          for (const tc of THEME_COLORS) {
            const dist = Math.abs(r - tc.r) + Math.abs(g - tc.g) + Math.abs(b - tc.b);
            if (dist < bestDist) {
              bestDist = dist;
              bestMatch = tc.name;
            }
          }
          return bestMatch;
        }

        const simulatedContext2D = {
          isContextLost: () => false,

          fillText: function () {
            if (ignore) { return }
            let a = Array.from(arguments)
            if (this.font === 'bold 7px Ubuntu' && this.fillStyle === 'rgb(255,255,255)') {
              if (a[0] === `You have spawned! Welcome to the game.`) {
                hasJoined = firstJoin = true
                notifyParent('spawned', 'Bot joined the game');
              } else if (a[0] === 'You have traveled through a portal!') {
                hasJoined = true
              }
              if (!died && (
                (a[0].startsWith('The server was ') && a[0].endsWith('% active'))
                || a[0].startsWith('Survived for ')
                || a[0].startsWith('Succumbed to ')
                || a[0] === 'You have self-destructed.'
                || a[0] === `Vanished into thin air`
                || a[0].startsWith('You have been killed by '))) {
                died = true
                notifyParent('died', a[0]);
              }
              if (!a[0].startsWith(`You're using an ad blocker.`) && a[0] !== 'Respawn' && a[0] !== 'Back' && a[0] !== 'Reconnect' && a[0].length > 2) {
                //log('[arras]', a[0])
                if (a[0].startsWith("You have been killed by ") || a[0] === "You have died a stupid death.") {
                  died = true;
                }
              }
            }
            if (this.font === 'bold 7.5px Ubuntu' && this.fillStyle === 'rgb(231,137,109)') {
              if (a[0] === 'You have been temporarily banned from the game.' || a[0] === 'Your IP address have been blacklisted due to suspicious activities.') {
                disconnected = true
                log('[arras]', a[0])
                notifyParent('banned', a[0]);
                if (!destroyed) {
                  destroy()
                  if (connected) {
                    const banDelay = 30000 + Math.random() * 30000;
                    log(`Banned. Retrying in ${(banDelay / 1000).toFixed(0)}s with backoff...`);
                    notifyParent('reconnecting', `Banned, waiting ${(banDelay / 1000).toFixed(0)}s`);
                    global.setTimeout(function () {
                      log('Reconnecting after ban...');
                      reconnectCount = 0;
                      run(x, config, arras);
                    }, banDelay);
                  }
                }
              } else if (a[0].startsWith('The connection closed due to ')) {
                disconnected = true
                if (!destroyed) {
                  destroy()
                  if (connected) {
                    if (reconnectCount < config.reconnectAttempts) {
                      reconnectCount++;
                      const delay = Math.min(config.reconnectDelay * Math.pow(1.5, reconnectCount - 1), 60000);
                      log(`Attempting to reconnect in ${(delay / 1000).toFixed(1)}s... (${reconnectCount}/${config.reconnectAttempts})`);
                      notifyParent('reconnecting', `Attempt ${reconnectCount}/${config.reconnectAttempts} in ${(delay / 1000).toFixed(0)}s`);
                      global.setTimeout(function () {
                        log('Reconnecting...');
                        run(x, config, arras);
                      }, delay);
                    } else {
                      log(`Max reconnection attempts reached (${config.reconnectAttempts}). Exiting worker.`);
                      notifyParent('gave_up', `Exhausted ${config.reconnectAttempts} attempts`);
                      process.exit(1);
                    }
                  }
                }
                log('[arras]', a[0])
              }
            }
            if (this.font === 'bold 5.1px Ubuntu' && this.fillStyle === 'rgb(255,255,255)') {
              if (a[0].startsWith('Coordinates: (')) {
                if (died2) {
                  hasJoined = true;
                }

                let b = a[0].slice(14), l = b.length
                if (b[l - 1] === ')') {
                  b = b.slice(0, l - 1).split(', ')
                  if (b.length === 2) {
                    let x = parseFloat(b[0])
                    let y = parseFloat(b[1])
                    position[0] = x
                    position[1] = y
                    position[2] = 5
                  }
                }
              }
            }
            // Chat detection removed — chatbots now proactively chat via Gemini timer
          },

          measureText: (text) => ({ width: text.length }),
          clearRect: function () {
            // Reset transform stacks at frame start
            this._txStack = [0]; this._tyStack = [0]; this._tx = 0; this._ty = 0;
            this._sxStack = [1]; this._syStack = [1]; this._sx = 1; this._sy = 1;
            // Cap entity buffer to prevent memory growth
            if (detectedEntities.length > 200) detectedEntities = detectedEntities.slice(-100);
            // Merge current barrel rects into persistent set, then clear for next frame
            // Keep barrel positions alive for 500ms so arcs can match them
            const nowBr = Date.now();
            if (!this._persistentBarrels) this._persistentBarrels = [];
            for (const br of (this._barrelRects || [])) {
              let merged = false;
              for (const pb of this._persistentBarrels) {
                if (Math.hypot(pb.screenX - br.screenX, pb.screenY - br.screenY) < 25) {
                  pb.screenX = br.screenX; pb.screenY = br.screenY; pb.time = nowBr;
                  merged = true; break;
                }
              }
              if (!merged) this._persistentBarrels.push({ screenX: br.screenX, screenY: br.screenY, time: nowBr });
            }
            // Expire old barrel entries
            this._persistentBarrels = this._persistentBarrels.filter(pb => nowBr - pb.time < 500);
            if (this._persistentBarrels.length > 200) this._persistentBarrels = this._persistentBarrels.slice(-100);
            this._barrelRects = [];
            // New frame for chat text frequency tracking
            _frameId++;
          },
          strokeRect: emptyFunc,
          // Track barrel rectangles to distinguish players from bullets
          _barrelRects: [], // [{screenX, screenY}] — game-view rects this frame
          fillRect: function (rx, ry, rw, rh) {
            if (!inGame || block) return;
            const absW = Math.abs(rw), absH = Math.abs(rh);
            if (absW < 2 || absH < 2) return; // skip trivial
            // WASM pre-scales coords — _sx is always 1.0
            const rectCX = rx + rw / 2, rectCY = ry + rh / 2;

            // Track barrel rects BEFORE the transform filter — barrels may be untransformed
            // Small rects in game view area (not on minimap x>350) = potential barrels
            if (absW < 60 && absH < 60 && rectCX <= 350) {
              const distFromCenter = Math.hypot(rectCX - 250, rectCY - 250);
              if (distFromCenter > 10 && distFromCenter < 400) {
                this._barrelRects.push({ screenX: rectCX, screenY: rectCY });
              }
            }

            if (this._tx === 0 && this._ty === 0 && this._sx === 1) return; // skip untransformed (UI)

            // --- Minimap detection by position (right side of 500px canvas) ---
            // Check minimap FIRST before any color filtering — bases are transparent so color varies
            if (rectCX > 300) {
              const mmCenterX = 420, mmCenterY = 430;
              const mmScale = 4.0;
              const gameX = (rectCX - mmCenterX) * mmScale;
              const gameY = (rectCY - mmCenterY) * mmScale;
              const gameW = absW * mmScale;
              const gameH = absH * mmScale;
              const now = Date.now();

              // Large rects on minimap (>8px either dimension) = base zones = no-go
              if (absW > 8 || absH > 8) {
                // Base zone detected — store for avoidance
                let found = false;
                for (let bi = 0; bi < baseZones.length; bi++) {
                  if (Math.abs(baseZones[bi].x - gameX) < gameW && Math.abs(baseZones[bi].y - gameY) < gameH) {
                    baseZones[bi].time = now;
                    found = true;
                    break;
                  }
                }
                if (!found) {
                  baseZones.push({ x: gameX, y: gameY, w: gameW, h: gameH, time: now });
                  if (baseZones.length > 20) baseZones.shift();
                }
                return; // bases are not walls for A*
              }

              // Dark gray rects = shape spawn zone — treat as impassable wall
              if (this._colorParsed) {
                const brightness = (this._parsedR + this._parsedG + this._parsedB) / 3;
                if (brightness < 110) {
                  // Shape spawn zone — add as wall
                  for (let i = wallMap.length - 1; i >= Math.max(0, wallMap.length - 100); i--) {
                    const ew = wallMap[i];
                    if (Math.abs(ew.x - gameX) < gameW * 0.5 && Math.abs(ew.y - gameY) < gameH * 0.5) {
                      ew.time = now;
                      return;
                    }
                  }
                  wallMap.push({ x: gameX, y: gameY, w: gameW, h: gameH, time: now, minimap: true });
                  if (wallMap.length > WALL_MAP_MAX) wallMap.shift();
                  return;
                }
              }

              // Small minimap rects = maze walls
              for (let i = wallMap.length - 1; i >= Math.max(0, wallMap.length - 100); i--) {
                const ew = wallMap[i];
                if (Math.abs(ew.x - gameX) < (gameW || 10) * 0.5 && Math.abs(ew.y - gameY) < (gameH || 10) * 0.5) {
                  ew.time = now;
                  return;
                }
              }
              wallMap.push({ x: gameX, y: gameY, w: gameW, h: gameH, time: now, minimap: true });
              if (wallMap.length > WALL_MAP_MAX) wallMap.shift();
              return;
            }

            // Game-view wall (not on minimap — those are handled above)
            // Skip game-view background (uniform gray 145-165)
            if (this._colorParsed) {
              const r = this._parsedR, g = this._parsedG, b = this._parsedB;
              const isUniformGray = Math.abs(r - g) < 5 && Math.abs(g - b) < 5;
              if (isUniformGray && r >= 145 && r < 165) return;
            }

            // (Barrel tracking is done before the transform filter above)

            if (absW > 400 || absH > 400) return;
            if (absW < 8 || absH < 8) return;
            const screenX = rectCX;
            const screenY = rectCY;
            const gameX = position[0] + (screenX - 250);
            const gameY = position[1] + (screenY - 250);
            const gameW = absW;
            const gameH = absH;
            const distFromUs = Math.hypot(gameX - position[0], gameY - position[1]);
            if (distFromUs > 500 || gameW > 200 || gameH > 200 || gameW < 2 || gameH < 2) return;

            const now = Date.now();
            for (let i = wallMap.length - 1; i >= Math.max(0, wallMap.length - 100); i--) {
              const ew = wallMap[i];
              if (Math.abs(ew.x - gameX) < (gameW || 10) * 0.5 && Math.abs(ew.y - gameY) < (gameH || 10) * 0.5) {
                ew.time = now;
                return;
              }
            }
            wallMap.push({ x: gameX, y: gameY, w: gameW, h: gameH, time: now, minimap: false });
            if (wallMap.length > WALL_MAP_MAX) wallMap.shift();
          },
          // --- Entity position tracking for PvP targeting ---
          // Color-based entity classification using exact theme colors
          _fillColor: '', _strokeColor: '',
          _parsedR: 0, _parsedG: 0, _parsedB: 0, _colorParsed: false,
          get fillStyle() { return this._fillColor; },
          set fillStyle(v) {
            this._fillColor = v;
            // Pre-parse RGB on set for fast lookup in arc()
            if (v && v.indexOf && v.indexOf('rgb') === 0) {
              const m = v.match(/(\d+),\s*(\d+),\s*(\d+)/);
              if (m) { this._parsedR = parseInt(m[1]); this._parsedG = parseInt(m[2]); this._parsedB = parseInt(m[3]); this._colorParsed = true; return; }
            }
            this._colorParsed = false;
          },
          get strokeStyle() { return this._strokeColor; },
          set strokeStyle(v) { this._strokeColor = v; },
          _txStack: [0], _tyStack: [0], _tx: 0, _ty: 0,
          _sxStack: [1], _syStack: [1], _sx: 1, _sy: 1, // scale tracking
          save: function () { this._txStack.push(this._tx); this._tyStack.push(this._ty); this._sxStack.push(this._sx); this._syStack.push(this._sy); },
          restore: function () { this._tx = this._txStack.pop() || 0; this._ty = this._tyStack.pop() || 0; this._sx = this._sxStack.pop() || 1; this._sy = this._syStack.pop() || 1; },
          translate: function (dx, dy) { this._tx += dx * this._sx; this._ty += dy * this._sy; },
          scale: function (sx, sy) { this._sx *= sx; this._sy *= (sy !== undefined ? sy : sx); },
          // setTransform resets the ENTIRE transform matrix — game uses this to reset between draws
          setTransform: function (a, b, c, d, e, f) { this._tx = e || 0; this._ty = f || 0; this._sx = a || 1; this._sy = d || 1; },
          resetTransform: function () { this._tx = 0; this._ty = 0; this._sx = 1; this._sy = 1; },
          transform: function (a, b, c, d, e, f) { this._sx *= (a || 1); this._sy *= (d || 1); this._tx += (e || 0) * this._sx; this._ty += (f || 0) * this._sy; },
          clip: emptyFunc,
          beginPath: function () {
            // Reset polygon vertex tracking for star/trap detection
            this._polyVerts = [];
            this._polyStartX = null;
            this._polyStartY = null;
          },
          moveTo: function () {
            canvasRef = this.canvas;
            if (st > 0) {
              st--;
              if (st === 1) {
                lx = arguments[0];
              } else {
                const diff = arguments[0] - lx;
                if (diff !== 0) {
                  const newGd = sr / diff;
                  if (newGd > 0.01 && newGd < 2.0) {
                    gd = gd * 0.7 + newGd * 0.3;
                  } else {
                    gd = gd * 0.9 + 0.1 * 0.1;
                  }
                }
              }
            }
            // Track polygon first vertex
            if (inGame && !block && arguments.length >= 2) {
              this._polyStartX = arguments[0];
              this._polyStartY = arguments[1];
              this._polyVerts = [{ x: arguments[0], y: arguments[1] }];
            }
          },
          lineTo: function () {
            // Track polygon vertices for star/trap detection
            if (inGame && !block && arguments.length >= 2 && this._polyVerts) {
              this._polyVerts.push({ x: arguments[0], y: arguments[1] });
            }
          },
          rect: function (rx, ry, rw, rh) {
            if (!inGame || block) return;
            this.fillRect(rx, ry, rw, rh);
          },
          arc: function (cx, cy, radius) {
            if (!inGame || block) return;

            // Debug: dump arc calls once every 5 seconds to understand coordinate spaces
            if (!this._arcDebugTime || Date.now() - this._arcDebugTime > 5000) {
              this._arcDebugTime = Date.now();
              this._arcDebugCount = 0;
              this._arcDebugDump = true;
            }
            // ARC debug dump disabled to reduce log spam

            // Detect minimap vs game-view:
            // WASM pre-scales coordinates — _sx is always 1.0
            // Minimap entities have tiny radii (< 3px) and are drawn in the minimap region
            // The minimap is in the bottom-right corner of the 500x500 canvas (~350-500, ~350-500)
            // Game-view entities have larger radii (> 3px) and are drawn around center (250,250)
            const isMinimap = radius < 3 && cx > 300 && cy > 50;

            if (isMinimap) {
              // MINIMAP: only shows teammates — skip for enemy detection
              // Minimap is ONLY used for wall detection (via fillRect)
              return;
            } else if (radius >= 3 && radius < 80) {
              // GAME VIEW: entities drawn with WASM-computed screen positions
              // cx/cy are final screen pixel coordinates (WASM pre-transforms)
              const screenX = cx;
              const screenY = cy;
              const centerX = 250, centerY = 250;
              const distFromCenter = Math.hypot(screenX - centerX, screenY - centerY);
              if (distFromCenter > 15 && distFromCenter < 400) {
                const now = Date.now();

                // Classify by fillStyle color
                let isShape = false;
                let teamColor = 'unknown';
                if (this._colorParsed) {
                  teamColor = classifyColor(this._parsedR, this._parsedG, this._parsedB);
                  if (teamColor === 'shape' || teamColor === 'neutral') {
                    isShape = true;
                  }
                }

                // Track non-shape circles as potential bullets for dodge system
                // We filter out our own bullets later (moving outward from center)
                // Only collect within 350px of center (threat radius) to avoid noise
                if (radius < 30 && !isShape && distFromCenter < 380) {
                  collectBullet(screenX, screenY, radius, teamColor);
                }

                // Check if this entity has barrel rects nearby = it's a player, not a bullet
                // Use persistent barrel set that survives across frames
                let hasBarrels = false;
                const allRects = [...this._barrelRects, ...(this._persistentBarrels || [])];
                for (const br of allRects) {
                  if (Math.hypot(br.screenX - screenX, br.screenY - screenY) < 40) {
                    hasBarrels = true;
                    break;
                  }
                }

                detectedEntities.push({
                  x: position[0] + (screenX - centerX), y: position[1] + (screenY - centerY),
                  radius, time: now,
                  screenDist: distFromCenter, isShape, teamColor,
                  screenX, screenY, hasBarrels
                });
              }
            }
          },
          ellipse: emptyFunc, roundRect: emptyFunc, closePath: emptyFunc,
          fill: function () {
            if (!inGame || block) return;
            const verts = this._polyVerts;
            if (!verts || verts.length < 6) return; // stars need 6+ verts — skip triangles/squares/pentagons fast
            const n = verts.length;

            // Star detection for trap avoidance
            if (n < 6 || n > 14) return;
            let cx = 0, cy = 0;
            for (const v of verts) { cx += v.x; cy += v.y; }
            cx /= n; cy /= n;
            const dists = verts.map(v => Math.hypot(v.x - cx, v.y - cy));
            let evenSum = 0, oddSum = 0, evenCount = 0, oddCount = 0;
            for (let i = 0; i < n; i++) {
              if (i % 2 === 0) { evenSum += dists[i]; evenCount++; }
              else { oddSum += dists[i]; oddCount++; }
            }
            const evenAvg = evenSum / evenCount;
            const oddAvg = oddSum / oddCount;
            const ratio = Math.min(evenAvg, oddAvg) / (Math.max(evenAvg, oddAvg) + 0.01);
            // Star: alternating radii with significant difference
            if (ratio < 0.85 && Math.max(evenAvg, oddAvg) > 5) {
              const screenX = cx;
              const screenY = cy;
              const centerX = 250, centerY = 250;
              const distFromCenter = Math.hypot(screenX - centerX, screenY - centerY);
              if (distFromCenter > 10 && distFromCenter < 400) {
                const trapRadius = Math.max(evenAvg, oddAvg);
                const gameX = position[0] + (screenX - centerX);
                const gameY = position[1] + (screenY - centerY);
                const existing = trapZones.find(t => Math.hypot(t.x - gameX, t.y - gameY) < 20);
                if (existing) {
                  existing.time = Date.now();
                } else {
                  trapZones.push({ x: gameX, y: gameY, radius: trapRadius, time: Date.now(), screenX, screenY });
                  log(`[TRAP DETECTED] star n=${n} at game=(${gameX.toFixed(0)},${gameY.toFixed(0)}) screen=(${screenX.toFixed(0)},${screenY.toFixed(0)}) ratio=${ratio.toFixed(2)} outerR=${trapRadius.toFixed(1)}`);
                }
              }
            }
          },
          stroke: emptyFunc,
          strokeText: emptyFunc, drawImage: emptyFunc,
        };

        const createElement = function (tag, options) {
          const element = {
            tag: tag ? tag.toLowerCase() : '',
            appended: false,
            value: '',
            style: emptyStyle,
            addEventListener: (type, f) => handleListener(type, f, element),
            setAttribute: emptyFunc,
            appendChild: (e) => { e.appended = true },
            focus: function() { try { if (global.document) global.document._activeEl = element; } catch(e) {} },
            blur: function() { try { if (global.document && global.document._activeEl === element) global.document._activeEl = null; } catch(e) {} },
            remove: emptyFunc,
            getBoundingClientRect: () => ({
              width: innerWidth, height: innerHeight, top: 0, left: 0, bottom: innerHeight, right: innerWidth,
            }),
          };

          if (element.tag === 'canvas') {
            element.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC';
            element.getContext = (type) => {
              if (type === '2d') {
                simulatedContext2D.canvas = element;
                return simulatedContext2D;
              }
              return null;
            };
          }

          if (element.tag === 'input') {
            inputs.push(element);
          }

          if (options) {
            Object.assign(element, options);
          }

          return element;
        };

        const doc = createElement('document', {
          createElement: createElement,
          body: null,
          fonts: { load: () => true },
          referrer: '',
        });
        doc.body = createElement('body');
        doc._activeEl = null;
        Object.defineProperty(doc, 'activeElement', {
          get: function() { return doc._activeEl || doc.body; },
          set: function(el) { doc._activeEl = el; },
          configurable: true,
        });

        return doc;
      })();

      global.location = global.window.location = {
        hostname: 'arras.io',
        host: 'arras.io',
        protocol: 'https:',
        origin: 'https://arras.io',
        href: 'https://arras.io/' + (config.hash || ''),
        pathname: '/',
        search: '',
        hash: config.hash,
        query: '',
        reload: function () {},
        replace: function () {},
        assign: function () {}
      }
      let lastHash = global.location.hash
      global.prompt = global.window.prompt = function () {
        console.log('prompt', ...arguments)
      }
      let devicePixelRatio = global.window.devicePixelRatio = 1
      let a = false
      global.requestAnimationFrame = global.window.requestAnimationFrame = function (f) {
        st = 2;
        g();
        a = f
      }
      global.performance = {
        time: 0,
        now: function () {
          return this.time
        }
      }
      const console = {
        log: new Proxy(global.console.log, {
          apply: function (a, b, args) {
            if (args[0] === '%cStop!' || (args[0] && args[0].startsWith && args[0].startsWith('%cHackers have been known'))) { return }
            return Reflect.apply(a, b, args)
          }
        })
      }

      let proxyAgent = null;
      if (config.proxy) {
        if (config.proxy.type === 'socks' || config.proxy.type === 'socks4' || config.proxy.type === 'socks5') {
          proxyAgent = new SocksProxyAgent(config.proxy.url);
        } else if (config.proxy.type === 'http') {
          proxyAgent = new HttpsProxyAgent(config.proxy.url);
        }
      }

      let i = 0, controller = {
        x: 250,
        y: 250,
        mouseDown: function (button) {
          trigger.mousedown(controller.x, controller.y, button)
        },
        mouseUp: function (button) {
          trigger.mouseup(controller.x, controller.y, button)
        },
        click: function (x, y) {
          trigger.mousedown(x, y, 0)
          trigger.mouseup(x, y, 0)
        },
        press: function (code) {
          trigger.keydown(code)
          trigger.keyup(code)
        },
        chat: function (str) {
          // Open chat input
          controller.press('Enter')
          global.performance.time += 50
          a()
          // Set the message text
          setValue(str)
          global.performance.time += 50
          a()
          // Send message
          controller.press('Enter')
          global.performance.time += 50
          a()
        },
        moveDirection: function (x, y) {
          trigger[x < 0 ? 'keydown' : 'keyup']('KeyA')
          trigger[y < 0 ? 'keydown' : 'keyup']('KeyW')
          trigger[x > 0 ? 'keydown' : 'keyup']('KeyD')
          trigger[y > 0 ? 'keydown' : 'keyup']('KeyS')
        },
        iv: 4 / Math.PI,
        dv: Math.PI / 4,
        ix: [1, 1, 0, -1, -1, -1, 0, 1],
        iy: [0, 1, 1, 1, 0, -1, -1, -1],
        moveVector: function (x, y, i) {
          let d = Math.atan2(y, x)
          let h = (Math.round(d * controller.iv) % 8 + 8) % 8
          let x2 = controller.ix[h]
          let y2 = controller.iy[h]
          controller.moveDirection(x2, y2)
          return h * controller.dv
        }
      }, statusRecieved = false, firstJoin = false, hasJoined = false, timeouts = {}, timeout = function (f, t) {
        if (!(t >= 1)) { t = 1 }
        let n = i + t
        let a = timeouts[n]
        if (!a) {
          a = timeouts[n] = []
        }
        a.push(f)
      }, block = false

      async function waitTime(timeout) {
          await new Promise(resolve => setTimeout(resolve, timeout));
      }


      // PATH FIND FUNC
      function getDir(x1, y1, x2, y2) {
          return Math.atan2(y2 - y1, x2 - x1);
      }

      function randint(a, b) {
          return Math.floor(Math.random() * (b - a + 1)) + a;
      }

      function choice(array) {
          return array[randint(0, array.length-1)];
      }

      function stopMoving() {
        for (const key of "WASD") {
          const k = "Key" + key;
          if (typeof _lastHeldKeys !== 'undefined' && _lastHeldKeys[k]) {
            trigger.keyup(k);
            _lastHeldKeys[k] = false;
          } else if (typeof _lastHeldKeys === 'undefined') {
            trigger.keyup(k);
          }
        }
      }

      // =====================================================================
      // [SMART MOVEMENT] Wall-aware fluid 8-direction movement
      // Ported from optimized browser bot script
      // =====================================================================
      const SMART_DIRECTIONS = [
        { dx:  0, dy: -1, name: "N"  },  // 0: W
        { dx:  0, dy:  1, name: "S"  },  // 1: S
        { dx: -1, dy:  0, name: "W"  },  // 2: A
        { dx:  1, dy:  0, name: "E"  },  // 3: D
        { dx: -1, dy: -1, name: "NW" },  // 4: W+A
        { dx:  1, dy: -1, name: "NE" },  // 5: W+D
        { dx: -1, dy:  1, name: "SW" },  // 6: S+A
        { dx:  1, dy:  1, name: "SE" },  // 7: S+D
      ];
      const SMART_DIR_VECTORS = SMART_DIRECTIONS.map(d => {
        const len = Math.hypot(d.dx, d.dy);
        return { dx: d.dx / len, dy: d.dy / len };
      });

      // =====================================================================
      // [WALL MAP] Detected wall rectangles from fillRect interception
      // =====================================================================
      let wallMap = [];
      const WALL_MAP_MAX = 2000; // high cap — minimap reveals entire map's walls
      const WALL_MAP_EXPIRY = 600000; // 10 min — walls don't move
      let baseZones = []; // detected base rectangles on minimap — no-go zones
      let posHistory = [];
      const POS_HISTORY_MAX = 50;

      // =====================================================================
      // [A* PATHFINDING] Grid-based navigation around walls
      // =====================================================================
      const GRID_CELL = 15;        // game units per grid cell — roughly tank width
      const GRID_RADIUS = 40;      // grid extends 40 cells in each direction = 80x80 grid
      const GRID_SIZE = GRID_RADIUS * 2 + 1; // 81x81
      const ASTAR_REPLAN_INTERVAL = 500;  // recompute path every 500ms
      const WAYPOINT_REACH_DIST = 12;     // close enough to waypoint to advance
      let astarPath = [];                 // list of {x, y} waypoints in game coords
      let astarPathIdx = 0;              // current waypoint index
      let lastAstarTime = 0;
      let lastAstarTarget = null;        // {x, y} of last A* target

      const WALL_PAD = 6; // inflate walls to close micro-gaps (0.5 unit gaps between wall segments)

      // Check if a game-coordinate point is inside any known wall (with padding)
      function isPointInWall(gx, gy) {
        const now = Date.now();
        for (let i = wallMap.length - 1; i >= 0; i--) {
          const w = wallMap[i];
          if (now - w.time > WALL_MAP_EXPIRY) continue;
          const hw = w.w / 2 + WALL_PAD, hh = w.h / 2 + WALL_PAD;
          if (gx >= w.x - hw && gx <= w.x + hw && gy >= w.y - hh && gy <= w.y + hh) return true;
        }
        return false;
      }

      // Check if a game-coordinate rect overlaps any known wall (with padding)
      function doesRectHitWall(rx, ry, rw, rh) {
        const now = Date.now();
        for (let i = wallMap.length - 1; i >= 0; i--) {
          const w = wallMap[i];
          if (now - w.time > WALL_MAP_EXPIRY) continue;
          const hw = w.w / 2 + WALL_PAD, hh = w.h / 2 + WALL_PAD;
          if (rx + rw > w.x - hw && rx < w.x + hw && ry + rh > w.y - hh && ry < w.y + hh) return true;
        }
        return false;
      }

      // Build grid and run A* from current position to target
      function computeAStarPath(targetX, targetY) {
        const px = position[0], py = position[1];
        // Grid origin: centered on bot's current position
        const originX = px - GRID_RADIUS * GRID_CELL;
        const originY = py - GRID_RADIUS * GRID_CELL;

        // Map target to grid coords
        const tgx = Math.round((targetX - originX) / GRID_CELL);
        const tgy = Math.round((targetY - originY) / GRID_CELL);
        const sgx = GRID_RADIUS; // start is always center of grid
        const sgy = GRID_RADIUS;

        // Clamp target to grid bounds
        const etgx = Math.max(0, Math.min(GRID_SIZE - 1, tgx));
        const etgy = Math.max(0, Math.min(GRID_SIZE - 1, tgy));

        // If start === target, no path needed
        if (sgx === etgx && sgy === etgy) return [];

        // Build blocked grid — check each cell against wall map
        // Use a flat array for speed: blocked[y * GRID_SIZE + x]
        const blocked = new Uint8Array(GRID_SIZE * GRID_SIZE);
        const cellPad = GRID_CELL * 0.4; // padding so bot doesn't scrape walls or squeeze through gaps
        for (let gy = 0; gy < GRID_SIZE; gy++) {
          for (let gx = 0; gx < GRID_SIZE; gx++) {
            const worldX = originX + gx * GRID_CELL;
            const worldY = originY + gy * GRID_CELL;
            if (doesRectHitWall(worldX - cellPad, worldY - cellPad, GRID_CELL + cellPad * 2, GRID_CELL + cellPad * 2)) {
              blocked[gy * GRID_SIZE + gx] = 1;
            }
          }
        }
        // Never block start or end cells (we're already there / need to reach)
        blocked[sgy * GRID_SIZE + sgx] = 0;
        blocked[etgy * GRID_SIZE + etgx] = 0;

        // A* with 8-directional movement
        // Open set as binary heap (min-heap on fScore)
        const gScore = new Float32Array(GRID_SIZE * GRID_SIZE).fill(Infinity);
        const fScore = new Float32Array(GRID_SIZE * GRID_SIZE).fill(Infinity);
        const cameFrom = new Int32Array(GRID_SIZE * GRID_SIZE).fill(-1);
        const closed = new Uint8Array(GRID_SIZE * GRID_SIZE);

        const startIdx = sgy * GRID_SIZE + sgx;
        const endIdx = etgy * GRID_SIZE + etgx;
        gScore[startIdx] = 0;
        fScore[startIdx] = Math.hypot(etgx - sgx, etgy - sgy);

        // Simple open set with sorted insertion (good enough for 81x81 grid)
        const open = [startIdx];
        const inOpen = new Uint8Array(GRID_SIZE * GRID_SIZE);
        inOpen[startIdx] = 1;

        const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
        const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];
        const cost8 = [1.414, 1, 1.414, 1, 1, 1.414, 1, 1.414];

        let found = false;
        let iterations = 0;
        const MAX_ITERATIONS = 3000; // prevent infinite loop on huge grids

        while (open.length > 0 && iterations < MAX_ITERATIONS) {
          iterations++;
          // Find lowest fScore in open set
          let bestI = 0;
          for (let i = 1; i < open.length; i++) {
            if (fScore[open[i]] < fScore[open[bestI]]) bestI = i;
          }
          const current = open[bestI];
          open.splice(bestI, 1);
          inOpen[current] = 0;

          if (current === endIdx) { found = true; break; }
          closed[current] = 1;

          const cx = current % GRID_SIZE;
          const cy = (current - cx) / GRID_SIZE;

          for (let d = 0; d < 8; d++) {
            const nx = cx + dx8[d];
            const ny = cy + dy8[d];
            if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
            const nIdx = ny * GRID_SIZE + nx;
            if (blocked[nIdx] || closed[nIdx]) continue;

            // For diagonal moves, check that both adjacent cardinal cells are free
            if (dx8[d] !== 0 && dy8[d] !== 0) {
              if (blocked[cy * GRID_SIZE + nx] || blocked[ny * GRID_SIZE + cx]) continue;
            }

            const tentG = gScore[current] + cost8[d];
            if (tentG < gScore[nIdx]) {
              cameFrom[nIdx] = current;
              gScore[nIdx] = tentG;
              fScore[nIdx] = tentG + Math.hypot(etgx - nx, etgy - ny);
              if (!inOpen[nIdx]) {
                open.push(nIdx);
                inOpen[nIdx] = 1;
              }
            }
          }
        }

        if (!found) return []; // no path exists

        // Reconstruct path
        const rawPath = [];
        let cur = endIdx;
        while (cur !== startIdx && cur !== -1) {
          const cx = cur % GRID_SIZE;
          const cy = (cur - cx) / GRID_SIZE;
          rawPath.push({ x: originX + cx * GRID_CELL + GRID_CELL / 2, y: originY + cy * GRID_CELL + GRID_CELL / 2 });
          cur = cameFrom[cur];
        }
        rawPath.reverse();

        // Simplify path: skip waypoints that are in line-of-sight
        if (rawPath.length <= 2) return rawPath;
        const simplified = [rawPath[0]];
        let lastSafe = 0;
        for (let i = 2; i < rawPath.length; i++) {
          // Check if we can go directly from lastSafe to i (no walls in between)
          if (!isLineBlocked(rawPath[lastSafe].x, rawPath[lastSafe].y, rawPath[i].x, rawPath[i].y)) {
            continue; // skip intermediate waypoint
          }
          simplified.push(rawPath[i - 1]); // last non-blocked point
          lastSafe = i - 1;
        }
        simplified.push(rawPath[rawPath.length - 1]); // always include final target
        return simplified;
      }

      // Check if a straight line between two points crosses any wall
      function isLineBlocked(x1, y1, x2, y2) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.ceil(dist / (GRID_CELL * 0.5));
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const mx = x1 + (x2 - x1) * t;
          const my = y1 + (y2 - y1) * t;
          if (isPointInWall(mx, my)) return true;
        }
        return false;
      }

      // Navigate to target using A* — returns true if following a path, false if direct
      function navigateAStar(targetX, targetY) {
        const now = Date.now();
        const px = position[0], py = position[1];
        const distToTarget = Math.hypot(targetX - px, targetY - py);

        // If close enough, just go direct
        if (distToTarget < GRID_CELL * 2) {
          astarPath = [];
          return false;
        }

        // Check if we have walls nearby — if no walls detected, skip A* (faster)
        let hasNearbyWalls = false;
        for (let i = wallMap.length - 1; i >= 0; i--) {
          const w = wallMap[i];
          if (now - w.time > WALL_MAP_EXPIRY) continue;
          if (Math.abs(w.x - px) < GRID_RADIUS * GRID_CELL && Math.abs(w.y - py) < GRID_RADIUS * GRID_CELL) {
            hasNearbyWalls = true;
            break;
          }
        }
        if (!hasNearbyWalls) {
          astarPath = [];
          return false; // no walls, go direct
        }

        // Check if we can go straight to target (no walls in the way)
        if (!isLineBlocked(px, py, targetX, targetY)) {
          astarPath = [];
          return false; // clear line of sight
        }

        // Recompute A* path periodically or if target changed significantly
        const targetMoved = !lastAstarTarget || Math.hypot(targetX - lastAstarTarget.x, targetY - lastAstarTarget.y) > GRID_CELL * 3;
        if (now - lastAstarTime > ASTAR_REPLAN_INTERVAL || targetMoved || astarPath.length === 0) {
          astarPath = computeAStarPath(targetX, targetY);
          astarPathIdx = 0;
          lastAstarTime = now;
          lastAstarTarget = { x: targetX, y: targetY };
          if (astarPath.length > 0) {
            log('[A*] Path found:', astarPath.length, 'waypoints, walls:', wallMap.length);
          }
        }

        // Follow waypoints
        if (astarPath.length > 0 && astarPathIdx < astarPath.length) {
          const wp = astarPath[astarPathIdx];
          const distToWp = Math.hypot(wp.x - px, wp.y - py);
          if (distToWp < WAYPOINT_REACH_DIST) {
            astarPathIdx++;
            if (astarPathIdx >= astarPath.length) {
              astarPath = [];
              return false; // reached end of path
            }
          }
          // Move toward current waypoint
          directPathfind(astarPath[astarPathIdx].x, astarPath[astarPathIdx].y);
          return true; // following A* path
        }

        return false;
      }

      // Key event cache — only fire keydown/keyup when state actually changes
      let _lastHeldKeys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };

      // Direct movement toward a point (no wall awareness, just angle-based WASD)
      function directPathfind(x, y) {
        const angle = getDir(position[0], position[1], x, y);
        let hold = {};
        if (angle >= -Math.PI / 8 && angle < Math.PI / 8) {
          hold["KeyD"] = true;
        } else if (angle >= Math.PI / 8 && angle < 3 * Math.PI / 8) {
          hold["KeyS"] = true; hold["KeyD"] = true;
        } else if (angle >= 3 * Math.PI / 8 && angle < 5 * Math.PI / 8) {
          hold["KeyS"] = true;
        } else if (angle >= 5 * Math.PI / 8 && angle < 7 * Math.PI / 8) {
          hold["KeyS"] = true; hold["KeyA"] = true;
        } else if (angle >= 7 * Math.PI / 8 || angle < -7 * Math.PI / 8) {
          hold["KeyA"] = true;
        } else if (angle >= -7 * Math.PI / 8 && angle < -5 * Math.PI / 8) {
          hold["KeyW"] = true; hold["KeyA"] = true;
        } else if (angle >= -5 * Math.PI / 8 && angle < -3 * Math.PI / 8) {
          hold["KeyW"] = true;
        } else {
          hold["KeyW"] = true; hold["KeyD"] = true;
        }
        for (let key of "WASD") {
          key = "Key" + key;
          const shouldHold = !!hold[key];
          if (shouldHold !== _lastHeldKeys[key]) {
            trigger[shouldHold ? "keydown" : "keyup"](key);
            _lastHeldKeys[key] = shouldHold;
          }
        }
      }

      // =====================================================================
      // [SMART MOVEMENT] Wall-aware fluid 8-direction movement (legacy fallback)
      // =====================================================================

      // Fluid movement state
      let smartDirIndex = -1;
      let dirHoldUntil = 0;
      const DIR_HOLD_MIN = 800;
      const DIR_HOLD_MAX = 2500;
      const DIR_CHANGE_CHANCE = 0.01;
      let idlePauseUntil = 0;
      const IDLE_PAUSE_CHANCE = 0.003;

      // Wall memory: tracks directions where bot got stuck
      let wallMemory = {};
      const WALL_CHECK_INTERVAL = 400;
      const WALL_MOVE_THRESHOLD = 0.15;
      let lastWallCheck = { x: 0, y: 0, time: 0, dir: null };
      let wallAvoidActive = false;
      let wallAvoidDir = null;
      let wallAvoidStart = 0;
      const WALL_AVOIDANCE_TIMEOUT = 3000;

      function isWallAhead(dx, dy, dist) {
        const now = Date.now();
        const px = position[0], py = position[1];
        const checkX = px + dx * dist;
        const checkY = py + dy * dist;
        if (isPointInWall(checkX, checkY)) return true;
        for (let i = 0; i < posHistory.length; i++) {
          const p = posHistory[i];
          if (now - p.time > 30000) continue;
          if (Math.abs(checkX - p.x) < 2 && Math.abs(checkY - p.y) < 2 && p.stuck) return true;
        }
        return false;
      }

      let lastStuckWallTime = 0;
      function trackPosition() {
        const now = Date.now();
        const px = position[0], py = position[1];
        if (posHistory.length > 0) {
          const last = posHistory[posHistory.length - 1];
          const dist = Math.hypot(px - last.x, py - last.y);
          if (dist < 0.1 && now - last.time > 500) {
            last.stuck = true;
            // Create a virtual wall where we're stuck (helps A* route around unseen walls)
            if (now - lastStuckWallTime > 2000) {
              lastStuckWallTime = now;
              // Place a small virtual wall slightly ahead of current position
              wallMap.push({ x: px, y: py, w: GRID_CELL * 2, h: GRID_CELL * 2, time: now });
              if (wallMap.length > WALL_MAP_MAX) wallMap.shift();
              astarPath = []; // force replan
            }
          }
        }
        posHistory.push({ x: px, y: py, time: now, stuck: false });
        if (posHistory.length > POS_HISTORY_MAX) posHistory.shift();
        if (now % 10000 < 100) {
          wallMap = wallMap.filter(w => now - w.time < WALL_MAP_EXPIRY);
        }
      }

      function pickDirectionIndex(preferDx, preferDy, exclude) {
        exclude = exclude || [];
        let bestIdx = -1, bestScore = -999;
        for (let i = 0; i < SMART_DIRECTIONS.length; i++) {
          if (exclude.indexOf(i) !== -1) continue;
          const v = SMART_DIR_VECTORS[i];
          let dot = v.dx * preferDx + v.dy * preferDy;
          const wk = SMART_DIRECTIONS[i].name;
          if (wallMemory[wk] && Date.now() - wallMemory[wk].time < 10000) dot -= 2.0;
          if (isWallAhead(v.dx, v.dy, 15)) dot -= 3.0;
          if (isWallAhead(v.dx, v.dy, 30)) dot -= 1.5;
          dot += (Math.random() - 0.5) * 0.3;
          if (dot > bestScore) { bestScore = dot; bestIdx = i; }
        }
        return bestIdx;
      }

      function getPerpendicularDirs(idx) {
        const perps = {
          0: [2,3], 1: [2,3], 2: [0,1], 3: [0,1],
          4: [3,1], 5: [2,1], 6: [3,0], 7: [2,0],
        };
        return perps[idx] || [0,1];
      }

      function checkForWall() {
        if (smartDirIndex < 0 || position[2] < 0) return;
        const now = Date.now();
        const elapsed = now - lastWallCheck.time;
        if (elapsed >= WALL_CHECK_INTERVAL && lastWallCheck.dir !== null) {
          const dist = Math.hypot(position[0] - lastWallCheck.x, position[1] - lastWallCheck.y);
          if (dist < WALL_MOVE_THRESHOLD && smartDirIndex === lastWallCheck.dir) {
            const wk = SMART_DIRECTIONS[smartDirIndex].name;
            wallMemory[wk] = { time: now, x: position[0], y: position[1] };
            wallAvoidActive = true;
            wallAvoidStart = now;
            const perps = getPerpendicularDirs(smartDirIndex);
            let chosen = perps[Math.floor(Math.random() * perps.length)];
            if (wallMemory[SMART_DIRECTIONS[chosen].name] &&
                now - wallMemory[SMART_DIRECTIONS[chosen].name].time < 8000) {
              chosen = perps[0] === chosen ? perps[1] : perps[0];
            }
            wallAvoidDir = chosen;
            dirHoldUntil = 0;
          } else if (dist >= WALL_MOVE_THRESHOLD && wallAvoidActive) {
            wallAvoidActive = false;
            wallAvoidDir = null;
          }
        }
        lastWallCheck.x = position[0];
        lastWallCheck.y = position[1];
        lastWallCheck.time = now;
        lastWallCheck.dir = smartDirIndex;
      }

      function pickSmartDirection() {
        if (wallAvoidActive) {
          if (Date.now() - wallAvoidStart > WALL_AVOIDANCE_TIMEOUT) {
            wallAvoidActive = false;
            wallAvoidDir = null;
          } else if (wallAvoidDir !== null) {
            return wallAvoidDir;
          }
        }
        const toCenterX = -position[0];
        const toCenterY = -position[1];
        const distToCenter = Math.hypot(toCenterX, toCenterY);
        if (distToCenter > 1) {
          return pickDirectionIndex(toCenterX / distToCenter, toCenterY / distToCenter);
        }
        return Math.floor(Math.random() * SMART_DIRECTIONS.length);
      }

      function applySmartDirection(idx) {
        const d = SMART_DIRECTIONS[idx];
        trigger[d.dy < 0 ? 'keydown' : 'keyup']('KeyW');
        trigger[d.dy > 0 ? 'keydown' : 'keyup']('KeyS');
        trigger[d.dx < 0 ? 'keydown' : 'keyup']('KeyA');
        trigger[d.dx > 0 ? 'keydown' : 'keyup']('KeyD');
      }

      function smartMovementTick() {
        if (block || !inGame || isChatting) return;
        trackPosition();
        checkForWall();
        const now = Date.now();

        if (now < idlePauseUntil) {
          stopMoving();
          return;
        }
        if (Math.random() < IDLE_PAUSE_CHANCE) {
          idlePauseUntil = now + 500 + Math.random() * 2000;
          stopMoving();
          return;
        }

        let shouldChange = (now >= dirHoldUntil) || (Math.random() < DIR_CHANGE_CHANCE);
        if (shouldChange || smartDirIndex < 0) {
          const prevDir = smartDirIndex;
          smartDirIndex = pickSmartDirection();
          let hold = DIR_HOLD_MIN + Math.random() * (DIR_HOLD_MAX - DIR_HOLD_MIN);
          if (wallAvoidActive) hold = Math.min(hold, 1200);
          dirHoldUntil = now + hold;
          // Only send key events if direction actually changed
          if (smartDirIndex !== prevDir) {
            applySmartDirection(smartDirIndex);
          }
        }
      }

      // =====================================================================
      // [ROLE BEHAVIORS] PvP, Wanderer, Chatbot movement patterns
      // =====================================================================
      let isChatting = false;
      let ownSentMessages = {};

      // --- Entity tracking: detected from canvas arc() calls ---
      let detectedEntities = [];
      const ENTITY_EXPIRE = 1500; // forget nearby entities after 1.5s
      const MINIMAP_ENTITY_EXPIRE = 5000; // minimap entities last longer (less frequent updates)

      // --- Trap/pillbox tracking: star-shaped polygons that deal contact damage ---
      let trapZones = []; // [{x, y, radius, time}] in game coords
      const TRAP_EXPIRE = 5000; // forget traps after 5s
      const TRAP_AVOID_DIST = 150; // stay far from traps (game coord units) — they're lethal on contact

      // --- Friendly bot positions (received from server) ---
      let friendlyPositions = []; // [{x, y}] — positions of all other bots
      const FRIENDLY_FILTER_DIST = 40; // entities within this distance of a friendly bot are ignored
      global._setFriendlyPositions = (positions) => { friendlyPositions = positions; };

      function isNearFriendly(x, y) {
        for (let i = 0; i < friendlyPositions.length; i++) {
          const f = friendlyPositions[i];
          if (Math.abs(x - f.x) < FRIENDLY_FILTER_DIST && Math.abs(y - f.y) < FRIENDLY_FILTER_DIST) return true;
        }
        return false;
      }

      // Detect what team the bot itself is on (set when first player-color entity is very close)
      let botTeamColor = null;

      // =====================================================================
      // [BULLET TRACKING] Detect and track projectiles for dodge system
      // =====================================================================
      // Bullets are small arc() circles (radius 3-8px) that move fast between frames
      // We track their screen positions over time to compute velocity vectors
      let trackedBullets = []; // [{id, screenX, screenY, vx, vy, radius, teamColor, frame, frames}]
      let _bulletIdCounter = 0;
      let _bulletFrame = 0; // increments each game tick (each a() call)
      let _currentFrameBullets = []; // bullets seen THIS frame — matched against trackedBullets after frame ends
      const BULLET_MATCH_DIST = 100; // max distance to match bullet between frames (fast bullets travel far)
      const BULLET_MIN_SPEED = 0.3; // minimum velocity to count as moving
      const BULLET_THREAT_RADIUS = 350; // pixels from bot center — wide detection for fast bullets
      const BULLET_DODGE_STRENGTH = 0.95;

      function collectBullet(screenX, screenY, radius, teamColor) {
        // Called during arc() — just collect, don't match yet
        _currentFrameBullets.push({ screenX, screenY, radius, teamColor });
      }

      function processBulletFrame() {
        // Called ONCE per game tick after a() completes — match this frame's bullets to previous frame's
        _bulletFrame++;
        const bullets = _currentFrameBullets;
        _currentFrameBullets = [];

        // Expire: not seen for 4+ frames, OR velocity near zero after 3+ matches (static entity, not bullet)
        trackedBullets = trackedBullets.filter(b => {
          if (_bulletFrame - b.frame >= 4) return false; // not seen recently
          if (b.frames >= 3 && Math.hypot(b.vx, b.vy) < 0.5) return false; // static entity
          if (b.frames > 30) return false; // way too old, something wrong
          return true;
        });
        if (trackedBullets.length > 200) trackedBullets = trackedBullets.slice(-100);

        // Match each collected bullet to nearest tracked bullet
        const used = new Set();
        for (const nb of bullets) {
          let bestMatch = null, bestDist = BULLET_MATCH_DIST;
          for (let i = 0; i < trackedBullets.length; i++) {
            if (used.has(i)) continue;
            const b = trackedBullets[i];
            // Predict position using last known velocity
            const frameDelta = _bulletFrame - b.frame;
            const predX = b.screenX + b.vx * frameDelta;
            const predY = b.screenY + b.vy * frameDelta;
            const d = Math.hypot(nb.screenX - predX, nb.screenY - predY);
            if (d < bestDist) {
              bestDist = d;
              bestMatch = i;
            }
          }

          if (bestMatch !== null) {
            const b = trackedBullets[bestMatch];
            used.add(bestMatch);
            // Compute velocity: pixels per frame
            const frameDelta = Math.max(1, _bulletFrame - b.frame);
            const newVx = (nb.screenX - b.screenX) / frameDelta;
            const newVy = (nb.screenY - b.screenY) / frameDelta;
            // Minimal smoothing — react as fast as possible
            const smooth = b.frames < 2 ? 0.1 : 0.3;
            b.vx = b.vx * smooth + newVx * (1 - smooth);
            b.vy = b.vy * smooth + newVy * (1 - smooth);
            b.screenX = nb.screenX;
            b.screenY = nb.screenY;
            b.frame = _bulletFrame;
            b.frames++;
          } else {
            // New bullet
            trackedBullets.push({
              id: _bulletIdCounter++,
              screenX: nb.screenX, screenY: nb.screenY,
              vx: 0, vy: 0,
              radius: nb.radius, teamColor: nb.teamColor,
              frame: _bulletFrame, frames: 1
            });
          }
        }
      }

      function getIncomingThreats() {
        // Expiry and capping handled in processBulletFrame()

        const threats = [];
        const centerX = 250, centerY = 250;
        let _dbgFrames = 0, _dbgSpeed = 0, _dbgDist = 0, _dbgDot = 0, _dbgTime = 0;

        for (const b of trackedBullets) {
          if (b.frames < 2) { _dbgFrames++; continue; }
          // Skip our own bullets: moving outward from center = ours
          const fromCx = b.screenX - centerX, fromCy = b.screenY - centerY;
          const outwardDot = b.vx * fromCx + b.vy * fromCy;
          if (outwardDot > 0 && botTeamColor && b.teamColor === botTeamColor) { _dbgDot++; continue; }
          const speed = Math.hypot(b.vx, b.vy);
          if (speed < BULLET_MIN_SPEED) { _dbgSpeed++; continue; }

          // LINE TRACE: project bullet's path as a ray, check if it intersects bot
          // Bullet ray: P + t*V where P=(screenX,screenY), V=(vx,vy)
          // Find closest approach to bot center (250,250)
          const dx = b.screenX - centerX;
          const dy = b.screenY - centerY;
          const distToBot = Math.hypot(dx, dy);
          if (distToBot > BULLET_THREAT_RADIUS) { _dbgDist++; continue; }

          // t of closest approach: t = -(dx*vx + dy*vy) / (vx²+vy²)
          const vSq = b.vx * b.vx + b.vy * b.vy;
          const tClosest = -(dx * b.vx + dy * b.vy) / (vSq + 0.001);

          // Only future bullets (t > 0 = still approaching)
          if (tClosest < 0) { _dbgDot++; continue; }

          // Distance at closest approach point on the line
          const closestX = b.screenX + b.vx * tClosest - centerX;
          const closestY = b.screenY + b.vy * tClosest - centerY;
          const closestDist = Math.hypot(closestX, closestY);

          // Will bullet's line pass within hit radius? (bot body ~25px + bullet size + safety margin)
          const hitRadius = 30 + (b.radius || 5);
          if (closestDist > hitRadius) { _dbgDot++; continue; }

          // Threat = closer + bigger bullet + tighter pass = more dangerous
          const sizeFactor = Math.max(b.radius / 5, 0.5);
          const passTightness = 1 - (closestDist / hitRadius); // 1.0=dead center, 0=barely grazes
          const threat = (1 - distToBot / BULLET_THREAT_RADIUS) * passTightness * sizeFactor;

          threats.push({
            screenX: b.screenX, screenY: b.screenY,
            vx: b.vx, vy: b.vy,
            speed, distToBot, closestDist, threat,
            timeToImpact: tClosest,
            radius: b.radius
          });
        }

        // Sort by threat level (most dangerous first)
        threats.sort((a, b) => b.threat - a.threat);
        // Debug: log why bullets aren't threats — more frequent when no threats detected
        if (trackedBullets.length > 2 && threats.length === 0 && Math.random() < 0.3) {
          log(`[BULLET DBG] ${trackedBullets.length} tracked → frames:${_dbgFrames} speed:${_dbgSpeed} dist:${_dbgDist} dot/miss:${_dbgDot} time:${_dbgTime} → ${threats.length} threats`);
          // Log first bullet details for diagnosis
          const sample = trackedBullets.find(b => b.frames >= 2);
          if (sample) {
            const sdx = sample.screenX - centerX, sdy = sample.screenY - centerY;
            const sDist = Math.hypot(sdx, sdy);
            const sSpeed = Math.hypot(sample.vx, sample.vy);
            const svSq = sample.vx * sample.vx + sample.vy * sample.vy;
            const stClosest = -(sdx * sample.vx + sdy * sample.vy) / (svSq + 0.001);
            log(`[BULLET SAMPLE] pos=(${sample.screenX.toFixed(0)},${sample.screenY.toFixed(0)}) v=(${sample.vx.toFixed(2)},${sample.vy.toFixed(2)}) spd=${sSpeed.toFixed(2)} dist=${sDist.toFixed(0)} tClose=${stClosest.toFixed(1)} frames=${sample.frames} r=${sample.radius.toFixed(1)} team=${sample.teamColor}`);
          }
        }
        return threats;
      }

      // Committed dodge system: pick the best escape direction considering ALL threats,
      // then commit for long enough to actually clear the bullet paths.
      let _activeDodge = null; // { dirX, dirY, until, fromBulletAngle, threatLevel }
      let _dodgeCooldown = 0; // prevent instant re-dodge after committing

      function computeLineDodge(threats) {
        const now = Date.now();

        if (threats.length === 0) {
          // No threats — cancel dodge immediately (bullet despawned, hit wall, etc.)
          _activeDodge = null;
          return null;
        }

        // If currently dodging AND commitment hasn't expired, check if we should re-evaluate
        if (_activeDodge && now < _activeDodge.until) {
          const maxNewThreat = threats[0].threat;
          // For big bullets (high dodgeScale), allow easier override — they commit longer
          // so we need to be more responsive to new threats during the dodge
          const overrideThreshold = (_activeDodge.dodgeScale || 100) > 150 ? 1.2 : 1.8;
          if (maxNewThreat < _activeDodge.threatLevel * overrideThreshold) {
            return _activeDodge; // stay committed
          }
          // New threat is dangerous enough — re-dodge
        }

        // Minimal cooldown — 15ms just to prevent same-frame jitter
        if (!_activeDodge && now < _dodgeCooldown) return null;

        // === COMBINED THREAT VECTOR ===
        // For each threat, compute the ideal dodge direction (perpendicular to bullet path)
        // Weight by urgency: closer + faster + tighter pass = more weight
        let combinedDirX = 0, combinedDirY = 0;
        let maxUrgency = 0;
        let dominantBulletAngle = 0;

        for (const t of threats) {
          const bulletAngle = Math.atan2(t.vy, t.vx);
          // Two perpendicular options
          const perp1X = -t.vy / (t.speed + 0.01);
          const perp1Y = t.vx / (t.speed + 0.01);
          const perp2X = t.vy / (t.speed + 0.01);
          const perp2Y = -t.vx / (t.speed + 0.01);

          // Pick the perp that moves us AWAY from the bullet's closest approach point
          const closestX = t.screenX + t.vx * t.timeToImpact - 250;
          const closestY = t.screenY + t.vy * t.timeToImpact - 250;
          const dot1 = perp1X * (-closestX) + perp1Y * (-closestY);
          const dot2 = perp2X * (-closestX) + perp2Y * (-closestY);
          const bestPerpX = dot1 > dot2 ? perp1X : perp2X;
          const bestPerpY = dot1 > dot2 ? perp1Y : perp2Y;

          // Urgency: imminent bullets matter much more
          const timeWeight = Math.max(0, 1 - t.timeToImpact / 15); // peaks at close range (frames)
          const urgency = t.threat * (1 + timeWeight * 3);

          combinedDirX += bestPerpX * urgency;
          combinedDirY += bestPerpY * urgency;

          if (urgency > maxUrgency) {
            maxUrgency = urgency;
            dominantBulletAngle = bulletAngle;
          }
        }

        const combinedMag = Math.hypot(combinedDirX, combinedDirY);
        if (combinedMag < 0.01) return _activeDodge; // threats cancel out — hold position

        // Normalize
        combinedDirX /= combinedMag;
        combinedDirY /= combinedMag;

        // Dodge parameters scale with urgency
        const closestThreatDist = Math.min(...threats.map(t => t.distToBot));
        const bulletRadius = threats[0].radius || 5;
        const sizeScale = Math.max(bulletRadius / 5, 0.5);

        // Commit time tuned per bullet size:
        // Small bullets (sizeScale~1): 180-240ms — slightly longer to fully clear
        // Big bullets (sizeScale~2+): 120-160ms — short commits, re-evaluate fast
        const commitTime = sizeScale <= 1.2
          ? (closestThreatDist < 80 ? 160 + sizeScale * 50 : 220 + sizeScale * 30)  // small: 160-280ms
          : (closestThreatDist < 80 ? 90 + sizeScale * 20 : 120 + sizeScale * 20);   // big: 90-170ms
        const dodgeSpeed = 100 + sizeScale * 80;

        _activeDodge = {
          dirX: combinedDirX,
          dirY: combinedDirY,
          until: now + commitTime,
          fromBulletAngle: dominantBulletAngle,
          dodgeScale: dodgeSpeed,
          threatLevel: maxUrgency
        };
        _dodgeCooldown = now + commitTime + 15;
        return _activeDodge;
      }

      function getNearest() {
        const now = Date.now();
        detectedEntities = detectedEntities.filter(e => now - e.time < (e.minimap ? MINIMAP_ENTITY_EXPIRE : ENTITY_EXPIRE));
        if (detectedEntities.length === 0) return null;

        const clusters = [];
        for (const ent of detectedEntities) {
          if (isNearFriendly(ent.x, ent.y)) continue;
          // Skip shapes/food/barrels/walls — only target players
          if (ent.isShape) continue;
          // Skip same-team entities (if we know our team)
          if (botTeamColor && ent.teamColor === botTeamColor) continue;
          let merged = false;
          for (const c of clusters) {
            if (Math.hypot(ent.x - c.x, ent.y - c.y) < 50) {
              if (ent.time > c.time) { c.x = ent.x; c.y = ent.y; c.time = ent.time; c.teamColor = ent.teamColor; }
              merged = true;
              break;
            }
          }
          if (!merged) clusters.push({ x: ent.x, y: ent.y, time: ent.time, teamColor: ent.teamColor });
        }

        let best = null, bestDist = Infinity;
        for (const c of clusters) {
          const d = Math.hypot(c.x - position[0], c.y - position[1]);
          if (d < bestDist) { bestDist = d; best = c; }
        }
        return best;
      }

      // --- AIM SYSTEM: smooth mouse tracking with lead prediction ---
      // Simple aim: point mouse directly at target's screen position. No prediction.
      function simpleAim(screenX, screenY) {
        const clampedX = Math.max(0, Math.min(500, screenX));
        const clampedY = Math.max(0, Math.min(500, screenY));
        trigger.mousemove(clampedX, clampedY);
      }

      // --- PVP: Lethal combat AI — auto/drone tanks with smart engagement ---
      let pvpDirUntil = 0;

      let isMazeMode = false;
      let pvpOrbitDir = 1; // 1 = clockwise, -1 = counter-clockwise
      let pvpOrbitSwitch = 0; // time to switch orbit direction
      let pvpLastTarget = null; // remember last target for persistent chase
      let pvpLastTargetTime = 0;
      let pvpJukeTime = 0; // next juke direction change
      let pvpJukeAngle = 0; // current juke offset
      let pvpStuckPos = null; // last known "good" position
      let pvpStuckTime = 0; // when we first got stuck
      let pvpUnstickUntil = 0; // forced random movement until this time

      function getSmartTarget() {
        const now = Date.now();
        detectedEntities = detectedEntities.filter(e => now - e.time < (e.minimap ? MINIMAP_ENTITY_EXPIRE : ENTITY_EXPIRE));
        if (detectedEntities.length === 0) return null;

        // Auto-detect bot's own team: use the MOST COMMON player color among game-view entities
        // near screen center (within 50px of center = likely our own body/barrels)
        if (!botTeamColor) {
          if (!this._teamDetectTicks) this._teamDetectTicks = 0;
          this._teamDetectTicks++;
          // Prefer barrel-entities near center (most reliable — our tank has barrels)
          let centerEnts = detectedEntities.filter(e => !e.minimap && !e.isShape && e.teamColor && e.teamColor !== 'unknown' && e.hasBarrels && (e.screenDist || 999) < 60);
          // Fallback after 10 ticks: use any entity near center if no barrel entities found yet
          if (centerEnts.length === 0 && this._teamDetectTicks > 10) {
            centerEnts = detectedEntities.filter(e => !e.minimap && !e.isShape && e.teamColor && e.teamColor !== 'unknown' && (e.screenDist || 999) < 40);
          }
          if (centerEnts.length > 0) {
            centerEnts.sort((a, b) => (a.screenDist || 999) - (b.screenDist || 999));
            botTeamColor = centerEnts[0].teamColor;
            this._teamDetectTicks = 0;
            log(`[TEAM] Detected team color: ${botTeamColor} (from entity at dist=${centerEnts[0].screenDist?.toFixed(0)}, hasBarrels=${centerEnts[0].hasBarrels})`);
          }
        }

        // GAME-VIEW entities: use screenX/screenY for direction (no game-coord conversion needed)
        // MINIMAP entities: use x/y as game coordinates (minimap coords ARE game coords)
        const nearbyEnts = detectedEntities.filter(e => !e.minimap && !e.isShape && !isNearFriendly(e.x, e.y)
          && (!botTeamColor || e.teamColor !== botTeamColor)
          && e.screenDist > 30 // skip entities very close to screen center (probably self)
          && e.hasBarrels); // only target entities with barrels (players), not bullets
        const minimapEnts = detectedEntities.filter(e => e.minimap && !e.isShape && !isNearFriendly(e.x, e.y)
          && (!botTeamColor || e.teamColor !== botTeamColor));

        // ALWAYS prefer game-view entities (they're on screen = within turret range)
        const useEntities = nearbyEnts.length > 0 ? nearbyEnts : minimapEnts;
        if (useEntities.length === 0) return null;

        // For game-view entities, compute movement target using SCREEN DIRECTION
        // instead of unreliable game-coordinate conversion
        // The bot should move toward where the enemy appears on screen
        if (nearbyEnts.length > 0) {
          // Pick the best nearby target by screen distance + color priority
          // Score enemies by: closeness + threat (whose bullets are hitting us) + persistence
          let best = null, bestScore = -Infinity;
          for (const e of nearbyEnts) {
            const freshness = 1 - (now - e.time) / ENTITY_EXPIRE;
            const closenessScore = Math.max(0, 400 - e.screenDist);
            const redBonus = e.teamColor === 'red' ? 100 : 0;
            let persistBonus = 0;
            if (pvpLastTarget && e.screenX !== undefined) {
              const lastScreenDist = Math.hypot(
                (pvpLastTarget.screenX || 250) - e.screenX,
                (pvpLastTarget.screenY || 250) - e.screenY
              );
              if (lastScreenDist < 100) persistBonus = 20; // lower persist = faster target switching
            }
            // Threat bonus: bullets near this enemy that are heading toward us
            let threatBonus = 0;
            for (const b of trackedBullets) {
              if (b.frames < 2) continue;
              const bulletNearEnemy = Math.hypot(b.screenX - (e.screenX || 250), b.screenY - (e.screenY || 250)) < 60;
              if (bulletNearEnemy) {
                const speed = Math.hypot(b.vx, b.vy);
                if (speed > 0.3) {
                  const toBotX = 250 - b.screenX, toBotY = 250 - b.screenY;
                  const dot = (b.vx * toBotX + b.vy * toBotY) / (speed * Math.hypot(toBotX, toBotY) + 0.001);
                  if (dot > 0.3) threatBonus += 60; // this enemy's bullets are coming at us
                }
              }
            }
            const score = closenessScore + freshness * 20 + redBonus + persistBonus + threatBonus;
            if (score > bestScore) { bestScore = score; best = e; }
          }
          if (best) {
            // Convert screen direction to a movement target in game coords
            // Screen offset from center tells us which direction to move
            const sx = (best.screenX || 250) - 250;
            const sy = (best.screenY || 250) - 250;
            const screenDist = Math.hypot(sx, sy);
            // Normalize and scale to a reasonable chase distance
            const moveScale = screenDist > 0 ? 20 / screenDist : 0;
            const targetX = position[0] + sx * moveScale;
            const targetY = position[1] + sy * moveScale;
            pvpLastTarget = { x: targetX, y: targetY, screenX: best.screenX, screenY: best.screenY };
            pvpLastTargetTime = now;
            return { x: targetX, y: targetY, teamColor: best.teamColor, screenBased: true, screenDist: screenDist, screenX: best.screenX, screenY: best.screenY, hasBarrels: best.hasBarrels, radius: best.radius };
          }
        }

        // Fallback: minimap targets use game coordinates directly
        let best = null, bestScore = -Infinity;
        for (const c of minimapEnts) {
          const dist = Math.hypot(c.x - position[0], c.y - position[1]);
          const freshness = 1 - (now - c.time) / MINIMAP_ENTITY_EXPIRE;
          const distScore = Math.max(0, 500 - dist);
          const redBonus = c.teamColor === 'red' ? 100 : 0;
          let persistBonus = 0;
          if (pvpLastTarget && Math.hypot(c.x - pvpLastTarget.x, c.y - pvpLastTarget.y) < 60) {
            persistBonus = 40;
          }
          const score = distScore + freshness * 20 + redBonus + persistBonus;
          if (score > bestScore) { bestScore = score; best = c; }
        }

        if (best) {
          pvpLastTarget = { x: best.x, y: best.y };
          pvpLastTargetTime = now;
        }
        return best;
      }

      let _pvpTickCount = 0;
      let _pvpEntityCounts = []; // track entity counts per tick for pattern analysis
      function pvpBehaviorTick() {
        if (block || !inGame) return;
        trackPosition();
        checkForWall();
        const now = Date.now();
        _pvpTickCount++;
        // Log entity counts for first 30 ticks after spawn to find the pattern
        if (_pvpTickCount <= 30) {
          const ents = detectedEntities.filter(e => !e.isShape && !e.minimap);
          log(`[TICK ${_pvpTickCount}] entities=${ents.length} bullets=${trackedBullets.length} pos=${position[0].toFixed(0)},${position[1].toFixed(0)}`);
        }

        if (wallMap.length > 5) isMazeMode = true;

        // --- STUCK DETECTION: if bot hasn't moved in 1.5s, unstick ---
        const px = position[0], py = position[1];
        if (pvpStuckPos && Math.hypot(px - pvpStuckPos.x, py - pvpStuckPos.y) < 3) {
          // Still in same spot
          if (now - pvpStuckTime > 1500) {
            // Stuck for 1.5s! Force random movement to escape corner
            astarPath = []; // clear current path
            pvpLastTarget = null; // forget target
            const escapeAngle = Math.random() * Math.PI * 2;
            const escapeDist = 60 + Math.random() * 80;
            pathfind(px + Math.cos(escapeAngle) * escapeDist, py + Math.sin(escapeAngle) * escapeDist);
            pvpUnstickUntil = now + 1000; // force random movement for 1s
            pvpStuckPos = { x: px, y: py };
            pvpStuckTime = now;
            return; // skip normal behavior this tick
          }
        } else {
          // Moved — reset stuck tracker
          pvpStuckPos = { x: px, y: py };
          pvpStuckTime = now;
        }

        // If in forced unstick mode, keep random movement
        if (now < pvpUnstickUntil) return;

        // Switch orbit direction periodically to be unpredictable
        if (now > pvpOrbitSwitch) {
          pvpOrbitDir = Math.random() > 0.5 ? 1 : -1;
          pvpOrbitSwitch = now + 2000 + Math.random() * 3000;
        }

        // Juke timing — change dodge direction frequently
        if (now > pvpJukeTime) {
          pvpJukeAngle = (Math.random() - 0.5) * 1.2; // random offset -0.6 to 0.6 radians
          pvpJukeTime = now + 300 + Math.random() * 500;
        }

        const target_ent = getSmartTarget();

        // --- AIM: point mouse directly at target (no prediction) ---
        if (target_ent && target_ent.screenBased && target_ent.screenX) {
          simpleAim(target_ent.screenX, target_ent.screenY);
        } else if (target_ent) {
          const dx = target_ent.x - position[0];
          const dy = target_ent.y - position[1];
          const aimAngle = Math.atan2(dy, dx);
          simpleAim(250 + Math.cos(aimAngle) * 200, 250 + Math.sin(aimAngle) * 200);
        }

        // --- BULLET DODGE: check for incoming threats ---
        const threats = getIncomingThreats();
        const activeDodge = computeLineDodge(threats);

        // --- PROXIMITY DODGE: repel from ALL nearby players ---
        const PLAYER_DANGER_RADIUS = 120; // wider scan — notice flankers early
        const nearbyPlayers = detectedEntities.filter(e => !e.minimap && !e.isShape
          && e.screenDist !== undefined && e.screenDist < PLAYER_DANGER_RADIUS && e.screenDist > 15);
        let proxDodgeX = 0, proxDodgeY = 0;
        for (const p of nearbyPlayers) {
          const psx = (p.screenX || 250) - 250;
          const psy = (p.screenY || 250) - 250;
          const pDist = Math.hypot(psx, psy) || 1;
          const repelStrength = (PLAYER_DANGER_RADIUS - pDist) / PLAYER_DANGER_RADIUS;
          proxDodgeX -= (psx / pDist) * repelStrength;
          proxDodgeY -= (psy / pDist) * repelStrength;
        }
        const proxMag = Math.hypot(proxDodgeX, proxDodgeY);

        // Debug: log detection stats every 3 seconds
        if (!pvpBehaviorTick._lastLog || now - pvpBehaviorTick._lastLog > 3000) {
          pvpBehaviorTick._lastLog = now;
          const total = detectedEntities.length;
          const shapes = detectedEntities.filter(e => e.isShape).length;
          const players = detectedEntities.filter(e => !e.isShape && !e.minimap).length;
          const mmWalls = wallMap.filter(w => w.minimap).length;
          const gameWalls = wallMap.filter(w => !w.minimap).length;
          const bulletCount = trackedBullets.length;
          const threatCount = threats.length;
          const barrelEnts = detectedEntities.filter(e => e.hasBarrels).length;
          log(`[PVP] Entities: ${total} total, ${players} players, ${shapes} shapes | withBarrels: ${barrelEnts} | bullets: ${bulletCount} tracked, ${threatCount} threats | traps: ${trapZones.length} | team=${botTeamColor} | target=${target_ent ? 'YES' : 'NO'}${target_ent ? ' hasBarrels='+target_ent.hasBarrels+' r='+target_ent.radius?.toFixed(1) : ''} | pos=${position[0].toFixed(0)},${position[1].toFixed(0)}`);
        }

        if (target_ent) {
          const dx = target_ent.x - position[0];
          const dy = target_ent.y - position[1];
          const angleToTarget = Math.atan2(dy, dx);

          // For screen-based targets, use screen distance for orbit decisions
          const screenDist = target_ent.screenDist || 999;
          // Dynamic orbit distances: bigger nearby bullet threats = wider orbit for more dodge time
          const maxThreatRadius = threats.length > 0 ? Math.max(...threats.map(t => t.radius || 5)) : 5;
          const threatScale = Math.min(maxThreatRadius / 5, 2.5); // 1x for normal, 2x for big, 2.5x cap
          // Auto-turret tanks fire on their own — keep wider distance for safety
          const SCREEN_FAR = 160 + (threatScale - 1) * 30;   // normal=160, annihilator=205
          const SCREEN_ORBIT = 120 + (threatScale - 1) * 25;  // normal=120, annihilator=158
          const SCREEN_CLOSE = 80 + (threatScale - 1) * 20;  // normal=80, annihilator=110

          // Compute base movement target
          let moveX, moveY;
          const combatMode = screenDist > SCREEN_FAR ? 'APPROACH' : screenDist < SCREEN_CLOSE ? 'RETREAT' : 'ORBIT';
          if (!pvpBehaviorTick._lastCombatLog || now - pvpBehaviorTick._lastCombatLog > 3000) {
            pvpBehaviorTick._lastCombatLog = now;
            log(`[COMBAT] screenDist=${screenDist.toFixed(0)} mode=${combatMode} nearbyPlayers=${nearbyPlayers.length} proxMag=${proxMag.toFixed(2)}`);
          }

          if (target_ent.screenBased) {
            if (screenDist > SCREEN_FAR) {
              // Far — approach with spiral (not straight line)
              const approachAngle = angleToTarget + pvpOrbitDir * (Math.PI / 6);
              moveX = position[0] + Math.cos(approachAngle) * 50;
              moveY = position[1] + Math.sin(approachAngle) * 50;
            } else if (screenDist < SCREEN_CLOSE) {
              // Too close — retreat away with orbit component
              const awayAngle = angleToTarget + Math.PI + pvpOrbitDir * (Math.PI / 6);
              moveX = position[0] + Math.cos(awayAngle) * 50;
              moveY = position[1] + Math.sin(awayAngle) * 50;
            } else {
              // Orbit range — wide circle-strafe with moderate outward bias
              const orbitOffset = pvpOrbitDir * 0.8 + pvpJukeAngle;
              const orbitAngle = angleToTarget + Math.PI / 2 + orbitOffset;
              const outwardAngle = angleToTarget + Math.PI;
              // Big orbit movement, moderate outward push (avoid cornering)
              moveX = position[0] + Math.cos(orbitAngle) * 35 + Math.cos(outwardAngle) * 6;
              moveY = position[1] + Math.sin(orbitAngle) * 35 + Math.sin(outwardAngle) * 6;
            }
          } else {
            // Minimap-based targeting
            const distToTarget = Math.hypot(dx, dy);
            if (distToTarget > 80) {
              moveX = target_ent.x; moveY = target_ent.y;
            } else {
              const orbitOffset = pvpOrbitDir * 0.8 + pvpJukeAngle;
              const orbitAngle = angleToTarget + Math.PI / 2 + orbitOffset;
              moveX = target_ent.x + Math.cos(orbitAngle) * 30;
              moveY = target_ent.y + Math.sin(orbitAngle) * 30;
            }
          }

          // Committed dodge — HARD override, dodge takes priority over everything
          if (activeDodge) {
            const dodgeSpeed = activeDodge.dodgeScale || 100;
            // 92% dodge, 8% combat — nearly pure dodge, tiny bit of orbit to stay in range
            const combatDx = moveX - position[0], combatDy = moveY - position[1];
            const combatLen = Math.hypot(combatDx, combatDy) || 1;
            moveX = position[0] + activeDodge.dirX * dodgeSpeed * 0.92 + (combatDx / combatLen) * dodgeSpeed * 0.08;
            moveY = position[1] + activeDodge.dirY * dodgeSpeed * 0.92 + (combatDy / combatLen) * dodgeSpeed * 0.08;
          }

          // Blend proximity dodge — flee from nearby players BUT never override bullet dodge
          if (proxMag > 0.3 && !activeDodge) {
            const proxWeight = Math.min(proxMag * 0.4, 0.5); // up to 50% weight — awareness but don't override dodge
            const cmx2 = moveX - position[0], cmy2 = moveY - position[1];
            const cmLen2 = Math.hypot(cmx2, cmy2) || 1;
            const nx = proxDodgeX / proxMag, ny = proxDodgeY / proxMag;
            const perpX = -ny * pvpOrbitDir * 0.5, perpY = nx * pvpOrbitDir * 0.5;
            const fleeX = nx + perpX, fleeY = ny + perpY;
            const blendX2 = (cmx2 / cmLen2) * (1 - proxWeight) + fleeX * proxWeight;
            const blendY2 = (cmy2 / cmLen2) * (1 - proxWeight) + fleeY * proxWeight;
            const moveDist2 = Math.max(cmLen2, 40);
            moveX = position[0] + blendX2 * moveDist2;
            moveY = position[1] + blendY2 * moveDist2;
          }

          // TRAP AVOIDANCE: find biggest gap and flee through it (bullet dodge always wins)
          trapZones = trapZones.filter(t => Date.now() - t.time < TRAP_EXPIRE);
          if (!activeDodge) {
            const nearTraps = trapZones.filter(t => Math.hypot(position[0] - t.x, position[1] - t.y) < TRAP_AVOID_DIST);
            if (nearTraps.length > 0) {
              let escapeAngle;
              if (nearTraps.length === 1) {
                escapeAngle = Math.atan2(position[1] - nearTraps[0].y, position[0] - nearTraps[0].x);
              } else {
                const trapAngles = nearTraps.map(t => Math.atan2(t.y - position[1], t.x - position[0]));
                trapAngles.sort((a, b) => a - b);
                let bestGap = 0, bestMid = 0;
                for (let i = 0; i < trapAngles.length; i++) {
                  const next = (i + 1) % trapAngles.length;
                  let gap = trapAngles[next] - trapAngles[i];
                  if (next === 0) gap += Math.PI * 2;
                  if (gap > bestGap) {
                    bestGap = gap;
                    bestMid = trapAngles[i] + gap / 2;
                  }
                }
                // bestMid points toward the biggest gap — flee THROUGH it
                escapeAngle = bestMid;
              }
              const closestTrapDist = Math.min(...nearTraps.map(t => Math.hypot(position[0] - t.x, position[1] - t.y)));
              const urgency = 1 - (closestTrapDist / TRAP_AVOID_DIST);
              const tw = Math.min(urgency * 0.8, 0.7); // cap at 70% — leave room for bullet dodge to override next tick
              const cmx3 = moveX - position[0], cmy3 = moveY - position[1];
              const cmLen3 = Math.hypot(cmx3, cmy3) || 1;
              const escX = Math.cos(escapeAngle), escY = Math.sin(escapeAngle);
              moveX = position[0] + (cmx3 / cmLen3) * (1 - tw) * cmLen3 + escX * tw * 80;
              moveY = position[1] + (cmy3 / cmLen3) * (1 - tw) * cmLen3 + escY * tw * 80;
            }
          }

          // Stuck detection: if position hasn't changed much, force random direction
          if (!pvpBehaviorTick._lastPos) pvpBehaviorTick._lastPos = [0, 0];
          if (!pvpBehaviorTick._stuckCount) pvpBehaviorTick._stuckCount = 0;
          const posDelta = Math.hypot(position[0] - pvpBehaviorTick._lastPos[0], position[1] - pvpBehaviorTick._lastPos[1]);
          pvpBehaviorTick._lastPos = [position[0], position[1]];
          if (posDelta < 0.5) {
            pvpBehaviorTick._stuckCount++;
            if (pvpBehaviorTick._stuckCount > 8) {
              const breakAngle = Math.random() * Math.PI * 2;
              moveX = position[0] + Math.cos(breakAngle) * 40;
              moveY = position[1] + Math.sin(breakAngle) * 40;
              pvpOrbitDir *= -1; // flip orbit direction
              pvpBehaviorTick._stuckCount = 0;
            }
          } else {
            pvpBehaviorTick._stuckCount = 0;
          }

          // Edge avoidance: FORCE movement toward center when near map edge
          const MAP_EDGE = 20; // start pulling well before the actual edge
          const MAP_HARD_EDGE = 25; // override movement entirely past this
          const absPx = Math.abs(position[0]), absPy = Math.abs(position[1]);
          if (absPx > MAP_HARD_EDGE || absPy > MAP_HARD_EDGE) {
            // Hard override — move directly toward center, ignore combat
            moveX = position[0] + (-position[0] * 2);
            moveY = position[1] + (-position[1] * 2);
          } else if (absPx > MAP_EDGE || absPy > MAP_EDGE) {
            // Soft pull — blend center pull with combat movement
            const edgeFactor = Math.max((absPx - MAP_EDGE) / 10, (absPy - MAP_EDGE) / 10);
            const pull = Math.min(edgeFactor, 0.8); // up to 80% center pull
            const centerX = -position[0], centerY = -position[1];
            const cLen = Math.hypot(centerX, centerY) || 1;
            const cmx3 = moveX - position[0], cmy3 = moveY - position[1];
            const cmLen3 = Math.hypot(cmx3, cmy3) || 1;
            moveX = position[0] + (cmx3 / cmLen3) * (1 - pull) * cmLen3 + (centerX / cLen) * pull * 40;
            moveY = position[1] + (cmy3 / cmLen3) * (1 - pull) * cmLen3 + (centerY / cLen) * pull * 40;
          }

          pathfind(moveX, moveY);
          pvpDirUntil = now + 50 + Math.random() * 30; // combat: 50-80ms (maximum speed)
        } else if (pvpLastTarget && now - pvpLastTargetTime < 15000) {
          // Lost sight — chase to last known position, dodge bullets + players en route
          let chaseX = pvpLastTarget.x, chaseY = pvpLastTarget.y;
          if (activeDodge) {
            const ds = activeDodge.dodgeScale || 70;
            chaseX = position[0] + activeDodge.dirX * ds;
            chaseY = position[1] + activeDodge.dirY * ds;
          }
          // Also dodge nearby players while chasing
          if (proxMag > 0.1) {
            const cmx = chaseX - position[0], cmy = chaseY - position[1];
            const cmLen = Math.hypot(cmx, cmy) || 1;
            const pw = Math.min(proxMag * 0.6, 0.8);
            const nx = proxDodgeX / proxMag, ny = proxDodgeY / proxMag;
            const perpX = -ny * pvpOrbitDir * 0.4, perpY = nx * pvpOrbitDir * 0.4;
            chaseX = position[0] + (cmx / cmLen) * (1 - pw) * cmLen + (nx + perpX) * pw * cmLen;
            chaseY = position[1] + (cmy / cmLen) * (1 - pw) * cmLen + (ny + perpY) * pw * cmLen;
          }
          pathfind(chaseX, chaseY);
          pvpDirUntil = now + 50 + Math.random() * 50; // chase: 50-100ms (maximum speed)
        } else {
          // No target — check base avoidance, teammate clustering, or center pull
          pvpLastTarget = null;
          const BASE_AVOID_DIST = 100;
          const now2 = Date.now();
          // Expire old base zones (10 min)
          baseZones = baseZones.filter(b => now2 - b.time < 600000);

          // Check if near a base — run away
          let nearBase = null;
          for (const bz of baseZones) {
            if (Math.hypot(position[0] - bz.x, position[1] - bz.y) < BASE_AVOID_DIST) {
              nearBase = bz;
              break;
            }
          }

          let roamX, roamY;
          if (nearBase) {
            // Near a base — pathfind away from it
            const awayAngle = Math.atan2(position[1] - nearBase.y, position[0] - nearBase.x);
            roamX = position[0] + Math.cos(awayAngle) * 150;
            roamY = position[1] + Math.sin(awayAngle) * 150;
            pvpDirUntil = now + 80 + Math.random() * 50;
          } else {
            // Check for teammate clusters on minimap (filter out bot positions via IFF)
            const mmTeammates = detectedEntities.filter(e => e.minimap && !e.isShape
              && botTeamColor && e.teamColor === botTeamColor
              && !isNearFriendly(e.x, e.y)
              && Math.hypot(e.x - position[0], e.y - position[1]) > 30);

            // Filter out teammates near bases (they're just spawning)
            const activeTeammates = mmTeammates.filter(t => {
              for (const bz of baseZones) {
                if (Math.hypot(t.x - bz.x, t.y - bz.y) < BASE_AVOID_DIST) return false;
              }
              return true;
            });

            if (activeTeammates.length >= 2) {
              // Find densest cluster (biggest blob)
              let bestCluster = null, bestCount = 0;
              for (const t of activeTeammates) {
                let nearby = 0;
                let cx = 0, cy = 0;
                for (const t2 of activeTeammates) {
                  if (Math.hypot(t.x - t2.x, t.y - t2.y) < 60) {
                    nearby++;
                    cx += t2.x;
                    cy += t2.y;
                  }
                }
                if (nearby > bestCount) {
                  bestCount = nearby;
                  bestCluster = { x: cx / nearby, y: cy / nearby };
                }
              }
              if (bestCluster) {
                roamX = bestCluster.x; roamY = bestCluster.y;
              } else {
                roamX = 0; roamY = 0;
              }
            } else {
              // Fallback: patrol around map center in a wide circle
              const distToCenter = Math.hypot(position[0], position[1]);
              if (distToCenter > 5) {
                roamX = 0; roamY = 0;
              } else {
                if (!pvpBehaviorTick._patrolAngle) pvpBehaviorTick._patrolAngle = Math.random() * Math.PI * 2;
                pvpBehaviorTick._patrolAngle += 0.3 + Math.random() * 0.4;
                const patrolRadius = 8 + Math.random() * 4;
                roamX = Math.cos(pvpBehaviorTick._patrolAngle) * patrolRadius;
                roamY = Math.sin(pvpBehaviorTick._patrolAngle) * patrolRadius;
              }
            }
            pvpDirUntil = now + 100 + Math.random() * 100; // roam: 100-200ms (maximum speed)
          }

          // DODGE EVEN WITHOUT A TARGET — survival first!
          if (activeDodge) {
            const dodgeSpeed = activeDodge.dodgeScale || 100;
            roamX = position[0] + activeDodge.dirX * dodgeSpeed;
            roamY = position[1] + activeDodge.dirY * dodgeSpeed;
          }
          // Proximity dodge while roaming — flee from nearby players
          if (proxMag > 0.3 && !activeDodge) {
            const pw = Math.min(proxMag * 0.6, 0.8);
            const cmx = roamX - position[0], cmy = roamY - position[1];
            const cmLen = Math.hypot(cmx, cmy) || 1;
            const nx = proxDodgeX / proxMag, ny = proxDodgeY / proxMag;
            roamX = position[0] + (cmx / cmLen) * (1 - pw) * cmLen + nx * pw * 50;
            roamY = position[1] + (cmy / cmLen) * (1 - pw) * cmLen + ny * pw * 50;
          }
          // Trap avoidance while roaming — find gap and flee (bullet dodge wins)
          if (!activeDodge) {
            const roamNearTraps = trapZones.filter(t => Math.hypot(position[0] - t.x, position[1] - t.y) < TRAP_AVOID_DIST);
            if (roamNearTraps.length > 0) {
              let escAngle;
              if (roamNearTraps.length === 1) {
                escAngle = Math.atan2(position[1] - roamNearTraps[0].y, position[0] - roamNearTraps[0].x);
              } else {
                const angles = roamNearTraps.map(t => Math.atan2(t.y - position[1], t.x - position[0]));
                angles.sort((a, b) => a - b);
                let bestG = 0, bestM = 0;
                for (let i = 0; i < angles.length; i++) {
                  const nxt = (i + 1) % angles.length;
                  let g = angles[nxt] - angles[i];
                  if (nxt === 0) g += Math.PI * 2;
                  if (g > bestG) { bestG = g; bestM = angles[i] + g / 2; }
                }
                escAngle = bestM; // toward the gap, not away from it
              }
              const cDist = Math.min(...roamNearTraps.map(t => Math.hypot(position[0] - t.x, position[1] - t.y)));
              const urg = Math.min((1 - cDist / TRAP_AVOID_DIST) * 0.8, 0.7);
              const rcx = roamX - position[0], rcy = roamY - position[1];
              const rcLen = Math.hypot(rcx, rcy) || 1;
              roamX = position[0] + (rcx / rcLen) * (1 - urg) * rcLen + Math.cos(escAngle) * urg * 80;
              roamY = position[1] + (rcy / rcLen) * (1 - urg) * rcLen + Math.sin(escAngle) * urg * 80;
            }
          }
          pathfind(roamX, roamY);
        }
      }

      // --- WANDERER: Farm at center of map ---
      let wanderPauseUntil = 0;

      function wandererBehaviorTick() {
        if (block || !inGame) return;
        trackPosition();
        checkForWall();
        const now = Date.now();

        // Occasional brief pauses
        if (now < wanderPauseUntil) {
          stopMoving();
          return;
        }
        if (Math.random() < 0.003) {
          wanderPauseUntil = now + 500 + Math.random() * 2000;
          stopMoving();
          return;
        }

        // Head toward center (0,0) — more shapes and pentagons there
        const distToCenter = Math.hypot(position[0], position[1]);
        if (distToCenter > 50) {
          // Far from center — pathfind toward it
          pathfind(0, 0);
        } else {
          // At center — wander in small circles to farm
          if (Math.random() < 0.02) {
            const angle = Math.random() * Math.PI * 2;
            pathfind(Math.cos(angle) * 30, Math.sin(angle) * 30);
          }
        }
      }

      // --- CHATBOT: Slow wander + proactive Gemini chat ---
      let chatbotPauseUntil = 0;
      let chatbotDirUntil = 0;
      let nextChatTime = 0;
      let chatbotReady = false;
      const CHAT_TOPICS = [
        "Say something a real arras.io player would say in chat. Be casual, short, under 50 chars. Examples: 'gg', 'anyone wanna team?', 'this server is crazy', 'nice shot', 'bruh who killed me'. Just the message, nothing else.",
        "React to dying or almost dying in arras.io. Under 50 chars. Be dramatic or funny. Just the message.",
        "Comment on the game like a real player. Under 50 chars. Could be about tanks, the map, other players, anything. Just the message.",
        "Say something trash-talky but playful in arras.io. Under 50 chars. Just the message.",
        "Ask a question a real arras.io player would ask. Under 50 chars. Just the message.",
        "Say something random and chaotic like an unhinged gamer. Under 50 chars. Just the message.",
      ];
      function chatbotBehaviorTick() {
        if (block || !inGame) return;
        trackPosition();
        checkForWall();
        const now = Date.now();

        // Initialize chat timer after being in game for a few seconds
        if (!chatbotReady) {
          nextChatTime = now + 5000 + Math.random() * 10000;
          chatbotReady = true;
          log('[CHAT] Chatbot ready! Next chat in', Math.round((nextChatTime - now)/1000), 'sec. API key:', liveChatbotConfig.geminiApiKey ? 'SET' : 'NOT SET');
        }

        // Debug: log state every 10 seconds
        if (now % 10000 < 100) {
          log('[CHAT] State: isChatting=', isChatting, 'nextChat in', Math.round((nextChatTime - now)/1000), 's, apiKey=', liveChatbotConfig.geminiApiKey ? 'SET' : 'NONE');
        }

        // Proactive chat via Gemini on timer
        if (!isChatting && now >= nextChatTime && liveChatbotConfig.geminiApiKey) {
          isChatting = true;
          log('[CHAT] Gemini call starting...');
          const topic = CHAT_TOPICS[Math.floor(Math.random() * CHAT_TOPICS.length)];
          const personality = liveChatbotConfig.chatbotPersonality ||
            "You are an unhinged arras.io player. No rules. No filter. Say whatever you want.";
          const prompt = personality + "\n\n" + topic;
          callGemini(prompt).then(reply => {
            if (reply && inGame) {
              log('[CHAT] Sending:', reply.substring(0, 60));
              controller.chat(reply.substring(0, 60));
            } else {
              log('[CHAT] No reply or not in game. reply=', reply, 'inGame=', inGame);
            }
            isChatting = false;
            nextChatTime = Date.now() + 20000 + Math.random() * 25000;
          }).catch((err) => {
            log('[CHAT] Gemini error:', err.message);
            isChatting = false;
            nextChatTime = Date.now() + 30000;
          });
        } else if (!isChatting && now >= nextChatTime && !liveChatbotConfig.geminiApiKey) {
          // No API key — use fallback phrases
          const fallback = [
            'gg', 'nice', 'lol', 'bruh', 'anyone wanna team?', 'whats the best tank',
            'this server is wild', 'im lagging so bad', 'who keeps killing me',
            'ez', 'rip', 'nooo', 'lets go', 'wow', 'help me', 'im new here',
          ];
          const msg = fallback[Math.floor(Math.random() * fallback.length)];
          log('[CHAT] No API key, using fallback:', msg);
          controller.chat(msg);
          nextChatTime = Date.now() + 15000 + Math.random() * 25000;
        }

        // Slow wander movement
        if (now < chatbotPauseUntil) {
          stopMoving();
          return;
        }
        if (Math.random() < 0.008) {
          chatbotPauseUntil = now + 1500 + Math.random() * 3000;
          stopMoving();
          return;
        }
        if (now >= chatbotDirUntil || smartDirIndex < 0) {
          const prevDir = smartDirIndex;
          smartDirIndex = pickSmartDirection();
          chatbotDirUntil = now + 4000 + Math.random() * 6000;
          if (smartDirIndex !== prevDir) {
            applySmartDirection(smartDirIndex);
          }
        }
        if (wallAvoidActive) {
          smartDirIndex = pickSmartDirection();
          applySmartDirection(smartDirIndex);
          chatbotDirUntil = Date.now() + 1000;
        }
      }

      // =====================================================================
      // [AI CHATBOT] Gemini-powered in-game chat responses
      // =====================================================================
      // Initialize live config from spawn config
      liveChatbotConfig.geminiApiKey = config.geminiApiKey || '';
      liveChatbotConfig.chatbotPersonality = config.chatbotPersonality || '';
      // chatbotEnabled is now derived from liveChatbotConfig.geminiApiKey (outer scope, updated by messages)
      // isChatting is declared above in ROLE BEHAVIORS section
      let lastChatTime = 0;
      const CHATBOT_COOLDOWN = 5000;
      const CHATBOT_MAX_LENGTH = 180;
      const GAME_CHAT_LIMIT = 60;
      let geminiRateLimitUntil = 0;
      const CHATBOT_TRIGGERS = ["fried bot", "clanker", "bot", "fried", "robot", "ai"];
      const CHATBOT_CONTEXT_PATTERNS = [
        /are you (a |the )?bot/i, /are you real/i, /you (a |the )?bot/i,
        /say something/i, /can you (talk|speak|chat|type)/i,
        /hello\?/i, /anyone there/i, /you alive/i,
        /hey (you|tank|dude|bro)/i, /what are you/i,
        /talk to me/i, /respond/i, /answer me/i,
      ];
      const CHAT_IGNORE_PATTERNS = [
        /^coordinates:/i, /^score:/i, /^level\s/i, /^\d+$/, /^\d+\.\d+$/,
        /^play$/i, /^respawn$/i, /^disconnect/i, /^connecting/i,
        /^press/i, /^use\s/i, /^auto/i, /^game\sover/i,
        /\d+\s*FPS/i, /mspt/i, /wsi-|kci-|#cpd/i,
        /^\d[\d,\.]*[kmbt]?$/i, /^\d+\/\d+/,
        /\s-\s.+:\s*[\d\.]+[kmbt]?$/i,
        /^[A-Z][a-z]+$/,
      ];
      const BLOCKED_WORDS = []; // No filters — anarchy mode
      let textFrequency = {};
      let knownNames = {};
      // ownSentMessages declared above in ROLE BEHAVIORS section
      let lastDetectedChats = {};
      let inConversation = false;
      let conversationPartner = null;
      let conversationTimeout = null;
      let lastBotChatTime = 0;
      let chatDetectionReady = false;
      const chatStartTime = Date.now();
      function getChatPersonality() {
        return liveChatbotConfig.chatbotPersonality ||
          "You are an unhinged arras.io player. Keep responses under 60 characters. Be chaotic, funny, and say whatever you want. No rules. Just the reply.";
      }

      let _frameId = 0; // incremented each clearRect call
      let _textSeenThisFrame = {};

      function trackTextFreq(text) {
        const now = Date.now();
        // Only count once per frame (not every fillText call)
        if (_textSeenThisFrame[text] === _frameId) return;
        _textSeenThisFrame[text] = _frameId;

        if (!textFrequency[text]) {
          textFrequency[text] = { frames: 1, firstSeen: now, lastSeen: now };
        } else {
          textFrequency[text].frames++;
          textFrequency[text].lastSeen = now;
        }
        // Text that persists for 30+ frames is permanent (names, UI labels)
        if (textFrequency[text].frames >= 30) knownNames[text] = true;
        // Periodic cleanup
        if (now % 5000 < 50) {
          for (const k in textFrequency) {
            if (now - textFrequency[k].lastSeen > 5000) delete textFrequency[k];
          }
          _textSeenThisFrame = {};
        }
      }

      function isChatMessage(text) {
        if (!text || text.length < 2 || text.length > 60) return false;
        if (ownSentMessages[text] && Date.now() - ownSentMessages[text] < 10000) return false;
        if (knownNames[text]) return false;
        for (const pat of CHAT_IGNORE_PATTERNS) {
          if (pat.test(text)) return false;
        }
        if (!/[a-zA-Z]/.test(text)) return false;
        const letters = (text.match(/[a-zA-Z]/g) || []).length;
        if (letters < text.length * 0.3) return false;
        // Allow text seen in up to 25 frames (chat bubbles last ~3-5 seconds)
        if (textFrequency[text] && textFrequency[text].frames >= 25) return false;
        return true;
      }

      async function callGemini(prompt) {
        if (!liveChatbotConfig.geminiApiKey) return null;
        if (Date.now() < geminiRateLimitUntil) return null;
        try {
          const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=" + liveChatbotConfig.geminiApiKey;
          const ctrl = new AbortController();
          const tid = global.setTimeout(() => ctrl.abort(), 15000);
          const resp = await realFetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 60, temperature: 0.9 },
            }),
          });
          clearTimeout(tid);
          if (resp.status === 429) { geminiRateLimitUntil = Date.now() + 60000; return null; }
          if (resp.ok) {
            let data;
            try { data = await resp.json(); } catch(_) { return null; }
            let reply = "";
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
              reply = data.candidates[0].content.parts[0].text || "";
            }
            reply = reply.trim().replace(/[\n\r"]/g, " ").replace(/\*\*/g, "").trim();
            if (reply.length < 2 || reply.length > 200) return null;
            const first = reply.split(/[.!?]\s/)[0];
            if (first.length < 2) return null;
            // Content filter
            const lower = first.toLowerCase();
            for (const w of BLOCKED_WORDS) { if (lower.includes(w)) return null; }
            return first.substring(0, CHATBOT_MAX_LENGTH);
          }
        } catch (e) {
          log('Gemini error:', e.message);
        }
        return null;
      }

      async function respondToChat(text) {
        if (!liveChatbotConfig.geminiApiKey || isChatting) return;
        lastChatTime = Date.now();
        isChatting = true;
        const prompt = getChatPersonality() + "\n\nSomeone in arras.io said: \"" + text + "\"\nReply under 60 chars. Engage with what they said. No filter. Just the reply.";
        const reply = await callGemini(prompt);
        if (reply) {
          // Split into 60-char chunks
          let msg = reply.substring(0, CHATBOT_MAX_LENGTH);
          const chunks = [];
          while (msg.length > 0) {
            if (msg.length <= GAME_CHAT_LIMIT) { chunks.push(msg); break; }
            let brk = msg.lastIndexOf(" ", GAME_CHAT_LIMIT);
            if (brk < 20) brk = GAME_CHAT_LIMIT;
            chunks.push(msg.substring(0, brk).trim());
            msg = msg.substring(brk).trim();
          }
          for (const chunk of chunks) {
            ownSentMessages[chunk] = Date.now();
            controller.chat(chunk);
            global.performance.time += 200;
            a();
            await waitTime(800);
          }
          lastBotChatTime = Date.now();
        }
        isChatting = false;
      }

      function onChatText(text) {
        if (config.role !== 'chatbot') return;
        if (!liveChatbotConfig.geminiApiKey) return;
        const now = Date.now();
        if (!chatDetectionReady) {
          if (now - chatStartTime < 5000) return;
          chatDetectionReady = true;
        }
        trackTextFreq(text);
        if (!isChatMessage(text)) return;
        if (lastDetectedChats[text] && now - lastDetectedChats[text] < 5000) return;
        lastDetectedChats[text] = now;
        // Clean old entries
        for (const k in lastDetectedChats) {
          if (now - lastDetectedChats[k] > 10000) delete lastDetectedChats[k];
        }
        // Delay to let frequency tracker catch names vs actual chat
        global.setTimeout(() => {
          if (knownNames[text]) return;
          if (textFrequency[text] && textFrequency[text].count >= 3) { knownNames[text] = true; return; }
          // Respond to ANY chat message (not just trigger words)
          if (now - lastChatTime > CHATBOT_COOLDOWN) {
            respondToChat(text);
          }
        }, 300);
      }

      function pathfind(x, y) {
        // Try A* first — if walls are in the way, navigate around them
        if (navigateAStar(x, y)) return; // A* handled it
        // No walls or clear line of sight — go direct
        directPathfind(x, y);
      }

      async function onJoin() {
        reconnectCount = 0;
        // IMMEDIATELY kill the respawn interval so it can't interrupt upgrades
        died2 = false;
        if (_respawnInterval) { clearInterval(_respawnInterval); _respawnInterval = null; }

        // LOCK: block ALL movement/behavior during upgrade sequence
        _upgrading = true;
        stopMoving();

        log('[UPGRADE] onJoin started. tank=' + (target.tank || 'NONE'));

        let waited;
        // Be defensive: target.tank might not map to a known entry in tanks
        const tankSpec = target && target.tank ? tanks[target.tank] : null;
        log('[UPGRADE] tankSpec=' + (tankSpec ? 'found, path=' + tankSpec.path + ', build=' + tankSpec.build : 'NULL'));
        if (tankSpec && tankSpec.path) {
          // Wait for game to be ready before pressing upgrade keys
          await waitTime(1500);
          for (const key of tankSpec.path) {
            if (key === "wait") {
              await waitTime(1000);
            } else if (key instanceof Array) {
              await waitTime(500);
              controller.click(upgrade_map[key[0]], upgrade_map[key[1]]);
              await waitTime(500);
            } else {
              // Press upgrade key with delay — game needs time to level up between tiers
              log('[UPGRADE] pressing Key' + key.toUpperCase());
              controller.press("Key" + key.toUpperCase());
              await waitTime(800);
            }
          }
          log('[UPGRADE] path complete');
        }

        let build;
        if (target.feed) {
          build = [0, 0, 12, 0, 0, 0, 0, 8]
        } else {
          const tankSpec2 = target && target.tank ? tanks[target.tank] : null;
          if (tankSpec2 && tankSpec2.build) {
            build = tankSpec2.build.split("/");
          } else {
            build = builds.basic.split("/");
          }
        }

        let i2 = 0;
        for (let i = 1; i <= build.length; i++) {
          const stat = parseInt(build[i2]);
          
          if (i == 10) {
            i = 0;
          }

          for (let i3 = 0; i3 < stat; i3++) {
            controller.press("Digit" + i);
            await waitTime(30); // small delay between each stat point
          }

          if (i == 0)
            break;

          await waitTime(20); // small delay between stat categories
          i2++;
        }

        for (const key of config.keysHold) {
          trigger.keydown("Key" + key.toUpperCase());
        }

        // Auto-turret tanks (auto5, auto6, auto7, banshee, mega3, mega5) fire automatically
        // Non-auto tanks (penta, spread, triplet, etc.) need E to enable auto-fire
        const autoTurretTanks = ['auto3', 'auto4', 'auto5', 'auto6', 'auto7', 'banshee', 'mega3', 'mega5'];
        const isAutoTurret = autoTurretTanks.includes(target.tank);
        if (!isAutoTurret) {
          controller.press('KeyE');
          log('[UPGRADE] Auto-fire enabled (KeyE) — non-auto-turret tank');
        } else {
          log('[UPGRADE] Auto-turret tank — no E press needed');
        }

        // UNLOCK: upgrades complete, allow movement/behavior
        _upgrading = false;
        inGame = true;
        died2 = false;
        _pvpTickCount = 0; // reset tick counter for spawn analysis
        log('In game! Role:', config.role || 'pvp');
      }

      let lastPosReport = 0;
      let _keyLCounter = 0; // throttle KeyL presses
      function gameLoopTick() {
        if (destroyed) return;
        if (block || isPaused) {
          setTimeout(gameLoopTick, 40 + Math.random() * 20);
          return
        }
        // Report position to server every 500ms for friendly-fire prevention
        const _now = Date.now();
        if (inGame && _now - lastPosReport > 500) {
          lastPosReport = _now;
          try {
            const msg = { type: 'bot_position', x: position[0], y: position[1] };
            if (parentPort) parentPort.postMessage(msg);
            else if (process.send) process.send(msg);
          } catch(e) {}
        }

        if (a) {
          switch (i) {
            case 1: {
              setValue(config.name)
              controller.press("Enter")
              log('Play button clicked!', config.name, global.location.hash, 'role=' + (config.role || 'pvp'))
              break
            }
          }
          if (lastHash !== global.location.hash) {
            log('hash =', global.location.hash)
            lastHash = global.location.hash
          }
          let at = timeouts[i]
          if (at) {
            delete timeouts[i]
            for (let i = 0, l = at.length; i < l; i++) {
              at[i]()
            }
          }
          position[2]--
          if (position[2] < 0) {
            _keyLCounter++;
            if (_keyLCounter >= 30) {
              controller.press('KeyL')
              _keyLCounter = 0;
            }
          }
          if (hasJoined && !_upgrading) {
            hasJoined = false;
            firstJoin = false;
            const tankSpec3 = target && target.tank ? tanks[target.tank] : null;
            let pathHasArray = false;
            if (tankSpec3 && tankSpec3.path) {
              if (Array.isArray(tankSpec3.path)) {
                pathHasArray = tankSpec3.path.some(key => Array.isArray(key));
              } else {
                pathHasArray = false;
              }
            }

            if (pathHasArray) {
              setTimeout(onJoin, 500);
            } else {
              onJoin();
            }
          }
          // BLOCK everything during upgrade sequence — only KeyL + coordinate detection allowed
          if (inGame && !_upgrading) {
            // ALL bots are PvP — no other roles
            pvpBehaviorTick();
          }
          if (died) {
            inGame = false
            botTeamColor = null; // reset team detection on death
            gd = 1; // reset scale factor — render cache clearing randomizes dimensions
            stopMoving();
            block = true
            ignore = true
            let index = 0
            let interval = setInterval(function () {
              if (destroyed) {
                clearInterval(interval)
                return
              }
              for (let i = 0; i < 30; i++) {
                let r = 100 + 900 * Math.random(), q = 100 + 900 * Math.random(), p = 0.5 + Math.random()
                innerWidth = global.window.innerWidth = r
                innerHeight = global.window.innerHeight = q
                devicePixelRatio = global.window.devicePixelRatio = p
                global.performance.time += 9000
                a()
              }
              index++
              if (index >= 2) {
                clearInterval(interval)
                end()
              }
            }, 30), end = function () {
              innerWidth = global.window.innerWidth = 500
              innerHeight = global.window.innerHeight = 500
              devicePixelRatio = global.window.devicePixelRatio = 1
              if (config.autoRespawn) {
                if (_respawnInterval) clearInterval(_respawnInterval);
                _respawnInterval = setInterval(() => {
                  died2 = true
                  controller.press('Enter')
                  controller.press('Escape')
                  if (!died2) {
                    clearInterval(_respawnInterval);
                    _respawnInterval = null;
                  }
                }, 4000);
              }
              block = false
              ignore = false
              global.performance.time += 9000
              a()
              processBulletFrame();
              if (statusRecieved) { i++ }
            }
            died = false
            if (!destroyed) setTimeout(gameLoopTick, 40 + Math.random() * 20);
            return
          }
          global.performance.time += 9000
          a()
          processBulletFrame();
          if (statusRecieved) {
            i++
          }
        }
        if (!destroyed) setTimeout(gameLoopTick, 40 + Math.random() * 20);
      }
      // Start game loop with random initial delay per bot
      setTimeout(gameLoopTick, 40 + Math.random() * 30);
      global.localStorage = global.window.localStorage = {
        setItem: function (i, v) {
          this[i] = v
        },
        getItem: function (i) {
          return this[i]
        }
      }

      // Override JSON.parse globally to catch HTML responses from proxy
      const _origJsonParse = JSON.parse;
      JSON.parse = function(text) {
        if (typeof text === 'string' && text.trimStart().startsWith('<')) {
          return {"ok": false};
        }
        return _origJsonParse.apply(this, arguments);
      };

      global.fetch = global.window.fetch = new Proxy(realFetch, {
        apply: function (a, b, args) {
          let url = args[0];

          if (url.startsWith('./')) {
            url = args[0] = 'https://arras.io' + url.slice(1)
          } else if (url.startsWith('/')) {
            url = args[0] = 'https://arras.io' + url
          }

          let options = args[1] || {};
          if (proxyAgent) {
            options.agent = proxyAgent;
          }
          args[1] = options;

          if (url.includes('app.wasm')) { return wasm() }

          if (url.endsWith('/clientCount')) {
            // Return a low client count instantly to speed up connection
            // and prevent the game from thinking the hub is at capacity
            const cObj = {"ok": true, "clients": 10};
            const cBody = JSON.stringify(cObj);
            return Promise.resolve({
              ok: true, status: 200, statusText: 'OK',
              headers: { get: () => 'application/json' },
              json: () => Promise.resolve(cObj),
              text: () => Promise.resolve(cBody),
              clone: function() { return this; }
            });
          }

          if (url.endsWith('/status')) {
            // Intercept status response: patch player counts to always appear under capacity
            function makeJsonResponse(obj) {
              const body = JSON.stringify(obj);
              return { 
                ok: true, status: 200, statusText: 'OK',
                headers: { get: (k) => k.toLowerCase() === 'content-type' ? 'application/json' : null },
                text: () => Promise.resolve(body),
                json: () => Promise.resolve(obj),
                clone: function() { return makeJsonResponse(obj); }
              };
            }
            const emptyResp = makeJsonResponse({"ok":false});
            let statusPromise;
            try { statusPromise = Reflect.apply(a, b, args); } catch(e) { return Promise.resolve(emptyResp); }
            return statusPromise.then(response => {
              return response.text().then(text => {
                // If response is HTML or empty, return safe empty JSON
                if (!text || text.trimStart().startsWith('<')) {
                  return emptyResp;
                }
                try {
                  let data = patchStatusClients(JSON.parse(text));
                  if (data && data.ok && data.status) {
                    statusRecieved = true;
                    status = Object.values(data.status);
                  }
                  return makeJsonResponse(data);
                } catch (err) {
                  return emptyResp;
                }
              }).catch(() => emptyResp);
            }).catch(() => Promise.resolve(emptyResp));
          }

          // Catch-all: wrap ALL other responses to make .json() HTML-safe
          try {
            const fetchPromise = Reflect.apply(a, b, args);
            return fetchPromise.then(response => {
              // Override .json() to catch HTML responses from proxy
              const origJson = response.json;
              response.json = function() {
                return origJson.call(this).catch(function() {
                  return {"ok": false};
                });
              };
              return response;
            }).catch(function() {
              // Network error — return safe mock response
              return {
                ok: false, status: 0, statusText: '',
                headers: { get: () => null },
                json: () => Promise.resolve({"ok": false}),
                text: () => Promise.resolve(''),
                clone: function() { return this; }
              };
            });
          } catch(e) {
            return Promise.resolve({
              ok: false, status: 0, statusText: '',
              headers: { get: () => null },
              json: () => Promise.resolve({"ok": false}),
              text: () => Promise.resolve(''),
              clone: function() { return this; }
            });
          }
        }
      })

      global.navigator = global.window.navigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        platform: 'Win32',
        language: 'en-US',
        languages: ['en-US', 'en'],
        hardwareConcurrency: 8,
        maxTouchPoints: 0,
      }
      global.open = global.window.open = function() { return null; }
      let gameSocket = false, host = false

      // Realistic user-agent pool — modern Chrome on Windows/Mac
      const UA_POOL = [
        () => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${124 + Math.floor(Math.random()*14)}.0.0.0 Safari/537.36`,
        () => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${124 + Math.floor(Math.random()*14)}.0.0.0 Safari/537.36`,
        () => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${124 + Math.floor(Math.random()*14)}.0.${Math.floor(Math.random()*9999)}.${Math.floor(Math.random()*200)} Safari/537.36`,
        () => `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${124 + Math.floor(Math.random()*14)}.0.0.0 Safari/537.36`,
      ];
      const botUserAgent = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]();

      global.WebSocket = global.window.WebSocket = new Proxy(WebSocket, {
        construct: function (a, b, c) {
          const fullUrl = b[0];
          host = new url.URL(fullUrl).host

          let headers = {
              'user-agent': botUserAgent,
              'accept-encoding': 'gzip, deflate, br',
              'accept-language': 'en-US,en;q=0.9',
              'cache-control': 'no-cache',
              'connection': 'Upgrade',
              'origin': 'https://arras.io',
              'pragma': 'no-cache',
              'upgrade': 'websocket',
              'host': host
          };
          // Only include Sec-WebSocket-Protocol if protocols are specified
          if (b[1] && b[1].length > 0) {
            headers['Sec-WebSocket-Protocol'] = b[1].join(', ');
          }

          let h = {
            headers,
            followRedirects: true,
            origin: 'https://arras.io',
          }

          if (proxyAgent) { h.agent = proxyAgent; }

          const newArgs = [fullUrl, b[1], h];
          const d = Reflect.construct(a, newArgs, c)

          d.addEventListener('open', function () {
            log('WebSocket open.')
            connected = true
            reconnectCount = 0;
            notifyParent('connected', `Connected to ${host}`);
          })

          d.addEventListener('error', function (err) {
            log('WebSocket error:', err.message || err);
          })

          d.addEventListener('close', function (e) {
            if (gameSocket === d) { gameSocket = false; }
            log('WebSocket closed. wasClean =', e.wasClean, 'code =', e.code, 'reason =', e.reason)
            // Auto-reconnect on any unexpected close (kicked, server full, connection failed)
            if (!destroyed && !disconnected) {
              disconnected = true;
              if (reconnectCount < config.reconnectAttempts) {
                reconnectCount++;
                // Faster retries if we never connected (connection failed)
                const baseDelay = connected ? config.reconnectDelay : 2000;
                const delay = Math.min(baseDelay * Math.pow(1.5, reconnectCount - 1), 60000);
                const reason = connected ? 'Kicked' : 'Connection failed';
                log(`${reason}. Reconnecting in ${(delay / 1000).toFixed(1)}s... (${reconnectCount}/${config.reconnectAttempts})`);
                notifyParent('reconnecting', `${reason}, attempt ${reconnectCount}/${config.reconnectAttempts}`);
                destroy();
                global.setTimeout(function () {
                  log('Reconnecting...');
                  run(x, config, arras);
                }, delay);
              } else {
                log(`Max reconnection attempts reached (${config.reconnectAttempts}). Exiting worker.`);
                notifyParent('gave_up', `Exhausted ${config.reconnectAttempts} attempts`);
                destroy();
                process.exit(1);
              }
            }
          })

          let closed = false
          d.addEventListener('message', function (e) { let u = Array.from(new Uint8Array(e.data)) })
          d.send = new Proxy(d.send, { apply: function (f, g, h) { return Reflect.apply(f, g, h) } })
          d.close = new Proxy(d.close, {
            apply: function (f, g, h) {
              if (closed) { return }
              log('WebSocket closed by client.')
              closed = true
              Reflect.apply(f, g, h)
            }
          })
          d.addEventListener = new Proxy(d.addEventListener, { apply: function (a, b, c) { return Reflect.apply(a, b, c) } })
          gameSocket = d
          return d
        }
      })
      eval(x)
      let ca = oa || {}
      ca.window = global.window
      ca.destroy = destroy
      ca.controller = controller
      ca.trigger = trigger
      return Object.assign(ca, internalBotInterface);
    }

    let arras = {
      then: (cb) => {
        then(() => cb(arras));
      },
      create: function (o) {
        if (!ready) {
          log("Warning: 'create' called before arras was ready. It will be queued.");
        }
        o.id = o.id !== undefined ? o.id : id++;
        return run(script, o)
      }
    }
    if (options.start) {
      options.start(arras)
    }
    return arras
  })()


  // Listen for messages from parent (works with both worker_threads and child_process)
  const onParentMessage = (message) => {
    if (message.type === 'start') {
      const config = message.config;
      botConfig = config; // save to outer scope for tankselect handler
      options.token = config.token;
      options.loadFromCache = config.loadFromCache;
      options.cache = config.cache;
      options.arrasCache = config.arrasCache;

      // Use cached assets from server if provided
      if (message.cachedWasm && !_cachedWasm) {
        _cachedWasm = Buffer.from(message.cachedWasm, 'base64').buffer;
      }
      if (message.cachedScript && !_cachedScript) {
        _cachedScript = message.cachedScript;
      }
      startAssetLoading();

      arras.then(function () {
        currentBotInterface = arras.create(config);
      });
    } else if (message.type === 'pause') {
      isPaused = message.paused;
      if (currentBotInterface.log) {
        currentBotInterface.log(`Bot state is now: ${isPaused ? 'PAUSED' : 'RESUMED'}`);
      }
    } else if (message.type === 'key_command') {
      const key = message.key;
      if (currentBotInterface.log) currentBotInterface.log(`CMD Key: ${key}`);

      // Find trigger functions in scope? No, they are inside run()...
      // We need 'run' scope to access 'trigger'.
      // Actually, trigger is not exposed globally. 
      // Wait, the message listener is currently OUTSIDE 'run'.
      // We need a way to pass this down.
      // currentBotInterface is the object returned by arras.create(config).
      // Does it expose trigger? No.

      // FIX: Reroute this message to the internal listeners if possible.
      // Or store a global reference to the trigger?
      // Since we are in the worker context, let's look at where 'run' is called.
      // 'arras.create(config)' calls 'run(app, config, ...)'
      // 'run' defines 'trigger' and 'listeners'.

      // We can expose an event handler on currentBotInterface.
      if (currentBotInterface.simulateKey) {
        currentBotInterface.simulateKey(key);
      }
    } else if (message.type == 'tankselect') {
      // Accept initial tank assignment, reject later overrides for role-based bots
      if (!target.tank) {
        target.tank = message.tank;
        if (currentBotInterface && currentBotInterface.log) currentBotInterface.log('[TANK] Accepted:', message.tank);
      }
    } else if (message.type == 'friendly_positions') {
      // Update friendly bot positions for IFF (identification friend/foe)
      // friendlyPositions is set in outer scope — but we need to reach into the run() scope
      // Use a global bridge
      if (global._setFriendlyPositions) global._setFriendlyPositions(message.positions || []);
    } else if (message.type == 'chatbot_config') {
      liveChatbotConfig.geminiApiKey = message.geminiApiKey || '';
      liveChatbotConfig.chatbotPersonality = message.chatbotPersonality || '';
      console.log('Chatbot config updated:', liveChatbotConfig.geminiApiKey ? 'key set, chatbot ON' : 'key empty, chatbot OFF');
    } else if (message.type == 'destroy') {
      console.log("why devastatee");
      devastate();
      process.exit();
    }
  };

  if (parentPort) {
    parentPort.on('message', onParentMessage);
  } else {
    process.on('message', onParentMessage);
  }
})();