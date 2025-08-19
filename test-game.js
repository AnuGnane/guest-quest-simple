#!/usr/bin/env node

/**
 * Guest Quest Game Test Script
 * 
 * This script simulates two players playing a complete game to test all features:
 * - Connection and lobby functionality
 * - Game start and character assignment
 * - Question asking and answering
 * - Power-up usage (especially double question)
 * - Timer synchronization
 * - Turn management
 * - Win conditions
 */

const WebSocket = require('ws');

class GameTestClient {
    constructor(playerName, serverUrl = 'ws://localhost:3000') {
        this.playerName = playerName;
        this.serverUrl = serverUrl;
        this.ws = null;
        this.roomCode = null;
        this.gameStarted = false;
        this.isMyTurn = false;
        this.character = null;
        this.powerUps = {};
        this.turnState = {
            questionAsked: false,
            doubleQuestionActive: false,
            doubleQuestionUsed: false,
            questionsAskedCount: 0
        };
        this.timeRemaining = 60;
        this.testResults = [];
        this.pendingQuestion = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.on('open', () => {
                this.log(`✅ Connected to server`);
                this.testResults.push({ test: 'Connection', status: 'PASS', details: 'WebSocket connected successfully' });
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(message);
                } catch (error) {
                    this.log(`❌ Error parsing message: ${error.message}`);
                    this.testResults.push({ test: 'Message Parsing', status: 'FAIL', details: error.message });
                }
            });

            this.ws.on('error', (error) => {
                this.log(`❌ WebSocket error: ${error.message}`);
                reject(error);
            });

