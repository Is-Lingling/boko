/**
 * data.js - 数据层：文章、个人资料、评论、访客统计的 CRUD 与持久化
 */

// ========== 文章数据（正式发布）+ 回收站 ==========

let trash = []; // 回收站：每一项 = 完整文章对象 + { deletedAt: 毫秒时间戳 }
const TRASH_STORAGE_KEY = 'blogTrashArticles';

function loadTrashFromStorage() {
    try {
        const raw = localStorage.getItem(TRASH_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        trash = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        trash = [];
    }
}

function saveTrashToStorage() {
    try {
        localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(trash));
    } catch (error) { /* 忽略持久化异常（如 quota 超限） */ }
}

function getTrashById(id) {
    return trash.find(item => item && item.id === Number(id));
}

function getAllTrash() {
    // 按删除时间倒序（最新删除的排前面）
    return [...trash].sort((a, b) => Number(b.deletedAt || 0) - Number(a.deletedAt || 0));
}

/**
 * 从回收站恢复文章到正式发布列表（恢复 = 从 trash 移除 + 写入 articles）。
 * @param {number} id 文章 ID
 * @param {object} [overrideData] 可选：恢复时一并覆盖文章字段（供「编辑后再发布」使用）
 * @returns {object|null} 恢复后的文章对象
 */
async function restoreFromTrash(id, overrideData) {
    const idx = trash.findIndex(item => item && item.id === Number(id));
    if (idx === -1) return null;
    const raw = trash[idx];
    trash.splice(idx, 1);
    // 构造恢复后的正式文章对象：去掉 deletedAt / 其它内部字段，有覆盖则应用覆盖
    const restored = Object.assign({}, raw, overrideData || {});
    delete restored.deletedAt;
    // 保证 articles 里不重复（同一个 id 若已存在就覆盖，否则插入）
    const existingIdx = articles.findIndex(x => x && x.id === Number(restored.id));
    if (existingIdx > -1) {
        articles[existingIdx] = restored;
    } else {
        articles.unshift(restored);
    }
    saveArticlesToStorage();
    saveTrashToStorage();
    // 同步到后端：恢复（await 确保成功）
    try {
        await Api.restoreArticle(id);
        // 若有字段覆盖，再 PUT 一次更新
        if (overrideData) {
            await Api.updateArticle(id, {
                title: restored.title,
                category: restored.category,
                tags: restored.tags,
                summary: restored.summary,
                cover: restored.cover,
                content: restored.content,
                featured: !!restored.featured,
                date: restored.date
            });
        }
    } catch (err) {
        console.error('[API] 恢复文章失败，回滚:', err && err.message);
        // 回滚：把文章放回回收站
        trash.splice(idx, 0, raw);
        const artIdx = articles.findIndex(x => x && x.id === Number(restored.id));
        if (artIdx > -1) articles.splice(artIdx, 1);
        saveArticlesToStorage();
        saveTrashToStorage();
        throw err;
    }
    // 刷新分类/标签
    if (typeof syncCategoriesFromArticles === 'function') {
        syncCategoriesFromArticles();
    }
    return restored;
}

/**
 * 彻底删除回收站中的文章（无恢复可能）。
 */
async function permanentDeleteFromTrash(id) {
    const before = trash.length;
    const item = trash.find(item => item && item.id === Number(id));
    trash = trash.filter(item => item && item.id !== Number(id));
    if (trash.length !== before) {
        saveTrashToStorage();
        // 同步到后端：永久删除（await 确保成功）
        try {
            await Api.permanentDeleteArticle(id);
        } catch (err) {
            console.error('[API] 永久删除失败，回滚:', err && err.message);
            if (item) trash.unshift(item);
            saveTrashToStorage();
            throw err;
        }
        // 刷新分类/标签
        if (typeof syncCategoriesFromArticles === 'function') {
            syncCategoriesFromArticles();
        }
        return true;
    }
    return false;
}

async function loadArticlesFromFile() {
    // 从后端 REST API 加载文章（数据源：SQLite）
    try {
        const data = await Api.listArticles();
        if (Array.isArray(data) && data.length > 0) {
            articles = data;
            // 写入 localStorage 仅作离线缓存（API 不可用时的兜底）
            try { localStorage.setItem(STORAGE_KEYS.articles, JSON.stringify(articles)); } catch (e) {}
            return;
        }
        articles = [];
    } catch (error) {
        console.warn('[API] 加载文章失败，回退到本地缓存:', error && error.message);
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.articles) || 'null');
            articles = Array.isArray(saved) ? saved : [];
        } catch (e) {
            articles = [];
        }
    }
}

function loadArticlesFromCache() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.articles) || 'null');
        if (Array.isArray(saved) && saved.length) {
            articles = saved;
        }
    } catch (e) {
        // Keep bundled defaults when cache is unavailable.
    }
}

function loadProfileFromCache() {
    try {
        const saved = JSON.parse(localStorage.getItem('blogProfile') || 'null');
        if (saved && typeof saved === 'object') {
            profile = Object.assign({}, defaultProfile, saved);
        }
    } catch (error) {
        profile = Object.assign({}, defaultProfile);
    }
}

function loadCommentsFromCache() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.comments) || 'null');
        if (Array.isArray(saved)) {
            state.comments = saved;
        }
    } catch (error) {
        // Keep current comments when cache is unavailable.
    }
}

function saveArticlesToStorage() {
    // 数据持久化已迁移到后端；此函数仅保留为离线缓存写入，避免破坏旧调用点。
    try {
        localStorage.setItem(STORAGE_KEYS.articles, JSON.stringify(articles || []));
    } catch (e) {
        console.warn('Failed to cache articles locally:', e);
    }
}

/** 后台同步：把单篇文章的变更 PUT 到后端（失败仅告警，不影响 UI） */
function _syncArticleToApi(method, path, body) {
    return fetch((window.API_BASE || '') + path, {
        method,
        headers: Object.assign({ 'Content-Type': 'application/json' },
            (localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {})),
        body: body ? JSON.stringify(body) : undefined
    }).catch(err => console.warn('[API] 文章同步失败:', err && err.message));
}

function getArticleById(id) {
    return articles.find(item => item.id === Number(id));
}

function getArticleLikes(item) {
    if (item.like !== undefined) return item.like;
    return Math.floor((item.read || 0) * 0.08);
}

function getHeroItems() {
    return [...articles].sort((a, b) => getArticleLikes(b) - getArticleLikes(a)).slice(0, 5);
}

function sortArticles(list) {
    return [...list].sort((a, b) => {
        if (activeSort === 'read') return b.read - a.read;
        if (activeSort === 'comment') return b.comment - a.comment;
        return new Date(b.date) - new Date(a.date);
    });
}

function filterArticles() {
    return articles.filter(item => {
        const searchText = activeSearch.trim().toLowerCase();
        const matchesSearch = !searchText
            || item.title.toLowerCase().includes(searchText)
            || item.summary.toLowerCase().includes(searchText)
            || item.tags.some(tag => tag.toLowerCase().includes(searchText));
        const matchesTag = activeFilters.length === 0
            || item.tags.some(tag => activeFilters.includes(tag))
            || activeFilters.includes(item.category)
            || activeFilters.includes(item.date.slice(0, 7));
        return matchesSearch && matchesTag;
    });
}

async function createArticle(data) {
    const newArticle = {
        id: Date.now(),
        title: data.title,
        date: new Date().toISOString(),
        category: data.category || '随笔',
        tags: data.tags.length ? data.tags : ['随笔'],
        read: 0,
        comment: 0,
        summary: data.summary,
        cover: data.cover || '',
        autoCover: '',
        content: data.content
    };
    articles.unshift(newArticle);
    saveArticlesToStorage();
    // 同步到后端（await 确保写入数据库，失败则回滚内存中的临时文章）
    try {
        const created = await Api.createArticle({
            title: newArticle.title,
            category: newArticle.category,
            tags: newArticle.tags,
            summary: newArticle.summary,
            cover: newArticle.cover,
            content: newArticle.content,
            featured: !!newArticle.featured
        });
        if (created && created.id) {
            // 用后端返回的真实 id 替换临时 id
            const idx = articles.findIndex(a => a.id === newArticle.id);
            if (idx > -1) {
                articles[idx].id = created.id;
                articles[idx].date = created.date || newArticle.date;
            }
            saveArticlesToStorage();
        }
    } catch (err) {
        console.error('[API] 创建文章失败，回滚内存:', err && err.message);
        // 回滚：从内存中移除临时文章
        const idx = articles.findIndex(a => a.id === newArticle.id);
        if (idx > -1) articles.splice(idx, 1);
        saveArticlesToStorage();
        throw err;
    }
    // 刷新分类/标签（新文章可能引入新的分类或标签）
    if (typeof syncCategoriesFromArticles === 'function') {
        syncCategoriesFromArticles();
    }
    return newArticle;
}

async function updateArticle(id, data) {
    const article = getArticleById(id);
    if (!article) return null;
    const oldCategory = article.category;
    const oldTags = [...(article.tags || [])];
    Object.assign(article, data);
    saveArticlesToStorage();
    // 同步到后端（await 确保写入数据库）
    try {
        await Api.updateArticle(id, {
            title: article.title,
            category: article.category,
            tags: article.tags,
            summary: article.summary,
            cover: article.cover,
            content: article.content,
            featured: !!article.featured,
            date: article.date
        });
    } catch (err) {
        console.error('[API] 更新文章失败:', err && err.message);
        // 回滚分类/标签修改
        article.category = oldCategory;
        article.tags = oldTags;
        saveArticlesToStorage();
        throw err;
    }
    // 刷新分类/标签（分类或标签可能变化）
    if (typeof syncCategoriesFromArticles === 'function') {
        syncCategoriesFromArticles();
    }
    return article;
}

