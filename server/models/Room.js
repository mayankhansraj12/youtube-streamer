const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    owner: { type: String }, // Username of the room creator
    users: [{
        username: String,
        socketId: String,
        isMuted: { type: Boolean, default: true },
        joinedAt: { type: Date, default: Date.now }
    }],
    messages: [{
        user: String,
        text: String,
        timestamp: { type: Date, default: Date.now }
    }],
    videoState: {
        url: { type: String, default: '' },
        playing: { type: Boolean, default: false },
        currentTime: { type: Number, default: 0 },
        lastUpdate: { type: Date, default: Date.now }
    }
});

module.exports = mongoose.model('Room', RoomSchema);
