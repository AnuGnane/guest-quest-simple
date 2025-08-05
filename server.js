const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('public'));

// API endpoint for character sets
app.get('/api/character-sets', (req, res) => {
  const sets = {};
  Object.keys(characterSets).forEach(key => {
    sets[key] = characterSets[key].map(char => char.name);
  });
  res.json(sets);
});

// Power-ups available in the game
const powerUps = {
  reveal_attribute: {
    name: 'Reveal Attribute',
    description: 'Reveals a random attribute of the target character',
    icon: '🔍',
    uses: 2
  },
  double_question: {
    name: 'Double Question',
    description: 'Ask two questions in one turn',
    icon: '❓❓',
    uses: 1
  },
  elimination_hint: {
    name: 'Elimination Hint',
    description: 'Eliminates 2 random characters that are NOT the target',
    icon: '❌',
    uses: 1
  }
};

// Game state
const gameState = {
  rooms: new Map(),
  players: new Map()
};

// Enhanced character sets with rich categories and attributes
const characterSets = {
  classic: [
    {
      name: 'Alice', gender: 'female', hairColor: 'blonde', hasGlasses: false, age: 'young',
      occupation: 'teacher', hobby: 'reading', personality: 'cheerful', location: 'city'
    },
    {
      name: 'Bob', gender: 'male', hairColor: 'brown', hasGlasses: true, age: 'middle',
      occupation: 'engineer', hobby: 'gaming', personality: 'analytical', location: 'suburbs'
    },
    {
      name: 'Charlie', gender: 'male', hairColor: 'black', hasGlasses: false, age: 'old',
      occupation: 'retired', hobby: 'gardening', personality: 'wise', location: 'countryside'
    },
    {
      name: 'Diana', gender: 'female', hairColor: 'red', hasGlasses: true, age: 'young',
      occupation: 'artist', hobby: 'painting', personality: 'creative', location: 'city'
    },
    {
      name: 'Eve', gender: 'female', hairColor: 'black', hasGlasses: false, age: 'middle',
      occupation: 'doctor', hobby: 'hiking', personality: 'caring', location: 'city'
    },
    {
      name: 'Frank', gender: 'male', hairColor: 'grey', hasGlasses: true, age: 'old',
      occupation: 'professor', hobby: 'chess', personality: 'intellectual', location: 'city'
    },
    {
      name: 'Grace', gender: 'female', hairColor: 'brown', hasGlasses: false, age: 'young',
      occupation: 'chef', hobby: 'cooking', personality: 'energetic', location: 'city'
    },
    {
      name: 'Henry', gender: 'male', hairColor: 'blonde', hasGlasses: false, age: 'middle',
      occupation: 'pilot', hobby: 'flying', personality: 'adventurous', location: 'suburbs'
    }
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
    case 'toggle_ready':
      toggleReady(ws, payload);
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
    case 'use_powerup':
      usePowerUp(ws, payload);
      break;
    case 'end_turn':
      handleEndTurn(ws, payload);
      break;
    case 'leave_room':
      leaveRoom(ws, payload);
      break;
    default:
      console.log('Unknown message type:', type);
  }
}

function createRoom(ws, payload) {
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { characterSet = 'classic' } = payload;

  const room = {
    code: roomCode,
    players: [],
    gameStarted: false,
    currentTurn: 0,
    characterSet: characterSet,
    characters: [...characterSets[characterSet] || characterSets.classic],
    turnActions: {
      questionAsked: false,
      powerUpUsed: false,
      guessMade: false
    }
  };

  gameState.rooms.set(roomCode, room);

  ws.send(JSON.stringify({
    type: 'room_created',
    payload: {
      roomCode,
      availableCharacterSets: Object.keys(characterSets)
    }
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

  // Check if player is already in this room
  const existingPlayer = room.players.find(p => p.name === playerName);
  if (existingPlayer) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'A player with this name is already in the room' }
    }));
    return;
  }

  // Check if this WebSocket is already in a room
  const existingPlayerInfo = gameState.players.get(ws);
  if (existingPlayerInfo) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'You are already in a room. Leave your current room first.' }
    }));
    return;
  }

  // Check if game has already started
  if (room.gameStarted) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Cannot join - game has already started' }
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

  console.log(`Player ${playerName} joined room ${roomCode}`);

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

function toggleReady(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;

  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room) return;

  // Find the player and toggle their ready status
  const player = room.players.find(p => p.ws === ws);
  if (!player) return;

  player.ready = !player.ready;

  // Broadcast updated room state
  broadcastToRoom(playerInfo.roomCode, {
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
    // Give each player power-ups
    player.powerUps = {
      reveal_attribute: 2,
      double_question: 1,
      elimination_hint: 1
    };
    player.powerUpCooldown = false; // Can't use power-up next turn if used this turn
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
        players: room.players.map(p => p.name),
        allCharacters: room.characters.map(char => char.name),
        characterSet: room.characterSet,
        powerUps: player.powerUps,
        availablePowerUps: powerUps
      }
    }));
  });
}