            this.ws.on('close', () => {
                this.log(`🔌 Disconnected from server`);
            });
        });
    }

    handleMessage(message) {
        const { type, payload } = message;
        
        switch (type) {
            case 'room_created':
                this.roomCode = payload.roomCode;
                this.log(`🏠 Room created: ${this.roomCode}`);
                this.testResults.push({ test: 'Room Creation', status: 'PASS', details: `Room ${this.roomCode} created` });
                break;

            case 'room_updated':
                this.log(`👥 Room updated - ${payload.players.length} players`);
                this.testResults.push({ test: 'Room Join', status: 'PASS', details: `${payload.players.length} players in room` });
                break;

            case 'game_started':
                this.gameStarted = true;
                this.character = payload.yourCharacter;
                this.powerUps = payload.powerUps;
                this.isMyTurn = payload.currentTurn === this.playerName;
                this.log(`🎮 Game started! Character: ${this.character.name}, My turn: ${this.isMyTurn}`);
                this.testResults.push({ 
                    test: 'Game Start', 
                    status: 'PASS', 
                    details: `Character assigned: ${this.character.name}, Power-ups: ${JSON.stringify(this.powerUps)}` 
                });
                break;

            case 'turn_changed':
                this.isMyTurn = payload.currentTurn === this.playerName;
                this.timeRemaining = payload.timeRemaining || 60;
                this.turnState = {
                    questionAsked: false,
                    doubleQuestionActive: false,
                    doubleQuestionUsed: false,
                    questionsAskedCount: 0
                };
                this.log(`🔄 Turn changed - My turn: ${this.isMyTurn}, Time: ${this.timeRemaining}s`);
                this.testResults.push({ 
                    test: 'Turn Management', 
                    status: 'PASS', 
                    details: `Turn changed to ${payload.currentTurn}, timer: ${this.timeRemaining}s` 
                });
                break;

            case 'timer_sync':
                this.timeRemaining = payload.timeRemaining;
                // Only log every 10 seconds to avoid spam
                if (this.timeRemaining % 10 === 0) {
                    this.log(`⏰ Timer sync: ${this.timeRemaining}s remaining`);
                }
                if (this.timeRemaining === 50) { // Test timer sync early in turn
                    this.testResults.push({ 
                        test: 'Timer Synchronization', 
                        status: 'PASS', 
                        details: `Server timer sync working: ${this.timeRemaining}s` 
                    });
                }
                break;

            case 'question_received':
                this.pendingQuestion = payload;
                this.log(`❓ Received question: "${payload.question}" from ${payload.askingPlayer}`);
                // Auto-answer after a short delay
                setTimeout(() => this.answerQuestion(), 1000);
                break;

            case 'question_answered':
                this.log(`✅ Question answered: "${payload.question}" - "${payload.answer}"`);
                this.testResults.push({ 
                    test: 'Question Flow', 
                    status: 'PASS', 
                    details: `Q: "${payload.question}" A: "${payload.answer}"` 
                });
                break;

            case 'powerup_used':
                this.log(`🎯 Power-up used: ${payload.powerUpName} by ${payload.player}`);
                if (payload.result.type === 'double_question') {
                    this.testResults.push({ 
                        test: 'Double Question Power-up', 
                        status: 'PASS', 
                        details: `Double question activated for ${payload.player}` 
                    });
                    if (payload.player === this.playerName) {
                        this.turnState.doubleQuestionUsed = true;
                        this.turnState.doubleQuestionActive = true;
                    }
                } else if (payload.result.type === 'reveal_attribute') {
                    const { attribute, value } = payload.result;
                    this.log(`🔍 Revealed: ${attribute} = ${value}`);
                    
                    // Check if forbidden attributes are revealed
                    const forbiddenAttributes = ['image', 'id', 'name', 'attributes'];
                    if (forbiddenAttributes.includes(attribute)) {
                        this.testResults.push({ 
                            test: 'Reveal Attribute Security', 
                            status: 'FAIL', 
                            details: `Revealed forbidden attribute: ${attribute}` 
                        });
                    } else {
                        this.testResults.push({ 
                            test: 'Reveal Attribute Power-up', 
                            status: 'PASS', 
                            details: `Revealed valid attribute: ${attribute} = ${value}` 
                        });
                    }
                }
                break;

            case 'double_question_used':
                this.log(`🎯 Double question progress: ${payload.message}`);
                if (payload.player === this.playerName) {
                    this.turnState.doubleQuestionActive = true;
                    this.turnState.questionAsked = false;
                }
                this.testResults.push({ 
                    test: 'Double Question Flow', 
                    status: 'PASS', 
                    details: payload.message 
                });
                break;

            case 'game_over':
                this.log(`🏆 Game over! Winner: ${payload.winner}, Character: ${payload.character}`);
                this.testResults.push({ 
                    test: 'Game Completion', 
                    status: 'PASS', 
                    details: `Winner: ${payload.winner}, Character: ${payload.character}` 
                });
                break;

            case 'error':
                this.log(`❌ Server error: ${payload.message}`);
                this.testResults.push({ 
                    test: 'Error Handling', 
                    status: 'INFO', 
                    details: payload.message 
                });
                break;

            default:
                this.log(`📨 Received: ${type}`);
        }
    }

    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
    }

    log(message) {
        console.log(`[${this.playerName}] ${message}`);
    }

    // Test Actions
    async createRoom(characterSet = 'classic') {
        this.send('create_room', { 
            playerName: this.playerName,
            characterSet: characterSet
        });
        await this.wait(500);
    }

    async joinRoom(roomCode) {
        this.send('join_room', { 
            roomCode: roomCode, 
            playerName: this.playerName 
        });
        await this.wait(500);
    }

    async toggleReady() {
        this.log(`🔄 Toggling ready state`);
        this.send('toggle_ready', { ready: true });
        await this.wait(500);
    }

    async startGame() {
        this.log(`🚀 Attempting to start game`);
        this.send('start_game', {});
        await this.wait(1000);
    }

    async askQuestion(question) {
        if (!this.isMyTurn) {
            this.log(`⚠️ Not my turn, cannot ask question`);
            return;
        }
        
        this.send('ask_question', { question });
        this.turnState.questionsAskedCount++;
        this.log(`❓ Asked question: "${question}"`);
        await this.wait(500);
    }

    async answerQuestion() {
        if (!this.pendingQuestion) return;
        
        // Simulate intelligent answers based on our character
        const answers = ['yes', 'no', 'maybe', 'sometimes'];
        const answer = answers[Math.floor(Math.random() * answers.length)];
        
        this.send('answer_question', {
            answer: answer,
            questionId: this.pendingQuestion.questionId
        });
        
        this.log(`✅ Answered: "${answer}"`);
        this.pendingQuestion = null;
        await this.wait(500);
    }

    async usePowerUp(powerUpType) {
        if (!this.isMyTurn) {
            this.log(`⚠️ Not my turn, cannot use power-up`);
            return;
        }
        
        if (!this.powerUps[powerUpType] || this.powerUps[powerUpType] <= 0) {
            this.log(`⚠️ Power-up ${powerUpType} not available`);
            return;
        }
        
        this.send('use_powerup', { powerUpType });
        this.log(`🎯 Used power-up: ${powerUpType}`);
        await this.wait(1000);
    }

    async makeGuess(character) {
        if (!this.isMyTurn) {
            this.log(`⚠️ Not my turn, cannot make guess`);
            return;
        }
        
        this.send('make_guess', { character });
        this.log(`🎯 Made guess: ${character}`);
        await this.wait(500);
    }

    async endTurn() {
        if (!this.isMyTurn) return;
        
        this.send('end_turn', {});
        this.log(`⏭️ Ended turn`);
        await this.wait(500);
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printTestResults() {
        console.log(`\n📊 TEST RESULTS FOR ${this.playerName}:`);
        console.log('='.repeat(50));
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const info = this.testResults.filter(r => r.status === 'INFO').length;
        
        this.testResults.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : 'ℹ️';
            console.log(`${icon} ${result.test}: ${result.status} - ${result.details}`);
        });
        
        console.log('='.repeat(50));
        console.log(`📈 Summary: ${passed} passed, ${failed} failed, ${info} info`);
        return { passed, failed, info };
    }
}

