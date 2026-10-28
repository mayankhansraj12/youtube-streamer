import type { ChangeEvent, MouseEvent, FC } from 'react';
import { FaPlay, FaPause, FaExpand, FaCompress } from 'react-icons/fa';

interface ControlBarProps {
    playing: boolean;
    currentTime: number;
    duration: number;
    onTogglePlay: () => void;
    onSeek: (e: ChangeEvent<HTMLInputElement>) => void;
    onSeekEnd: (e: MouseEvent<HTMLInputElement>) => void;
    onFullscreen: () => void;
    isFullscreen: boolean;
}

const ControlBar: FC<ControlBarProps> = ({
    playing, currentTime, duration, onTogglePlay, onSeek, onSeekEnd, onFullscreen, isFullscreen
}) => {
    const formatTime = (s: number) => {
        if (!s || isNaN(s)) return "00:00";
        const date = new Date(s * 1000);
        const mm = date.getUTCMinutes();
        const ss = date.getUTCSeconds().toString().padStart(2, '0');
        const hh = date.getUTCHours();
        return hh ? `${hh}:${mm.toString().padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
    }
    const progress = duration > 0 ? (currentTime / duration) : 0;

    return (
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-6 pb-6 pt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
            {/* Timeline */}
            <div className="relative w-full h-1.5 group/slider cursor-pointer mb-4 items-center flex">
                <div className="absolute inset-0 bg-white/20 rounded-full"></div>
                <div className="absolute left-0 h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full relative" style={{ width: `${Math.min(progress * 100, 100)}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(236,72,153,0.7)] scale-0 group-hover/slider:scale-100 transition-transform"></div>
                </div>
                <input type="range" min="0" max="1" step="0.001" value={progress || 0} onChange={onSeek} onMouseUp={onSeekEnd} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button onClick={(e) => { e.stopPropagation(); onTogglePlay(); }} className="text-white hover:text-pink-400 focus:outline-none transform active:scale-95 transition-all p-2 rounded-full hover:bg-white/10">
                        {playing ? <FaPause size={24} /> : <FaPlay size={24} />}
                    </button>
                    <span className="text-sm font-mono text-gray-300 select-none pointer-events-none">
                        {formatTime(currentTime)} <span className="text-gray-500">/</span> {formatTime(duration)}
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={(e) => { e.stopPropagation(); onFullscreen(); }} className="text-white hover:text-pink-400 p-2 rounded-full hover:bg-white/10" title="Fullscreen">
                        {isFullscreen ? <FaCompress size={20} /> : <FaExpand size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ControlBar;
