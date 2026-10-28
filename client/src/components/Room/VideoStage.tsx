import { useState, useRef, useEffect } from 'react';
import type { MutableRefObject, FC, ChangeEvent, MouseEvent } from 'react';
import { FaVideo } from 'react-icons/fa';
import ControlBar from './ControlBar';

// --- NATIVE YOUTUBE PLAYER COMPONENT ---
const NativeYouTubePlayer = ({
    videoId,
    playing,
    seekTo,
    onProgress,
    onDuration,
    onStateChange,
    playerInstanceRef
}: {
    videoId: string,
    playing: boolean,
    seekTo: number | null,
    onProgress: (time: number) => void,
    onDuration: (duration: number) => void,
    onStateChange: (state: number) => void,
    playerInstanceRef: MutableRefObject<any>
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [apiReady, setApiReady] = useState(false);
    const onStateChangeRef = useRef(onStateChange);

    useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

    useEffect(() => {
        if (!(window as any).YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
            (window as any).onYouTubeIframeAPIReady = () => setApiReady(true);
        } else {
            setApiReady(true);
        }
    }, []);

    useEffect(() => {
        if (apiReady && containerRef.current && !playerInstanceRef.current && videoId) {
            playerInstanceRef.current = new (window as any).YT.Player(containerRef.current, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    'playsinline': 1, 'controls': 0, 'disablekb': 1, 'rel': 0,
                    'modestbranding': 1, 'origin': window.location.origin,
                    'iv_load_policy': 3 // Hide annotations
                },
                events: {
                    'onReady': (event: any) => { if (playing) event.target.playVideo(); },
                    'onStateChange': (event: any) => {
                        if (onStateChangeRef.current) onStateChangeRef.current(event.data);
                        if (event.data === 1 && event.target.getDuration) onDuration(event.target.getDuration());
                    }
                }
            });
        }
    }, [apiReady, videoId]);

    // External Control Sync
    useEffect(() => { if (playerInstanceRef.current?.loadVideoById && videoId) playerInstanceRef.current.loadVideoById(videoId); }, [videoId]);
    useEffect(() => { if (playerInstanceRef.current?.playVideo) playing ? playerInstanceRef.current.playVideo() : playerInstanceRef.current.pauseVideo(); }, [playing]);
    useEffect(() => { if (seekTo !== null && playerInstanceRef.current?.seekTo) playerInstanceRef.current.seekTo(seekTo, true); }, [seekTo]);

    // Poller
    useEffect(() => {
        const interval = setInterval(() => {
            if (playerInstanceRef.current?.getCurrentTime) {
                const t = playerInstanceRef.current.getCurrentTime();
                onProgress(t);
                const d = playerInstanceRef.current.getDuration();
                if (d) onDuration(d);
            }
        }, 500);
        return () => clearInterval(interval);
    }, []);

    return <div ref={containerRef} className="w-full h-full" />;
};

interface VideoStageProps {
    videoId: string;
    playing: boolean;
    seekTrigger: number | null;
    isDragging: boolean;
    setCurrentTime: (t: number) => void;
    setDuration: (d: number) => void;
    handlePlayerStateChange: (state: number) => void;
    playerInstanceRef: MutableRefObject<any>;
    handleTogglePlay: () => void;
    currentTime: number;
    duration: number;
    handleSeek: (e: ChangeEvent<HTMLInputElement>) => void;
    handleSeekEnd: (e: MouseEvent<HTMLInputElement>) => void;
    handleFullscreen: () => void;
    isFullscreen: boolean;
    inputUrl: string;
    setInputUrl: (url: string) => void;
    submitUrl: () => void;
    videoContainerRef: MutableRefObject<HTMLDivElement | null>;
}

const VideoStage: FC<VideoStageProps> = ({
    videoId, playing, seekTrigger, isDragging, setCurrentTime, setDuration,
    handlePlayerStateChange, playerInstanceRef, handleTogglePlay, currentTime, duration,
    handleSeek, handleSeekEnd, handleFullscreen, isFullscreen, inputUrl, setInputUrl, submitUrl, videoContainerRef
}) => {
    return (
        <div className="flex-1 flex items-start justify-center pt-4 lg:pt-24 pb-4 px-4 lg:px-10 relative bg-black/50" ref={videoContainerRef}>
            <div className="w-full h-full max-w-6xl aspect-video bg-black relative rounded-xl lg:rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 ring-1 ring-white/5 group">
                {videoId ? (
                    <>
                        <NativeYouTubePlayer
                            videoId={videoId} playing={playing} seekTo={seekTrigger}
                            onProgress={(t) => !isDragging && setCurrentTime(t)}
                            onDuration={setDuration} onStateChange={handlePlayerStateChange}
                            playerInstanceRef={playerInstanceRef}
                        />
                        <div className="absolute inset-0 z-10" onClick={handleTogglePlay}></div>
                        <ControlBar
                            playing={playing} currentTime={currentTime} duration={duration}
                            onTogglePlay={handleTogglePlay} onSeek={handleSeek} onSeekEnd={handleSeekEnd}
                            onFullscreen={handleFullscreen}
                            isFullscreen={isFullscreen}
                        />
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                        <div className="p-4 lg:p-6 rounded-full bg-white/5 mb-4 animate-pulse"><FaVideo size={30} className="opacity-20 lg:w-10 lg:h-10" /></div>
                        <p className="text-gray-400 font-light text-sm lg:text-base">Waiting for video...</p>
                        {/* Mobile Input for Video if URL Bar is hidden */}
                        <div className="md:hidden mt-4 w-3/4 flex gap-2">
                            <input
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none"
                                placeholder="Paste Link..."
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                            />
                            <button onClick={submitUrl} className="bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-bold">
                                GO
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoStage;
