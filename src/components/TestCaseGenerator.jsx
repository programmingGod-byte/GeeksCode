import React, { useState } from 'react';
import { Zap, Copy, ArrowUpRight, Loader, FlaskConical } from 'lucide-react';

export default function TestCaseGenerator({ activeFile, code }) {
    const [numTests, setNumTests] = useState(5);
    const [generatedTests, setGeneratedTests] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGeneratedTests([]);
        try {
            let cd = code.content;
            const parsed = await window.run.parse(cd);
            const cppCode = parsed.success ? parsed.cppCode : cd;
            const result = await window.run.generateTestCases(cppCode, numTests);

            if (result.success && result.testCases.length > 0) {
                setGeneratedTests(result.testCases);
            } else {
                setGeneratedTests(['No test cases could be generated.']);
            }
        } catch (err) {
            console.error('Generation error:', err);
            setGeneratedTests([`Error: ${err.message}`]);
        }
        setIsGenerating(false);
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-sidebar)] text-[var(--text-primary)] p-4 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="flex items-center space-x-2 border-b border-[var(--border-color)] pb-2">
                <FlaskConical size={16} className="text-amber-400" />
                <span className="text-sm font-bold uppercase tracking-wider">Test Case Generator</span>
            </div>
            {activeFile && (
                <div className="text-[10px] text-[var(--text-secondary)] truncate" title={activeFile}>
                    File: {activeFile.split('/').pop()}
                </div>
            )}

            <div className="space-y-2">
                <label className="text-xs font-semibold text-[#969696] uppercase">Number of Test Cases</label>
                <input
                    type="text"
                    min={0}
                    max={20}
                    value={numTests}
                    onChange={(e) => setNumTests(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] rounded p-2 text-xs font-mono focus:outline-none focus:border-amber-500/50"
                />
            </div>
            <button
                onClick={async () => {
                    await handleGenerate();
                }}
                disabled={isGenerating}
                className={`w-full py-2 rounded flex items-center justify-center space-x-2 font-bold text-xs transition-all ${isGenerating
                    ? 'bg-[#3c3c3c] cursor-not-allowed opacity-50'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg'
                    }`}
            >
                {isGenerating ? (
                    <>
                        <Loader size={14} className="animate-spin" />
                        <span>Generating...</span>
                    </>
                ) : (
                    <>
                        <Zap size={14} />
                        <span>Generate Test Cases</span>
                    </>
                )}
            </button>
            {generatedTests.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#969696] uppercase">
                            Generated ({generatedTests.length})
                        </span>
                        <button
                            onClick={() => handleCopy(generatedTests.join('\n---\n'))}
                            title="Copy All"
                            className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-[#858585] hover:text-white transition-colors text-[10px]"
                        >
                            <Copy size={10} />
                            <span>Copy All</span>
                        </button>
                    </div>
                    <div className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg overflow-hidden">
                        <pre className="text-sm font-mono p-4 overflow-x-auto text-[var(--text-primary)] max-h-[480px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">{
                            generatedTests.map((tc, idx) =>
                                `${tc}`
                            ).join('\n')
                        }</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
