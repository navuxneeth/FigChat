const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const { HfInference } = require('@huggingface/inference');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const ROOMS_FILE = path.join(__dirname, 'data', 'rooms.json');

// Initialize Hugging Face client (works without API key for public models with rate limits)
const hf = new HfInference();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory storage
let users = {};
let rooms = {};
let activeSessions = new Map(); // sessionId -> username
let userSockets = new Map(); // username -> socket.id

// Initialize data files
async function initializeData() {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
        
        try {
            const usersData = await fs.readFile(USERS_FILE, 'utf8');
            users = JSON.parse(usersData);
        } catch (err) {
            users = {};
            await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        }
        
        try {
            const roomsData = await fs.readFile(ROOMS_FILE, 'utf8');
            rooms = JSON.parse(roomsData);
        } catch (err) {
            rooms = {};
            await fs.writeFile(ROOMS_FILE, JSON.stringify(rooms, null, 2));
        }
        
        console.log('Data initialized successfully');
    } catch (err) {
        console.error('Error initializing data:', err);
    }
}

// Save data functions
async function saveUsers() {
    try {
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('Error saving users:', err);
    }
}

async function saveRooms() {
    try {
        await fs.writeFile(ROOMS_FILE, JSON.stringify(rooms, null, 2));
    } catch (err) {
        console.error('Error saving rooms:', err);
    }
}

// Authentication routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        if (users[username]) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        users[username] = {
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };
        
        await saveUsers();
        
        const sessionId = generateSessionId();
        activeSessions.set(sessionId, username);
        
        res.json({ success: true, sessionId, username });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        if (!users[username]) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const isValid = await bcrypt.compare(password, users[username].password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const sessionId = generateSessionId();
        activeSessions.set(sessionId, username);
        
        res.json({ success: true, sessionId, username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId) {
        activeSessions.delete(sessionId);
    }
    res.json({ success: true });
});

// Room routes
app.get('/api/rooms', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId || !activeSessions.has(sessionId)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const roomList = Object.keys(rooms).map(roomId => ({
        id: roomId,
        name: rooms[roomId].name,
        memberCount: rooms[roomId].members.length
    }));
    
    res.json(roomList);
});

app.post('/api/rooms', async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'];
        const username = activeSessions.get(sessionId);
        
        if (!username) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { roomName } = req.body;
        if (!roomName) {
            return res.status(400).json({ error: 'Room name required' });
        }
        
        const roomId = generateRoomId();
        rooms[roomId] = {
            name: roomName,
            creator: username,
            members: [username],
            createdAt: new Date().toISOString(),
            messages: []
        };
        
        await saveRooms();
        
        res.json({ success: true, roomId, room: rooms[roomId] });
    } catch (err) {
        console.error('Create room error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    socket.on('authenticate', (sessionId) => {
        const username = activeSessions.get(sessionId);
        if (username) {
            socket.username = username;
            socket.sessionId = sessionId;
            userSockets.set(username, socket.id);
            socket.emit('authenticated', { username });
            console.log(`User ${username} authenticated`);
        } else {
            socket.emit('auth-error', 'Invalid session');
        }
    });
    
    socket.on('join-room', (roomId) => {
        if (!socket.username) {
            socket.emit('error', 'Not authenticated');
            return;
        }
        
        if (!rooms[roomId]) {
            socket.emit('error', 'Room not found');
            return;
        }
        
        socket.join(roomId);
        socket.currentRoom = roomId;
        
        if (!rooms[roomId].members.includes(socket.username)) {
            rooms[roomId].members.push(socket.username);
            saveRooms();
        }
        
        // Send chat history
        socket.emit('room-history', {
            roomId,
            messages: rooms[roomId].messages,
            members: rooms[roomId].members
        });
        
        // Notify others
        socket.to(roomId).emit('user-joined', {
            username: socket.username,
            members: rooms[roomId].members
        });
    });
    
    socket.on('send-message', async (data) => {
        if (!socket.username || !socket.currentRoom) {
            socket.emit('error', 'Not authenticated or not in a room');
            return;
        }
        
        const { message } = data;
        const roomId = socket.currentRoom;
        
        const messageObj = {
            id: Date.now().toString(),
            username: socket.username,
            message,
            timestamp: new Date().toISOString()
        };
        
        rooms[roomId].messages.push(messageObj);
        await saveRooms();
        
        // Broadcast to all users in the room
        io.to(roomId).emit('new-message', messageObj);
        
        // Check if message mentions AI bot
        if (message.toLowerCase().includes('@bot') || message.toLowerCase().includes('@ai')) {
            // Generate AI response
            setTimeout(() => {
                generateAIResponse(message, roomId, socket.username);
            }, 500);
        }
    });
    
    socket.on('disconnect', () => {
        if (socket.username) {
            userSockets.delete(socket.username);
            
            if (socket.currentRoom) {
                socket.to(socket.currentRoom).emit('user-left', {
                    username: socket.username,
                    members: rooms[socket.currentRoom]?.members.filter(u => u !== socket.username) || []
                });
            }
        }
        console.log('Client disconnected:', socket.id);
    });
});

// AI Response Generation
async function generateAIResponse(userMessage, roomId, username) {
    try {
        // Use a free model from Hugging Face
        const response = await hf.textGeneration({
            model: 'gpt2',
            inputs: userMessage.replace(/@bot|@ai/gi, '').trim(),
            parameters: {
                max_length: 100,
                temperature: 0.7,
                top_p: 0.9,
                num_return_sequences: 1
            }
        });
        
        const aiMessage = {
            id: Date.now().toString(),
            username: 'AI Bot',
            message: response.generated_text.trim(),
            timestamp: new Date().toISOString(),
            isBot: true
        };
        
        rooms[roomId].messages.push(aiMessage);
        await saveRooms();
        
        io.to(roomId).emit('new-message', aiMessage);
    } catch (err) {
        console.error('AI generation error:', err);
        
        // Fallback response
        const fallbackMessage = {
            id: Date.now().toString(),
            username: 'AI Bot',
            message: `I'm here to help! (Note: AI is currently using a basic model. For better responses, you can configure an API key for more advanced models.)`,
            timestamp: new Date().toISOString(),
            isBot: true
        };
        
        rooms[roomId].messages.push(fallbackMessage);
        await saveRooms();
        
        io.to(roomId).emit('new-message', fallbackMessage);
    }
}

// Utility functions
function generateSessionId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function generateRoomId() {
    return 'room_' + Math.random().toString(36).substring(2, 15);
}

// Start server
async function startServer() {
    await initializeData();
    server.listen(PORT, () => {
        console.log(`\n🚀 FigChat server running on port ${PORT}`);
        console.log(`📱 Open http://localhost:${PORT} in your browser\n`);
    });
}

startServer();
