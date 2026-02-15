// ─── Extension → Language Map ───────────────────────
export const EXT_LANG_MAP = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.rb': 'ruby',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.sql': 'sql',
    '.r': 'r',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.lua': 'lua',
    '.dart': 'dart',
    '.vue': 'html',
    '.svelte': 'html',
    '.toml': 'ini',
    '.ini': 'ini',
    '.env': 'ini',
    '.dockerfile': 'dockerfile',
    '.graphql': 'graphql',
    '.proto': 'protobuf',
};

// ─── SVG Icon Builders ─────────────────────────────
// Material Icon Theme style — just colored symbols, no document outline

function textIcon(color, text, fontSize = 10) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
        <text x="8" y="12" fill="${color}" font-family="Menlo,Monaco,monospace" font-size="${fontSize}" font-weight="bold" text-anchor="middle">${text}</text>
    </svg>`;
}

// React atom icon (for JSX/TSX)
function reactIcon(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
        <circle cx="8" cy="8" r="1.5" fill="${color}"/>
        <ellipse cx="8" cy="8" rx="7" ry="2.5" fill="none" stroke="${color}" stroke-width="0.8"/>
        <ellipse cx="8" cy="8" rx="7" ry="2.5" fill="none" stroke="${color}" stroke-width="0.8" transform="rotate(60 8 8)"/>
        <ellipse cx="8" cy="8" rx="7" ry="2.5" fill="none" stroke="${color}" stroke-width="0.8" transform="rotate(-60 8 8)"/>
    </svg>`;
}

// Gear icon (for config files)
function gearIcon(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" fill="none" stroke="${color}" stroke-width="0.8"/>
        <path d="M9.1 2H6.9l-.4 1.5-.9.5L4.2 3.3 2.8 4.7l.7 1.4-.5.9L1.5 7.4v2.2l1.5.4.5.9-.7 1.4 1.4 1.4 1.4-.7.9.5.4 1.5h2.2l.4-1.5.9-.5 1.4.7 1.4-1.4-.7-1.4.5-.9 1.5-.4V6.9l-1.5-.4-.5-.9.7-1.4-1.4-1.4-1.4.7-.9-.5z" fill="none" stroke="${color}" stroke-width="0.7"/>
    </svg>`;
}

// Code brackets icon (for HTML/XML)
function codeIcon(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
        <path d="M5.5 3.5L1.5 8l4 4.5" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10.5 3.5l4 4.5-4 4.5" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

// Diamond icon (for .gitignore etc.)
function diamondIcon(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
        <path d="M8 1L15 8L8 15L1 8Z" fill="${color}" opacity="0.85"/>
    </svg>`;
}

// Curly braces icon (for JSON, CSS)
function bracesIcon(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
        <text x="8" y="12" fill="${color}" font-family="Menlo,Monaco,monospace" font-size="11" font-weight="bold" text-anchor="middle">{}</text>
    </svg>`;
}

function folderSvg(color, isOpen) {
    if (isOpen) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
            <path d="M1.5 3h4.2l1.5 1.5H14v1H7L5.5 4H2v8.5l1.5-5h12L13.5 14H1.5V3z" fill="${color}" opacity="0.85"/>
        </svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
        <path d="M1.5 3h4.5l1.5 1.5H14.5v9.5H1.5V3z" fill="${color}" opacity="0.85"/>
    </svg>`;
}

