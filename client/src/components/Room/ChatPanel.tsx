import { useState } from 'react';
import type { FC, FormEvent, MutableRefObject } from 'react';
import { FaPaperPlane, FaCopy, FaCheck } from 'react-icons/fa';

interface ChatMessage {
    user: string;
    text: string;
    time: string;
    isSystem?: boolean;
}

interface ChatPanelProps {
    roomId: string; // Added roomId
    messages: ChatMessage[];
    username: string;
    msgInput: string;
    setMsgInput: (val: string) => void;
    handleSendMessage: (e?: FormEvent) => void;
    chatEndRef: MutableRefObject<HTMLDivElement | null>;
}

const ChatPanel: FC<ChatPanelProps> = ({ roomId, messages, username, msgInput, setMsgInput, handleSendMessage, chatEndRef }) => {
    const [copied, setCopied] = useState(false);

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full flex flex-col relative bg-brand-surface border-l border-white/5 font-sans">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-brand-surface/90 border-b border-white/5 p-4 flex items-center justify-between backdrop-blur-md">
                <span className="text-xs font-bold text-brand-dim uppercase tracking-wider">Room Code</span>
                <div
                    className="flex items-center gap-3 bg-gradient-to-b from-white/10 to-transparent px-3 py-1.5 rounded-lg border border-white/10 hover:border-brand-purple/30 transition-all cursor-pointer group active:scale-95 shadow-sm"
                    onClick={copyRoomId}
                    title="Copy Room ID"
                >
                    <span className="font-mono text-sm text-brand-text font-semibold">{roomId}</span>
                    {copied ? <FaCheck size={12} className="text-brand-cyan" /> : <FaCopy size={12} className="text-brand-dim group-hover:text-white transition-colors" />}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 pt-20 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-brand-dim text-sm space-y-2 opacity-60">
                        <p className="font-medium">No messages yet.</p>
                        <p className="text-xs">Start the conversation!</p>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.user === username ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        {!m.isSystem && (
                            <div className="flex items-center gap-2 mb-1 px-1">
                                <span className="text-[10px] text-brand-dim font-bold uppercase tracking-wider">{m.user === username ? 'You' : m.user}</span>
                                {m.time && <span className="text-[10px] text-brand-dim/50">{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                        )}
                        <div className={`px-4 py-2.5 max-w-[85%] text-sm break-words shadow-sm ${m.isSystem ? 'bg-transparent text-brand-dim text-xs italic text-center w-full shadow-none my-2'
                            : m.user === username
                                ? 'bg-brand-text text-brand-black font-medium rounded-2xl rounded-tr-sm'
                                : 'bg-brand-black/50 border border-white/5 text-brand-text rounded-2xl rounded-tl-sm'
                            }`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef}></div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 bg-brand-surface border-t border-white/5 flex gap-3 shrink-0 z-20 relative">
                <input
                    className="flex-1 bg-brand-black/50 border border-white/5 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-brand-cyan/30 focus:bg-brand-black transition-all placeholder-brand-dim text-brand-text"
                    placeholder="Type a message..."
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                />
                <button
                    type="submit"
                    className="bg-brand-text hover:bg-white text-brand-black p-3.5 rounded-2xl transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center"
                    disabled={!msgInput.trim()}
                >
                    <FaPaperPlane size={16} />
                </button>
            </form>
        </div>
    );
};

export default ChatPanel;
