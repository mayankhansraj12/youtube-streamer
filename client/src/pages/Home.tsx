import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaYoutube, FaMagic, FaPlay } from 'react-icons/fa';

const Home: React.FC = () => {
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');
    const navigate = useNavigate();

    const handleJoin = () => {
        if (!roomId || !username) return;
        navigate(`/room/${roomId}`, { state: { username, create: false } });
    };

    const handleCreate = () => {
        if (!username) return;
        // Generate a 6-character room ID (random alphanumeric)
        const newRoomId = Math.random().toString(36).substring(2, 8);
        navigate(`/room/${newRoomId}`, { state: { username, create: true } });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f0f0f] text-white p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
            </div>

            <div className="z-10 w-full max-w-md">
                <div className="text-center mb-8 lg:mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-2xl shadow-purple-500/30 mb-4 lg:mb-6 transform rotate-3 hover:rotate-6 transition-transform">
                        <FaYoutube className="text-3xl lg:text-4xl text-white" />
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Stream<span className="text-purple-500">Sync</span>
                    </h1>
                    <p className="text-gray-400 font-medium text-sm lg:text-base">Watch together, wherever you are.</p>
                </div>

                <div className="bg-[#1a1a1a]/80 backdrop-blur-xl p-6 lg:p-8 rounded-3xl shadow-2xl border border-white/10 ring-1 ring-white/5">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 ml-1">Display Name</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-4 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-white placeholder-gray-600"
                                placeholder="Enter your nickname"
                            />
                        </div>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-white/10"></div>
                            <span className="flex-shrink-0 mx-4 text-xs text-gray-500 uppercase tracking-widest font-semibold">Join Room</span>
                            <div className="flex-grow border-t border-white/10"></div>
                        </div>

                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                className="flex-1 p-4 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-white placeholder-gray-600"
                                placeholder="Room Code"
                            />
                            <button
                                onClick={handleJoin}
                                disabled={!roomId || !username}
                                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl font-semibold transition-all border border-white/10 active:scale-95"
                            >
                                <FaPlay />
                            </button>
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={!username}
                            className="w-full group bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold shadow-lg shadow-purple-900/30 transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                            <FaMagic className="group-hover:rotate-12 transition-transform" />
                            Create New Space
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-600 mt-8">
                    &copy; 2024 StreamSync. High Fidelity Audio & Video.
                </p>
            </div>
        </div>
    );
};

export default Home;