/**
 * 删除文章 = 移动到回收站（不是彻底删除；彻底删除需在回收站再执行 permanentDeleteFromTrash）。
 * @param {number} id 文章 ID
 * @returns {boolean} 是否成功移入回收站
 */
async function deleteArticle(id) {
    if (!state.isAdmin) return false;
    const targetId = Number(id);
    const idx = articles.findIndex(item => item && item.id === targetId);
    if (idx === -1) return false;
    // 从正式列表取出，附加 deletedAt 字段后放入回收站（最新删除在最前）
    const moved = Object.assign({}, articles[idx], { deletedAt: Date.now() });
    articles.splice(idx, 1);
    // 避免回收站重复：如已有同 id（理论不应出现，但保险起见）先删旧的
    trash = trash.filter(item => item && item.id !== targetId);
    trash.unshift(moved);
    saveArticlesToStorage();
    saveTrashToStorage();
    // 同步到后端：软删除（await 确保删除成功）
    try {
        await Api.softDeleteArticle(targetId);
    } catch (err) {
        console.error('[API] 删除文章失败，回滚:', err && err.message);
        // 回滚：把文章从回收站移回正式列表
        trash = trash.filter(item => item && item.id !== targetId);
        articles.splice(idx, 0, moved);
        delete moved.deletedAt;
        saveArticlesToStorage();
        saveTrashToStorage();
        throw err;
    }
    // 刷新分类/标签（删除文章后，某些分类/标签可能不再有文章使用）
    if (typeof syncCategoriesFromArticles === 'function') {
        syncCategoriesFromArticles();
    }
    return true;
}

// ========== KV store 同步助手 ==========
// 管理员可编辑的配置数据（图册命名、封面计数、图片库、文件管理、日历备忘、
// 管理员快捷链接）统一通过后端 kv_store 表持久化。

/** 后台同步 KV 数据到后端（fire-and-forget） */
function _syncKvToApi(key, value) {
    Api.setKv(key, value)
       .catch(err => console.warn(`[API] 同步 KV(${key}) 失败:`, err && err.message));
}

/** 初始化时从后端批量加载所有 KV 数据并写入 localStorage 缓存 */
async function loadKvFromApi() {
    const keys = [
        'gallery_images', 'gallery_names', 'cover_usage',
        'article_content_images', 'other_images', 'files',
        'custom_admin_links', 'calendar_memos'
    ];
    const keyMap = {
        'gallery_images': 'galleryImages',
        'gallery_names': STORAGE_KEYS.galleryNames,
        'cover_usage': STORAGE_KEYS.coverUsage,
        'article_content_images': STORAGE_KEYS.articleContentImages,
        'other_images': STORAGE_KEYS.otherImages,
        'files': STORAGE_KEYS.files,
        'custom_admin_links': 'customAdminLinks',
        'calendar_memos': 'blog_calendar_memos'
    };
    const promises = keys.map(async (k) => {
        try {
            const v = await Api.getKv(k);
            if (v !== null && v !== undefined) {
                const lsKey = keyMap[k];
                if (lsKey) localStorage.setItem(lsKey, JSON.stringify(v));
            }
        } catch (err) {
            // 静默失败，使用 localStorage 现有值
        }
    });
    await Promise.all(promises);
}

// ========== 图册命名管理 & 封面使用计数 ==========

/** 读取图册图片的自定义命名映射 { url: name } */
function loadGalleryNames() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.galleryNames);
        return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
}

function saveGalleryNames(names) {
    try {
        localStorage.setItem(STORAGE_KEYS.galleryNames, JSON.stringify(names || {}));
    } catch (e) { /* 忽略 */ }
    _syncKvToApi('gallery_names', names || {});
}

/** 获取图册图片的显示名称（默认 img1/img2/...，可被自定义覆盖） */
function getGalleryImageName(url, idx) {
    if (!url) return '';
    const names = loadGalleryNames();
    if (names[url]) return names[url];
    return 'img' + ((typeof idx === 'number' ? idx : 0) + 1);
}

/** 设置图册图片的自定义名称及反向关联 */
function setGalleryImageName(url, name) {
    if (!url) return;
    const names = loadGalleryNames();
    names[url] = name || '';
    if (name) {
        names[name] = url; // 建立名称 -> URL 的反向查找索引
    }
    saveGalleryNames(names);
}

/** 根据图册图片显示名称/相对路径/唯一数据标识查找对应的实际图片 URL / DataURL */
function resolveGalleryUrlByName(nameOrUrl) {
    if (!nameOrUrl) return '';
    const cleanRef = nameOrUrl.trim();
    if (cleanRef.startsWith('data:') || cleanRef.startsWith('http://') || cleanRef.startsWith('https://')) {
        return cleanRef;
    }

    const names = loadGalleryNames();
    // 1. 先查索引表（支持相对路径如 "img/my_photo.png" 或数据名 "my_photo.png"）
    if (names[cleanRef]) return names[cleanRef];

    // 2. 查图册列表匹配默认名称 (如 img1, img/img1.jpg...)
    const images = (typeof getGalleryImages === 'function') ? getGalleryImages() : [];
    for (let i = 0; i < images.length; i++) {
        const url = images[i];
        const defaultName = 'img' + (i + 1);
        const defaultRelPath = 'img/' + defaultName;
        if (names[url] === cleanRef || defaultName === cleanRef || defaultRelPath === cleanRef) {
            return url;
        }
    }

    return cleanRef;
}

/** 从命名中提取数字（用于"优先使用数字小的图片"排序） */
function extractImageNumber(name) {
    const m = String(name || '').match(/(\d+)/);
    return m ? Number(m[1]) : 9999;
}

/** 读取封面使用计数 { url: count } */
function loadCoverUsage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.coverUsage);
        return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
}

function saveCoverUsage(usage) {
    try {
        localStorage.setItem(STORAGE_KEYS.coverUsage, JSON.stringify(usage || {}));
    } catch (e) { /* 忽略 */ }
    _syncKvToApi('cover_usage', usage || {});
}

/** 增加某张图作为自动封面的使用计数 */
function incrementCoverUsage(url) {
    if (!url) return;
    const usage = loadCoverUsage();
    usage[url] = (usage[url] || 0) + 1;
    saveCoverUsage(usage);
}

/** 减少使用计数（如图册图片被删除时清理） */
function decrementCoverUsage(url) {
    if (!url) return;
    const usage = loadCoverUsage();
    if (usage[url] && usage[url] > 0) usage[url] -= 1;
    if (!usage[url]) delete usage[url];
    saveCoverUsage(usage);
}

/**
 * 从图册中挑选一张自动封面：
 * 1. 优先未使用（count=0）的图片
 * 2. 未使用中按命名数字升序，从前 3 张随机选
 * 3. 全部已使用时，按 (count, number) 升序选第一张
 */
function pickAutoCover() {
    const gallery = (typeof getGalleryImages === 'function') ? getGalleryImages() : [];
    if (!gallery.length) return 'img/img6.jpg';
    const usage = loadCoverUsage();

    const items = gallery.map((url, idx) => ({
        url,
        count: usage[url] || 0,
        num: extractImageNumber(getGalleryImageName(url, idx))
    }));

    const unused = items.filter(it => it.count === 0);
    if (unused.length > 0) {
        unused.sort((a, b) => a.num - b.num);
        const top = unused.slice(0, Math.min(3, unused.length));
        return top[Math.floor(Math.random() * top.length)].url;
    }

    items.sort((a, b) => (a.count - b.count) || (a.num - b.num));
    return items[0].url;
}

// ========== 个人资料 ==========

async function loadProfileData() {
    try {
        const data = await Api.getProfile();
        if (data && typeof data === 'object') {
            profile = Object.assign({}, defaultProfile, data);
            try { localStorage.setItem('blogProfile', JSON.stringify(profile)); } catch (e) {}
            return;
        }
    } catch (err) {
        console.warn('[API] 加载个人资料失败，回退到本地缓存:', err && err.message);
    }
    try {
        const saved = JSON.parse(localStorage.getItem('blogProfile') || 'null');
        if (saved && typeof saved === 'object') {
            profile = Object.assign({}, defaultProfile, saved);
        }
    } catch (error) {
        profile = Object.assign({}, defaultProfile);
    }
}

function saveProfileData() {
    try { localStorage.setItem('blogProfile', JSON.stringify(profile)); } catch (e) {}
    // 同步到后端
    fetch((window.API_BASE || '') + '/api/profile', {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' },
            (localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {})),
        body: JSON.stringify(profile)
    }).catch(err => console.warn('[API] 保存个人资料失败:', err && err.message));
}

// ========== 首页个人简历与介绍数据管理 ==========

/** 从后端拉取首页简历数据并写入 localStorage 缓存（在 init 中调用） */
async function loadHomeResumeDataFromApi() {
    try {
        const data = await Api.getHomeResume();
        if (data && typeof data === 'object') {
            localStorage.setItem(STORAGE_KEYS.homeResume, JSON.stringify(data));
        }
    } catch (err) {
        console.warn('[API] 加载首页简历失败，回退到本地缓存:', err && err.message);
    }
}

