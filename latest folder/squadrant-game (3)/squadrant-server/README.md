# Squadrant Server — LAN Hotspot Multiplayer

## Setup
```bash
npm install
npm start
```

## How it works
- Run this on **any device** connected to the same WiFi or mobile hotspot
- The terminal prints the local IP address(es) to enter in the game
- No internet required — works 100% offline on LAN

## Android Hotspot Setup
1. Enable Mobile Hotspot on one Android device
2. Run `node server.js` on that same device (needs Termux or similar)
3. Other devices connect to the hotspot and join automatically

## Default Port
`3001` — change via `PORT=xxxx node server.js`
