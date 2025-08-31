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
        this.turnState = {
            questionAsked: false,
            doubleQuestionActive: false,
            doubleQuestionUsed: false,
            questionsAskedCount: 0
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
        this.isRoomCreator = false;
        this.currentCharacterSet = 'classic';
        this.playerStats = this.loadPlayerStats();
        this.gameStartTime = null;
        this.questionsAskedThisGame = 0;
        
        this.init();
    }
    
    init() {
        this.connect();
        this.setupEventListeners();
        this.loadCharacterSets();
        this.generateRandomUsername();
    }
    
    generateRandomUsername() {
        const seaCreatures = [
            'Squid', 'Starfish', 'Octopus', 'Jellyfish', 'Seahorse', 'Dolphin', 
            'Whale', 'Shark', 'Crab', 'Lobster', 'Shrimp', 'Turtle', 'Seal', 
            'Otter', 'Manta', 'Coral', 'Anemone', 'Urchin', 'Clam', 'Oyster',
            'Barracuda', 'Angelfish', 'Clownfish', 'Pufferfish', 'Swordfish',
            'Stingray', 'Moray', 'Grouper', 'Flounder', 'Marlin'
        ];
        
        const randomName = seaCreatures[Math.floor(Math.random() * seaCreatures.length)];
        const randomNumber = Math.floor(Math.random() * 999) + 1;
        
        this.playerName = `${randomName}${randomNumber}`;
        document.getElementById('player-name').value = this.playerName;
        document.getElementById('display-username').textContent = this.playerName;
        document.getElementById('current-username').textContent = this.playerName;
        
        // Show username in header
        document.getElementById('user-display').style.display = 'block';
        
        // Show username screen briefly with auto-generated name, then auto-continue after 2 seconds
        document.getElementById('username-screen').style.display = 'block';
        
        // Auto-continue after 2 seconds unless user interacts
        this.autoAdvanceTimer = setTimeout(() => {
            this.setUsername();
        }, 2000);
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
            
            // Populate character set dropdown
            this.populateCharacterSetDropdown();
        } catch (error) {
            console.error('Failed to load character sets:', error);
        }
    }
    
    populateCharacterSetDropdown() {
        const dropdown = document.getElementById('character-set-select');
        if (!dropdown) return;
        
        // Clear existing options
        dropdown.innerHTML = '';
        
        // Add options for each character set
        Object.keys(this.fullCharacterData).forEach(setId => {
            const characterSet = this.fullCharacterData[setId];
            const option = document.createElement('option');
            option.value = setId;
            option.textContent = characterSet.setName;
            dropdown.appendChild(option);
        });
        
        // Set default to classic if available
        if (this.fullCharacterData.classic) {
            dropdown.value = 'classic';
        }
        
        console.log('Character set dropdown populated with', Object.keys(this.fullCharacterData).length, 'sets');
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
            
            // Cancel auto-advance if user starts typing
            if (this.autoAdvanceTimer) {
                clearTimeout(this.autoAdvanceTimer);
                this.autoAdvanceTimer = null;
            }
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
        // Clear auto-advance timer if it exists
        if (this.autoAdvanceTimer) {
            clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
        
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
    
    generateNewUsername() {
        // Clear auto-advance timer
        if (this.autoAdvanceTimer) {
            clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
        
        // Generate new random username
        const seaCreatures = [
            'Squid', 'Starfish', 'Octopus', 'Jellyfish', 'Seahorse', 'Dolphin', 
            'Whale', 'Shark', 'Crab', 'Lobster', 'Shrimp', 'Turtle', 'Seal', 
            'Otter', 'Manta', 'Coral', 'Anemone', 'Urchin', 'Clam', 'Oyster',
            'Barracuda', 'Angelfish', 'Clownfish', 'Pufferfish', 'Swordfish',
            'Stingray', 'Moray', 'Grouper', 'Flounder', 'Marlin'
        ];
        
        const randomName = seaCreatures[Math.floor(Math.random() * seaCreatures.length)];
        const randomNumber = Math.floor(Math.random() * 999) + 1;
        
        const newUsername = `${randomName}${randomNumber}`;
        document.getElementById('player-name').value = newUsername;
        
        // Restart auto-advance timer
        this.autoAdvanceTimer = setTimeout(() => {
            this.setUsername();
        }, 2000);
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
            case 'timer_sync':
                this.handleTimerSync(payload);
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
            case 'character_set_changed':
                this.handleCharacterSetChanged(payload);
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
        this.isRoomCreator = true; // Mark as room creator
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
        
        // Show character set selection for room creator
        this.updateCharacterSetSelection();
    }
    
    updateCharacterSetSelection() {
        const characterSetSection = document.getElementById('lobby-character-set-selection');
        
        if (this.isRoomCreator && this.fullCharacterData) {
            characterSetSection.style.display = 'block';
            
            // Populate lobby character set dropdown
            const dropdown = document.getElementById('lobby-character-set-select');
            dropdown.innerHTML = '';
            
            Object.keys(this.fullCharacterData).forEach(setId => {
                const characterSet = this.fullCharacterData[setId];
                const option = document.createElement('option');
                option.value = setId;
                option.textContent = characterSet.setName;
                dropdown.appendChild(option);
            });
            
            // Set current selection
            dropdown.value = this.currentCharacterSet;
            this.updateCharacterSetInfo();
        } else {
            characterSetSection.style.display = 'none';
        }
    }
    
    updateCharacterSetInfo() {
        const infoEl = document.getElementById('character-set-info');
        const dropdown = document.getElementById('lobby-character-set-select');
        const selectedSet = dropdown.value;
        
        if (selectedSet && this.fullCharacterData[selectedSet]) {
            const characterSet = this.fullCharacterData[selectedSet];
            infoEl.innerHTML = `
                <p><strong>${characterSet.setName}</strong></p>
                <p>${characterSet.description}</p>
                <p>Characters: ${characterSet.characters.length}</p>
            `;
        } else {
            infoEl.innerHTML = '<p>Select a character set to see details</p>';
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
        
        // Initialize game tracking for statistics
        this.gameStartTime = Date.now();
        this.questionsAskedThisGame = 0;
        this.currentCharacterSet = payload.characterSet;
        
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
        this.startTurnTimer(payload.timeRemaining || 60);
        
        // Initialize attributes display
        this.updateAttributesDisplay();
        
        this.addLogMessage(`Game started! Your character is ${payload.yourCharacter.name} (${payload.characterSet} set)`);
    }
    
    displayCharacterDetails(character) {
        const detailsEl = document.getElementById('character-details');
        let details = [];
        
        // Dynamically show all character attributes
        if (character.attributes) {
            Object.keys(character.attributes).forEach(key => {
                const value = character.attributes[key];
                if (value !== undefined && value !== null && value !== '') {
                    const displayName = this.formatAttributeName(key);
                    const displayValue = this.formatAttributeValue(value);
                    details.push(`${displayName}: ${displayValue}`);
                }
            });
        } else {
            // Fallback for legacy character format
            if (character.gender) details.push(`Gender: ${character.gender}`);
            if (character.age) details.push(`Age: ${character.age}`);
            if (character.location) details.push(`Location: ${character.location}`);
            if (character.hairColor) details.push(`Hair: ${character.hairColor}`);
        }
        
        detailsEl.textContent = details.join(' • ');
        
        // Display character image
        const characterImageEl = document.getElementById('character-image');
        if (character.image) {
            characterImageEl.src = character.image;
            characterImageEl.style.display = 'block';
            characterImageEl.onerror = function() {
                this.src = '/images/characters/user.png';
            };
        }
        
        // Store full character for attributes display
        this.yourCharacterFull = character;
    }
    
    formatAttributeValue(value) {
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (typeof value === 'string') {
            // Convert snake_case and camelCase to readable format
            return value.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
                       .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        return String(value);
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
                // Add dynamic attributes overlay
                const attributesOverlay = document.createElement('div');
                attributesOverlay.className = 'character-attributes-overlay';
                
                let attributesHtml = '<div class="character-attributes-content">';
                
                // Show all character attributes dynamically
                if (character.attributes) {
                    Object.keys(character.attributes).forEach(key => {
                        const value = character.attributes[key];
                        if (value !== undefined && value !== null && value !== '') {
                            const displayName = this.formatAttributeName(key);
                            const displayValue = this.formatAttributeValue(value);
                            attributesHtml += `<div class="attr-item">${displayName}: ${displayValue}</div>`;
                        }
                    });
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
        
        if (!this.fullCharacterData || !this.characterSet || !this.fullCharacterData[this.characterSet]) {
            hintContent.innerHTML = '<div class="hint-category"><strong>Loading hints...</strong></div>';
            return;
        }
        
        const characterSet = this.fullCharacterData[this.characterSet];
        const characters = characterSet.characters;
        
        if (!characters || characters.length === 0) {
            hintContent.innerHTML = '<div class="hint-category"><strong>No characters found</strong></div>';
            return;
        }
        
        // Analyze attributes from the character set
        const attributeAnalysis = this.analyzeCharacterAttributes(characters);
        
        let hints = '';
        
        Object.keys(attributeAnalysis).forEach(attributeName => {
            const analysis = attributeAnalysis[attributeName];
            const displayName = this.formatAttributeName(attributeName);
            
            hints += `<div class="hint-category">`;
            hints += `<strong>${displayName}:</strong>`;
            hints += `<div class="hint-examples">`;
            
            if (analysis.type === 'boolean') {
                hints += `"Do they have ${displayName.toLowerCase()}?" "Are they ${attributeName}?"`;
            } else if (analysis.type === 'categorical') {
                const examples = analysis.values.slice(0, 3).map(value => 
                    `"Are they ${value}?"`
                ).join(' ');
                hints += examples;
            } else {
                hints += `"What is their ${displayName.toLowerCase()}?"`;
            }
            
            hints += `</div></div>`;
        });
        
        if (hints === '') {
            hints = '<div class="hint-category"><strong>Ask yes/no questions about the character attributes!</strong></div>';
        }
        
        hintContent.innerHTML = hints;
    }
    
    analyzeCharacterAttributes(characters) {
        const attributeAnalysis = {};
        
        // Get all unique attributes
        const allAttributes = new Set();
        characters.forEach(char => {
            Object.keys(char.attributes).forEach(attr => allAttributes.add(attr));
        });
        
        // Analyze each attribute
        allAttributes.forEach(attributeName => {
            const values = characters.map(char => char.attributes[attributeName]).filter(v => v !== undefined);
            const uniqueValues = [...new Set(values)];
            
            let type = 'text';
            if (uniqueValues.length <= 2 && uniqueValues.every(v => typeof v === 'boolean' || v === 'true' || v === 'false')) {
                type = 'boolean';
            } else if (uniqueValues.length <= 8 && uniqueValues.every(v => typeof v === 'string' || typeof v === 'number')) {
                type = 'categorical';
            }
            
            attributeAnalysis[attributeName] = {
                type: type,
                values: uniqueValues,
                count: uniqueValues.length
            };
        });
        
        return attributeAnalysis;
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
            
            // Track power-up usage statistics
            if (this.playerStats.powerUpsUsed[powerUpId] !== undefined) {
                this.playerStats.powerUpsUsed[powerUpId]++;
                this.savePlayerStats();
            }
        }
    }
    
    handlePowerUpUsed(payload) {
        const { player, powerUpName, result } = payload;
        
        let message = `🎯 ${player} used ${powerUpName}!`;
        
        if (result.type === 'reveal_attribute') {
            message += ` Revealed: ${result.attribute} = ${result.value}`;
            this.addLogMessage(message);
            
            // Show reveal attribute popup
            this.showRevealAttributeModal(player, result.attribute, result.value);
        } else if (result.type === 'elimination_hint') {
            message += ` Eliminated: ${result.eliminatedCharacters.join(', ')}`;
            this.addLogMessage(message);
            
            // Show elimination hint popup
            this.showEliminationHintModal(player, result.eliminatedCharacters);
            
            // Save state for undo before auto-eliminating
            this.eliminationHistory.push(new Set(this.eliminatedCharacters));
            this.eliminationRedoStack = []; // Clear redo stack
            
            // Auto-mark characters as eliminated
            result.eliminatedCharacters.forEach(characterName => {
                this.eliminatedCharacters.add(characterName);
                const charEl = document.querySelector(`[data-character="${characterName}"]`);
                if (charEl) {
                    charEl.classList.add('eliminated');
                }
            });
            
            // Update elimination visibility
            this.updateEliminationVisibility();
        } else if (result.type === 'category_scan') {
            message += ` Categories revealed!`;
            this.addLogMessage(message);
        } else if (result.type === 'double_question') {
            message += ` ${result.message || ''}`;
            this.addLogMessage(message);
            
            // Update turn state for double question
            if (player === this.playerName) {
                this.turnState.doubleQuestionUsed = true;
                this.turnState.doubleQuestionActive = true;
                this.turnState.questionAsked = false; // Reset so they can ask questions
                this.turnState.questionsAskedCount = 0; // Reset question count
                this.updateTurnControls();
            }
        } else {
            message += ` ${result.message || ''}`;
            this.addLogMessage(message);
        }
    }
    
    showEliminationHintModal(player, eliminatedCharacters) {
        document.getElementById('elimination-hint-player').textContent = player;
        
        const eliminatedList = document.getElementById('eliminated-characters-list');
        eliminatedList.innerHTML = eliminatedCharacters.map(name => 
            `<div class="eliminated-character-item">❌ ${name}</div>`
        ).join('');
        
        document.getElementById('elimination-hint-modal').style.display = 'flex';
    }
    
    showRevealAttributeModal(player, attribute, value) {
        document.getElementById('reveal-attribute-player').textContent = player;
        document.getElementById('revealed-attribute-name').textContent = this.formatAttributeName(attribute) + ':';
        document.getElementById('revealed-attribute-value').textContent = this.formatAttributeValue(value);
        
        document.getElementById('reveal-attribute-modal').style.display = 'flex';
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
        
        // Debug logging
        console.log('Turn state before asking:', this.turnState);
        
        // Check if we can ask a question
        if (this.turnState.doubleQuestionUsed) {
            // In double question mode - can ask up to 2 questions
            if (this.turnState.questionsAskedCount >= 2) {
                alert('You have already asked both questions from your Double Question power-up!');
                return;
            }
        } else {
            // Normal mode - can only ask 1 question
            if (this.turnState.questionAsked) {
                alert('You can only ask one question per turn!');
                return;
            }
        }
        
        // Disable controls immediately to prevent multiple clicks
        this.setQuestionControlsEnabled(false);
        
        this.send('ask_question', { question });
        questionInput.value = '';
        
        // Update turn state - let server handle the actual logic
        this.turnState.questionsAskedCount++;
        
        // Track statistics
        this.questionsAskedThisGame++;
        
        console.log(`Question sent. Count: ${this.turnState.questionsAskedCount}, Double question used: ${this.turnState.doubleQuestionUsed}`);
        console.log('Turn state after asking:', this.turnState);
    }
    
    handleQuestionAsked(payload) {
        this.gameStats.questionsAsked++;
        this.updateStats();
        
        const intelligentIcon = payload.wasIntelligent ? '🧠' : '🎲';
        this.addLogMessage(`${intelligentIcon} ${payload.player} asked: "${payload.question}" - Answer: ${payload.answer}`);
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
        
        // Re-enable controls for the asking player after answer is received
        if (payload.askingPlayer === this.playerName) {
            this.setQuestionControlsEnabled(true);
            
            // Don't update turn controls here - let server messages handle state changes
            // The server will send either 'double_question_used' or 'turn_changed' messages
        }
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
    
    handleTurnChanged(payload) {
        document.getElementById('turn-player').textContent = payload.currentTurn;
        
        this.gameStats.turnCount++;
        this.updateStats();
        
        this.isMyTurn = payload.currentTurn === this.playerName;
        
        // Reset turn state for new turn
        this.turnState = {
            questionAsked: false,
            doubleQuestionActive: false,
            doubleQuestionUsed: false,
            questionsAskedCount: 0
        };
        
        // Re-enable controls for new turn
        this.setQuestionControlsEnabled(true);
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
    
    handleTimerSync(payload) {
        // Update timer from server to keep all clients in sync
        this.timeRemaining = payload.timeRemaining;
        this.updateTimerDisplay();
        
        // Ensure we're showing the correct current turn
        if (payload.currentTurn) {
            document.getElementById('turn-player').textContent = payload.currentTurn;
        }
    }
    
    handleDoubleQuestionUsed(payload) {
        this.addLogMessage(`🎯 ${payload.player} - ${payload.message}`);
        
        // Update turn state for double question - this message comes after each question in double question mode
        if (payload.player === this.playerName) {
            // Keep double question active so they can ask another question
            this.turnState.doubleQuestionActive = true;
            this.turnState.questionAsked = false; // Reset so they can ask another question
            this.updateTurnControls();
        }
    }
    
    startTurnTimer(seconds) {
        // Clear existing timer - we'll rely on server sync instead of local countdown
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        
        this.timeRemaining = seconds;
        
        // Make sure timer element exists
        const timerEl = document.getElementById('turn-timer');
        if (!timerEl) {
            console.error('Timer element not found! Creating fallback timer display.');
            // Try to find the turn display element and add timer there
            const turnEl = document.getElementById('current-turn');
            if (turnEl) {
                const existingTimer = turnEl.querySelector('.timer-display');
                if (existingTimer) {
                    existingTimer.remove();
                }
                const timerSpan = document.createElement('span');
                timerSpan.id = 'turn-timer';
                timerSpan.className = 'timer-display';
                timerSpan.style.marginLeft = '10px';
                timerSpan.style.padding = '2px 8px';
                timerSpan.style.borderRadius = '4px';
                timerSpan.style.fontSize = '14px';
                timerSpan.style.fontWeight = 'bold';
                turnEl.appendChild(timerSpan);
            } else {
                console.error('Could not find turn element either!');
                return;
            }
        }
        
        // Initial display update
        this.updateTimerDisplay();
        
        console.log(`Timer initialized: ${seconds} seconds - relying on server sync`);
    }
    
    updateTimerDisplay() {
        const timerEl = document.getElementById('turn-timer');
        if (timerEl && this.timeRemaining >= 0) {
            timerEl.textContent = `[${this.timeRemaining}s]`;
            
            // Ensure the timer is visible with proper styling
            timerEl.style.display = 'inline-block';
            timerEl.style.padding = '4px 8px';
            timerEl.style.borderRadius = '4px';
            timerEl.style.marginLeft = '10px';
            timerEl.style.fontSize = '14px';
            timerEl.style.fontWeight = 'bold';
            timerEl.style.border = '1px solid #ccc';
            
            // Change background color based on time remaining
            if (this.timeRemaining <= 10) {
                timerEl.style.backgroundColor = '#dc3545';
                timerEl.style.color = 'white';
                timerEl.style.borderColor = '#dc3545';
            } else if (this.timeRemaining <= 30) {
                timerEl.style.backgroundColor = '#fd7e14';
                timerEl.style.color = 'white';
                timerEl.style.borderColor = '#fd7e14';
            } else {
                timerEl.style.backgroundColor = '#28a745';
                timerEl.style.color = 'white';
                timerEl.style.borderColor = '#28a745';
            }
            
            console.log(`Timer updated: ${this.timeRemaining}s - Element visible:`, timerEl.offsetWidth > 0);
        } else {
            console.error('Timer element not found or invalid time remaining:', this.timeRemaining);
        }
    }

    
    setQuestionControlsEnabled(enabled) {
        const questionInput = document.getElementById('question-input');
        const askBtn = document.getElementById('ask-btn');
        const endTurnBtn = document.getElementById('end-turn-btn');
        
        if (questionInput) questionInput.disabled = !enabled;
        if (askBtn) askBtn.disabled = !enabled;
        if (endTurnBtn) endTurnBtn.disabled = !enabled;
    }
    
    updateTurnControls() {
        // Update all turn-based controls
        let canAskQuestion = false;
        
        if (this.isMyTurn) {
            if (this.turnState.doubleQuestionUsed) {
                // In double question mode - can ask if haven't asked 2 questions yet
                canAskQuestion = this.turnState.questionsAskedCount < 2;
            } else {
                // Normal mode - can ask if haven't asked any question yet
                canAskQuestion = !this.turnState.questionAsked;
            }
        }
        
        const canGuess = this.isMyTurn && !this.turnState.doubleQuestionUsed; // No guessing during double question turn
        
        console.log('Turn controls update:', {
            isMyTurn: this.isMyTurn,
            canAskQuestion,
            canGuess,
            turnState: this.turnState
        });
        
        document.getElementById('question-input').disabled = !canAskQuestion;
        document.getElementById('ask-btn').disabled = !canAskQuestion;
        document.getElementById('end-turn-btn').disabled = !this.isMyTurn;
        
        const characterBtns = document.querySelectorAll('.unified-character');
        characterBtns.forEach(btn => {
            if (!canGuess) {
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
        // Close all open modals to prevent blocking the game over screen
        this.closeAllModals();
        
        // Clear any active timers
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        
        document.getElementById('game-screen').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'block';
        
        const resultEl = document.getElementById('game-result');
        const isWinner = payload.winner === this.playerName;
        
        if (isWinner) {
            resultEl.textContent = `🎉 You Won! The character was ${payload.character}`;
            resultEl.style.color = '#28a745';
        } else {
            resultEl.textContent = `😔 ${payload.winner} Won! The character was ${payload.character}`;
            resultEl.style.color = '#dc3545';
        }
        
        // Calculate game time and update statistics
        const gameTimeSeconds = this.gameStartTime ? Math.round((Date.now() - this.gameStartTime) / 1000) : 0;
        this.updateGameStats(isWinner, gameTimeSeconds);
        
        // Display statistics
        this.displayGameStats();
    }
    
    closeAllModals() {
        // Close all possible modals that could be open
        const modals = [
            'question-modal',
            'elimination-hint-modal', 
            'reveal-attribute-modal'
        ];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
            }
        });
        
        // Hide floating button too
        const floatingBtn = document.getElementById('floating-question-btn');
        if (floatingBtn) {
            floatingBtn.style.display = 'none';
        }
        
        console.log('🔒 All modals closed for game end');
    }
    
    addLogMessage(message) {
        const logEl = document.getElementById('log-messages');
        const messageEl = document.createElement('div');
        messageEl.className = 'log-message';
        messageEl.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        logEl.appendChild(messageEl);
        logEl.scrollTop = logEl.scrollHeight;
    }
    
    // Statistics system methods
    loadPlayerStats() {
        const saved = localStorage.getItem('guestquest_stats');
        return saved ? JSON.parse(saved) : {
            gamesPlayed: 0,
            gamesWon: 0,
            totalQuestionsAsked: 0,
            totalGameTime: 0, // in seconds
            favoriteCharacterSet: null,
            achievements: [],
            winStreak: 0,
            bestWinStreak: 0,
            averageQuestionsPerGame: 0,
            averageGameTime: 0,
            powerUpsUsed: {
                reveal_attribute: 0,
                double_question: 0,
                elimination_hint: 0
            },
            characterSetStats: {},
            firstGameDate: null,
            lastGameDate: null
        };
    }
    
    savePlayerStats() {
        // Calculate averages before saving
        if (this.playerStats.gamesPlayed > 0) {
            this.playerStats.averageQuestionsPerGame = 
                Math.round((this.playerStats.totalQuestionsAsked / this.playerStats.gamesPlayed) * 10) / 10;
            this.playerStats.averageGameTime = 
                Math.round((this.playerStats.totalGameTime / this.playerStats.gamesPlayed) * 10) / 10;
        }
        
        localStorage.setItem('guestquest_stats', JSON.stringify(this.playerStats));
        console.log('📊 Player stats saved:', this.playerStats);
    }
    
    updateGameStats(isWinner, gameTimeSeconds) {
        const now = new Date().toISOString();
        
        // First time playing
        if (!this.playerStats.firstGameDate) {
            this.playerStats.firstGameDate = now;
        }
        this.playerStats.lastGameDate = now;
        
        // Basic game stats
        this.playerStats.gamesPlayed++;
        this.playerStats.totalQuestionsAsked += this.questionsAskedThisGame;
        this.playerStats.totalGameTime += gameTimeSeconds;
        
        // Win/loss tracking
        if (isWinner) {
            this.playerStats.gamesWon++;
            this.playerStats.winStreak++;
            this.playerStats.bestWinStreak = Math.max(
                this.playerStats.bestWinStreak, 
                this.playerStats.winStreak
            );
        } else {
            this.playerStats.winStreak = 0;
        }
        
        // Character set tracking
        if (!this.playerStats.characterSetStats[this.currentCharacterSet]) {
            this.playerStats.characterSetStats[this.currentCharacterSet] = {
                gamesPlayed: 0,
                gamesWon: 0,
                questionsAsked: 0
            };
        }
        
        const charSetStats = this.playerStats.characterSetStats[this.currentCharacterSet];
        charSetStats.gamesPlayed++;
        charSetStats.questionsAsked += this.questionsAskedThisGame;
        if (isWinner) {
            charSetStats.gamesWon++;
        }
        
        // Update favorite character set
        this.updateFavoriteCharacterSet();
        
        // Check for achievements
        this.checkAchievements(isWinner);
        
        this.savePlayerStats();
    }
    
    updateFavoriteCharacterSet() {
        let mostPlayed = null;
        let maxGames = 0;
        
        Object.keys(this.playerStats.characterSetStats).forEach(setId => {
            const stats = this.playerStats.characterSetStats[setId];
            if (stats.gamesPlayed > maxGames) {
                maxGames = stats.gamesPlayed;
                mostPlayed = setId;
            }
        });
        
        this.playerStats.favoriteCharacterSet = mostPlayed;
    }
    
    checkAchievements(isWinner) {
        const achievements = [];
        
        // First win
        if (isWinner && this.playerStats.gamesWon === 1) {
            achievements.push('first_win');
        }
        
        // Win streak achievements
        if (this.playerStats.winStreak === 3) {
            achievements.push('win_streak_3');
        }
        if (this.playerStats.winStreak === 5) {
            achievements.push('win_streak_5');
        }
        if (this.playerStats.winStreak === 10) {
            achievements.push('win_streak_10');
        }
        
        // Games played milestones
        if (this.playerStats.gamesPlayed === 10) {
            achievements.push('veteran_10');
        }
        if (this.playerStats.gamesPlayed === 50) {
            achievements.push('veteran_50');
        }
        if (this.playerStats.gamesPlayed === 100) {
            achievements.push('veteran_100');
        }
        
        // Question efficiency
        if (isWinner && this.questionsAskedThisGame <= 5) {
            achievements.push('efficient_win');
        }
        
        // Power-up master
        const totalPowerUps = Object.values(this.playerStats.powerUpsUsed).reduce((a, b) => a + b, 0);
        if (totalPowerUps === 10) {
            achievements.push('power_user');
        }
        
        // Add new achievements
        achievements.forEach(achievement => {
            if (!this.playerStats.achievements.includes(achievement)) {
                this.playerStats.achievements.push(achievement);
                this.showAchievementNotification(achievement);
            }
        });
    }
    
    showAchievementNotification(achievementId) {
        const achievementNames = {
            first_win: '🏆 First Victory!',
            win_streak_3: '🔥 3 Win Streak!',
            win_streak_5: '🔥 5 Win Streak!',
            win_streak_10: '🔥 10 Win Streak!',
            veteran_10: '🎖️ 10 Games Played!',
            veteran_50: '🎖️ 50 Games Played!',
            veteran_100: '🎖️ 100 Games Played!',
            efficient_win: '⚡ Efficient Victory!',
            power_user: '🎯 Power-up Master!'
        };
        
        const name = achievementNames[achievementId] || '🏅 Achievement Unlocked!';
        
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-title">${name}</div>
                <div class="achievement-subtitle">Achievement Unlocked!</div>
            </div>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ffd700, #ffed4e);
            color: #333;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1001;
            font-weight: bold;
            animation: achievementSlide 0.5s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'achievementSlide 0.5s ease-out reverse';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            }
        }, 4000);
    }
    
    displayGameStats() {
        const winRate = this.playerStats.gamesPlayed > 0 ? 
            ((this.playerStats.gamesWon / this.playerStats.gamesPlayed) * 100).toFixed(1) : '0.0';
        
        const statsHTML = `
            <div class="player-stats">
                <h4>📊 Your Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-value">${this.playerStats.gamesPlayed}</span>
                        <span class="stat-label">Games Played</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${winRate}%</span>
                        <span class="stat-label">Win Rate</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.playerStats.winStreak}</span>
                        <span class="stat-label">Win Streak</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.playerStats.averageQuestionsPerGame}</span>
                        <span class="stat-label">Avg Questions</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.playerStats.bestWinStreak}</span>
                        <span class="stat-label">Best Streak</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${Math.round(this.playerStats.averageGameTime / 60)}m</span>
                        <span class="stat-label">Avg Game Time</span>
                    </div>
                </div>
                ${this.playerStats.achievements.length > 0 ? `
                    <div class="achievements-section">
                        <h5>🏆 Achievements (${this.playerStats.achievements.length})</h5>
                        <div class="achievements-list">
                            ${this.getAchievementNames().join(' • ')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Add to game over screen
        const gameOverScreen = document.getElementById('game-over-screen');
        const existingStats = gameOverScreen.querySelector('.player-stats');
        if (existingStats) existingStats.remove();
        
        gameOverScreen.insertAdjacentHTML('beforeend', statsHTML);
    }
    
    getAchievementNames() {
        const achievementNames = {
            first_win: '🏆 First Victory',
            win_streak_3: '🔥 3 Win Streak',
            win_streak_5: '🔥 5 Win Streak',
            win_streak_10: '🔥 10 Win Streak',
            veteran_10: '🎖️ Veteran (10)',
            veteran_50: '🎖️ Veteran (50)',
            veteran_100: '🎖️ Veteran (100)',
            efficient_win: '⚡ Efficient Victory',
            power_user: '🎯 Power-up Master'
        };
        
        return this.playerStats.achievements.map(id => 
            achievementNames[id] || '🏅 Achievement'
        );
    }
    
    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
    }
    
    // Game over screen actions
    backToLobby() {
        console.log('🏠 Going back to lobby');
        // Reset game state but stay in room
        this.gameStarted = false;
        this.isMyTurn = false;
        this.characters = [];
        this.eliminatedCharacters.clear();
        this.eliminationHistory = [];
        this.eliminationRedoStack = [];
        
        // Clear timers
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        
        // Show lobby screen
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('lobby-screen').style.display = 'block';
        
        // Update character set selection
        this.updateCharacterSetSelection();
        
        // Reset ready state
        this.isReady = false;
        const readyBtn = document.getElementById('ready-btn');
        readyBtn.textContent = 'Ready';
        readyBtn.className = '';
        
        // Notify server
        this.send('back_to_lobby', {});
    }
    
    startNewGame() {
        console.log('🆕 Starting completely new game');
        // Leave current room and go to start screen
        this.send('leave_room', {});
        
        // Reset all state
        this.inRoom = false;
        this.isReady = false;
        this.gameStarted = false;
        this.roomCode = '';
        this.isRoomCreator = false;
        
        // Show room selection screen
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('lobby-screen').style.display = 'none';
        document.getElementById('room-selection-screen').style.display = 'block';
        
        // Re-enable room selection
        this.setRoomSelectionEnabled(true);
        
        // Clear room code input
        document.getElementById('room-code').value = '';
    }
    
    changeCharacterSet() {
        const dropdown = document.getElementById('lobby-character-set-select');
        const selectedSet = dropdown.value;
        
        if (selectedSet && selectedSet !== this.currentCharacterSet) {
            console.log(`🎮 Changing character set to: ${selectedSet}`);
            this.currentCharacterSet = selectedSet;
            this.updateCharacterSetInfo();
            
            // Notify server about character set change
            this.send('change_character_set', { 
                characterSet: selectedSet 
            });
        }
    }
    
    handleCharacterSetChanged(payload) {
        console.log(`🎮 Character set changed to: ${payload.characterSetName}`);
        this.currentCharacterSet = payload.characterSet;
        
        // Update dropdown if visible
        const dropdown = document.getElementById('lobby-character-set-select');
        if (dropdown) {
            dropdown.value = payload.characterSet;
            this.updateCharacterSetInfo();
        }
        
        // Show notification to all players
        this.addLogMessage(`🎮 Character set changed to: ${payload.characterSetName}`);
        
        // Show temporary notification
        const notification = document.createElement('div');
        notification.className = 'character-set-notification';
        notification.textContent = `Character set changed to: ${payload.characterSetName}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
            font-weight: bold;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
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

function closeEliminationHintModal() {
    document.getElementById('elimination-hint-modal').style.display = 'none';
}

function closeRevealAttributeModal() {
    document.getElementById('reveal-attribute-modal').style.display = 'none';
}

function generateNewUsername() {
    if (window.game) {
        window.game.generateNewUsername();
    }
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

// Dark Mode Toggle
function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Update button icon
    const toggleBtn = document.getElementById('dark-mode-toggle');
    toggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    
    // Save preference to localStorage
    localStorage.setItem('theme', newTheme);
}

// Initialize theme on page load
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const toggleBtn = document.getElementById('dark-mode-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
}

// Game over screen functions
function backToLobby() {
    if (game) {
        game.backToLobby();
    }
}

function startNewGame() {
    if (game) {
        game.startNewGame();
    }
}

function changeCharacterSet() {
    if (game) {
        game.changeCharacterSet();
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    game = new GuestQuestGame();
});