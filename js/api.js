/**
 * api.js - 后端 REST API 封装层
 *
 * 技术路线：Rust + Axum + SQLite (后端) ←→ fetch API (前端)
 *
 * 设计原则：
 *  - 所有需要持久化的"站点级"数据（文章、评论、个人资料、首页简历、
 *    友链、歌单、分类、访客统计、管理员凭证）都通过 fetch 调用后端。
 *  - 仅"用户级"偏好（点赞历史、收藏列表、主题、UI 偏好）仍保留 localStorage。
 *  - mutation 函数采用 "乐观更新 + 后台同步" 模式：先更新内存中的
 *    articles/state，再 fire-and-forget 调用 API；失败时控制台告警。
 */

// 后端 API 根地址。同源部署时为空字符串（推荐：通过 Axum 静态服务托管前端）。
// 如需前后端分离部署，可在 index.html 中提前设置 window.API_BASE = 'http://localhost:8287'。
const API_BASE = (typeof window !== 'undefined' && window.API_BASE) || '';

/** 管理员 token（登录成功后写入；后续 mutating 请求会自动带上 Authorization 头） */
let _adminToken = localStorage.getItem('adminToken') || '';

function setAdminToken(token) {
    _adminToken = token || '';
    if (_adminToken) {
        localStorage.setItem('adminToken', _adminToken);
    } else {
        localStorage.removeItem('adminToken');
    }
}

function authHeaders() {
    return _adminToken ? { 'Authorization': 'Bearer ' + _adminToken } : {};
}

/** 统一 JSON 请求 */
async function request(method, path, body) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
    const opts = { method, headers };
    if (body !== undefined && body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) {
        // token 失效：清除本地管理员状态
        setAdminToken('');
        if (typeof state !== 'undefined') state.isAdmin = false;
        localStorage.removeItem('isAdmin');
        throw new Error('未授权或登录已过期');
    }
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
}

// ========== 访客 ID（用于 UV 统计） ==========
function getVisitorId() {
    let id = localStorage.getItem('visitorId');
    if (!id) {
        id = 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('visitorId', id);
    }
    return id;
}

