import { useEffect, useRef, useState } from 'react';
import { getAudioContext } from '../lib/audioContext';

export interface LevelReading {
  /** Loudness from 0 to 1, for drawing a meter. */
  level: number;
  speaking: boolean;
}

export interface AudioSource {
  id: string;
  stream: MediaStream | null;
}

const SPEAKING_RMS = 0.02;
const SPEAKING_HOLD_MS = 400;
const SAMPLE_INTERVAL_MS = 100;

interface Meter {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  silentOutput: GainNode;
  samples: Float32Array<ArrayBuffer>;
  holdUntil: number;
}

function sameReadings(a: Record<string, LevelReading>, b: Record<string, LevelReading>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => b[key] && a[key].speaking === b[key].speaking && Math.abs(a[key].level - b[key].level) < 0.02);
}

/**
 * Measures the loudness of each audio stream and reports whether it is speaking. Analysers
 * are wired to a muted output so the graph keeps running without making any sound.
 */
export function useAudioLevels(sources: AudioSource[]): Record<string, LevelReading> {
  const [readings, setReadings] = useState<Record<string, LevelReading>>({});
  const sourcesRef = useRef(sources);
  const key = sources.map((source) => `${source.id}=${source.stream?.id ?? '-'}`).join('|');

  useEffect(() => {
    sourcesRef.current = sources;
  });

  useEffect(() => {
    const context = getAudioContext();
    if (!context) return;

    const meters = new Map<string, Meter>();
    for (const { id, stream } of sourcesRef.current) {
      if (!stream || stream.getAudioTracks().length === 0) continue;

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      const silentOutput = context.createGain();
      silentOutput.gain.value = 0;

      source.connect(analyser);
      analyser.connect(silentOutput);
      silentOutput.connect(context.destination);

      meters.set(id, {
        source,
        analyser,
        silentOutput,
        samples: new Float32Array(analyser.fftSize),
        holdUntil: 0,
      });
    }

    const timer = window.setInterval(() => {
      const now = performance.now();
      const next: Record<string, LevelReading> = {};

      meters.forEach((meter, id) => {
        meter.analyser.getFloatTimeDomainData(meter.samples);
        let sum = 0;
        for (const sample of meter.samples) sum += sample * sample;
        const rms = Math.sqrt(sum / meter.samples.length);

        if (rms > SPEAKING_RMS) meter.holdUntil = now + SPEAKING_HOLD_MS;
        next[id] = { level: Math.min(1, rms * 4), speaking: now < meter.holdUntil };
      });

      setReadings((previous) => (sameReadings(previous, next) ? previous : next));
    }, SAMPLE_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      meters.forEach((meter) => {
        meter.source.disconnect();
        meter.analyser.disconnect();
        meter.silentOutput.disconnect();
      });
    };
  }, [key]);

  return readings;
}
