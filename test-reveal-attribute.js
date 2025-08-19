#!/usr/bin/env node

/**
 * Test Reveal Attribute Power-up
 * 
 * Test that reveal attribute only shows gameplay attributes,
 * not metadata like image, id, name
 */

const WebSocket = require('ws');

class RevealAttributeTest {
    constructor() {
        this.ws = null;
        this.roomCode = null;
        this.gameStarted = false;
        this.character = null;
        this.powerUps = {};
        this.revealedAttributes = [];
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket('ws://localhost:3000');
            
            this.ws.on('open', () => {
                console.log('✅ Connected to server');
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('❌ Error parsing message:', error.message);
                }
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                reject(error);
            });
        });
    }

    handleMessage(message) {
        const { type, payload } = message;
        
        switch (type) {
            case 'room_created':
                this.roomCode = payload.roomCode;
                console.log(`🏠 Room created: ${this.roomCode}`);
                break;

            case 'game_started':
                this.gameStarted = true;
                this.character = payload.yourCharacter;
                this.powerUps = payload.powerUps;
                console.log(`🎮 Game started! Character: ${this.character.name}`);
                console.log(`📋 Character attributes:`, this.character.attributes || 'Legacy format');
                break;

            case 'powerup_used':
                if (payload.result.type === 'reveal_attribute') {
                    const { attribute, value } = payload.result;
                    console.log(`🔍 Revealed attribute: ${attribute} = ${value}`);
                    this.revealedAttributes.push({ attribute, value });
                    
                    // Check if this is a forbidden attribute
                    const forbiddenAttributes = ['image', 'id', 'name', 'attributes'];
                    if (forbiddenAttributes.includes(attribute)) {
                        console.log(`❌ ERROR: Revealed forbidden attribute: ${attribute}`);
                    } else {
                        console.log(`✅ OK: Revealed valid gameplay attribute: ${attribute}`);
                    }
                }
                break;

            case 'error':
                console.log(`⚠️ Server error: ${payload.message}`);
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

    async runTest() {
        console.log('🧪 Testing Reveal Attribute Power-up\n');
        
        try {
            // Connect and create room
            await this.connect();
            await this.wait(500);
            
            // Create room with superheroes (has diverse attributes)
            this.send('create_room', { 
                playerName: 'TestPlayer',
                characterSet: 'superheroes'
            });
            await this.wait(1000);
            
            // Join own room
            this.send('join_room', { 
                roomCode: this.roomCode, 
                playerName: 'TestPlayer' 
            });
            await this.wait(1000);
            
            // Ready up
            this.send('toggle_ready', { ready: true });
            await this.wait(1000);
            
            // Start game (need 2 players, but we'll simulate)
            console.log('⚠️ Note: This test requires manual game start with 2 players');
            console.log('🎯 To complete test:');
            console.log('1. Open browser to http://localhost:3000');
            console.log(`2. Join room ${this.roomCode}`);
            console.log('3. Start game and use reveal attribute power-up');
            console.log('4. Check that only gameplay attributes are revealed\n');
            
            // Keep connection alive for manual testing
            setTimeout(() => {
                console.log('📊 Test Results Summary:');
                console.log(`Revealed attributes: ${this.revealedAttributes.length}`);
                this.revealedAttributes.forEach(attr => {
                    console.log(`  - ${attr.attribute}: ${attr.value}`);
                });
                
                if (this.ws) this.ws.close();
                process.exit(0);
            }, 30000);
            
        } catch (error) {
            console.error('💥 Test failed:', error.message);
            if (this.ws) this.ws.close();
            process.exit(1);
        }
    }
}

// Run test
const test = new RevealAttributeTest();
test.runTest().catch(console.error);