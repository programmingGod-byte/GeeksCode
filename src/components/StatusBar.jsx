import React from 'react';

export default function StatusBar({ position, language, encoding, theme, onThemeChange, zoomLevel, onZoomIn, onZoomOut, onResetZoom, ragProgress }) {
    const zoomPercent = Math.round((zoomLevel + 1) * 100); // Simple mapping for display
    const progressPercent = ragProgress ? Math.round(((ragProgress.current + 1) / ragProgress.total) * 100) : 0;

    return (
        <div id="status-bar">
            <div className="status-left">
                <div className="status-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>
                    </svg>
                    <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>GeeksCode</span>
                </div>
                
                {ragProgress && (
                    <div className="status-item rag-progress-container" title={`Indexing ${ragProgress.filename}`}>
                        <span className="rag-status-text">
                            Indexing {ragProgress.type === 'kb' ? 'KB' : 'Project'}: {ragProgress.current + 1}/{ragProgress.total} 
                        </span>
                        <div className="rag-progress-bar-bg">
                            <div className="rag-progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="status-right">
                <div className="status-item zoom-controls">
                    <button onClick={onZoomOut} title="Zoom Out" className="zoom-btn">−</button>
                    <span className="zoom-value" onClick={onResetZoom} title="Reset Zoom">
                        {Math.round(Math.pow(1.2, zoomLevel) * 100)}%
                    </span>
                    <button onClick={onZoomIn} title="Zoom In" className="zoom-btn">+</button>
                </div>

                <div className="status-item theme-selector-container">
                    <select 
                        value={theme} 
                        onChange={(e) => onThemeChange(e.target.value)}
                        className="theme-select"
                    >
                        <option value="vs-dark">Dark (Modern)</option>
                        <option value="vs">Light (Clean)</option>
                        <option value="monokai-dark">Monokai (Dark)</option>
                    </select>
                </div>
                <div className="status-item">Line {position.line}, Col {position.col}</div>
                <div className="status-item">{encoding}</div>
                <div className="status-item">{language}</div>
            </div>
        </div>
    );
}
