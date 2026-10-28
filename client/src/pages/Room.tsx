import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import type { FC, FormEvent, ChangeEvent, MouseEvent } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import SimplePeer from 'simple-peer';
import { useSocket } from '../context/SocketContext';
import { FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';

// Components
import RoomHeader from '../components/Room/RoomHeader';
import RoomModals from '../components/Room/RoomModals';
import VideoStage from '../components/Room/VideoStage';
import ChatPanel from '../components/Room/ChatPanel';
import ParticipantList from '../components/Room/ParticipantList';
import AudioPeer from '../components/Room/AudioPeer';

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
    const [roomName, setRoomName] = useState<string>(location.state?.roomName || '');
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
                    socket.emit('create-room', roomId, username, roomName);
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
                    if (data.name) setRoomName(data.name);
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

                            p.on('error', _err => { /* handle peer error silently or log to analytics */ });

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
        <div className="flex flex-col lg:flex-row h-screen bg-[#0f0f0f] text-white font-sans overflow-hidden">
            {/* LEFT: Main Content */}
            <div className="w-full lg:flex-1 h-[40vh] lg:h-auto flex flex-col relative transition-all duration-300 flex-shrink-0">

                <RoomHeader
                    roomName={roomName}
                    inputUrl={inputUrl}
                    setInputUrl={setInputUrl}
                    submitUrl={submitUrl}
                    roomOwner={roomOwner}
                    username={username}
                    setShowDeleteModal={setShowDeleteModal}
                    setShowLeaveModal={setShowLeaveModal}
                />

                <VideoStage
                    videoId={videoId}
                    playing={playing}
                    seekTrigger={seekTrigger}
                    isDragging={isDragging}
                    setCurrentTime={setCurrentTime}
                    setDuration={setDuration}
                    handlePlayerStateChange={handlePlayerStateChange}
                    playerInstanceRef={playerInstanceRef}
                    handleTogglePlay={handleTogglePlay}
                    currentTime={currentTime}
                    duration={duration}
                    handleSeek={handleSeek}
                    handleSeekEnd={handleSeekEnd}
                    handleFullscreen={handleFullscreen}
                    isFullscreen={isFullscreen}
                    inputUrl={inputUrl}
                    setInputUrl={setInputUrl}
                    submitUrl={submitUrl}
                    videoContainerRef={videoContainerRef}
                />

                {/* Bottom Bar: Mic Controls - Compact on mobile */}
                <div className="h-14 lg:h-20 bg-[#0a0a0a]/50 backdrop-blur-sm flex items-center justify-center border-t border-white/5">
                    <button
                        onClick={handleToggleMute}
                        className={`flex items-center gap-2 lg:gap-3 px-4 lg:px-6 py-2 lg:py-3 rounded-full border transition-all ${muted ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30'}`}
                    >
                        {muted ? <FaMicrophoneSlash size={14} /> : <FaMicrophone size={14} />}
                        <span className="font-semibold text-xs lg:text-sm">{muted ? 'Unmuted' : 'Muted'}</span>
                    </button>
                </div>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-[380px] flex-1 lg:flex-none h-auto bg-[#121212] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col shadow-2xl z-40">
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
                        <ChatPanel
                            roomId={roomId || ''}
                            messages={messages}
                            username={username}
                            msgInput={msgInput}
                            setMsgInput={setMsgInput}
                            handleSendMessage={handleSendMessage}
                            chatEndRef={chatEndRef}
                        />
                    )}

                    {/* PARTICIPANTS */}
                    {sidebarTab === 'participants' && (
                        <ParticipantList
                            peers={peers}
                            username={username}
                            roomOwner={roomOwner}
                            muted={muted}
                        />
                    )}
                </div>
            </div>

            {/* Modals */}
            <RoomModals
                showLeaveModal={showLeaveModal}
                setShowLeaveModal={setShowLeaveModal}
                showDeleteModal={showDeleteModal}
                setShowDeleteModal={setShowDeleteModal}
                handleLeaveRoom={handleLeaveRoom}
                handleDeleteRoom={handleDeleteRoom}
            />

            {/* Audio Peers (Hidden but always active) */}
            <div className="hidden">
                {peers.map((peer) => (
                    <AudioPeer key={peer.peerId} stream={peer.stream || null} />
                ))}
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
            `}</style>
        </div>
    );
};

export default Room;
