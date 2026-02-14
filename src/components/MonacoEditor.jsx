import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure monaco-editor to use local node_modules
loader.config({ monaco });

export default function MonacoEditor({
    activeTab,
    tabs,
    theme,
    onCursorChange,
    onContentChange,
    onSave,
    editorRef,
}) {
    const monacoRef = useRef(null);

    const handleEditorDidMount = useCallback((editor, mon) => {
        monacoRef.current = mon;
        editorRef.current = editor;

        // Define dark theme
        mon.editor.defineTheme('vs-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#1e1e1e',
                'editor.foreground': '#d4d4d4',
            },
        });

        // Define Monokai theme
        mon.editor.defineTheme('monokai-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '75715e' },
                { token: 'keyword', foreground: 'f92672' },
                { token: 'string', foreground: 'e6db74' },
                { token: 'number', foreground: 'ae81ff' },
                { token: 'type', foreground: '66d9ef' },
            ],
            colors: {
                'editor.background': '#272822',
                'editor.foreground': '#f8f8f2',
                'editorCursor.foreground': '#f8f8f0',
                'editor.lineHighlightBackground': '#3e3d32',
                'editor.selectionBackground': '#49483e',
                'editorSuggestWidget.background': '#272822',
                'editorSuggestWidget.border': '#75715e',
            },
        });

        mon.editor.setTheme(theme);

        // Cursor position tracking
        editor.onDidChangeCursorPosition((e) => {
            onCursorChange(e.position.lineNumber, e.position.column);
        });

        // Inline completions (AI Autocomplete)
        mon.languages.registerInlineCompletionsProvider({
            provideInlineCompletions: async (model, position) => {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                });

                if (textUntilPosition.trim().length < 5) return { items: [] };

                // Get some context after position too
                const textAfterPosition = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber + 5,
                    endColumn: 1,
                });

                const completion = await window.electronAPI.completeAI(`${textUntilPosition}<CURSOR>${textAfterPosition}`);
                
                if (!completion) return { items: [] };

                return {
                    items: [{
                        insertText: completion,
                        range: {
                            startLineNumber: position.lineNumber,
                            startColumn: position.column,
                            endLineNumber: position.lineNumber,
                            endColumn: position.column,
                        }
                    }]
                };
            }
        });

        // Ctrl/Cmd + S to save
        editor.addCommand(mon.KeyMod.CtrlCmd | mon.KeyCode.KeyS, () => {
            onSave();
        });
    }, [onCursorChange, onSave, editorRef]);

    // Sync theme when it changes
    useEffect(() => {
        if (monacoRef.current) {
            monacoRef.current.editor.setTheme(theme);
        }
    }, [theme]);

    // Find active tab
    const currentTab = tabs.find((t) => t.filePath === activeTab);

    if (!currentTab) return null;

    return (
        <div id="monaco-container" style={{ display: 'block' }}>
            <Editor
                key={currentTab.filePath}
                defaultValue={currentTab.content}
                language={currentTab.language}
                theme={theme}
                onMount={handleEditorDidMount}
                onChange={(value) => onContentChange(currentTab.filePath, value)}
                options={{
                    automaticLayout: true,
                    fontSize: 14,
                    fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    renderWhitespace: 'selection',
                    lineNumbers: 'on',
                    glyphMargin: false,
                    folding: true,
                    lineDecorationsWidth: 10,
                    lineNumbersMinChars: 3,
                    bracketPairColorization: { enabled: true },
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    padding: { top: 8 },
                    wordWrap: 'off',
                    tabSize: 2,
                    insertSpaces: true,
                    renderLineHighlight: 'all',
                    matchBrackets: 'always',
                    suggest: { showWords: true },
                    inlineSuggest: { enabled: true }, // Enable inline suggestions
                }}
            />
        </div>
    );
}
