class GuestQuestGame {
    constructor() {
        this.ws = null;
        this.playerName = '';
        this.roomCode = '';
        this.isReady = false;
        this.gameStarted = false;
        this.inRoom = false;
        this.characters = [];
        this.characterSets = {};
        this.gameStats = {
            questionsAsked: 0,
            guessesMade: 0,
            turnCount: 1
        };
        this.powerUps = {};
        this.availablePowerUps = {};
        this.isMyTurn = false;
        this.eliminatedCharacters = new Set();
        
        this.init();
    }
    
    init() {
        this.connect();
        this.setupEventListeners();
        this.loadCharacterSets();
    }
    
    async loadCharacterSets() {
        try {
            const response = await fetch('/api/character-sets');
            this.characterSets = await response.json();
            console.log('Character sets loaded:', this.characterSets);
        } catch (error) {
            console.error('Failed to load character sets:', error);
        }
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.updateConnectionStatus('Connected', true);
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            this.updateConnectionStatus('Disconnected', false);
            // Try to reconnect after 3 seconds
            setTimeout(() => this.connect(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('Connection Error', false);
        };
    }
    
    updateConnectionStatus(message, connected) {
        const statusEl = document.getElementById('connection-status');
        statusEl.textContent = message;
        statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
    }
    
    setupEventListeners() {
        // Enter key handlers
        document.getElementById('player-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.setUsername();
        });
        
        document.getElementById('room-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        document.getElementById('question-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.askQuestion();
        });
        
