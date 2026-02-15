const path = require('path');
const fs = require('fs');

class TestCaseModel {
    constructor() {
        this.llama = null;
        this.model = null;
        this.context = null;
        this.modelPath = null;
        this.LlamaChatSession = null;
    }

    async init(modelPath) {
        if (this.model) return;
        this.modelPath = modelPath;

        if (!fs.existsSync(modelPath)) {
            console.error("TestCaseModel: Model file not found at", modelPath);
            return;
        }

        try {
            const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
            this.LlamaChatSession = LlamaChatSession;

            this.llama = await getLlama({ gpu: false });

            this.model = await this.llama.loadModel({
                modelPath: this.modelPath,
            });

            this.context = await this.model.createContext({
                contextSize: 2048,
            });
        } catch (error) {
            console.error("TestCaseModel: Failed to initialize:", error);
            this.model = null;
            this.context = null;
        }
    }

    async generate(cppCode, count = 5) {
        if (!this.context || !this.LlamaChatSession) {
            console.error("TestCaseModel: Not initialized");
            return [];
        }

        try {
            const sequence = this.context.getSequence();
            const session = new this.LlamaChatSession({
                contextSequence: sequence,
                systemPrompt: "You generate test inputs for C++ programs. You MUST use the exact format: [BEGIN] on its own line, then the raw input, then [END] on its own line. Never add explanations.",
            });

            const prompt = `Read this C++ code and generate exactly ${count} test inputs.

                    STRICT FORMAT — follow this exactly for EVERY test case:
                    [INPUT]
                    <raw input values here>

                    Rules:
                    - Analyze cin/scanf to determine the input format
                    - Output ONLY [BEGIN]...[END] blocks, nothing else
                    - Include edge cases (small/large/boundary values)
                    - No labels, no explanations, no expected output

                    Code:
                    ${cppCode}`;

            const response = await session.prompt(prompt);

            if (!sequence.disposed) {
                sequence.dispose();
            }

            // Parse [BEGIN]...[END] blocks
            const tests = [];
            const regex = /\[BEGIN\]\s*\n([\s\S]*?)\n?\s*\[END\]/g;
            let match;
            while ((match = regex.exec(response)) !== null) {
                const tc = match[1].trim();
                if (tc.length > 0) tests.push(tc);
            }

            return tests.slice(0, count);
        } catch (error) {
            console.error("TestCaseModel: Generation failed:", error);
            return [];
        }
    }
}

module.exports = new TestCaseModel();
