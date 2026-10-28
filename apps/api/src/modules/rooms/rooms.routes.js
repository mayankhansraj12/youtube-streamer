'use strict';

const express = require('express');
const roomService = require('../services/roomService');
const { normalizeRoomId } = require('../lib/ids');
const { HttpError } = require('../lib/httpError');
const { normalizeRoomName } = require('../lib/validation');
const { createRequireAuth } = require('../middleware/requireAuth');

const ROOM_NOT_FOUND = () => new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found');

function createRoomsRouter({ config }) {
  const router = express.Router();
  router.use(createRequireAuth(config.jwtSecret));

  // @route   POST /api/rooms
  router.post('/', async (req, res) => {
    const name = normalizeRoomName(req.body && req.body.name);
    const room = await roomService.createRoom({
      name,
      owner: req.user.username,
      ownerId: req.user.id,
    });

    res.status(201).json(roomService.toRoomDTO(room));
  });

  // @route   GET /api/rooms/:roomId
  router.get('/:roomId', async (req, res) => {
    const roomId = normalizeRoomId(req.params.roomId);
    const room = roomId ? await roomService.findRoom(roomId) : null;
    if (!room) throw ROOM_NOT_FOUND();

    res.json(roomService.toRoomDTO(room));
  });

  // @route   DELETE /api/rooms/:roomId  (owner only)
  router.delete('/:roomId', async (req, res) => {
    const roomId = normalizeRoomId(req.params.roomId);
    const room = roomId ? await roomService.findRoom(roomId) : null;
    if (!room) throw ROOM_NOT_FOUND();
    if (String(room.ownerId) !== req.user.id) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the room owner can end this room');
    }

    await roomService.deleteRoom(roomId);

    const io = req.app.locals.io;
    if (io) {
      io.to(roomId).emit('room:ended', { roomId, reason: 'deleted' });
      io.in(roomId).socketsLeave(roomId);
    }

    res.status(204).end();
  });

  return router;
}

module.exports = { createRoomsRouter };