function askQuestion(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;

  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room || !room.gameStarted) return;

  const askingPlayer = room.players.find(p => p.ws === ws);
  
  // Check if it's the player's turn
  if (room.players[room.currentTurn] !== askingPlayer) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'It\'s not your turn!' }
    }));
    return;
  }
  
  // Check if question already asked this turn (unless double question power-up was used)
  if (room.turnActions.questionAsked && !room.turnActions.doubleQuestionActive) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'You can only ask one question per turn!' }
    }));
    return;
  }

  const { question } = payload;

  // Find the target player (the one being asked about)
  const targetPlayer = room.players.find(p => p !== askingPlayer);
  const targetCharacter = targetPlayer.character;

  // Smart answer based on character attributes
  let answer = 'no'; // default
  const lowerQuestion = question.toLowerCase();

  // Check for attribute-based questions
  if (lowerQuestion.includes('male') || lowerQuestion.includes('man') || lowerQuestion.includes('boy')) {
    answer = targetCharacter.gender === 'male' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('female') || lowerQuestion.includes('woman') || lowerQuestion.includes('girl')) {
    answer = targetCharacter.gender === 'female' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('blonde') || lowerQuestion.includes('blond')) {
    answer = targetCharacter.hairColor === 'blonde' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('brown hair') || lowerQuestion.includes('brunette')) {
    answer = targetCharacter.hairColor === 'brown' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('black hair')) {
    answer = targetCharacter.hairColor === 'black' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('red hair') || lowerQuestion.includes('ginger')) {
    answer = targetCharacter.hairColor === 'red' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('grey hair') || lowerQuestion.includes('gray hair')) {
    answer = targetCharacter.hairColor === 'grey' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('glasses') || lowerQuestion.includes('spectacles')) {
    answer = targetCharacter.hasGlasses ? 'yes' : 'no';
  } else if (lowerQuestion.includes('young')) {
    answer = targetCharacter.age === 'young' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('old')) {
    answer = targetCharacter.age === 'old' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('middle') || lowerQuestion.includes('middle-aged')) {
    answer = targetCharacter.age === 'middle' ? 'yes' : 'no';
  }
  // Superhero specific questions
  else if (lowerQuestion.includes('fly') || lowerQuestion.includes('flight')) {
    answer = targetCharacter.power === 'flight' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('strong') || lowerQuestion.includes('strength')) {
    answer = targetCharacter.power === 'strength' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('justice league')) {
    answer = targetCharacter.team === 'Justice League' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('avengers')) {
    answer = targetCharacter.team === 'Avengers' ? 'yes' : 'no';
  } else if (lowerQuestion.includes('cape')) {
    answer = targetCharacter.hascape ? 'yes' : 'no';
  }
  // If no specific attribute matched, give random answer
  else {
    answer = Math.random() > 0.5 ? 'yes' : 'no';
  }

  // Mark question as asked
  if (room.turnActions.doubleQuestionActive) {
    room.turnActions.doubleQuestionActive = false; // Used up double question
  } else {
    room.turnActions.questionAsked = true;
  }

  // Broadcast question and answer
  broadcastToRoom(playerInfo.roomCode, {
    type: 'question_asked',
    payload: {
      player: askingPlayer.name,
      question,
      answer,
      wasIntelligent: answer !== (Math.random() > 0.5 ? 'yes' : 'no') // indicate if it was a smart answer
    }
  });

  // Don't automatically advance turn - let player choose to ask another question, use power-up, or make guess
}

