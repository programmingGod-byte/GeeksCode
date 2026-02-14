import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, Terminal, AlertCircle } from 'lucide-react';

export default function CodeRunner({ activeFile, activeFileContent }) {
    const [input, setInput] = useState('');
    const [expectedOutput, setExpectedOutput] = useState('');
    const [actualOutput, setActualOutput] = useState('');
    const [error, setError] = useState('');
    const [status, setStatus] = useState('idle'); // idle, running, success, failed, error
    const [isRunning, setIsRunning] = useState(false);

    const handleRun = async () => {
        if (!activeFile) {
            setError("No file selected.");
            return;
        }
        if (!activeFile.endsWith('.cpp')) {
            setError("Only C++ files are supported for now.");
            return;
        }

        setIsRunning(true);
        setStatus('running');
        setError('');
        setActualOutput('');

        try {
            const dirPath = activeFile.substring(0, activeFile.lastIndexOf('/'));
            const fileName = activeFile.split('/').pop();
            const executable = './a.out_runner'; // Use a distinct name to avoid conflicts

            // 1. Compile
            const compileCmd = `g++ "${fileName}" -o "${executable}"`;
            const compileResult = await window.electronAPI.runCommand(compileCmd, dirPath);

            if (!compileResult.success) {
                setError(compileResult.stderr || "Compilation failed");
                setStatus('error');
                setIsRunning(false);
                return;
            }

            // 2. Run
            // Escape double quotes in input and handle newlines
            // Using a safer way to pass input: write to a temp file then redirect
            const tempInputFile = `input_${Date.now()}.txt`;
            await window.electronAPI.writeFile(`${dirPath}/${tempInputFile}`, input);

            const runCmd = `"${executable}" < "${tempInputFile}"`;
            const runResult = await window.electronAPI.runCommand(runCmd, dirPath);

            // Cleanup temp input
            await window.electronAPI.runCommand(`rm "${tempInputFile}"`, dirPath);
            // Cleanup executable (optional, maybe keep for repeated runs?)
             await window.electronAPI.runCommand(`rm "${executable}"`, dirPath);


            if (runResult.stderr) {
                setError(runResult.stderr);
                // logic: if there is stderr, is it a runtime error? yes mostly.
                // But some programs print to stderr normally. Let's assume error for now if return code != 0, 
                // but runCommand might not return exit code directly in all implementations. 
                // Assuming runCommand returns { success, stdout, stderr }
            }

            const output = runResult.stdout.trim();
            setActualOutput(output);

            if (expectedOutput.trim()) {
                if (output === expectedOutput.trim()) {
                    setStatus('success');
                } else {
                    setStatus('failed');
                }
            } else {
                setStatus('success'); // No expected output to match against, just ran successfully
            }

        } catch (e) {
            setError(e.message || "An unexpected error occurred");
            setStatus('error');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#252526] text-[#cccccc] p-4 space-y-4 overflow-y-auto custom-scrollbar">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-[#3c3c3c] pb-2">
                <div className="flex items-center space-x-2 text-sm font-bold uppercase tracking-wider">
                    <Terminal size={16} className="text-blue-400" />
                    <span>Code Runner</span>
                </div>
                {activeFile && (
                    <span className="text-xs text-[#858585] truncate max-w-[150px]" title={activeFile}>
                        {activeFile.split('/').pop()}
                    </span>
                )}
            </div>

            {/* Input Section */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-[#969696] uppercase">Input</label>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="w-full h-24 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 text-xs font-mono focus:outline-none focus:border-blue-500/50 resize-y"
                    placeholder="Enter program input here..."
                />
            </div>

             {/* Expected Output Section */}
             <div className="space-y-2">
                <label className="text-xs font-semibold text-[#969696] uppercase">Expected Output</label>
                <textarea
                    value={expectedOutput}
                    onChange={(e) => setExpectedOutput(e.target.value)}
                    className="w-full h-24 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 text-xs font-mono focus:outline-none focus:border-blue-500/50 resize-y"
                    placeholder="Enter expected output (optional)..."
                />
            </div>

            {/* Run Button */}
            <button
                onClick={handleRun}
                disabled={isRunning || !activeFile}
                className={`w-full py-2 rounded flex items-center justify-center space-x-2 font-bold text-xs transition-all ${
                    isRunning 
                        ? 'bg-[#3c3c3c] cursor-not-allowed opacity-50' 
                        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg'
                }`}
            >
                {isRunning ? (
                    <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Running...</span>
                    </>
                ) : (
                    <>
                        <Play size={14} />
                        <span>Run Code</span>
                    </>
                )}
            </button>

            {/* Results Section */}
            {(status !== 'idle' || error) && (
                <div className={`rounded-lg border p-3 space-y-2 ${
                    status === 'success' ? 'bg-green-500/10 border-green-500/30' :
                    status === 'failed' ? 'bg-red-500/10 border-red-500/30' :
                    'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                    <div className="flex items-center space-x-2 mb-1">
                        {status === 'success' && <CheckCircle size={16} className="text-green-500" />}
                        {status === 'failed' && <XCircle size={16} className="text-red-500" />}
                        {status === 'error' && <AlertCircle size={16} className="text-yellow-500" />}
                        <span className={`text-xs font-bold uppercase ${
                            status === 'success' ? 'text-green-400' :
                            status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                            {status === 'success' ? 'Passed' :
                             status === 'failed' ? 'Wrong Answer' : 'Execution Error'}
                        </span>
                    </div>

                    {status === 'failed' && (
                         <div className="space-y-1">
                             <span className="text-[10px] text-[#969696] uppercase">Your Output:</span>
                             <pre className="text-xs font-mono bg-[#1e1e1e] p-2 rounded overflow-x-auto text-red-200">
                                 {actualOutput}
                             </pre>
                         </div>
                    )}

                    {status === 'success' && (
                        <div className="space-y-1">
                            <span className="text-[10px] text-[#969696] uppercase">Output:</span>
                             <pre className="text-xs font-mono bg-[#1e1e1e] p-2 rounded overflow-x-auto text-green-200">
                                 {actualOutput}
                             </pre>
                        </div>
                    )}

                    {error && (
                        <div className="space-y-1 pt-1 border-t border-white/10">
                             <span className="text-[10px] text-[#969696] uppercase">Error Log:</span>
                             <pre className="text-xs font-mono bg-[#1e1e1e] p-2 rounded overflow-x-auto text-yellow-200 whitespace-pre-wrap">
                                 {error}
                             </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
