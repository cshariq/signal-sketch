// DOM Elements
const nameInput = document.getElementById('joinCode');
const createRoomBtn = document.getElementById('create-room-btn'); 
const joinRoomBtn = document.getElementById('join-room-btn');     
const leaveRoomBtn = document.getElementById('leave-room-btn');
const entrySection = document.querySelector('.join-element');
const errorMessage = document.getElementById('snackbar');
const roomSection = document.getElementById('room-section');
const gameContainer = document.getElementById('game-container');
const playerList = document.getElementById('player-list');
const gameConfig = document.getElementById('game-config');
const startGameBtn = document.getElementById('start-game-btn');
const roundsInput = document.getElementById('roundsInput');
const currentRoundDisplay = document.getElementById('current-round');
const totalRoundsDisplay = document.getElementById('total-rounds');
const roundStatus = document.getElementById('round-status');
const emojiDisplay = document.getElementById('emoji-display');
const emojiPicker = document.getElementById('emoji-picker');
const emojierSection = document.getElementById('emojier-section');
const guesserSection = document.getElementById('guesser-section');
const storyModeSection = document.getElementById('story-mode-section');
const storyChain = document.getElementById('story-chain');
const nextPromptContainer = document.getElementById('next-prompt-container');
const nextPromptInput = document.getElementById('next-prompt-input');
const submitStoryPromptBtn = document.getElementById('submit-story-prompt-btn');
const promptWord = document.getElementById('prompt-word');
const hintDisplay = document.getElementById('hint-display');
const guessInput = document.getElementById('guess-input');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const lockEmojisBtn = document.getElementById('lock-emojis-btn');
const timerBar = document.getElementById('timer-bar');
const roundResults = document.getElementById('round-results');
const answerDisplay = document.getElementById('answer-display');
const leaderboardList = document.getElementById('leaderboard-list');
const modeOptions = document.querySelectorAll('.mode-option');

// Game state
let name = '';
let joiningRoom = false;
let currentRoomCode = null;
let isEmojier = false;
let isHost = false;
let playerId = null;
let gameInProgress = false;
let selectedEmojis = [];
let gameTimer = null;
let timerStartTime = 0;
let timerDuration = 0;
let guessStartTime = 0;
let selectedGameMode = 'standard'; // Default mode is standard (Emoji Lockdown)
let currentStoryPrompt = '';
let storyChainData = [];
let isStoryCreator = false;

// WebSocket setup
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsURL = `${wsProtocol}//${window.location.host}`; 
let ws;

// Common emojis for the game
const commonEmojis = [
    '🖥️', '🔒', '🔓', '⚡', '🔋', '💾', '💻', '📱', '🔌', '📶', '🌐', '🛜', '📡', 
    '📊', '📉', '📈', '⏱️', '⚠️', '❌', '✅', '❓', '❗', '💬', '👁️', '🔍', '🔑', '🔐', 
    '🔏', '🔗', '⚙️', '📁', '📂', '📄', '✉️', '📧', '🔔', '💿', '📀', '🧠', '💡', 
    '⚡️', '🤖', '👾', '🎮', '🎯', '🎲', '🧩', '📦', '🚫', '⛔', '🔄', '↩️', '↪️', 
    '⬆️', '⬇️', '➡️', '⬅️', '🔼', '🔽', '📌', '📎', '📋', '🖊️', '📝', '🛠️', '🔨', 
    '🔧', '💰', '💵', '🕒', '🪫', '🔥', '💥', '🧪', '🧫', '🧬', '🔬', '🔭', '📟'
];

// Story mode additional emojis
const storyEmojis = [
    '😀', '😂', '😍', '🤔', '😎', '😴', '🥳', '😱', '🙄', '🤯', '👋', '👍', '👎', '👏',
    '🤝', '🙏', '👀', '👣', '🧠', '🧙', '🧟', '🧞', '👮', '👨‍💻', '👩‍🔬', '👨‍🚀', '🧑‍🚒', 
    '🐶', '🐱', '🐭', '🦊', '🐻', '🐼', '🐸', '🐵', '🦁', '🐯', '🐨', '🐰', '🦇', '🦉', 
    '🌍', '🌈', '☀️', '🌤️', '⛅', '🌧️', '⛈️', '🌨️', '❄️', '🌪️', '🌊', '🌋', '🏔️', '🏕️', 
    '🏠', '🏢', '🏰', '🏗️', '🏭', '🏥', '🚀', '✈️', '🚁', '⛵', '🚢', '🚗', '🚕', '🚌', 
    '🚓', '🚑', '🏎️', '🛻', '🚲', '🚂', '🚆', '🔮', '💎', '🧲', '⚔️', '🛡️', '🔫', '🧨',
    '🎁', '🎊', '🎉', '🏆', '🎖️', '🥇', '🎭', '🎬', '🎼', '🎹', '🥁', '🎸', '🎺', '🎻'
];

