import type { FC } from 'react';
import { FaVideo } from 'react-icons/fa';

interface RoomHeaderProps {
    roomName: string;
    inputUrl: string;
    setInputUrl: (val: string) => void;
    submitUrl: () => void;
    roomOwner: string;
    username: string;
    setShowDeleteModal: (val: boolean) => void;
    setShowLeaveModal: (val: boolean) => void;
}

const RoomHeader: FC<RoomHeaderProps> = ({
    roomName, inputUrl, setInputUrl, submitUrl, roomOwner, username, setShowDeleteModal, setShowLeaveModal
}) => {
    return (
        <header className="h-16 lg:h-20 flex items-center justify-between px-4 lg:px-8 relative lg:absolute lg:top-0 lg:left-0 lg:right-0 z-50 pointer-events-none font-sans">
            <div className="pointer-events-auto flex items-center gap-3 bg-brand-surface/80 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5 shadow-glass scale-90 lg:scale-100 origin-left hover:bg-brand-surface/90 transition-all">
                <div className="bg-gradient-to-tr from-brand-cyan to-brand-purple p-2 rounded-full shadow-lg">
                    <FaVideo className="text-white text-xs lg:text-sm" />
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-sm text-brand-text tracking-tight">{roomName || 'Untitled Room'}</span>
                </div>
            </div>

            {/* URL Bar - Hidden on mobile, visible on desktop */}
            <div className="pointer-events-auto hidden md:flex items-center gap-2 bg-brand-surface/80 backdrop-blur-xl p-1.5 rounded-2xl border border-white/5 w-96 max-w-lg shadow-glass hover:shadow-2xl transition-all group focus-within:ring-1 focus-within:ring-brand-cyan/30">
                <input
                    className="flex-1 bg-transparent border-none text-sm px-4 focus:outline-none placeholder-brand-dim/50 text-brand-text font-medium"
                    placeholder="Paste YouTube Link..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitUrl()}
                />
                <button onClick={submitUrl} className="bg-brand-text hover:bg-white text-black px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:shadow-lg transition-all">
                    Play
                </button>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
                {roomOwner === username ? (
                    <button className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-4 py-2 rounded-full transition-all border border-red-500/10 text-xs lg:text-sm font-semibold backdrop-blur-md" onClick={() => setShowDeleteModal(true)}>
                        End Room
                    </button>
                ) : (
                    <button className="bg-white/5 hover:bg-white/10 text-brand-dim hover:text-white px-4 py-2 rounded-full transition-all border border-white/5 text-xs lg:text-sm font-semibold backdrop-blur-md" onClick={() => setShowLeaveModal(true)}>
                        Leave
                    </button>
                )}
            </div>
        </header>
    );
};

export default RoomHeader;
