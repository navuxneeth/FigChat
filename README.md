# FigChat

🤖 **AI-Powered Group Chat Application**

FigChat is a real-time group chat application with AI chatbot integration, user authentication, and multiple private chat rooms. Built with Node.js, Express, Socket.IO, and Hugging Face AI models.

## Features

✅ **User Authentication**
- Register with username and password
- Secure login system with bcrypt password hashing
- Persistent sessions

✅ **Multiple Private Chat Rooms**
- Create unlimited chat rooms
- Join any room to participate in conversations
- See who's online in each room
- Real-time message delivery

✅ **AI Chatbot Integration**
- Chat with AI by mentioning `@bot` or `@ai` in your messages
- Powered by free Hugging Face AI models
- Works without API keys (with rate limits)

✅ **Real-time Communication**
- WebSocket-based instant messaging
- See when users join/leave rooms
- Message history for each room

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/navuxneeth/FigChat.git
cd FigChat
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and visit:
```
http://localhost:3000
```

## Usage

### Getting Started

1. **Register an Account**
   - Open the application in your browser
   - Click on the "Register" tab
   - Enter a username and password
   - Click "Register"

2. **Create a Chat Room**
   - After logging in, click the ➕ button in the sidebar
   - Enter a room name
   - Click "Create"

3. **Join a Room**
   - Click on any room in the sidebar to join
   - Start chatting with other members

4. **Chat with AI**
   - In any message, mention `@bot` or `@ai`
   - Example: "Hey @bot, what's the weather like?"
   - The AI will respond to your message

### Features in Detail

**User Management**
- Each user has their own account with encrypted passwords
- Stay logged in across browser sessions
- Logout anytime from the sidebar

**Room Management**
- Create as many rooms as you need
- Rooms persist across sessions
- See member count for each room
- View all members currently in a room

**Messaging**
- Type messages in the input field
- Press Enter or click Send
- Messages show timestamp and sender
- Your messages appear on the right side
- Other users' messages appear on the left
- AI bot messages are highlighted in yellow

## Technology Stack

- **Backend**: Node.js, Express
- **Real-time**: Socket.IO
- **AI**: Hugging Face Inference API
- **Authentication**: bcryptjs
- **Storage**: JSON file-based storage
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## Project Structure

```
FigChat/
├── server.js           # Main server file
├── package.json        # Dependencies and scripts
├── data/              # Storage directory
│   ├── users.json     # User accounts
│   └── rooms.json     # Chat rooms and messages
└── public/            # Frontend files
    ├── index.html     # Main HTML file
    ├── css/
    │   └── styles.css # Application styles
    └── js/
        └── app.js     # Client-side JavaScript
```

## Configuration

### Port
The default port is 3000. You can change it by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### AI Model
The application uses Hugging Face's GPT-2 model by default. You can modify the model in `server.js`:

```javascript
const response = await hf.textGeneration({
    model: 'gpt2',  // Change to any Hugging Face model
    // ...
});
```

### Advanced AI Configuration (Optional)
For better AI responses and no rate limits, you can add a Hugging Face API token:

1. Get a free API token from [Hugging Face](https://huggingface.co/settings/tokens)
2. Set it in the server.js file:
```javascript
const hf = new HfInference('your-api-token-here');
```

## Security Features

- Passwords are hashed with bcrypt before storage
- Session-based authentication
- Input validation on both client and server
- XSS protection with HTML escaping

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Known Limitations

- The free Hugging Face API has rate limits
- GPT-2 model provides basic responses (upgrade model for better AI)
- Data is stored in JSON files (suitable for small-scale use)
- No file sharing functionality

## Future Enhancements

- Database integration (MongoDB/PostgreSQL)
- File and image sharing
- Voice/video chat
- Enhanced AI models
- Message editing and deletion
- User profiles with avatars
- Direct messaging
- Notifications

## Troubleshooting

**Cannot connect to server**
- Make sure the server is running (`npm start`)
- Check if port 3000 is available
- Check your firewall settings

**AI not responding**
- The free API has rate limits
- Try again after a few moments
- Check console for error messages

**Login issues**
- Clear browser cache and localStorage
- Make sure username/password are correct
- Check if data/users.json exists

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## License

ISC

## Support

For issues or questions, please open an issue on GitHub.

---

Made with ❤️ by the FigChat Team
