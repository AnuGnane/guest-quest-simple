const http = require('http');
const WebSocket = require('ws');

console.log('🧪 Testing Guest Quest Simple...\n');

// Test 1: HTTP Server
function testHttpServer() {
    return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3000', (res) => {
            if (res.statusCode === 200) {
                console.log('✅ HTTP Server: PASSED');
                resolve();
            } else {
                console.log('❌ HTTP Server: FAILED');
                reject(new Error(`HTTP Status: ${res.statusCode}`));
            }
        });
        
        req.on('error', (err) => {
            console.log('❌ HTTP Server: FAILED');
            reject(err);
        });
        
        req.setTimeout(5000, () => {
            console.log('❌ HTTP Server: TIMEOUT');
            reject(new Error('Timeout'));
        });
    });
}

// Test 2: WebSocket Connection
function testWebSocket() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3000');
        
        ws.on('open', () => {
            console.log('✅ WebSocket Connection: PASSED');
            ws.close();
            resolve();
        });
        
        ws.on('error', (err) => {
            console.log('❌ WebSocket Connection: FAILED');
            reject(err);
        });
        
        setTimeout(() => {
            console.log('❌ WebSocket Connection: TIMEOUT');
            ws.close();
            reject(new Error('Timeout'));
        }, 5000);
    });
}

// Test 3: Room Creation
function testRoomCreation() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3000');
        
        ws.on('open', () => {
            ws.send(JSON.stringify({
                type: 'create_room',
                payload: { playerName: 'TestPlayer' }
            }));
        });
        
        ws.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'room_created' && message.payload.roomCode) {
                console.log('✅ Room Creation: PASSED');
                ws.close();
                resolve();
            } else {
                console.log('❌ Room Creation: FAILED');
                reject(new Error('Invalid response'));
            }
        });
        
        ws.on('error', (err) => {
            console.log('❌ Room Creation: FAILED');
            reject(err);
        });
        
        setTimeout(() => {
            console.log('❌ Room Creation: TIMEOUT');
            ws.close();
            reject(new Error('Timeout'));
        }, 5000);
    });
}

// Run all tests
async function runTests() {
    try {
        await testHttpServer();
        await testWebSocket();
        await testRoomCreation();
        
        console.log('\n🎉 All tests passed! The game is ready to play.');
        console.log('\n📖 How to play:');
        console.log('1. Open http://localhost:3000 in your browser');
        console.log('2. Enter your name and create a room');
        console.log('3. Share the room code with a friend');
        console.log('4. Both players click "Ready" and start the game');
        console.log('5. Take turns asking questions and making guesses!');
        
    } catch (error) {
        console.log('\n❌ Tests failed:', error.message);
        console.log('\n🔧 Make sure the server is running with: npm run dev');
    }
    
    process.exit(0);
}

runTests();