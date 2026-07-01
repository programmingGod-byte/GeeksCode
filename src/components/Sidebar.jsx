import React, { useState, useCallback } from 'react';
import { FilePlus, FolderPlus, RefreshCw, X, Check } from 'lucide-react';
import { getFileIcon, getFolderIcon } from '../utils/fileUtils';

function TreeItem({ entry, depth, onFileClick, activeFile }) {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState(null);

    const handleClick = useCallback(async (e) => {
        e.stopPropagation();
        if (entry.isDirectory) {
            if (!isOpen && children === null) {
                const entries = await window.electronAPI.readDir(entry.path);
                setChildren(entries);
            }
            setIsOpen((prev) => !prev);
        } else {
            onFileClick(entry.path, entry.name);
        }
    }, [entry, isOpen, children, onFileClick]);

    const isSelected = !entry.isDirectory && entry.path === activeFile;

    return (
        <>
            <div
                className={`tree-item${isSelected ? ' selected' : ''}`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                data-path={entry.path}
                onClick={handleClick}
            >
                {entry.isDirectory ? (
                    <>
                        <span className={`chevron${isOpen ? ' open' : ''}`}>
                            <svg viewBox="0 0 16 16" fill="currentColor">
                                <path d="M6 4l4 4-4 4z" />
                            </svg>
                        </span>
                        <span className="file-icon" dangerouslySetInnerHTML={{ __html: getFolderIcon(isOpen) }}></span>
                    </>
                ) : (
                    <>
                        <span className="chevron" style={{ visibility: 'hidden' }}>
                            <svg viewBox="0 0 16 16"><path /></svg>
                        </span>
                        <span className="file-icon" dangerouslySetInnerHTML={{ __html: getFileIcon(entry.name).icon }}></span>
                    </>
                )}
                <span className="file-label">{entry.name}</span>
            </div>
            {entry.isDirectory && isOpen && children && (
                <div className="tree-children open">
                    {children.map((child) => (
                        <TreeItem
                            key={child.path}
                            entry={child}
                            depth={depth + 1}
                            onFileClick={onFileClick}
                            activeFile={activeFile}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

function InlineInput({ type, onConfirm, onCancel }) {
    const [name, setName] = React.useState('');
    const inputRef = React.useRef(null);

    React.useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleKey = (e) => {
        if (e.key === 'Enter') {
            if (name.trim()) onConfirm(name.trim());
            else onCancel();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div className="tree-item inline-input-container px-2 py-1 flex items-center gap-2 bg-[var(--bg-selected)]">
            <span className="file-icon" dangerouslySetInnerHTML={{
                __html: type === 'folder' ? getFolderIcon(false) : getFileIcon(name).icon
            }}></span>
            <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKey}
                onBlur={onCancel}
                className="flex-1 bg-transparent border-none outline-none text-xs text-white"
                placeholder={type === 'folder' ? 'Folder name' : 'File name'}
            />
        </div>
    );
}

import CodeforcesExplorer from './CodeforcesExplorer';
import CodeforcesProblemFilter from './CodeforcesProblemFilter';
import CodeRunner from './CodeRunner';
import TestCaseGenerator from './TestCaseGenerator';
import SearchPanel from './SearchPanel';

export default function Sidebar({
    folderName,
    folderPath,
    entries,
    onOpenFolder,
    onFileClick,
    onCreateItem,
    activeFile,
    activePanel,
    onCfSettingsClick,
    onOpenProblem,
    onViewProblem,
    style,
    code,
    onShowTerminal,
    onFocusTerminal,
    onRefresh,
    onCollapse
}) {
    const [isCreating, setIsCreating] = useState(null); // 'file', 'folder', or null
    const [newName, setNewName] = useState('');

    if (activePanel === 'codeforces') {
        return (
            <div className="flex flex-col h-full overflow-hidden" style={style}>
                <div className="flex items-center justify-between p-2 border-b border-[var(--border-color)]">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Codeforces</span>
                    <button onClick={onCollapse} className="p-1 hover:bg-white/10 rounded">
                        <X size={14} className="opacity-70 hover:opacity-100" />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden" style={{ height: '45%' }}>
                    <CodeforcesExplorer onOpenSettings={onCfSettingsClick} onOpenProblem={onOpenProblem} />
                </div>
                <div className="flex-1 overflow-hidden border-t border-[var(--border-color)]" style={{ height: '55%' }}>
                    <CodeforcesProblemFilter onOpenProblemFile={onViewProblem} />
                </div>
            </div>
        );
    }
    if (activePanel === 'run') {
        return (
            <div style={style} className="flex flex-col h-full bg-[var(--bg-sidebar)]">
                <div className="flex items-center justify-between p-2 border-b border-[var(--border-color)]">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Run Code</span>
                    <button onClick={onCollapse} className="p-1 hover:bg-white/10 rounded text-[var(--text-secondary)]">
                        <X size={14} className="opacity-70 hover:opacity-100" />
                    </button>
                </div>
                <CodeRunner activeFile={activeFile} code={code} onShowTerminal={onShowTerminal} onFocusTerminal={onFocusTerminal} onRefresh={onRefresh} />
            </div>
        );
    }
    if (activePanel === 'test-generator') {
        return (
            <div style={style} className="flex flex-col h-full bg-[var(--bg-sidebar)]">
                <div className="flex items-center justify-between p-2 border-b border-[var(--border-color)]">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Test Generator</span>
                    <button onClick={onCollapse} className="p-1 hover:bg-white/10 rounded text-[var(--text-secondary)]">
                        <X size={14} className="opacity-70 hover:opacity-100" />
                    </button>
                </div>
                <TestCaseGenerator activeFile={activeFile} code={code} onRefresh={onRefresh} />
            </div>
        );
    }
    if (activePanel === 'search') {
        return (
            <div style={style} className="flex flex-col h-full bg-[var(--bg-sidebar)]">
                <div className="flex items-center justify-between p-2 border-b border-[var(--border-color)]">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Search</span>
                    <button onClick={onCollapse} className="p-1 hover:bg-white/10 rounded text-[var(--text-secondary)]">
                        <X size={14} className="opacity-70 hover:opacity-100" />
                    </button>
                </div>
                <SearchPanel folderPath={folderPath} onFileClick={onFileClick} />
            </div>
        );
    }

    return (
        <div id="sidebar" style={style}>
            <div className="sidebar-header flex justify-between items-center pr-2">
                <span className="sidebar-title">EXPLORER</span>
                {folderPath && (
                    <div className="flex space-x-1">
                        <button onClick={onRefresh} title="Refresh" className="p-1 hover:bg-white/10 rounded">
                            <RefreshCw size={14} className="opacity-70 hover:opacity-100" />
                        </button>
                        <button onClick={() => setIsCreating('file')} title="New File" className="p-1 hover:bg-white/10 rounded">
                            <FilePlus size={14} className="opacity-70 hover:opacity-100" />
                        </button>
                        <button onClick={() => setIsCreating('folder')} title="New Folder" className="p-1 hover:bg-white/10 rounded">
                            <FolderPlus size={14} className="opacity-70 hover:opacity-100" />
                        </button>
                        <button onClick={onCollapse} title="Collapse" className="p-1 hover:bg-white/10 rounded ml-1">
                            <X size={14} className="opacity-70 hover:opacity-100" />
                        </button>
                    </div>
                )}
            </div>
            {folderPath ? (
                <>
                    <div id="file-tree">
                        {isCreating && (
                            <div className='tree-item' style={{ paddingLeft: '28px' }}>
                                <span className='file-icon' dangerouslySetInnerHTML={{ __html: isCreating === 'file' ? getFileIcon(newName).icon : getFolderIcon(false) }} />
                                <input
                                    autoFocus
                                    className='inline-rename-input'
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && newName.trim()) {
                                            const fullPath = folderPath + '/' + newName.trim();
                                            if (isCreating === 'file') {
                                                await window.electronAPI.createFile(fullPath);
                                                onFileClick(fullPath, newName.trim());
                                            } else {
                                                await window.electronAPI.createFolder(fullPath);
                                            }
                                            setIsCreating(null);
                                            setNewName('');
                                            if (onRefresh) onRefresh()
                                        }
                                        if (e.key === 'Escape') {
                                            setIsCreating(null);
                                            setNewName('');
                                        }
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => {
                                            setIsCreating(null);
                                            setNewName('');
                                        }, 150);
                                    }} />
                            </div>
                        )}
                        {entries.map((entry) => (
                            <TreeItem
                                key={entry.path}
                                entry={entry}
                                depth={0}
                                onFileClick={onFileClick}
                                activeFile={activeFile}
                            />
                        ))}
                    </div>
                </>
            ) : (
                <div id="open-folder-prompt">
                    <p>No folder opened</p>
                    <button className="btn-primary" onClick={onOpenFolder}>
                        Open Folder
                    </button>
                </div>
            )}
        </div>
    );
}
