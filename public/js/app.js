// Global state
let socket;
let sessionId = localStorage.getItem('sessionId');
let currentUsername = localStorage.getItem('username');
let currentRoomId = null;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const roomsList = document.getElementById('rooms-list');
const currentUserSpan = document.getElementById('current-user');
const roomNameHeader = document.getElementById('room-name');
const roomMembersDiv = document.getElementById('room-members');
const createRoomModal = document.getElementById('create-room-modal');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    
    if (sessionId && currentUsername) {
        initializeChat();
    } else {
        showAuthScreen();
    }
});

function setupEventListeners() {
    // Auth tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${tab}-form`).classList.add('active');
        });
    });
    
    // Login
    loginBtn.addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Register
    registerBtn.addEventListener('click', handleRegister);
    document.getElementById('register-confirm').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
    
    // Create room
    createRoomBtn.addEventListener('click', () => {
        createRoomModal.classList.add('active');
        document.getElementById('new-room-name').value = '';
        document.getElementById('new-room-name').focus();
    });
    
    document.getElementById('confirm-create-room').addEventListener('click', handleCreateRoom);
    document.getElementById('cancel-create-room').addEventListener('click', () => {
        createRoomModal.classList.remove('active');
    });
    
    document.getElementById('new-room-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCreateRoom();
    });
    
    // Send message
    sendBtn.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    if (!username || !password) {
        showError(errorDiv, 'Please enter username and password');
        return;
    }
    
    try {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            sessionId = data.sessionId;
            currentUsername = data.username;
            localStorage.setItem('sessionId', sessionId);
            localStorage.setItem('username', currentUsername);
            initializeChat();
        } else {
            showError(errorDiv, data.error);
        }
    } catch (err) {
        showError(errorDiv, 'Network error. Please try again.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const errorDiv = document.getElementById('register-error');
    
    if (!username || !password || !confirm) {
        showError(errorDiv, 'Please fill in all fields');
        return;
    }
    
    if (password !== confirm) {
        showError(errorDiv, 'Passwords do not match');
        return;
    }
    
    if (password.length < 4) {
        showError(errorDiv, 'Password must be at least 4 characters');
        return;
    }
    
    try {
        registerBtn.disabled = true;
        registerBtn.textContent = 'Creating account...';
        
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            sessionId = data.sessionId;
            currentUsername = data.username;
            localStorage.setItem('sessionId', sessionId);
            localStorage.setItem('username', currentUsername);
            initializeChat();
        } else {
            showError(errorDiv, data.error);
        }
    } catch (err) {
        showError(errorDiv, 'Network error. Please try again.');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register';
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
    } catch (err) {
        console.error('Logout error:', err);
    }
    
    localStorage.removeItem('sessionId');
    localStorage.removeItem('username');
    sessionId = null;
    currentUsername = null;
    
    if (socket) {
        socket.disconnect();
    }
    
    showAuthScreen();
}

function initializeChat() {
    authScreen.classList.remove('active');
    chatScreen.classList.add('active');
    currentUserSpan.textContent = currentUsername;
    
    // Initialize WebSocket
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('authenticate', sessionId);
    });
    
    socket.on('authenticated', (data) => {
        console.log('Authenticated:', data.username);
        loadRooms();
    });
    
    socket.on('auth-error', (message) => {
        console.error('Auth error:', message);
        handleLogout();
    });
    
    socket.on('room-history', (data) => {
        displayRoomHistory(data);
    });
    
    socket.on('new-message', (message) => {
        displayMessage(message);
    });
    
    socket.on('user-joined', (data) => {
        updateRoomMembers(data.members);
        addSystemMessage(`${data.username} joined the room`);
    });
    
    socket.on('user-left', (data) => {
        updateRoomMembers(data.members);
        addSystemMessage(`${data.username} left the room`);
    });
    
    socket.on('error', (message) => {
        console.error('Socket error:', message);
        alert(message);
    });
}

async function loadRooms() {
    try {
        const response = await fetch('/api/rooms', {
            headers: { 'X-Session-Id': sessionId }
        });
        
        if (response.ok) {
            const rooms = await response.json();
            displayRooms(rooms);
        }
    } catch (err) {
        console.error('Error loading rooms:', err);
        roomsList.innerHTML = '<div class="loading">Error loading rooms</div>';
    }
}

function displayRooms(rooms) {
    if (rooms.length === 0) {
        roomsList.innerHTML = '<div class="loading">No rooms yet. Create one!</div>';
        return;
    }
    
    roomsList.innerHTML = rooms.map(room => `
        <div class="room-item" data-room-id="${room.id}">
            <h4>${escapeHtml(room.name)}</h4>
            <p>${room.memberCount} ${room.memberCount === 1 ? 'member' : 'members'}</p>
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.room-item').forEach(item => {
        item.addEventListener('click', () => {
            const roomId = item.dataset.roomId;
            joinRoom(roomId, item.querySelector('h4').textContent);
        });
    });
}

function joinRoom(roomId, roomName) {
    currentRoomId = roomId;
    socket.emit('join-room', roomId);
    
    // Update UI
    document.querySelectorAll('.room-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-room-id="${roomId}"]`).classList.add('active');
    
    roomNameHeader.textContent = roomName;
    messagesContainer.innerHTML = '<div class="loading">Loading messages...</div>';
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
}

function displayRoomHistory(data) {
    messagesContainer.innerHTML = '';
    
    if (data.messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to ${escapeHtml(data.roomId)}! 👋</h2>
                <p>Start the conversation or mention <strong>@bot</strong> to chat with AI!</p>
            </div>
        `;
    } else {
        data.messages.forEach(msg => displayMessage(msg, false));
        scrollToBottom();
    }
    
    updateRoomMembers(data.members);
}

function displayMessage(message, shouldScroll = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    if (message.username === currentUsername) {
        messageDiv.classList.add('own-message');
    } else if (message.isBot) {
        messageDiv.classList.add('bot-message');
    }
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-username">${escapeHtml(message.username)}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${escapeHtml(message.message)}</div>
    `;
    
    // Remove welcome message if it exists
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    messagesContainer.appendChild(messageDiv);
    
    if (shouldScroll) {
        scrollToBottom();
    }
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.style.background = '#ecf0f1';
    messageDiv.style.textAlign = 'center';
    messageDiv.style.fontStyle = 'italic';
    messageDiv.style.color = '#7f8c8d';
    messageDiv.style.margin = '10px auto';
    messageDiv.innerHTML = `<div class="message-text">${escapeHtml(text)}</div>`;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function updateRoomMembers(members) {
    if (members && members.length > 0) {
        roomMembersDiv.textContent = `👥 Members: ${members.join(', ')}`;
    }
}

function handleSendMessage() {
    const message = messageInput.value.trim();
    
    if (!message || !currentRoomId) {
        return;
    }
    
    socket.emit('send-message', { message });
    messageInput.value = '';
    messageInput.focus();
}

async function handleCreateRoom() {
    const roomName = document.getElementById('new-room-name').value.trim();
    const errorDiv = document.getElementById('create-room-error');
    
    if (!roomName) {
        showError(errorDiv, 'Please enter a room name');
        return;
    }
    
    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ roomName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            createRoomModal.classList.remove('active');
            await loadRooms();
            joinRoom(data.roomId, data.room.name);
        } else {
            showError(errorDiv, data.error);
        }
    } catch (err) {
        showError(errorDiv, 'Network error. Please try again.');
    }
}

function showAuthScreen() {
    authScreen.classList.add('active');
    chatScreen.classList.remove('active');
}

function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => {
        element.classList.remove('show');
    }, 5000);
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
