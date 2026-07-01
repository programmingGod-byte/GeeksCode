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
import ProblemViewer from './components/ProblemViewer';
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
    const [inputModal, setInputModal] = useState({ isOpen: false, title: '', placeholder: '', onSubmit: () => { } });
    const [viewingProblem, setViewingProblem] = useState(null);
    const [activeModelId, setActiveModelId] = useState('deepseek');
    const [isInitialized, setIsInitialized] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(true);

    const [ragProgress, setRagProgress] = useState(null);
    const [isAICompleting, setIsAICompleting] = useState(false);
    const editorRef = useRef(null);
    const terminalRef = useRef(null);

    useEffect(() => {
        const syncModel = async () => {
            if (window.electronAPI && window.electronAPI.getActiveModel) {
                const modelId = await window.electronAPI.getActiveModel();
                setActiveModelId(modelId);
            }
        };
        syncModel();
    }, []);

    const handleModelChange = useCallback(async (modelId) => {
        if (window.electronAPI && window.electronAPI.setModel) {
            const ok = await window.electronAPI.setModel(modelId);
            if (ok) {
                setActiveModelId(modelId);
                console.log(`Model switched to: ${modelId}`);
            }
        }
    }, []);

    const handleIndexProject = useCallback(async (path) => {
        if (!path) return;
        try {
            const files = await window.electronAPI.indexProject(path);
            setProjectFiles(files);
        } catch (err) {
            console.error("Indexing failed:", err);
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI && window.electronAPI.onRagProgress) {
            window.electronAPI.onRagProgress((data) => {
                setRagProgress(data);
                if (data.current + 1 >= data.total) {
                    setTimeout(() => setRagProgress(null), 3000);
                }
            });
        }
    }, []);

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
                    } else {
                        // If no folder path, we still need to mark as initialized
                    }
                    if (state.openTabs) setOpenTabs(state.openTabs);
                    if (state.activeTab) setActiveTab(state.activeTab);
                }
                setIsInitialized(true);
            } else {
                // If electronAPI is missing (browser mode), mark as initialized
                setIsInitialized(true);
            }
        };
        initPersistence();
    }, [handleIndexProject]);

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

    useEffect(() => {
        const isDark = theme.includes('dark');
        document.body.classList.toggle('light', !isDark);
    }, [theme]);

    const handleToggleTheme = useCallback(() => {
        setTheme(prev => prev === 'vs-dark' ? 'vs' : 'vs-dark');
    }, []);

    useEffect(() => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        if (!isMac) {
            document.documentElement.style.setProperty('--titlebar-height', '0px');
        }
    }, []);

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

    useEffect(() => {
        const handleCloseActiveTab = () => {
            setOpenTabs((prev) => {
                let nextActiveTab = null;
                const activeTabRef = activeTab; // Capture current active tab

                if (activeTabRef) {
                    const idx = prev.findIndex((t) => t.filePath === activeTabRef);
                    const newTabs = prev.filter((t) => t.filePath !== activeTabRef);

                    if (newTabs.length > 0) {
                        const newIdx = Math.min(idx, newTabs.length - 1);
                        nextActiveTab = newTabs[newIdx].filePath;
                    }
                }

                // Update active tab state
                setActiveTab(nextActiveTab);

                // Return updated tabs list
                return prev.filter((t) => t.filePath !== activeTabRef);
            });
        };

        const removeListener = window.electronAPI.onCloseTab(handleCloseActiveTab);
        return () => {
            if (typeof removeListener === 'function') removeListener();
        };
    }, [activeTab]);

    useEffect(() => {
        const unmountExit = window.electronAPI.onTerminalExit(() => {
            setPanelVisible(false);
        });
        return () => {
            if (unmountExit) unmountExit();
        };
    }, []);

    useEffect(() => {
        if (window.electronAPI && window.electronAPI.codeforces) {
            window.electronAPI.codeforces.onOpenSettings(() => {
                setShowCfSettings(true);
            });
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.code === 'Backquote')) {
                e.preventDefault();
                setPanelVisible((v) => !v);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
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
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                setShowQuickOpen(true);
            }
            // Toggle Sidebar
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                setSidebarVisible(v => !v);
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [activeTab, openTabs]);

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

        window.electronAPI.setTerminalCwd(path);
    }, [handleIndexProject]);

    useEffect(() => {
        const unmountOpen = window.electronAPI.onOpenFolder(() => {
            handleOpenFolder();
        });
        const unmountClose = window.electronAPI.onCloseFolder(() => {
            setFolderPath(null);
            setFolderName('');
            setFileEntries([]);
            setOpenTabs([]);
            setActiveTab(null);
            setProjectFiles([]);
        });
        return () => {
            unmountOpen();
            unmountClose();
        };
    }, [handleOpenFolder]);

    const handleFileClick = useCallback(async (filePath, fileName) => {
        console.log("File clicked:", filePath, fileName);
        if (!fileName) {
            fileName = filePath.split('/').pop() || filePath.split('\\').pop();
        }
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
        setViewingProblem(null);
    }, [openTabs]);

    const handleViewProblem = useCallback(async (filePath) => {
        try {
            const content = await window.electronAPI.readFile(filePath);
            if (content) {
                const problemData = JSON.parse(content);
                problemData.path = filePath;
                setViewingProblem(problemData);
                setActiveTab(null);
            }
        } catch (e) {
            console.error("Failed to parse problem JSON:", e);
            handleFileClick(filePath);
        }
    }, [handleFileClick]);

    const handleAnalyzeComplexity = useCallback(async () => {
        if (!activeTab) return;
        const tab = openTabs.find(t => t.filePath === activeTab);
        if (!tab) return;

        let content = tab.content;
        if (editorRef.current) {
            content = editorRef.current.getValue();
        }

        const newId = 'complexity-session';
        const newSession = {
            id: newId,
            name: `Big O: ${tab.fileName}`,
            messages: [{ role: 'ai', content: `Analyzing performance for **${tab.fileName}**...` }]
        };

        setChatSessions(prev => {
            const existing = prev.find(s => s.id === newId);
            if (existing) {
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

    const handleCreateItem = useCallback(async (name, isFolder) => {
        if (!folderPath) return;
        const fullPath = `${folderPath}/${name}`;
        let ok = false;

        if (isFolder) {
            ok = await window.electronAPI.createFolder(fullPath);
        } else {
            ok = await window.electronAPI.createFile(fullPath);
        }

        if (ok) {
            const entries = await window.electronAPI.readDir(folderPath);
            setFileEntries(entries);
            handleIndexProject(folderPath);
            if (!isFolder) {
                handleFileClick(fullPath, name);
            }
        } else {
            console.error(`Failed to create ${isFolder ? 'folder' : 'file'}`);
        }
    }, [folderPath, handleIndexProject, handleFileClick]);


    useEffect(() => {
        if (folderPath) {
            handleIndexProject(folderPath);
        }
    }, [folderPath, handleIndexProject]);

    const handleSwitchTab = useCallback((filePath) => {
        setActiveTab(filePath);
    }, []);

    const handleCloseTab = useCallback((filePath) => {
        setOpenTabs((prev) => {
            const idx = prev.findIndex((t) => t.filePath === filePath);
            if (idx === -1) return prev;
            const newTabs = prev.filter((t) => t.filePath !== filePath);
            const tab = prev.filter((t) => t.filePath === filePath);
            if (tab[0].isDirty) {
                return prev;
            }
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

        if (isAICompleting) return;

        const inlinePattern = /~\("(.*?)"\);/;
        const match = value.match(inlinePattern);

        if (match && editorRef.current) {
            const prompt = match[1];
            const fullMatch = match[0];

            setIsAICompleting(true);

            let triggerLine = 1;
            if (editorRef.current) {
                const model = editorRef.current.getModel();
                const matchIndex = value.indexOf(fullMatch);
                if (matchIndex !== -1) {
                    triggerLine = model.getPositionAt(matchIndex).lineNumber;
                }
            }

            console.log(`AI: Inline completion triggered for: ${prompt} at line ${triggerLine}`);

            setTimeout(async () => {
                try {
                    const result = await window.electronAPI.inlinePrompt(value, prompt, triggerLine);

                    if (editorRef.current) {
                        const model = editorRef.current.getModel();
                        const currentText = model.getValue();
                        const latestMatch = currentText.match(inlinePattern);

                        if (latestMatch) {
                            const matchText = latestMatch[0];
                            const matchIndex = currentText.indexOf(matchText);

                            if (matchIndex !== -1) {
                                const startPos = model.getPositionAt(matchIndex);
                                const endPos = model.getPositionAt(matchIndex + matchText.length);

                                const range = new window.monaco.Range(
                                    startPos.lineNumber,
                                    startPos.column,
                                    endPos.lineNumber,
                                    endPos.column
                                );

                                editorRef.current.executeEdits('ai-inline-completion', [
                                    { range, text: result, forceMoveMarkers: true }
                                ]);

                                console.log(`AI: Inline completion successful. Replaced: "${matchText}" with content.`);
                            } else {
                                console.warn("AI: Could not find match index in current text.");
                            }
                        } else {
                            console.warn("AI: Could not find pattern match in current text.");
                        }
                    }
                } catch (err) {
                    console.error("AI Inline completion failed:", err);
                } finally {
                    setIsAICompleting(false);
                }
            }, 100);
        }
    }, [isAICompleting]);

    const handleSave = useCallback(async () => {
        if (!activeTab) return;
        const tab = openTabs.find((t) => t.filePath === activeTab);
        if (!tab) return;

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

    const handleCursorChange = useCallback((line, col) => {
        setCursorPos({ line, col });
    }, []);

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

    const currentTab = openTabs.find((t) => t.filePath === activeTab);
    const languageLabel = currentTab ? getLanguageLabel(currentTab.language) : 'Plain Text';
    const positionText = `Ln ${cursorPos.line}, Col ${cursorPos.col}`;

    const refreshFileExplorer = useCallback(async () => {
        if (!folderPath) return;
        const entries = await window.electronAPI.readDir(folderPath);
        setFileEntries(entries);
        handleIndexProject(folderPath);
    }, [folderPath, handleIndexProject]);

    return (
        <>
            <TitleBar folderName={folderName || null} />
            <div id="main-container">
                <ActivityBar
                    activePanel={activePanel}
                    onPanelChange={(panel) => {
                        if (activePanel === panel) {
                            setSidebarVisible(!sidebarVisible);
                        } else {
                            setActivePanel(panel);
                            setSidebarVisible(true);
                        }
                    }}
                    isDark={theme === 'vs-dark'}
                    onToggleTheme={handleToggleTheme}
                />
                {sidebarVisible && (
                    <>
                        <Sidebar
                            folderName={folderName}
                            folderPath={folderPath}
                            entries={fileEntries}
                            onOpenFolder={handleOpenFolder}
                            onFileClick={handleFileClick}
                            onCreateItem={handleCreateItem}
                            activeFile={activeTab}
                            activePanel={activePanel}
                            code={currentTab}
                            onShowTerminal={() => setPanelVisible(true)}
                            onFocusTerminal={() => terminalRef.current?.focus()}
                            onCfSettingsClick={() => setShowCfSettings(true)}
                            onOpenProblem={(url) => {
                                setBrowserUrl(url);
                                setShowBrowser(true);
                            }}
                            onViewProblem={handleViewProblem}
                            style={{ width: `${sidebarWidth}px` }}
                            theme={theme}
                            onRefresh={refreshFileExplorer}
                            onCollapse={() => setSidebarVisible(false)}
                        />
                        <div id="sidebar-resize" onMouseDown={handleSidebarMouseDown}></div>
                    </>
                )}
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
                            onRefresh={refreshFileExplorer}
                        />
                        <div className="flex-1 flex overflow-hidden">
                            <div className={`flex-1 flex flex-col min-w-0 ${showBrowser ? 'border-r border-[#2b2b2b]' : ''}`}>
                                {viewingProblem ? (
                                    <ProblemViewer
                                        problem={viewingProblem}
                                        onClose={() => setViewingProblem(null)}
                                    />
                                ) : activeTab ? (
                                    <MonacoEditor
                                        activeTab={activeTab}
                                        tabs={openTabs}
                                        theme={theme}
                                        onCursorChange={handleCursorChange}
                                        onContentChange={handleContentChange}
                                        onSave={handleSave}
                                        editorRef={editorRef}
                                        isAICompleting={isAICompleting}
                                    />
                                ) : !isInitialized ? (
                                    <div className="flex-1 flex flex-col items-center justify-center opacity-10 select-none animate-pulse">
                                        <div className="p-8 flex flex-col items-center">
                                            <Globe size={64} className="mb-4 text-white/40" />
                                            <p className="text-xl font-medium text-white/60">Initializing Workspace...</p>
                                        </div>
                                    </div>
                                ) : folderPath ? null : (
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
                ragProgress={ragProgress}
                activeModelId={activeModelId}
                onModelChange={handleModelChange}
                onOpenModelSettings={() => setShowModelModal(true)}
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
