/**
 * markdown-renderer.js - Markdown 渲染组件
 *
 * 提供统一的 Markdown 到 HTML 渲染功能，确保文章阅读界面与编辑器预览的显示效果一致。
 * 支持代码块语法高亮、图片居中、引用块、表格等完整 Markdown 特性。
 *
 * @module MarkdownRenderer
 */

(function() {
    'use strict';

    /**
     * HTML 转义辅助函数
     * @param {string} str - 原始字符串
     * @returns {string} 转义后的字符串
     */
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 针对 C / Python / JS 等代码块的轻量炫彩语法高亮处理
     * @param {string} codeText - 代码文本
     * @param {string} lang - 语言标识
     * @returns {string} 高亮后的 HTML
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

        const rawLang = (lang || '').toLowerCase();

        if (rawLang === 'c' || rawLang === 'cpp' || rawLang === 'c++') {
            text = text.replace(/(#include\s*&lt;[^&]+&gt;|#define\s+\w+|#ifdef|#ifndef|#endif|#pragma[^\n]*)/g, m => saveToken(m, 'preprocessor'));
            text = text.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, m => saveToken(m, 'comment'));
            text = text.replace(/("(\\"|[^"])*"|'(\\'|[^'])*')/g, m => saveToken(m, 'string'));
            const cKeywords = /\b(int|char|float|double|void|struct|typedef|return|if|else|for|while|do|switch|case|break|continue|static|const|unsigned|sizeof|extern|enum|goto|auto|register|volatile|inline|NULL|bool|true|false)\b/g;
            text = text.replace(cKeywords, m => saveToken(m, 'keyword'));
            text = text.replace(/\b(printf|scanf|malloc|free|strlen|strcpy|strcmp|fopen|fclose|exit|memcpy|memset|puts|gets|getchar|putchar)\b(?=\s*\()/g, m => saveToken(m, 'function'));
            text = text.replace(/\b(0x[0-9a-fA-F]+|\d+(\.\d+)?)\b/g, m => saveToken(m, 'number'));
            text = text.replace(/(&amp;&amp;|\|\||-&gt;|\+\+|--|==|!=|&lt;=|&gt;=|\+|-|\*|\/|=)/g, m => saveToken(m, 'operator'));
        } else if (rawLang === 'python' || rawLang === 'py') {
            text = text.replace(/(#[^\n]*)/g, m => saveToken(m, 'comment'));
            text = text.replace(/(""[\s\S]*?"""|'''[\s\S]*?'''|"(\\"|[^"])*"|'(\\'|[^'])*')/g, m => saveToken(m, 'string'));
            const pyKeywords = /\b(def|class|return|if|elif|else|for|while|in|import|from|as|try|except|finally|with|lambda|pass|break|continue|and|or|not|is|yield|async|await|assert|global|nonlocal|raise|True|False|None)\b/g;
            text = text.replace(pyKeywords, m => saveToken(m, 'keyword'));
            text = text.replace(/\b(print|len|range|enumerate|zip|map|filter|list|dict|set|tuple|str|int|float|input|open|super|type|dir|help)\b(?=\s*\()/g, m => saveToken(m, 'function'));
            text = text.replace(/\b(\d+(\.\d+)?)\b/g, m => saveToken(m, 'number'));
            text = text.replace(/(@\w+)/g, m => saveToken(m, 'decorator'));
        } else if (rawLang === 'javascript' || rawLang === 'js' || rawLang === 'typescript' || rawLang === 'ts') {
            text = text.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, m => saveToken(m, 'comment'));
            text = text.replace(/(`(\\`|[^`])*`|"(\\"|[^"])*"|'(\\'|[^'])*')/g, m => saveToken(m, 'string'));
            const jsKeywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|default|from|class|extends|new|this|super|try|catch|finally|throw|async|await|typeof|instanceof|in|of|true|false|null|undefined)\b/g;
            text = text.replace(jsKeywords, m => saveToken(m, 'keyword'));
            text = text.replace(/\b(console|Math|Date|Array|Object|String|Number|JSON|Promise|Set|Map|window|document)\b/g, m => saveToken(m, 'builtin'));
            text = text.replace(/\b(\d+(\.\d+)?)\b/g, m => saveToken(m, 'number'));
            text = text.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b(?=\s*\()/g, m => saveToken(m, 'function'));
            text = text.replace(/(&amp;&amp;|\|\||=&gt;|\+\+|--|===|!==|==|!=|&lt;=|&gt;=|\+|-|\*|\/|=)/g, m => saveToken(m, 'operator'));
        } else {
            text = text.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g, m => saveToken(m, 'comment'));
            text = text.replace(/("(\\"|[^"])*"|'(\\'|[^'])*'|`(\\`|[^`])*`)/g, m => saveToken(m, 'string'));
            const genKeywords = /\b(const|let|var|function|return|if|else|for|while|import|export|class|from|await|async|def|class)\b/g;
            text = text.replace(genKeywords, m => saveToken(m, 'keyword'));
            text = text.replace(/\b(\d+)\b/g, m => saveToken(m, 'number'));
        }

        for (let i = 0; i < tokens.length; i++) {
            text = text.replace(`___TOKEN_${i}___`, tokens[i]);
        }

        return text;
    }

    /**
     * Typora 风格全功能 Markdown 解析器
     * 统一渲染文章阅读界面与编辑器预览的内容。
     *
     * @param {string} markdown - Markdown 原始文本
     * @returns {string} 渲染后的 HTML
     */
    function parseMarkdown(markdown) {
        if (!markdown) return '';
        let html = markdown;

        // 代码块 (```lang ... ```)
        html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function(match, lang, codeStr) {
            const rawLang = lang ? lang.trim().toLowerCase() : '';
            const displayLang = rawLang ? rawLang.toUpperCase() : 'TEXT';
            const trimmedCode = codeStr.trim();
            const highlightedCode = highlightCodeSyntax(trimmedCode, rawLang);
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

        // 表格
        html = html.replace(/^\|(.+)\|\n\|[-\s|]+\|\n((?:\|.+\|\n?)+)/gm, function(match, header, rows) {
            const ths = header.split('|').map(h => `<th>${escapeHtml(h.trim())}</th>`).join('');
            const trs = rows.trim().split('\n').map(row => {
                const tds = row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => `<td>${escapeHtml(c.trim())}</td>`).join('');
                return `<tr>${tds}</tr>`;
            }).join('');
            return `<table class="md-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
        });

        // 引用块 (>)
        html = html.replace(/^>(.*)$/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br>');

        // 标题 (# ~ ######)
        html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
        html = html.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
        html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

        // 图片与链接
        html = html.replace(/!\[(.*?)\]\((.*?)\)/g, function(match, alt, src) {
            const realSrc = (typeof resolveGalleryUrlByName === 'function') ? resolveGalleryUrlByName(src) : src;
            const captionText = alt ? alt.trim() : '';
            const hasCaption = captionText && !captionText.startsWith('image_') && !captionText.startsWith('img_') && captionText !== '图片';
            return `<figure class="md-image-figure">` +
                   `<img alt="${escapeHtml(alt)}" src="${escapeHtml(realSrc)}" class="md-centered-img" loading="lazy">` +
                   (hasCaption ? `<figcaption class="md-img-caption">${escapeHtml(captionText)}</figcaption>` : '') +
                   `</figure>`;
        });

        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // 基础字符格式
        html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 列表
        html = html.replace(/^\s*[-*+] (.*)$/gm, '<ul><li>$1</li></ul>');
        html = html.replace(/^\s*\d+\.\s+(.*)$/gm, '<ol><li>$1</li></ol>');
        html = html.replace(/^---$/gm, '<hr>');

        // 合并相邻列表
        html = html.replace(/<\/ul>\s*<ul>/g, '').replace(/<\/ol>\s*<ol>/g, '');

        // 段落处理
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        html = html.replace(/<p><(h[1-6]|blockquote|ul|ol|table|pre|hr|figure)/g, '<$1');
        html = html.replace(/<\/(h[1-6]|blockquote|ul|ol|table|pre|hr|figure)><\/p>/g, '</$1>');
        html = html.replace(/<p><\/p>/g, '');

        return html;
    }

    /**
     * 一键复制代码块 helper
     * @param {HTMLButtonElement} btn - 复制按钮元素
     */
    function copyCodeBlock(btn) {
        const pre = btn.closest('.code-block-wrapper');
        if (!pre) return;
        const code = pre.querySelector('code');
        if (!code) return;
        const text = code.innerText || code.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                const original = btn.innerHTML;
                btn.innerHTML = '<span>已复制!</span>';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerHTML = original;
                    btn.classList.remove('copied');
                }, 1800);
            }).catch(() => {
                if (typeof showToast === 'function') showToast('复制失败，请手动选取复制代码', 'error');
            });
        } else {
            if (typeof showToast === 'function') showToast('浏览器暂不支持自动复制，请手动选取复制代码', 'warning');
        }
    }

    // 暴露到全局
    window.parseMarkdown = parseMarkdown;
    window.highlightCodeSyntax = highlightCodeSyntax;
    window.copyCodeBlock = copyCodeBlock;

})();