// Game sound effects
const correctSound = new Audio('https://assets.mixkit.co/active_storage/sfx/254/254-preview.mp3');
const wrongSound = new Audio('https://assets.mixkit.co/active_storage/sfx/255/255-preview.mp3');
const timerSound = new Audio('https://assets.mixkit.co/active_storage/sfx/133/133-preview.mp3');
const newEmojiSound = new Audio('https://assets.mixkit.co/active_storage/sfx/270/270-preview.mp3');

// Initialize connection when page loads
window.addEventListener('load', () => {
    connectWebSocket();
    setupGameModeSelection();
});

async function fetchWeatherData() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const url = `https://api.weather.com/v1/geocode/${latitude}/${longitude}/aggregate.json?apiKey=e45ff1b7c7bda231216c7ab7c33509b8&products=conditionsshort,fcstdaily10short,fcsthourly24short,nowlinks`;

                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    resolve(data); // Resolve the promise with the fetched data
                } catch (error) {
                    console.error('Error fetching weather data:', error);
                    reject(error); // Reject the promise on error
                }
            },
            (error) => {
                console.error('Error getting location:', error);
                reject(error); // Reject the promise if geolocation fails
            },
            { enableHighAccuracy: true, timeout: 50000 }
        );
    });
}
  
const locations = {
    1: { city: 'Ottawa', latitude: 45.42381580972502, longitude: -75.70084317193432 },
    2: { city: 'Montreal', latitude: 45.57033839445598, longitude: -73.75116670328264 },
    3: { city: 'Toronto', latitude: 43.642636047265256, longitude: -79.38704607385121 },
    4: { city: 'New York', latitude: 40.74861108501115, longitude: -73.98541765439792 },
    5: { city: 'Boston', latitude: 42.37492421787936, longitude: -71.11827026040476 },
    6: { city: 'San Francisco', latitude: 37.82290114151289, longitude: -122.47474701281506 },
    7: { city: 'Los Angeles', latitude: 34.15992747939338, longitude: -118.32526286103236 },
};

function connectWebSocket() {
    ws = new WebSocket(wsURL);

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        errorMessage.textContent = ''; 
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Message from server:', data);
            handleServerMessage(data);
        } catch (error) {
            console.error('Failed to parse message or invalid JSON:', event.data, error);
            showSnackbar('Received invalid data from server.');
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        showSnackbar('WebSocket connection error. Please try refreshing.');
        showEntrySection(); 
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
        if (!errorMessage.textContent) {
             showSnackbar('Connection closed. Please refresh to reconnect.');
        }
        showEntrySection();
    };
}

