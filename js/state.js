/**
 * state.js - 全局状态管理与工具函数
 */

// 运行时状态
let articles = JSON.parse(JSON.stringify(defaultArticles));
let profile = Object.assign({}, defaultProfile);

let currentPage = 1;
let activeSort = 'date';
let activeFilters = [];
let activeSearch = '';
let currentHero = 0;
let currentEditingArticleId = null;

const state = {
    likes: JSON.parse(localStorage.getItem(STORAGE_KEYS.likes) || '[]'),
    favorites: JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '[]'),
    comments: JSON.parse(localStorage.getItem(STORAGE_KEYS.comments) || '[]'),
    theme: localStorage.getItem(STORAGE_KEYS.theme) || 'light',
    themeBg: localStorage.getItem('themeBg') || 'gradient',
    themeFont: localStorage.getItem('themeFont') || 'default',
    themeIconStyle: localStorage.getItem('themeIconStyle') || 'line',
    themePreset: localStorage.getItem('themePreset') || 'indigo',
    themeRadius: localStorage.getItem('themeRadius') || '20',
    themeCustomBgUrl: localStorage.getItem('themeCustomBgUrl') || '',
    musicPlaying: localStorage.getItem(STORAGE_KEYS.musicPlaying) === 'true',
    isAdmin: localStorage.getItem('isAdmin') === 'true',
    categories: [], // 结构：[{ name:'前端', tags:['CSS','Vue'] }, ...]
    musicPlaylist: [], // 网易云歌单：[{ id, name, artist, picUrl }]
    musicApiBase: localStorage.getItem(STORAGE_KEYS.musicApiBase) || (typeof DEFAULT_NETEASE_API_BASE !== 'undefined' ? DEFAULT_NETEASE_API_BASE : 'https://netease-cloud-music-api.fe-mm.com'),
    curSongIdx: 0 // 当前播放到第几首
};

// ========== 分类 & 标签管理（categories） ==========
/**
 * 从现有 articles 中汇总出 {category: Set<tags>} 结构
 */
function collectCategoriesFromArticles() {
    const map = new Map(); // categoryName -> Set<tag>
    (articles || []).forEach(art => {
        const cat = (art.category || '未分类').toString().trim() || '未分类';
        if (!map.has(cat)) map.set(cat, new Set());
        const set = map.get(cat);
        (Array.isArray(art.tags) ? art.tags : []).forEach(t => {
            const tag = (t || '').toString().trim();
            if (tag) set.add(tag);
        });
    });
    return Array.from(map.entries()).map(([name, tagSet]) => ({
        name,
        tags: Array.from(tagSet)
    }));
}

function saveCategoriesToStorage() {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(state.categories));
}

function loadCategoriesFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.categories);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                // 做个简单规范化：保证每项结构合理
                return parsed
                    .filter(item => item && item.name && item.name.toString().trim())
                    .map(item => ({
                        name: item.name.toString().trim(),
                        tags: Array.isArray(item.tags)
                            ? item.tags.map(t => (t || '').toString().trim()).filter(Boolean)
                            : []
                    }));
            }
        }
    } catch (e) { /* 忽略 */ }
    return null;
}

/**
 * 初始化分类：
 * 1. 优先读 localStorage；
 * 2. 没有则从 articles 汇总并写入；
 * 3. 之后把 articles 中出现但 categories 里缺失的分类/标签**合并追加**进去（新建文章后也应调用一次 syncCategoriesFromArticles）。
 */
function initCategories() {
    syncCategoriesFromArticles();
}

function syncCategoriesFromArticles() {
    state.categories = collectCategoriesFromArticles();
    saveCategoriesToStorage();
}

function addCategory(catName) {
    if (!state.isAdmin) return false;
    const name = (catName || '').toString().trim();
    if (!name) return false;
    if (state.categories.some(c => c.name === name)) return false;
    state.categories.push({ name, tags: [] });
    saveCategoriesToStorage();
    return true;
}

