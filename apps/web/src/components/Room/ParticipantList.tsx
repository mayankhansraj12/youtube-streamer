import { FaMicrophone, FaMicrophoneSlash, FaUserMinus } from 'react-icons/fa';
import type { LevelReading } from '../../hooks/useAudioLevels';
import { SELF_LEVEL_ID } from '../../hooks/useVoiceChat';
import { initialOf } from '../../lib/format';
import type { Participant } from '../../types';

interface ParticipantListProps {
  participants: Participant[];
  ownerId: string;
  selfSocketId: string | null;
  viewerIsOwner: boolean;
  levels: Record<string, LevelReading>;
  onRemove: (participant: Participant) => void;
}

/** Everyone in the room with live speaking indicators. The host can remove other participants. */
export default function ParticipantList({
  participants,
  ownerId,
  selfSocketId,
  viewerIsOwner,
  levels,
  onRemove,
}: ParticipantListProps) {
  const ordered = [...participants].sort(
    (a, b) => Number(b.userId === ownerId) - Number(a.userId === ownerId) || a.joinedAt - b.joinedAt
  );

  return (
    <ul aria-label="People in this room" className="custom-scrollbar h-full space-y-1 overflow-y-auto p-3">
      {ordered.map((participant) => {
        const isSelf = participant.socketId === selfSocketId;
        const isHost = participant.userId === ownerId;
        const level = levels[isSelf ? SELF_LEVEL_ID : participant.socketId];
        const speaking = !participant.muted && level?.speaking === true;
        const status = participant.muted ? 'Muted' : speaking ? 'Speaking' : 'Mic on';

        return (
          <li key={participant.socketId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan/40 to-brand-purple/40 text-sm font-bold text-white transition ${
                speaking ? 'ring-2 ring-emerald-400' : ''
              }`}
              aria-hidden="true"
            >
              {initialOf(participant.username)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">{participant.username}</span>
                {isSelf && <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">You</span>}
                {isHost && (
                  <span className="rounded-full border border-brand-purple/30 bg-brand-purple/10 px-2 py-0.5 text-[10px] font-semibold text-brand-purple">
                    Host
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                {participant.muted ? (
                  <FaMicrophoneSlash size={9} className="text-red-400" aria-hidden="true" />
                ) : (
                  <FaMicrophone size={9} className="text-emerald-400" aria-hidden="true" />
                )}
                <span>{status}</span>
              </div>
            </div>

            {viewerIsOwner && !isSelf && (
              <button
                type="button"
                onClick={() => onRemove(participant)}
                aria-label={`Remove ${participant.username} from the room`}
                title="Remove from room"
                className="rounded-lg p-2 text-white/50 transition hover:bg-red-500/10 hover:text-red-300"
              >
                <FaUserMinus size={12} aria-hidden="true" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
