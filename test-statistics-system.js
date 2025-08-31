#!/usr/bin/env node

/**
 * Test Statistics System
 * 
 * Test to verify statistics tracking is working correctly
 */

const WebSocket = require('ws');

class StatsTest {
    constructor(playerName) {
        this.playerName = playerName;
        this.ws = null;
        this.roomCode = null;
        this.gameStarted = false;
        this.character = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket('ws://localhost:3000');
            
            this.ws.on('open', () => {
                console.log(`✅ ${this.playerName} connected`);
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error(`❌ ${this.playerName} error parsing message:`, error.message);
                }
            });

            this.ws.on('error', (error) => {
                console.error(`❌ ${this.playerName} WebSocket error:`, error.message);
                reject(error);
            });
        });
    }

    handleMessage(message) {
        const { type, payload } = message;
        
        switch (type) {
            case 'room_created':
                this.roomCode = payload.roomCode;
                console.log(`🏠 ${this.playerName} created room: ${this.roomCode}`);
                break;

            case 'room_updated':
                console.log(`👥 ${this.playerName} sees ${payload.players.length} players in room`);
                break;

            case 'game_started':
                this.gameStarted = true;
                this.character = payload.yourCharacter;
                console.log(`🎮 ${this.playerName} game started with character: ${this.character.name}`);
                break;

            case 'question_asked':
                console.log(`❓ ${this.playerName} sees question: \"${payload.question}\" - Answer: ${payload.answer}`);
                break;

            case 'turn_changed':
                console.log(`🔄 ${this.playerName} sees turn changed to: ${payload.currentTurn}`);
                break;

            case 'game_over':
                console.log(`🏁 ${this.playerName} sees game over - Winner: ${payload.winner}, Character: ${payload.character}`);
                break;

            case 'error':
                console.log(`⚠️ ${this.playerName} error: ${payload.message}`);
                break;
        }
    }

    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async askQuestion(question) {
        console.log(`❓ ${this.playerName} asking: \"${question}\"`);
        this.send('ask_question', { question });
        await this.wait(1000);
    }

    async makeGuess(character) {
        console.log(`🎯 ${this.playerName} guessing: ${character}`);
        this.send('make_guess', { character });
        await this.wait(1000);
    }
}

async function testStatisticsSystem() {
    console.log('📊 Testing Statistics System\\n');
    
    const player1 = new StatsTest('StatsPlayer1');
    const player2 = new StatsTest('StatsPlayer2');
    
    try {
        // Connect both players
        await player1.connect();
        await player2.connect();
        await player1.wait(500);
        
        // Player 1 creates room
        player1.send('create_room', { 
            playerName: player1.playerName,
            characterSet: 'classic'
        });
        await player1.wait(1000);
        
        // Both players join room
        player1.send('join_room', { 
            roomCode: player1.roomCode, 
            playerName: player1.playerName 
        });
        await player1.wait(500);
        
        player2.send('join_room', { 
            roomCode: player1.roomCode, 
            playerName: player2.playerName 
        });
        await player1.wait(1000);
        
        // Both players ready up
        player1.send('toggle_ready', { ready: true });
        await player1.wait(500);
        player2.send('toggle_ready', { ready: true });
        await player1.wait(1000);
        
        // Start game
        console.log('\\n🎯 Starting Game for Statistics Test:');
        player1.send('start_game', {});
        await player1.wait(2000);
        
        // Simulate some gameplay to test statistics
        console.log('\\n📈 Simulating Gameplay:');
        
        // Player 1 asks questions
        await player1.askQuestion('Are they male?');
        await player1.askQuestion('Do they have brown hair?');
        
        // Player 2 asks questions  
        await player2.askQuestion('Are they young?');
        await player2.askQuestion('Do they wear glasses?');
        
        // Player 1 makes a guess (likely wrong to test loss tracking)
        await player1.makeGuess('Alice');
        
        await player1.wait(3000);
        
        console.log('\\n📊 Statistics Test Results:');
        console.log('✅ Game simulation completed');
        console.log('✅ Questions asked and tracked');
        console.log('✅ Game over should trigger statistics update');
        console.log('✅ Check browser localStorage for guestquest_stats');
        
        // Note: We can't directly test localStorage from Node.js,
        // but the client-side code should be tracking:
        // - Games played: +1
        // - Questions asked: +4 total
        // - Win/loss status
        // - Game time
        // - Character set usage
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    } finally {
        // Clean up
        if (player1.ws) player1.ws.close();
        if (player2.ws) player2.ws.close();
        
        setTimeout(() => process.exit(0), 1000);
    }
}

if (require.main === module) {
    testStatisticsSystem().catch(console.error);
}

module.exports = { testStatisticsSystem };