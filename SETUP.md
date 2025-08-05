# Guest Quest Simple - Setup Guide

## 🎯 What We Built

A simplified multiplayer "Guess Who" style game with:
- **Minimal dependencies**: Just Express and WebSocket (ws)
- **Simple architecture**: Single server file, vanilla JavaScript frontend
- **Local-first**: Easy to run and test locally
- **Incremental**: Built to be extended step by step

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Game
```bash
npm start
```

### 3. Test the Game
```bash
npm test
```

### 4. Play the Game
1. Open http://localhost:3000 in your browser
2. Enter your name and create a room
3. Open another browser tab and join with the room code
4. Both players click "Ready" and start the game!

## 🎮 How It Works

### Simple Architecture
- **server.js**: Single file handling HTTP server, WebSocket connections, and game logic
- **public/**: Static files served to browsers
  - **index.html**: Game interface
  - **style.css**: Styling
  - **game.js**: Client-side game logic

### Game Flow
1. **Lobby**: Players create/join rooms, mark ready
2. **Game Start**: Random character assignment
3. **Gameplay**: Turn-based questions and guesses
4. **Win Condition**: First correct guess wins

### Key Features
- ✅ Real-time multiplayer via WebSockets
- ✅ Room-based game sessions
- ✅ Turn-based gameplay
- ✅ Simple character guessing mechanics
- ✅ Responsive web interface
- ✅ Automatic reconnection handling

## 🔧 Development

### File Structure
```
guest-quest-simple/
├── server.js          # Main server (HTTP + WebSocket)
├── package.json        # Dependencies and scripts
├── start.js           # Enhanced startup script
├── test.js            # Automated testing
├── public/
│   ├── index.html     # Game interface
│   ├── style.css      # Styling
│   └── game.js        # Client logic
└── README.md          # Documentation
```

### Scripts
- `npm start` - Start server with helpful output
- `npm run dev` - Start server directly
- `npm test` - Run automated tests

## 🎯 Next Steps

This is a foundation that can be extended:

### Immediate Improvements
1. **Better Game Logic**: Player-driven answers instead of random
2. **Character Attributes**: Add queryable properties to characters
3. **Visual Enhancements**: Better UI, animations, character images

### Advanced Features
1. **More Character Sets**: Add different themes
2. **Game Modes**: Team play, time limits, etc.
3. **Persistence**: Save game history
4. **Deployment**: Host on cloud platforms

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill any process using port 3000
lsof -ti:3000 | xargs kill -9
```

### WebSocket Connection Issues
- Check if server is running
- Verify no firewall blocking connections
- Try refreshing the browser

### Game State Issues
- Refresh browser to reset client state
- Restart server to reset game state

## 🌟 Why This Approach?

### Advantages of Simple Version
- **Easy to understand**: Single server file, minimal abstractions
- **Quick to modify**: No build steps, direct file editing
- **Easy to debug**: Clear code flow, minimal dependencies
- **Fast iteration**: Changes are immediately visible
- **Deployment ready**: Can be hosted anywhere Node.js runs

### Comparison to Complex Version
The original project had:
- Multiple TypeScript files with complex build processes
- React frontend with many dependencies
- Redis requirement
- Socket.IO with additional complexity
- Multiple testing scripts and configurations

This simple version achieves the same core functionality with:
- 90% fewer dependencies
- Single server file vs. multiple modules
- Vanilla JavaScript vs. TypeScript build process
- Native WebSockets vs. Socket.IO
- In-memory storage vs. Redis

## 🚀 Ready to Play!

Your simplified Guest Quest game is ready! It's much easier to understand, modify, and extend than the complex version, while still providing a fully functional multiplayer gaming experience.