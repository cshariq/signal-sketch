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

const rooms = new Map();

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

function getPlayerList(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return [];
    return Array.from(room.players.values()).map(p => p.name);
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    let currentRoom = null;
    let playerName = 'Anonymous';

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data);

            switch (data.type) {
                case 'createRoom':
                    playerName = data.name || 'Anonymous';
                    const newRoomCode = generateRoomCode();
                    const newPlayerMap = new Map();
                    newPlayerMap.set(ws, { name: playerName });
                    rooms.set(newRoomCode, { players: newPlayerMap });
                    currentRoom = newRoomCode;
                    ws.send(JSON.stringify({
                        type: 'roomCreated',
                        roomCode: newRoomCode,
                        players: getPlayerList(newRoomCode)
                    }));
                    console.log(`Room ${newRoomCode} created by ${playerName}`);
                    break;

                case 'joinRoom':
                    playerName = data.name || 'Anonymous';
                    const roomCode = data.roomCode?.toUpperCase();
                    const room = rooms.get(roomCode);

                    if (room) {
                        if (currentRoom) { 
                           const oldRoom = rooms.get(currentRoom);
                           oldRoom?.players.delete(ws);
                           if (oldRoom?.players.size === 0) {
                               rooms.delete(currentRoom);
                               console.log(`Room ${currentRoom} closed.`);
                           } else {
                               broadcast(currentRoom, { type: 'playerLeft', name: playerName, players: getPlayerList(currentRoom) }, ws);
                           }
                        }

                        room.players.set(ws, { name: playerName });
                        currentRoom = roomCode;
                        const players = getPlayerList(roomCode);
                        ws.send(JSON.stringify({ type: 'joinedRoom', roomCode: roomCode, players: players }));
                        broadcast(roomCode, { type: 'playerJoined', name: playerName, players: players }, ws);
                        console.log(`${playerName} joined room ${roomCode}`);
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                    }
                    break;

                case 'leaveRoom':
                    if (currentRoom) {
                        const room = rooms.get(currentRoom);
                        if (room) {
                            room.players.delete(ws);
                            const remainingPlayers = getPlayerList(currentRoom);
                            
                            if (room.players.size === 0) {
                                rooms.delete(currentRoom);
                                console.log(`Room ${currentRoom} closed.`);
                            } else {
                                broadcast(currentRoom, { 
                                    type: 'playerLeft', 
                                    name: playerName, 
                                    players: remainingPlayers 
                                }, ws);
                                console.log(`${playerName} left room ${currentRoom}. Remaining: ${remainingPlayers.join(', ')}`);
                            }
                            ws.send(JSON.stringify({ type: 'leftRoom' }));
                        }
                        currentRoom = null;
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to process message or invalid JSON:', message, error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.delete(ws);
                const remainingPlayers = getPlayerList(currentRoom);
                console.log(`${playerName} left room ${currentRoom}. Remaining: ${remainingPlayers.join(', ')}`);

                if (room.players.size === 0) {
                    rooms.delete(currentRoom);
                    console.log(`Room ${currentRoom} closed.`);
                } else {
                    broadcast(currentRoom, { type: 'playerLeft', name: playerName, players: remainingPlayers }, null); // Send to all remaining
                }
            }
        }
        currentRoom = null; 
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
         if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.delete(ws);
                 if (room.players.size === 0) {
                    rooms.delete(currentRoom);
                } else {
                     broadcast(currentRoom, { type: 'playerLeft', name: playerName, players: getPlayerList(currentRoom) }, ws);
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
