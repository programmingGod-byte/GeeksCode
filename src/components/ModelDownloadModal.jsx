import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, CheckCircle, X } from 'lucide-react';

const ModelDownloadModal = ({ onClose, onDownloadComplete }) => {
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        // Listen for download progress
        if (window.electronAPI && window.electronAPI.onAIDownloadProgress) {
            window.electronAPI.onAIDownloadProgress((prog) => {
                setProgress(prog);
                if (prog >= 100) {
                    setIsComplete(true);
                    setDownloading(false);
                     setTimeout(() => {
                        onDownloadComplete();
                    }, 1500);
                }
            });
        }
    }, [onDownloadComplete]);

    const handleDownload = async () => {
        setDownloading(true);
        setError(null);
        try {
            const result = await window.electronAPI.initAI();
            if (!result.success) {
                setError(result.error);
                setDownloading(false);
            }
        } catch (err) {
            setError(err.message);
            setDownloading(false);
        }
    };

    const handleDelete = async () => {
        if (window.electronAPI && window.electronAPI.deleteModel) {
            try {
                await window.electronAPI.deleteModel();
                setIsComplete(false);
                setProgress(0);
                setError(null);
                // Optional: Trigger redownload immediately or just let user click download
            } catch (e) {
                setError("Failed to delete model: " + e.message);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#1e1e1e] border border-[#2b2b2b] rounded-lg shadow-2xl w-[500px] p-6 text-vscode-text animate-fade-in relative">
                {/* Close Button for skipping */}
                {!downloading && !isComplete && (
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        title="Skip for now"
                    >
                        <X size={20} />
                    </button>
                )}

                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-4 text-blue-500">
                        {isComplete ? <CheckCircle size={32} /> : <Download size={32} />}
                    </div>
                    
                    <h2 className="text-xl font-bold text-white mb-2">
                        {isComplete ? "Model Ready!" : "Setup Local AI"}
                    </h2>
                    
                    <p className="text-gray-400 text-sm mb-6 max-w-[80%]">
                        {isComplete 
                            ? "DeepSeek Coder 1.3B is installed and ready to use."
                            : "GeeksCode uses DeepSeek Coder 1.3B for local AI assistance. Ideally, this requires downloading ~1.3GB of data."
                        }
                    </p>

                    {error && (
                        <div className="flex items-center space-x-2 text-red-400 bg-red-400/10 px-4 py-2 rounded mb-4 text-sm">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {!downloading && !isComplete && (
                         <div className="flex space-x-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#2d2d2d] rounded transition-colors"
                            >
                                Skip
                            </button>
                            <button
                                onClick={handleDownload}
                                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-lg transition-all transform hover:scale-105"
                            >
                                Download Model (1.3GB)
                            </button>
                        </div>
                    )}

                    {!downloading && isComplete && (
                        <div className="flex space-x-3 mt-4">
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors border border-red-900/50"
                            >
                                Delete Model
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded shadow-lg"
                            >
                                Done
                            </button>
                        </div>
                    )}

                    {downloading && (
                        <div className="w-full">
                            <div className="flex justify-betweentext-xs text-gray-400 mb-1">
                                <span>Downloading...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-[#2d2d2d] h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-blue-600 h-full transition-all duration-200 ease-out" 
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Please do not close the application.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModelDownloadModal;
