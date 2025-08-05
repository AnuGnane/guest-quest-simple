const WebSocket = require('ws');

console.log('🧪 Testing Ready Functionality...\n');

// Test the ready functionality
function testReadyFunctionality() {
    return new Promise((resolve, reject) => {
        const ws1 = new WebSocket('ws://localhost:3000');
        const ws2 = new WebSocket('ws://localhost:3000');
        
        let roomCode = '';
        let step = 0;
        
        ws1.on('open', () => {
            console.log('✅ Player 1 connected');
            // Create room
            ws1.send(JSON.stringify({
                type: 'create_room',
                payload: { playerName: 'Player1', characterSet: 'classic' }
            }));
        });
        
        ws1.on('message', (data) => {
            const message = JSON.parse(data);
            
            if (message.type === 'room_created') {
                roomCode = message.payload.roomCode;
                console.log(`✅ Room created: ${roomCode}`);
                
                // Join the room
                ws1.send(JSON.stringify({
                    type: 'join_room',
                    payload: { roomCode, playerName: 'Player1' }
                }));
                
                // Player 2 joins
                setTimeout(() => {
                    ws2.send(JSON.stringify({
                        type: 'join_room',
                        payload: { roomCode, playerName: 'Player2' }
                    }));
                }, 100);
                
            } else if (message.type === 'room_updated') {
                step++;
                console.log(`📊 Room update ${step}:`, message.payload.players.map(p => `${p.name}: ${p.ready ? 'Ready' : 'Not Ready'}`));
                
                if (step === 1) {
                    // First update after both joined, now toggle ready
                    console.log('🔄 Player 1 marking ready...');
                    ws1.send(JSON.stringify({
                        type: 'toggle_ready',
                        payload: { ready: true }
                    }));
                } else if (step === 2) {
                    // Player 1 is ready, now Player 2
                    console.log('🔄 Player 2 marking ready...');
                    ws2.send(JSON.stringify({
                        type: 'toggle_ready',
                        payload: { ready: true }
                    }));
                } else if (step === 3) {
                    // Both ready, check if can start
                    if (message.payload.canStart) {
                        console.log('✅ Both players ready - can start game!');
                        resolve();
                    } else {
                        console.log('❌ Both players ready but canStart is false');
                        reject(new Error('canStart should be true'));
                    }
                    
                    ws1.close();
                    ws2.close();
                }
            }
        });
        
        ws2.on('open', () => {
            console.log('✅ Player 2 connected');
        });
        
        ws2.on('message', (data) => {
            // Player 2 just listens for updates
        });
        
        setTimeout(() => {
            console.log('❌ Test timeout');
            ws1.close();
            ws2.close();
            reject(new Error('Test timeout'));
        }, 10000);
    });
}

// Run the test
testReadyFunctionality()
    .then(() => {
        console.log('\n🎉 Ready functionality test PASSED!');
        console.log('\n📖 How to test manually:');
        console.log('1. Open http://localhost:3000 in two browser tabs');
        console.log('2. Create a room in tab 1, join with tab 2');
        console.log('3. Click "Ready" in both tabs');
        console.log('4. "Start Game" button should appear');
        process.exit(0);
    })
    .catch((error) => {
        console.log('\n❌ Ready functionality test FAILED:', error.message);
        process.exit(1);
    });