import React, { useState, useEffect, useCallback, useRef } from 'react';
import TitleBar from './components/TitleBar';
import ActivityBar from './components/ActivityBar';
import Sidebar from './components/Sidebar';
import TabsBar from './components/TabsBar';
import WelcomeView from './components/WelcomeView';
import MonacoEditor from './components/MonacoEditor';
import TerminalPanel from './components/TerminalPanel';
import StatusBar from './components/StatusBar';
import AIChat from './components/AIChat';
import ModelDownloadModal from './components/ModelDownloadModal';
import QuickOpenModal from './components/QuickOpenModal';
import CodeforcesSettingsModal from './components/CodeforcesSettingsModal';
import BrowserLayout from './components/BrowserLayout';
import InputModal from './components/InputModal';
import { FilePlus, FolderPlus, Globe } from 'lucide-react';
import { getLanguage, getLanguageLabel } from './utils/fileUtils';

export default function App() {
    // ─── State ──────────────────────────────────────────
    const [theme, setTheme] = useState('vs-dark'); 
    const [activePanel, setActivePanel] = useState('explorer');
    const [folderPath, setFolderPath] = useState(null);
    const [folderName, setFolderName] = useState('');
    const [fileEntries, setFileEntries] = useState([]);
    const [openTabs, setOpenTabs] = useState([]);
    const [activeTab, setActiveTab] = useState(null);
    const [panelVisible, setPanelVisible] = useState(false);
    const [panelHeight, setPanelHeight] = useState(250);
    const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [aiChatWidth, setAiChatWidth] = useState(300);
    const [showModelModal, setShowModelModal] = useState(false);
    const [chatSessions, setChatSessions] = useState([
        { id: 'default', name: 'Chat 1', messages: [{ role: 'ai', content: "Hello! I'm GeeksAI. I can help you code." }] }
    ]);
    const [activeSessionId, setActiveSessionId] = useState('default');
    const [zoomLevel, setZoomLevel] = useState(0);
    const [projectFiles, setProjectFiles] = useState([]);
    const [showQuickOpen, setShowQuickOpen] = useState(false);
    const [showCfSettings, setShowCfSettings] = useState(false);
    const [showBrowser, setShowBrowser] = useState(false);
    const [browserUrl, setBrowserUrl] = useState('https://codeforces.com');
    const [inputModal, setInputModal] = useState({ isOpen: false, title: '', placeholder: '', onSubmit: () => {} });

    const editorRef = useRef(null);
    const terminalRef = useRef(null);

    const handleIndexProject = useCallback(async (path) => {
        if (!path) return;
        try {
            const files = await window.electronAPI.indexProject(path);
            setProjectFiles(files);
        } catch (err) {
            console.error("Indexing failed:", err);
        }
    }, []);

    // ─── Persistence: Load ──────────────────────────────
    useEffect(() => {
        const initPersistence = async () => {
            if (window.electronAPI && window.electronAPI.getState) {
                const state = await window.electronAPI.getState();
                if (state) {
                    if (state.folderPath) {
                        setFolderPath(state.folderPath);
                        setFolderName(state.folderName || state.folderPath.split('/').pop());
                        try {
                            const entries = await window.electronAPI.readDir(state.folderPath);
                            setFileEntries(entries);
                            handleIndexProject(state.folderPath);
                            window.electronAPI.setTerminalCwd(state.folderPath);
                        } catch (e) {
                            console.error("Failed to restore folder:", e);
                        }
                    }
                    if (state.openTabs) setOpenTabs(state.openTabs);
                    if (state.activeTab) setActiveTab(state.activeTab);
                }
            }
        };
        initPersistence();
    }, [handleIndexProject]);

    // ─── Persistence: Save ──────────────────────────────
    useEffect(() => {
        const saveTimeout = setTimeout(() => {
            if (window.electronAPI && window.electronAPI.saveState) {
                window.electronAPI.saveState({
                    folderPath,
                    folderName,
                    openTabs,
                    activeTab
                });
            }
        }, 500);
        return () => clearTimeout(saveTimeout);
    }, [folderPath, folderName, openTabs, activeTab]);

    // ─── AI Model Check ─────────────────────────────────
    useEffect(() => {
        const checkModel = async () => {
            if (window.electronAPI && window.electronAPI.checkModel) {
                const exists = await window.electronAPI.checkModel();
                if (!exists) {
                    setShowModelModal(true);
                }
            }
        };
        checkModel();
    }, []);

    // ─── Theme ──────────────────────────────────────────
    useEffect(() => {
        const isDark = theme.includes('dark');
        document.body.classList.toggle('light', !isDark);
    }, [theme]);

    // ─── Titlebar height (macOS vs windows) ──────────────
    useEffect(() => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        if (!isMac) {
            document.documentElement.style.setProperty('--titlebar-height', '0px');
        }
    }, []);


    // ─── Zoom ──────────────────────────────────────────
    const handleZoomIn = useCallback(async () => {
        const newLevel = Math.min(zoomLevel + 0.5, 3);
        setZoomLevel(newLevel);
        await window.electronAPI.setZoom(newLevel);
    }, [zoomLevel]);

    const handleZoomOut = useCallback(async () => {
        const newLevel = Math.max(zoomLevel - 0.5, -2);
        setZoomLevel(newLevel);
        await window.electronAPI.setZoom(newLevel);
    }, [zoomLevel]);

    const handleResetZoom = useCallback(async () => {
        setZoomLevel(0);
        await window.electronAPI.setZoom(0);
    }, []);

    // ─── IPC: Close Tab from Main Process (Cmd+W) ──────
    useEffect(() => {
        window.electronAPI.onCloseTab(() => {
            setOpenTabs((prev) => {
                setActiveTab((currentActive) => {
                    if (!currentActive) return null;
                    const idx = prev.findIndex((t) => t.filePath === currentActive);
                    if (idx === -1) return currentActive;
                    const newTabs = prev.filter((t) => t.filePath !== currentActive);
                    if (newTabs.length > 0) {
                        const newIdx = Math.min(idx, newTabs.length - 1);
                        return newTabs[newIdx].filePath;
                    }
                    return null;
                });
                return prev.filter((t) => t.filePath !== activeTab);
            });
        });
    }, [activeTab]);

    // ─── Codeforces Settings Trigger from Main ──────────
    useEffect(() => {
        if (window.electronAPI && window.electronAPI.codeforces) {
            window.electronAPI.codeforces.onOpenSettings(() => {
                setShowCfSettings(true);
            });
        }
    }, []);

    // ─── Keyboard Shortcuts ─────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl/Cmd + ` → toggle terminal
            if ((e.ctrlKey || e.metaKey) && e.key === '`') {
                e.preventDefault();
                setPanelVisible((v) => !v);
            }
            // Ctrl/Cmd + S → save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
            // Zoom shortcuts
            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                handleZoomIn();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                handleZoomOut();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                handleResetZoom();
            }
            // Quick Open shortcut
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                setShowQuickOpen(true);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, openTabs]);

    // ─── Open Folder ────────────────────────────────────
    const handleOpenFolder = useCallback(async () => {
        const path = await window.electronAPI.openFolder();
        if (!path) return;

        setFolderPath(path);
        const name = path.split('/').pop() || path.split('\\').pop();
        setFolderName(name);

        const entries = await window.electronAPI.readDir(path);
        setFileEntries(entries);
        setOpenTabs([]);
        setActiveTab(null);
        handleIndexProject(path);

        // Update terminal CWD
        window.electronAPI.setTerminalCwd(path);
    }, [handleIndexProject]);

    // ─── Open File ──────────────────────────────────────
    const handleFileClick = useCallback(async (filePath, fileName) => {
        console.log("File clicked:", filePath, fileName);
        if (!fileName) {
            fileName = filePath.split('/').pop() || filePath.split('\\').pop();
        }
        // Already open?
        const existing = openTabs.find((t) => t.filePath === filePath);
        if (existing) {
            console.log("File already open, switching tab.");
            setActiveTab(filePath);
            return;
        }

        console.log("Reading file content...");
        const content = await window.electronAPI.readFile(filePath);
        if (content === null) {
            console.error("Failed to read file content");
            return;
        }
        console.log("File content read successfully (length):", content.length);

        const language = getLanguage(filePath);
        const newTab = { filePath, fileName, content, language, isDirty: false };
        setOpenTabs((prev) => [...prev, newTab]);
        setActiveTab(filePath);
    }, [openTabs]);

    // ─── Complexity Analysis ────────────────────────────
    const handleAnalyzeComplexity = useCallback(async () => {
        if (!activeTab) return;
        const tab = openTabs.find(t => t.filePath === activeTab);
        if (!tab) return;
        
        let content = tab.content;
        if (editorRef.current) {
            content = editorRef.current.getValue();
        }

        const newId = 'complexity-session'; // Reuse session to avoid crash on create/destroy
        const newSession = {
            id: newId,
            name: `Big O: ${tab.fileName}`,
            messages: [{ role: 'ai', content: `🧠 Analyzing performance for **${tab.fileName}**...` }]
        };
        
        setChatSessions(prev => {
            const existing = prev.find(s => s.id === newId);
            if (existing) {
                // Reuse session, just append user request (or clear and start new)
                return prev.map(s => s.id === newId ? newSession : s);
            }
            return [...prev, newSession];
        });
        setActiveSessionId(newId);
        
        setTimeout(async () => {
            const prompt = `Analyze the Time and Space complexity for the provided code. 
Be extremely concise. 
1. Start with the **Time Complexity: O(...)** and **Space Complexity: O(...)** in bold on the first line.
2. Provide a short list of potential optimizations or improvements.
3. Keep the total response very short (max 7 lines).

File: ${tab.fileName}

\`\`\`${tab.language}
${content}
\`\`\``;
            if (window.electronAPI) {
                try {
                    // Initialize the AI session first (safe mode requires this)
                    await window.electronAPI.initAI(newId);
                    
                    const response = await window.electronAPI.askAI(prompt, newId);
                    setChatSessions(prev => prev.map(s => 
                        s.id === newId 
                            ? { ...s, messages: [...s.messages, { role: 'ai', content: response }] }
                            : s
                    ));
                } catch (e) {
                    console.error("Analysis failed", e);
                    setChatSessions(prev => prev.map(s => 
                        s.id === newId 
                            ? { ...s, messages: [...s.messages, { role: 'ai', content: "Error: AI not initialized or busy." }] }
                            : s
                    ));
                }
            }
        }, 500);
    }, [activeTab, openTabs]);

    // ─── File Management ────────────────────────────────
    const handleCreateFile = useCallback(() => {
        if (!folderPath) return;
        setInputModal({
            isOpen: true,
            title: 'New File',
            placeholder: 'FileName.ext',
            onSubmit: async (fileName) => {
                const fullPath = `${folderPath}/${fileName}`;
                const ok = await window.electronAPI.createFile(fullPath);
                if (ok) {
                    const entries = await window.electronAPI.readDir(folderPath);
                    setFileEntries(entries);
                    handleIndexProject(folderPath);
                    handleFileClick(fullPath, fileName);
                } else {
                    console.error("Failed to create file");
                }
            }
        });
    }, [folderPath, handleIndexProject, handleFileClick]);

    const handleCreateFolder = useCallback(() => {
        if (!folderPath) return;
        setInputModal({
            isOpen: true,
            title: 'New Folder',
            placeholder: 'FolderName',
            onSubmit: async (folderName) => {
                const fullPath = `${folderPath}/${folderName}`;
                const ok = await window.electronAPI.createFolder(fullPath);
                if (ok) {
                    const entries = await window.electronAPI.readDir(folderPath);
                    setFileEntries(entries);
                    handleIndexProject(folderPath);
                } else {
                     console.error("Failed to create folder");
                }
            }
        });
    }, [folderPath, handleIndexProject]);

    // ─── Switch Tab ─────────────────────────────────────
    const handleSwitchTab = useCallback((filePath) => {
        setActiveTab(filePath);
    }, []);

    // ─── Close Tab ──────────────────────────────────────
    const handleCloseTab = useCallback((filePath) => {
        setOpenTabs((prev) => {
            const idx = prev.findIndex((t) => t.filePath === filePath);
            if (idx === -1) return prev;
            const newTabs = prev.filter((t) => t.filePath !== filePath);

            // If closing the active tab, switch to neighbor
            if (filePath === activeTab) {
                if (newTabs.length > 0) {
                    const newIdx = Math.min(idx, newTabs.length - 1);
                    setActiveTab(newTabs[newIdx].filePath);
                } else {
                    setActiveTab(null);
                }
            }
            return newTabs;
        });
    }, [activeTab]);

    // ─── Content Change ─────────────────────────────────
    const handleContentChange = useCallback((filePath, value) => {
        setOpenTabs((prev) =>
            prev.map((t) => {
                if (t.filePath === filePath && !t.isDirty) {
                    return { ...t, isDirty: true, content: value };
                }
                if (t.filePath === filePath) {
                    return { ...t, content: value };
                }
                return t;
            })
        );
    }, []);

    // ─── Save ───────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!activeTab) return;
        const tab = openTabs.find((t) => t.filePath === activeTab);
        if (!tab) return;

        // Get value from editor if available
        let content = tab.content;
        if (editorRef.current) {
            content = editorRef.current.getValue();
        }

        const ok = await window.electronAPI.writeFile(tab.filePath, content);
        if (ok) {
            setOpenTabs((prev) =>
                prev.map((t) => (t.filePath === activeTab ? { ...t, isDirty: false, content } : t))
            );
        }
    }, [activeTab, openTabs]);

    // ─── Cursor Position ───────────────────────────────
    const handleCursorChange = useCallback((line, col) => {
        setCursorPos({ line, col });
    }, []);

    // ─── Sidebar Resize ────────────────────────────────
    const handleSidebarMouseDown = useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebarWidth;

        const handleMouseMove = (moveE) => {
            const activityBarWidth = 48;
            const newWidth = startWidth + (moveE.clientX - startX);
            if (newWidth >= 150 && newWidth <= 600) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
        };

        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [sidebarWidth]);
    
    // ─── AI Chat Resize ───────────────────────────────
    const handleAiChatMouseDown = useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = aiChatWidth;

        const handleMouseMove = (moveE) => {
            const delta = startX - moveE.clientX;
            const newWidth = Math.max(200, Math.min(startWidth + delta, window.innerWidth - 400));
            setAiChatWidth(newWidth);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            const resizer = document.getElementById('aichat-resize');
            if (resizer) resizer.classList.remove('active');
        };

        const resizer = document.getElementById('aichat-resize');
        if (resizer) resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [aiChatWidth]);

    // ─── Derived State ──────────────────────────────────
    const currentTab = openTabs.find((t) => t.filePath === activeTab);
    const languageLabel = currentTab ? getLanguageLabel(currentTab.language) : 'Plain Text';
    const positionText = `Ln ${cursorPos.line}, Col ${cursorPos.col}`;

    return (
        <>
            <TitleBar folderName={folderName || null} />
            <div id="main-container">
                <ActivityBar
                    activePanel={activePanel}
                    onPanelChange={setActivePanel}
                    theme={theme}
                    onThemeChange={setTheme}
                />
                <Sidebar
                    folderName={folderName}
                    folderPath={folderPath}
                    entries={fileEntries}
                    onOpenFolder={handleOpenFolder}
                    onFileClick={handleFileClick}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                    activeFile={activeTab}
                    activePanel={activePanel}
                    onCfSettingsClick={() => setShowCfSettings(true)}
                    onOpenProblem={(url) => {
                        setBrowserUrl(url);
                        setShowBrowser(true);
                    }}
                    style={{ width: `${sidebarWidth}px` }}
                    theme={theme}
                />
                <div id="sidebar-resize" onMouseDown={handleSidebarMouseDown}></div>
                <div id="editor-panel-area">
                    <div id="editor-area">
                        <TabsBar
                            tabs={openTabs}
                            activeTab={activeTab}
                            onSwitchTab={handleSwitchTab}
                            onCloseTab={handleCloseTab}
                            onShowTerminal={() => setPanelVisible(true)}
                            onFocusTerminal={() => terminalRef.current?.focus()}
                            onAnalyzeComplexity={handleAnalyzeComplexity}
                            onOpenBrowser={() => setShowBrowser(true)}
                            code={currentTab}
                        />
                        <div className="flex-1 flex overflow-hidden">
                            <div className={`flex-1 flex flex-col min-w-0 ${showBrowser ? 'border-r border-[#2b2b2b]' : ''}`}>
                                {activeTab ? (
                                    <MonacoEditor
                                        activeTab={activeTab}
                                        tabs={openTabs}
                                        theme={theme}
                                        onCursorChange={handleCursorChange}
                                        onContentChange={handleContentChange}
                                        onSave={handleSave}
                                        editorRef={editorRef}
                                    />
                                ) : (
                                    <WelcomeView onOpenFolder={handleOpenFolder} />
                                )}
                            </div>
                            {showBrowser && (
                                <div className="flex-1 min-w-0 flex flex-col">
                                    <BrowserLayout 
                                        initialUrl={browserUrl} 
                                        onClose={() => setShowBrowser(false)} 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                <TerminalPanel
                    visible={panelVisible}
                    onClose={() => setPanelVisible(false)}
                    panelHeight={panelHeight}
                    onResize={setPanelHeight}
                    theme={theme}
                />
                </div>
                {/* AI Chat Layout with Resizer */}
                <div id="aichat-resize" onMouseDown={handleAiChatMouseDown}></div>
                <div style={{ width: `${aiChatWidth}px`, borderLeft: '1px solid #2b2b2b', background: theme.includes('dark') ? '#1e1e1e' : '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                     <AIChat 
                        sessions={chatSessions}
                        setSessions={setChatSessions}
                        activeSessionId={activeSessionId}
                        setActiveSessionId={setActiveSessionId}
                        theme={theme}
                        projectFiles={projectFiles}
                     />
                </div>
            </div>
            <StatusBar 
                position={cursorPos}
                language={languageLabel}
                encoding="UTF-8"
                theme={theme}
                onThemeChange={setTheme}
                zoomLevel={zoomLevel}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onResetZoom={handleResetZoom}
            />
            <QuickOpenModal 
                isOpen={showQuickOpen}
                onClose={() => setShowQuickOpen(false)}
                files={projectFiles}
                onFileSelect={handleFileClick}
            />
            {showCfSettings && (
                <CodeforcesSettingsModal 
                    isOpen={showCfSettings}
                    onClose={() => setShowCfSettings(false)}
                    onSave={() => {
                        // Optionally refresh explorer if active
                    }}
                />
            )}
            {showModelModal && (
                <ModelDownloadModal 
                    onClose={() => setShowModelModal(false)}
                    onDownloadComplete={() => setShowModelModal(false)}
                />
            )}
            <InputModal 
                isOpen={inputModal.isOpen}
                title={inputModal.title}
                placeholder={inputModal.placeholder}
                onClose={() => setInputModal(prev => ({ ...prev, isOpen: false }))}
                onSubmit={inputModal.onSubmit}
            />
        </>
    );
}
