import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { FaArrowRight, FaMagic, FaSignOutAlt, FaYoutube } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { LIMITS } from '../config';
import { useAuth } from '../context/authState';
import { getErrorMessage, roomApi } from '../lib/api';
import { inputClass, primaryButtonClass } from '../lib/formStyles';
import { formatTimeOfDay } from '../lib/format';
import { readRecentRooms, rememberRoom, type RecentRoom } from '../lib/recentRooms';

/** Accepts a bare room code or a pasted invite link and returns the code. */
function codeFromInput(value: string): string {
  const segments = value.trim().split('/').filter(Boolean);
  return (segments[segments.length - 1] ?? '').toLowerCase();
}

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [joinValue, setJoinValue] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [recentRooms] = useState<RecentRoom[]>(() => readRecentRooms());

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy('create');
    try {
      const room = await roomApi.create(roomName.trim());
      rememberRoom({ roomId: room.roomId, name: room.name });
      navigate(`/room/${room.roomId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'The room could not be created. Please try again.'));
      setBusy(null);
    }
  };

  const joinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = codeFromInput(joinValue);
    if (!code) return;

    setBusy('join');
    try {
      const room = await roomApi.get(code);
      rememberRoom({ roomId: room.roomId, name: room.name });
      navigate(`/room/${room.roomId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'That room could not be found.'));
      setBusy(null);
    }
  };

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-brand-black font-sans text-brand-text">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <FaYoutube size={22} className="text-white" aria-hidden="true" />
          <span className="text-lg font-extrabold tracking-tight">
            Stream
            <span className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-transparent">Sync</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-white/60 sm:inline">
            Signed in as <strong className="font-semibold text-white">{user?.username}</strong>
          </span>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <FaSignOutAlt size={11} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-4xl gap-6 px-5 pb-16 pt-4 sm:px-8 md:grid-cols-2">
        <h1 className="sr-only">StreamSync home</h1>

        <section aria-labelledby="create-heading" className="rounded-3xl border border-white/5 bg-brand-surface/60 p-6 shadow-glass backdrop-blur-xl">
          <h2 id="create-heading" className="text-xl font-bold">
            Start a watch party
          </h2>
          <p className="mt-1 text-sm text-white/55">Create a room, then share the invite link with friends.</p>

          <form onSubmit={createRoom} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="room-name" className="block text-xs font-semibold uppercase tracking-wider text-brand-dim">
                Room name (optional)
              </label>
              <input
                id="room-name"
                type="text"
                maxLength={LIMITS.maxRoomNameLength}
                autoComplete="off"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Friday movie night"
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={busy !== null} className={primaryButtonClass}>
              <FaMagic size={13} aria-hidden="true" />
              {busy === 'create' ? 'Creating room…' : 'Create room'}
            </button>
          </form>
        </section>

        <section aria-labelledby="join-heading" className="rounded-3xl border border-white/5 bg-brand-surface/60 p-6 shadow-glass backdrop-blur-xl">
          <h2 id="join-heading" className="text-xl font-bold">
            Join a room
          </h2>
          <p className="mt-1 text-sm text-white/55">Enter a room code, or paste an invite link.</p>

          <form onSubmit={joinRoom} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="room-code" className="block text-xs font-semibold uppercase tracking-wider text-brand-dim">
                Room code or link
              </label>
              <input
                id="room-code"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={joinValue}
                onChange={(event) => setJoinValue(event.target.value)}
                placeholder="e.g. k7m2x9qa"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={busy !== null || codeFromInput(joinValue) === ''}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-3 text-sm font-bold text-brand-cyan transition hover:bg-brand-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'join' ? 'Finding room…' : 'Join room'}
              <FaArrowRight size={11} aria-hidden="true" />
            </button>
          </form>

          {recentRooms.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-dim">Recent rooms</h3>
              <ul className="space-y-2">
                {recentRooms.map((recent) => (
                  <li key={recent.roomId}>
                    <button
                      type="button"
                      onClick={() => navigate(`/room/${recent.roomId}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/30 px-4 py-3 text-left transition hover:border-white/15 hover:bg-white/5"
                    >
                      <span className="min-w-0 truncate text-sm font-semibold text-white">{recent.name}</span>
                      <span className="shrink-0 font-mono text-xs text-white/40">
                        {recent.roomId} · {formatTimeOfDay(recent.visitedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
