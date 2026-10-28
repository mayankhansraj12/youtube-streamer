import { FaCopy, FaLink, FaSignOutAlt, FaStop, FaUsers, FaVideo } from 'react-icons/fa';

interface RoomHeaderProps {
  roomName: string;
  roomCode: string;
  participantCount: number;
  isOwner: boolean;
  connected: boolean;
  onCopyCode: () => void;
  onShare: () => void;
  onLeave: () => void;
  onEnd: () => void;
}

const chipButton =
  'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white';

export default function RoomHeader({
  roomName,
  roomCode,
  participantCount,
  isOwner,
  connected,
  onCopyCode,
  onShare,
  onLeave,
  onEnd,
}: RoomHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-brand-black/80 px-4 py-3 backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-cyan to-brand-purple">
          <div className="flex h-[calc(100%-2px)] w-[calc(100%-2px)] items-center justify-center rounded-[10px] bg-brand-black">
            <FaVideo size={12} className="text-white" aria-hidden="true" />
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-white" title={roomName}>
            {roomName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-dim">
            <button
              type="button"
              onClick={onCopyCode}
              title="Copy room code"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-0.5 font-mono text-white/80 hover:border-white/30 hover:text-white"
            >
              {roomCode}
              <FaCopy size={10} aria-hidden="true" />
            </button>
            <span className="inline-flex items-center gap-1">
              <FaUsers size={10} aria-hidden="true" />
              <span aria-label={`${participantCount} in the room`}>{participantCount}</span>
            </span>
            <span className={`inline-flex items-center gap-1.5 ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} aria-hidden="true" />
              {connected ? 'Live' : 'Reconnecting'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onShare} className={chipButton} title="Copy invite link">
          <FaLink size={11} aria-hidden="true" />
          Share
        </button>
        <button type="button" onClick={onLeave} className={chipButton}>
          <FaSignOutAlt size={11} aria-hidden="true" />
          Leave
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            <FaStop size={10} aria-hidden="true" />
            End room
          </button>
        )}
      </div>
    </header>
  );
}
