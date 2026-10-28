import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import AudioDeck, { type PeerMix } from '../components/Room/AudioDeck';
import ChatPanel from '../components/Room/ChatPanel';
import ParticipantList from '../components/Room/ParticipantList';
import RemoteAudio from '../components/Room/RemoteAudio';
import RoomHeader from '../components/Room/RoomHeader';
import SourceBar from '../components/Room/SourceBar';
import VideoStage from '../components/Room/VideoStage';
import VoiceBar from '../components/Room/VoiceBar';
import { useAuth } from '../context/authState';
import { useSocket } from '../context/socketState';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { useDeckSettings } from '../hooks/useDeckSettings';
import { useRoomSession } from '../hooks/useRoomSession';
import { useSocketConnected } from '../hooks/useSocketConnected';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useWatchTogether } from '../hooks/useWatchTogether';
import { getErrorMessage, roomApi } from '../lib/api';
import { rememberRoom } from '../lib/recentRooms';
import { SocketRequestError } from '../lib/socket';
import type { DeckSettings } from '../lib/deckSettings';
import type { Participant } from '../types';

type Tab = 'chat' | 'people' | 'audio';

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'people', label: 'People' },
  { id: 'audio', label: 'Audio deck' },
];

const SEEK_STEP_SECONDS = 5;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function isButtonLike(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['BUTTON', 'A'].includes(target.tagName);
}

export default function RoomRoute() {
  const { roomId = '' } = useParams();
  return <RoomView key={roomId} roomId={roomId} />;
}

