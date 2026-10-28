import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FaVideo } from 'react-icons/fa';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const res = await axios.post(`${SERVER_URL}/api/auth/login`, { email, password });
            login(res.data.token, res.data.user);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.msg || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-cyan/5 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-brand-purple/5 rounded-full blur-[100px]"></div>
            </div>

            <div className="w-full max-w-md bg-brand-surface/60 backdrop-blur-xl p-8 rounded-3xl border border-white/5 shadow-glass relative z-10">
                <div className="flex justify-center mb-8">
                    <div className="bg-gradient-to-tr from-brand-cyan to-brand-purple p-0.5 rounded-2xl shadow-glow-cyan">
                        <div className="bg-brand-black p-3 rounded-2xl">
                            <FaVideo className="text-white text-2xl" />
                        </div>
                    </div>
                </div>
                <h2 className="text-3xl font-bold text-brand-text text-center mb-2 tracking-tight">Welcome Back</h2>
                <p className="text-brand-dim text-center mb-8 text-sm uppercase tracking-widest">Connect to the Stream</p>

                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg mb-6 text-sm text-center">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-semibold text-brand-dim uppercase tracking-wider mb-2 ml-1">Identity</label>
                        <input
                            type="text"
                            className="w-full bg-brand-black/50 border border-white/5 rounded-xl px-4 py-3 text-brand-text focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 transition-all placeholder-brand-dim/30"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="username@domain.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-brand-dim uppercase tracking-wider mb-2 ml-1">Passkey</label>
                        <input
                            type="password"
                            className="w-full bg-brand-black/50 border border-white/5 rounded-xl px-4 py-3 text-brand-text focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 transition-all placeholder-brand-dim/30"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button type="submit" className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-colors shadow-lg shadow-white/5 active:scale-[0.98]">
                        Sign In
                    </button>
                </form>

                <p className="mt-8 text-center text-brand-dim text-sm">
                    New User? <Link to="/signup" className="text-brand-text hover:text-brand-cyan transition-colors font-medium">Create Account</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
