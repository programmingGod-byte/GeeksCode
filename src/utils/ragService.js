/**
 * Lightweight RAG Service (Pure JS)
 * Handles codebase indexing using simple keyword frequency and retrieval.
 */

const fs = require('fs');
const path = require('path');

class RagService {
    constructor() {
        this.index = new Map(); // Map<fileName, { content, tokens }>
    }

    // Simple tokenizer
    tokenize(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2);
    }

    async indexProject(projectFiles) {
        this.index.clear();
        console.log(`RAG: Starting index of ${projectFiles.length} files...`);
        let count = 0;
        
        for (const file of projectFiles) {
            try {
                // Yield to event loop every 10 files to prevent blocking main thread
                if (count % 10 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
                
                const content = fs.readFileSync(file.path, 'utf-8');
                const tokens = new Set(this.tokenize(content));
                this.index.set(file.path, { 
                    name: file.name,
                    path: file.path, 
                    content, 
                    tokens 
                });
                count++;
            } catch (e) {
                console.warn(`RAG: Failed to index ${file.path}`, e);
            }
        }
        console.log(`RAG: Indexed ${this.index.size} files`);
    }

    query(queryText, limit = 3) {
        const queryTokens = this.tokenize(queryText);
        const results = [];

        for (const [filePath, doc] of this.index.entries()) {
            let score = 0;
            for (const token of queryTokens) {
                if (doc.tokens.has(token)) {
                    score += 1;
                }
            }
            if (score > 0) {
                results.push({ ...doc, score });
            }
        }

        // Sort by score and return top results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}

module.exports = new RagService();
