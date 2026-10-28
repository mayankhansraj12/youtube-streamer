import { useCallback, useEffect, useState } from 'react';

/** Lists microphones and speakers, and keeps the lists current when devices are plugged in or out. */
export function useAudioDevices() {
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);

  const applyDevices = useCallback((devices: MediaDeviceInfo[]) => {
    setInputs(devices.filter((device) => device.kind === 'audioinput'));
    setOutputs(devices.filter((device) => device.kind === 'audiooutput'));
  }, []);

  const refresh = useCallback(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return Promise.resolve();
    // Enumeration can fail on locked-down browsers. The lists then stay as they are.
    return navigator.mediaDevices.enumerateDevices().then(applyDevices, () => undefined);
  }, [applyDevices]);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return undefined;

    const handleChange = () => {
      void mediaDevices.enumerateDevices().then(applyDevices, () => undefined);
    };

    handleChange();
    mediaDevices.addEventListener('devicechange', handleChange);
    return () => mediaDevices.removeEventListener('devicechange', handleChange);
  }, [applyDevices]);

  const supportsOutputSelection =
    typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

  return { inputs, outputs, refresh, supportsOutputSelection };
}