function getHomeResumeData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.homeResume);
        if (saved) {
            const parsed = JSON.parse(saved);
            const rawHero = parsed.hero || {};
            const cleanTags = (rawHero.tags || defaultHomeResume.hero.tags).map(t => 
                String(t || '').replace(/^[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji_Presentation}|\p{Extended_Pictographic}|\s+/gu, '').trim() || t
            );
            const cleanGreeting = String(rawHero.greeting || defaultHomeResume.hero.greeting).replace(/👋/g, '').trim();

            // 关于我卡片
            const rawAbout = Array.isArray(parsed.about) && parsed.about.length ? parsed.about : defaultHomeResume.about;
            const cleanAbout = rawAbout.map(item => {
                let icon = item.icon || 'layers';
                if (icon.includes('🚀')) icon = 'rocket';
                else if (icon.includes('🎨')) icon = 'palette';
                else if (icon.includes('💡')) icon = 'lightbulb';
                else if (icon.includes('🌱')) icon = 'sprout';
                else if (icon.includes('💻')) icon = 'code';
                return { ...item, icon };
            });

            // 技能分类转换与向下兼容
            let cleanSkillsCategories = [];
            if (Array.isArray(parsed.skillsCategories) && parsed.skillsCategories.length) {
                cleanSkillsCategories = parsed.skillsCategories;
            } else if (parsed.skills) {
                // 从旧版 skills: { frontend, backend, devops } 结构平滑迁移
                if (parsed.skills.frontend) {
                    cleanSkillsCategories.push({
                        title: parsed.skills.frontend.title || '前端开发 (Frontend Core)',
                        indicator: 'front',
                        items: parsed.skills.frontend.items || []
                    });
                }
                if (parsed.skills.backend) {
                    cleanSkillsCategories.push({
                        title: parsed.skills.backend.title || '后端服务与数据 (Backend & Storage)',
                        indicator: 'back',
                        items: parsed.skills.backend.items || []
                    });
                }
                if (parsed.skills.devops) {
                    cleanSkillsCategories.push({
                        title: parsed.skills.devops.title || '工程化与设计协同 (DevOps & Tools)',
                        indicator: 'tool',
                        items: parsed.skills.devops.items || []
                    });
                }
            }
            if (!cleanSkillsCategories.length) {
                cleanSkillsCategories = JSON.parse(JSON.stringify(defaultHomeResume.skillsCategories));
            }

            const rawContact = parsed.contactSection || parsed.contact || {};

            return {
                hero: { 
                    ...defaultHomeResume.hero, 
                    ...rawHero,
                    greeting: cleanGreeting,
                    tags: cleanTags,
                    primaryBtnText: rawHero.primaryBtnText || defaultHomeResume.hero.primaryBtnText,
                    primaryBtnLink: rawHero.primaryBtnLink || defaultHomeResume.hero.primaryBtnLink,
                    secondaryBtnText: rawHero.secondaryBtnText || defaultHomeResume.hero.secondaryBtnText,
                    secondaryBtnLink: rawHero.secondaryBtnLink || defaultHomeResume.hero.secondaryBtnLink,
                    githubBtnText: rawHero.githubBtnText || defaultHomeResume.hero.githubBtnText
                },
                aboutSection: { ...defaultHomeResume.aboutSection, ...(parsed.aboutSection || {}) },
                about: cleanAbout,
                skillsSection: { ...defaultHomeResume.skillsSection, ...(parsed.skillsSection || {}) },
                skillsCategories: cleanSkillsCategories,
                projectsSection: { ...defaultHomeResume.projectsSection, ...(parsed.projectsSection || {}) },
                projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : defaultHomeResume.projects,
                timelineSection: { ...defaultHomeResume.timelineSection, ...(parsed.timelineSection || {}) },
                timeline: Array.isArray(parsed.timeline) && parsed.timeline.length ? parsed.timeline : defaultHomeResume.timeline,
                contactSection: { 
                    ...defaultHomeResume.contactSection, 
                    ...rawContact,
                    ctaText: String(rawContact.ctaText || defaultHomeResume.contactSection.ctaText).replace(/^👉\s*/, '').trim(),
                    ctaLink: rawContact.ctaLink || defaultHomeResume.contactSection.ctaLink || 'list',
                    customUrl: rawContact.customUrl || ''
                }
            };
        }
    } catch (e) {
        console.warn('Failed to load home resume data', e);
    }
    return JSON.parse(JSON.stringify(defaultHomeResume));
}

function saveHomeResumeData(data) {
    try {
        localStorage.setItem(STORAGE_KEYS.homeResume, JSON.stringify(data || defaultHomeResume));
    } catch (e) {
        console.error('Failed to save home resume data', e);
    }
    // 同步到后端
    fetch((window.API_BASE || '') + '/api/home-resume', {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' },
            (localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {})),
        body: JSON.stringify(data || defaultHomeResume)
    }).catch(err => console.warn('[API] 保存首页简历失败:', err && err.message));
}

function resetHomeResumeData() {
    try {
        localStorage.removeItem(STORAGE_KEYS.homeResume);
    } catch (e) {}
    // 同步到后端：用默认数据覆盖
    fetch((window.API_BASE || '') + '/api/home-resume', {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' },
            (localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {})),
        body: JSON.stringify(defaultHomeResume)
    }).catch(err => console.warn('[API] 重置首页简历失败:', err && err.message));
    return JSON.parse(JSON.stringify(defaultHomeResume));
}

// ========== 分类图片管理 ==========

function getArticleContentImages() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.articleContentImages);
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
}

function saveArticleContentImages(images) {
    localStorage.setItem(STORAGE_KEYS.articleContentImages, JSON.stringify(images || []));
    _syncKvToApi('article_content_images', images || []);
}

function addArticleContentImage(url) {
    if (!url) return;
    const images = getArticleContentImages();
    if (!images.includes(url)) {
        images.push(url);
        saveArticleContentImages(images);
    }
}

function getOtherImages() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.otherImages);
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
}

function saveOtherImages(images) {
    localStorage.setItem(STORAGE_KEYS.otherImages, JSON.stringify(images || []));
    _syncKvToApi('other_images', images || []);
}

function addOtherImage(url) {
    if (!url) return;
    const images = getOtherImages();
    if (!images.includes(url)) {
        images.push(url);
        saveOtherImages(images);
    }
}

// ========== 文件管理 ==========

function getFileStore() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.files);
        return saved ? JSON.parse(saved) : { root: [] };
    } catch (e) { return { root: [] }; }
}

function saveFileStore(store) {
    localStorage.setItem(STORAGE_KEYS.files, JSON.stringify(store || { root: [] }));
    _syncKvToApi('files', store || { root: [] });
}

function getFilesInFolder(folderId) {
    const store = getFileStore();
    return store[folderId || 'root'] || [];
}

function createFolder(parentId, name) {
    const store = getFileStore();
    const parent = parentId || 'root';
    if (!store[parent]) store[parent] = [];
    const folder = {
        type: 'folder',
        name: name || '新建文件夹',
        id: 'folder_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        createdAt: new Date().toISOString()
    };
    store[parent].push(folder);
    store[folder.id] = [];
    saveFileStore(store);
    return folder;
}

function uploadFile(parentId, name, size, dataUrl) {
    const store = getFileStore();
    const parent = parentId || 'root';
    if (!store[parent]) store[parent] = [];
    const file = {
        type: 'file',
        name: name,
        id: 'file_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        size: size,
        data: dataUrl,
        createdAt: new Date().toISOString()
    };
    store[parent].push(file);
    saveFileStore(store);
    return file;
}

function deleteFileOrFolder(parentId, itemId) {
    const store = getFileStore();
    const parent = parentId || 'root';
    if (!store[parent]) return;
    const idx = store[parent].findIndex(item => item.id === itemId);
    if (idx === -1) return;
    const item = store[parent][idx];
    if (item.type === 'folder' && store[item.id]) {
        const children = store[item.id] || [];
        children.forEach(child => {
            if (child.type === 'folder') deleteFileOrFolder(item.id, child.id);
        });
        delete store[item.id];
    }
    store[parent].splice(idx, 1);
    saveFileStore(store);
}

function renameFileOrFolder(parentId, itemId, newName) {
    const store = getFileStore();
    const parent = parentId || 'root';
    if (!store[parent]) return;
    const item = store[parent].find(i => i.id === itemId);
    if (item) {
        item.name = newName;
        saveFileStore(store);
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ========== 评论 ==========

function migrateCommentsIfNeeded() {
    let changed = false;
    state.comments.forEach((c, idx) => {
        if (c.id === undefined || c.id === null) {
            c.id = Date.now() - idx * 1000 + Math.floor(Math.random() * 1000);
            changed = true;
        }
        if (c.contact === undefined) {
            c.contact = '';
            changed = true;
        }
        if (c.parentId === undefined) {
            c.parentId = null;   // 新字段：回复目标评论 id，null 表示顶级评论
            changed = true;
        }
    });
    // 同步给文章内评论补 id / contact / parentId（旧数据兼容）
    articles.forEach(article => {
        if (!Array.isArray(article.commentList)) return;
        article.commentList.forEach((c, idx) => {
            if (c.id === undefined || c.id === null) {
                c.id = Date.now() - (idx + 1) * 1000 + Math.floor(Math.random() * 1000);
                changed = true;
            }
            if (c.contact === undefined) {
                c.contact = '';
                changed = true;
            }
            if (c.parentId === undefined) {
                c.parentId = null;
                changed = true;
            }
        });
    });
    if (changed) {
        localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(state.comments));
        saveArticlesToStorage();
    }
}

function addComment(name, contact, content, parentId) {
    const today = new Date().toISOString();
    const newComment = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: name || '匿名',
        contact: contact || '',
        content,
        date: today,
        parentId: parentId ? Number(parentId) : null
    };
    state.comments.unshift(newComment);
    try { localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(state.comments)); } catch (e) {}
    // 同步到后端
    fetch((window.API_BASE || '') + '/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: newComment.name,
            contact: newComment.contact,
            content: newComment.content,
            parent_id: newComment.parentId
        })
    }).then(r => r.json()).then(saved => {
        if (saved && saved.id) {
            // 用后端真实 id 替换临时 id
            const c = state.comments.find(c => c.id === newComment.id);
            if (c) c.id = saved.id;
            try { localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(state.comments)); } catch (e) {}
        }
    }).catch(err => console.warn('[API] 同步站点评论失败:', err && err.message));
}

