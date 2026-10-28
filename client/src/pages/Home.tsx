import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaYoutube, FaMagic, FaPlay, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const Home: React.FC = () => {
    const { user, logout } = useAuth();
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState(user?.username || '');
    const [roomNameInput, setRoomNameInput] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (user?.username) setUsername(user.username);
    }, [user]);

    const handleJoin = () => {
        if (!roomId || !username) return;
        navigate(`/room/${roomId}`, { state: { username, create: false } });
    };

    const handleCreate = () => {
        if (!username) return;
        // Generate a 6-character room ID (random alphanumeric)
        const newRoomId = Math.random().toString(36).substring(2, 8);
        navigate(`/room/${newRoomId}`, { state: { username, roomName: roomNameInput, create: true } });
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-brand-black text-brand-text p-4 relative overflow-hidden font-sans">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-brand-cyan/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-brand-purple/5 rounded-full blur-[120px]"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
            </div>

            {/* Logout Button */}
            <button
                onClick={handleLogout}
                className="absolute top-6 right-6 z-50 flex items-center gap-2 bg-brand-surface/80 hover:bg-white/10 text-brand-text/80 hover:text-white px-4 py-2 rounded-full transition-all border border-white/5 hover:border-white/10 shadow-glass backdrop-blur-md"
            >
                <FaSignOutAlt className="text-sm" />
                <span className="text-xs font-semibold tracking-wide">LOGOUT</span>
            </button>

            <div className="z-10 w-full max-w-md">
                <div className="text-center mb-10 lg:mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 mb-6 relative group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-brand-cyan to-brand-purple rounded-3xl rotate-6 opacity-50 group-hover:rotate-12 transition-transform duration-500 blur-xl"></div>
                        <div className="relative bg-brand-surface/90 p-5 rounded-2xl border border-white/10 shadow-2xl">
                            <FaYoutube className="text-4xl text-white" />
                        </div>
                    </div>

                    <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight mb-3 text-white">
                        Stream<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan to-brand-purple">Sync</span>
                    </h1>
                    <p className="text-brand-dim font-medium tracking-wide text-sm">Next-Gen Synchronized Viewing</p>
                </div>

                <div className="bg-brand-surface/60 backdrop-blur-2xl p-8 rounded-3xl shadow-glass border border-white/5 relative overflow-hidden">

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-brand-dim mb-2 ml-1">Display Name</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-4 bg-brand-black/50 border border-white/5 rounded-2xl focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 transition-all text-brand-text placeholder-brand-dim/50 font-medium text-sm"
                                placeholder="Enter your name"
                            />
                        </div>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-white/5"></div>
                            <span className="flex-shrink-0 mx-4 text-[10px] text-brand-dim uppercase tracking-widest font-bold opacity-60">Join Room</span>
                            <div className="flex-grow border-t border-white/5"></div>
                        </div>

                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                className="flex-1 p-4 bg-brand-black/50 border border-white/5 rounded-2xl focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 transition-all text-brand-text placeholder-brand-dim/50 font-medium text-sm"
                                placeholder="Enter Room Code"
                            />
                            <button
                                onClick={handleJoin}
                                disabled={!roomId || !username}
                                className="bg-brand-cyan/10 hover:bg-brand-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed text-brand-cyan border border-brand-cyan/30 px-6 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                            >
                                <FaPlay />
                            </button>
                        </div>

                        <div className="flex gap-3 mb-6">
                            <input
                                type="text"
                                value={roomNameInput}
                                onChange={(e) => setRoomNameInput(e.target.value)}
                                className="flex-1 p-4 bg-brand-black/50 border border-white/5 rounded-2xl focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 transition-all text-brand-text placeholder-brand-dim/50 font-medium text-sm"
                                placeholder="New Room Name (Optional)"
                            />
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={!username || !roomNameInput.trim()}
                            className="w-full group bg-gradient-to-r from-brand-cyan to-brand-purple hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-2xl font-bold shadow-lg shadow-brand-purple/20 transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm tracking-wide"
                        >
                            <FaMagic className="group-hover:rotate-12 transition-transform" />
                            Create New Space
                        </button>
                    </div>
                </div>

                <div className="text-center mt-8 opacity-40 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-brand-text uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
                        StreamSync <span className="w-1 h-1 bg-brand-text rounded-full"></span> 2024
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Home;