// Handle incoming server messages
async function handleServerMessage(data) {
    switch (data.type) {
        case 'roomCreated':
            currentRoomCode = data.roomCode;
            isHost = true;
            playerId = data.playerId;
            showRoomSection(data.roomCode);
            updatePlayerList(data.players);
            break;
            
        case 'joinedRoom':
            currentRoomCode = data.roomCode;
            playerId = data.playerId;
            isHost = data.isHost;
            showRoomSection(data.roomCode);
            updatePlayerList(data.players);
            break;
            
        case 'playerJoined':
        case 'playerLeft':
        case 'newHost':
            updatePlayerList(data.players);
            updateLeaderboard(data.players);
            break;
            
        case 'gameStarted':
            startGame(data);
            break;
            
        case 'assignEmojier':
            isEmojier = data.playerId === playerId;
            isStoryCreator = selectedGameMode === 'story' && data.playerId === playerId;
            showEmojierOrGuesserUI();
            break;
            
        case 'roundStart':
            setupRound(data);
            break;
            
        case 'emojisLocked':
            handleEmojisLocked(data);
            break;
            
        case 'hintUpdate':
            updateHint(data.hint);
            break;
            
        case 'guessResult':
            handleGuessResult(data);
            break;
            
        case 'roundResult':
            showRoundResult(data);
            break;
            
        case 'gameEnded':
            endGame(data);
            break;
            
        case 'storyPrompt':
            handleStoryPrompt(data);
            break;
            
        case 'storyUpdate':
            updateStoryChain(data);
            break;
            
        case 'emojiSelected':
            // Update emoji display when an emoji is selected
            if (data.emojis && data.emojis.length) {
                selectedEmojis = data.emojis;
                updateEmojiDisplay();
                
                // Play sound for all players except the one who selected it
                if (data.playerId !== playerId) {
                    newEmojiSound.play();
                }
            }
            break;
            
        case 'emojiSelectionPhase':
            // Start emoji selection phase
            roundStatus.textContent = isEmojier ? 'Select your emojis!' : 'Waiting for emojis...';
            if (isEmojier) {
                setupEmojiPicker();
                selectedEmojis = [];
                updateEmojiDisplay();
            }
            
            // Start timer for emoji selection
            startTimer(data.timeLimit || 30);
            break;
            
        case 'guessingPhase':
            // Update emojis and start guessing
            if (data.emojis && data.emojis.length) {
                selectedEmojis = data.emojis;
                updateEmojiDisplay();
            }
            
            if (data.hint) {
                updateHint(data.hint);
            }
            
            // Start guessing phase UI
            handleEmojisLocked({
                emojis: data.emojis,
                timeLimitSeconds: data.timeLimit
            });
            break;
            
        case 'hintRevealed':
            updateHint(data.hint);
            break;
            
        case 'correctGuess':
            // Someone guessed correctly
            correctSound.play();
            updatePlayerList(data.players);
            updateLeaderboard(data.players);
            
            if (data.playerId === playerId) {
                showSnackbar(`Correct! You earned ${data.scoreEarned} points!`);
            } else {
                showSnackbar(`${data.playerName} guessed correctly and earned ${data.scoreEarned} points!`);
            }
            break;
            
        case 'wrongGuess':
            // You guessed wrong
            wrongSound.play();
            showSnackbar('Incorrect guess. Try again!');
            break;
            
        case 'playerGuessedWrong':
            // Someone else guessed wrong
            showSnackbar(`${data.playerName} made an incorrect guess`);
            break;
            
        case 'timeReduced':
            // First correct guess reduces time
            timerDuration = data.remainingTime * 1000;
            timerStartTime = Date.now();
            showSnackbar('Time reduced! Hurry up with your guess!');
            break;
            
        case 'roundEnd':
            // End of round
            stopTimer();
            showRoundResult({
                answer: data.prompt,
                currentRound: room.currentRound,
                players: data.players,
                storyChain: data.storyChain
            });
            break;
            
        case 'storyPromptCreated':
            // New story prompt created
            if (data.prompt && selectedGameMode === 'story') {
                currentStoryPrompt = data.prompt;
                if (isEmojier) {
                    promptWord.textContent = data.prompt;
                    lockEmojisBtn.disabled = selectedEmojis.length < 3;
                }
                
                updateStoryChain({
                    storyChain: [...storyChainData, {
                        prompt: data.prompt,
                        creatorName: data.creatorName,
                        emojis: []
                    }]
                });
            }
            break;
            
        case 'error':
            showSnackbar(data.message);
            break;
            
        default:
            console.log('Unhandled message type:', data.type);
    }
}

