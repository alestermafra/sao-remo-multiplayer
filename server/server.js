import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// Serve static build in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routes
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Game State
const players = new Map();

io.on('connection', (socket) => {
  console.log(`[Player Connected] ${socket.id}`);

  // Create initial player state no coração da Favela São Remo (Rua Grande Arrozal)
  const randomNames = ['CriaDaSãoRemo', 'Morador_Rabelo', 'RayDaQuebrada', 'DJ_Laje', 'USP_Vizinho', 'Pedrão', 'Jhow'];
  const initialPlayer = {
    id: socket.id,
    name: randomNames[Math.floor(Math.random() * randomNames.length)],
    x: 15.0 + (Math.random() - 0.5) * 3,
    y: 0,
    z: -28.0 + (Math.random() - 0.5) * 3,
    rotationY: 0,
    avatarColor: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    isGrounded: true
  };

  players.set(socket.id, initialPlayer);

  // Send current world state to new player
  socket.emit('init', {
    selfId: socket.id,
    players: Array.from(players.values())
  });

  // Announce new player to others
  socket.broadcast.emit('player_joined', initialPlayer);

  // Handle position & state updates
  socket.on('player_update', (data) => {
    const p = players.get(socket.id);
    if (!p) return;
    p.x = data.x;
    p.y = data.y;
    p.z = data.z;
    p.rotationY = data.rotationY;
    p.speed = data.speed;
    p.isGrounded = data.isGrounded;

    // Broadcast to other players
    socket.broadcast.emit('player_moved', {
      id: socket.id,
      x: p.x,
      y: p.y,
      z: p.z,
      rotationY: p.rotationY,
      speed: p.speed,
      isGrounded: p.isGrounded
    });
  });

  // Handle chat messages
  socket.on('chat_message', (text) => {
    const p = players.get(socket.id);
    if (!p || typeof text !== 'string') return;
    const cleanText = text.trim().slice(0, 120);
    if (!cleanText) return;

    const messageData = {
      id: socket.id,
      name: p.name,
      text: cleanText,
      timestamp: Date.now()
    };

    io.emit('chat_broadcast', messageData);
  });

  // Change nickname
  socket.on('change_name', (newName) => {
    const p = players.get(socket.id);
    if (!p || typeof newName !== 'string') return;
    const clean = newName.trim().slice(0, 16);
    if (clean) {
      p.name = clean;
      io.emit('player_renamed', { id: socket.id, name: clean });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Player Disconnected] ${socket.id}`);
    players.delete(socket.id);
    io.emit('player_left', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(` São Remo Multiplayer online na porta ${PORT}`);
});
