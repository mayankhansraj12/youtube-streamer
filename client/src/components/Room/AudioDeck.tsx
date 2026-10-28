import { FaHeadphones, FaMicrophone, FaMicrophoneSlash, FaRedo, FaVolumeUp } from 'react-icons/fa';
import type { LevelReading } from '../../hooks/useAudioLevels';
import type { MicStatus } from '../../hooks/useMicrophone';
import type { DeckSettings } from '../../lib/deckSettings';
import { initialOf } from '../../lib/format';

export interface PeerMix {
  volume: number;
  muted: boolean;
}

export interface DeckRemote {
  socketId: string;
  username: string;
  level: LevelReading | undefined;
}

interface AudioDeckProps {
  settings: DeckSettings;
  onUpdate: (patch: Partial<DeckSettings>) => void;
  onReset: () => void;
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
  supportsOutputSelection: boolean;
  micStatus: MicStatus;
  selfLevel: LevelReading;
  onRetryMic: () => void;
  remotes: DeckRemote[];
  peerMix: Record<string, PeerMix>;
  onPeerMixChange: (socketId: string, patch: Partial<PeerMix>) => void;
  deafened: boolean;
  onToggleDeafen: () => void;
  hasSharedMedia: boolean;
}

const sectionClass = 'space-y-3 border-b border-white/5 pb-5';
const labelClass = 'text-[11px] font-semibold uppercase tracking-widest text-white/50';
const selectClass =
  'w-full rounded-lg border border-white/10 bg-brand-black/60 px-3 py-2 text-sm text-white focus:border-brand-cyan/40 focus:outline-none';

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-white/85">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-8 cursor-pointer appearance-none rounded-full bg-white/15 transition checked:bg-emerald-500 disabled:opacity-40"
      />
    </label>
  );
}

function Meter({ level, speaking }: LevelReading) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
      <div
        className={`h-full rounded-full transition-[width] duration-100 ${speaking ? 'bg-emerald-400' : 'bg-white/30'}`}
        style={{ width: `${Math.round(level * 100)}%` }}
      />
    </div>
  );
}