async function updatePlayerList(players) {
    console.log('Updating player list with:', players);
    playerList.innerHTML = '';
  
    let index = 0;
    for (const player of players) {
      let displayName, isEmojier, isHost, isStoryCreator, score;
  
      if (typeof player === 'string') {
        displayName = player === 'Anonymous'
          ? `Player ${index + 1}`
          : player;
        isEmojier = isHost = isStoryCreator = false;
        score = 0;
      } else {
        // Now this await really pauses each loop iteration
        try {
            const weatherData = await fetchWeatherData();
            console.log('Weather data:', weatherData);
            displayName = (player.name || `Player ${index + 1}`) + String(weatherData);
        } catch (error) {
            console.error('Failed to fetch weather data:', error);
            displayName = (player.name || `Player ${index + 1}`);
        }

        isEmojier = player.isEmojier || false;
        isHost = player.isHost || false;
        isStoryCreator = player.isStoryCreator || false;
        score = player.score || 0;
      }
  
      const playerItem = document.createElement('div');
      playerItem.className = `player-item ${isEmojier ? 'active' : ''}`;
      playerItem.innerHTML = `
        <div class="player-info">
          <span>${displayName}</span>
          <div class="player-role">
            ${isHost ? '<span title="Host">👑</span>' : ''}
            ${isEmojier ? '<span title="Emojier">🎮</span>' : ''}
            ${isStoryCreator ? '<span title="Story Creator">📖</span>' : ''}
          </div>
        </div>
        <span class="player-score">${score} pts</span>
      `;
      playerList.appendChild(playerItem);
  
      index++;
    }
  
    if (players.length === 0) {
      playerList.innerHTML = '<div class="player-item">No players yet</div>';
    }
}

function updateLeaderboard(players) {
    console.log("raw players for leaderboard:", players);
    if (!leaderboardList) return;
    
    leaderboardList.innerHTML = '';
    
    if (players && players.length > 0) {
        // Create array for sorting with correct handling of string or object values
        const playersForSort = players.map(player => {
            // If player is a string, convert to object format
            if (typeof player === 'string') {
                return {
                    displayName: player,
                    score: 0,
                    isEmojier: false,
                    isHost: false
                };
            } else {
                // Use existing object with proper name fallback
                return {
                    displayName: player.name || player.name || 'Unknown',
                    score: player.score || 0,
                    isEmojier: player.isEmojier || false,
                    isHost: player.isHost || false
                };
            }
        });
        
        // Sort by score descending
        const sortedPlayers = playersForSort.sort((a, b) => b.score - a.score);
        
        sortedPlayers.forEach((player, index) => {
            const item = document.createElement('li');
            item.className = 'leaderboard-item';
            
            // Add medal emoji for top 3 players
            let rankPrefix = '';
            if (index === 0) rankPrefix = '🥇 ';
            else if (index === 1) rankPrefix = '🥈 ';
            else if (index === 2) rankPrefix = '🥉 ';
            
            item.innerHTML = `
                <span>${rankPrefix}${player.displayName} 
                    ${player.isEmojier ? '🎮' : ''}
                    ${player.isHost ? '👑' : ''}
                </span>
                <span>${player.score} pts</span>
            `;
            leaderboardList.appendChild(item);
        });
    } else {
        leaderboardList.innerHTML = '<li class="leaderboard-item">No players yet</li>';
    }
}
// Game UI Functions
function showEntrySection() {
    entrySection.style.display = 'flex';
    gameContainer.style.display = 'none';
    leaveRoomBtn.style.display = 'none'; 
    gameConfig.style.display = 'none';
    roomSection.style.display = 'block';
    
    if (joiningRoom) {
        resetJoinUI();
    }

    stopTimer();
    playerId = null;
    isHost = false;
    isEmojier = false;
    isStoryCreator = false;
    gameInProgress = false;
    currentRoomCode = null;
    selectedGameMode = 'standard';
    storyChainData = [];
}

function resetJoinUI() {
    joiningRoom = false;
    nameInput.placeholder = "Enter Your Name";
    nameInput.value = '';
    name = '';
    createRoomBtn.style.display = 'flex'; 
    createRoomBtn.style.width = '50%'; 
    joinRoomBtn.style.width = '50%'; 
}

function showRoomCodeInput() {
    name = nameInput.value.trim();
    nameInput.value = '';
    nameInput.placeholder = "Enter Room Code";
    createRoomBtn.style.display = 'none'; 
    joinRoomBtn.style.width = '100%'; 
    joiningRoom = true;
}

function showRoomSection(roomCode) {
    entrySection.style.display = 'none';
    leaveRoomBtn.style.display = 'flex';
    roomSection.querySelector('#percentage-text').textContent = `Room Code: ${roomCode}`;
    currentRoomCode = roomCode;
    
    if (isHost) {
        gameConfig.style.display = 'block';
    }
}