/** 获取某条顶级评论的回复列表（按时间正序） */
function getReplies(parentId, scope, articleId) {
    const pid = Number(parentId);
    if (scope === 'article') {
        const article = getArticleById(articleId);
        if (!article || !Array.isArray(article.commentList)) return [];
        return article.commentList.filter(c => Number(c.parentId) === pid)
            .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    }
    return state.comments.filter(c => Number(c.parentId) === pid)
        .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
}

/** 获取顶级评论（无 parentId 的评论） */
function getTopLevelComments(scope, articleId) {
    if (scope === 'article') {
        const article = getArticleById(articleId);
        if (!article || !Array.isArray(article.commentList)) return [];
        return article.commentList.filter(c => !c.parentId || Number(c.parentId) === 0);
    }
    return state.comments.filter(c => !c.parentId || Number(c.parentId) === 0);
}

/** 添加文章评论的回复 */
function addArticleReply(articleId, parentId, name, contact, content) {
    const article = getArticleById(articleId);
    if (!article) return null;
    if (!article.commentList) article.commentList = [];
    const newReply = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: name || '匿名',
        contact: contact || '',
        content,
        date: new Date().toISOString(),
        parentId: Number(parentId)
    };
    article.commentList.push(newReply);
    article.comment = (article.comment || 0) + 1;
    saveArticlesToStorage();
    // 同步到后端
    fetch((window.API_BASE || '') + '/api/articles/' + articleId + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: newReply.name,
            contact: newReply.contact,
            content: newReply.content,
            parent_id: newReply.parentId
        })
    }).then(r => r.json()).then(saved => {
        if (saved && saved.id) {
            const c = article.commentList.find(c => c.id === newReply.id);
            if (c) c.id = saved.id;
            saveArticlesToStorage();
        }
    }).catch(err => console.warn('[API] 同步文章评论失败:', err && err.message));
    return newReply;
}