// ========== Articles ==========
const Api = {
    setAdminToken,
    getVisitorId,

    listArticles: (opts = {}) => {
        const p = new URLSearchParams();
        if (opts.scope)  p.set('scope', opts.scope);
        if (opts.sort)   p.set('sort', opts.sort);
        if (opts.q)      p.set('q', opts.q);
        if (opts.tag)    p.set('tag', opts.tag);
        if (opts.category) p.set('category', opts.category);
        const qs = p.toString();
        return request('GET', '/api/articles' + (qs ? '?' + qs : ''));
    },

    getArticle: (id) => request('GET', `/api/articles/${id}`),
    createArticle: (data) => request('POST', '/api/articles', data),
    updateArticle: (id, data) => request('PUT', `/api/articles/${id}`, data),
    softDeleteArticle: (id) => request('DELETE', `/api/articles/${id}`),
    restoreArticle: (id) => request('POST', `/api/articles/trash/${id}/restore`),
    permanentDeleteArticle: (id) => request('DELETE', `/api/articles/trash/${id}`),

    setArticleLike: (id, liked) => request('POST', `/api/articles/${id}/like`, { liked }),

    // Article comments
    listArticleComments: (id) => request('GET', `/api/articles/${id}/comments`),
    addArticleComment: (id, data) => request('POST', `/api/articles/${id}/comments`, data),
    deleteArticleComment: (articleId, commentId) => request('DELETE', `/api/articles/${articleId}/comments/${commentId}`),

    // Site-wide comments
    listComments: () => request('GET', '/api/comments'),
    addComment: (data) => request('POST', '/api/comments', data),
    deleteComment: (id) => request('DELETE', `/api/comments/${id}`),

    // Profile
    getProfile: () => request('GET', '/api/profile'),
    updateProfile: (data) => request('PUT', '/api/profile', data),

    // Home resume
    getHomeResume: () => request('GET', '/api/home-resume'),
    updateHomeResume: (data) => request('PUT', '/api/home-resume', data),

    // Friend links
    listFriendLinks: () => request('GET', '/api/friend-links'),
    createFriendLink: (data) => request('POST', '/api/friend-links', data),
    updateFriendLink: (id, data) => request('PUT', `/api/friend-links/${id}`, data),
    deleteFriendLink: (id) => request('DELETE', `/api/friend-links/${id}`),

    // Music
    getMusic: () => request('GET', '/api/music'),
    addSong: (data) => request('POST', '/api/music/playlist', data),
    removeSongAt: (idx) => request('DELETE', `/api/music/playlist/${idx}`),
    setMusicApiBase: (apiBase) => request('PUT', '/api/music/api-base', { apiBase }),

    // Categories
    listCategories: () => request('GET', '/api/categories'),
    createCategory: (data) => request('POST', '/api/categories', data),
    renameCategory: (oldName, newName) => request('PUT', `/api/categories/${encodeURIComponent(oldName)}`, { newName }),
    deleteCategory: (name) => request('DELETE', `/api/categories/${encodeURIComponent(name)}`),
    addTag: (catName, tag) => request('POST', `/api/categories/${encodeURIComponent(catName)}/tags`, { tag }),
    deleteTag: (catName, tag) => request('DELETE', `/api/categories/${encodeURIComponent(catName)}/tags/${encodeURIComponent(tag)}`),

    // Visitor stats
    recordVisit: () => fetch(API_BASE + '/api/stats/visit', {
        method: 'POST',
        headers: { 'X-Visitor-Id': getVisitorId() }
    }).then(r => r.json()),
    getStats: () => request('GET', '/api/stats'),

    // Auth
    login: (username, password) => request('POST', '/api/auth/login', { username, password }),
    logout: () => request('POST', '/api/auth/logout'),
    checkAuth: () => request('GET', '/api/auth/check'),
    changePassword: (newPassword) => request('PUT', '/api/auth/password', { newPassword }),

    // Space feeds (动态/说说)
    listFeeds: () => request('GET', '/api/feeds'),
    getFeed: (id) => request('GET', `/api/feeds/${id}`),
    createFeed: (data) => request('POST', '/api/feeds', data),
    updateFeed: (id, data) => request('PUT', `/api/feeds/${id}`, data),
    deleteFeed: (id) => request('DELETE', `/api/feeds/${id}`),
    likeFeed: (id, liked) => request('POST', `/api/feeds/${id}/like`, { liked }),
    addFeedComment: (feedId, data) => request('POST', `/api/feeds/${feedId}/comments`, data),
    deleteFeedComment: (feedId, commentId) => request('DELETE', `/api/feeds/${feedId}/comments/${commentId}`),

    // KV store (admin-managed config data)
    getKv: (key) => request('GET', `/api/kv/${encodeURIComponent(key)}`),
    setKv: (key, value) => request('PUT', `/api/kv/${encodeURIComponent(key)}`, value),
    listKvKeys: () => request('GET', '/api/kv'),

    // Operation logs (审计日志 + 回滚)
    listLogs: (opts = {}) => {
        // opts: { limit, entity, action, since }
        // since = 天数（默认7，只查最近7天）
        const p = new URLSearchParams();
        if (opts.limit)   p.set('limit', opts.limit);
        if (opts.entity)  p.set('entity', opts.entity);
        if (opts.action)  p.set('action', opts.action);
        if (opts.since !== undefined) p.set('since', opts.since);
        const qs = p.toString();
        return request('GET', '/api/logs' + (qs ? '?' + qs : ''));
    },
    getLog: (id) => request('GET', `/api/logs/${id}`),
    rollbackLog: (id) => request('POST', `/api/logs/${id}/rollback`),

    // Database viewer (数据库查看)
    listDbTables: () => request('GET', '/api/db/tables'),
    getDbTableData: (name, opts = {}) => {
        // opts: { limit, offset }
        const p = new URLSearchParams();
        if (opts.limit) p.set('limit', opts.limit);
        if (opts.offset !== undefined) p.set('offset', opts.offset);
        const qs = p.toString();
        return request('GET', `/api/db/tables/${encodeURIComponent(name)}` + (qs ? '?' + qs : ''));
    },
    getDbTableSchema: (name) => request('GET', `/api/db/schema/${encodeURIComponent(name)}`),
};

window.Api = Api;