function showGameContainer() {
    gameContainer.style.display = 'flex';
    gameConfig.style.display = 'none';
}

// Game Mode Selection
function setupGameModeSelection() {
    modeOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all options
            modeOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to selected option
            option.classList.add('active');
            
            // Update selected game mode
            selectedGameMode = option.dataset.mode;
            
            // Update server about mode change
            if (isHost) {
                sendMessage({
                    type: 'setGameMode',
                    mode: selectedGameMode
                });
            }
            
            console.log(`Game mode selected: ${selectedGameMode}`);
        });
    });
}

// Enhanced emoji picker setup
function setupEmojiPicker() {
    // Check if we're using the emoji-picker-element or our custom picker
    const useEmojiPickerElement = document.querySelector('emoji-picker') !== null;
    
    if (useEmojiPickerElement) {
        // Using the emoji-picker-element library
        const emojiPickerElement = document.createElement('emoji-picker');
        emojiPickerElement.classList.add('emoji-picker-element');
        emojiPicker.innerHTML = '';
        emojiPicker.appendChild(emojiPickerElement);
        
        // Event listener for emoji selection
        emojiPickerElement.addEventListener('emoji-click', event => {
            if (selectedEmojis.length < 5 && (isEmojier || isStoryCreator)) {
                selectEmoji(event.detail.unicode);
            }
        });
    } else {
        // Fallback to our custom picker
        emojiPicker.innerHTML = '';
        
        // Choose emoji set based on game mode
        const emojiSet = selectedGameMode === 'story' 
            ? [...commonEmojis, ...storyEmojis]
            : commonEmojis;
        
        emojiSet.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            emojiItem.addEventListener('click', () => selectEmoji(emoji));
            emojiPicker.appendChild(emojiItem);
        });
    }
}

function selectEmoji(emoji) {
    if (selectedEmojis.length >= 5 || (!isEmojier && !isStoryCreator)) return;
    
    newEmojiSound.play();
    selectedEmojis.push(emoji);
    
    // Update UI
    updateEmojiDisplay();
    
    // Enable lock button after minimum emojis
    if (selectedEmojis.length >= 3) {
        lockEmojisBtn.disabled = false;
    }
    
    // Send to server
    sendMessage({
        type: 'selectEmoji',
        emoji: emoji,
        gameMode: selectedGameMode
    });
}

function updateEmojiDisplay() {
    // Clear all slots first
    for (let i = 0; i < 5; i++) {
        const slot = document.getElementById(`emoji-slot-${i}`);
        slot.textContent = '';
        slot.classList.remove('filled');
    }
    
    // Fill slots with selected emojis
    selectedEmojis.forEach((emoji, index) => {
        if (index < 5) {
            const slot = document.getElementById(`emoji-slot-${index}`);
            slot.textContent = emoji;
            slot.classList.add('filled');
        }
    });
}

function startGame(data) {
    gameInProgress = true;
    showGameContainer();
    
    // Set rounds display
    totalRoundsDisplay.textContent = data.rounds;
    currentRoundDisplay.textContent = data.currentRound;
    
    // Hide results from previous rounds
    roundResults.style.display = 'none';
    
    // Reset and hide all sections
    selectedEmojis = [];
    updateEmojiDisplay();
    emojierSection.style.display = 'none';
    guesserSection.style.display = 'none';
    storyModeSection.style.display = 'none';
    
    // Update UI based on game mode
    if (data.gameMode === 'story') {
        storyModeSection.style.display = 'block';
        storyChain.innerHTML = '';
        storyChainData = data.storyChain || [];
        updateStoryChain({ storyChain: storyChainData });
    }
    
    roundStatus.textContent = 'Round starting...';
}

function showEmojierOrGuesserUI() {
    // Reset UI elements
    emojierSection.style.display = 'none';
    guesserSection.style.display = 'none';
    nextPromptContainer.style.display = 'none';
    
    // For Story mode
    if (selectedGameMode === 'story') {
        if (isStoryCreator) {
            nextPromptContainer.style.display = 'block';
        }
        return;
    }
    
    // For standard Emoji Lockdown mode
    if (isEmojier) {
        setupEmojiPicker();
        emojierSection.style.display = 'block';
        lockEmojisBtn.disabled = true;
    } else {
        guesserSection.style.display = 'block';
        guessInput.value = '';
        guessInput.focus();
    }
}