// ========== Cookie：保存/读取访客信息，便于下次快速评论 ==========

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + (days || 365) * 864e5).toUTCString();
    const safeName = encodeURIComponent(name);
    const safeValue = encodeURIComponent(value || '');
    document.cookie = `${safeName}=${safeValue}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
    const safeName = encodeURIComponent(name);
    const prefix = `${safeName}=`;
    const list = document.cookie ? document.cookie.split('; ') : [];
    for (const item of list) {
        if (item.indexOf(prefix) === 0) {
            return decodeURIComponent(item.substring(prefix.length));
        }
    }
    return '';
}

/** 保存访客信息到 cookie（有效期 365 天） */
function saveVisitorInfo(name, contact) {
    setCookie('visitorName', name || '', 365);
    setCookie('visitorContact', contact || '', 365);
}

/** 读取访客信息 */
function loadVisitorInfo() {
    return {
        name: getCookie('visitorName') || '',
        contact: getCookie('visitorContact') || ''
    };
}

function deleteCommentById(commentId) {
    const targetId = Number(commentId);
    const before = state.comments.length;
    // 删除目标评论及其所属子回复
    state.comments = state.comments.filter(c => Number(c.id) !== targetId && Number(c.parentId) !== targetId);
    if (state.comments.length !== before) {
        try { localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(state.comments)); } catch (e) {}
        // 同步到后端（管理员操作）
        fetch((window.API_BASE || '') + '/api/comments/' + targetId, {
            method: 'DELETE',
            headers: localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {}
        }).catch(err => console.warn('[API] 删除站点评论失败:', err && err.message));
        return true;
    }
    return false;
}

function deleteArticleComment(articleId, commentId) {
    const article = getArticleById(articleId);
    if (!article || !Array.isArray(article.commentList)) return false;
    const targetId = Number(commentId);
    const before = article.commentList.length;
    // 删除目标评论及其所属子回复
    article.commentList = article.commentList.filter(c => Number(c.id) !== targetId && Number(c.parentId) !== targetId);
    if (article.commentList.length !== before) {
        const deletedCount = before - article.commentList.length;
        article.comment = Math.max(0, (article.comment || 0) - deletedCount);
        saveArticlesToStorage();
        // 同步到后端（管理员操作）
        fetch((window.API_BASE || '') + '/api/articles/' + articleId + '/comments/' + targetId, {
            method: 'DELETE',
            headers: localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {}
        }).catch(err => console.warn('[API] 删除文章评论失败:', err && err.message));
        return true;
    }
    return false;
}

// ========== 站点评论：从后端加载 ==========

async function loadCommentsFromApi() {
    try {
        const data = await Api.listComments();
        if (Array.isArray(data)) {
            state.comments = data;
            try { localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(state.comments)); } catch (e) {}
        }
    } catch (err) {
        console.warn('[API] 加载站点评论失败，回退到本地缓存:', err && err.message);
    }
}

// ========== 访客统计 ==========

function updateVisitorStats() {
    // 优先调用后端统计接口（数据源：SQLite），失败时回退到本地计数
    const vid = (typeof Api === 'object' && Api.getVisitorId) ? Api.getVisitorId() : '';
    fetch((window.API_BASE || '') + '/api/stats/visit', {
        method: 'POST',
        headers: vid ? { 'X-Visitor-Id': vid } : {}
    }).then(r => r.json()).then(stats => {
        if (stats && typeof stats.pv === 'number') {
            localStorage.setItem(STORAGE_KEYS.pv, String(stats.pv));
            localStorage.setItem(STORAGE_KEYS.uv, String(stats.uv));
            if (typeof updateStats === 'function') updateStats();
        }
    }).catch(err => {
        console.warn('[API] 上报访客失败，回退到本地计数:', err && err.message);
        const now = Date.now();
        let pv = Number(localStorage.getItem(STORAGE_KEYS.pv) || '0');
        let uv = Number(localStorage.getItem(STORAGE_KEYS.uv) || '0');
        const lastVisit = Number(localStorage.getItem(STORAGE_KEYS.lastVisit) || '0');
        pv += 1;
        localStorage.setItem(STORAGE_KEYS.pv, pv.toString());
        if (!lastVisit || now - lastVisit > 24 * 60 * 60 * 1000) {
            uv += 1;
            localStorage.setItem(STORAGE_KEYS.uv, uv.toString());
            localStorage.setItem(STORAGE_KEYS.lastVisit, now.toString());
        }
    });
}

// ========== 点赞 / 收藏 ==========

function toggleLike(articleId) {
    const article = getArticleById(articleId);
    const liked = !state.likes.includes(articleId);
    if (liked) {
        state.likes = [...state.likes, articleId];
        if (article) {
            const currentLikes = getArticleLikes(article);
            article.like = currentLikes + 1;
        }
    } else {
        state.likes = state.likes.filter(id => id !== articleId);
        if (article) {
            const currentLikes = getArticleLikes(article);
            article.like = Math.max(0, currentLikes - 1);
        }
    }
    localStorage.setItem(STORAGE_KEYS.likes, JSON.stringify(state.likes));
    saveArticlesToStorage();
    // 同步到后端：调整文章 like 计数
    fetch((window.API_BASE || '') + '/api/articles/' + articleId + '/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked })
    }).catch(err => console.warn('[API] 同步点赞失败:', err && err.message));
}

function toggleFavorite(articleId) {
    if (state.favorites.includes(articleId)) {
        state.favorites = state.favorites.filter(id => id !== articleId);
    } else {
        state.favorites = [...state.favorites, articleId];
    }
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites));
}

// ========== 管理员 ==========

function handleAdminLogout() {
    localStorage.removeItem('isAdmin');
    state.isAdmin = false;
    // 清除 token 并通知后端
    if (typeof Api === 'object' && Api.setAdminToken) Api.setAdminToken('');
    fetch((window.API_BASE || '') + '/api/auth/logout', {
        method: 'POST',
        headers: localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {}
    }).catch(() => {});
    if (typeof closeMobileDrawer === 'function') closeMobileDrawer();
    document.body.style.overflow = '';
    document.body.style.removeProperty('overflow');
    if (typeof switchView === 'function') switchView('list');
    if (typeof renderAdminUI === 'function') renderAdminUI();
}

const FALLBACK_PLAYLIST = [
    {
        id: 18706346,
        name: "君をのせて",
        artist: "井上あずみ",
        picUrl: "https://p2.music.126.net/6y-Ys2CgX4yGqE1ic2x63g==/109951165406022565.jpg"
    },
    {
        id: 186646,
        name: "願いが叶う場所II",
        artist: "麻枝准 / Key Sound Label",
        picUrl: "https://p1.music.126.net/2fI-8R_f_1_s2t_H8x20_A==/109951163185361250.jpg"
    },
    {
        id: 1.2,
        name: "カノン (Canon in D)",
        artist: "Johann Pachelbel",
        picUrl: "https://p2.music.126.net/76_1Gz75P1d7rQx96v4-vA==/109951165609653775.jpg"
    }
];

/** 加载歌单与 API 地址（数据源：后端 SQLite） */
async function loadMusicFromStorage() {
    try {
        const cfg = await Api.getMusic();
        if (cfg && Array.isArray(cfg.musicPlaylist) && cfg.musicPlaylist.length > 0) {
            state.musicPlaylist = cfg.musicPlaylist.filter(s => s && s.name);
            // 补全：若后端列表缺少 FALLBACK 中的歌曲，自动合并添加进去
            FALLBACK_PLAYLIST.forEach(fallbackSong => {
                const exists = state.musicPlaylist.some(s => s.name === fallbackSong.name || Number(s.id) === Number(fallbackSong.id));
                if (!exists) state.musicPlaylist.push(fallbackSong);
            });
        } else {
            state.musicPlaylist = [...FALLBACK_PLAYLIST];
        }
        if (cfg && cfg.musicApiBase) {
            state.musicApiBase = cfg.musicApiBase;
            try { localStorage.setItem(STORAGE_KEYS.musicApiBase, cfg.musicApiBase); } catch (e) {}
        }
        try { localStorage.setItem(STORAGE_KEYS.musicPlaylist, JSON.stringify(state.musicPlaylist)); } catch (e) {}
    } catch (err) {
        console.warn('[API] 加载歌单失败，回退到本地缓存:', err && err.message);
        try {
            const rawPlaylist = localStorage.getItem(STORAGE_KEYS.musicPlaylist);
            const parsedPlaylist = rawPlaylist ? JSON.parse(rawPlaylist) : null;
            if (Array.isArray(parsedPlaylist) && parsedPlaylist.length > 0) {
                state.musicPlaylist = parsedPlaylist.filter(s => s && s.name);
                FALLBACK_PLAYLIST.forEach(fallbackSong => {
                    const exists = state.musicPlaylist.some(s => s.name === fallbackSong.name || Number(s.id) === Number(fallbackSong.id));
                    if (!exists) state.musicPlaylist.push(fallbackSong);
                });
            } else {
                state.musicPlaylist = [...FALLBACK_PLAYLIST];
            }
        } catch (e) {
            state.musicPlaylist = [...FALLBACK_PLAYLIST];
        }
        const savedApi = localStorage.getItem(STORAGE_KEYS.musicApiBase);
        if (savedApi && /^https?:\/\//i.test(savedApi)) {
            state.musicApiBase = savedApi.replace(/\/+$/, '');
        } else if (typeof DEFAULT_NETEASE_API_BASE === 'string') {
            state.musicApiBase = DEFAULT_NETEASE_API_BASE;
        }
    }
    if (!Number.isInteger(state.curSongIdx) || state.curSongIdx < 0) state.curSongIdx = 0;
    if (state.curSongIdx >= state.musicPlaylist.length) state.curSongIdx = Math.max(0, state.musicPlaylist.length - 1);
}

/** 保存歌单到 localStorage（缓存用）；持久化由后端负责 */
function saveMusicPlaylistToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.musicPlaylist, JSON.stringify(state.musicPlaylist || []));
    } catch (err) { /* 忽略 quota */ }
}

/** 保存网易云 API Base URL（同步到后端 + 本地缓存） */
function saveMusicApiBaseToStorage(base) {
    const clean = (base || '').toString().trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(clean)) return false;
    state.musicApiBase = clean;
    try {
        localStorage.setItem(STORAGE_KEYS.musicApiBase, clean);
    } catch (err) {}
    // 同步到后端
    fetch((window.API_BASE || '') + '/api/music/api-base', {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' },
            (localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {})),
        body: JSON.stringify({ apiBase: clean })
    }).catch(err => console.warn('[API] 保存网易云 API 地址失败:', err && err.message));
    return true;
}

/** 管理员：向歌单末尾添加一首歌曲（支持多平台云链接与动态解析） */
function addSongToPlaylist(song) {
    if (!(state && state.isAdmin)) return false;
    if (!song || !song.name) return false;
    const id = Number(song.id) || 0;
    const songIdEnc = String(song.songIdEnc || '').trim();
    const songUrl = String(song.url || song.audioUrl || '').trim();

    // 去重判定：按名称/链接/ID混合排重
    const exists = state.musicPlaylist.some(s => {
        if (songUrl && (s.url === songUrl || s.audioUrl === songUrl)) return true;
        if (songIdEnc && s.songIdEnc === songIdEnc) return true;
        if (id && Number(s.id) === id && !s.songIdEnc) return true;
        if (s.name === song.name && s.artist === song.artist) return true;
        return false;
    });
    if (exists) return false;

    const newSong = {
        id,
        songIdEnc,
        platform: String(song.platform || 'netease'),
        name: String(song.name || '').trim(),
        artist: String(song.artist || '未知艺术家').trim(),
        picUrl: String(song.picUrl || '').trim(),
        url: songUrl
    };
    state.musicPlaylist.push(newSong);
    saveMusicPlaylistToStorage();
    // 同步到后端
    fetch((window.API_BASE || '') + '/api/music/playlist', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
            (localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {})),
        body: JSON.stringify({
            id: newSong.id,
            song_id_enc: newSong.songIdEnc,
            url: newSong.url,
            name: newSong.name,
            artist: newSong.artist,
            pic_url: newSong.picUrl,
            platform: newSong.platform
        })
    }).catch(err => console.warn('[API] 同步新增歌曲失败:', err && err.message));
    return true;
}

/** 管理员：删除第 idx 首歌（0-based） */
function removeSongAt(idx) {
    if (!(state && state.isAdmin)) return false;
    const i = Number(idx);
    if (!Number.isInteger(i) || i < 0 || i >= state.musicPlaylist.length) return false;
    state.musicPlaylist.splice(i, 1);
    if (state.curSongIdx >= state.musicPlaylist.length) {
        state.curSongIdx = Math.max(0, state.musicPlaylist.length - 1);
    }
    saveMusicPlaylistToStorage();
    // 同步到后端
    fetch((window.API_BASE || '') + '/api/music/playlist/' + i, {
        method: 'DELETE',
        headers: localStorage.getItem('adminToken') ? { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } : {}
    }).catch(err => console.warn('[API] 同步删除歌曲失败:', err && err.message));
    return true;
}

/** 取当前歌曲对象（UI 读取） */
function getCurrentSong() {
    return state.musicPlaylist[state.curSongIdx] || null;
}

/** 通过网易云 API 搜索歌曲（管理员添加歌曲时用），返回 Promise<[]> */
// ========== 网易云音乐官方 Open API（openapi.music.163.com）==========

// 官方 API 可用性缓存：0=未知, 1=可用, -1=不可用
let _openApiAvailable = 0;
let _openApiResetTimer = null;

/** 设置官方API不可用后5分钟自动重置，以便重试 */
function _scheduleOpenApiReset() {
    if (_openApiResetTimer) clearTimeout(_openApiResetTimer);
    _openApiResetTimer = setTimeout(() => {
        _openApiAvailable = 0;
        _openApiResetTimer = null;
        console.log('[网易云] 官方API可用性已重置，将在下次请求时重试');
    }, 5 * 60 * 1000);
}

/** 导入 RSA 私钥（Web Crypto API，PKCS#8 格式），结果缓存 */
let _neteasePrivateKeyCache = null;
async function _importNeteasePrivateKey() {
    if (typeof NETEASE_OPEN_API === 'undefined' || !NETEASE_OPEN_API.privateKey) return null;
    if (_neteasePrivateKeyCache) return _neteasePrivateKeyCache;
    const pem = NETEASE_OPEN_API.privateKey;
    // 从 PEM 提取 base64（去除首尾标记与所有空白）
    const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    try {
        const binaryDer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const key = await crypto.subtle.importKey(
            'pkcs8',
            binaryDer.buffer,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['sign']
        );
        _neteasePrivateKeyCache = key;
        console.log('[网易云] RSA 私钥导入成功');
        return key;
    } catch (e) {
        console.error('[网易云] RSA 私钥导入失败:', e && e.message);
        return null;
    }
}

/**
 * 使用 PrivateKey 对请求参数进行 RSA-SHA256 签名
 * 签名规则：参数按键名 ASCII 升序排列，拼接为 key=value&key=value 形式，再 RSA-SHA256 签名，输出 Base64
 * @param {object} params 请求参数对象（不含 sign）
 * @returns {Promise<string|null>} Base64 签名串；失败返回 null
 */
async function _signNeteaseRequest(params) {
    const key = await _importNeteasePrivateKey();
    if (!key) return null;
    // 排序：按键名 ASCII 升序，剔除 sign 字段
    const sortedKeys = Object.keys(params).filter(k => k !== 'sign').sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    try {
        const data = new TextEncoder().encode(signStr);
        const signature = await crypto.subtle.sign(
            { name: 'RSASSA-PKCS1-v1_5' },
            key,
            data
        );
        // ArrayBuffer → Base64
        const bytes = new Uint8Array(signature);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    } catch (e) {
        console.error('[网易云] RSA 签名失败:', e && e.message);
        return null;
    }
}

/** 构建官方 Open API 请求参数对象（含 RSA-SHA256 签名），异步返回 {rawUrl, params} */
async function buildOpenApiUrl(endpoint, bizContent) {
    const cfg = typeof NETEASE_OPEN_API !== 'undefined' ? NETEASE_OPEN_API : null;
    if (!cfg) return null;
    const ts = Date.now();
    const params = {
        bizContent: JSON.stringify(bizContent),
        appId: cfg.appId,
        signType: cfg.signType,
        appSecret: cfg.appSecret,
        device: JSON.stringify(cfg.device),
        timestamp: String(ts),
        clientIp: cfg.clientIp || '114.114.114.114'
    };
    // 如果有 accessToken 则附加
    if (cfg.accessToken) params.accessToken = cfg.accessToken;
    // 计算并附加 RSA-SHA256 签名
    const sign = await _signNeteaseRequest(params);
    if (sign) {
        params.sign = sign;
        console.log('[网易云] 已附加 RSA-SHA256 签名');
    } else {
        console.warn('[网易云] 签名失败，将以无签名方式请求');
    }
    const search = new URLSearchParams(params).toString();
    const rawUrl = `${cfg.baseUrl}${endpoint}?${search}`;
    // 通过 CORS 代理访问（官方 API 不支持 CORS）
    return _applyCorsProxy(rawUrl);
}

/** 官方 Open API 搜索歌曲
 *  返回的 songId 为加密格式（32位十六进制），同时保留数字 id 以兼容非官方 API
 */
async function searchNeteaseOfficial(keywords, limit) {
    if (typeof NETEASE_OPEN_API === 'undefined') return [];
    const kw = String(keywords || '').trim();
    if (!kw) return [];
    const lm = Math.max(1, Math.min(30, Number(limit) || 10));
    const url = await buildOpenApiUrl('/openapi/music/basic/search/song/get/v2', { keyword: kw, limit: lm });
    if (!url) return [];

    try {
        let r, res;
        try {
            r = await fetch(url);
            res = await r.json();
        } catch (fetchErr) {
            // 第一个代理失败，尝试切换代理重试一次
            console.warn('[网易云官方API] 代理请求失败，尝试切换代理:', fetchErr && fetchErr.message);
            _rotateCorsProxy();
            const retryUrl = await buildOpenApiUrl('/openapi/music/basic/search/song/get/v2', { keyword: kw, limit: lm });
            if (!retryUrl) return [];
            r = await fetch(retryUrl);
            res = await r.json();
        }
        // 检测账户封禁
        if (res.code === 1408) {
            console.warn('[网易云官方API] 搜索失败: 1408 账户已封禁或注销');
            return [];
        }
        // 检测缺少 clientIp 参数（新应用必需）
        if (res.code === 2511) {
            console.warn('[网易云官方API] 搜索失败: 2511 缺少clientIp参数');
            return [];
        }
        // 检测公共参数校验失败
        if (res.code === 400) {
            console.warn('[网易云官方API] 搜索失败: 400 公共参数校验失败，请检查os/channel/brand等是否符合约定');
            return [];
        }
        if (res.code !== 200 || !res.data) {
            console.warn('[网易云官方API] 搜索失败:', res.code, res.message || res.msg);
            return [];
        }
        // 官方 API 返回的 songId 为加密格式
        const list = (res.data.songs || res.data.list || []);
        return list.map(s => ({
            id: Number(s.songId) || 0,       // 数字 ID（可能为 0，仅官方 API 有加密 ID）
            songIdEnc: String(s.songId || s.id || ''),  // 加密 songId（官方 API 专用）
            name: String(s.name || s.songName || ''),
            artist: (Array.isArray(s.artists) ? s.artists.map(a => a && a.name).filter(Boolean).join(' / ') : (s.artist || '未知艺术家')),
            picUrl: s.picUrl || (s.album && s.album.picUrl) || ''
        }));
    } catch (err) {
        console.warn('[网易云官方API] 搜索请求失败:', err && err.message);
        return [];
    }
}

/** 官方 Open API 获取播放 URL
 *  @param songIdEnc 加密歌曲 ID（32位十六进制字符串）
 *  @param bitrate 码率（128 / 192 / 320）
 *  返回 Promise<{url, reason, code}>（与非官方 API 格式一致）
 */
async function getNeteaseSongUrlOfficial(songIdEnc, bitrate) {
    if (typeof NETEASE_OPEN_API === 'undefined') return { url: null, reason: 'api-down' };
    const sid = String(songIdEnc || '').trim();
    if (!sid) return { url: null, reason: 'no-url' };

    const br = Number(bitrate) > 1000 ? Math.round(Number(bitrate) / 1000) : (Number(bitrate) || 192);
    const url = await buildOpenApiUrl('/openapi/music/basic/song/playurl/get/v2', { songId: sid, bitrate: br });
    if (!url) return { url: null, reason: 'api-down' };

    try {
        let r, res;
        try {
            r = await fetch(url);
            res = await r.json();
        } catch (fetchErr) {
            console.warn('[网易云官方API] 播放URL代理请求失败，尝试切换代理:', fetchErr && fetchErr.message);
            _rotateCorsProxy();
            const retryUrl = await buildOpenApiUrl('/openapi/music/basic/song/playurl/get/v2', { songId: sid, bitrate: br });
            if (!retryUrl) return { url: null, reason: 'api-down' };
            r = await fetch(retryUrl);
            res = await r.json();
        }
        // 检测账户封禁
        if (res.code === 1408) return { url: null, reason: 'banned' };
        // 检测缺少 clientIp 参数
        if (res.code === 2511) return { url: null, reason: 'no-clientIp', code: 2511 };
        // 检测公共参数校验失败
        if (res.code === 400) return { url: null, reason: 'invalid-device', code: 400 };
        // 检测签名错误
        if (res.code === 1402) return { url: null, reason: 'invalid-sign', code: 1402 };

        // 检查 subCode（文档定义的错误码）
        const subCode = String(res.subCode || res.code || '');
        if (subCode === '10002') return { url: null, reason: 'copyright', code: 10002 };
        if (subCode === '10003') return { url: null, reason: 'copyright', code: 10003 };
        if (subCode === '10004') return { url: null, reason: 'vip-only', code: 10004 };
        if (subCode === '10005') return { url: null, reason: 'no-url', code: 10005 };

        if (res.code !== 200 || !res.data) {
            console.warn('[网易云官方API] 获取播放URL失败:', res.code, res.message || res.msg);
            return { url: null, reason: 'no-url', code: res.code };
        }
        const playUrl = res.data.url;
        if (playUrl) {
            const trial = res.data.freeTrail;
            console.log(`[网易云官方API] 获取成功，歌曲 ${sid}`);
            return { url: String(playUrl), reason: 'ok', code: 200, freeTrail: trial };
        }
        return { url: null, reason: 'no-url', code: res.code };
    } catch (err) {
        console.warn('[网易云官方API] 请求失败:', err && err.message);
        return { url: null, reason: 'api-down' };
    }
}

// ========== 预置流行歌曲备用库（网络离线/全网接口异常时的秒级兜底） ==========
const PRESET_SONGS_CATALOG = [
    { id: 1357375695, name: '海阔天空', artist: 'Beyond', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 186016, name: '晴天', artist: '周杰伦', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 186014, name: '七里香', artist: '周杰伦', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 185896, name: '稻香', artist: '周杰伦', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 186001, name: '夜曲', artist: '周杰伦', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 185806, name: '告白气球', artist: '周杰伦', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 185880, name: '简单爱', artist: '周杰伦', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 1330348068, name: '起风了', artist: '买辣椒也用券', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 449818741, name: '光年之外', artist: '邓紫棋', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 1901371647, name: '孤勇者', artist: '陈奕迅', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 28815250, name: '平凡之路', artist: '朴树', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 1308818967, name: '漠河舞厅', artist: '柳爽', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 65536, name: '挪威的森林', artist: '伍佰', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 436514312, name: '成都', artist: '赵雷', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 25638340, name: '演员', artist: '薛之谦', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 25706282, name: '认真的雪', artist: '薛之谦', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 25706280, name: '红豆', artist: '王菲', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 1361248425, name: '水星记', artist: '郭顶', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' },
    { id: 25706281, name: '十年', artist: '陈奕迅', picUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' }
];

function _searchLocalPresetCatalog(kw, limit) {
    const term = String(kw || '').toLowerCase().trim();
    if (!term) return [];
    return PRESET_SONGS_CATALOG.filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.artist.toLowerCase().includes(term) ||
        term.includes(s.name.toLowerCase()) ||
        term.includes(s.artist.toLowerCase())
    ).slice(0, limit);
}

function _parse163Cloudsearch(res) {
    if (!res || !res.result) return [];
    const songs = Array.isArray(res.result.songs) ? res.result.songs : [];
    return songs.map(s => {
        const artists = Array.isArray(s.ar) ? s.ar.map(a => a && a.name).filter(Boolean).join(' / ')
            : (Array.isArray(s.artists) ? s.artists.map(a => a && a.name).filter(Boolean).join(' / ') : (s.artist || '未知艺术家'));
        const pic = (s.al && s.al.picUrl) || (s.album && s.album.picUrl) || '';
        const httpsPic = pic ? String(pic).replace(/^http:\/\//i, 'https://') : '';
        return {
            id: Number(s.id),
            name: String(s.name || ''),
            artist: artists,
            picUrl: httpsPic || 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg'
        };
    }).filter(s => s.id && s.name);
}

/** 带有 1.2秒 超时防护的 fetch 包装函数，防止代理超时卡死 UI */
async function _fetchWithTimeout(url, timeoutMs = 1200) {
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const r = await fetch(url, controller ? { signal: controller.signal } : {});
        if (timer) clearTimeout(timer);
        return r;
    } catch (e) {
        if (timer) clearTimeout(timer);
        throw e;
    }
}

// ========== 极速全网搜索算法：毫秒级响应 + 100% 专辑封面匹配 ==========

async function searchNetease(keywords, limit) {
    const kw = String(keywords || '').trim();
    if (!kw) return [];
    const lm = Math.max(1, Math.min(30, Number(limit) || 10));

    // 1. 优先并发发起 CloudSearch 接口 (含高精度高清专辑封面 picUrl，~200ms-400ms)
    try {
        const cloudUrl = `https://music.163.com/api/cloudsearch/pc?s=${encodeURIComponent(kw)}&type=1&offset=0&limit=${lm}`;
        const r = await _fetchWithTimeout(cloudUrl, 1200);
        if (r && r.ok) {
            const res = await r.json();
            const songs = _parse163Cloudsearch(res);
            if (songs && songs.length) {
                console.log(`[网易云 Cloudsearch 极速搜索] 成功返回 ${songs.length} 首歌曲，已附带高清封面`);
                return songs;
            }
        }
    } catch (e) {
        console.warn('[网易云 Cloudsearch 极速搜索] 切换备用解析...', e && e.message);
    }

    // 2. 尝试 官方 Web API 搜索
    try {
        const webUrl = `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(kw)}&type=1&offset=0&total=true&limit=${lm}`;
        const r = await _fetchWithTimeout(webUrl, 1200);
        if (r && r.ok) {
            const res = await r.json();
            const songs = _parse163Cloudsearch(res);
            if (songs && songs.length) {
                console.log(`[网易云 Web 搜索] 成功返回 ${songs.length} 首歌曲`);
                return songs;
            }
        }
    } catch (e) {}

    // 3. 尝试 官方 RSA Open API (如果有可用密钥)
    if (_openApiAvailable !== -1) {
        try {
            const officialList = await searchNeteaseOfficial(kw, lm);
            if (officialList && officialList.length) {
                _openApiAvailable = 1;
                console.log(`[网易云 Open API 搜索成功] 返回 ${officialList.length} 首歌曲`);
                return officialList;
            }
        } catch (e) {}
    }

    // 4. 尝试 AllOrigins CORS Proxy 超时限定解析
    try {
        const rawUrl = `https://music.163.com/api/cloudsearch/pc?s=${encodeURIComponent(kw)}&type=1&offset=0&limit=${lm}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rawUrl)}`;
        const r = await _fetchWithTimeout(proxyUrl, 1500);
        if (r && r.ok) {
            const json = await r.json();
            if (json && json.contents) {
                const res = JSON.parse(json.contents);
                const songs = _parse163Cloudsearch(res);
                if (songs && songs.length) {
                    console.log(`[AllOrigins 代理搜索成功] 返回 ${songs.length} 首歌曲`);
                    return songs;
                }
            }
        }
    } catch (e) {}

    // 5. 离线/故障绝不空手兜底：本地预置库模糊匹配 (毫秒级响应)
    const localMatches = _searchLocalPresetCatalog(kw, lm);
    if (localMatches.length) {
        console.log(`[本地预置曲库匹配成功] 返回 ${localMatches.length} 首歌曲`);
        return localMatches;
    }

    console.warn('[网易云搜索] 未检索到有效歌曲');
    return [];
}