// ─── Extension → Icon/Color Map ────────────────────
const FILE_ICONS = {
    '.js': () => textIcon('#e8d44d', 'JS'),
    '.jsx': () => reactIcon('#61dafb'),
    '.ts': () => textIcon('#3178c6', 'TS'),
    '.tsx': () => reactIcon('#3178c6'),
    '.py': () => textIcon('#3776ab', 'Py', 10),
    '.html': () => codeIcon('#e44d26'),
    '.htm': () => codeIcon('#e44d26'),
    '.css': () => bracesIcon('#563d7c'),
    '.scss': () => textIcon('#cd6799', 'S', 12),
    '.less': () => textIcon('#1d365d', 'L', 12),
    '.json': () => bracesIcon('#a8b9cc'),
    '.md': () => textIcon('#519aba', 'M', 12),
    '.yml': () => textIcon('#cb171e', 'Y', 12),
    '.yaml': () => textIcon('#cb171e', 'Y', 12),
    '.xml': () => codeIcon('#f26522'),
    '.sh': () => textIcon('#4eaa25', '$', 12),
    '.bash': () => textIcon('#4eaa25', '$', 12),
    '.zsh': () => textIcon('#4eaa25', '$', 12),
    '.go': () => textIcon('#00add8', 'Go'),
    '.rs': () => textIcon('#dea584', 'Rs'),
    '.java': () => textIcon('#b07219', 'J', 12),
    '.c': () => textIcon('#555dbb', 'C', 12),
    '.cpp': () => textIcon('#f34b7d', 'C+', 10),
    '.h': () => textIcon('#8b6fba', 'H', 12),
    '.hpp': () => textIcon('#8b6fba', 'H+', 10),
    '.cs': () => textIcon('#68217a', 'C#', 10),
    '.rb': () => textIcon('#cc342d', 'Rb'),
    '.php': () => textIcon('#777bb4', 'P', 12),
    '.swift': () => textIcon('#f05138', 'Sw'),
    '.kt': () => textIcon('#a97bff', 'Kt'),
    '.dart': () => textIcon('#0175c2', 'D', 12),
    '.vue': () => textIcon('#41b883', 'V', 12),
    '.svelte': () => textIcon('#ff3e00', 'Sv'),
    '.svg': () => codeIcon('#ffb13b'),
    '.sql': () => textIcon('#e38c00', 'SQ'),
    '.r': () => textIcon('#276dc3', 'R', 12),
    '.lua': () => textIcon('#000080', 'Lu'),
    '.toml': () => gearIcon('#9c4121'),
    '.ini': () => gearIcon('#888888'),
    '.env': () => gearIcon('#ecd53f'),
    '.lock': () => textIcon('#888888', '🔒', 11),
    '.gitignore': () => diamondIcon('#f05032'),
    '.dockerfile': () => textIcon('#2496ed', '🐳', 12),
    '.graphql': () => textIcon('#e10098', 'Gq'),
};

const FILENAME_ICONS = {
    'package.json': () => bracesIcon('#8bc34a'),
    'package-lock.json': () => bracesIcon('#8bc34a'),
    'vite.config.js': () => textIcon('#a855f7', '⚡', 12),
    'readme.md': () => textIcon('#519aba', 'M+', 10),
};

// export const FOLDER_ICON = { icon: 'folder', color: '#cccccc' };
// export const FOLDER_OPEN_ICON = { icon: 'folder-opened', color: '#cccccc' };
export function getFolderIcon(isOpen) {
    return folderSvg('#c09553', isOpen);
}

export function getFileIcon(filename) {
    const lower = filename.toLowerCase();
    // Check full filename first (for package.json, etc.)
    if (FILENAME_ICONS[lower]) return { icon: FILENAME_ICONS[lower](), color: '#ccc' };
    // Then check extension
    const dotIdx = lower.lastIndexOf('.');
    if (dotIdx >= 0) {
        const ext = lower.substring(dotIdx);
        if (FILE_ICONS[ext]) return { icon: FILE_ICONS[ext](), color: '#ccc' };
    }
    // Default: generic file icon
    // Generic file page icon
    return { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path d="M3.5 1H9.5L13 4.5V14.5a.5.5 0 0 1-.5.5H3.5a.5.5 0 0 1-.5-.5V1.5A.5.5 0 0 1 3.5 1zM9.5 1V4.5H13" fill="none" stroke="#999" stroke-width="0.9"/></svg>`, color: '#999' };
}

export function getLanguage(filePath) {
    const dotIdx = filePath.lastIndexOf('.');
    if (dotIdx >= 0) {
        const ext = filePath.substring(dotIdx).toLowerCase();
        return EXT_LANG_MAP[ext] || 'plaintext';
    }
    return 'plaintext';
}

export function getLanguageLabel(lang) {
    const labels = {
        javascript: 'JavaScript',
        typescript: 'TypeScript',
        python: 'Python',
        html: 'HTML',
        css: 'CSS',
        json: 'JSON',
        markdown: 'Markdown',
        shell: 'Shell Script',
        yaml: 'YAML',
        go: 'Go',
        rust: 'Rust',
        java: 'Java',
        c: 'C',
        cpp: 'C++',
        csharp: 'C#',
        ruby: 'Ruby',
        php: 'PHP',
        swift: 'Swift',
        kotlin: 'Kotlin',
        dart: 'Dart',
        sql: 'SQL',
        plaintext: 'Plain Text',
    };
    return labels[lang] || lang;
}
