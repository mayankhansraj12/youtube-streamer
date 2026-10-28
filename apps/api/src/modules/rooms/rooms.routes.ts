import express from 'express';
import { ERROR_CODES } from '@streamsync/shared';
import type { Config } from '../../config.js';
import { HttpError } from '../../http/http-error.js';
import { createRequireAuth, currentUser } from '../../http/require-auth.js';
import { normalizeRoomId } from '../../lib/ids.js';
import { normalizeRoomName } from '../../lib/validation.js';
import type { RoomServer } from '../../realtime/types.js';
import { createRoom, deleteRoom, findRoom, toRoomDTO } from './room.service.js';

const ROOM_NOT_FOUND = (): HttpError => new HttpError(404, ERROR_CODES.ROOM_NOT_FOUND, 'Room not found');

export function createRoomsRouter({ config }: { config: Config }) {
  const router = express.Router();
  router.use(createRequireAuth(config.jwtSecret));

  // @route   POST /api/rooms
  router.post('/', async (req, res) => {
    const body: Record<string, unknown> = req.body ?? {};
    const name = normalizeRoomName(body.name);
    const user = currentUser(req);
    const room = await createRoom({ name, owner: user.username, ownerId: user.id });

    res.status(201).json(toRoomDTO(room));
  });

  // @route   GET /api/rooms/:roomId
  router.get('/:roomId', async (req, res) => {
    const roomId = normalizeRoomId(req.params.roomId);
    const room = roomId ? await findRoom(roomId) : null;
    if (!room) throw ROOM_NOT_FOUND();

    res.json(toRoomDTO(room));
  });

  // @route   DELETE /api/rooms/:roomId  (owner only)
  router.delete('/:roomId', async (req, res) => {
    const roomId = normalizeRoomId(req.params.roomId);
    const room = roomId ? await findRoom(roomId) : null;
    if (!roomId || !room) throw ROOM_NOT_FOUND();
    if (String(room.ownerId) !== currentUser(req).id) {
      throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'Only the room owner can end this room');
    }

    await deleteRoom(roomId);

    const io = req.app.locals.io as RoomServer | undefined;
    if (io) {
      io.to(roomId).emit('room:ended', { roomId, reason: 'deleted' });
      io.in(roomId).socketsLeave(roomId);
    }

    res.status(204).end();
  });

  return router;
}