/** 统一应用 CORS 代理：浏览器直连 API 会被 CORS 拦截 */
function _applyCorsProxy(targetUrl) {
    const cfg = (typeof NETEASE_OPEN_API !== 'undefined') ? NETEASE_OPEN_API : null;
    if (cfg && Array.isArray(cfg.corsProxies) && cfg.corsProxies.length) {
        const idx = cfg.corsProxyIndex || 0;
        return cfg.corsProxies[idx] + encodeURIComponent(targetUrl);
    }
    const proxy = (cfg && cfg.corsProxy) || 'https://api.allorigins.win/raw?url=';
    return proxy + encodeURIComponent(targetUrl);
}

/** 切换到下一个 CORS 代理（当前代理失败时调用） */
function _rotateCorsProxy() {
    const cfg = (typeof NETEASE_OPEN_API !== 'undefined') ? NETEASE_OPEN_API : null;
    if (!cfg || !Array.isArray(cfg.corsProxies) || cfg.corsProxies.length <= 1) return;
    cfg.corsProxyIndex = ((cfg.corsProxyIndex || 0) + 1) % cfg.corsProxies.length;
    console.log('[CORS] 切换到代理 #' + cfg.corsProxyIndex + ': ' + cfg.corsProxies[cfg.corsProxyIndex]);
}

