const nameInput = document.getElementById('joinCode');
const createRoomBtn = document.getElementById('create-room-btn'); 
const joinRoomBtn = document.getElementById('join-room-btn');     
const leaveRoomBtn = document.getElementById('leave-room-btn');
const entrySection = document.querySelector('.join-element');
const roomSection = document.querySelector('.table-holder');
const displayRoomCode = document.getElementById('percentage-text');
const playerList = document.getElementById('sessions');
const errorMessage = document.getElementById('snackbar');
const statusMessage = document.getElementById('snackbar');
const peopleSection = document.getElementById('camera'); 

let playerName = '';
let joiningRoom = false;
let currentRoomCode = null;

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsURL = `${wsProtocol}//${window.location.host}`; 
let ws;

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

function updatePlayerList(players) {
    
    playerList.innerHTML = '';
    
    
    const defaultOption = document.createElement('option');
    defaultOption.textContent = players.length > 0 ? `People in room (${players.length})` : 'No people in room yet';
    defaultOption.value = "0";
    defaultOption.setAttribute('aria-label', 'Automatic');
    defaultOption.selected = true;
    playerList.appendChild(defaultOption);
    
    
    players.forEach((name, index) => {
        const option = document.createElement('option');
        option.textContent = name;
        option.value = index + 1;
        option.setAttribute('aria-label', name);
        playerList.appendChild(option);
    });
    
    
    peopleSection.style.display = 'block';
}

function showEntrySection() {
    entrySection.style.display = 'block';
    roomSection.style.display = 'none';
    leaveRoomBtn.style.display = 'none'; 
    
    if (joiningRoom) {
        resetJoinUI();
    }

    displayRoomCode.textContent = 'Join Code:';
    playerList.innerHTML = '<option aria-label="Automatic" selected="selected" value="0">Add people joined here</option>';
    nameInput.value = ''; 
    currentRoomCode = null;
}

function resetJoinUI() {
    joiningRoom = false;
    nameInput.placeholder = "Enter Your Name";
    nameInput.value = '';
    playerName = '';
    createRoomBtn.style.display = 'inline-block'; 
    createRoomBtn.style.width = '50%'; 
    joinRoomBtn.style.width = '50%'; 
}

function showRoomCodeInput() {
    playerName = nameInput.value.trim();
    nameInput.value = '';
    nameInput.placeholder = "Enter Room Code";
    createRoomBtn.style.display = 'none'; 
    joinRoomBtn.style.width = '100%'; 
    joiningRoom = true;
}

function showRoomSection(roomCode, players) {
    entrySection.style.display = 'none';
    roomSection.style.display = 'block';
    leaveRoomBtn.style.display = 'inline-block'; 
    displayRoomCode.textContent = `Join Code: ${roomCode}`;
    currentRoomCode = roomCode;
    updatePlayerList(players);
}

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


function checkEnter(event) {
    if (event.key === 'Enter') {
        if (!joiningRoom) {
            
            createRoomBtn.click();
        } else {
            
            joinRoomBtn.click();
        }
    }
}

createRoomBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
        showSnackbar('Please enter your name.');
        nameInput.focus();
        return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        showSnackbar('Connecting... please wait and try again.');
        connectWebSocket(); 
        return;
    }
    playerName = name;
    sendMessage({ type: 'createRoom', name: name });
});

joinRoomBtn.addEventListener('click', () => {
    if (!joiningRoom) {
        
        const name = nameInput.value.trim();
        if (!name) {
            showSnackbar('Please enter your name.');
            nameInput.focus();
            return;
        }
        showRoomCodeInput();
    } else {
        
        const roomCode = nameInput.value.trim().toUpperCase();
        if (!roomCode) {
            showSnackbar('Please enter a room code.');
            nameInput.focus();
            return;
        }
        
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            showSnackbar('Connecting... please wait and try again.');
            connectWebSocket(); 
            return;
        }
        
        
        sendMessage({ type: 'joinRoom', name: playerName, roomCode: roomCode });
    }
});


leaveRoomBtn.addEventListener('click', () => {
    
    showEntrySection();
    
    
    if (ws && ws.readyState === WebSocket.OPEN && currentRoomCode) {
        sendMessage({ type: 'leaveRoom', roomCode: currentRoomCode });
    }
});

function handleServerMessage(data) {
    switch (data.type) {
        case 'roomCreated':
            showRoomSection(data.roomCode, data.players);
            showSnackbar(`Room created. Share code: ${data.roomCode}`);
            resetJoinUI();
            break;
        case 'joinedRoom':
            showRoomSection(data.roomCode, data.players);
            showSnackbar(`Joined room ${data.roomCode}.`);
            resetJoinUI();
            break;
        case 'playerJoined':
            updatePlayerList(data.players);
            showSnackbar(`${data.name} joined the room.`);
            break;
        case 'playerLeft':
            updatePlayerList(data.players);
            showSnackbar(`${data.name} left the room.`);
            break;
        case 'error':
            showSnackbar(`Error: ${data.message}`);
            if (data.message === 'Room not found') {
                nameInput.value = '';
                nameInput.focus();
            }
            break;
        case 'leftRoom':
            
            showEntrySection();
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}


connectWebSocket();