/** Audio controls for this browser: devices, processing, voice mode, shared-video level, and per-person mix. */
export default function AudioDeck(props: AudioDeckProps) {
  const {
    settings,
    onUpdate,
    onReset,
    inputs,
    outputs,
    supportsOutputSelection,
    micStatus,
    selfLevel,
    onRetryMic,
    remotes,
    peerMix,
    onPeerMixChange,
    deafened,
    onToggleDeafen,
    hasSharedMedia,
  } = props;
  const micReady = micStatus === 'live';

  return (
    <div className="custom-scrollbar h-full space-y-5 overflow-y-auto p-4 text-sm">
      <section className={sectionClass} aria-labelledby="deck-mic">
        <h3 id="deck-mic" className={labelClass}>
          Microphone
        </h3>
        <div className="space-y-1.5">
          <label htmlFor="deck-input" className="text-xs text-white/60">
            Input device
          </label>
          <select
            id="deck-input"
            value={settings.inputDeviceId}
            onChange={(event) => onUpdate({ inputDeviceId: event.target.value })}
            className={selectClass}
          >
            <option value="">System default</option>
            {inputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || 'Microphone'}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-xs text-white/60">Voice mode</legend>
          {(['open', 'push-to-talk'] as const).map((mode) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2 text-white/85">
              <input
                type="radio"
                name="voice-mode"
                value={mode}
                checked={settings.voiceMode === mode}
                onChange={() => onUpdate({ voiceMode: mode })}
                className="accent-emerald-500"
              />
              {mode === 'open' ? 'Open microphone' : 'Push to talk (hold V)'}
            </label>
          ))}
        </fieldset>

        <div className="space-y-2 pt-1">
          <Toggle label="Echo cancellation" checked={settings.echoCancellation} onChange={(value) => onUpdate({ echoCancellation: value })} />
          <Toggle label="Noise suppression" checked={settings.noiseSuppression} onChange={(value) => onUpdate({ noiseSuppression: value })} />
          <Toggle label="Automatic gain control" checked={settings.autoGainControl} onChange={(value) => onUpdate({ autoGainControl: value })} />
        </div>

        <div className="flex items-center gap-3 pt-1">
          {micReady ? (
            <FaMicrophone size={12} className="text-emerald-400" aria-hidden="true" />
          ) : (
            <FaMicrophoneSlash size={12} className="text-red-400" aria-hidden="true" />
          )}
          <div className="flex-1">
            <Meter level={micReady ? selfLevel.level : 0} speaking={selfLevel.speaking} />
          </div>
        </div>
        {!micReady && micStatus !== 'requesting' && (
          <button type="button" onClick={onRetryMic} className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300 hover:text-amber-200">
            <FaRedo size={10} aria-hidden="true" />
            Retry microphone
          </button>
        )}
      </section>

      <section className={sectionClass} aria-labelledby="deck-speakers">
        <h3 id="deck-speakers" className={labelClass}>
          Speakers
        </h3>
        {supportsOutputSelection ? (
          <select
            aria-label="Output device"
            value={settings.outputDeviceId}
            onChange={(event) => onUpdate({ outputDeviceId: event.target.value })}
            className={selectClass}
          >
            <option value="">System default</option>
            {outputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || 'Speaker'}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-white/50">This browser plays audio through the system default speaker.</p>
        )}
        <button
          type="button"
          onClick={onToggleDeafen}
          aria-pressed={deafened}
          className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
            deafened ? 'border-red-500/40 bg-red-500/15 text-red-300' : 'border-white/10 bg-white/5 text-white/85 hover:bg-white/10'
          }`}
        >
          <FaHeadphones size={12} aria-hidden="true" />
          {deafened ? 'Deafened: everyone is muted here' : 'Deafen everyone on this device'}
        </button>
        <p className="text-xs text-white/45">
          Use headphones so the shared video does not echo back into the microphone.
        </p>
      </section>

      <section className={sectionClass} aria-labelledby="deck-video">
        <h3 id="deck-video" className={labelClass}>
          Shared media
        </h3>
        <label htmlFor="deck-volume" className="flex items-center justify-between text-xs text-white/60">
          <span className="flex items-center gap-2">
            <FaVolumeUp size={11} aria-hidden="true" />
            Volume on this device
          </span>
          <span className="tabular-nums">{Math.round(settings.videoVolume * 100)}%</span>
        </label>
        <input
          id="deck-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.videoVolume}
          onChange={(event) => onUpdate({ videoVolume: Number(event.target.value) })}
          className="volume-bar w-full"
          disabled={!hasSharedMedia}
        />
        <Toggle
          label="Lower the video while someone speaks"
          checked={settings.duckVideoWhenSpeaking}
          onChange={(value) => onUpdate({ duckVideoWhenSpeaking: value })}
        />
      </section>

      <section className={sectionClass} aria-labelledby="deck-mix">
        <h3 id="deck-mix" className={labelClass}>
          Participant mix
        </h3>
        {remotes.length === 0 && <p className="text-xs text-white/45">Participants who join will appear here.</p>}
        <ul className="space-y-3">
          {remotes.map((remote) => {
            const mix = peerMix[remote.socketId] ?? { volume: 1, muted: false };
            return (
              <li key={remote.socketId} className="space-y-2 rounded-xl bg-white/[0.03] p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold ${
                      remote.level?.speaking ? 'ring-2 ring-emerald-400' : ''
                    }`}
                    aria-hidden="true"
                  >
                    {initialOf(remote.username)}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-white/85">{remote.username}</span>
                  <button
                    type="button"
                    onClick={() => onPeerMixChange(remote.socketId, { muted: !mix.muted })}
                    aria-pressed={mix.muted}
                    aria-label={`${mix.muted ? 'Unmute' : 'Mute'} ${remote.username} on this device`}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${mix.muted ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}
                  >
                    {mix.muted ? 'Muted' : 'Mute'}
                  </button>
                </div>
                <Meter level={remote.level?.level ?? 0} speaking={remote.level?.speaking === true} />
                <label className="flex items-center gap-3 text-xs text-white/55">
                  <span className="w-12">Volume</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={mix.volume}
                    aria-label={`Volume for ${remote.username}`}
                    onChange={(event) => onPeerMixChange(remote.socketId, { volume: Number(event.target.value) })}
                    className="volume-bar flex-1"
                  />
                  <span className="w-9 text-right tabular-nums">{Math.round(mix.volume * 100)}%</span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={onReset} className="text-xs font-semibold text-white/50 hover:text-white">
          Reset audio settings
        </button>
      </div>
    </div>
  );
}
