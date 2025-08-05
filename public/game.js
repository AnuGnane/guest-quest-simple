class GuestQuestGame {
    constructor() {
        this.ws = null;
        this.playerName = '';
        this.roomCode = '';
        this.isReady = false;
        this.gameStarted = false;
        this.characters = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo'];
        
        this.init();
    }
    
    init() {
        this.connect();
        this.setupEventListeners();
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
            if (e.key === 'Enter') this.createRoom();
        });
        
        document.getElementById('room-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        document.getElementById('question-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.askQuestion();
        });
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
            case 'error':
                alert(payload.message);
                break;
            default:
                console.log('Unknown message type:', type);
        }
    }
    
    createRoom() {
        const nameInput = document.getElementById('player-name');
        this.playerName = nameInput.value.trim();
        
        if (!this.playerName) {
            alert('Please enter your name');
            return;
        }
        
        this.send('create_room', { playerName: this.playerName });
    }
    
    handleRoomCreated(payload) {
        this.roomCode = payload.roomCode;
        document.getElementById('current-room-code').textContent = this.roomCode;
        document.getElementById('room-info').style.display = 'block';
        
        // Auto-join the created room
        this.send('join_room', { roomCode: this.roomCode, playerName: this.playerName });
    }
    
    joinRoom() {
        const nameInput = document.getElementById('player-name');
        const codeInput = document.getElementById('room-code');
        
        this.playerName = nameInput.value.trim();
        this.roomCode = codeInput.value.trim().toUpperCase();
        
        if (!this.playerName || !this.roomCode) {
            alert('Please enter your name and room code');
            return;
        }
        
        document.getElementById('current-room-code').textContent = this.roomCode;
        document.getElementById('room-info').style.display = 'block';
        
        this.send('join_room', { roomCode: this.roomCode, playerName: this.playerName });
    }
    
    handleRoomUpdated(payload) {
        const playersListEl = document.getElementById('players-list');
        playersListEl.innerHTML = '';
        
        payload.players.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = `player-item ${player.ready ? 'player-ready' : ''}`;
            playerEl.innerHTML = `
                <span>${player.name}</span>
                <span>${player.ready ? '✓ Ready' : 'Not Ready'}</span>
            `;
            playersListEl.appendChild(playerEl);
        });
        
        // Show ready button if not ready
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
        // In a real implementation, you'd send this to the server
        // For now, we'll just update the UI
        const readyBtn = document.getElementById('ready-btn');
        readyBtn.textContent = this.isReady ? 'Not Ready' : 'Ready';
    }
    
    startGame() {
        this.send('start_game', {});
    }
    
    handleGameStarted(payload) {
        this.gameStarted = true;
        
        // Hide lobby, show game
        document.getElementById('lobby-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        
        // Set character
        document.getElementById('character-name').textContent = payload.yourCharacter;
        
        // Set current turn
        document.getElementById('turn-player').textContent = payload.currentTurn;
        
        // Create character buttons
        this.createCharacterButtons();
        
        this.addLogMessage(`Game started! Your character is ${payload.yourCharacter}`);
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
        this.addLogMessage(`${payload.player} asked: "${payload.question}" - Answer: ${payload.answer}`);
    }
    
    handleTurnChanged(payload) {
        document.getElementById('turn-player').textContent = payload.currentTurn;
        
        const isMyTurn = payload.currentTurn === this.playerName;
        document.getElementById('question-input').disabled = !isMyTurn;
        document.getElementById('ask-btn').disabled = !isMyTurn;
        
        const characterBtns = document.querySelectorAll('.character-btn');
        characterBtns.forEach(btn => btn.disabled = !isMyTurn);
    }
    
    makeGuess(character) {
        if (confirm(`Are you sure you want to guess ${character}?`)) {
            this.send('make_guess', { character });
        }
    }
    
    handleGuessMade(payload) {
        this.addLogMessage(`${payload.player} guessed ${payload.character} - ${payload.correct ? 'Correct!' : 'Wrong!'}`);
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

function askQuestion() {
    game.askQuestion();
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    game = new GuestQuestGame();
});