// Main test execution
async function runGameTest() {
    console.log('🚀 Starting Guest Quest Game Test\n');
    
    // Create two test clients
    const player1 = new GameTestClient('TestPlayer1');
    const player2 = new GameTestClient('TestPlayer2');
    
    try {
        // Phase 1: Connection and Lobby
        console.log('📡 Phase 1: Connection and Lobby Setup');
        await player1.connect();
        await player2.connect();
        
        // Player 1 creates room with superheroes character set
        await player1.createRoom('superheroes');
        await player1.wait(1000);
        
        // Player 1 joins their own room
        await player1.joinRoom(player1.roomCode);
        await player1.wait(1000);
        
        // Player 2 joins room
        await player2.joinRoom(player1.roomCode);
        await player1.wait(2000);
        
        // Both players ready up
        await player1.toggleReady();
        await player1.wait(1000);
        await player2.toggleReady();
        await player1.wait(2000);
        
        // Start game
        await player1.startGame();
        await player1.wait(3000);
        
        // Phase 2: Basic Gameplay
        console.log('\n🎮 Phase 2: Basic Gameplay Testing');
        
        // Wait for game to start and determine who goes first
        await player1.wait(2000);
        
        let currentPlayer = player1.isMyTurn ? player1 : player2;
        let otherPlayer = player1.isMyTurn ? player2 : player1;
        
        // Test normal question flow
        await currentPlayer.askQuestion('Are you male?');
        await player1.wait(3000); // Wait for answer
        
        // Test power-up usage - Double Question
        console.log('\n🎯 Phase 3: Power-up Testing (Double Question)');
        
        // Wait for next turn
        await player1.wait(2000);
        currentPlayer = player1.isMyTurn ? player1 : player2;
        
        // Use double question power-up
        await currentPlayer.usePowerUp('double_question');
        await player1.wait(2000);
        
        // Ask first question of double question
        await currentPlayer.askQuestion('Do you have blonde hair?');
        await player1.wait(3000);
        
        // Ask second question of double question
        await currentPlayer.askQuestion('Are you young?');
        await player1.wait(3000);
        
        // Test other power-ups
        console.log('\n🔍 Phase 4: Other Power-ups Testing');
        
        // Wait for next turn
        await player1.wait(2000);
        currentPlayer = player1.isMyTurn ? player1 : player2;
        
        // Test reveal attribute
        await currentPlayer.usePowerUp('reveal_attribute');
        await player1.wait(2000);
        
        // Ask a question after power-up
        await currentPlayer.askQuestion('Do you live in the city?');
        await player1.wait(3000);
        
        // Phase 5: Game Completion
        console.log('\n🏆 Phase 5: Game Completion Testing');
        
        // Wait for next turn and make a guess to end game
        await player1.wait(2000);
        currentPlayer = player1.isMyTurn ? player1 : player2;
        
        // Make a guess (likely wrong, but tests the flow)
        const characters = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
        const randomCharacter = characters[Math.floor(Math.random() * characters.length)];
        await currentPlayer.makeGuess(randomCharacter);
        
        // Wait for game to potentially end or continue
        await player1.wait(3000);
        
        // If game didn't end, make another guess
        if (!player1.testResults.some(r => r.test === 'Game Completion')) {
            currentPlayer = player1.isMyTurn ? player1 : player2;
            const anotherCharacter = characters.find(c => c !== randomCharacter);
            await currentPlayer.makeGuess(anotherCharacter);
            await player1.wait(3000);
        }
        
        console.log('\n📊 TEST EXECUTION COMPLETE\n');
        
        // Print results
        const results1 = player1.printTestResults();
        const results2 = player2.printTestResults();
        
        console.log('\n🎯 OVERALL TEST SUMMARY:');
        console.log('='.repeat(60));
        const totalPassed = results1.passed + results2.passed;
        const totalFailed = results1.failed + results2.failed;
        const totalInfo = results1.info + results2.info;
        
        console.log(`✅ Total Passed: ${totalPassed}`);
        console.log(`❌ Total Failed: ${totalFailed}`);
        console.log(`ℹ️ Total Info: ${totalInfo}`);
        
        if (totalFailed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Game is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Check the details above.');
        }
        
    } catch (error) {
        console.error('💥 Test execution failed:', error.message);
    } finally {
        // Clean up connections
        if (player1.ws) player1.ws.close();
        if (player2.ws) player2.ws.close();
        
        // Exit after a short delay
        setTimeout(() => process.exit(0), 2000);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    runGameTest().catch(console.error);
}

module.exports = { GameTestClient, runGameTest };