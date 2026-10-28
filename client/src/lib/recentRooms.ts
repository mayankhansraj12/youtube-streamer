export interface RecentRoom {
  roomId: string;
  name: string;
  visitedAt: number;
}

const STORAGE_KEY = 'streamsync.recentRooms';
const MAX_RECENT_ROOMS = 6;

function sanitize(input: unknown): RecentRoom[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(
      (entry): entry is RecentRoom =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentRoom).roomId === 'string' &&
        typeof (entry as RecentRoom).name === 'string' &&
        typeof (entry as RecentRoom).visitedAt === 'number'
    )
    .slice(0, MAX_RECENT_ROOMS);
}

export function readRecentRooms(storage: Storage | null = getStorage()): RecentRoom[] {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    return stored ? sanitize(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

/** Moves a room to the front of the list. Stores only the room id and display name, never member data. */
export function rememberRoom(room: { roomId: string; name: string }, storage: Storage | null = getStorage()): RecentRoom[] {
  const next = sanitize([
    { roomId: room.roomId, name: room.name, visitedAt: Date.now() },
    ...readRecentRooms(storage).filter((entry) => entry.roomId !== room.roomId),
  ]);

  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked. The list simply is not remembered.
  }
  return next;
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