function setupRound(data) {
    currentRoundDisplay.textContent = data.currentRound;
    roundStatus.textContent = `Round ${data.currentRound}: ${isEmojier ? 'Choose your emojis' : 'Wait for emojis'}`;
    
    if (isEmojier) {
        promptWord.textContent = data.prompt;
        lockEmojisBtn.disabled = true;
        selectedEmojis = [];
        updateEmojiDisplay();
    } else {
        hintDisplay.textContent = '';
    }
    
    if (selectedGameMode === 'story') {
        handleStoryPrompt(data);
    }
}

function handleEmojisLocked(data) {
    // Update emoji display for all players
    if (data.emojis && data.emojis.length) {
        selectedEmojis = data.emojis;
        updateEmojiDisplay();
    }
    
    if (isEmojier) {
        roundStatus.textContent = 'Emojis locked! Waiting for guesses...';
        lockEmojisBtn.disabled = true;
    } else {
        roundStatus.textContent = 'Emojis locked! Make your guess...';
        startTimer(data.timeLimitSeconds || 30);
        guessStartTime = Date.now();
    }
}

function updateHint(hint) {
    if (hintDisplay) {
        hintDisplay.textContent = hint;
    }
}

function handleGuessResult(data) {
    if (data.correct) {
        correctSound.play();
        showSnackbar('Correct guess!');
    } else {
        wrongSound.play();
        showSnackbar('Not correct, try again!');
    }
}

function showRoundResult(data) {
    stopTimer();
    
    roundResults.style.display = 'block';
    answerDisplay.textContent = data.answer;
    
    updatePlayerList(data.players);
    updateLeaderboard(data.players);
    
    // Hide gameplay sections
    emojierSection.style.display = 'none';
    guesserSection.style.display = 'none';
    
    roundStatus.textContent = `Round ${data.currentRound} completed`;
    
    // If story mode, update the story chain
    if (selectedGameMode === 'story' && data.storyChain) {
        updateStoryChain({ storyChain: data.storyChain });
    }
}

function endGame(data) {
    gameInProgress = false;
    roundStatus.textContent = 'Game Over!';
    
    updatePlayerList(data.players);
    updateLeaderboard(data.players);
    
    setTimeout(() => {
        if (isHost) {
            gameConfig.style.display = 'block';
        }
        roundResults.style.display = 'none';
    }, 5000);
}

function handleStoryPrompt(data) {
    if (selectedGameMode !== 'story') return;
    
    // Update current prompt
    currentStoryPrompt = data.prompt || '';
    
    if (isStoryCreator) {
        nextPromptInput.value = '';
        nextPromptInput.focus();
        roundStatus.textContent = 'Create the next story prompt!';
    } else if (isEmojier) {
        promptWord.textContent = currentStoryPrompt;
        roundStatus.textContent = 'Create emojis for the story prompt!';
    } else {
        roundStatus.textContent = 'Waiting for story to continue...';
    }
}

function updateStoryChain(data) {
    if (!storyChain) return;
    
    storyChainData = data.storyChain || storyChainData;
    storyChain.innerHTML = '';
    
    if (storyChainData && storyChainData.length > 0) {
        storyChainData.forEach((item, index) => {
            const storyEntry = document.createElement('div');
            storyEntry.className = 'story-entry';
            
            let emojisHtml = '';
            if (item.emojis && item.emojis.length > 0) {
                emojisHtml = `
                    <div class="story-emojis">
                        ${item.emojis.map(emoji => `<span class="story-emoji">${emoji}</span>`).join('')}
                    </div>
                `;
            }
            
            storyEntry.innerHTML = `
                <div class="story-prompt">${index + 1}. ${item.prompt}</div>
                ${emojisHtml}
                ${item.guess ? `<div class="story-guess">"${item.guess}" - ${item.guesser}</div>` : ''}
            `;
            
            storyChain.appendChild(storyEntry);
        });
    } else {
        storyChain.innerHTML = '<div class="story-entry">The story hasn\'t begun yet...</div>';
    }
}

