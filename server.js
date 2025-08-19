const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const CharacterLoader = require('./utils/characterLoader');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize character loader
const characterLoader = new CharacterLoader();
characterLoader.loadCharacterSets();

// Serve static files
app.use(express.static('public'));

// API endpoint for character sets (names only)
app.get('/api/character-sets', (req, res) => {
  res.json(characterLoader.getAvailableSetNames());
});

// API endpoint for full character data
app.get('/api/characters/:setName', (req, res) => {
  const setName = req.params.setName;
  const characterSet = characterLoader.getCharacterSet(setName);
  
  if (!characterSet) {
    return res.status(404).json({ error: 'Character set not found' });
  }
  
  res.json(characterSet);
});

// API endpoint for all character data
app.get('/api/characters', (req, res) => {
  res.json(characterLoader.getCharacterDatabase());
});

// API endpoint to reload character sets (useful for development)
app.post('/api/characters/reload', (req, res) => {
  try {
    characterLoader.reload();
    res.json({ success: true, message: 'Character sets reloaded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// Get character data from loader
function getCharacterSets() {
  return characterLoader.getCharacterSets();
}

function getCharacterDatabase() {
  return characterLoader.getCharacterDatabase();
}

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
    case 'answer_question':
      answerQuestion(ws, payload);
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
    characters: [...getCharacterSets()[characterSet] || getCharacterSets().classic],
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
      availableCharacterSets: Object.keys(getCharacterSets())
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
  
  // Initialize turn actions
  room.turnActions = {
    questionAsked: false,
    powerUpUsed: false,
    guessMade: false,
    doubleQuestionActive: false,
    doubleQuestionUsed: false,
    questionsAskedCount: 0
  };

  // Send game start to all players
  room.players.forEach(player => {
    player.ws.send(JSON.stringify({
      type: 'game_started',
      payload: {
        yourCharacter: player.character,
        currentTurn: room.players[room.currentTurn].name,
        players: room.players.map(p => p.name),
        allCharacters: room.characters,
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
  
  // Check if question already asked this turn
  if (room.turnActions.doubleQuestionUsed) {
    // In double question mode - can ask up to 2 questions
    if (room.turnActions.questionsAskedCount >= 2) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'You have already asked both questions from your Double Question power-up!' }
      }));
      return;
    }
  } else {
    // Normal mode - can only ask 1 question
    if (room.turnActions.questionAsked) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'You can only ask one question per turn!' }
      }));
      return;
    }
  }

  const { question } = payload;

  // Find the target player (the one being asked about)
  const targetPlayer = room.players.find(p => p !== askingPlayer);
  
  // Store the question in room state for the target player to answer
  room.pendingQuestion = {
    question: question,
    askingPlayer: askingPlayer.name,
    targetPlayer: targetPlayer.name,
    questionId: Math.random().toString(36).substring(2)
  };

  // Send question popup to target player
  targetPlayer.ws.send(JSON.stringify({
    type: 'question_received',
    payload: {
      question: question,
      askingPlayer: askingPlayer.name,
      questionId: room.pendingQuestion.questionId
    }
  }));

  // Notify asking player that question was sent
  askingPlayer.ws.send(JSON.stringify({
    type: 'question_sent',
    payload: {
      question: question,
      targetPlayer: targetPlayer.name
    }
  }));

  // Broadcast to all players that a question is pending
  broadcastToRoom(playerInfo.roomCode, {
    type: 'question_pending',
    payload: {
      askingPlayer: askingPlayer.name,
      targetPlayer: targetPlayer.name,
      question: question
    }
  });
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
  
  // Check if double question is active - no guessing allowed during double question
  if (room.turnActions.doubleQuestionActive || (room.turnActions.questionAsked && room.turnActions.doubleQuestionUsed)) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'You cannot make guesses during a double question turn! Ask your questions first.' }
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
  
  // Check if question already asked (power-ups must be used before questions)
  if (room.turnActions.questionAsked) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Power-ups must be used before asking questions!' }
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
      // Only reveal gameplay attributes, not metadata like image, id, name
      const gameplayAttributes = targetPlayer.character.attributes ? 
        Object.keys(targetPlayer.character.attributes) : 
        Object.keys(targetPlayer.character).filter(key => 
          !['name', 'image', 'id', 'attributes'].includes(key)
        );
      
      if (gameplayAttributes.length === 0) {
        result = {
          type: 'reveal_attribute',
          attribute: 'error',
          value: 'No attributes available to reveal'
        };
      } else {
        const randomAttr = gameplayAttributes[Math.floor(Math.random() * gameplayAttributes.length)];
        const attributeValue = targetPlayer.character.attributes ? 
          targetPlayer.character.attributes[randomAttr] : 
          targetPlayer.character[randomAttr];
        
        result = {
          type: 'reveal_attribute',
          attribute: randomAttr,
          value: attributeValue
        };
      }
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
      room.turnActions.doubleQuestionUsed = true;
      result = {
        type: 'double_question',
        message: 'You can ask two questions this turn! No guessing allowed this turn.'
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
  const characterSets = getCharacterSets();
  const sampleChar = characterSets[characterSet][0];
  const categories = {};

  Object.keys(sampleChar).forEach(key => {
    if (key !== 'name') {
      categories[key] = [...new Set(characterSets[characterSet].map(char => char[key]))];
    }
  });

  return categories;
}

