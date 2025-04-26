const nameInput = document.getElementById('name');
const roomCodeInput = document.getElementById('room-code');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const entrySection = document.getElementById('entry-section');
const roomSection = document.getElementById('room-section');
const displayRoomCode = document.getElementById('display-room-code');
const playerList = document.getElementById('player-list');
const errorMessage = document.getElementById('error-message');
const statusMessage = document.getElementById('status-message');

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
            errorMessage.textContent = 'Received invalid data from server.';
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        errorMessage.textContent = 'WebSocket connection error. Please try refreshing.';
        showEntrySection(); 
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
        if (!errorMessage.textContent) {
             errorMessage.textContent = 'Connection closed. Please refresh to reconnect.';
        }
        showEntrySection();
    };
}

function handleServerMessage(data) {
    errorMessage.textContent = ''; 
    statusMessage.textContent = ''; 

    switch (data.type) {
        case 'roomCreated':
            showRoomSection(data.roomCode, data.players);
            statusMessage.textContent = `Room created. Share code: ${data.roomCode}`;
            break;
        case 'joinedRoom':
            showRoomSection(data.roomCode, data.players);
            statusMessage.textContent = `Joined room ${data.roomCode}.`;
            break;
        case 'playerJoined':
            updatePlayerList(data.players);
            statusMessage.textContent = `${data.name} joined the room.`;
            break;
        case 'playerLeft':
            updatePlayerList(data.players);
            statusMessage.textContent = `${data.name} left the room.`;
            break;
        case 'error':
            errorMessage.textContent = `Error: ${data.message}`;
            if (data.message === 'Room not found') {
                showEntrySection(); 
                roomCodeInput.focus(); 
            }
            break;

        default:
            console.log('Unknown message type:', data.type);
    }
}

function updatePlayerList(players) {
    playerList.innerHTML = ''; 
    players.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        playerList.appendChild(li);
    });
}

function showEntrySection() {
    entrySection.style.display = 'block';
    roomSection.style.display = 'none';

    displayRoomCode.textContent = '';
    playerList.innerHTML = '';
    statusMessage.textContent = '';
    roomCodeInput.value = ''; 
}

function showRoomSection(roomCode, players) {
    entrySection.style.display = 'none';
    roomSection.style.display = 'block';
    displayRoomCode.textContent = roomCode;
    updatePlayerList(players);
}

function sendMessage(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    } else {
        errorMessage.textContent = 'Not connected to the server. Please wait or refresh.';
        console.error('WebSocket is not connected.');
        if (!ws || ws.readyState === WebSocket.CLOSED) {
            connectWebSocket();
        }
    }
}

createRoomBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
        errorMessage.textContent = 'Please enter your name.';
        nameInput.focus();
        return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        errorMessage.textContent = 'Connecting... please wait and try again.';
        connectWebSocket(); 
        return;
    }
    sendMessage({ type: 'createRoom', name: name });
});

joinRoomBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!name) {
        errorMessage.textContent = 'Please enter your name.';
        nameInput.focus();
        return;
    }
    if (!roomCode) {
        errorMessage.textContent = 'Please enter a room code.';
        roomCodeInput.focus();
        return;
    }
     if (!ws || ws.readyState !== WebSocket.OPEN) {
        errorMessage.textContent = 'Connecting... please wait and try again.';
        connectWebSocket(); 
        return;
    }
    sendMessage({ type: 'joinRoom', name: name, roomCode: roomCode });
});

connectWebSocket();