function makeGuess(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;

  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room || !room.gameStarted) return;

  const guessingPlayer = room.players.find(p => p.ws === ws);
  
  // Check if it's the player's turn
  if (room.players[room.currentTurn] !== guessingPlayer) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'It\'s not your turn!' }
    }));
    return;
  }
  
  // Check if guess already made this turn
  if (room.turnActions.guessMade) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'You can only make one guess per turn!' }
    }));
    return;
  }

  const { character } = payload;

  // Check if guess is correct (find the target player's character)
  const targetPlayer = room.players.find(p => p !== guessingPlayer);
  const isCorrect = targetPlayer && targetPlayer.character.name === character;

  if (isCorrect) {
    // Game over
    broadcastToRoom(playerInfo.roomCode, {
      type: 'game_over',
      payload: {
        winner: guessingPlayer.name,
        character: character,
        targetCharacter: targetPlayer.character
      }
    });
  } else {
    // Wrong guess, mark as made and end turn
    room.turnActions.guessMade = true;
    
    broadcastToRoom(playerInfo.roomCode, {
      type: 'guess_made',
      payload: {
        player: guessingPlayer.name,
        character,
        correct: false
      }
    });

    // End turn after wrong guess
    endTurn(room);
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

function usePowerUp(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;

  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room || !room.gameStarted) return;

  const player = room.players.find(p => p.ws === ws);
  
  // Check if it's the player's turn
  if (room.players[room.currentTurn] !== player) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'It\'s not your turn!' }
    }));
    return;
  }
  
  // Check if power-up already used this turn
  if (room.turnActions.powerUpUsed) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'You can only use one power-up per turn!' }
    }));
    return;
  }
  
  // Check if player is on power-up cooldown
  if (player.powerUpCooldown) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'You cannot use power-ups this turn (cooldown from last use)!' }
    }));
    return;
  }

  const { powerUpType } = payload;

  if (!player || !player.powerUps[powerUpType] || player.powerUps[powerUpType] <= 0) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Power-up not available or already used' }
    }));
    return;
  }

  // Use the power-up
  player.powerUps[powerUpType]--;
  room.turnActions.powerUpUsed = true;
  player.powerUpCooldown = true; // Set cooldown for next turn

  const targetPlayer = room.players.find(p => p !== player);
  let result = {};

  switch (powerUpType) {
    case 'reveal_attribute':
      const attributes = Object.keys(targetPlayer.character).filter(key => key !== 'name');
      const randomAttr = attributes[Math.floor(Math.random() * attributes.length)];
      result = {
        type: 'reveal_attribute',
        attribute: randomAttr,
        value: targetPlayer.character[randomAttr]
      };
      break;

    case 'elimination_hint':
      const allChars = room.characters.filter(char => char.name !== targetPlayer.character.name);
      const eliminated = allChars.sort(() => Math.random() - 0.5).slice(0, 2);
      result = {
        type: 'elimination_hint',
        eliminatedCharacters: eliminated.map(char => char.name)
      };
      break;

    case 'double_question':
      room.turnActions.doubleQuestionActive = true;
      result = {
        type: 'double_question',
        message: 'You can ask two questions this turn!'
      };
      break;
  }

  // Broadcast power-up usage
  broadcastToRoom(playerInfo.roomCode, {
    type: 'powerup_used',
    payload: {
      player: player.name,
      powerUpType: powerUpType,
      powerUpName: powerUps[powerUpType].name,
      result: result
    }
  });

  // Send updated power-ups to the player
  ws.send(JSON.stringify({
    type: 'powerups_updated',
    payload: { powerUps: player.powerUps }
  }));
}

function getCharacterCategories(characterSet) {
  const sampleChar = characterSets[characterSet][0];
  const categories = {};

  Object.keys(sampleChar).forEach(key => {
    if (key !== 'name') {
      categories[key] = [...new Set(characterSets[characterSet].map(char => char[key]))];
    }
  });

  return categories;
}

function handleEndTurn(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;
  
  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room || !room.gameStarted) return;
  
  const player = room.players.find(p => p.ws === ws);
  
  // Check if it's the player's turn
  if (room.players[room.currentTurn] !== player) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'It\'s not your turn!' }
    }));
    return;
  }
  
  endTurn(room);
}

function endTurn(room) {
  // Reset turn actions
  room.turnActions = {
    questionAsked: false,
    powerUpUsed: false,
    guessMade: false,
    doubleQuestionActive: false
  };
  
  // Clear power-up cooldown for the player whose turn just ended
  const currentPlayer = room.players[room.currentTurn];
  currentPlayer.powerUpCooldown = false;
  
  // Move to next turn
  room.currentTurn = (room.currentTurn + 1) % room.players.length;
  
  broadcastToRoom(room.code, {
    type: 'turn_changed',
    payload: { 
      currentTurn: room.players[room.currentTurn].name,
      turnActions: room.turnActions
    }
  });
}

function leaveRoom(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;

  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room) return;

  const leavingPlayer = room.players.find(p => p.ws === ws);
  if (!leavingPlayer) return;

  console.log(`Player ${leavingPlayer.name} left room ${playerInfo.roomCode}`);

  // Remove player from room
  room.players = room.players.filter(p => p.ws !== ws);
  gameState.players.delete(ws);

  // If room is empty, delete it
  if (room.players.length === 0) {
    gameState.rooms.delete(playerInfo.roomCode);
    console.log(`Room ${playerInfo.roomCode} deleted (empty)`);
  } else {
    // Broadcast updated room state to remaining players
    broadcastToRoom(playerInfo.roomCode, {
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

    // If game was in progress, end it
    if (room.gameStarted) {
      broadcastToRoom(playerInfo.roomCode, {
        type: 'game_ended',
        payload: { reason: `${leavingPlayer.name} left the game` }
      });
      room.gameStarted = false;
    }
  }

  // Confirm to the leaving player
  ws.send(JSON.stringify({
    type: 'left_room',
    payload: { success: true }
  }));
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