function deleteCategory(catName) {
    if (!state.isAdmin) return false;
    const idx = state.categories.findIndex(c => c.name === catName);
    if (idx === -1) return false;
    state.categories.splice(idx, 1);
    saveCategoriesToStorage();
    return true;
}

function renameCategory(oldName, newName) {
    if (!state.isAdmin) return false;
    newName = (newName || '').toString().trim();
    if (!newName) return false;
    const target = state.categories.find(c => c.name === oldName);
    if (!target) return false;
    if (state.categories.some(c => c.name === newName)) return false;
    target.name = newName;
    // 同步改一下现有 articles 的 category 字段，保证一致性
    articles.forEach(art => {
        if (art.category === oldName) art.category = newName;
    });
    saveCategoriesToStorage();
    saveArticlesToStorage && saveArticlesToStorage();
    return true;
}

function addTagToCategory(catName, tagName) {
    if (!state.isAdmin) return false;
    tagName = (tagName || '').toString().trim();
    if (!tagName) return false;
    let cat = state.categories.find(c => c.name === catName);
    if (!cat) {
        state.categories.push({ name: catName, tags: [] });
        cat = state.categories[state.categories.length - 1];
    }
    if (cat.tags.indexOf(tagName) !== -1) return false;
    cat.tags.push(tagName);
    saveCategoriesToStorage();
    return true;
}

function deleteTagFromCategory(catName, tagName) {
    if (!state.isAdmin) return false;
    const cat = state.categories.find(c => c.name === catName);
    if (!cat) return false;
    const idx = cat.tags.indexOf(tagName);
    if (idx === -1) return false;
    cat.tags.splice(idx, 1);
    saveCategoriesToStorage();
    return true;
}

function getCategoryTags(catName) {
    const cat = state.categories.find(c => c.name === catName);
    return cat ? [...cat.tags] : [];
}

function getAllTagsFlat() {
    // 兼容原标签云：扁平列出所有标签（去重）
    const set = new Set();
    state.categories.forEach(c => c.tags.forEach(t => set.add(t)));
    return Array.from(set);
}

// ========== 工具函数 ==========

function formatNumber(value) {
    return value.toLocaleString('zh-CN');
}