// Timer Functions
function startTimer(duration) {
    stopTimer();
    timerStartTime = Date.now();
    timerDuration = duration * 1000; // convert to milliseconds
    
    timerBar.style.width = '100%';
    
    gameTimer = setInterval(() => {
        const elapsed = Date.now() - timerStartTime;
        const remaining = Math.max(0, timerDuration - elapsed);
        const percent = (remaining / timerDuration) * 100;
        
        timerBar.style.width = `${percent}%`;
        
        // Change color as time runs out
        if (percent < 20) {
            timerBar.style.backgroundColor = 'var(--danger-color)';
        } else if (percent < 50) {
            timerBar.style.backgroundColor = 'var(--warning-color)';
        }
        
        // Play sound when 10 seconds left
        if (remaining <= 10000 && remaining > 9900) {
            timerSound.play();
        }
        
        // End timer when reaches 0
        if (remaining <= 0) {
            stopTimer();
            timerBar.style.width = '0%';
        }
    }, 100);
}

function stopTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    
    // Reset timer bar
    timerBar.style.backgroundColor = 'var(--primary-color)';
}

// Communication Functions
function sendMessage(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    } else {
        showSnackbar('Not connected to the server. Please wait or refresh.');
        console.error('WebSocket is not connected.');
        if (!ws || ws.readyState === WebSocket.CLOSED) {
            connectWebSocket();
        }
    }
}

function showSnackbar(message) {
    errorMessage.textContent = message;
    errorMessage.className = "show";
    setTimeout(function(){ errorMessage.className = errorMessage.className.replace("show", ""); }, 3000);
}

// Event handlers
createRoomBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
        showSnackbar('Please enter your name first.');
        return;
    }
    console.log('Creating room with name:', name);
    sendMessage({
        type: 'createRoom',
        name: name
    });
});

joinRoomBtn.addEventListener('click', () => {
    if (!joiningRoom) {
        if (!nameInput.value.trim()) {
            showSnackbar('Please enter your name first.');
            return;
        }
        showRoomCodeInput();
        return;
    }
    
    const roomCode = nameInput.value.trim();
    if (!roomCode) {
        showSnackbar('Please enter the room code.');
        return;
    }
    sendMessage({
        type: 'joinRoom',
        name: name,
        roomCode: roomCode
    });
});

leaveRoomBtn.addEventListener('click', () => {
    sendMessage({
        type: 'leaveRoom'
    });
    showEntrySection();
});

startGameBtn.addEventListener('click', () => {
    if (!isHost) return;
    
    const rounds = parseInt(roundsInput.value) || 5;
    
    // Ensure currentRoomCode is included in the message
    sendMessage({
        type: 'startGame',
        roomCode: currentRoomCode, // Add this line
        rounds: rounds,
        gameMode: selectedGameMode
    });
});

lockEmojisBtn.addEventListener('click', () => {
    if (!isEmojier || selectedEmojis.length < 3) return;
    
    sendMessage({
        type: 'lockEmojis',
        emojis: selectedEmojis,
        gameMode: selectedGameMode
    });
    
    lockEmojisBtn.disabled = true;
});

submitGuessBtn.addEventListener('click', () => {
    const guess = guessInput.value.trim();
    if (!guess) return;
    
    const timeToGuess = (Date.now() - guessStartTime) / 1000; // convert to seconds
    
    sendMessage({
        type: 'submitGuess',
        guess: guess,
        timeToGuess: timeToGuess
    });
    
    guessInput.value = '';
});

submitStoryPromptBtn.addEventListener('click', () => {
    const prompt = nextPromptInput.value.trim();
    if (!prompt || !isStoryCreator) return;
    
    sendMessage({
        type: 'submitStoryPrompt',
        prompt: prompt
    });
    
    nextPromptInput.value = '';
    nextPromptContainer.style.display = 'none';
});

function checkEnter(event) {
    if (event.key === 'Enter') {
        if (!joiningRoom) {
            createRoomBtn.click();
        } else {
            joinRoomBtn.click();
        }
    }
}

function checkGuessEnter(event) {
    if (event.key === 'Enter' && guessInput.value.trim() !== '') {
        submitGuessBtn.click();
    }
}

// Dark mode toggle function (if needed)
function myFunction() {
    document.body.classList.toggle('dark-theme');
}