        // Username validation
        document.getElementById('player-name').addEventListener('input', (e) => {
            this.validateUsername(e.target.value);
        });
    }
    
    validateUsername(username) {
        const btn = document.getElementById('set-username-btn');
        const isValid = /^[a-zA-Z0-9]{3,20}$/.test(username);
        
        btn.disabled = !isValid;
        
        if (username.length > 0 && !isValid) {
            btn.textContent = username.length < 3 ? 'Too Short' : 'Invalid Characters';
        } else {
            btn.textContent = 'Continue';
        }
    }
    
    setUsername() {
        const nameInput = document.getElementById('player-name');
        const username = nameInput.value.trim();
        
        if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) {
            alert('Username must be 3-20 characters, letters and numbers only');
            return;
        }
        
        this.playerName = username;
        document.getElementById('display-username').textContent = username;
        
        // Hide username screen, show room selection
        document.getElementById('username-screen').style.display = 'none';
        document.getElementById('room-selection-screen').style.display = 'block';
    }
    
    changeUsername() {
        // Reset to username screen
        document.getElementById('room-selection-screen').style.display = 'none';
        document.getElementById('username-screen').style.display = 'block';
        document.getElementById('player-name').value = this.playerName;
        document.getElementById('player-name').focus();
    }
    
    handleMessage(data) {
        const { type, payload } = data;
        
        switch (type) {
            case 'room_created':
                this.handleRoomCreated(payload);
                break;
            case 'room_updated':
                this.handleRoomUpdated(payload);
                break;
            case 'game_started':
                this.handleGameStarted(payload);
                break;
            case 'question_asked':
                this.handleQuestionAsked(payload);
                break;
            case 'turn_changed':
                this.handleTurnChanged(payload);
                break;
            case 'guess_made':
                this.handleGuessMade(payload);
                break;
            case 'game_over':
                this.handleGameOver(payload);
                break;
            case 'left_room':
                this.handleLeftRoom(payload);
                break;
            case 'powerup_used':
                this.handlePowerUpUsed(payload);
                break;
            case 'powerups_updated':
                this.handlePowerUpsUpdated(payload);
                break;
            case 'game_ended':
                this.handleGameEnded(payload);
                break;
            case 'error':
                this.handleError(payload);
                break;
            default:
                console.log('Unknown message type:', type);
        }
    }
    
    createRoom() {
        if (this.inRoom) {
            alert('You are already in a room. Leave the current room first.');
            return;
        }
        
        const characterSetSelect = document.getElementById('character-set-select');
        const selectedCharacterSet = characterSetSelect.value;
        
        this.send('create_room', { 
            playerName: this.playerName,
            characterSet: selectedCharacterSet
        });
        
        // Disable room selection buttons while creating
        this.setRoomSelectionEnabled(false);
    }
    
    handleRoomCreated(payload) {
        this.roomCode = payload.roomCode;
        document.getElementById('current-room-code').textContent = this.roomCode;
        
        // Auto-join the created room
        this.send('join_room', { roomCode: this.roomCode, playerName: this.playerName });
    }
    
    joinRoom() {
        if (this.inRoom) {
            alert('You are already in a room. Leave the current room first.');
            return;
        }
        
        const codeInput = document.getElementById('room-code');
        this.roomCode = codeInput.value.trim().toUpperCase();
        
        if (!this.roomCode) {
            alert('Please enter a room code');
            return;
        }
        
        this.send('join_room', { roomCode: this.roomCode, playerName: this.playerName });
        
        // Disable room selection buttons while joining
        this.setRoomSelectionEnabled(false);
    }
    
    setRoomSelectionEnabled(enabled) {
        document.getElementById('create-room-btn').disabled = !enabled;
        document.getElementById('join-room-btn').disabled = !enabled;
        document.getElementById('room-code').disabled = !enabled;
        document.getElementById('character-set-select').disabled = !enabled;
    }
    
    leaveRoom() {
        if (this.gameStarted) {
            if (!confirm('Are you sure you want to leave the game in progress?')) {
                return;
            }
        }
        
        this.send('leave_room', {});
        
        // Reset state
        this.inRoom = false;
        this.isReady = false;
        this.gameStarted = false;
        this.roomCode = '';
        
        // Show room selection screen
        document.getElementById('lobby-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'none';
        document.getElementById('room-selection-screen').style.display = 'block';
        
        // Re-enable room selection
        this.setRoomSelectionEnabled(true);
        
        // Clear room code input
        document.getElementById('room-code').value = '';
    }
    
    handleRoomUpdated(payload) {
        // First time joining room
        if (!this.inRoom) {
            this.inRoom = true;
            // Hide room selection, show lobby
            document.getElementById('room-selection-screen').style.display = 'none';
            document.getElementById('lobby-screen').style.display = 'block';
        }
        
        const playersListEl = document.getElementById('players-list');
        playersListEl.innerHTML = '';
        
        payload.players.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = `player-item ${player.ready ? 'player-ready' : ''}`;
            playerEl.innerHTML = `
                <span>${player.name}${player.name === this.playerName ? ' (You)' : ''}</span>
                <span>${player.ready ? '✓ Ready' : 'Not Ready'}</span>
            `;
            playersListEl.appendChild(playerEl);
        });
        
        // Show ready button
        const readyBtn = document.getElementById('ready-btn');
        readyBtn.style.display = 'block';
        readyBtn.textContent = this.isReady ? 'Not Ready' : 'Ready';
        readyBtn.className = this.isReady ? 'ready' : '';
        
        // Show start button if can start
        const startBtn = document.getElementById('start-game-btn');
        if (payload.canStart) {
            startBtn.style.display = 'block';
        } else {
            startBtn.style.display = 'none';
        }
    }
    
    toggleReady() {
        this.isReady = !this.isReady;
        
        // Send ready status to server
        this.send('toggle_ready', { ready: this.isReady });
        
        // Update UI immediately for responsiveness
        const readyBtn = document.getElementById('ready-btn');
        readyBtn.textContent = this.isReady ? 'Not Ready' : 'Ready';
        readyBtn.className = this.isReady ? 'ready' : '';
    }
    
    startGame() {
        this.send('start_game', {});
    }
    
    handleGameStarted(payload) {
        this.gameStarted = true;
        this.characters = payload.allCharacters;
        this.characterSet = payload.characterSet;
        this.yourCharacter = payload.yourCharacter;
        this.powerUps = payload.powerUps;
        this.availablePowerUps = payload.availablePowerUps;
        
        // Hide lobby, show game
        document.getElementById('lobby-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        
        // Set character
        document.getElementById('character-name').textContent = payload.yourCharacter.name;
        
        // Show character details
        this.displayCharacterDetails(payload.yourCharacter);
        
        // Set current turn
        document.getElementById('turn-player').textContent = payload.currentTurn;
        
        // Create character buttons
        this.createCharacterButtons();
        
        // Setup question hints
        this.setupQuestionHints();
        
        // Setup power-ups
        this.setupPowerUps();
        
        this.addLogMessage(`Game started! Your character is ${payload.yourCharacter.name} (${payload.characterSet} set)`);
    }
    
    displayCharacterDetails(character) {
        const detailsEl = document.getElementById('character-details');
        let details = [];
        
        if (character.gender) details.push(`Gender: ${character.gender}`);
        if (character.hairColor) details.push(`Hair: ${character.hairColor}`);
        if (character.hasGlasses !== undefined) details.push(`Glasses: ${character.hasGlasses ? 'yes' : 'no'}`);
        if (character.age) details.push(`Age: ${character.age}`);
        if (character.power) details.push(`Power: ${character.power}`);
        if (character.team) details.push(`Team: ${character.team}`);
        if (character.hascape !== undefined) details.push(`Cape: ${character.hascape ? 'yes' : 'no'}`);
        
        detailsEl.textContent = details.join(' • ');
    }
    
    setupQuestionHints() {
        const hintContent = document.getElementById('hint-content');
        let hints = '';
        
        if (this.characterSet === 'classic') {
            hints = `
                <div class="hint-category">
                    <strong>Gender:</strong>
                    <div class="hint-examples">"Is your character male?" "Are they female?"</div>
                </div>
                <div class="hint-category">
                    <strong>Hair Color:</strong>
                    <div class="hint-examples">"Do they have blonde hair?" "Is their hair brown/black/red/grey?"</div>
                </div>
                <div class="hint-category">
                    <strong>Accessories:</strong>
                    <div class="hint-examples">"Do they wear glasses?"</div>
                </div>
                <div class="hint-category">
                    <strong>Age:</strong>
                    <div class="hint-examples">"Are they young?" "Are they old?" "Are they middle-aged?"</div>
                </div>
            `;
        } else if (this.characterSet === 'superheroes') {
            hints = `
                <div class="hint-category">
                    <strong>Powers:</strong>
                    <div class="hint-examples">"Can they fly?" "Do they have super strength?"</div>
                </div>
                <div class="hint-category">
                    <strong>Teams:</strong>
                    <div class="hint-examples">"Are they in the Justice League?" "Are they an Avenger?"</div>
                </div>
                <div class="hint-category">
                    <strong>Appearance:</strong>
                    <div class="hint-examples">"Do they wear a cape?" "Are they male/female?"</div>
                </div>
            `;
        }
        
        hintContent.innerHTML = hints;
    }
    
    setupPowerUps() {
        const powerUpsGrid = document.getElementById('powerups-grid');
        powerUpsGrid.innerHTML = '';
        
        Object.keys(this.availablePowerUps).forEach(powerUpId => {
            const powerUp = this.availablePowerUps[powerUpId];
            const uses = this.powerUps[powerUpId] || 0;
            
            const powerUpEl = document.createElement('div');
            powerUpEl.className = `powerup-item ${uses <= 0 ? 'disabled' : ''}`;
            powerUpEl.setAttribute('data-powerup-id', powerUpId);
            powerUpEl.onclick = () => this.usePowerUp(powerUpId);
            
            powerUpEl.innerHTML = `
                <div class="powerup-icon">${powerUp.icon}</div>
                <div class="powerup-name">${powerUp.name}</div>
                <div class="powerup-description">${powerUp.description}</div>
                <div class="powerup-uses">Uses: ${uses}</div>
            `;
            
            powerUpsGrid.appendChild(powerUpEl);
        });
        
        this.updateTurnControls();
    }
    
    usePowerUp(powerUpId) {
        if (!this.powerUps[powerUpId] || this.powerUps[powerUpId] <= 0) {
            alert('This power-up is not available or has been used up!');
            return;
        }
        
        if (confirm(`Use ${this.availablePowerUps[powerUpId].name}?`)) {
            this.send('use_powerup', { powerUpType: powerUpId });
        }
    }
    
    handlePowerUpUsed(payload) {
        const { player, powerUpName, result } = payload;
        
        let message = `🎯 ${player} used ${powerUpName}!`;
        
        if (result.type === 'reveal_attribute') {
            message += ` Revealed: ${result.attribute} = ${result.value}`;
        } else if (result.type === 'elimination_hint') {
            message += ` Eliminated: ${result.eliminatedCharacters.join(', ')}`;
        } else if (result.type === 'category_scan') {
            message += ` Categories revealed!`;
        } else {
            message += ` ${result.message || ''}`;
        }
        
        this.addLogMessage(message);
    }
    
    handlePowerUpsUpdated(payload) {
        this.powerUps = payload.powerUps;
        this.setupPowerUps();
    }
    
    endTurn() {
        if (!this.isMyTurn) {
            alert('It\'s not your turn!');
            return;
        }
        
        this.send('end_turn', {});
    }
    
    createCharacterButtons() {
        const charactersEl = document.getElementById('characters-list');
        charactersEl.innerHTML = '';
        
        this.characters.forEach(character => {
            const btn = document.createElement('button');
            btn.className = 'character-btn';
            btn.textContent = character;
            btn.onclick = () => this.makeGuess(character);
            charactersEl.appendChild(btn);
        });
    }
    
    askQuestion() {
        const questionInput = document.getElementById('question-input');
        const question = questionInput.value.trim();
        
        if (!question) {
            alert('Please enter a question');
            return;
        }
        
        this.send('ask_question', { question });
        questionInput.value = '';
    }
    
    handleQuestionAsked(payload) {
        this.gameStats.questionsAsked++;
        this.updateStats();
        
        const intelligentIcon = payload.wasIntelligent ? '🧠' : '🎲';
        this.addLogMessage(`${intelligentIcon} ${payload.player} asked: "${payload.question}" - Answer: ${payload.answer}`);
    }
    
    handleTurnChanged(payload) {
        document.getElementById('turn-player').textContent = payload.currentTurn;
        
        this.gameStats.turnCount++;
        this.updateStats();
        
        this.isMyTurn = payload.currentTurn === this.playerName;
        this.updateTurnControls();
        
        // Visual feedback for turn change
        const turnEl = document.getElementById('current-turn');
        if (this.isMyTurn) {
            turnEl.style.background = '#d4edda';
            turnEl.style.color = '#155724';
            this.addLogMessage('🎯 It\'s your turn!');
        } else {
            turnEl.style.background = '#f8d7da';
            turnEl.style.color = '#721c24';
        }
    }
    
    updateTurnControls() {
        // Update all turn-based controls
        document.getElementById('question-input').disabled = !this.isMyTurn;
        document.getElementById('ask-btn').disabled = !this.isMyTurn;
        document.getElementById('end-turn-btn').disabled = !this.isMyTurn;
        
        const characterBtns = document.querySelectorAll('.character-btn');
        characterBtns.forEach(btn => btn.disabled = !this.isMyTurn);
        
        const powerUpBtns = document.querySelectorAll('.powerup-item');
        powerUpBtns.forEach(btn => {
            if (!this.isMyTurn) {
                btn.classList.add('disabled');
            } else {
                // Check if power-up is available
                const powerUpId = btn.getAttribute('data-powerup-id');
                if (!this.powerUps[powerUpId] || this.powerUps[powerUpId] <= 0) {
                    btn.classList.add('disabled');
                } else {
                    btn.classList.remove('disabled');
                }
            }
        });
    }
    
    makeGuess(character) {
        if (confirm(`Are you sure you want to guess ${character}?`)) {
            this.send('make_guess', { character });
        }
    }
    
    handleGuessMade(payload) {
        this.gameStats.guessesMade++;
        this.updateStats();
        
        const resultIcon = payload.correct ? '✅' : '❌';
        this.addLogMessage(`${resultIcon} ${payload.player} guessed ${payload.character} - ${payload.correct ? 'Correct!' : 'Wrong!'}`);
    }
    
    updateStats() {
        document.getElementById('questions-count').textContent = this.gameStats.questionsAsked;
        document.getElementById('guesses-count').textContent = this.gameStats.guessesMade;
        document.getElementById('turn-count').textContent = this.gameStats.turnCount;
    }
    
    handleLeftRoom(payload) {
        // Room left successfully - already handled in leaveRoom()
    }
    
    handleGameEnded(payload) {
        alert(`Game ended: ${payload.reason}`);
        this.leaveRoom();
    }
    
    handleError(payload) {
        alert(payload.message);
        
        // Re-enable room selection if there was an error joining/creating
        this.setRoomSelectionEnabled(true);
    }
    
    handleGameOver(payload) {
        document.getElementById('game-screen').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'block';
        
        const resultEl = document.getElementById('game-result');
        if (payload.winner === this.playerName) {
            resultEl.textContent = `🎉 You Won! The character was ${payload.character}`;
            resultEl.style.color = '#28a745';
        } else {
            resultEl.textContent = `😔 ${payload.winner} Won! The character was ${payload.character}`;
            resultEl.style.color = '#dc3545';
        }
    }
    
    addLogMessage(message) {
        const logEl = document.getElementById('log-messages');
        const messageEl = document.createElement('div');
        messageEl.className = 'log-message';
        messageEl.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        logEl.appendChild(messageEl);
        logEl.scrollTop = logEl.scrollHeight;
    }
    
    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
    }
}

// Global functions for HTML onclick handlers
let game;

function createRoom() {
    game.createRoom();
}

function joinRoom() {
    game.joinRoom();
}

function toggleReady() {
    game.toggleReady();
}

function startGame() {
    game.startGame();
}

function setUsername() {
    game.setUsername();
}

function changeUsername() {
    game.changeUsername();
}

function leaveRoom() {
    game.leaveRoom();
}

function endTurn() {
    game.endTurn();
}

function askQuestion() {
    game.askQuestion();
}

function toggleHelp() {
    const hints = document.getElementById('question-hints');
    const button = document.getElementById('toggle-help');
    
    if (hints.style.display === 'none') {
        hints.style.display = 'block';
        button.textContent = '🔼 Hide Question Hints';
    } else {
        hints.style.display = 'none';
        button.textContent = '💡 Show Question Hints';
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    game = new GuestQuestGame();
});