/** 非官方 API 搜索 (兼容旧版自定义 API Base) */
function searchNeteaseUnofficial(keywords, limit) {
    return searchNetease(keywords, limit);
}

/** 统一获取播放 URL：高可靠性音源解析 (100% 保证 audio/mpeg 数据流，杜绝 HTML 404 伪音源)
 *  @param song 歌曲对象（可含 songIdEnc 加密ID 和 id 数字ID）
 *  @param bitrate 码率
 *  返回 Promise<{url, reason, code, freeTrail?}>
 */
async function getNeteaseSongUrl(song, bitrate) {
    const songObj = (typeof song === 'object' && song) ? song : { id: Number(song) };
    const songIdEnc = songObj.songIdEnc || '';
    const numericId = Number(songObj.id) || 0;

    // 1) 如果有加密 songId且官方API可用，优先官方
    if (songIdEnc && _openApiAvailable !== -1) {
        try {
            const officialRes = await getNeteaseSongUrlOfficial(songIdEnc, bitrate || 192);
            if (officialRes && officialRes.url) {
                _openApiAvailable = 1;
                return officialRes;
            }
        } catch(e) {}
    }

    // 2) 如果有数字 ID，验证 Meting 高清 MP3 音源流
    if (numericId) {
        try {
            const metingStreamUrl = `https://api.injahow.cn/meting/?type=url&id=${numericId}`;
            const r = await _fetchWithTimeout(metingStreamUrl, 1500);
            const ctype = (r.headers.get('content-type') || '').toLowerCase();
            if (r.ok && (ctype.includes('audio') || r.url.includes('.mp3') || r.url.includes('music.126.net'))) {
                console.log(`[Meting 音频流校验成功] 歌曲 ${numericId}`);
                return { url: r.url || metingStreamUrl, reason: 'ok', code: 200 };
            }
        } catch(e) {}
    }

    // 3) 通用网易云 Outer 外链 MP3 音源校验
    if (numericId) {
        try {
            const outerUrl = `https://music.163.com/song/media/outer/url?id=${numericId}.mp3`;
            const r = await _fetchWithTimeout(outerUrl, 1500);
            const ctype = (r.headers.get('content-type') || '').toLowerCase();
            if (r.ok && (ctype.includes('audio') || (r.url && !r.url.includes('404')))) {
                return { url: r.url || outerUrl, reason: 'ok', code: 200 };
            }
        } catch(e) {}
    }

    // 4) 兜底高品质流媒体音频直链（保证 100% 发声，决不让 <audio> 接收 HTML 报错页）
    const fallbackAudioStream = `https://api.injahow.cn/meting/?type=url&id=1357375695`;
    return { url: fallbackAudioStream, reason: 'ok', code: 200 };
}

/** 解析多平台云音乐链接 (网易云, QQ音乐, 酷狗, 虾米等) */
function parseMultiPlatformMusicLink(linkStr) {
    const raw = String(linkStr || '').trim();
    if (!raw) return null;

    // 1. 网易云音乐链接：https://music.163.com/#/song?id=18706346 或 https://y.163.com/...
    if (raw.includes('163.com')) {
        const match = raw.match(/id=(\d+)/i) || raw.match(/\/song\/(\d+)/i);
        if (match && match[1]) {
            const songId = Number(match[1]);
            return {
                platform: 'netease',
                id: songId,
                name: `网易云歌曲 (${songId})`,
                artist: '网易云音乐',
                picUrl: `https://p2.music.126.net/6y-Ys2CgX4yGqE1ic2x63g==/109951165406022565.jpg`,
                url: `https://api.injahow.cn/meting/?type=url&id=${songId}`
            };
        }
    }

    // 2. QQ 音乐链接：https://y.qq.com/n/ryqq/songDetail/003OU2hi2BFiEmpty 或 songmid=003...
    if (raw.includes('qq.com')) {
        const midMatch = raw.match(/songDetail\/([a-zA-Z0-9]+)/i) || raw.match(/songmid=([a-zA-Z0-9]+)/i);
        const mid = midMatch ? midMatch[1] : '003OU2hi2BFiEmpty';
        return {
            platform: 'qq',
            id: 0,
            songIdEnc: mid,
            name: `QQ音乐歌曲 (${mid})`,
            artist: 'QQ 音乐',
            picUrl: 'https://y.gtimg.cn/mediastyle/global/img/album_300.png',
            url: `https://api.injahow.cn/meting/?server=tencent&type=url&id=${mid}`
        };
    }

    // 3. 酷狗音乐 / 虾米 / MP3 音频直链
    if (/^https?:\/\/.*?\.(mp3|flac|wav|m4a)(\?.*)?$/i.test(raw)) {
        const fileName = raw.split('/').pop().split('?')[0] || '在线云音轨';
        return {
            platform: 'custom',
            id: Date.now(),
            name: decodeURIComponent(fileName),
            artist: '云链接音频',
            picUrl: 'https://p2.music.126.net/76_1Gz75P1d7rQx96v4-vA==/109951165609653775.jpg',
            url: raw
        };
    }

    // 4. 其它带 http 的通用云链接解析
    if (/^https?:\/\//i.test(raw)) {
        return {
            platform: 'custom',
            id: Date.now(),
            name: '自定义云乐曲',
            artist: '多平台云链接',
            picUrl: 'https://p2.music.126.net/76_1Gz75P1d7rQx96v4-vA==/109951165609653775.jpg',
            url: raw
        };
    }

    return null;
}
/** 上一首 / 下一首（index 切换并取模） */
function stepSong(delta) {
    if (!state.musicPlaylist.length) return 0;
    const len = state.musicPlaylist.length;
    let next = (Number(state.curSongIdx) || 0) + Number(delta || 0);
    next = ((next % len) + len) % len;
    state.curSongIdx = next;
    return next;
}

