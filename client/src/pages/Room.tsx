import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import type { FormEvent, ChangeEvent, MouseEvent, MutableRefObject, FC } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import SimplePeer from 'simple-peer';
import { useSocket } from '../context/SocketContext';
import {
    FaPlay, FaPause, FaMicrophone, FaMicrophoneSlash,
    FaVideo, FaExpand, FaCompress, FaPaperPlane, FaTimes
} from 'react-icons/fa';

// Polyfill for SimplePeer
if (typeof window !== 'undefined' && !(window as any).process) {
    (window as any).process = { env: { DEBUG: undefined }, nextTick: (cb: any) => setTimeout(cb, 0) };
}

// --- TYPES ---
interface PeerData {
    peerId: string;
    peer: SimplePeer.Instance;
    username: string;
    isMuted: boolean;
    stream?: MediaStream;
}

interface ChatMessage {
    user: string;
    text: string;
    time: string;
    isSystem?: boolean;
}

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

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
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = () => setApiReady(true);
        } else {
            setApiReady(true);
        }
    }, []);

    useEffect(() => {
        if (apiReady && containerRef.current && !playerInstanceRef.current && videoId) {
            playerInstanceRef.current = new window.YT.Player(containerRef.current, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    'playsinline': 1, 'controls': 0, 'disablekb': 1, 'rel': 0,
                    'showinfo': 0, 'modestbranding': 1, 'origin': window.location.origin
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


// --- CUSTOM CONTROLS ---
const ControlBar = ({
    playing, currentTime, duration, onTogglePlay, onSeek, onSeekEnd, onFullscreen, isFullscreen
}: {
    playing: boolean, currentTime: number, duration: number,
    onTogglePlay: () => void, onSeek: (e: ChangeEvent<HTMLInputElement>) => void, onSeekEnd: (e: MouseEvent<HTMLInputElement>) => void,
    onFullscreen: () => void, isFullscreen: boolean
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


const Room: FC = () => {
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { username, create } = location.state || {}; // Username and create flag

    const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants'>('chat');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    // Video State
    const [inputUrl, setInputUrl] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');
    const [videoId, setVideoId] = useState('');
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [seekTrigger, setSeekTrigger] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Socket / Peers
    const socket = useSocket();
    const isRemoteUpdate = useRef(false);
    const playerInstanceRef = useRef<any>(null);
    const [peers, setPeers] = useState<PeerData[]>([]);
    const peersRef = useRef<PeerData[]>([]);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [muted, setMuted] = useState(false);

    // Room Management
    const [roomOwner, setRoomOwner] = useState<string>('');
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Chat
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [msgInput, setMsgInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // --- INIT ---
    useEffect(() => {
        if (!username) { navigate('/'); return; }
        if (!socket || !roomId) return;

        const init = async () => {
            try {
                // 1. Get Stream
                const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                setStream(s);

                // 2. Join or Create Room
                if (create) {
                    socket.emit('create-room', roomId, username);
                    // Clear create flag from history so back button/refresh treats this as a join
                    navigate('.', { replace: true, state: { ...location.state, create: false } });
                } else {
                    socket.emit('join-room', roomId, username);
                }

                // 3. Setup Listeners

                // New: Handle Room Not Found Error
                socket.on('error-room-not-found', () => {
                    toast.error("Room not found! Please check the ID or create a new room.");
                    navigate('/');
                });
                socket.on('room-sync', (data) => {
                    if (data.owner) setRoomOwner(data.owner);
                    setMessages(data.messages || []);
                    if (data.videoState) {
                        if (data.videoState.url) { setCurrentUrl(data.videoState.url); setInputUrl(data.videoState.url); }
                        if (data.videoState.playing !== undefined) setPlaying(data.videoState.playing);
                        if (data.videoState.currentTime) {
                            setSeekTrigger(data.videoState.currentTime);
                            setCurrentTime(data.videoState.currentTime);
                        }
                    }

                    // --- Improved Peer Logic: Initiate to ALL present users ---
                    const users = data.users || [];
                    const peersToRender: PeerData[] = [];

                    users.forEach((user: any) => {
                        if (user.socketId === socket.id) return; // Skip self

                        // Check if we already have a peer for this user (should be empty on initial join)
                        const existing = peersRef.current.find(p => p.peerId === user.socketId);
                        if (existing) {
                            peersToRender.push(existing);
                        } else {
                            // We are the JOINER, so we INITIATE connection to EXISTING users.
                            const p = new SimplePeer({ initiator: true, stream: s });

                            p.on('signal', sig => {
                                socket.emit('signal', { userToCall: user.socketId, signal: sig, from: socket.id });
                            });

                            p.on('stream', remoteStream => {
                                const target = peersRef.current.find(pd => pd.peer === p);
                                if (target) {
                                    target.stream = remoteStream;
                                    setPeers([...peersRef.current]);
                                }
                            });

                            p.on('error', err => { /* handle peer error silently or log to analytics */ });

                            const peerData = {
                                peerId: user.socketId,
                                peer: p,
                                username: user.username,
                                isMuted: user.isMuted
                            };
                            peersRef.current.push(peerData);
                            peersToRender.push(peerData);
                        }
                    });
                    setPeers([...peersRef.current]);
                });

                socket.on('room-ended', () => {
                    toast.error("The room has been deleted by the owner.");
                    navigate('/');
                });


                socket.on('all-users', (users) => {
                    // Update the list of peers based on server state
                    // This is mainly for:
                    // 1. Removing disconnected users
                    // 2. Updating metadata (mute status, username)
                    // 3. (Optional) Adding new users for UI purposes before connection established

                    const currentPeers = peersRef.current;
                    const newPeers: PeerData[] = [];

                    // Identify and remove disconnected peers
                    currentPeers.forEach(p => {
                        const stillHere = users.find((u: any) => u.socketId === p.peerId);
                        if (!stillHere) {
                            p.peer.destroy();
                        } else {
                            // Update metadata
                            p.username = stillHere.username;
                            p.isMuted = stillHere.isMuted;
                            newPeers.push(p);
                        }
                    });

                    // Check for new users that might not have connected yet (should be handled by signal, but good for UI)
                    /* 
                       Note: If we add placeholder peers here, we must be careful not to double-create.
                       Wait for 'signal' to create the actual SimplePeer instance for incoming connections.
                    */

                    peersRef.current = newPeers;
                    setPeers([...newPeers]);
                });

                socket.on('user-connected', (user) => {
                    // Just a notification
                    setMessages(prev => [...prev, { user: 'System', text: `${user.username || 'Someone'} joined`, time: '', isSystem: true }]);
                });

                socket.on('user-disconnected', (id) => {
                    const p = peersRef.current.find(x => x.peerId === id);
                    if (p) {
                        p.peer.destroy();
                        setMessages(prev => [...prev, { user: 'System', text: `${p.username || 'Someone'} left`, time: '', isSystem: true }]);
                    }
                    const remaining = peersRef.current.filter(x => x.peerId !== id);
                    peersRef.current = remaining;
                    setPeers(remaining);
                });

                socket.on('signal', (data) => {
                    const found = peersRef.current.find(p => p.peerId === data.from);
                    if (found) {
                        found.peer.signal(data.signal);
                    } else {
                        // Receiving a signal from someone we don't know:
                        // This means THEY initiated. So we respond (initiator: false).
                        const p = new SimplePeer({ initiator: false, stream: s });

                        p.on('signal', sig => {
                            socket.emit('signal', { userToCall: data.from, signal: sig, from: socket.id });
                        });

                        p.on('stream', remoteStream => {
                            const target = peersRef.current.find(pd => pd.peer === p);
                            if (target) {
                                target.stream = remoteStream;
                                setPeers([...peersRef.current]);
                            }
                        });

                        p.on('error', err => console.error('Peer Response Error:', err));

                        p.signal(data.signal);

                        // We might not know their username yet if 'all-users' hasn't arrived/processed.
                        // Ideally pass username in 'signal' or wait for 'all-users'.
                        // For now, placeholder.
                        const newPeer = { peerId: data.from, peer: p, username: 'Connecting...', isMuted: true };
                        peersRef.current.push(newPeer);
                        setPeers([...peersRef.current]);
                    }
                });

                socket.on('receive-message', (data: ChatMessage) => {
                    setMessages(prev => [...prev, data]);
                    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                });

                socket.on('change-video', (url) => { setCurrentUrl(url); setInputUrl(url); setPlaying(true); setSeekTrigger(0); });
                socket.on('video-state', (state: any) => {
                    if (isRemoteUpdate.current) return;
                    isRemoteUpdate.current = true;
                    setPlaying(state.playing);
                    if (state.time !== undefined && state.type === 'seek') { setSeekTrigger(state.time); setCurrentTime(state.time); }
                    setTimeout(() => isRemoteUpdate.current = false, 800);
                });

            } catch (e) {
                console.error("Setup Error:", e);
                alert("Could not access microphone! Voice chat will not work.");
            }
        };

        // Delay init slightly to ensure socket is ready? No, useSocket handles it.
        // But running init immediately is fine.
        init();

        return () => {
            socket.off('all-users'); socket.off('signal'); socket.off('user-connected'); socket.off('receive-message');
            socket.off('change-video'); socket.off('video-state'); socket.off('room-sync'); socket.off('room-ended');
            if (stream) stream.getTracks().forEach(t => t.stop());
            peersRef.current.forEach(p => p.peer.destroy());
            peersRef.current = [];
        };
    }, [socket, roomId, username, navigate]);


    // ID Parser
    useEffect(() => {
        try {
            const u = new URL(currentUrl);
            setVideoId(u.searchParams.get('v') || '');
        } catch (e) { if (currentUrl.length === 11) setVideoId(currentUrl); }
    }, [currentUrl]);

    // Handlers
    const handleToggleMute = () => {
        if (stream) {
            const nextMute = !muted;
            stream.getAudioTracks().forEach(t => t.enabled = !nextMute);
            setMuted(nextMute);
            socket?.emit('toggle-mute', roomId, nextMute);
        }
    };

    const handleFullscreen = () => {
        if (!document.fullscreenElement) {
            videoContainerRef.current?.requestFullscreen(); setIsFullscreen(true);
        } else {
            document.exitFullscreen(); setIsFullscreen(false);
        }
    };

    const handleSendMessage = (e?: FormEvent) => {
        e?.preventDefault();
        if (!msgInput.trim() || !socket) return;
        socket.emit('send-message', { roomId, text: msgInput, username, timestamp: new Date().toISOString() });
        setMsgInput('');
    };

    const submitUrl = () => {
        if (socket && inputUrl) {
            socket.emit('change-video', roomId, inputUrl);
            setCurrentUrl(inputUrl); setPlaying(true); setSeekTrigger(0);
        }
    };

    const handleTogglePlay = () => {
        const next = !playing;
        setPlaying(next);
        const t = playerInstanceRef.current ? playerInstanceRef.current.getCurrentTime() : currentTime;
        if (!isRemoteUpdate.current && socket) socket.emit('video-state', roomId, { playing: next, type: 'playpause', time: t });
    };

    const handlePlayerStateChange = (s: number) => {
        if (isRemoteUpdate.current) return;
        if (s === 1 && !playing) {
            setPlaying(true);
            const t = playerInstanceRef.current ? playerInstanceRef.current.getCurrentTime() : currentTime;
            socket?.emit('video-state', roomId, { playing: true, type: 'playpause', time: t });
        } else if (s === 2 && playing) {
            setPlaying(false);
            const t = playerInstanceRef.current ? playerInstanceRef.current.getCurrentTime() : currentTime;
            socket?.emit('video-state', roomId, { playing: false, type: 'playpause', time: t });
        }
    };

    // Seek
    const handleSeek = (e: ChangeEvent<HTMLInputElement>) => { setIsDragging(true); setCurrentTime(parseFloat(e.target.value) * duration); };
    const handleSeekEnd = (e: MouseEvent<HTMLInputElement>) => {
        setIsDragging(false);
        const t = parseFloat((e.target as HTMLInputElement).value) * duration;
        setSeekTrigger(t);
        if (!isRemoteUpdate.current && socket) socket.emit('video-state', roomId, { playing: true, type: 'seek', time: t });
    };

    // Actions
    const handleLeaveRoom = () => {
        if (socket) socket.emit('leave-room', roomId);
        navigate('/');
    };

    const handleDeleteRoom = () => {
        if (socket) socket.emit('delete-room', roomId);
    };

    return (
        <div className="flex h-screen bg-[#0f0f0f] text-white font-sans overflow-hidden">
            {/* LIFT: Main Content */}
            <div className="flex-1 flex flex-col relative transition-all duration-300">
                {/* Header */}
                <header className="h-20 flex items-center justify-between px-8 absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-4 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                        <div className="bg-gradient-to-tr from-purple-600 to-pink-600 p-2 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                            <FaVideo className="text-white text-sm" />
                        </div>
                        <span className="font-bold tracking-wide">Room <span className="text-purple-400 font-mono">{roomId}</span></span>
                    </div>

                    {/* URL Bar */}
                    <div className="pointer-events-auto hidden md:flex items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 w-96 max-w-lg shadow-xl hover:border-purple-500/30 transition-colors">
                        <input
                            className="flex-1 bg-transparent border-none text-sm px-4 focus:outline-none placeholder-gray-500"
                            placeholder="Paste YouTube Link..."
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitUrl()}
                        />
                        <button onClick={submitUrl} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:opacity-90">
                            Play
                        </button>
                    </div>

                    <div className="pointer-events-auto flex items-center gap-2">
                        {roomOwner === username ? (
                            <button className="bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg transition-all border border-red-500/20 text-sm font-semibold" onClick={() => setShowDeleteModal(true)}>
                                Delete Room
                            </button>
                        ) : (
                            <button className="bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 px-4 py-2 rounded-lg transition-all border border-white/10 text-sm font-semibold" onClick={() => setShowLeaveModal(true)}>
                                Leave Room
                            </button>
                        )}
                    </div>
                </header>

                {/* Video Stage */}
                <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative" ref={videoContainerRef}>
                    <div className="w-full h-full max-w-6xl aspect-video bg-black relative rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 ring-1 ring-white/5 group">
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
                                <div className="p-6 rounded-full bg-white/5 mb-4 animate-pulse"><FaVideo size={40} className="opacity-20" /></div>
                                <p className="text-gray-400 font-light">Waiting for video...</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Bar: Mic Controls */}
                <div className="h-20 bg-[#0a0a0a]/50 backdrop-blur-sm flex items-center justify-center border-t border-white/5">
                    <button
                        onClick={handleToggleMute}
                        className={`flex items-center gap-3 px-6 py-3 rounded-full border transition-all ${muted ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30'}`}
                    >
                        {muted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                        <span className="font-semibold text-sm">{muted ? 'Unmuted' : 'Muted'} (Self)</span>
                    </button>
                </div>
            </div>

            {/* Sidebar */}
            <div className="w-[380px] bg-[#121212] border-l border-white/10 flex flex-col shadow-2xl z-40">
                <div className="flex text-sm font-semibold border-b border-white/5">
                    <button
                        className={`flex-1 py-5 transition-colors ${sidebarTab === 'chat' ? 'text-white border-b-2 border-purple-500 bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                        onClick={() => setSidebarTab('chat')}
                    >
                        Chat
                    </button>
                    <button
                        className={`flex-1 py-5 transition-colors ${sidebarTab === 'participants' ? 'text-white border-b-2 border-purple-500 bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                        onClick={() => setSidebarTab('participants')}
                    >
                        People ({peers.length + 1})
                    </button>
                </div>

                <div className="flex-1 overflow-hidden relative bg-[#0f0f0f]/50">
                    {/* CHAT */}
                    {sidebarTab === 'chat' && (
                        <div className="absolute inset-0 flex flex-col">
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {messages.map((m, i) => (
                                    <div key={i} className={`flex flex-col ${m.user === username ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                                        <div className="flex items-center gap-2 mb-1 opacity-50">
                                            <span className="text-[10px] uppercase tracking-wider font-bold">{m.user}</span>
                                            {m.time && <span className="text-[10px] text-gray-600">{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                        </div>
                                        <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm shadow-md ${m.isSystem ? 'bg-transparent text-gray-500 italic text-center w-full shadow-none'
                                            : m.user === username
                                                ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-br-none'
                                                : 'bg-[#222] border border-white/10 text-gray-200 rounded-bl-none'
                                            }`}>
                                            {m.text}
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef}></div>
                            </div>
                            <form onSubmit={handleSendMessage} className="p-4 bg-[#151515] border-t border-white/5 flex gap-2">
                                <input
                                    className="flex-1 bg-[#222] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-colors placeholder-gray-600"
                                    placeholder="Type something..."
                                    value={msgInput}
                                    onChange={(e) => setMsgInput(e.target.value)}
                                />
                                <button type="submit" className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-white transition-colors disabled:opacity-30" disabled={!msgInput.trim()}>
                                    <FaPaperPlane size={16} />
                                </button>
                            </form>
                        </div>
                    )}

                    {/* PARTICIPANTS */}
                    {sidebarTab === 'participants' && (
                        <div className="absolute inset-0 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white shadow-lg">{username?.charAt(0).toUpperCase()}</div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-200">{username} (You)</span>
                                        {roomOwner === username && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/30">OWNER</span>}
                                    </div>
                                    <span className="text-xs text-green-400 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div> Connected {muted && '(Muted)'}</span>
                                </div>
                            </div>
                            {peers.map((peer) => (
                                <div key={peer.peerId} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-300 shadow-inner">
                                        {peer.username ? peer.username.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-300">{peer.username || 'Connecting...'}</span>
                                            {roomOwner === peer.username && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/30">OWNER</span>}
                                        </div>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            {peer.isMuted ? <FaMicrophoneSlash className="text-red-400" size={10} /> : <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>}
                                            {peer.isMuted ? 'Muted' : 'Speaking'}
                                        </span>
                                    </div>
                                    <AudioPeer key={peer.peerId} stream={peer.stream || null} />
                                </div>
                            ))}
                            <div className="mt-8 px-8 text-center opacity-50">
                                <p className="text-xs text-gray-500">Invite friends by sharing the URL</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showLeaveModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
                        <h3 className="text-xl font-bold text-white mb-2">Leave Room?</h3>
                        <p className="text-gray-400 mb-6 text-sm">Are you sure you want to leave this room? You can rejoin later.</p>
                        <div className="flex gap-3 justify-end">
                            <button className="px-4 py-2 text-gray-300 hover:text-white transition-colors text-sm" onClick={() => setShowLeaveModal(false)}>Cancel</button>
                            <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-semibold" onClick={handleLeaveRoom}>Leave</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
                        <h3 className="text-xl font-bold text-red-500 mb-2">Delete Room?</h3>
                        <p className="text-gray-400 mb-6 text-sm">WARNING: This will permanently delete the room and kick ALL participants out. This action cannot be undone.</p>
                        <div className="flex gap-3 justify-end">
                            <button className="px-4 py-2 text-gray-300 hover:text-white transition-colors text-sm" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-semibold" onClick={handleDeleteRoom}>Delete Everything</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
            `}</style>
        </div>
    );
};

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

export default Room;
