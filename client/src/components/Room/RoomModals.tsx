import type { FC } from 'react';

interface RoomModalsProps {
    showLeaveModal: boolean;
    setShowLeaveModal: (val: boolean) => void;
    showDeleteModal: boolean;
    setShowDeleteModal: (val: boolean) => void;
    handleLeaveRoom: () => void;
    handleDeleteRoom: () => void;
}

const RoomModals: FC<RoomModalsProps> = ({
    showLeaveModal, setShowLeaveModal, showDeleteModal, setShowDeleteModal, handleLeaveRoom, handleDeleteRoom
}) => {
    return (
        <>
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
        </>
    );
};

export default RoomModals;
