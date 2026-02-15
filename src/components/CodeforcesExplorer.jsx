import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, ExternalLink, Activity, Target, Settings } from 'lucide-react';

export default function CodeforcesExplorer({ onOpenSettings, onOpenProblem }) {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [handle, setHandle] = useState('');
    const [userInfo, setUserInfo] = useState(null);
    const [error, setError] = useState('');

    const fetchData = async () => {
        const creds = await window.electronAPI.codeforces.getCreds();
        if (!creds || !creds.handle) {
            setError('Please set your CF handle in Settings');
            return;
        }
        setHandle(creds.handle);
        setLoading(true);
        setError('');
        try {
            // Fetch User Info
            const userRes = await window.electronAPI.codeforces.getUserInfo(creds.handle);
            if (userRes.status === 'OK' && userRes.result && userRes.result.length > 0) {
                setUserInfo(userRes.result[0]);
            } else {
                console.warn("User info fetch failed:", userRes);
            }

            // Fetch Submissions
            const data = await window.electronAPI.codeforces.getSubmissions(creds.handle);

            if (data.status === 'OK') {
                setSubmissions(data.result);
            } else {
                setError(`API Error: ${data.comment || 'Unknown error'}`);
            }
        } catch (err) {
            console.error("CF Fetch Error:", err);
            setError(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getVerdictColor = (verdict) => {
        if (verdict === 'OK') return 'text-green-500';
        if (verdict === 'WRONG_ANSWER') return 'text-red-500';
        return 'text-yellow-500';
    };

    const handleOpenProblem = (sub) => {
        if (onOpenProblem) {
            const url = `https://codeforces.com/contest/${sub.contestId}/problem/${sub.problem.index}`;
            onOpenProblem(url);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-sidebar)] overflow-hidden text-[var(--text-primary)]">
            <div className="p-3 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-primary)]">
                <div className="flex items-center space-x-2">
                    <Trophy size={14} className="text-yellow-500" />
                    <span className="text-[11px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">Codeforces Activity</span>
                </div>
                <div className="flex items-center space-x-1">
                    <button
                        onClick={onOpenSettings}
                        className="p-1 hover:bg-[var(--bg-selected)] rounded transition-colors"
                        title="Codeforces Settings"
                    >
                        <Settings size={14} className="text-[var(--text-secondary)]" />
                    </button>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1 hover:bg-[var(--bg-selected)] rounded transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)]`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {error ? (
                    <div className="p-4 text-center">
                        <Activity size={32} className="mx-auto text-red-500/50 mb-2" />
                        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{error}</p>
                    </div>
                ) : submissions.length > 0 ? (
                    <div className="divide-y border-[var(--border-color)]">
                        {submissions.map((sub) => (
                            <div
                                key={sub.id}
                                className="p-3 hover:bg-[var(--bg-selected)] transition-colors group cursor-pointer"
                                onClick={() => handleOpenProblem(sub)}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-medium text-[var(--text-primary)] truncate pr-2">
                                        {sub.problem.name}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-color)] ${getVerdictColor(sub.verdict)}`}>
                                        {sub.verdict === 'OK' ? 'AC' : sub.verdict}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-3 text-[10px] text-[var(--text-secondary)]">
                                    <span className="flex items-center space-x-1">
                                        <Target size={10} />
                                        <span>{sub.problem.index}</span>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                        <span>{sub.problem.rating || 'Unrated'}</span>
                                    </span>
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                                        <div className="flex items-center space-x-1 hover:text-[var(--text-primary)]">
                                            <ExternalLink size={10} />
                                            <span>Open</span>
                                        </div>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : !loading && (
                    <div className="p-10 text-center opacity-50">
                        <Trophy size={48} className="mx-auto mb-4" />
                        <p className="text-sm">No recent activity</p>
                    </div>
                )}
                {loading && (
                    <div className="p-8 space-y-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="animate-pulse space-y-2">
                                <div className="h-3 bg-white/5 rounded w-3/4"></div>
                                <div className="h-2 bg-white/5 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {userInfo && (
                <div className="p-3 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-[var(--border-color)]">
                            <img src={userInfo.titlePhoto} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold ${userInfo.rank === 'legendary grandmaster' ? 'text-red-500 first-letter:text-black' : 'text-[var(--text-primary)]'}`}>
                                    {userInfo.handle}
                                </span>
                                <span className="text-[10px] text-[var(--text-secondary)]">{userInfo.rating}</span>
                            </div>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-70 capitalize block truncate">{userInfo.rank}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