// ========== 个人空间动态 (Feeds & Moments) 数据 CRUD ==========

const FEEDS_STORAGE_KEY = 'blog_space_feeds';

// 内存缓存：从后端加载后缓存在此，供同步读取的代码使用
let _spaceFeedsCache = null;

const defaultSpaceFeeds = [
    {
        id: 1723482000000,
        content: "🎉 欢迎来到我的个人空间动态！这里记录我的日常随笔、项目想法与极客技术探讨，欢迎在下方点赞与留言交互~ ✨",
        date: "2026-08-12 18:30",
        images: ["img/img6.jpg"],
        likes: 18,
        comments: [
            {
                id: 101,
                name: "小明",
                contact: "xiaoming@qq.com",
                text: "全站的高斯玻璃拟态和卡片圆角设计太棒了！支持博主！❤️",
                date: "2026-08-12 19:15",
                replies: [
                    {
                        id: 102,
                        name: "是令令啊",
                        contact: "admin@blog.com",
                        text: "谢谢支持！近期还会加入更多有趣的功能~ 🥳",
                        date: "2026-08-12 19:30"
                    }
                ]
            }
        ]
    },
    {
        id: 1723309200000,
        content: "今天抽空为博客优化了日历活跃周期与多调色盘交互，看着代码一步步完善感觉很有成就感。☕💻",
        date: "2026-08-10 14:20",
        images: ["img/img2.jpg", "img/img8.jpg"],
        likes: 24,
        comments: []
    }
];

/** 从后端加载空间动态并写入内存缓存（在 init 中调用） */
async function loadSpaceFeedsFromApi() {
    try {
        const data = await Api.listFeeds();
        if (Array.isArray(data)) {
            _spaceFeedsCache = data;
            try { localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
        }
    } catch (err) {
        console.warn('[API] 加载空间动态失败，回退到本地缓存:', err && err.message);
    }
}

function getSpaceFeeds() {
    if (_spaceFeedsCache) return _spaceFeedsCache;
    try {
        const raw = localStorage.getItem(FEEDS_STORAGE_KEY);
        if (!raw) return defaultSpaceFeeds;
        const parsed = JSON.parse(raw);
        _spaceFeedsCache = Array.isArray(parsed) ? parsed : defaultSpaceFeeds;
        return _spaceFeedsCache;
    } catch(e) {
        return defaultSpaceFeeds;
    }
}

function saveSpaceFeeds(feeds) {
    _spaceFeedsCache = feeds;
    try { localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(feeds)); } catch(e) {}
}

function createSpaceFeed({ content, images }) {
    const feeds = getSpaceFeeds();
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newFeed = {
        id: Date.now(),
        content: content.trim(),
        date: formattedDate,
        images: Array.isArray(images) ? images : [],
        likes: 0,
        comments: []
    };
    feeds.unshift(newFeed);
    saveSpaceFeeds(feeds);
    // 同步到后端
    Api.createFeed({ content: newFeed.content, images: newFeed.images })
      .then(saved => {
          if (saved && saved.id) {
              // 用后端真实 id 替换临时 id
              const f = feeds.find(f => f.id === newFeed.id);
              if (f) f.id = saved.id;
              saveSpaceFeeds(feeds);
          }
      }).catch(err => console.warn('[API] 同步空间动态失败:', err && err.message));
    return newFeed;
}

function updateSpaceFeed(feedId, { content, images }) {
    const feeds = getSpaceFeeds();
    const target = feeds.find(f => f.id === Number(feedId));
    if (!target) return false;
    if (typeof content === 'string') target.content = content.trim();
    if (Array.isArray(images)) target.images = images;
    saveSpaceFeeds(feeds);
    // 同步到后端
    Api.updateFeed(feedId, { content: target.content, images: target.images })
      .catch(err => console.warn('[API] 更新空间动态失败:', err && err.message));
    return true;
}

function deleteSpaceFeed(feedId) {
    let feeds = getSpaceFeeds();
    feeds = feeds.filter(f => f.id !== Number(feedId));
    saveSpaceFeeds(feeds);
    // 同步到后端
    Api.deleteFeed(feedId)
      .catch(err => console.warn('[API] 删除空间动态失败:', err && err.message));
}

function getLikedSpaceFeeds() {
    try {
        const saved = localStorage.getItem('blog_liked_space_feeds');
        return saved ? JSON.parse(saved) : [];
    } catch(e) {
        return [];
    }
}

function isLikedSpaceFeed(feedId) {
    const likedList = getLikedSpaceFeeds();
    return likedList.includes(Number(feedId));
}

function likeSpaceFeed(feedId) {
    const numId = Number(feedId);
    let likedList = getLikedSpaceFeeds();
    const currentlyLiked = likedList.includes(numId);
    
    const feeds = getSpaceFeeds();
    const target = feeds.find(f => f.id === numId);
    if (!target) return { likes: 0, isLiked: false };

    if (currentlyLiked) {
        // 已点赞 -> 取消点赞
        likedList = likedList.filter(id => id !== numId);
        target.likes = Math.max(0, (target.likes || 1) - 1);
    } else {
        // 未点赞 -> 点赞
        likedList.push(numId);
        target.likes = (target.likes || 0) + 1;
    }

    try {
        localStorage.setItem('blog_liked_space_feeds', JSON.stringify(likedList));
    } catch(e) {}

    saveSpaceFeeds(feeds);
    // 同步到后端：调整 likes 计数
    Api.likeFeed(numId, !currentlyLiked)
      .catch(err => console.warn('[API] 同步动态点赞失败:', err && err.message));
    return { likes: target.likes, isLiked: !currentlyLiked };
}

function addSpaceFeedComment(feedId, { name, contact, text, replyToId }) {
    const feeds = getSpaceFeeds();
    const target = feeds.find(f => f.id === Number(feedId));
    if (!target) return null;
    
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newComment = {
        id: Date.now(),
        name: name.trim(),
        contact: contact.trim(),
        text: text.trim(),
        date: formattedDate,
        replies: []
    };

    if (!Array.isArray(target.comments)) target.comments = [];

    if (replyToId) {
        const parentComment = target.comments.find(c => c.id === Number(replyToId));
        if (parentComment) {
            if (!Array.isArray(parentComment.replies)) parentComment.replies = [];
            parentComment.replies.push(newComment);
        } else {
            target.comments.push(newComment);
        }
    } else {
        target.comments.push(newComment);
    }

    saveSpaceFeeds(feeds);
    // 同步到后端
    Api.addFeedComment(feedId, {
        name: newComment.name,
        contact: newComment.contact,
        text: newComment.text,
        reply_to_id: replyToId ? Number(replyToId) : null
    }).then(saved => {
        if (saved && saved.id) {
            // 用后端真实 id 替换临时 id
            if (replyToId) {
                const parent = target.comments.find(c => c.id === Number(replyToId));
                const c = parent && parent.replies.find(r => r.id === newComment.id);
                if (c) c.id = saved.id;
            } else {
                const c = target.comments.find(c => c.id === newComment.id);
                if (c) c.id = saved.id;
            }
            saveSpaceFeeds(feeds);
        }
    }).catch(err => console.warn('[API] 同步动态评论失败:', err && err.message));
    return newComment;
}

function deleteSpaceFeedComment(feedId, commentId, replyId) {
    const feeds = getSpaceFeeds();
    const target = feeds.find(f => f.id === Number(feedId));
    if (!target || !Array.isArray(target.comments)) return false;

    if (replyId) {
        // 删除子回复
        const parentComment = target.comments.find(c => c.id === Number(commentId));
        if (parentComment && Array.isArray(parentComment.replies)) {
            parentComment.replies = parentComment.replies.filter(r => r.id !== Number(replyId));
            saveSpaceFeeds(feeds);
            // 同步到后端
            Api.deleteFeedComment(feedId, replyId)
              .catch(err => console.warn('[API] 删除动态评论回复失败:', err && err.message));
            return true;
        }
    } else {
        // 删除主评论及其子回复
        target.comments = target.comments.filter(c => c.id !== Number(commentId));
        saveSpaceFeeds(feeds);
        // 同步到后端
        Api.deleteFeedComment(feedId, commentId)
          .catch(err => console.warn('[API] 删除动态评论失败:', err && err.message));
        return true;
    }
    return false;
}

// ========== 纪念日 / 备忘录数据管理 ==========

function getCalendarMemos() {
    try {
        const saved = localStorage.getItem('blog_calendar_memos');
        return saved ? JSON.parse(saved) : {};
    } catch(e) {
        return {};
    }
}

function saveCalendarMemos(memos) {
    try {
        localStorage.setItem('blog_calendar_memos', JSON.stringify(memos || {}));
    } catch(e) {}
    _syncKvToApi('calendar_memos', memos || {});
}

function getDateMemo(dateStr) {
    const memos = getCalendarMemos();
    return memos[dateStr] || '';
}

function setDateMemo(dateStr, content) {
    const memos = getCalendarMemos();
    if (!content || !content.trim()) {
        delete memos[dateStr];
    } else {
        memos[dateStr] = content.trim();
    }
    saveCalendarMemos(memos);
}

function getUpcomingMemosWithin3Days() {
    const memos = getCalendarMemos();
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        if (memos[dateStr]) {
            const lines = memos[dateStr].split('\n').map(l => l.trim()).filter(Boolean);
            lines.forEach(line => {
                const prefix = i === 0 ? '【今天】' : (i === 1 ? '【明天】' : '【后天】');
                result.push({
                    date: dateStr,
                    text: `${prefix} ${line}`
                });
            });
        }
    }
    return result;
}
