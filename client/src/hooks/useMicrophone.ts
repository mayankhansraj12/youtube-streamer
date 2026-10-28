import { useCallback, useEffect, useRef, useState } from 'react';

export type MicStatus = 'requesting' | 'live' | 'blocked' | 'unavailable';

export interface MicOptions {
  deviceId: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

interface MicFailure {
  status: 'blocked' | 'unavailable';
  message: string;
}

function describeMicError(error: unknown): MicFailure {
  const name = error instanceof DOMException ? error.name : '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      status: 'blocked',
      message: 'Microphone access is blocked. Allow it in your browser settings, then press Retry.',
    };
  }
  if (name === 'NotReadableError') {
    return {
      status: 'unavailable',
      message: 'The microphone is in use by another application. Close it, then press Retry.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return {
      status: 'unavailable',
      message: 'No usable microphone was found. Connect one and press Retry, or keep listening and chatting.',
    };
  }
  return { status: 'unavailable', message: 'The microphone could not be opened. You can still watch, listen, and chat.' };
}

/**
 * Owns the local microphone stream. Changing a processing or device option reopens the
 * capture; unmounting always stops every track, so the browser's recording indicator clears.
 */
export function useMicrophone(options: MicOptions) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<MicStatus>('requesting');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transmittingRef = useRef(false);
  const attemptRef = useRef(0);
  const optionsRef = useRef(options);
  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const acquire = useCallback(async () => {
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    const current = optionsRef.current;

    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: current.deviceId ? { ideal: current.deviceId } : undefined,
          echoCancellation: current.echoCancellation,
          noiseSuppression: current.noiseSuppression,
          autoGainControl: current.autoGainControl,
        },
        video: false,
      });

      if (attempt !== attemptRef.current) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      next.getAudioTracks().forEach((track) => {
        track.enabled = transmittingRef.current;
      });
      streamRef.current = next;
      setStream(next);
      setStatus('live');
      setError(null);
    } catch (caught) {
      if (attempt !== attemptRef.current) return;

      const failure = describeMicError(caught);
      setStatus(failure.status);
      setError(failure.message);
    }
  }, []);

  useEffect(() => {
    void acquire();
  }, [optionsKey, acquire]);

  useEffect(() => {
    return () => {
      attemptRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const setTransmitting = useCallback((transmitting: boolean) => {
    transmittingRef.current = transmitting;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = transmitting;
    });
  }, []);

  const retry = useCallback(() => {
    void acquire();
  }, [acquire]);

  return {
    stream,
    track: stream?.getAudioTracks()[0] ?? null,
    status,
    error,
    setTransmitting,
    retry,
  };
}
