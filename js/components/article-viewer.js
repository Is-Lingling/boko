/**
 * article-viewer.js - 文章阅读器组件
 *
 * 负责文章详情页的渲染与交互，包括文章头部信息、Markdown 内容渲染、
 * 点赞/收藏操作、评论列表、面包屑导航等。
 *
 * @module ArticleViewer
 * @requires parseMarkdown (来自 markdown-renderer.js)
 * @requires state (全局状态对象)
 * @requires getArticleById, saveArticlesToStorage, updateArticle, createArticle (来自 data.js)
 * @requires getIcon, showToast, showConfirmModal (全局辅助函数)
 * @requires switchView, generateTOC, scrollToComments (来自 ui.js)
 * @requires toggleLike, toggleFavorite, getArticleLikes (来自 data.js / events.js)
 * @requires triggerBurstEffect (来自 ui.js)
 * @requires formatDateTime, formatDate, escapeHtml (全局辅助函数)
 */

(function() {
    'use strict';

    /** @type {number|null} 当前正在阅读的文章 ID */
    let currentViewerArticleId = null;

    /**
     * 打开文章阅读器并渲染指定文章
     * @param {number} id - 文章 ID
     */
    function openArticleViewer(id) {
        const item = (typeof getArticleById === 'function') ? getArticleById(id) : null;
        if (!item) return;

        currentViewerArticleId = item.id;

        // 增加阅读数
        item.read = (item.read || 0) + 1;
        if (typeof saveArticlesToStorage === 'function') saveArticlesToStorage();
        if (typeof updateStats === 'function') updateStats();

        const titleEl = document.getElementById('inlineDetailTitle');
        const metaEl = document.getElementById('inlineDetailMeta');
        const coverEl = document.getElementById('inlineDetailCover');
        const tagsEl = document.getElementById('inlineDetailTags');
        const contentEl = document.getElementById('inlineDetailContent');
        const adminActions = document.getElementById('detailAdminActions');

        if (titleEl) titleEl.textContent = item.title;

        if (metaEl) {
            const dateStr = (typeof formatDateTime === 'function')
                ? formatDateTime(item.date)
                : (typeof formatDate === 'function' ? formatDate(item.date) : item.date);
            const likes = (typeof getArticleLikes === 'function')
                ? getArticleLikes(item)
                : (item.like || 0);

            metaEl.innerHTML = `
                <div class="detail-breadcrumb-bar">
                    <div class="breadcrumb-nav">
                        <span class="breadcrumb-item" onclick="switchView('home');">首页</span>
                        <span class="breadcrumb-separator">/</span>
                        <span class="breadcrumb-item" onclick="switchView('list'); if(typeof activeFilters!=='undefined'){activeFilters=[];} if(typeof renderArticles==='function')renderArticles();">文章</span>
                        <span class="breadcrumb-separator">/</span>
                        <span class="breadcrumb-item active" onclick="switchView('list'); if(typeof activeFilters!=='undefined'){activeFilters=['${escapeHtml(item.category)}'];} if(typeof renderArticles==='function')renderArticles();">${escapeHtml(item.category)}</span>
                    </div>
                    <div class="detail-action-tools">
                        <button type="button" class="detail-tool-btn" onclick="exportArticlePDF()" title="打印文章">
                            ${typeof getIcon === 'function' ? getIcon('print', '', 14) : ''} <span>打印</span>
                        </button>
                        <button type="button" class="detail-tool-btn" onclick="downloadArticleMD('${item.id}')" title="下载为 .md 文件">
                            ${typeof getIcon === 'function' ? getIcon('download', '', 14) : ''} <span>下载</span>
                        </button>
                        <button type="button" class="detail-tool-btn" onclick="copyArticleShareLink('${item.id}')" title="复制分享链接">
                            ${typeof getIcon === 'function' ? getIcon('share', '', 14) : ''} <span>分享</span>
                        </button>
                    </div>
                </div>
                <div class="detail-meta-stats" id="detailMetaStats">
                    <span>${typeof getIcon === 'function' ? getIcon('calendar', '', 14) : ''} 发布日期：${dateStr}</span> ·
                    <span>${typeof getIcon === 'function' ? getIcon('book-open', '', 14) : ''} 阅读 (${item.read})</span> ·
                    <span>${typeof getIcon === 'function' ? getIcon('like', '', 14) : ''} 点赞 (${likes})</span> ·
                    <span style="cursor:pointer; color:var(--primary);" onclick="scrollToComments()">${typeof getIcon === 'function' ? getIcon('comment', '', 14) : ''} 评论 (${item.comment || 0})</span>
                </div>
            `;
        }

        if (coverEl) {
            if (item.cover && item.cover.trim() !== '') {
                coverEl.src = item.cover.trim();
                coverEl.alt = item.title + ' 封面';
                coverEl.style.display = 'block';
            } else {
                coverEl.style.display = 'none';
                coverEl.removeAttribute('src');
            }
        }

        if (tagsEl) {
            tagsEl.innerHTML = (item.tags || []).map(tag =>
                `<span class="tag-item" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`
            ).join(' ');
            tagsEl.querySelectorAll('.tag-item[data-tag]').forEach(tagEl => {
                tagEl.addEventListener('click', () => {
                    if (typeof toggleFilter === 'function') toggleFilter(tagEl.dataset.tag);
                    if (typeof switchView === 'function') switchView('list');
                });
            });
        }

        if (contentEl) {
            const contentHtml = item.content
                ? parseMarkdown(item.content)
                : `<p>${escapeHtml(item.summary || '')}</p>`;
            contentEl.innerHTML = contentHtml;
        }

        if (adminActions) {
            const isAdm = !!(typeof state !== 'undefined' && state && state.isAdmin);
            adminActions.style.display = isAdm ? 'inline-flex' : 'none';
        }

        // 点赞/收藏按钮
        renderDetailLikeFavoriteBar(item);

        // 评论列表
        renderInlineArticleComments(item.id);

        if (typeof switchView === 'function') switchView('detail');

        // 生成目录 (TOC)
        if (typeof generateTOC === 'function') generateTOC('inlineDetailContent');

        // 移动端下自动滚动到内容顶部
        if (window.innerWidth < 768) {
            const detailView = document.getElementById('detailView');
            if (detailView) detailView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * 关闭文章阅读器，返回列表视图
     */
    function closeArticleViewer() {
        currentViewerArticleId = null;
        if (typeof switchView === 'function') switchView('list');
    }

    /**
     * 从阅读器进入编辑器
     */
    function editFromViewer() {
        if (!currentViewerArticleId) return;
        const article = (typeof getArticleById === 'function') ? getArticleById(currentViewerArticleId) : null;
        if (article && typeof openArticleEditor === 'function') {
            openArticleEditor(article);
        }
    }

    /**
     * 渲染文章详情页底部的点赞/收藏按钮
     * @param {Object} item - 文章对象
     */
    function renderDetailLikeFavoriteBar(item) {
        if (!item) return;
        const bar = document.getElementById('detailLikeFavoriteBar');
        if (!bar) return;

        const liked = Array.isArray(state.likes) && state.likes.includes(item.id);
        const favorited = Array.isArray(state.favorites) && state.favorites.includes(item.id);

        const likeBtn = bar.querySelector('[data-viewer-action="like"]');
        if (likeBtn) {
            const textEl = likeBtn.querySelector('.btn-text');
            if (textEl) textEl.textContent = liked ? '已点赞' : '点赞';
            likeBtn.classList.toggle('is-active', liked);
            likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
            likeBtn.setAttribute('title', liked ? '取消对这篇文章的点赞' : '为这篇文章点赞');
            likeBtn.onclick = () => {
                if (typeof toggleLike === 'function') toggleLike(item.id);
                if (!liked && typeof triggerBurstEffect === 'function') {
                    triggerBurstEffect(likeBtn, 'heart');
                }
                renderDetailLikeFavoriteBar((typeof getArticleById === 'function') ? getArticleById(item.id) : item);
                refreshDetailMetaIfNeeded(item.id);
            };
        }

        const favBtn = bar.querySelector('[data-viewer-action="favorite"]');
        if (favBtn) {
            const textEl = favBtn.querySelector('.btn-text');
            if (textEl) textEl.textContent = favorited ? '已收藏' : '收藏';
            favBtn.classList.toggle('is-active', favorited);
            favBtn.setAttribute('aria-pressed', favorited ? 'true' : 'false');
            favBtn.setAttribute('title', favorited ? '取消对这篇文章的收藏' : '把这篇文章加入收藏夹');
            favBtn.onclick = () => {
                if (typeof toggleFavorite === 'function') toggleFavorite(item.id);
                if (!favorited && typeof triggerBurstEffect === 'function') {
                    triggerBurstEffect(favBtn, 'star');
                }
                renderDetailLikeFavoriteBar((typeof getArticleById === 'function') ? getArticleById(item.id) : item);
            };
        }
    }

    /**
     * 刷新详情页元数据（阅读数、点赞数等）
     * @param {number} id - 文章 ID
     */
    function refreshDetailMetaIfNeeded(id) {
        const item = (typeof getArticleById === 'function') ? getArticleById(id) : null;
        if (!item) return;
        const statsEl = document.getElementById('detailMetaStats');
        if (!statsEl) return;

        const dateStr = (typeof formatDateTime === 'function')
            ? formatDateTime(item.date)
            : (typeof formatDate === 'function' ? formatDate(item.date) : item.date);
        const likes = (typeof getArticleLikes === 'function')
            ? getArticleLikes(item)
            : (item.like || 0);

        statsEl.innerHTML = `
            <span>${typeof getIcon === 'function' ? getIcon('calendar', '', 14) : ''} 发布日期：${dateStr}</span> ·
            <span>${typeof getIcon === 'function' ? getIcon('book-open', '', 14) : ''} 阅读 (${item.read})</span> ·
            <span>${typeof getIcon === 'function' ? getIcon('like', '', 14) : ''} 点赞 (${likes})</span> ·
            <span style="cursor:pointer; color:var(--primary);" onclick="scrollToComments()">${typeof getIcon === 'function' ? getIcon('comment', '', 14) : ''} 评论 (${item.comment || 0})</span>
        `;
    }

    /**
     * 渲染文章详情页内联评论列表
     * @param {number} articleId - 文章 ID
     */
    function renderInlineArticleComments(articleId) {
        const listEl = document.getElementById('inlineArticleCommentList');
        if (!listEl) return;

        const article = (typeof getArticleById === 'function') ? getArticleById(articleId) : null;
        if (!article) return;
        if (!article.commentList) article.commentList = [];

        if (article.commentList.length === 0) {
            listEl.innerHTML = '<p style="color:var(--text-muted); font-size:13.5px; padding:20px 0; text-align:center;">暂无针对本文的评论，快来抢沙发发表第一条想法吧！</p>';
            return;
        }

        const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s == null ? '' : s));
        const visitor = (typeof loadVisitorInfo === 'function') ? loadVisitorInfo() : null;
        const visitorName = visitor ? (visitor.name || '') : '';
        const visitorContact = visitor ? (visitor.contact || '') : '';
        const isAdmin = !!(typeof state !== 'undefined' && state && state.isAdmin);

        const userCanDelete = (c) => isAdmin || (visitorName && c.name === visitorName) || (visitorContact && c.contact && c.contact === visitorContact);

        const renderDeleteBtn = (c) => userCanDelete(c)
            ? `<button type="button" class="comment-link-btn delete-btn" data-action="delete-comment"
                  data-scope="article" data-article-id="${articleId}" data-id="${c.id}"
                  title="删除此条评论">删除</button>`
            : '';

        const topList = (typeof getTopLevelComments === 'function')
            ? getTopLevelComments('article', articleId)
            : article.commentList.filter(c => !c.parentId || Number(c.parentId) === 0);

        const renderReplies = (parentId) => {
            const replies = (typeof getReplies === 'function') ? getReplies(parentId, 'article', articleId) : [];
            if (!replies.length) return '';
            return `
                <div class="comment-replies-wrap">
                    ${replies.map(r => `
                    <div class="comment-reply-item">
                        <div class="reply-item-content">
                            <span class="reply-author-name${r.contact ? ' comment-name-clickable' : ''}" ${r.contact ? `data-contact="${esc(r.contact)}" title="点击查看联系方式"` : ''}>${esc(r.name)}</span>:
                            <span class="reply-text-body">${esc(r.content)}</span>
                            <span class="reply-time-tag">(${typeof formatDateTime === 'function' ? formatDateTime(r.date) : esc(r.date || '刚刚')})</span>
                        </div>
                        <div class="reply-item-actions">
                            <button type="button" class="comment-link-btn reply-btn" data-action="toggle-reply" data-scope="article" data-article-id="${articleId}" data-id="${parentId}" data-reply-to="${esc(r.name)}">回复</button>
                            ${renderDeleteBtn(r)}
                        </div>
                    </div>
                    `).join('')}
                </div>
            `;
        };

        listEl.innerHTML = topList.map(c => `
            <div class="comment-item" data-comment-id="${c.id}">
                <div class="comment-item-header">
                    <div class="comment-header-left">
                        <span class="comment-user-name${c.contact ? ' comment-name-clickable' : ''}" ${c.contact ? `data-contact="${esc(c.contact)}" title="点击查看联系方式"` : ''}>${esc(c.name)}</span>
                        <span class="comment-date-badge">${typeof formatDateTime === 'function' ? formatDateTime(c.date) : esc(c.date || '刚刚')}</span>
                    </div>
                    <div class="comment-header-right">
                        <button type="button" class="comment-link-btn reply-btn" data-action="toggle-reply" data-scope="article" data-article-id="${articleId}" data-id="${c.id}" title="回复此评论">回复</button>
                        ${renderDeleteBtn(c)}
                    </div>
                </div>
                <div class="comment-body-content">${esc(c.content)}</div>
                <div class="comment-reply-box" data-reply-box="${c.id}" style="display:none;">
                    <div class="reply-input-wrap">
                        <textarea class="reply-textarea" rows="2" placeholder="写下你的回复..." data-reply-input="${c.id}"></textarea>
                        <div class="reply-box-actions">
                            <button type="button" class="primary-btn reply-submit-btn" data-action="submit-reply" data-scope="article" data-article-id="${articleId}" data-id="${c.id}">发表回复</button>
                            <button type="button" class="secondary-btn reply-cancel-btn" data-action="cancel-reply" data-id="${c.id}">取消</button>
                        </div>
                    </div>
                </div>
                <div class="comment-reply-list" data-reply-list="${c.id}">
                    ${renderReplies(c.id)}
                </div>
            </div>
        `).join('');
    }

    /**
     * 获取当前正在阅读的文章 ID
     * @returns {number|null}
     */
    function getCurrentViewerArticleId() {
        return currentViewerArticleId;
    }

    /**
     * 设置当前正在阅读的文章 ID（供外部调用）
     * @param {number|null} id
     */
    function setCurrentViewerArticleId(id) {
        currentViewerArticleId = id;
    }

    // 暴露到全局
    window.openArticleViewer = openArticleViewer;
    window.closeArticleViewer = closeArticleViewer;
    window.editFromViewer = editFromViewer;
    window.renderDetailLikeFavoriteBar = renderDetailLikeFavoriteBar;
    window.refreshDetailMetaIfNeeded = refreshDetailMetaIfNeeded;
    window.renderInlineArticleComments = renderInlineArticleComments;
    window.getCurrentViewerArticleId = getCurrentViewerArticleId;
    window.setCurrentViewerArticleId = setCurrentViewerArticleId;

})();
