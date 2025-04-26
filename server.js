const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    let extname = String(path.extname(filePath)).toLowerCase();
    let mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
    };
    let contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });

// Game data structures
const rooms = new Map();
const DEFAULT_ROUND_COUNT = 5;
const MAX_EMOJI_COUNT = 5;
const MIN_EMOJI_COUNT = 3;
const EMOJI_SELECTION_TIME = 30; // seconds
const GUESSING_WINDOW_TIME = 60; // seconds
const HINT_INTERVAL = 15; // seconds
const ROUND_TRANSITION_TIME = 10; // seconds

// Game modes
const GAME_MODES = {
    STANDARD: 'standard', // Emoji Lockdown - normal mode
    STORY: 'story'        // Story of Emojis - story mode
};

// Sample prompts for the standard game mode
const prompts = [
    // Tech commands
    "system reboot", "force shutdown", "launch application", "encrypt data",
    "cloud backup", "factory reset", "password reset", "firewall enable",
    "download update", "delete file", "optimize system", "troubleshoot network",
    "run diagnostics", "install driver", "scan for virus", "debug program",
    "activate protocol", "initiate sequence", "sync devices", "restore settings",
    
    // Cyber-security terms
    "data breach", "zero day exploit", "malware attack", "proxy server",
    "encryption key", "network firewall", "secure socket", "digital signature",
    "authentication protocol", "ransomware threat", "phishing attempt", "backdoor access",
    "brute force", "denial of service", "man in the middle", "security patch",
    "vulnerability scan", "password hash", "trojan horse", "biometric verification",
    
    // Tech phrases
    "artificial intelligence", "quantum computing", "neural network", "blockchain technology",
    "virtual reality", "augmented reality", "machine learning", "data mining",
    "internet of things", "cloud computing", "big data analysis", "facial recognition",
    "voice assistant", "wireless connectivity", "digital transformation", "autonomous vehicle"
];

// Sample prompts for the story mode
const storyPrompts = [
    "Once upon a time", "In a distant galaxy", "Deep in the forest", 
    "On a stormy night", "Under the sea", "In a magical kingdom",
    "During an adventure", "In the ancient temple", "Aboard a space station",
    "Inside a secret lab", "Beyond the mountains", "Through the portal",
    "When time stopped", "In the hidden village", "Beneath the surface",
    "Between dimensions", "Among the stars", "Across the desert",
    "Within the dream", "Before the dawn", "After the storm"
];

function generateRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (rooms.has(code)); 
    return code;
}

