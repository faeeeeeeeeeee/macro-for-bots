# arras-ws-relay

WebSocket relay server for arras.io bot iframes. Deploy this to give your bots a different IP address.

## How it works

1. You deploy this relay to a free cloud platform (Render, Railway, etc.)
2. In the bot panel, paste the relay URL (e.g. `wss://your-relay.onrender.com`)
3. Bot iframes route their WebSocket connections through the relay
4. The game server sees the relay's IP instead of yours
5. More bots can connect beyond the ~3 per IP limit

## Deploy to Render (free)

1. Fork/push this repo to your GitHub
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Root Directory**: `ws-relay`
   - **Build Command**: `npm install`
   - **Start Command**: `node relay.js`
   - **Plan**: Free
5. Click **Create Web Service**
6. Your relay URL will be: `wss://your-service-name.onrender.com`
7. Paste that URL in the bot panel's "Relay URL" field

## Deploy to Railway (free)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select your repo, set root directory to `ws-relay`
3. Railway auto-detects Node.js
4. Your URL will be something like `wss://your-app.up.railway.app`

## Multiple relays = more IPs

Deploy to 2-3 different platforms for 2-3 different IPs. Each relay gives you ~3 more bot slots.

## Environment variables

- `PORT` — Server port (default: 3000, Render uses 10000)
- `MAX_CONNECTIONS` — Max simultaneous relay connections (default: 20)
