import { FaHeadphones, FaMicrophone, FaMicrophoneSlash, FaRedo } from 'react-icons/fa';
import type { MicStatus } from '../../hooks/useMicrophone';
import type { LevelReading } from '../../hooks/useAudioLevels';
import type { VoiceMode } from '../../lib/deckSettings';

interface VoiceBarProps {
  micStatus: MicStatus;
  micError: string | null;
  transmitting: boolean;
  muted: boolean;
  voiceMode: VoiceMode;
  pushHeld: boolean;
  deafened: boolean;
  selfLevel: LevelReading;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onRetryMic: () => void;
}

function statusText({ micStatus, transmitting, muted, voiceMode, pushHeld }: Omit<VoiceBarProps, 'micError' | 'deafened' | 'selfLevel' | 'onToggleMute' | 'onToggleDeafen' | 'onRetryMic'>): string {
  if (micStatus === 'requesting') return 'Waiting for microphone permission';
  if (micStatus !== 'live') return 'Listen only';
  if (voiceMode === 'push-to-talk') return pushHeld ? 'Transmitting' : 'Hold V to talk';
  if (muted) return 'Microphone muted';
  return transmitting ? 'Live' : 'Microphone muted';
}

/** Persistent voice controls: mute, deafen, a live level meter, and the state of the microphone. */
export default function VoiceBar(props: VoiceBarProps) {
  const { micStatus, micError, transmitting, deafened, selfLevel, onToggleMute, onToggleDeafen, onRetryMic } = props;
  const micReady = micStatus === 'live';
  const meterWidth = `${Math.round(selfLevel.level * 100)}%`;

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-white/5 bg-brand-black/80 px-4 py-2.5 backdrop-blur-md lg:px-6">
      <button
        type="button"
        onClick={onToggleMute}
        disabled={!micReady}
        aria-pressed={!transmitting}
        aria-label={transmitting ? 'Mute microphone' : 'Unmute microphone'}
        title="Toggle microphone (M)"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
          transmitting
            ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
            : 'border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25'
        }`}
      >
        {transmitting ? <FaMicrophone size={14} aria-hidden="true" /> : <FaMicrophoneSlash size={14} aria-hidden="true" />}
      </button>

      <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
        <span className="text-xs font-semibold text-white/80" aria-live="polite">
          {statusText(props)}
        </span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${selfLevel.speaking ? 'bg-emerald-400' : 'bg-white/30'}`}
            style={{ width: micReady ? meterWidth : '0%' }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleDeafen}
        aria-pressed={deafened}
        title="Silence everyone else's voice on this device"
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
          deafened
            ? 'border-red-500/40 bg-red-500/15 text-red-300'
            : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
        }`}
      >
        <FaHeadphones size={12} aria-hidden="true" />
        {deafened ? 'Undeafen' : 'Deafen'}
      </button>

      {micStatus !== 'live' && micStatus !== 'requesting' && (
        <div className="flex w-full items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:w-auto sm:max-w-sm">
          <span className="flex-1">{micError}</span>
          <button
            type="button"
            onClick={onRetryMic}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-400/20 px-2 py-1 font-semibold text-amber-100 hover:bg-amber-400/30"
          >
            <FaRedo size={10} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