function broadcast(roomCode, message, sender) {
    const room = rooms.get(roomCode);
    if (room) {
        room.players.forEach((playerInfo, client) => {
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

function broadcastToAll(roomCode, message) {
    const room = rooms.get(roomCode);
    if (room) {
        room.players.forEach((playerInfo, client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

function getPlayerList(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return [];
    return Array.from(room.players.entries()).map(([client, p]) => ({
        name: p.name,
        id: p.id,
        score: p.score || 0,
        isEmojier: p.id === room.currentEmojier,
        isHost: p.isHost || false,
        isStoryCreator: p.id === room.storyCreator
    }));
}

function getRandomPrompt(gameMode = GAME_MODES.STANDARD) {
    if (gameMode === GAME_MODES.STORY) {
        return storyPrompts[Math.floor(Math.random() * storyPrompts.length)];
    }
    return prompts[Math.floor(Math.random() * prompts.length)];
}

function startNewRound(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    // Clear previous timers
    clearTimeout(room.roundTimer);
    clearTimeout(room.hintTimer);
    
    // Increment round counter
    room.currentRound++;
    
    // Check if game is complete
    if (room.currentRound > room.totalRounds) {
        // Game is over
        const finalScores = getPlayerList(roomCode).sort((a, b) => b.score - a.score);
        broadcastToAll(roomCode, {
            type: 'gameOver',
            scores: finalScores,
            winner: finalScores[0],
            storyChain: room.gameMode === GAME_MODES.STORY ? room.storyChain : null
        });
        return;
    }
    
    // Select next emojier/story creator (rotate among players)
    const playerIds = Array.from(room.players.values()).map(p => p.id);
    
    if (room.gameMode === GAME_MODES.STANDARD) {
        const nextEmojierIndex = playerIds.indexOf(room.currentEmojier) + 1;
        room.currentEmojier = playerIds[nextEmojierIndex % playerIds.length];
        room.storyCreator = null;
    } else {
        // Story mode - select next story creator
        const nextCreatorIndex = playerIds.indexOf(room.storyCreator) + 1;
        room.storyCreator = playerIds[nextCreatorIndex % playerIds.length];
        room.currentEmojier = null;
    }
    
    // Reset round state
    room.selectedEmojis = [];
    room.revealedHints = '';
    room.guessedPlayers = new Set();
    room.roundPhase = 'prep'; // prep, emoji-selection, guessing, reveal
    
    // Notify all players about new round
    broadcastToAll(roomCode, {
        type: 'newRound',
        round: room.currentRound,
        totalRounds: room.totalRounds,
        currentEmojier: room.currentEmojier,
        storyCreator: room.storyCreator,
        gameMode: room.gameMode,
        players: getPlayerList(roomCode)
    });
    
    // For story mode, let the story creator set the prompt
    if (room.gameMode === GAME_MODES.STORY) {
        // Wait for prompt from story creator
        const storyCreatorClient = Array.from(room.players.entries()).find(([_, p]) => p.id === room.storyCreator)?.[0];
        
        if (storyCreatorClient && storyCreatorClient.readyState === WebSocket.OPEN) {
            storyCreatorClient.send(JSON.stringify({
                type: 'promptAssigned',
                prompt: "Create a story prompt"
            }));
        }
        
        // Start emoji selection phase after story creator sets prompt or after timeout
        room.roundTimer = setTimeout(() => {
            if (room.currentPrompt) {
                startEmojiSelectionPhase(roomCode);
            } else {
                // Auto-generate prompt if creator didn't set one
                room.currentPrompt = getRandomPrompt(GAME_MODES.STORY);
                createNewStoryPrompt(roomCode, room.currentPrompt);
                startEmojiSelectionPhase(roomCode);
            }
        }, 20000); // 20 seconds to create a prompt
    } else {
        // Standard mode - assign random prompt to emojier
        room.currentPrompt = getRandomPrompt();
        
        // Send the prompt to the emojier
        const emojierClient = Array.from(room.players.entries()).find(([_, p]) => p.id === room.currentEmojier)?.[0];
        if (emojierClient && emojierClient.readyState === WebSocket.OPEN) {
            emojierClient.send(JSON.stringify({
                type: 'promptAssigned',
                prompt: room.currentPrompt
            }));
        }
        
        // Start emoji selection phase after 5s prep time
        room.roundTimer = setTimeout(() => {
            startEmojiSelectionPhase(roomCode);
        }, 5000); // 5 seconds prep time
    }
}

function createNewStoryPrompt(roomCode, prompt) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const storyCreator = Array.from(room.players.values()).find(p => p.id === room.storyCreator);
    if (!storyCreator) return;
    
    room.currentPrompt = prompt;
    
    // Create a new story item
    const storyItem = {
        prompt: prompt,
        emojis: [],
        creatorId: storyCreator.id,
        creatorName: storyCreator.name,
        guess: null,
        guesserId: null,
        guesserName: null
    };
    
    room.storyChain.push(storyItem);
    
    // Broadcast to all players
    broadcastToAll(roomCode, {
        type: 'storyPromptCreated',
        prompt: prompt,
        creatorId: storyCreator.id,
        creatorName: storyCreator.name,
        storyItem: storyItem
    });
    
    return storyItem;
}

function startEmojiSelectionPhase(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    room.roundPhase = 'emoji-selection';
    broadcastToAll(roomCode, {
        type: 'emojiSelectionPhase',
        timeLimit: EMOJI_SELECTION_TIME
    });
    
    // If emojier/story creator doesn't select all emojis, auto-transition after selection time
    room.roundTimer = setTimeout(() => {
        if (room.roundPhase === 'emoji-selection') {
            startGuessingPhase(roomCode);
        }
    }, EMOJI_SELECTION_TIME * 1000);
}

function startGuessingPhase(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    // Need at least MIN_EMOJI_COUNT emojis to proceed
    if (room.selectedEmojis.length < MIN_EMOJI_COUNT) {
        // Auto-select random emojis to reach minimum
        const commonEmojis = ['🖥️', '📱', '💾', '🔒', '🔓', '💻', '⚙️', '📡'];
        
        // For story mode, use more story-oriented emojis
        const storyEmojis = ['📖', '🧙', '🦸', '🌟', '🏰', '🌈', '🔮', '🧚'];
        
        const emojiSet = room.gameMode === GAME_MODES.STORY ? storyEmojis : commonEmojis;
        
        while (room.selectedEmojis.length < MIN_EMOJI_COUNT) {
            const randomEmoji = emojiSet[Math.floor(Math.random() * emojiSet.length)];
            room.selectedEmojis.push(randomEmoji);
        }
        
        // Update story item with emojis for story mode
        if (room.gameMode === GAME_MODES.STORY && room.storyChain.length > 0) {
            const currentStoryItem = room.storyChain[room.storyChain.length - 1];
            currentStoryItem.emojis = [...room.selectedEmojis];
        }
    }
    
    room.roundPhase = 'guessing';
    room.hintRevealCount = 0;
    
    // Generate masked version of prompt for hints (only in standard mode)
    if (room.gameMode === GAME_MODES.STANDARD) {
        room.promptMask = room.currentPrompt.replace(/[a-zA-Z]/g, '_');
    } else {
        room.promptMask = "Continue the story...";
    }
    
    broadcastToAll(roomCode, {
        type: 'guessingPhase',
        emojis: room.selectedEmojis,
        timeLimit: GUESSING_WINDOW_TIME,
        hint: room.promptMask,
        gameMode: room.gameMode
    });
    
    // Set hint timer for standard mode
    if (room.gameMode === GAME_MODES.STANDARD) {
        room.hintTimer = setTimeout(() => revealHint(roomCode), HINT_INTERVAL * 1000);
    }
    
    // Set round end timer
    room.roundTimer = setTimeout(() => {
        endRound(roomCode);
    }, GUESSING_WINDOW_TIME * 1000);
}

function revealHint(roomCode) {
    const room = rooms.get(roomCode);
    if (!room || room.roundPhase !== 'guessing' || room.gameMode !== GAME_MODES.STANDARD) return;
    
    // Find unrevealed character
    const promptChars = room.currentPrompt.split('');
    const maskChars = room.promptMask.split('');
    
    const hiddenIndices = [];
    for (let i = 0; i < maskChars.length; i++) {
        if (maskChars[i] === '_' && /[a-zA-Z]/.test(promptChars[i])) {
            hiddenIndices.push(i);
        }
    }
    
    if (hiddenIndices.length > 0) {
        // Reveal one random character
        const revealIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
        maskChars[revealIndex] = promptChars[revealIndex];
        room.promptMask = maskChars.join('');
        room.hintRevealCount++;
        
        broadcastToAll(roomCode, {
            type: 'hintRevealed',
            hint: room.promptMask
        });
        
        // Schedule next hint if there are still hidden characters
        if (hiddenIndices.length > 1) {
            room.hintTimer = setTimeout(() => revealHint(roomCode), HINT_INTERVAL * 1000);
        }
    }
}

function endRound(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    // Clear timers
    clearTimeout(room.roundTimer);
    clearTimeout(room.hintTimer);
    
    room.roundPhase = 'reveal';
    
    broadcastToAll(roomCode, {
        type: 'roundEnd',
        prompt: room.currentPrompt,
        emojis: room.selectedEmojis,
        nextRoundIn: ROUND_TRANSITION_TIME,
        players: getPlayerList(roomCode)
    });
    
    // Start next round after transition time
    room.roundTimer = setTimeout(() => {
        startNewRound(roomCode);
    }, ROUND_TRANSITION_TIME * 1000);
}

function calculateScore(isFirst, hintCount, wasQuick, gameMode) {
    let score = 0;
    
    if (gameMode === GAME_MODES.STORY) {
        // In story mode, points are simpler
        return isFirst ? 8 : 5;
    }
    
    if (isFirst) {
        // Base score for first correct guess
        score = Math.max(10 - (2 * hintCount), 4);
        
        // Speed bonus
        if (wasQuick) {
            score += 3;
        }
    } else {
        // Subsequent correct guesses get less
        score = Math.max(6 - (2 * hintCount), 2);
    }
    
    return score;
}

function generatePlayerId() {
    return Math.random().toString(36).substring(2, 15);
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    let currentRoom = null;
    let playerName = 'Anonymous';
    let playerId = generatePlayerId();

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data.type);

            switch (data.type) {
                case 'createRoom':
                    playerName = data.name || 'Anonymous';
                    const newRoomCode = generateRoomCode();
                    
                    const newRoom = {
                        players: new Map(),
                        currentRound: 0,
                        totalRounds: data.rounds || DEFAULT_ROUND_COUNT,
                        currentEmojier: null, // Will be set when starting the game
                        storyCreator: null,  // For story mode
                        currentPrompt: '',
                        selectedEmojis: [],
                        roundPhase: 'waiting', // waiting, prep, emoji-selection, guessing, reveal
                        guessedPlayers: new Set(),
                        hintRevealCount: 0,
                        promptMask: '',
                        gameStarted: false,
                        gameMode: GAME_MODES.STANDARD, // Default mode
                        storyChain: [], // For story mode
                        roundTimer: null,
                        hintTimer: null
                    };
                    
                    const playerInfo = {
                        name: playerName,
                        id: playerId,
                        score: 0,
                        isHost: true
                    };
                    
                    newRoom.players.set(ws, playerInfo);
                    rooms.set(newRoomCode, newRoom);
                    currentRoom = newRoomCode;
                    
                    ws.send(JSON.stringify({
                        type: 'roomCreated',
                        roomCode: newRoomCode,
                        players: getPlayerList(newRoomCode),
                        playerId: playerId,
                        isHost: true
                    }));
                    
                    console.log(`Room ${newRoomCode} created by ${playerName}`);
                    break;

                case 'joinRoom':
                    playerName = data.name || 'Anonymous';
                    const joinCode = data.roomCode?.toUpperCase();
                    const joinRoom = rooms.get(joinCode);
                    if (!joinRoom) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                        break;
                    }
                    const joinPlayerInfo = {
                        name: playerName,
                        id: playerId,
                        score: 0,
                        isHost: false
                    };
                    joinRoom.players.set(ws, joinPlayerInfo);
                    currentRoom = joinCode;
                    ws.send(JSON.stringify({
                        type: 'joinedRoom',
                        roomCode: joinCode,
                        playerId: playerId,
                        isHost: false,
                        players: getPlayerList(joinCode)
                    }));
                    broadcast(joinCode, {
                        type: 'playerJoined',
                        players: getPlayerList(joinCode)
                    }, ws);
                    break;

                case 'startGame':
                    // Use roomCode from the message data
                    const roomCodeToStart = data.roomCode;
                    console.log(`Received startGame request. Room code: ${roomCodeToStart}, Rounds: ${data.rounds}, Mode: ${data.gameMode}`);
                    
                    if (roomCodeToStart) {
                        const startRoom = rooms.get(roomCodeToStart);
                        console.log(`Room exists: ${!!startRoom}`);
                        
                        // Verify the sender is the host of this room
                        const playerInfo = startRoom?.players.get(ws);
                        console.log(`Player info:`, playerInfo ? {
                            name: playerInfo.name,
                            id: playerInfo.id,
                            isHost: playerInfo.isHost
                        } : 'null');
                        
                        if (startRoom && playerInfo && playerInfo.isHost && !startRoom.gameStarted) {
                            console.log(`Starting game in room ${roomCodeToStart}`);
                            // Update room settings with client-provided values
                            startRoom.totalRounds = data.rounds || DEFAULT_ROUND_COUNT;
                            startRoom.gameMode = data.gameMode || GAME_MODES.STANDARD;
                            startRoom.gameStarted = true;
                            startRoom.currentRound = 0; // Will be incremented to 1 in startNewRound
                            
                            // Use roomCodeToStart for broadcasting and starting the round
                            broadcastToAll(roomCodeToStart, {
                                type: 'gameStarted',
                                players: getPlayerList(roomCodeToStart),
                                rounds: startRoom.totalRounds, // Use correct property
                                gameMode: startRoom.gameMode, // Use correct property
                                currentRound: 1 // Start at round 1
                            });
                            startNewRound(roomCodeToStart);
                        } else if (startRoom && startRoom.gameStarted) {
                            console.log(`Game already started in room ${roomCodeToStart}`);
                            ws.send(JSON.stringify({ type: 'error', message: 'Game already started.' }));
                        } else if (!playerInfo || !playerInfo.isHost) {
                            console.log(`User is not host in room ${roomCodeToStart}`);
                            ws.send(JSON.stringify({ type: 'error', message: 'Only the host can start the game.' }));
                        } else {
                            console.log(`Could not start game in room ${roomCodeToStart}. Unknown error.`);
                            ws.send(JSON.stringify({ type: 'error', message: 'Could not start game.' }));
                        }
                    } else {
                        console.log(`Invalid room code in startGame request`);
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid room code.' }));
                    }
                    break;
                
                case 'submitGuess':
                    if (currentRoom) {
                        const room = rooms.get(currentRoom);
                        if (room && room.roundPhase === 'guessing') {
                            console.log(`Received guess from player in room ${currentRoom}`);
                            const playerInfo = room.players.get(ws);
                            const guess = data.guess.trim().toLowerCase();
                            const expectedAnswer = room.currentPrompt.toLowerCase();
                            
                            // Skip if player already guessed correctly
                            if (room.guessedPlayers.has(playerInfo.id)) {
                                console.log(`Player ${playerInfo.name} already guessed correctly`);
                                break;
                            }
                            
                            // Check if guess is correct
                            if (guess === expectedAnswer) {
                                console.log(`Correct guess by ${playerInfo.name}: "${guess}"`);
                                // Mark player as having guessed correctly
                                room.guessedPlayers.add(playerInfo.id);
                                
                                // Calculate score based on timing and hints
                                const isFirstCorrectGuess = room.guessedPlayers.size === 1;
                                const wasQuick = data.timeToGuess < 15; // Consider it quick if under 15 seconds
                                const scoreEarned = calculateScore(isFirstCorrectGuess, room.hintRevealCount, wasQuick, room.gameMode);
                                
                                // Update player's score
                                playerInfo.score = (playerInfo.score || 0) + scoreEarned;
                                
                                // For Story mode, save the guess to story chain
                                if (room.gameMode === GAME_MODES.STORY && room.storyChain.length > 0) {
                                    const currentStoryItem = room.storyChain[room.storyChain.length - 1];
                                    currentStoryItem.guess = guess;
                                    currentStoryItem.guesserId = playerInfo.id;
                                    currentStoryItem.guesserName = playerInfo.name;
                                }
                                
                                // Broadcast to all players
                                broadcastToAll(currentRoom, {
                                    type: 'correctGuess',
                                    playerId: playerInfo.id,
                                    playerName: playerInfo.name,
                                    isFirst: isFirstCorrectGuess,
                                    scoreEarned: scoreEarned,
                                    players: getPlayerList(currentRoom)
                                });
                                
                                // If this is the first correct guess, reduce remaining time
                                if (isFirstCorrectGuess) {
                                    clearTimeout(room.roundTimer);
                                    clearTimeout(room.hintTimer);
                                    
                                    // Give 15 more seconds for others to guess
                                    room.roundTimer = setTimeout(() => {
                                        endRound(currentRoom);
                                    }, 15000); // 15 seconds
                                    
                                    broadcastToAll(currentRoom, {
                                        type: 'timeReduced',
                                        remainingTime: 15
                                    });
                                }
                            } else {
                                // Wrong guess - notify only the guesser
                                ws.send(JSON.stringify({
                                    type: 'wrongGuess',
                                    guess: guess
                                }));
                                
                                // Broadcast to others that someone guessed wrong (but not what they guessed)
                                broadcast(currentRoom, {
                                    type: 'playerGuessedWrong',
                                    playerId: playerInfo.id,
                                    playerName: playerInfo.name
                                }, ws);
                            }
                        }
                    }
                    break;
                
                case 'leaveRoom':
                    if (currentRoom) {
                        const room = rooms.get(currentRoom);
                        if (room) {
                            const playerInfo = room.players.get(ws);
                            room.players.delete(ws);
                            
                            if (room.players.size === 0) {
                                // Last player left, delete the room
                                clearTimeout(room.roundTimer);
                                clearTimeout(room.hintTimer);
                                rooms.delete(currentRoom);
                                console.log(`Room ${currentRoom} closed.`);
                            } else {
                                // Notify remaining players
                                const remainingPlayers = getPlayerList(currentRoom);
                                broadcast(currentRoom, { 
                                    type: 'playerLeft', 
                                    playerId: playerInfo.id,
                                    name: playerInfo.name,
                                    players: remainingPlayers 
                                }, null);
                                
                                // If the host left, assign a new host
                                if (playerInfo.isHost) {
                                    const [newHostClient] = room.players.keys();
                                    const newHostInfo = room.players.get(newHostClient);
                                    newHostInfo.isHost = true;
                                    
                                    // Notify the new host
                                    if (newHostClient.readyState === WebSocket.OPEN) {
                                        newHostClient.send(JSON.stringify({
                                            type: 'becameHost'
                                        }));
                                    }
                                    
                                    // Notify others of new host
                                    broadcast(currentRoom, {
                                        type: 'newHost',
                                        hostId: newHostInfo.id,
                                        hostName: newHostInfo.name
                                    }, newHostClient);
                                }
                                
                                // If the emojier left during their turn, end the round
                                if (room.gameStarted && 
                                    room.currentEmojier === playerInfo.id &&
                                    (room.roundPhase === 'prep' || 
                                     room.roundPhase === 'emoji-selection')) {
                                    
                                    clearTimeout(room.roundTimer);
                                    clearTimeout(room.hintTimer);
                                    
                                    broadcastToAll(currentRoom, {
                                        type: 'emojierLeft',
                                        message: `${playerInfo.name} left the game.`
                                    });
                                    
                                    // Wait 3 seconds and start a new round
                                    setTimeout(() => {
                                        startNewRound(currentRoom);
                                    }, 3000);
                                }
                                
                                console.log(`${playerInfo.name} left room ${currentRoom}.`);
                            }
                            ws.send(JSON.stringify({ type: 'leftRoom' }));
                        }
                        currentRoom = null;
                    }
                    break;

                case 'newRound':
                    // Handle new round messages
                    currentRoundDisplay.textContent = data.currentRound;
                    totalRoundsDisplay.textContent = data.totalRounds;
                    roundStatus.textContent = `Round ${data.currentRound} starting...`;
                    isEmojier = data.currentEmojier === playerId;
                    isStoryCreator = data.gameMode === 'story' && data.storyCreator === playerId;
                    showEmojierOrGuesserUI();
                    break;

                case 'promptAssigned':
                    // Handle prompt assignment
                    if (isEmojier || isStoryCreator) {
                        promptWord.textContent = data.prompt;
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to process message or invalid JSON:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                const playerInfo = room.players.get(ws);
                room.players.delete(ws);
                
                if (playerInfo) {
                    if (room.players.size === 0) {
                        // Last player left, delete room and clean up timers
                        clearTimeout(room.roundTimer);
                        clearTimeout(room.hintTimer);
                        rooms.delete(currentRoom);
                        console.log(`Room ${currentRoom} closed.`);
                    } else {
                        // Notify remaining players
                        broadcast(currentRoom, { 
                            type: 'playerLeft', 
                            playerId: playerInfo.id,
                            name: playerInfo.name,
                            players: getPlayerList(currentRoom) 
                        }, null);
                        
                        // If the host left, assign a new host
                        if (playerInfo.isHost) {
                            const [newHostClient] = room.players.keys();
                            const newHostInfo = room.players.get(newHostClient);
                            newHostInfo.isHost = true;
                            
                            // Notify the new host
                            if (newHostClient.readyState === WebSocket.OPEN) {
                                newHostClient.send(JSON.stringify({
                                    type: 'becameHost'
                                }));
                            }
                            
                            // Notify others of new host
                            broadcast(currentRoom, {
                                type: 'newHost',
                                hostId: newHostInfo.id,
                                hostName: newHostInfo.name
                            }, newHostClient);
                        }
                        
                        // If the emojier left during their turn, end the round
                        if (room.gameStarted && 
                            room.currentEmojier === playerInfo.id &&
                            (room.roundPhase === 'prep' || 
                             room.roundPhase === 'emoji-selection')) {
                            
                            clearTimeout(room.roundTimer);
                            clearTimeout(room.hintTimer);
                            
                            broadcastToAll(currentRoom, {
                                type: 'emojierLeft',
                                message: `${playerInfo.name} left the game.`
                            });
                            
                            // Wait 3 seconds and start a new round
                            setTimeout(() => {
                                startNewRound(currentRoom);
                            }, 3000);
                        }
                    }
                }
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                const playerInfo = room.players.get(ws);
                room.players.delete(ws);
                
                if (room.players.size === 0) {
                    clearTimeout(room.roundTimer);
                    clearTimeout(room.hintTimer);
                    rooms.delete(currentRoom);
                } else if (playerInfo) {
                    broadcast(currentRoom, { 
                        type: 'playerLeft', 
                        playerId: playerInfo.id,
                        name: playerInfo.name,
                        players: getPlayerList(currentRoom) 
                    }, ws);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Access the client at http://localhost:${PORT}`);
});