# 🧪 Guest Quest Test System

## Overview

The test system simulates two players playing a complete game to verify all features work correctly. It tests the entire game flow from connection to completion, including recent fixes for double questions and timer synchronization.

## How to Run Tests

### Prerequisites
1. Make sure the server is running:
   ```bash
   node server.js
   ```

2. In a separate terminal, run the test:
   ```bash
   npm run test-game
   # or
   node test-game.js
   ```

## What the Test Does

### 🔗 **Phase 1: Connection & Lobby**
- **Connection Testing**: Both players connect via WebSocket
- **Room Creation**: Player 1 creates a room with classic character set
- **Room Joining**: Player 2 joins using the room code
- **Ready State**: Both players mark themselves as ready
- **Game Start**: Initiates the game with character assignment

**Validates**: WebSocket connections, room management, lobby flow

### 🎮 **Phase 2: Basic Gameplay**
- **Turn Management**: Verifies correct turn assignment
- **Question Flow**: Player asks a question, other player answers
- **Timer Sync**: Validates server-side timer synchronization
- **State Management**: Ensures turn state is properly maintained

**Validates**: Core question/answer mechanics, turn transitions

### 🎯 **Phase 3: Double Question Power-up**
- **Power-up Activation**: Uses double question power-up
- **First Question**: Asks first question of the double question turn
- **State Validation**: Ensures turn doesn't end after first question
- **Second Question**: Asks second question in same turn
- **Turn Completion**: Verifies turn ends after second question

**Validates**: Double question logic, power-up state management

### 🔍 **Phase 4: Other Power-ups**
- **Reveal Attribute**: Tests attribute revelation power-up
- **Power-up Integration**: Ensures power-ups work with normal gameplay
- **Cooldown Logic**: Validates power-up usage restrictions

**Validates**: All power-up types, usage restrictions

### 🏆 **Phase 5: Game Completion**
- **Guess Mechanics**: Tests character guessing
- **Win Conditions**: Validates game end scenarios
- **State Cleanup**: Ensures proper game termination

**Validates**: Game completion flow, win/lose conditions

## Test Results Interpretation

### ✅ **PASS Results**
- Feature works as expected
- No errors or unexpected behavior
- Proper state management

### ❌ **FAIL Results**
- Feature broken or not working
- Errors occurred during testing
- Unexpected behavior detected

### ℹ️ **INFO Results**
- Informational messages
- Expected errors (like "not your turn")
- System notifications

## Key Features Tested

### **Double Question Power-up** 🎯
```
✅ Power-up activation
✅ First question allowed
✅ Turn doesn't end after first question
✅ Second question allowed
✅ Turn ends after second question
✅ No guessing allowed during double question turn
```

### **Timer Synchronization** ⏰
```
✅ Server broadcasts timer updates
✅ All clients receive same time
✅ Timer counts down correctly
✅ Turn timeout handling
```

### **Turn Management** 🔄
```
✅ Correct turn assignment
✅ Turn state reset between turns
✅ Power-up state management
✅ Question/answer flow
```

### **Connection & Lobby** 🔗
```
✅ WebSocket connections
✅ Room creation/joining
✅ Player ready states
✅ Game initialization
```

## Automated Validation

The test script automatically validates:

1. **Message Flow**: All WebSocket messages are properly formatted and handled
2. **State Consistency**: Game state remains consistent across both clients
3. **Feature Completeness**: All major features are exercised
4. **Error Handling**: Expected errors are handled gracefully
5. **Performance**: Operations complete within reasonable timeframes

## Sample Output

```
🚀 Starting Guest Quest Game Test

📡 Phase 1: Connection and Lobby Setup
[TestPlayer1] ✅ Connected to server
[TestPlayer2] ✅ Connected to server
[TestPlayer1] 🏠 Room created: ABC123
[TestPlayer2] 👥 Room updated - 2 players

🎮 Phase 2: Basic Gameplay Testing
[TestPlayer1] 🎮 Game started! Character: Alice, My turn: true
[TestPlayer1] ❓ Asked question: "Are you male?"
[TestPlayer2] ✅ Answered: "no"

🎯 Phase 3: Power-up Testing (Double Question)
[TestPlayer2] 🎯 Used power-up: double_question
[TestPlayer2] ❓ Asked question: "Do you have blonde hair?"
[TestPlayer1] ✅ Answered: "yes"
[TestPlayer2] ❓ Asked question: "Are you young?"
[TestPlayer1] ✅ Answered: "maybe"

📊 TEST RESULTS FOR TestPlayer1:
==================================================
✅ Connection: PASS - WebSocket connected successfully
✅ Room Creation: PASS - Room ABC123 created
✅ Game Start: PASS - Character assigned: Alice
✅ Double Question Power-up: PASS - Double question activated
✅ Timer Synchronization: PASS - Server timer sync working
==================================================
📈 Summary: 12 passed, 0 failed, 2 info

🎉 ALL TESTS PASSED! Game is working correctly.
```

## Troubleshooting

### Common Issues

1. **Connection Failed**: Ensure server is running on port 3000
2. **Test Timeout**: Server might be overloaded, try restarting
3. **WebSocket Errors**: Check firewall/network settings

### Debug Mode

Add debug logging by modifying the test script:
```javascript
// Enable verbose logging
const DEBUG = true;
```

## Extending Tests

To add new test scenarios:

1. **Add new test phase** in `runGameTest()` function
2. **Create test methods** in `GameTestClient` class
3. **Add result validation** in message handlers
4. **Update documentation** with new test coverage

The test system is designed to be easily extensible for future features and edge cases.