function RoomView({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const connected = useSocketConnected(socket);
  const deck = useDeckSettings();
  const devices = useAudioDevices();

  const [tab, setTab] = useState<Tab>('chat');
  const [muted, setMuted] = useState(false);
  const [pushToTalkHeld, setPushToTalkHeld] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [peerMix, setPeerMix] = useState<Record<string, PeerMix>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Participant | null>(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);

  const handleRoomEnded = useCallback(() => {
    toast('The room has been closed.');
    navigate('/', { replace: true });
  }, [navigate]);

  const handleKicked = useCallback(() => {
    toast.error('You were removed from this room.');
    navigate('/', { replace: true });
  }, [navigate]);

  const handleJoinFailed = useCallback(
    (error: SocketRequestError) => {
      toast.error(error.message);
      if (error.code !== 'TIMEOUT') navigate('/', { replace: true });
    },
    [navigate]
  );

  const handleActionError = useCallback((message: string) => toast.error(message), []);

  const session = useRoomSession({
    socket,
    roomId,
    onRoomEnded: handleRoomEnded,
    onKicked: handleKicked,
    onJoinFailed: handleJoinFailed,
    onActionError: handleActionError,
  });
  const { joined, selfId, participants, playback, items, room, setMuted: sendPresenceMuted } = session;

  const voice = useVoiceChat({
    socket,
    selfId,
    participants,
    deck: deck.settings,
    muted,
    pushToTalkHeld,
  });

  useEffect(() => {
    if (joined) sendPresenceMuted(!voice.transmitting);
  }, [joined, voice.transmitting, sendPresenceMuted]);

  const micStatus = voice.mic.status;
  const refreshDevices = devices.refresh;
  useEffect(() => {
    if (micStatus === 'live') void refreshDevices();
  }, [micStatus, refreshDevices]);

  const watch = useWatchTogether({
    containerRef,
    playback,
    serverNow: session.serverNow,
    onControl: session.control,
    volume: deck.settings.videoVolume,
    duckEnabled: deck.settings.duckVideoWhenSpeaking,
    duckActive: voice.remoteSpeaking,
    preferredQuality: deck.settings.preferredQuality,
  });
  const { togglePlay, seekBy, resumeBlocked } = watch;

  const roomName = room?.name;
  useEffect(() => {
    if (roomName) rememberRoom({ roomId, name: roomName });
  }, [roomId, roomName]);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement !== null && document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void stageRef.current?.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const dialogOpen = leaveOpen || endOpen || removeTarget !== null;
  const voiceMode = deck.settings.voiceMode;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogOpen || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === 'v') {
        if (voiceMode === 'push-to-talk' && !event.repeat) setPushToTalkHeld(true);
        return;
      }
      if (key === 'm') {
        event.preventDefault();
        setMuted((value) => !value);
        return;
      }
      if (key === 'f') {
        event.preventDefault();
        toggleFullscreen();
        return;
      }
      if (key === 'arrowleft' || key === 'arrowright') {
        event.preventDefault();
        seekBy(key === 'arrowleft' ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
        return;
      }
      if ((key === ' ' || key === 'k') && !isButtonLike(event.target)) {
        event.preventDefault();
        togglePlay();
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'v') setPushToTalkHeld(false);
    };
    const release = () => setPushToTalkHeld(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', release);
    };
  }, [dialogOpen, voiceMode, seekBy, togglePlay, toggleFullscreen]);

  const updatePeerMix = useCallback((socketId: string, patch: Partial<PeerMix>) => {
    setPeerMix((previous) => {
      const current: PeerMix = previous[socketId] ?? { volume: 1, muted: false };
      return { ...previous, [socketId]: { ...current, ...patch } };
    });
  }, []);

  const remotes = useMemo(
    () =>
      participants
        .filter((participant) => participant.socketId !== selfId)
        .map((participant) => ({
          socketId: participant.socketId,
          username: participant.username,
          level: voice.levels[participant.socketId],
        })),
    [participants, selfId, voice.levels]
  );

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error('Copy failed. Select the text and copy it manually.');
    }
  };

  const leaveRoom = async () => {
    setBusy(true);
    await session.leave();
    navigate('/', { replace: true });
  };

  const endRoom = async () => {
    setBusy(true);
    try {
      await roomApi.end(roomId);
      toast('Room ended.');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'The room could not be ended.'));
      setBusy(false);
      setEndOpen(false);
    }
  };

  const removeParticipant = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await session.kick(removeTarget.socketId);
      toast(`${removeTarget.username} was removed from the room.`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'That participant could not be removed.'));
    } finally {
      setBusy(false);
      setRemoveTarget(null);
    }
  };

  const hasSource = playback?.source != null;
  const isAudio = playback?.source?.kind === 'media' && playback.source.mediaType === 'audio';
  const isOwner = room !== null && room.ownerId === user?.id;
  const inviteUrl = `${window.location.origin}/room/${roomId}`;

  return (
    <div className="flex min-h-dvh flex-col bg-brand-black font-sans text-brand-text lg:h-dvh lg:flex-row lg:overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
        <RoomHeader
          roomName={room?.name ?? 'Joining room…'}
          roomCode={roomId}
          participantCount={participants.length}
          isOwner={isOwner}
          connected={connected}
          onCopyCode={() => void copyText(roomId, 'Room code copied.')}
          onShare={() => void copyText(inviteUrl, 'Invite link copied.')}
          onLeave={() => setLeaveOpen(true)}
          onEnd={() => setEndOpen(true)}
        />

        <SourceBar onLoad={session.loadSource} />

        <VideoStage
          stageRef={stageRef}
          containerRef={containerRef}
          hasSource={hasSource}
          isAudio={isAudio}
          adapter={watch.adapter}
          playing={playback?.playing ?? false}
          loading={watch.loading}
          buffering={watch.buffering}
          blocked={watch.blocked}
          error={watch.error}
          volume={deck.settings.videoVolume}
          quality={deck.settings.preferredQuality}
          isFullscreen={isFullscreen}
          onResume={resumeBlocked}
          onTogglePlay={togglePlay}
          onSeek={watch.seekTo}
          onVolumeChange={(volume) => deck.update({ videoVolume: volume })}
          onQualityChange={(quality) => deck.update({ preferredQuality: quality })}
          onToggleFullscreen={toggleFullscreen}
        />

        <VoiceBar
          micStatus={voice.mic.status}
          micError={voice.mic.error}
          transmitting={voice.transmitting}
          muted={muted}
          voiceMode={voiceMode}
          pushHeld={pushToTalkHeld}
          deafened={deafened}
          selfLevel={voice.selfLevel}
          onToggleMute={() => setMuted((value) => !value)}
          onToggleDeafen={() => setDeafened((value) => !value)}
          onRetryMic={voice.mic.retry}
        />
      </div>

      <aside className="flex min-h-[55vh] flex-col border-t border-white/5 bg-brand-surface lg:min-h-0 lg:w-[380px] lg:border-l lg:border-t-0">
        <div role="tablist" aria-label="Room panels" className="flex border-b border-white/5 text-sm font-semibold">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={`flex-1 border-b-2 py-3.5 transition ${
                tab === id ? 'border-brand-purple bg-white/5 text-white' : 'border-transparent text-white/50 hover:text-white/80'
              }`}
            >
              {label}
              {id === 'people' ? ` (${participants.length})` : ''}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1">
          {tab === 'chat' && <ChatPanel items={items} selfUserId={user?.id ?? ''} onSend={session.sendMessage} />}
          {tab === 'people' && (
            <ParticipantList
              participants={participants}
              ownerId={room?.ownerId ?? ''}
              selfSocketId={selfId}
              viewerIsOwner={isOwner}
              levels={voice.levels}
              onRemove={setRemoveTarget}
            />
          )}
          {tab === 'audio' && (
            <AudioDeck
              settings={deck.settings as DeckSettings}
              onUpdate={deck.update}
              onReset={deck.reset}
              inputs={devices.inputs}
              outputs={devices.outputs}
              supportsOutputSelection={devices.supportsOutputSelection}
              micStatus={voice.mic.status}
              selfLevel={voice.selfLevel}
              onRetryMic={voice.mic.retry}
              remotes={remotes}
              peerMix={peerMix}
              onPeerMixChange={updatePeerMix}
              deafened={deafened}
              onToggleDeafen={() => setDeafened((value) => !value)}
              hasSharedMedia={hasSource}
            />
          )}
        </div>
      </aside>

      <div hidden aria-hidden="true">
        {remotes.map((remote) => (
          <RemoteAudio
            key={remote.socketId}
            stream={voice.mesh.streams[remote.socketId] ?? null}
            volume={peerMix[remote.socketId]?.volume ?? 1}
            muted={deafened || (peerMix[remote.socketId]?.muted ?? false)}
            sinkId={deck.settings.outputDeviceId}
          />
        ))}
      </div>

      <ConfirmDialog
        open={leaveOpen}
        title="Leave this room?"
        description="You can come back at any time with the room code."
        confirmLabel="Leave room"
        busy={busy}
        onConfirm={leaveRoom}
        onCancel={() => setLeaveOpen(false)}
      />
      <ConfirmDialog
        open={endOpen}
        title="End this room?"
        description="Everyone will be removed and the room code will stop working. This cannot be undone."
        confirmLabel="End room"
        tone="danger"
        busy={busy}
        onConfirm={endRoom}
        onCancel={() => setEndOpen(false)}
      />
      <ConfirmDialog
        open={removeTarget !== null}
        title={`Remove ${removeTarget?.username ?? 'this participant'}?`}
        description="They will be disconnected and can rejoin with the room code."
        confirmLabel="Remove"
        tone="danger"
        busy={busy}
        onConfirm={removeParticipant}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
