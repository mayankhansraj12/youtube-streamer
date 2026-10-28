import { describe, expect, it } from 'vitest';
import { readRecentRooms, rememberRoom } from './recentRooms';

const KEY = 'streamsync.recentRooms';

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  const storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
  return storage as unknown as Storage;
}

describe('recent rooms', () => {
  it('moves a revisited room to the front without duplicating it', () => {
    const storage = memoryStorage();
    rememberRoom({ roomId: 'aaaa1111', name: 'First' }, storage);
    rememberRoom({ roomId: 'bbbb2222', name: 'Second' }, storage);
    const list = rememberRoom({ roomId: 'aaaa1111', name: 'First again' }, storage);

    expect(list.map((room) => room.roomId)).toEqual(['aaaa1111', 'bbbb2222']);
    expect(list[0].name).toBe('First again');
  });

  it('keeps only the six most recent rooms', () => {
    const storage = memoryStorage();
    for (let i = 0; i < 9; i += 1) {
      rememberRoom({ roomId: `room${i}aaa`, name: `Room ${i}` }, storage);
    }

    expect(readRecentRooms(storage)).toHaveLength(6);
  });

  it('ignores malformed entries in storage', () => {
    const storage = memoryStorage({
      [KEY]: JSON.stringify([{ roomId: 'ok', name: 'Fine', visitedAt: 1 }, { roomId: 42 }, null, 'text']),
    });

    expect(readRecentRooms(storage).map((room) => room.roomId)).toEqual(['ok']);
  });
});