function answerQuestion(ws, payload) {
  const playerInfo = gameState.players.get(ws);
  if (!playerInfo) return;
  
  const room = gameState.rooms.get(playerInfo.roomCode);
  if (!room || !room.pendingQuestion) return;
  
  const { answer, questionId } = payload;
  const player = room.players.find(p => p.ws === ws);
  
  // Verify this player is the target of the question
  if (!room.pendingQuestion || room.pendingQuestion.targetPlayer !== player.name) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'No question pending for you!' }
    }));
    return;
  }
  
  // Verify question ID matches
  if (room.pendingQuestion.questionId !== questionId) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Invalid question ID!' }
    }));
    return;
  }
  
  // Store question info before clearing
  const questionInfo = {
    askingPlayer: room.pendingQuestion.askingPlayer,
    targetPlayer: room.pendingQuestion.targetPlayer,
    question: room.pendingQuestion.question
  };
  
  // Broadcast the question and answer to all players
  broadcastToRoom(playerInfo.roomCode, {
    type: 'question_answered',
    payload: {
      askingPlayer: questionInfo.askingPlayer,
      targetPlayer: questionInfo.targetPlayer,
      question: questionInfo.question,
      answer: answer
    }
  });
  
  // Clear pending question
  room.pendingQuestion = null;
  
  // Handle turn logic
  room.turnActions.questionsAskedCount++;
  
  if (room.turnActions.doubleQuestionUsed) {
    // Double question turn
    if (room.turnActions.questionsAskedCount < 2) {
      // First question of double question - don't end turn yet, allow another question
      room.turnActions.questionAsked = false; // Reset so they can ask another question
      room.turnActions.doubleQuestionActive = true; // Keep active for second question
      
      // Notify that they can ask one more question
      broadcastToRoom(playerInfo.roomCode, {
        type: 'double_question_used',
        payload: {
          player: questionInfo.askingPlayer,
          message: `Question ${room.turnActions.questionsAskedCount} of 2 answered. You can ask one more question! (No guessing allowed)`
        }
      });
    } else {
      // Second question of double - end turn
      room.turnActions.questionAsked = true;
      room.turnActions.doubleQuestionActive = false;
      endTurn(room);
    }
  } else {
    // Normal single question - mark as asked and end turn
    room.turnActions.questionAsked = true;
    endTurn(room);
  }
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
  // Clear existing timer and timer sync interval
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  if (room.timerSyncInterval) {
    clearInterval(room.timerSyncInterval);
    room.timerSyncInterval = null;
  }
  
  // Reset turn actions
  room.turnActions = {
    questionAsked: false,
    powerUpUsed: false,
    guessMade: false,
    doubleQuestionActive: false,
    doubleQuestionUsed: false,
    questionsAskedCount: 0
  };
  
  // Clear power-up cooldown for the player whose turn just ended
  const currentPlayer = room.players[room.currentTurn];
  currentPlayer.powerUpCooldown = false;
  
  // Move to next turn
  room.currentTurn = (room.currentTurn + 1) % room.players.length;
  
  // Initialize timer state
  room.timeRemaining = 60;
  room.turnStartTime = Date.now();
  
  // Start timer for new turn (60 seconds)
  room.turnTimer = setTimeout(() => {
    console.log(`Turn timer expired for room ${room.code}`);
    
    // Check if room and players still exist
    if (room.players && room.players[room.currentTurn]) {
      broadcastToRoom(room.code, {
        type: 'turn_timeout',
        payload: { 
          player: room.players[room.currentTurn].name,
          message: 'Turn ended due to timeout'
        }
      });
      endTurn(room);
    }
  }, 60000); // 60 seconds
  
  // Start timer sync interval - broadcast time remaining every second
  room.timerSyncInterval = setInterval(() => {
    if (room.players && room.players[room.currentTurn]) {
      const elapsed = Math.floor((Date.now() - room.turnStartTime) / 1000);
      room.timeRemaining = Math.max(0, 60 - elapsed);
      
      broadcastToRoom(room.code, {
        type: 'timer_sync',
        payload: { 
          timeRemaining: room.timeRemaining,
          currentTurn: room.players[room.currentTurn].name
        }
      });
      
      if (room.timeRemaining <= 0) {
        clearInterval(room.timerSyncInterval);
        room.timerSyncInterval = null;
      }
    }
  }, 1000);
  
  broadcastToRoom(room.code, {
    type: 'turn_changed',
    payload: { 
      currentTurn: room.players[room.currentTurn].name,
      turnActions: room.turnActions,
      timeRemaining: 60
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