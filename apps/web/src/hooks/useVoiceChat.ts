import { useEffect, useMemo } from 'react';
import type { RoomSocket } from '../lib/socket';
import type { DeckSettings } from '../lib/deckSettings';
import type { Participant } from '../types';
import { useAudioLevels, type LevelReading } from './useAudioLevels';
import { useMicrophone } from './useMicrophone';
import { useVoiceMesh } from './useVoiceMesh';

export const SELF_LEVEL_ID = 'self';

interface VoiceChatInput {
  socket: RoomSocket | null;
  selfId: string | null;
  participants: Participant[];
  deck: DeckSettings;
  muted: boolean;
  pushToTalkHeld: boolean;
}

/** Combines the microphone, the peer mesh, and level metering into one voice channel. */
export function useVoiceChat({ socket, selfId, participants, deck, muted, pushToTalkHeld }: VoiceChatInput) {
  const mic = useMicrophone({
    deviceId: deck.inputDeviceId,
    echoCancellation: deck.echoCancellation,
    noiseSuppression: deck.noiseSuppression,
    autoGainControl: deck.autoGainControl,
  });

  const transmitting = mic.stream !== null && !muted && (deck.voiceMode === 'open' || pushToTalkHeld);
  const { setTransmitting } = mic;

  useEffect(() => {
    setTransmitting(transmitting);
  }, [setTransmitting, transmitting, mic.stream]);

  const remoteIds = useMemo(
    () => participants.filter((participant) => participant.socketId !== selfId).map((participant) => participant.socketId),
    [participants, selfId]
  );

  const mesh = useVoiceMesh({ socket, selfId, remoteIds, localTrack: mic.track });

  const levelSources = useMemo(
    () => [
      { id: SELF_LEVEL_ID, stream: mic.stream },
      ...remoteIds.map((id) => ({ id, stream: mesh.streams[id] ?? null })),
    ],
    [mic.stream, mesh.streams, remoteIds]
  );
  const levels = useAudioLevels(levelSources);

  const selfLevel: LevelReading = levels[SELF_LEVEL_ID] ?? { level: 0, speaking: false };
  const remoteSpeaking = remoteIds.some((id) => levels[id]?.speaking === true);

  return { mic, transmitting, mesh, levels, selfLevel, remoteSpeaking, remoteIds };
}
