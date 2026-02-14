import { Zap, Globe } from 'lucide-react';
import { getFileIcon } from '../utils/fileUtils';

export default function TabsBar({ tabs, activeTab, onSwitchTab, onCloseTab, onAnalyzeComplexity, onOpenBrowser }) {
    const hasTabs = tabs.length > 0;

    return (
        <div id="tabs-bar" className={hasTabs ? 'has-tabs' : ''}>
            <div id="tabs-container">
                {tabs.map((tab) => {
                    const iconInfo = getFileIcon(tab.fileName);
                    const isActive = tab.filePath === activeTab;
                    let className = 'tab';
                    if (isActive) className += ' active';
                    if (tab.isDirty) className += ' dirty';

                    return (
                        <div
                            key={tab.filePath}
                            className={className}
                            data-path={tab.filePath}
                            onClick={() => onSwitchTab(tab.filePath)}
                        >
                            <span className="tab-icon">
                                <span className={`codicon codicon-${iconInfo.icon}`} style={{ color: iconInfo.color }}></span>
                            </span>
                            <span className="tab-label">{tab.fileName}</span>
                            <span className="tab-dirty"></span>
                            <span
                                className="tab-close"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseTab(tab.filePath);
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M2 2L10 10M10 2L2 10" />
                                </svg>
                            </span>
                        </div>
                    );
                })}
            </div>
            
                <div className="flex items-center px-4 space-x-2 border-l border-[#2b2b2b]">
                    <button 
                        onClick={onOpenBrowser}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[11px] transition-colors border border-blue-500/30"
                        title="Open Browser"
                    >
                        <Globe size={12} />
                        <span>Browser</span>
                    </button>
                    <button 
                        onClick={onAnalyzeComplexity}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 text-[11px] transition-colors border border-purple-500/30"
                        title="Analyze Time & Space Complexity"
                    >
                        <Zap size={12} fill="currentColor" />
                        <span>Analyze Complexity</span>
                    </button>
                </div>
        </div>
    );
}