function formatDate(value) {
    const date = new Date(value);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function computeSiteDays() {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.max(1, Math.floor((pageNow - pageStart) / oneDay));
}

function secToTime(sec) {
    if (!isFinite(sec) || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

/** 校验 URL 是否为有效的音频播放地址（排除 HTML/空串/页面自身 URL） */
function isAudioUrlValid(src) {
    if (!src) return false;
    const s = String(src).trim().toLowerCase();
    if (s.startsWith('data:') || s.endsWith('.html') || s.endsWith('.htm')) return false;
    if (typeof window !== 'undefined' && window.location) {
        const href = window.location.href.toLowerCase();
        if (s === href || s === href.split('#')[0] || s === href.split('?')[0]) return false;
    }
    return s.includes('http://') || s.includes('https://') || s.includes('.mp3') || s.includes('.m4a') || s.includes('music.126.net');
}

function highlight(text, phrase) {
    if (!phrase) return text;
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

/**
 * Typora 风格全功能 Markdown 解析器
 */
function parseMarkdown(markdown) {
    if (!markdown) return '';
    let html = markdown;

    // 代码块 (```lang ... ```) 识别语言、Mac 窗口风格、行号与高颜值 C/Python 语法高亮
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function(match, lang, codeStr) {
        const rawLang = lang ? lang.trim().toLowerCase() : 'python';
        const displayLang = rawLang ? rawLang.toUpperCase() : 'PYTHON';
        const trimmedCode = codeStr.trim();
        const highlightedCode = highlightCodeSyntax(trimmedCode, rawLang);
        
        // 生成对应行号
        const lineCount = trimmedCode.split('\n').length;
        const lineNumsHtml = Array.from({ length: lineCount }, (_, i) => `<span>${i + 1}</span>`).join('');

        return `<div class="code-block-wrapper" data-lang="${escapeHtml(rawLang)}">` +
               `<div class="code-block-header">` +
               `<div class="mac-dots"><span class="mac-dot red"></span><span class="mac-dot yellow"></span><span class="mac-dot green"></span></div>` +
               `<div class="code-header-right">` +
               `<span class="code-lang-badge">${escapeHtml(displayLang)}</span>` +
               `<button type="button" class="code-copy-btn" onclick="copyCodeBlock(this)">` +
               `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>` +
               `<span>复制</span>` +
               `</button>` +
               `</div>` +
               `</div>` +
               `<div class="code-body-layout">` +
               `<div class="line-numbers-gutter" aria-hidden="true">${lineNumsHtml}</div>` +
               `<pre class="code-pre-area"><code class="language-${escapeHtml(rawLang)}">${highlightedCode}</code></pre>` +
               `</div>` +
               `</div>`;
    });

    // 引用块 (>)
    html = html.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');

    // 标题 (# ~ ####)
    html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // 图片居中与注释 (支持根据图册数据名自动解析映射真实图册路径/DataURL)
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, function(match, alt, src) {
        const realSrc = (typeof resolveGalleryUrlByName === 'function') ? resolveGalleryUrlByName(src) : src;
        const captionText = alt ? alt.trim() : '';
        const hasCaption = captionText && !captionText.startsWith('image_') && !captionText.startsWith('img_') && captionText !== '图片';
        
        return `<figure class="md-image-figure" style="text-align:center; margin:20px auto; display:block;">` +
               `<img alt="${alt}" src="${realSrc}" class="md-centered-img" style="max-width:100%; border-radius:10px; margin:0 auto; display:block; box-shadow:0 4px 14px rgba(15,23,42,0.12);">` +
               (hasCaption ? `<figcaption class="md-img-caption" style="font-size:13px; color:#64748b; margin-top:8px; text-align:center; font-style:italic;">📷 ${captionText}</figcaption>` : '') +
               `</figure>`;
    });
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:#2563eb; text-decoration:underline;">$1</a>');

    // 基础字符格式 (加粗、斜体、删除线、行内代码)
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 列表与分割线
    html = html.replace(/^\s*[-*+] (.*)$/gm, '<ul><li>$1</li></ul>');
    html = html.replace(/^\s*\d+\.\s+(.*)$/gm, '<ol><li>$1</li></ol>');
    html = html.replace(/^---$/gm, '<hr>');

    html = html.replace(/<\/ul>\s*<ul>/g, '').replace(/<\/ol>\s*<ol>/g, '');
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><(h[1-4]|blockquote|ul|ol|pre|hr)/g, '<$1');
    html = html.replace(/<\/(h[1-4]|blockquote|ul|ol|pre|hr)><\/p>/g, '</$1>');
    return html;
}

/**
 * 针对 C 语言 / Python / JS 等代码块的轻量炫彩语法高亮处理
 */
function highlightCodeSyntax(codeText, lang) {
    if (!codeText) return '';
    let text = escapeHtml(codeText);
    const tokens = [];
    const saveToken = (str, cls) => {
        const id = `___TOKEN_${tokens.length}___`;
        tokens.push(`<span class="token ${cls}">${str}</span>`);
        return id;
    };

    // 1. 抽取字符串与注释
    if (lang === 'c' || lang === 'cpp' || lang === 'c++') {
        // C 预处理 #include / #define
        text = text.replace(/(#include\s*&lt;[^&]+&gt;|#define\s+\w+|#ifdef|#ifndef|#endif|#pragma[^\n]*)/g, m => saveToken(m, 'preprocessor'));
        // C 注释
        text = text.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, m => saveToken(m, 'comment'));
        // 字符串
        text = text.replace(/("(\\"|[^"])*"|'(\\'|[^'])*')/g, m => saveToken(m, 'string'));
        // 关键字
        const cKeywords = /\b(int|char|float|double|void|struct|typedef|return|if|else|for|while|do|switch|case|break|continue|static|const|unsigned|sizeof|extern|enum|goto|auto|register|volatile|inline|NULL|bool|true|false)\b/g;
        text = text.replace(cKeywords, m => saveToken(m, 'keyword'));
        // 常用 C 标准库函数
        text = text.replace(/\b(printf|scanf|malloc|free|strlen|strcpy|strcmp|fopen|fclose|exit|memcpy|memset|puts|gets|getchar|putchar)\b(?=\s*\()/g, m => saveToken(m, 'function'));
        // 数字 (10进制, 16进制)
        text = text.replace(/\b(0x[0-9a-fA-F]+|\d+(\.\d+)?)\b/g, m => saveToken(m, 'number'));
        // 运算符
        text = text.replace(/(&amp;&amp;|\|\||-&gt;|\+\+|--|==|!=|&lt;=|&gt;=|\+|-|\*|\/|=)/g, m => saveToken(m, 'operator'));
    } else if (lang === 'python' || lang === 'py') {
        // Python 注释
        text = text.replace(/(#[^\n]*)/g, m => saveToken(m, 'comment'));
        // Python 字符串 (三引号与单/双引号)
        text = text.replace(/(""[\s\S]*?"""|'''[\s\S]*?'''|"(\\"|[^"])*"|'(\\'|[^'])*')/g, m => saveToken(m, 'string'));
        // 关键字
        const pyKeywords = /\b(def|class|return|if|elif|else|for|while|in|import|from|as|try|except|finally|with|lambda|pass|break|continue|and|or|not|is|yield|async|await|assert|global|nonlocal|raise|True|False|None)\b/g;
        text = text.replace(pyKeywords, m => saveToken(m, 'keyword'));
        // Built-in 函数
        text = text.replace(/\b(print|len|range|enumerate|zip|map|filter|list|dict|set|tuple|str|int|float|input|open|super|type|dir|help)\b(?=\s*\()/g, m => saveToken(m, 'function'));
        // 数字
        text = text.replace(/\b(\d+(\.\d+)?)\b/g, m => saveToken(m, 'number'));
        // 装饰器
        text = text.replace(/(@\w+)/g, m => saveToken(m, 'decorator'));
    } else {
        // 通用语言
        text = text.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g, m => saveToken(m, 'comment'));
        text = text.replace(/("(\\"|[^"])*"|'(\\'|[^'])*'|`(\\`|[^`])*`)/g, m => saveToken(m, 'string'));
        const genKeywords = /\b(const|let|var|function|return|if|else|for|while|import|export|class|from|await|async)\b/g;
        text = text.replace(genKeywords, m => saveToken(m, 'keyword'));
        text = text.replace(/\b(\d+)\b/g, m => saveToken(m, 'number'));
    }

    // 2. 还原代换 tokens (从后向前替换或多次迭代替换)
    for (let i = 0; i < tokens.length; i++) {
        text = text.replace(`___TOKEN_${i}___`, tokens[i]);
    }

    return text;
}

/**
 * 一键复制代码块 helper
 */
function copyCodeBlock(btn) {
    const pre = btn.closest('.code-block-wrapper');
    if (!pre) return;
    const code = pre.querySelector('code');
    if (!code) return;
    const text = code.innerText || code.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            btn.textContent = '已复制!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = '复制';
                btn.classList.remove('copied');
            }, 1800);
        }).catch(() => {
            alert('复制失败，请手动选取复制代码');
        });
    } else {
        alert('浏览器暂不支持自动复制，请手动选取复制代码');
    }
}
window.copyCodeBlock = copyCodeBlock;
