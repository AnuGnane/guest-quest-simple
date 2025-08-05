const { spawn } = require('child_process');
const http = require('http');

console.log('🚀 Starting Guest Quest Simple...\n');

// Start the server
const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: __dirname
});

// Wait for server to be ready
function waitForServer() {
    return new Promise((resolve) => {
        const checkServer = () => {
            const req = http.get('http://localhost:3000', (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    setTimeout(checkServer, 500);
                }
            });
            
            req.on('error', () => {
                setTimeout(checkServer, 500);
            });
        };
        
        setTimeout(checkServer, 1000);
    });
}

// Handle server startup
server.on('spawn', async () => {
    console.log('⏳ Waiting for server to be ready...');
    
    try {
        await waitForServer();
        console.log('\n✅ Server is ready!');
        console.log('\n🎮 Game is now running at: http://localhost:3000');
        console.log('\n📖 How to play:');
        console.log('1. Open the URL above in your browser');
        console.log('2. Enter your name and create a room');
        console.log('3. Open another browser tab/window and join with the room code');
        console.log('4. Both players click "Ready" and start the game');
        console.log('5. Take turns asking yes/no questions and making character guesses!');
        console.log('\n💡 Tip: Open multiple browser tabs to test multiplayer locally');
        console.log('\n🛑 Press Ctrl+C to stop the server');
        
    } catch (error) {
        console.log('\n❌ Failed to start server:', error.message);
        process.exit(1);
    }
});

server.on('error', (error) => {
    console.log('\n❌ Server error:', error.message);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down server...');
    server.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    server.kill('SIGTERM');
    process.exit(0);
});