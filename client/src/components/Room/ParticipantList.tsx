import type { FC } from 'react';
import { FaMicrophoneSlash } from 'react-icons/fa';
import SimplePeer from 'simple-peer';

interface PeerData {
    peerId: string;
    peer: SimplePeer.Instance;
    username: string;
    isMuted: boolean;
    stream?: MediaStream;
}

interface ParticipantListProps {
    peers: PeerData[];
    username: string;
    roomOwner: string;
    muted: boolean;
}

const ParticipantList: FC<ParticipantListProps> = ({ peers, username, roomOwner, muted }) => {
    return (
        <div className="absolute inset-0 overflow-y-auto p-4 space-y-3 custom-scrollbar flex flex-col bg-brand-surface border-l border-white/5 font-sans">

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-brand-black/20 border border-white/5 relative overflow-hidden group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-cyan to-brand-purple flex items-center justify-center font-bold text-white shadow-glow-cyan text-sm">
                    {username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-brand-text text-sm">{username} (You)</span>
                        {roomOwner === username && <span className="text-[10px] bg-brand-purple/10 text-brand-purple border border-brand-purple/20 px-2 py-0.5 rounded-full font-semibold">Owner</span>}
                    </div>
                    <span className="text-xs text-brand-cyan/80 flex items-center gap-1.5 font-medium">
                        <div className="w-1.5 h-1.5 bg-brand-cyan rounded-full shadow-glow-cyan"></div>
                        Online {muted && <span className="text-brand-dim text-[10px]">• Muted</span>}
                    </span>
                </div>
            </div>

            {peers.map((peer) => (
                <div key={peer.peerId} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all">
                    <div className="w-10 h-10 rounded-full bg-brand-black/50 flex items-center justify-center font-bold text-brand-dim border border-white/5 text-sm">
                        {peer.username ? peer.username.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-brand-text text-sm">{peer.username || 'Connecting...'}</span>
                            {roomOwner === peer.username && <span className="text-[10px] bg-brand-purple/10 text-brand-purple border border-brand-purple/20 px-2 py-0.5 rounded-full font-semibold">Owner</span>}
                        </div>
                        <span className="text-xs text-brand-dim flex items-center gap-1.5">
                            {peer.isMuted ? <FaMicrophoneSlash className="text-red-400" size={10} /> : <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>}
                            {peer.isMuted ? 'Muted' : 'Speaking'}
                        </span>
                    </div>
                </div>
            ))}
            <div className="mt-8 px-8 text-center opacity-50">
                <p className="text-xs text-gray-500">Invite friends by sharing the URL</p>
            </div>
        </div>
    );
};

export default ParticipantList;
