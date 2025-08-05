const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('public'));

// Game state
const gameState = {
  rooms: new Map(),
  players: new Map()
};

// Character sets (simplified)
const characterSets = {
  classic: [
    'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank',
    'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo'
  ]
};

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    // Handle player disconnect
    handleDisconnect(ws);
  });
});

function handleMessage(ws, data) {
  const { type, payload } = data;
  
  switch (type) {
    case 'join_room':
      joinRoom(ws, payload);
      break;
    case 'create_room':
      createRoom(ws, payload);
      break;
    case 'start_game':
      startGame(ws, payload);
      break;
    case 'ask_question':
      askQuestion(ws, payload);
      break;
    case 'make_guess':
      makeGuess(ws, payload);
      break;
    default:
      console.log('Unknown message type:', type);
  }
}

function createRoom(ws, payload) {
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const room = {
    code: roomCode,
    players: [],
    gameStarted: false,
    currentTurn: 0,
    characters: [...characterSets.classic]
  };
  
  gameState.rooms.set(roomCode, room);
  
  ws.send(JSON.stringify({
    type: 'room_created',
    payload: { roomCode }
  }));
}

function joinRoom(ws, payload) {
  const { roomCode, playerName } = payload;
  const room = gameState.rooms.get(roomCode);
  
  if (!room) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Room not found' }
    }));
    return;
  }
  
  const player = {
    id: Math.random().toString(36).substring(2),
    name: playerName,
    ws: ws,
    character: null,
    ready: false
  };
  
  room.players.push(player);
  gameState.players.set(ws, { playerId: player.id, roomCode });
  
  // Broadcast updated room state
  broadcastToRoom(roomCode, {
    type: 'room_updated',
    payload: {
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        ready: p.ready
      })),
      canStart: room.players.length >= 2 && room.players.every(p => p.ready)
    }
  });
}

function startGame(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;
  
  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room || room.players.length < 2) return;
  
  // Assign random characters
  const shuffledCharacters = [...room.characters].sort(() => Math.random() - 0.5);
  room.players.forEach((player, index) => {
    player.character = shuffledCharacters[index];
  });
  
  room.gameStarted = true;
  room.currentTurn = 0;
  
  // Send game start to all players
  room.players.forEach(player => {
    player.ws.send(JSON.stringify({
      type: 'game_started',
      payload: {
        yourCharacter: player.character,
        currentTurn: room.players[room.currentTurn].name,
        players: room.players.map(p => p.name)
      }
    }));
  });
}

function askQuestion(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;
  
  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room || !room.gameStarted) return;
  
  const { question } = payload;
  
  // Simple auto-answer (random yes/no)
  const answer = Math.random() > 0.5 ? 'yes' : 'no';
  
  // Broadcast question and answer
  broadcastToRoom(playerInfo.roomCode, {
    type: 'question_asked',
    payload: {
      player: room.players.find(p => p.ws === ws).name,
      question,
      answer
    }
  });
  
  // Next turn
  room.currentTurn = (room.currentTurn + 1) % room.players.length;
  broadcastToRoom(playerInfo.roomCode, {
    type: 'turn_changed',
    payload: { currentTurn: room.players[room.currentTurn].name }
  });
}

function makeGuess(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;
  
  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room || !room.gameStarted) return;
  
  const { character } = payload;
  const guessingPlayer = room.players.find(p => p.ws === ws);
  
  // Check if guess is correct (find the target player's character)
  const targetPlayer = room.players.find(p => p !== guessingPlayer);
  const isCorrect = targetPlayer && targetPlayer.character === character;
  
  if (isCorrect) {
    // Game over
    broadcastToRoom(playerInfo.roomCode, {
      type: 'game_over',
      payload: {
        winner: guessingPlayer.name,
        character: character
      }
    });
  } else {
    // Wrong guess, next turn
    broadcastToRoom(playerInfo.roomCode, {
      type: 'guess_made',
      payload: {
        player: guessingPlayer.name,
        character,
        correct: false
      }
    });
    
    room.currentTurn = (room.currentTurn + 1) % room.players.length;
    broadcastToRoom(playerInfo.roomCode, {
      type: 'turn_changed',
      payload: { currentTurn: room.players[room.currentTurn].name }
    });
  }
}

function broadcastToRoom(roomCode, message) {
  const room = gameState.rooms.get(roomCode);
  if (!room) return;
  
  room.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

function handleDisconnect(ws) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;
  
  const room = gameState.rooms.get(playerInfo.roomCode);
  if (room) {
    room.players = room.players.filter(p => p.ws !== ws);
    
    if (room.players.length === 0) {
      gameState.rooms.delete(playerInfo.roomCode);
    } else {
      broadcastToRoom(playerInfo.roomCode, {
        type: 'player_left',
        payload: { playersCount: room.players.length }
      });
    }
  }
  
  gameState.players.delete(ws);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Guest Quest server running on http://localhost:${PORT}`);
  console.log('📁 Serving files from ./public directory');
});