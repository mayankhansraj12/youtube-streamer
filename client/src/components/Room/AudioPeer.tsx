import { useEffect, useRef } from 'react';
import type { FC } from 'react';

const AudioPeer: FC<{ stream: MediaStream | null }> = ({ stream }) => {
    const ref = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
            ref.current.muted = false;
            ref.current.volume = 1.0;
            const playPromise = ref.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.log('Audio Autoplay prevented. User interaction may be required.', e);
                });
            }
        }
    }, [stream]);

    return <audio ref={ref} autoPlay playsInline />;
};

export default AudioPeer;
