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
        this.eliminationHistory = [];
        this.eliminationRedoStack = [];
        this.turnTimer = null;
        this.timeRemaining = 0;
        this.currentQuestionId = null;
        
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
            
            // Also load full character data
            const fullDataResponse = await fetch('/api/characters');
            this.fullCharacterData = await fullDataResponse.json();
            
            console.log('Character sets loaded:', this.characterSets);
            console.log('Full character data loaded:', this.fullCharacterData);
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
        document.getElementById('current-username').textContent = username;
        
        // Show username in header
        document.getElementById('user-display').style.display = 'block';
        
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
            case 'turn_timeout':
                this.handleTurnTimeout(payload);
                break;
            case 'question_received':
                this.handleQuestionReceived(payload);
                break;
            case 'question_sent':
                this.handleQuestionSent(payload);
                break;
            case 'question_pending':
                this.handleQuestionPending(payload);
                break;
            case 'question_answered':
                this.handleQuestionAnswered(payload);
                break;
            case 'double_question_used':
                this.handleDoubleQuestionUsed(payload);
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
    
    copyRoomCode() {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(this.roomCode).then(() => {
                // Visual feedback
                const btn = document.getElementById('copy-room-code');
                const originalText = btn.textContent;
                btn.textContent = '✓';
                btn.style.background = '#28a745';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 1000);
            }).catch(() => {
                this.fallbackCopyRoomCode();
            });
        } else {
            this.fallbackCopyRoomCode();
        }
    }
    
    fallbackCopyRoomCode() {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = this.roomCode;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert(`Room code copied: ${this.roomCode}`);
        } catch (err) {
            alert(`Room code: ${this.roomCode}`);
        }
        document.body.removeChild(textArea);
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
        this.isMyTurn = payload.currentTurn === this.playerName;
        
        // Create unified board
        this.createUnifiedBoard();
        
        // Setup question hints
        this.setupQuestionHints();
        
        // Setup power-ups
        this.setupPowerUps();
        
        // Initialize turn controls
        this.updateTurnControls();
        
        // Start initial timer
        this.startTurnTimer(60);
        
        // Initialize attributes display
        this.updateAttributesDisplay();
        
        this.addLogMessage(`Game started! Your character is ${payload.yourCharacter.name} (${payload.characterSet} set)`);
    }
    
    displayCharacterDetails(character) {
        const detailsEl = document.getElementById('character-details');
        let details = [];
        
        // Simplified to 4 key attributes
        if (character.gender) details.push(`Gender: ${character.gender}`);
        if (character.age) details.push(`Age: ${character.age}`);
        if (character.location) details.push(`Location: ${character.location}`);
        if (character.hairColor) details.push(`Hair: ${character.hairColor}`);
        
        detailsEl.textContent = details.join(' • ');
        
        // Store full character for attributes display
        this.yourCharacterFull = character;
    }
    
    updateCharacterBoardAttributes() {
        if (!this.fullCharacterData || !this.characterSet) return;
        
        const characterSet = this.fullCharacterData[this.characterSet];
        if (!characterSet) return;
        
        const showAttributes = document.getElementById('show-attributes').checked;
        
        document.querySelectorAll('.unified-character').forEach(charEl => {
            const characterName = charEl.getAttribute('data-character');
            const character = characterSet.characters.find(c => c.name === characterName);
            
            if (!character) return;
            
            // Remove existing attributes
            const existingAttributes = charEl.querySelector('.character-attributes-overlay');
            if (existingAttributes) {
                existingAttributes.remove();
            }
            
            if (showAttributes) {
                // Add simplified attributes overlay
                const attributesOverlay = document.createElement('div');
                attributesOverlay.className = 'character-attributes-overlay';
                
                let attributesHtml = '<div class="character-attributes-content">';
                
                // Only show the 4 key attributes
                if (character.attributes.gender) {
                    attributesHtml += `<div class="attr-item">Gender: ${character.attributes.gender}</div>`;
                }
                if (character.attributes.age) {
                    attributesHtml += `<div class="attr-item">Age: ${character.attributes.age}</div>`;
                }
                if (character.attributes.location) {
                    attributesHtml += `<div class="attr-item">Location: ${character.attributes.location}</div>`;
                }
                if (character.attributes.hairColor) {
                    attributesHtml += `<div class="attr-item">Hair: ${character.attributes.hairColor}</div>`;
                }
                
                attributesHtml += '</div>';
                attributesOverlay.innerHTML = attributesHtml;
                
                charEl.appendChild(attributesOverlay);
            }
        });
    }
    
    formatAttributeName(key) {
        // Convert camelCase to readable format
        return key.replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .replace('Has Glasses', 'Glasses')
                  .replace('Hair Color', 'Hair');
    }
    
    toggleAttributes() {
        this.updateCharacterBoardAttributes();
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
    
    createEliminationBoard() {
        const eliminationBoard = document.getElementById('elimination-board');
        eliminationBoard.innerHTML = '';
        
        this.characters.forEach(character => {
            const charEl = document.createElement('div');
            charEl.className = 'elimination-character';
            charEl.setAttribute('data-character', character.name);
            charEl.onclick = () => this.toggleElimination(character.name);
            
            charEl.innerHTML = `
                <img src="${character.image}" alt="${character.name}" class="elimination-image" 
                     onerror="this.src='/images/characters/user.png'">
                <div class="elimination-name">${character.name}</div>
                <div class="elimination-overlay">❌</div>
            `;
            
            eliminationBoard.appendChild(charEl);
        });
    }
    
    toggleElimination(characterName) {
        const charEl = document.querySelector(`[data-character="${characterName}"]`);
        if (!charEl) return;
        
        if (this.eliminatedCharacters.has(characterName)) {
            this.eliminatedCharacters.delete(characterName);
            charEl.classList.remove('eliminated');
        } else {
            this.eliminatedCharacters.add(characterName);
            charEl.classList.add('eliminated');
        }
    }
    
    createUnifiedBoard() {
        const unifiedBoard = document.getElementById('unified-board');
        unifiedBoard.innerHTML = '';
        
        this.characters.forEach(character => {
            const charEl = document.createElement('div');
            charEl.className = 'unified-character';
            charEl.setAttribute('data-character', character.name);
            
            // Left click for guess, right click for elimination
            charEl.onclick = (e) => {
                e.preventDefault();
                this.makeGuess(character.name);
            };
            
            charEl.oncontextmenu = (e) => {
                e.preventDefault();
                this.toggleElimination(character.name);
            };
            
            charEl.innerHTML = `
                <img src="${character.image}" alt="${character.name}" class="character-image" 
                     onerror="this.src='/images/characters/user.png'">
                <div class="character-name">${character.name}</div>
                <div class="elimination-overlay">❌</div>
            `;
            
            unifiedBoard.appendChild(charEl);
        });
        
        // Initialize attributes display
        this.updateCharacterBoardAttributes();
    }
    
    toggleElimination(characterName) {
        const charEl = document.querySelector(`[data-character="${characterName}"]`);
        if (!charEl) return;
        
        // Save state for undo
        this.eliminationHistory.push(new Set(this.eliminatedCharacters));
        this.eliminationRedoStack = []; // Clear redo stack
        
        if (this.eliminatedCharacters.has(characterName)) {
            this.eliminatedCharacters.delete(characterName);
            charEl.classList.remove('eliminated');
        } else {
            this.eliminatedCharacters.add(characterName);
            charEl.classList.add('eliminated');
        }
        
        this.updateEliminationVisibility();
    }
    
    updateEliminationVisibility() {
        const showEliminations = document.getElementById('show-eliminations').checked;
        document.querySelectorAll('.unified-character.eliminated').forEach(el => {
            el.style.display = showEliminations ? 'flex' : 'none';
        });
    }
    
    undoElimination() {
        if (this.eliminationHistory.length === 0) return;
        
        // Save current state for redo
        this.eliminationRedoStack.push(new Set(this.eliminatedCharacters));
        
        // Restore previous state
        this.eliminatedCharacters = this.eliminationHistory.pop();
        
        // Update UI
        document.querySelectorAll('.unified-character').forEach(el => {
            const characterName = el.getAttribute('data-character');
            if (this.eliminatedCharacters.has(characterName)) {
                el.classList.add('eliminated');
            } else {
                el.classList.remove('eliminated');
            }
        });
        
        this.updateEliminationVisibility();
    }
    
    redoElimination() {
        if (this.eliminationRedoStack.length === 0) return;
        
        // Save current state for undo
        this.eliminationHistory.push(new Set(this.eliminatedCharacters));
        
        // Restore redo state
        this.eliminatedCharacters = this.eliminationRedoStack.pop();
        
        // Update UI
        document.querySelectorAll('.unified-character').forEach(el => {
            const characterName = el.getAttribute('data-character');
            if (this.eliminatedCharacters.has(characterName)) {
                el.classList.add('eliminated');
            } else {
                el.classList.remove('eliminated');
            }
        });
        
        this.updateEliminationVisibility();
    }
    
    resetBoard() {
        if (confirm('Reset all eliminations?')) {
            // Save state for undo
            this.eliminationHistory.push(new Set(this.eliminatedCharacters));
            this.eliminationRedoStack = [];
            
            this.eliminatedCharacters.clear();
            document.querySelectorAll('.unified-character').forEach(el => {
                el.classList.remove('eliminated');
            });
            
            this.updateEliminationVisibility();
        }
    }
    
    createCharacterButtons() {
        const charactersEl = document.getElementById('characters-list');
        charactersEl.innerHTML = '';
        
        this.characters.forEach(character => {
            const btn = document.createElement('div');
            btn.className = 'character-btn';
            btn.onclick = () => this.makeGuess(character.name);
            
            btn.innerHTML = `
                <img src="${character.image}" alt="${character.name}" class="character-image" 
                     onerror="this.src='/images/characters/user.png'">
                <div class="character-name">${character.name}</div>
            `;
            
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
        
        // Start turn timer
        this.startTurnTimer(payload.timeRemaining || 60);
        
        // Visual feedback for turn change
        const turnEl = document.getElementById('current-turn');
        if (this.isMyTurn) {
            turnEl.style.background = '#d4edda';
            turnEl.style.color = '#155724';
            this.addLogMessage('🎯 It\'s your turn! (60 seconds)');
        } else {
            turnEl.style.background = '#f8d7da';
            turnEl.style.color = '#721c24';
        }
    }
    
    startTurnTimer(seconds) {
        // Clear existing timer
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
        }
        
        this.timeRemaining = seconds;
        this.updateTimerDisplay();
        
        this.turnTimer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                clearInterval(this.turnTimer);
                this.turnTimer = null;
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        const timerEl = document.getElementById('turn-timer');
        if (timerEl) {
            timerEl.textContent = `${this.timeRemaining}s`;
            
            // Change color based on time remaining
            if (this.timeRemaining <= 10) {
                timerEl.style.color = '#dc3545';
                timerEl.style.fontWeight = 'bold';
            } else if (this.timeRemaining <= 30) {
                timerEl.style.color = '#fd7e14';
                timerEl.style.fontWeight = 'bold';
            } else {
                timerEl.style.color = '#28a745';
                timerEl.style.fontWeight = 'normal';
            }
        }
    }
    
    handleTurnChanged(payload) {
        document.getElementById('turn-player').textContent = payload.currentTurn;
        
        this.gameStats.turnCount++;
        this.updateStats();
        
        this.isMyTurn = payload.currentTurn === this.playerName;
        this.updateTurnControls();
        
        // Start turn timer
        this.startTurnTimer(payload.timeRemaining || 60);
        
        // Visual feedback for turn change
        const turnEl = document.getElementById('current-turn');
        if (this.isMyTurn) {
            turnEl.style.background = '#d4edda';
            turnEl.style.color = '#155724';
            this.addLogMessage('🎯 It\'s your turn! (60 seconds)');
        } else {
            turnEl.style.background = '#f8d7da';
            turnEl.style.color = '#721c24';
        }
    }
    
    handleTurnTimeout(payload) {
        this.addLogMessage(`⏰ ${payload.player}'s turn ended due to timeout`);
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    }
    
    handleQuestionReceived(payload) {
        this.currentQuestionId = payload.questionId;
        
        // Show question modal
        document.getElementById('asking-player-name').textContent = payload.askingPlayer;
        document.getElementById('modal-question').textContent = payload.question;
        document.getElementById('question-modal').style.display = 'flex';
        document.getElementById('floating-question-btn').style.display = 'none';
        
        // Focus on custom answer input
        document.getElementById('answer-input').focus();
        
        // Add enter key handler for custom answer
        document.getElementById('answer-input').onkeypress = (e) => {
            if (e.key === 'Enter') {
                this.answerCustom();
            }
        };
    }
    
    handleQuestionSent(payload) {
        this.addLogMessage(`❓ You asked ${payload.targetPlayer}: "${payload.question}" - Waiting for answer...`);
    }
    
    handleQuestionPending(payload) {
        if (payload.askingPlayer !== this.playerName && payload.targetPlayer !== this.playerName) {
            this.addLogMessage(`❓ ${payload.askingPlayer} asked ${payload.targetPlayer}: "${payload.question}" - Waiting for answer...`);
        }
    }
    
    handleQuestionAnswered(payload) {
        // Hide modal and floating button
        document.getElementById('question-modal').style.display = 'none';
        document.getElementById('floating-question-btn').style.display = 'none';
        
        // Add to log
        this.addLogMessage(`❓ ${payload.askingPlayer} asked: "${payload.question}" - ${payload.targetPlayer} answered: "${payload.answer}"`);
        
        // Update stats
        this.gameStats.questionsAsked++;
        this.updateStats();
    }
    
    hideQuestionModal() {
        document.getElementById('question-modal').style.display = 'none';
        document.getElementById('floating-question-btn').style.display = 'block';
    }
    
    showQuestionModal() {
        document.getElementById('question-modal').style.display = 'flex';
        document.getElementById('floating-question-btn').style.display = 'none';
        document.getElementById('answer-input').focus();
    }
    
    answerQuestion(answer) {
        if (!this.currentQuestionId) return;
        
        this.send('answer_question', {
            answer: answer,
            questionId: this.currentQuestionId
        });
        
        // Hide modal
        document.getElementById('question-modal').style.display = 'none';
        this.currentQuestionId = null;
    }
    
    answerCustom() {
        const customAnswer = document.getElementById('answer-input').value.trim();
        if (!customAnswer) {
            alert('Please enter an answer');
            return;
        }
        
        this.answerQuestion(customAnswer);
        document.getElementById('answer-input').value = '';
    }
    
    handleDoubleQuestionUsed(payload) {
        this.addLogMessage(`🎯 ${payload.player} used Double Question power-up - ${payload.message}`);
    }
    
    startTurnTimer(seconds) {
        // Clear existing timer
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
        }
        
        this.timeRemaining = seconds;
        this.updateTimerDisplay();
        
        this.turnTimer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                clearInterval(this.turnTimer);
                this.turnTimer = null;
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        const timerEl = document.getElementById('turn-timer');
        if (timerEl) {
            timerEl.textContent = `${this.timeRemaining}s`;
            
            // Change color based on time remaining
            if (this.timeRemaining <= 10) {
                timerEl.style.color = '#dc3545';
                timerEl.style.fontWeight = 'bold';
            } else if (this.timeRemaining <= 30) {
                timerEl.style.color = '#fd7e14';
                timerEl.style.fontWeight = 'bold';
            } else {
                timerEl.style.color = '#28a745';
                timerEl.style.fontWeight = 'normal';
            }
        }
    }
    
    updateTurnControls() {
        // Update all turn-based controls
        document.getElementById('question-input').disabled = !this.isMyTurn;
        document.getElementById('ask-btn').disabled = !this.isMyTurn;
        document.getElementById('end-turn-btn').disabled = !this.isMyTurn;
        
        const characterBtns = document.querySelectorAll('.unified-character');
        characterBtns.forEach(btn => {
            if (!this.isMyTurn) {
                btn.classList.add('disabled');
                btn.style.pointerEvents = 'none';
            } else {
                btn.classList.remove('disabled');
                btn.style.pointerEvents = 'auto';
            }
        });
        
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

function copyRoomCode() {
    game.copyRoomCode();
}

function endTurn() {
    game.endTurn();
}

function askQuestion() {
    game.askQuestion();
}

function showTab(tabName) {
    // Hide all tab contents
    document.getElementById('guess-content').style.display = 'none';
    document.getElementById('eliminate-content').style.display = 'none';
    
    // Remove active class from all tabs
    document.getElementById('guess-tab').classList.remove('active');
    document.getElementById('eliminate-tab').classList.remove('active');
    
    // Show selected tab content and mark tab as active
    if (tabName === 'guess') {
        document.getElementById('guess-content').style.display = 'block';
        document.getElementById('guess-tab').classList.add('active');
    } else if (tabName === 'eliminate') {
        document.getElementById('eliminate-content').style.display = 'block';
        document.getElementById('eliminate-tab').classList.add('active');
    }
}

function toggleEliminations() {
    game.updateEliminationVisibility();
}

function undoElimination() {
    game.undoElimination();
}

function redoElimination() {
    game.redoElimination();
}

function resetBoard() {
    game.resetBoard();
}

function answerQuestion(answer) {
    game.answerQuestion(answer);
}

function answerCustom() {
    game.answerCustom();
}

function toggleAttributes() {
    game.toggleAttributes();
}

function hideQuestionModal() {
    game.hideQuestionModal();
}

function showQuestionModal() {
    game.showQuestionModal();
}

function toggleCharacterCard(characterId) {
    const attrsEl = document.getElementById(`attrs-${characterId}`);
    const iconEl = document.getElementById(`icon-${characterId}`);
    
    if (attrsEl.style.display === 'none') {
        attrsEl.style.display = 'grid';
        iconEl.classList.add('expanded');
    } else {
        attrsEl.style.display = 'none';
        iconEl.classList.remove('expanded');
    }
}

function collapseAllAttributes() {
    document.querySelectorAll('.character-attributes-grid').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('.expand-icon').forEach(el => {
        el.classList.remove('expanded');
    });
}

function expandAllAttributes() {
    document.querySelectorAll('.character-attributes-grid').forEach(el => {
        el.style.display = 'grid';
    });
    document.querySelectorAll('.expand-icon').forEach(el => {
        el.classList.add('expanded');
    });
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