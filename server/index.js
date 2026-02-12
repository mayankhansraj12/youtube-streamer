const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./db');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for now, will restrict later
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Define Routes
app.use('/api/auth', require('./routes/auth'));

const PORT = process.env.PORT || 5000;

// Socket.io Logic
const Room = require('./models/Room');

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join existing room
  socket.on('join-room', async (rawRoomId, username) => {
    const roomId = rawRoomId.trim();

    try {
        // Strict check: Room must exist
        let room = await Room.findOne({ roomId });
        
        if (!room) {
            socket.emit('error-room-not-found');
            return;
        }

        socket.join(roomId);

        // Add/Update User
        const existingUserIndex = room.users.findIndex(u => u.username === username);
        if (existingUserIndex !== -1) {
            room.users[existingUserIndex].socketId = socket.id;
        } else {
            room.users.push({ username, socketId: socket.id, isMuted: true });
        }
        await room.save();

        // Broadcast to others
        socket.to(roomId).emit('user-connected', { username, socketId: socket.id, isMuted: true });

        // Sync State to Joiner
        socket.emit('room-sync', {
            owner: room.owner,
            users: room.users,
            messages: room.messages || [],
            videoState: room.videoState || {}
        });

        // Refresh everyone's list
        io.in(roomId).emit('all-users', room.users);

        // Handle disconnect for this specific join
        socket.on('disconnect', async () => {
            await handleDisconnect(socket, roomId);
        });

    } catch (e) {
        console.error("Join Room Error:", e);
    }
  });

  // Create NEW room
  socket.on('create-room', async (rawRoomId, username) => {
      const roomId = rawRoomId.trim();
      
      try {
        const existing = await Room.findOne({ roomId });
        if (existing) {
            socket.emit('error-room-exists'); 
            return;
        }

        const room = new Room({ 
            roomId, 
            owner: username, 
            users: [{ username, socketId: socket.id, isMuted: true }], 
            messages: [], 
            videoState: {} 
        });
        await room.save();
        
        socket.join(roomId);
        
        socket.emit('room-sync', {
            owner: room.owner,
            users: room.users,
            messages: room.messages,
            videoState: room.videoState
        });
        io.in(roomId).emit('all-users', room.users);

        socket.on('disconnect', async () => {
            await handleDisconnect(socket, roomId);
        });

      } catch (e) {
          console.error("Create Room Error:", e);
      }
  });

  // Helper for disconnect/leave
  const handleDisconnect = async (socket, roomId) => {
      try {
          const room = await Room.findOneAndUpdate(
              { roomId },
              { $pull: { users: { socketId: socket.id } } },
              { new: true }
          );
          if (room) {
              socket.to(roomId).emit('user-disconnected', socket.id);
              socket.to(roomId).emit('all-users', room.users);
          }
      } catch (e) {
          console.error("Disconnect Error:", e);
      }
  };

  // Leave Room Explicitly
  socket.on('leave-room', async (roomId) => {
      await handleDisconnect(socket, roomId);
      socket.leave(roomId);
  });

  // Delete Room (Owner Only)
  socket.on('delete-room', async (roomId) => {
      try {
          const room = await Room.findOne({ roomId });
          if (room) {
             // In a real app, verify socket.username == room.owner, but we trust client context for now or check DB
             // For better security, we'd need session/auth token verification here.
             // We will check if the requester is actually the owner client-side, 
             // and here we can verify if the socket is in the room's user list with that username.
             
             // Simple deletion
             await Room.deleteOne({ roomId });
             io.to(roomId).emit('room-ended'); // Notify all to leave
             io.in(roomId).socketsLeave(roomId); // Force socket leave
          }
      } catch (e) { console.error("Delete Room Error:", e); }
  });

  // Video Sync Events
  socket.on('video-state', async (roomId, state) => {
    try {
        const room = await Room.findOne({ roomId });
        if (room) {
            room.videoState.playing = state.playing;
            if (state.time !== undefined) {
                room.videoState.currentTime = state.time;
                room.videoState.lastUpdate = Date.now();
            }
            await room.save();
            socket.to(roomId).emit('video-state', state);
        }
    } catch (e) { console.error("Video State Error:", e); }
  });

  socket.on('change-video', async (roomId, url) => {
    try {
        const room = await Room.findOne({ roomId });
        if (room) {
            room.videoState = { url, playing: true, currentTime: 0, lastUpdate: Date.now() };
            await room.save();
            socket.to(roomId).emit('change-video', url);
        }
    } catch (e) { console.error("Change Video Error:", e); }
  });

  socket.on('send-message', async (data) => {
      try {
          const room = await Room.findOne({ roomId: data.roomId });
          if (room) {
              // Normalize data: ensure 'text' is used
              const msgData = {
                  user: data.username,
                  text: data.text || data.message, // Support both for compatibility
                  timestamp: data.timestamp
              };
              
              room.messages.push(msgData);
              await room.save();
              
              // Emit standardized format back to clients
              io.to(data.roomId).emit('receive-message', msgData);
          }
      } catch (e) { console.error("Message Error:", e); }
  });

  // Voice Chat Signals (Pass-through)
  socket.on('signal', (data) => {
      io.to(data.userToCall).emit('signal', { signal: data.signal, from: data.from });
  });

  // Toggle Mute State
  socket.on('toggle-mute', async (roomId, isMuted) => {
      try {
          const room = await Room.findOne({ roomId });
          if (room) {
              const user = room.users.find(u => u.socketId === socket.id);
              if (user) {
                  user.isMuted = isMuted;
                  await room.save();
                  io.to(roomId).emit('all-users', room.users); // Broadcast updated list with mute states
              }
          }
      } catch(e) { console.error("Mute Toggle Error:", e); }
  });
});

function calculateCurrentTime(videoState) {
    if (!videoState) return 0;
    let time = videoState.currentTime;
    if (videoState.playing && videoState.lastUpdate) {
        const elapsed = (Date.now() - new Date(videoState.lastUpdate).getTime()) / 1000;
        time += elapsed;
    }
    return time;
}


app.get('/', (req, res) => {
  res.send('Server is running');
});

// Connect Database and Start Server
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
