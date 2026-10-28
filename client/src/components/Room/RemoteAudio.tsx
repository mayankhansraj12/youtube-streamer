import { useEffect, useRef } from 'react';

type SinkCapableElement = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };

interface RemoteAudioProps {
  stream: MediaStream | null;
  volume: number;
  muted: boolean;
  sinkId: string;
}

/** Plays one remote participant's voice. Hidden, with per-person volume and output routing. */
export default function RemoteAudio({ stream, volume, muted, sinkId }: RemoteAudioProps) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || element.srcObject === stream) return;

    element.srcObject = stream;
    if (stream) void element.play().catch(() => undefined);
  }, [stream]);

  useEffect(() => {
    if (ref.current) ref.current.volume = Math.min(1, Math.max(0, volume));
  }, [volume]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const element = ref.current as SinkCapableElement | null;
    if (!element || !sinkId || typeof element.setSinkId !== 'function') return;
    element.setSinkId(sinkId).catch(() => undefined);
  }, [sinkId]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}
