/**
 * render.js - 渲染层：所有 DOM 渲染函数
 */

// ========== 个人资料 ==========

function renderProfile() {
    const nameEl = document.getElementById('profileName');
    const bioEl = document.getElementById('profileBio');
    const avatarEl = document.getElementById('profileAvatar');
    if (nameEl) nameEl.textContent = profile.name;
    if (bioEl) bioEl.textContent = profile.bio;
    if (avatarEl) {
        avatarEl.src = profile.avatar || defaultProfile.avatar;
        avatarEl.alt = profile.name + ' 头像';
    }

    // 左侧栏签名下方渲染社交/联系方式（逐行独占一行显示）
    const leftSocialList = document.getElementById('leftProfileSocialList');
    if (leftSocialList) {
        const socials = getProfileSocials();
        leftSocialList.innerHTML = socials.map(item => {
            const val = item.value || '';
            const isUrl = /^https?:\/\//i.test(val);
            const valHtml = isUrl 
                ? `<a href="${val}" target="_blank" rel="noopener" style="color:#2563eb;">${val}</a>`
                : `<span>${val}</span>`;
            return `<p class="social-line" style="margin:2px 0; font-size:13px;"><strong>${item.label}：</strong>${valHtml}</p>`;
        }).join('');
    }
}

function getProfileSocials() {
    if (Array.isArray(profile.socials) && profile.socials.length > 0) {
        return profile.socials;
    }
    const list = [];
    if (profile.qq) list.push({ label: 'QQ', value: profile.qq });
    else list.push({ label: 'QQ', value: '123456789' });

    if (profile.wechat) list.push({ label: '微信', value: profile.wechat });
    else list.push({ label: '微信', value: 'lingling_blog' });

    if (profile.github) list.push({ label: 'GitHub', value: profile.github });
    else list.push({ label: 'GitHub', value: 'https://github.com' });

    return list;
}

// ========== 管理员 UI ==========

function renderAdminUI() {
    const addBtn = document.getElementById('adminAddBtn');
    const homeAddBtn = document.getElementById('homeAddArticleBtn');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    const editBtn = document.getElementById('editProfileBtn');
    const sidebarEditBloggerBtn = document.getElementById('sidebarEditBloggerBtn');
    const sidebarManageTagsBtn = document.getElementById('sidebarManageTagsBtn');
    const inlineAddCategoryBtn = document.getElementById('inlineAddCategoryBtn');

    const isAdm = !!(state && state.isAdmin);
    const displayVal = isAdm ? 'inline-flex' : 'none';
    if (addBtn) addBtn.style.display = displayVal;
    if (homeAddBtn) homeAddBtn.style.display = displayVal;
    if (logoutBtn) logoutBtn.style.display = displayVal;
    if (editBtn) editBtn.style.display = displayVal;
    if (sidebarEditBloggerBtn) sidebarEditBloggerBtn.style.display = displayVal;
    if (sidebarManageTagsBtn) sidebarManageTagsBtn.style.display = displayVal;
    // 编辑器中的「+ 新分类」按钮：仅管理员显示
    if (inlineAddCategoryBtn) inlineAddCategoryBtn.style.display = isAdm ? '' : 'none';

    const paramsPanel = document.getElementById('adminParamsPanel');
    if (paramsPanel) paramsPanel.style.display = isAdm ? 'block' : 'none';

    // —— 双保险：把所有 .mini-admin-btn（左侧分类/标签管理按钮）按管理员身份统一显/隐 ——
    document.querySelectorAll('.mini-admin-btn').forEach(btn => {
        btn.style.display = isAdm ? '' : 'none';
    });

    // —— 左侧「管理」板块（桌面端 .box1 下 + 移动端 drawer 下，两套同时渲染保持一致）——
    const trashCount = typeof getAllTrash === 'function' ? getAllTrash().length : 0;
    // 给每个 li 加统一 data-guanli-action 方便事件委托
    const liHtml = `
        <li class="daohanglan">管理</li>
        <li><a href="javascript:void(0)" id="leftNavAdminManageBtn" data-guanli-action="control" title="管理控制台"><span style="display:inline-flex; align-items:center; gap:8px;">${getIcon('gear', '', 15)} 控制台</span></a></li>
        <li><a href="javascript:void(0)" data-guanli-action="articles" title="文章列表（首页）"><span style="display:inline-flex; align-items:center; gap:8px;">${getIcon('edit', '', 15)} 文章</span></a></li>
        <li><a href="javascript:void(0)" data-guanli-action="comments" title="跳转到评论区"><span style="display:inline-flex; align-items:center; gap:8px;">${getIcon('comment', '', 15)} 评论</span></a></li>
        <li>
            <a href="javascript:void(0)" data-guanli-action="trash" title="回收站：查看并恢复已删除的文章">
                <span style="display:inline-flex; align-items:center; gap:8px; width:100%;">
                    ${getIcon('trash', '', 15)} 回收站
                    <span class="guanli-trash-badge" style="margin-left:auto; display:inline-flex; align-items:center; justify-content:center; min-width:22px; padding:0 7px; height:18px; line-height:18px; border-radius:999px; font-size:11px; font-weight:700; background:var(--danger-light); color:var(--danger);">${trashCount}</span>
                </span>
            </a>
        </li>
    `;
    document.querySelectorAll('.guanli').forEach(section => {
        section.style.display = isAdm ? '' : 'none';
        if (!isAdm) return;
        const ul = section.querySelector('ul');
        if (!ul) return;
        ul.innerHTML = liHtml;
    });

    // —— 事件委托：把 .guanli 内四个 a[data-guanli-action] 的点击绑到 document（避免两套重复绑）——
    // 用 document 的 click 监听做一次（不会重复监听，因为是单次注册，在 renderAdminUI 里会先移除旧的 —— 这里不反复注册而是通过 flag 判断）
    if (!window.__guanliActionBound) {
        window.__guanliActionBound = true;
        document.addEventListener('click', e => {
            const a = e.target.closest('[data-guanli-action]');
            if (!a) return;
            e.preventDefault();
            const act = a.getAttribute('data-guanli-action');
            if (act === 'control') {
                if (typeof switchView === 'function') switchView('admin');
                return;
            }
            if (act === 'articles') {
                activeFilters = [];
                activeSearch = '';
                currentPage = 1;
                if (typeof switchView === 'function') switchView('list');
                if (typeof renderArticles === 'function') renderArticles();
                return;
            }
            if (act === 'comments') {
                // 切回 list 视图后平滑滚动到评论区
                if (typeof switchView === 'function') switchView('list');
                requestAnimationFrame(() => {
                    const c = document.querySelector('.box2-card .comments, .box2-card #commentsWrapper');
                    if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
                return;
            }
            if (act === 'trash') {
                if (!state.isAdmin) return;
                if (typeof switchView === 'function') switchView('trash');
                if (typeof renderTrashView === 'function') renderTrashView();
                return;
            }
        });
    }
}

// ========== 站点统计 ==========

function updateStats() {
    const total = articles.length;
    const pv = Number(localStorage.getItem(STORAGE_KEYS.pv) || '0');
    const uv = Number(localStorage.getItem(STORAGE_KEYS.uv) || '0');
    
    const artEl = document.getElementById('statArticles');
    const pvEl = document.getElementById('statPV');
    const uvEl = document.getElementById('statUV');
    const daysEl = document.getElementById('statDays');
    const uvRow = document.getElementById('statUVRow');

    if (artEl) artEl.textContent = total;
    if (pvEl) pvEl.textContent = formatNumber(pv);
    if (uvEl) uvEl.textContent = formatNumber(uv);
    if (daysEl) daysEl.textContent = computeSiteDays();
    if (uvRow) uvRow.style.display = state.isAdmin ? 'flex' : 'none';
}

// ========== 置顶轮播 ==========

function changeHero(index) {
    const heroItems = getHeroItems();
    if (!heroItems.length) return;
    currentHero = (index + heroItems.length) % heroItems.length;
    const item = heroItems[currentHero];

    const heroCard = document.getElementById('heroCard');
    const metaEl = document.getElementById('heroMeta');
    const titleEl = document.getElementById('heroTitle');
    const summaryEl = document.getElementById('heroSummary');

    const bgCover = getArticleCoverUrl(item);
    const tagsText = (Array.isArray(item.tags) && item.tags.length > 0)
        ? item.tags.join(' · ')
        : '';
    const likesCount = getArticleLikes(item);

    if (heroCard) {
        heroCard.style.backgroundImage = `url('${bgCover}')`;
        heroCard.style.cursor = 'pointer';
        heroCard.onclick = () => openArticleViewer(item.id);
    }
    if (metaEl) {
        metaEl.innerHTML = `
            <span>${item.category}</span> · 
            ${tagsText ? `<span>${tagsText}</span> · ` : ''}
            <span>${getIcon('calendar', '', 14)} ${formatDate(item.date)}</span> · 
            <span>${getIcon('like', '', 14)} ${likesCount}</span> · 
            <span>${getIcon('comment', '', 14)} ${item.comment || 0}</span>
        `;
    }
    if (titleEl) {
        titleEl.textContent = item.title;
    }
    if (summaryEl) summaryEl.textContent = item.summary;
}

// 图片备选库（当文章未上传封面时按文章ID稳定选择一张作为卡片底图）
// 仅收录 img 目录下真实存在、适合作为横版封面的图片（排除 logo、竖版壁纸等）
const defaultImagePool = [
    'img/img2.jpg',
    'img/img6.jpg',
    'img/img7.jpg',
    'img/img8.jpg',
    'img/img9.jpg',
    'img/img1.png',
    'img/H8d803d47862d42408c00771fcfaa7fb3a.jpg',
    'img/H9c0e693a2b8f4e5895f4c84042acfc60l.jpg',
    'img/70378_1635324983.jpg',
    'img/16276_1635404560.jpg',
    'img/27296_1587377359.jpg',
    'img/05c88836150a24f5ab7d923c28c3bb3f.jpg',
    'img/3145b4e9d688a568fe5b01dfd2f498c5.jpg',
    'img/05e636e2cbaad3a3f5e2b2d7b783896e.jpg',
    'img/haibian.png',
    'img/CSDN浏览器助手_壁纸_1634121033971.png'
];

// 旧版图库指纹（包含已知不存在的假图，用于自动迁移 localStorage 中的旧数据）
function isLegacyGallery(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const legacyMarkers = ['img/img1.jpg', 'img/img3.jpg', 'img/img4.jpg', 'img/img5.jpg'];
    return legacyMarkers.some(m => arr.indexOf(m) !== -1);
}

function getGalleryImages() {
    let saved = localStorage.getItem('galleryImages');
    let parsed = null;
    if (saved) {
        try { parsed = JSON.parse(saved); } catch (e) { parsed = null; }
    }
    // 空存储 / 解析失败 / 旧版假图库 → 自动写入新图库
    if (!saved || !Array.isArray(parsed) || parsed.length === 0 || isLegacyGallery(parsed)) {
        localStorage.setItem('galleryImages', JSON.stringify(defaultImagePool));
        return defaultImagePool;
    }
    return parsed;
}

function saveGalleryImages(images) {
    localStorage.setItem('galleryImages', JSON.stringify(images));
}

function getArticleCoverUrl(item) {
    if (!item) return 'img/img6.jpg';
    // 有真实封面：直接使用
    if (item.cover && item.cover.trim() !== '') {
        return item.cover.trim();
    }
    // 无封面：使用已分配的自动封面；若尚未分配则挑选一张并持久化
    if (!item.autoCover) {
        const picked = (typeof pickAutoCover === 'function') ? pickAutoCover() : 'img/img6.jpg';
        item.autoCover = picked;
        // 计数 +1
        if (typeof incrementCoverUsage === 'function') incrementCoverUsage(picked);
        // 持久化 autoCover 字段，避免每次刷新都重新挑选 + 重复计数
        if (typeof saveArticlesToStorage === 'function') saveArticlesToStorage();
    }
    return item.autoCover;
}

// ========== 文章列表 ==========

function renderArticles() {
    const list = sortArticles(filterArticles());
    const articleList = document.getElementById('articleList');
    
    // Auto adjust currentPage if current page is empty and there are pages before it
    const totalPages = Math.max(1, Math.ceil(list.length / articlesPerPage));
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const start = (currentPage - 1) * articlesPerPage;
    const pageArticles = list.slice(start, start + articlesPerPage);

    articleList.innerHTML = pageArticles.map(item => {
        const title = highlight(item.title, activeSearch);
        const summary = highlight(item.summary, activeSearch);
        const bgCoverUrl = getArticleCoverUrl(item);
        const tagsText = (Array.isArray(item.tags) && item.tags.length > 0)
            ? item.tags.join(' · ')
            : '';

        return `
        <article class="article-glass-card" id="article-${item.id}" style="background-image: url('${bgCoverUrl}'); cursor: pointer;" onclick="if(event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A') openArticleViewer(${item.id});">
            <div class="glass-overlay">
                <h3 class="glass-title">${title}</h3>
                <div class="glass-meta" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span>${item.category}</span> · 
                    ${tagsText ? `<span>${tagsText}</span> · ` : ''}
                    <span>${getIcon('calendar', '', 14)} ${formatDate(item.date)}</span> · 
                    <span>${getIcon('like', '', 14)} ${item.like || 0}</span> · 
                    <span style="cursor:pointer;" title="点击查看评论" onclick="event.stopPropagation(); openArticleViewer(${item.id}); setTimeout(scrollToComments, 350);">
                        ${getIcon('comment', '', 14)} ${item.comment || 0}
                    </span>
                </div>
                <p class="glass-summary">${summary}</p>
                ${state.isAdmin ? `<div class="glass-actions">
                    <button type="button" class="action-btn admin-edit" data-edit-id="${item.id}">${getIcon('edit', '', 14)} 编辑</button>
                    <button type="button" class="action-btn delete-btn" data-delete-id="${item.id}">${getIcon('trash', '', 14)} 删除</button>
                </div>` : ''}
            </div>
        </article>`;
    }).join('');

    if (!pageArticles.length) {
        articleList.innerHTML = '<p style="padding:24px;">暂无匹配文章，尝试更换关键词或标签。</p>';
    }

    // 标签点击过滤
    articleList.querySelectorAll('.tag-item[data-tag]').forEach(tagEl => {
        tagEl.addEventListener('click', () => toggleFilter(tagEl.dataset.tag));
    });

    // 操作按钮事件（仅管理员的编辑/删除）
    articleList.querySelectorAll('.action-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.deleteId) {
                if (!confirm('确定删除这篇文章吗？')) return;
                deleteArticle(Number(button.dataset.deleteId));
                renderAll();
                return;
            }
            if (button.dataset.editId) {
                openArticleEditor(getArticleById(Number(button.dataset.editId)));
                return;
            }
        });
    });

    // —— 筛选状态联动：隐藏英雄轮播 + 显示筛选结果标题 ——
    if (typeof updateHeroAndFilterHeader === 'function') updateHeroAndFilterHeader(list.length);

    renderPagination(list.length);
}

// ========== 筛选视图联动 ==========
// 有筛选/搜索条件时：隐藏置顶推荐轮播，在列表顶部显示"【xxx】下的文章"标题；
// 无任何条件时：恢复显示轮播，隐藏标题。

function updateHeroAndFilterHeader(totalCountInput) {
    const heroEl = document.querySelector('.hero-carousel');
    const headerEl = document.getElementById('filterResultHeader');

    const hasFilter = Array.isArray(activeFilters) && activeFilters.length > 0;
    const hasSearch = !!(typeof activeSearch === 'string' && activeSearch.trim() !== '');
    const showAsFiltering = hasFilter || hasSearch;

    if (heroEl) {
        heroEl.style.display = showAsFiltering ? 'none' : '';
    }
    if (!headerEl) return;

    if (!showAsFiltering) {
        headerEl.style.display = 'none';
        headerEl.innerHTML = '';
        return;
    }

    const totalNum = typeof totalCountInput === 'number'
        ? totalCountInput
        : (typeof filterArticles === 'function' ? filterArticles().length : 0);

    const catNames = new Set((state.categories || []).map(c => (c.name || '').toString().trim()).filter(Boolean));
    const parts = [];
    let currentCat = '';
    let currentTag = '';

    if (hasSearch) {
        const q = activeSearch.trim();
        parts.push(`<span class="frh-chip frh-search" title="搜索关键词">${getIcon('search', '', 14)} 搜索「${escapeHtml(q)}」</span>`);
    }

    activeFilters.forEach(f => {
        const key = (f || '').toString().trim();
        if (!key) return;
        const isMonth = /^\d{4}-\d{2}$/.test(key);
        const isCat = catNames.has(key);
        if (isMonth) {
            parts.push(`<span class="frh-chip frh-archive" title="归档月份">${getIcon('archive', '', 14)} 归档【${escapeHtml(key)}】</span>`);
        } else if (isCat) {
            currentCat = key;
        } else {
            currentTag = key;
        }
    });

    // 如果指定了标签但未指定分类，尝试查找该标签所属的分类，填充面包屑
    if (currentTag && !currentCat) {
        const foundCat = (state.categories || []).find(c => Array.isArray(c.tags) && c.tags.includes(currentTag));
        if (foundCat && foundCat.name) {
            currentCat = foundCat.name;
        } else {
            // 从 articles 查找所属分类
            const foundArt = (articles || []).find(a => Array.isArray(a.tags) && a.tags.includes(currentTag));
            if (foundArt && foundArt.category) {
                currentCat = foundArt.category;
            }
        }
    }

    const breadcrumbHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; width:100%;">
            <div class="breadcrumb-nav" style="margin:0;">
                <span class="breadcrumb-item" onclick="activeFilters = []; activeSearch = ''; renderArticles();">
                    首页
                </span>
                ${currentCat ? `<span class="breadcrumb-separator">/</span><span class="breadcrumb-item ${!currentTag ? 'active' : ''}" onclick="activeFilters = ['${currentCat}']; renderArticles();">${escapeHtml(currentCat)}</span>` : ''}
                ${currentTag ? `<span class="breadcrumb-separator">/</span><span class="breadcrumb-item active">${escapeHtml(currentTag)}</span>` : ''}
            </div>
            <span class="frh-count" style="font-size:13px; color:var(--text-muted);">共 <strong>${totalNum}</strong> 篇</span>
        </div>
    `;

    const prefix = parts.length ? `<div class="frh-parts" style="margin-top:8px;">${parts.join(' <span class="frh-plus">+</span> ')}</div>` : '';

    headerEl.innerHTML = `
        <div class="frh-main">
            ${breadcrumbHtml}
            ${prefix}
        </div>
    `;
    headerEl.style.display = 'block';
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
}

// ========== 分页 ==========

function renderPagination(total) {
    const pages = Math.max(1, Math.ceil(total / articlesPerPage));
    if (currentPage > pages) currentPage = pages;
    const container = document.getElementById('pagination');
    let html = `<button type="button" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">上一页</button>`;
    for (let i = 1; i <= pages; i++) {
        html += `<button type="button" class="${currentPage === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    html += `<button type="button" ${currentPage === pages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页</button>`;
    container.innerHTML = html;
    container.querySelectorAll('button[data-page]').forEach(button => {
        button.addEventListener('click', () => {
            currentPage = Number(button.dataset.page);
            renderArticles();
        });
    });
}

// ========== 热门文章 ==========

function renderHotList() {
    const hotEl = document.getElementById('hotList');
    if (!hotEl) return;
    const hot = [...articles].sort((a, b) => b.read - a.read).slice(0, 5);
    hotEl.innerHTML = hot.map((item, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
        return `<li class="hot-item">
            <span class="rank-badge ${rankClass}">${rank}</span>
            <a href="javascript:void(0)" data-hot-id="${item.id}" title="${item.title}">${item.title}</a>
        </li>`;
    }).join('');
    document.querySelectorAll('#hotList a[data-hot-id]').forEach(link => {
        link.addEventListener('click', () => openArticleViewer(Number(link.dataset.hotId)));
    });
}

// ========== 标签云 ==========

// 工具：统计每个标签 / 分类对应的文章数量（供风箱、标签云、归档筛选徽章统一复用）
function getTagArticleCounts() {
    const counts = {};
    (articles || []).forEach(item => {
        (item.tags || []).forEach(tag => {
            const t = (tag || '').toString().trim();
            if (!t) return;
            counts[t] = (counts[t] || 0) + 1;
        });
    });
    return counts;
}

function renderTagCloud() {
    const cloud = document.getElementById('tagCloud');
    if (!cloud) return;
    const counts = getTagArticleCounts();
    cloud.innerHTML = Object.keys(counts).map(tag => {
        const size = 12 + counts[tag] * 2;
        return `<span class="tag-item" data-tag="${tag}" style="font-size:${size}px;">${tag}</span>`;
    }).join('');
    cloud.querySelectorAll('[data-tag]').forEach(el => {
        el.addEventListener('click', () => toggleFilter(el.dataset.tag));
    });
}

// ========== 归档 ==========

function renderArchive() {
    const archive = document.getElementById('archiveList');
    if (!archive) return;
    const months = {};
    articles.forEach(item => {
        const key = item.date.slice(0, 7);
        months[key] = (months[key] || 0) + 1;
    });
    archive.innerHTML = Object.keys(months).sort((a, b) => b.localeCompare(a)).map(key =>
        `<a href="#" data-archive="${key}" title="查看${key}归档">${key} (${months[key]})</a>`
    ).join('');
    archive.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            activeFilters = [link.dataset.archive];
            currentPage = 1;
            renderArticles();
            renderFilters();
        });
    });
}

// ========== 友链 ==========

function renderFriendLinks() {
    const friendEl = document.getElementById('friendLinks');
    if (!friendEl) return;
    friendEl.innerHTML = friendLinks.map(link =>
        `<a href="${link.url}" title="${link.titleText}">${link.title}</a>`
    ).join('');
}

// ========== 筛选标签 ==========

function renderFilters() {
    // 筛选状态统一由「筛选结果标题块 filterResultHeader」顶部展示，
    // 不再渲染右上角带 × 的小胶囊，避免"删除按钮在右上角"的视觉混乱。
    const container = document.getElementById('activeFilters');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'none';
}

// ========== 回收站视图（管理员专属） ==========

function renderTrashView() {
    const trashWrapper = document.getElementById('trashView');
    const listBox = document.getElementById('trashCardList');
    const badge = document.getElementById('trashSummaryBadge');
    const backBtn = document.getElementById('trashBackToListBtn');
    const emptyAllBtn = document.getElementById('trashEmptyAllBtn');

    if (!trashWrapper || !listBox || !badge) return;

    // 权限守卫：非管理员直接切回首页，避免直接通过控制台打开
    if (!state.isAdmin) {
        switchView('list');
        return;
    }

    const all = typeof getAllTrash === 'function' ? getAllTrash() : [];
    const total = all.length;
    badge.textContent = `当前 ${total} 篇`;

    if (!total) {
        listBox.innerHTML = `
            <div style="padding:40px 16px; text-align:center; color:var(--text-muted); border-radius:16px; background:linear-gradient(135deg,var(--bg-body),var(--primary-light)); border:1px dashed var(--border-color);">
                <div style="margin-bottom:10px; color:var(--text-muted);">${getIcon('trash', '', 36)}</div>
                <div style="font-weight:700; color:var(--text-main); margin-bottom:4px;">回收站空空如也</div>
                <div style="font-size:13px; color:var(--text-muted);">删除的文章会暂存到这里，以便再次编辑发布或直接恢复。</div>
            </div>
        `;
    } else {
        listBox.innerHTML = all.map(item => {
            const deletedAt = item.deletedAt ? formatDate(new Date(Number(item.deletedAt)).toISOString()) : '—';
            const tagsHtml = Array.isArray(item.tags) && item.tags.length
                ? `<div style="margin:10px 0 0; display:flex; flex-wrap:wrap; gap:6px;">${item.tags.map(t => `<span style="padding:3px 10px; border-radius:999px; background:var(--primary-light); color:var(--primary); border:1px solid var(--primary-border); font-size:11px; font-weight:600;">${escapeHtml(t)}</span>`).join('')}</div>`
                : '';
            const summary = (item.summary || '').toString().slice(0, 160).trim();
            return `
            <article class="trash-card" data-trash-id="${item.id}">
                <div class="trash-card-body">
                    <div class="trash-card-head">
                        <h4 class="trash-card-title">${escapeHtml(item.title || '（无标题）')}</h4>
                        <span class="trash-card-meta">
                            删除于 <time datetime="${deletedAt}">${deletedAt}</time>
                        </span>
                    </div>
                    <div class="trash-card-sub">
                        <span><strong>原分类：</strong>${escapeHtml((item.category || '未分类').toString())}</span>
                        <span><strong>阅读/评论：</strong>${Number(item.read || 0)} / ${Number(item.comment || 0)}</span>
                    </div>
                    <p class="trash-card-summary">${summary ? escapeHtml(summary) + '…' : '<span style="color:var(--text-muted);">（无摘要）</span>'}</p>
                    ${tagsHtml}
                </div>
                <div class="trash-card-actions">
                    <button type="button" class="trash-btn trash-edit" data-action="edit" data-id="${item.id}" title="编辑内容并重新发布">${getIcon('edit', '', 14)} 编辑再发布</button>
                    <button type="button" class="trash-btn trash-restore" data-action="restore" data-id="${item.id}" title="直接恢复到首页文章列表">${getIcon('restore', '', 14)} 恢复</button>
                    <button type="button" class="trash-btn trash-permanent" data-action="permanent" data-id="${item.id}" title="彻底删除（无法恢复）">${getIcon('permanent', '', 14)} 彻底删除</button>
                </div>
            </article>
            `;
        }).join('');
    }

    // —— 绑定卡片区的三个按钮（事件委托 + 一次性）——
    if (!listBox.dataset.__trashBound) {
        listBox.dataset.__trashBound = '1';
        listBox.addEventListener('click', e => {
            const btn = e.target.closest('[data-action][data-id]');
            if (!btn) return;
            e.preventDefault();
            const id = Number(btn.getAttribute('data-id'));
            const action = btn.getAttribute('data-action');
            if (action === 'restore') {
                if (!confirm('确定把这篇文章恢复到首页吗？')) return;
                if (typeof restoreFromTrash === 'function' && restoreFromTrash(id)) {
                    if (typeof renderAll === 'function') renderAll();
                    switchView('list');
                }
                return;
            }
            if (action === 'permanent') {
                if (!confirm('将从回收站彻底删除此文章，不可恢复！\n\n建议先考虑「恢复」或「编辑再发布」。\n\n确定继续吗？')) return;
                if (typeof permanentDeleteFromTrash === 'function' && permanentDeleteFromTrash(id)) {
                    renderTrashView();
                    if (typeof renderAdminUI === 'function') renderAdminUI(); // 刷新左侧 N
                }
                return;
            }
            if (action === 'edit') {
                // 「编辑再发布」：直接打开文章编辑器，对象从回收站里取
                const draft = typeof getTrashById === 'function' ? getTrashById(id) : null;
                if (!draft) { alert('未找到可编辑的回收站文章。'); return; }
                if (typeof openArticleEditor === 'function') {
                    // 标记为"从回收站打开"，保存时自动恢复
                    window.__editingFromTrashId = id;
                    openArticleEditor(Object.assign({}, draft));
                }
                return;
            }
        });
    }

    // —— 绑定返回 / 清空回收站按钮（一次性）——
    if (backBtn && !backBtn.dataset.__bound) {
        backBtn.dataset.__bound = '1';
        backBtn.addEventListener('click', () => {
            activeFilters = [];
            activeSearch = '';
            currentPage = 1;
            switchView('list');
            if (typeof renderArticles === 'function') renderArticles();
        });
    }
    if (emptyAllBtn && !emptyAllBtn.dataset.__bound) {
        emptyAllBtn.dataset.__bound = '1';
        emptyAllBtn.addEventListener('click', () => {
            const n = typeof getAllTrash === 'function' ? getAllTrash().length : 0;
            if (!n) { alert('回收站已经是空的啦。'); return; }
            if (!confirm(`回收站共有 ${n} 篇文章。\n\n彻底清空后<b>无法恢复</b>，真的要全部删除吗？`)) return;
            // 逐个 permanentDelete 直至为空（避免直接把 trash = [] 绕开其它副作用）
            if (typeof getAllTrash === 'function' && typeof permanentDeleteFromTrash === 'function') {
                getAllTrash().forEach(x => permanentDeleteFromTrash(x.id));
            }
            renderTrashView();
            if (typeof renderAdminUI === 'function') renderAdminUI(); // 同步 N 为 0
        });
    }
}

function toggleFilter(tag) {
    // 单选模式：单次筛选只能有一个标签 / 分类 / 归档月份。
    // 再次点击同一个 → 取消筛选；点击不同 → 替换成新的。
    const key = (tag || '').toString();
    if (activeFilters.length === 1 && activeFilters[0] === key) {
        activeFilters = [];
    } else {
        activeFilters = key ? [key] : [];
    }
    currentPage = 1;
    switchView('list'); // 任何筛选都回到列表视图展示卡片
    renderArticles();
    renderFilters();
}

// ========== 评论 ==========

/** 转义 HTML，避免 XSS */
function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** 渲染单条评论的回复列表 HTML */
function renderReplyList(parentId, scope, articleId) {
    const replies = (typeof getReplies === 'function') ? getReplies(parentId, scope, articleId) : [];
    if (!replies.length) return '';
    return replies.map(r => `
        <div class="comment-reply-item">
            <div class="comment-item-row">
                <div class="comment-meta" style="flex:1 1 auto;">
                    <div class="comment-byline">
                        <span class="comment-name">${escHtml(r.name)}</span>
                        ${r.contact ? `<span class="comment-contact" title="联系方式：${escHtml(r.contact)}">${escHtml(r.contact)}</span>` : ''}
                    </div>
                    <div style="opacity:0.75; margin-top:2px;">${escHtml(r.date || '刚刚')}</div>
                </div>
                ${state.isAdmin ? `<button type="button" class="delete-comment-btn" data-action="delete-comment"
                    data-scope="${scope}" ${scope === 'article' ? `data-article-id="${articleId}"` : ''} data-id="${r.id}"
                    title="删除此条回复">🗑️ 删除</button>` : ''}
            </div>
            <div style="font-size:14px; color:#334155; line-height:1.6;">${escHtml(r.content)}</div>
        </div>
    `).join('');
}

function renderComments() {
    const allComments = state.comments || [];
    // 只显示顶级评论（无 parentId）
    const comments = (typeof getTopLevelComments === 'function')
        ? getTopLevelComments('main')
        : allComments;

    const adminDelete = (item, scope) => {
        if (!state.isAdmin) return '';
        return `<button type="button" class="${scope === 'sidebar' ? 'sidebar-delete-btn' : 'delete-comment-btn'}"
            data-action="delete-comment" data-scope="${scope}" data-id="${item.id}"
            title="删除此条评论">${scope === 'sidebar' ? '✕' : '🗑️ 删除'}</button>`;
    };

    const contactBadge = item => item.contact
        ? `<span class="comment-contact" title="联系方式：${escHtml(item.contact)}">${escHtml(item.contact)}</span>`
        : '';

    // 主区评论列表
    const commentListEl = document.getElementById('commentList');
    if (commentListEl) {
        if (!comments.length) {
            commentListEl.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:32px 10px; font-size:14px;">💬 暂无评论，快来发表第一条留言吧！</div>`;
        } else {
            commentListEl.innerHTML = comments.map(item => `
                <div class="comment-item" data-comment-id="${item.id}">
                    <div class="comment-item-row">
                        <div class="comment-meta" style="flex:1 1 auto;">
                            <div class="comment-byline">
                                <span class="comment-name">${escHtml(item.name)}</span>${contactBadge(item)}
                            </div>
                            <div style="opacity:0.75; margin-top:2px;">${escHtml(item.date)}</div>
                        </div>
                        ${adminDelete(item, 'main')}
                    </div>
                    <div style="font-size:14px; color:#334155; line-height:1.6;">${escHtml(item.content)}</div>
                    <div class="comment-actions">
                        <button type="button" class="reply-toggle-btn" data-action="toggle-reply" data-scope="main" data-id="${item.id}" title="回复此评论">回复</button>
                    </div>
                    <div class="comment-reply-box" data-reply-box="${item.id}" style="display:none;">
                        <textarea class="reply-textarea" rows="2" placeholder="写下你的回复..." data-reply-input="${item.id}"></textarea>
                        <div class="reply-box-actions">
                            <button type="button" class="reply-submit-btn" data-action="submit-reply" data-scope="main" data-id="${item.id}">发表回复</button>
                            <button type="button" class="reply-cancel-btn" data-action="cancel-reply" data-id="${item.id}">取消</button>
                        </div>
                    </div>
                    <div class="comment-reply-list" data-reply-list="${item.id}">
                        ${renderReplyList(item.id, 'main')}
                    </div>
                </div>
            `).join('');
        }
    }

    // 右侧边栏留言板块
    const sidebarCommentsList = document.getElementById('sidebarCommentsList');
    if (sidebarCommentsList) {
        if (!allComments.length) {
            sidebarCommentsList.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px 10px; font-size:13px;">💬 暂无最新留言</div>`;
        } else {
            sidebarCommentsList.innerHTML = allComments.slice(0, 20).map(item => `
                <div class="sidebar-comment-item">
                    <div style="color:#2563eb; font-weight:600; margin-bottom:2px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                        <span>${escHtml(item.name)}</span>
                        ${adminDelete(item, 'sidebar')}
                    </div>
                    <div style="color:#475569; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; line-height:1.4;">${escHtml(item.content)}</div>
                </div>
            `).join('');
        }
    }
}

// ========== 左侧边栏导航与分类渲染 ==========
// 同时作用于桌面端 .daohang/.zucheng 以及移动端抽屉 #mobileDrawer 中相同结构，保证两端 UI 完全一致。

function renderLeftNav() {
    // -------------------- 导航（首页 / 动态 / 网址 / 仓库，带 SVG 图标）--------------------
    document.querySelectorAll('.daohang ul').forEach(daohangList => {
        daohangList.innerHTML = `
            <li class="daohanglan">导航</li>
            <li><a href="javascript:void(0)" data-nav="home" class="active" title="返回首页，查看全部文章"><span style="display:inline-flex; align-items:center; gap:8px;">${getIcon('home', '', 15)} 首页</span></a></li>
            <li><a href="javascript:void(0)" data-nav="space" title="查看博主个人空间动态"><span style="display:inline-flex; align-items:center; gap:8px;">${getIcon('user', '', 15)} 动态</span></a></li>
            <li><a href="javascript:void(0)" data-nav="site" title="打开当前站点网址（新窗口）"><span style="display:inline-flex; align-items:center; gap:8px;">${getIcon('globe', '', 15)} 网址</span></a></li>
            <li><a href="javascript:void(0)" data-nav="repo" title="打开博客的代码仓库（新窗口）"><span style="display:inline-flex; align-items:center; gap:8px;">${getIcon('code', '', 15)} 仓库</span></a></li>
        `;
        daohangList.querySelectorAll('a[data-nav]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const nav = link.dataset.nav;
                if (nav === 'home') {
                    activeFilters = [];
                    activeSearch = '';
                    currentPage = 1;
                    switchView('list');
                    renderArticles();
                    renderFilters();
                } else if (nav === 'space') {
                    switchView('space');
                    if (typeof closeMobileDrawer === 'function') closeMobileDrawer();
                } else if (nav === 'site') {
                    const origin = window.location.origin || window.location.href;
                    window.open(origin, '_blank', 'noopener');
                } else if (nav === 'repo') {
                    const gh = (profile && profile.github) ? String(profile.github).trim() : '';
                    if (!gh || gh === '#' || !/^https?:\/\//i.test(gh)) {
                        alert('尚未设置仓库地址。请在【管理控制台 → 编辑个人资料】里填写 GitHub（或其它代码仓库）URL。');
                        return;
                    }
                    window.open(gh, '_blank', 'noopener');
                }
            });
        });
    });

    // -------------------- 分类（风箱）：标签后显示"该标签下的文章数"徽章 --------------------
    const countByTag = getTagArticleCounts(); // 每个标签 → 文章数
    document.querySelectorAll('.zucheng ul').forEach(zuchengList => {
        const cats = Array.isArray(state.categories) && state.categories.length
            ? state.categories
            : [{ name: '未分类', tags: [] }];
        const admin = !!(state && state.isAdmin);
        zuchengList.innerHTML = [
            // 顶部标题行 + 管理员新增分类按钮
            `<li class="daohanglan accordion-header-row">
                <span class="accent-bar" aria-hidden="true"></span>
                <span class="accordion-header-text">分类</span>
                ${admin ? `<button type="button" class="mini-admin-btn accordion-add-cat" title="新增分类">＋ 分类</button>` : ''}
            </li>`,
            // 每个分类：点击分类行 → 展开/收起；其他分类自动收起（风箱行为）
            ...cats.map((cat, idx) => {
                const isExpanded = idx === 0;
                const expandedAttr = isExpanded ? ' data-expanded="true"' : '';
                return `
                <li class="accordion-cat-item" data-accordion-cat="${cat.name}"${expandedAttr}>
                    <div class="accordion-cat-row">
                        <a href="javascript:void(0)" data-cat="${cat.name}" class="accordion-cat-title" title="按此分类筛选">
                            <span class="accordion-caret" aria-hidden="true"></span>
                            <span class="accordion-cat-name">${cat.name}</span>
                        </a>
                        ${admin ? `
                            <span class="accordion-cat-admin">
                                <button type="button" class="mini-admin-btn accordion-add-tag" data-for-cat="${cat.name}" title="新增标签">＋ 标签</button>
                                <button type="button" class="mini-admin-btn accordion-del-cat" data-del-cat="${cat.name}" title="删除分类">删除</button>
                            </span>
                        ` : ''}
                    </div>
                    <ul class="accordion-tag-list">
                        ${cat.tags.length ? cat.tags.map(tag => {
                            const c = countByTag[tag] || 0;
                            return `
                            <li>
                                <a href="javascript:void(0)" data-tag="${tag}" title="查看「${tag}」标签下的所有文章">
                                    <span class="accordion-tag-text">${tag}</span>
                                    <span class="accordion-tag-count" aria-label="${tag} 下有 ${c} 篇文章">${c}</span>
                                </a>
                                ${admin ? `<button type="button" class="mini-admin-btn accordion-del-tag" data-cat="${cat.name}" data-tag="${tag}" title="移除此标签">移除</button>` : ''}
                            </li>`;
                        }).join('') : `<li class="accordion-empty">${admin ? '暂无标签，点击右侧「＋ 标签」添加' : '该分类暂无标签'}</li>`}
                    </ul>
                </li>`;
            })
        ].join('');

        // 风箱交互：点击分类行（不是管理按钮）→ 切换展开，收起其他（真正风箱：开一个关其他）
        zuchengList.querySelectorAll('[data-accordion-cat]').forEach(item => {
            const titleEl = item.querySelector('.accordion-cat-title');
            if (titleEl) {
                titleEl.addEventListener('click', e => {
                    const catName = titleEl.getAttribute('data-cat');
                    // 风箱行为：同一块 zucheng 里其他分类全部收起
                    zuchengList.querySelectorAll('[data-accordion-cat]').forEach(other => {
                        if (other !== item) other.removeAttribute('data-expanded');
                    });
                    if (item.hasAttribute('data-expanded')) {
                        item.removeAttribute('data-expanded');
                    } else {
                        item.setAttribute('data-expanded', 'true');
                    }
                    if (catName) toggleFilter(catName);
                });
            }
        });

        // 标签点击（筛选）
        zuchengList.querySelectorAll('a[data-tag]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                toggleFilter(link.dataset.tag);
            });
        });

        // 管理员：新增分类 / 新增标签 / 删除分类 / 删除标签
        if (admin) {
            const addCatBtn = zuchengList.querySelector('.accordion-add-cat');
            if (addCatBtn) {
                addCatBtn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const name = prompt('输入新分类名称：', '');
                    if (name && addCategory(name)) {
                        renderAll();
                    } else if (name) {
                        alert('分类已存在或输入无效。');
                    }
                });
            }
            zuchengList.querySelectorAll('.accordion-add-tag').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const catName = btn.getAttribute('data-for-cat');
                    const tagName = prompt(`在「${catName}」下新增一个标签：`, '');
                    if (!tagName) return;
                    if (addTagToCategory(catName, tagName)) {
                        renderAll();
                    } else {
                        alert('标签已存在或输入无效。');
                    }
                });
            });
            zuchengList.querySelectorAll('.accordion-del-cat').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const catName = btn.getAttribute('data-del-cat');
                    if (!confirm(`删除分类「${catName}」？\n（仅删除分类结构，文章仍保留在"未分类"下）`)) return;
                    if (deleteCategory(catName)) {
                        renderAll();
                    }
                });
            });
            zuchengList.querySelectorAll('.accordion-del-tag').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const catName = btn.getAttribute('data-cat');
                    const tagName = btn.getAttribute('data-tag');
                    if (!confirm(`从分类「${catName}」中移除标签「${tagName}」？`)) return;
                    if (deleteTagFromCategory(catName, tagName)) {
                        renderAll();
                    }
                });
            });
        }
    });
}

// ========== 统一刷新 ==========

function renderAll() {
    if (typeof syncCategoriesFromArticles === 'function') {
        syncCategoriesFromArticles();
    }
    renderProfile();
    renderLeftNav();
    renderArticles();
    renderHotList();
    renderTagCloud();
    renderComments();
    updateStats();
}

// ========== 管理面板快捷链接与图册数据处理与渲染 ==========

const defaultAdminLinks = [
    { title: "📖 官方文档", url: "https://ndmiao.cn/" },
    { title: "💻 我的 GitHub", url: "https://github.com" }
];

function getCustomAdminLinks() {
    let saved = localStorage.getItem('customAdminLinks');
    if (!saved) {
        localStorage.setItem('customAdminLinks', JSON.stringify(defaultAdminLinks));
        return defaultAdminLinks;
    }
    try {
        return JSON.parse(saved);
    } catch(e) {
        return defaultAdminLinks;
    }
}

function saveCustomAdminLinks(links) {
    localStorage.setItem('customAdminLinks', JSON.stringify(links));
}

function renderAdminControlLinks() {
    const listEl = document.getElementById('customAdminLinksList');
    if (!listEl) return;
    const links = getCustomAdminLinks();

    listEl.innerHTML = links.map((link, idx) => `
        <div class="admin-square-card link-card" style="position:relative; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; aspect-ratio:1/1; border:1px solid #cbd5e1; border-radius:16px; transition:all 0.3s ease; background:rgba(255,255,255,0.05); padding:16px; text-align:center;" onclick="window.open('${link.url}', '_blank')">
            <button type="button" class="delete-link-btn" data-idx="${idx}" style="position:absolute; top:8px; right:8px; background:rgba(239,68,68,0.15); color:#ef4444; border:none; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer; font-weight:700;" title="删除此链接" onclick="event.stopPropagation(); deleteCustomAdminLink(${idx});">×</button>
            <span style="font-size:36px; margin-bottom:10px;">🔗</span>
            <span style="font-weight:700; font-size:14px; color:inherit; text-decoration:none; display:block; text-overflow:ellipsis; overflow:hidden; width:100%; white-space:nowrap;">${link.title}</span>
        </div>
    `).join('');
}

function deleteCustomAdminLink(idx) {
    let links = getCustomAdminLinks();
    links.splice(idx, 1);
    saveCustomAdminLinks(links);
    renderAdminControlLinks();
}

function deleteGalleryImage(idx) {
    if (!confirm('确定从图册中删除这张图片吗？已发布使用该图的文章将恢复为随机备选图。')) return;
    let images = getGalleryImages();
    const url = images[idx];
    images.splice(idx, 1);
    saveGalleryImages(images);
    // 清理该图的使用计数
    if (url && typeof decrementCoverUsage === 'function') decrementCoverUsage(url);
    const searchVal = document.getElementById('gallerySearchInput')?.value || '';
    renderGallery(searchVal);
}

function renderGallery(filterText = '') {
    const gridEl = document.getElementById('galleryGrid');
    if (!gridEl) return;
    const images = getGalleryImages();
    const usage = (typeof loadCoverUsage === 'function') ? loadCoverUsage() : {};
    const filterLower = (filterText || '').toLowerCase();

    // 同时支持按 URL 和自定义名称搜索
    const filtered = images
        .map((url, idx) => ({ url, idx, name: (typeof getGalleryImageName === 'function') ? getGalleryImageName(url, idx) : ('img' + (idx + 1)) }))
        .filter(item => {
            if (!filterText) return true;
            return item.url.toLowerCase().includes(filterLower) || item.name.toLowerCase().includes(filterLower);
        });

    gridEl.innerHTML = filtered.map(item => {
        const usageCount = usage[item.url] || 0;
        const displayName = escHtml(item.name);
        const isData = item.url.startsWith('data:');
        const urlAttr = escHtml(item.url);
        return `
            <div class="gallery-item-card" data-gallery-idx="${item.idx}">
                <div class="gallery-thumb-wrap" data-action="view-large" data-idx="${item.idx}" title="点击查看大图">
                    <img src="${urlAttr}" alt="${displayName}" loading="lazy" onerror="this.src='img/img6.jpg'">
                    ${usageCount > 0 ? `<span class="gallery-usage-badge" title="作为自动封面使用次数">${usageCount}</span>` : ''}
                </div>
                <div class="gallery-item-info">
                    <span class="gallery-item-name" data-name-display="${item.idx}" title="${isData ? '本地上传图片' : escHtml(item.url)}">${displayName}</span>
                    <input type="text" class="gallery-name-input" data-name-input="${item.idx}" value="${displayName}" placeholder="自定义名称" style="display:none;">
                    <div class="gallery-item-actions">
                        <button type="button" class="gallery-icon-btn gallery-edit-name-btn" data-action="edit-name" data-idx="${item.idx}" title="编辑名称">${getIcon('edit', '', 14)}</button>
                        <button type="button" class="gallery-icon-btn gallery-delete-btn" data-action="delete-image" data-idx="${item.idx}" title="删除">${getIcon('trash', '', 14)}</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (filtered.length === 0) {
        gridEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:32px; color:#64748b; font-size:14px;">图册内无匹配的图片。</div>';
    }
}

// ========== 个人空间动态页面渲染 & 交互逻辑 ==========

let tempFeedImages = [];

function renderSpaceView(autoOpenFeedId) {
    const spaceView = document.getElementById('spaceView');
    if (!spaceView) return;

    // 1. 同步个人资料 (右侧卡片)
    const avatarImg = document.getElementById('spaceAvatarImg');
    const nameTxt = document.getElementById('spaceNameTxt');
    const bioTxt = document.getElementById('spaceBioTxt');
    const aboutTxt = document.getElementById('spaceAboutTxt');

    if (avatarImg) avatarImg.src = profile.avatar || 'img/img6.jpg';
    if (nameTxt) nameTxt.textContent = profile.name || '是令令啊';
    if (bioTxt) bioTxt.textContent = profile.bio || "it's me~";
    if (aboutTxt) aboutTxt.textContent = profile.about || '热衷于前端开发与 UI/UX 极致交互体验，喜爱全栈探索、设计系统与博客雕琢。欢迎来到我的个人空间动态！✨';

    // 2. 社交联系面板渲染
    const socialBadges = document.getElementById('spaceSocialBadges');
    if (socialBadges) {
        const socials = getProfileSocials();
        socialBadges.innerHTML = socials.map(s => {
            const val = s.value || '';
            const isUrl = /^https?:\/\//i.test(val);
            const valHtml = isUrl 
                ? `<a href="${val}" target="_blank" rel="noopener" style="color:inherit; text-decoration:none;">${val}</a>`
                : val;
            return `<span class="frh-chip" style="font-size:12px; padding:4px 10px;">${s.label}: ${valHtml}</span>`;
        }).join('');
    }

    // 3. 管理员发布框显隐
    const publishCard = document.getElementById('spacePublishCard');
    if (publishCard) {
        publishCard.style.display = (state && state.isAdmin) ? 'block' : 'none';
    }

    // 4. 渲染动态列表 (自动保留所有展开的评论区)
    renderFeedTimeline(autoOpenFeedId);

    // 5. 渲染日历活跃周期网格
    renderActivityCalendar();
}

function renderFeedTimeline(autoOpenFeedId) {
    const container = document.getElementById('feedTimelineList');
    if (!container) return;

    // 记录重新渲染前处于展开状态的评论区 ID
    const openFeedIds = new Set();
    document.querySelectorAll('.feed-comments-container').forEach(wrap => {
        if (wrap.style.display === 'block') {
            const idStr = wrap.id.replace('feed-comments-wrap-', '');
            if (idStr) openFeedIds.add(Number(idStr));
        }
    });
    if (autoOpenFeedId) openFeedIds.add(Number(autoOpenFeedId));

    const feeds = getSpaceFeeds();
    if (!feeds.length) {
        container.innerHTML = `<div class="box3-card" style="text-align:center; padding:40px; color:var(--text-muted);">暂无动态，期待博主的第一次分享~</div>`;
        return;
    }

    container.innerHTML = feeds.map(feed => {
        const imagesHtml = (feed.images && feed.images.length)
            ? `<div class="feed-gallery" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px; margin-top:12px;">
                ${feed.images.map((imgUrl, i) => `
                    <img src="${imgUrl}" alt="动态图片" onclick="openSpaceImageViewer('${feed.id}', ${i})" style="width:100%; height:140px; object-fit:cover; border-radius:10px; cursor:pointer; border:1px solid var(--border-color); transition:transform 0.2s ease;">
                `).join('')}
               </div>`
            : '';

        const totalComments = (feed.comments || []).reduce((acc, c) => acc + 1 + (c.replies ? c.replies.length : 0), 0);
        const commentsListHtml = renderFeedCommentsList(feed);

        const isLiked = (typeof isLikedSpaceFeed === 'function') ? isLikedSpaceFeed(feed.id) : false;

        return `
            <div class="box3-card feed-card" id="feed-card-${feed.id}" style="padding:22px; position:relative;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${profile.avatar || 'img/img6.jpg'}" alt="头像" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:2px solid var(--primary-border);">
                        <div>
                            <div style="font-weight:700; font-size:15px; color:var(--text-main);">${profile.name || '博主'}</div>
                            <div style="font-size:12px; color:var(--text-muted);">${feed.date}</div>
                        </div>
                    </div>
                    ${(state && state.isAdmin) ? `
                        <button type="button" class="mini-admin-btn danger" onclick="deleteSpaceFeedItem(${feed.id})" style="padding:4px 10px; font-size:11.5px; border-radius:999px; cursor:pointer; border:1px solid var(--danger); background:var(--danger-light); color:var(--danger);">删除</button>
                    ` : ''}
                </div>

                <div class="feed-content-text" style="font-size:14.5px; line-height:1.7; color:var(--text-main); white-space:pre-wrap;">${escapeHtml(feed.content)}</div>
                ${imagesHtml}

                <div style="display:flex; align-items:center; justify-content:space-between; margin-top:16px; padding-top:12px; border-top:1px solid var(--border-color);">
                    <div style="display:flex; gap:18px; align-items:center;">
                        <button type="button" class="feed-act-btn ${isLiked ? 'liked' : ''}" id="feed-like-btn-${feed.id}" onclick="handleLikeFeed(event, ${feed.id})" style="background:none; border:none; cursor:pointer; color:${isLiked ? 'var(--danger)' : 'var(--text-muted)'}; display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; outline:none; transition:color 0.2s ease;">
                            ${getIcon('like', '', 15)}
                            <span id="feed-like-count-${feed.id}">${feed.likes || 0}</span>
                        </button>
                        <button type="button" class="feed-act-btn" onclick="toggleFeedComments(${feed.id})" style="background:none; border:none; cursor:pointer; color:var(--text-muted); display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; outline:none;">
                            ${getIcon('comment', '', 15)}
                            <span>评论 (${totalComments})</span>
                        </button>
                    </div>
                </div>

                <div id="feed-comments-wrap-${feed.id}" class="feed-comments-container" style="display:none; margin-top:16px; padding-top:16px; border-top:1px dashed var(--border-color);">
                    <div id="feed-comments-list-${feed.id}">
                        ${commentsListHtml}
                    </div>

                    <div class="feed-comment-input-box" style="margin-top:14px;">
                        <div style="display:flex; gap:8px;">
                            <input type="text" id="feed-comment-text-${feed.id}" placeholder="写下您的评论..." style="flex:1; padding:8px 14px; border-radius:10px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                            <button type="button" class="primary-btn" onclick="submitFeedComment(${feed.id})" style="padding:8px 18px; font-size:13px; border-radius:999px;">发送</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // 恢复先前及当前发表评论的评论区展开状态
    openFeedIds.forEach(id => {
        const wrap = document.getElementById(`feed-comments-wrap-${id}`);
        if (wrap) wrap.style.display = 'block';
    });
}

function renderFeedCommentsList(feed) {
    if (!feed.comments || !feed.comments.length) {
        return `<div style="font-size:12.5px; color:var(--text-muted); text-align:center; padding:10px;">暂无评论，来发表第一条观点吧~</div>`;
    }

    const visitor = (typeof loadVisitorInfo === 'function') ? loadVisitorInfo() : null;
    const visitorName = visitor ? (visitor.name || '') : '';
    const visitorContact = visitor ? (visitor.contact || '') : '';
    const isAdmin = !!(state && state.isAdmin);

    return feed.comments.map(c => {
        const canDeleteComment = isAdmin || (visitorName && c.name === visitorName) || (visitorContact && c.contact === visitorContact);
        const repliesHtml = (c.replies && c.replies.length) ? `
            <div style="margin-top:8px; padding-left:12px; border-left:2px solid var(--primary-border); display:flex; flex-direction:column; gap:6px;">
                ${c.replies.map(r => {
                    const canDeleteReply = isAdmin || (visitorName && r.name === visitorName) || (visitorContact && r.contact === visitorContact);
                    return `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px;">
                        <div style="flex:1;">
                            <span style="font-weight:700; color:var(--text-main);">${escapeHtml(r.name)}</span>: 
                            <span style="color:var(--text-secondary);">${escapeHtml(r.text)}</span>
                            <span style="font-size:10.5px; color:var(--text-muted); margin-left:6px;">(${r.date})</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                            <button type="button" style="background:none; border:none; color:var(--primary); font-size:11px; cursor:pointer; font-weight:600; padding:0;" onclick="showFeedReplyInput(${feed.id}, ${c.id}, '${escapeHtml(r.name)}')">回复</button>
                            ${canDeleteReply ? `<button type="button" style="background:none; border:none; color:var(--danger); font-size:11px; cursor:pointer; font-weight:600; padding:0;" onclick="handleDeleteFeedComment(${feed.id}, ${c.id}, ${r.id})">删除</button>` : ''}
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        ` : '';

        return `
        <div style="margin-bottom:12px; font-size:13px; background:var(--bg-body); padding:10px 14px; border-radius:10px; border:1px solid var(--border-color);">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                        <span style="font-weight:700; color:var(--primary);">${escapeHtml(c.name)}</span>
                        <span style="font-size:11px; color:var(--text-muted);">${c.date}</span>
                    </div>
                    <div style="color:var(--text-main); line-height:1.5; white-space:pre-wrap;">${escapeHtml(c.text)}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px; flex-shrink:0; margin-top:2px;">
                    <button type="button" style="background:none; border:none; color:var(--primary); font-size:12px; cursor:pointer; font-weight:600; padding:0;" onclick="showFeedReplyInput(${feed.id}, ${c.id}, '${escapeHtml(c.name)}')">回复</button>
                    ${canDeleteComment ? `<button type="button" style="background:none; border:none; color:var(--danger); font-size:12px; cursor:pointer; font-weight:600; padding:0;" onclick="handleDeleteFeedComment(${feed.id}, ${c.id})">删除</button>` : ''}
                </div>
            </div>

            ${repliesHtml}

            <div id="feed-reply-box-${feed.id}-${c.id}" style="display:none; margin-top:8px;"></div>
        </div>
        `;
    }).join('');
}

function handleDeleteFeedComment(feedId, commentId, replyId) {
    if (confirm('确定删除这条评论吗？')) {
        deleteSpaceFeedComment(feedId, commentId, replyId);
        if (typeof showToast === 'function') showToast('评论已删除');
        renderSpaceView(feedId);
    }
}

let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

function changeCalendarMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
    } else if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
    }
    renderActivityCalendar();
}

function resetCalendarToToday() {
    const now = new Date();
    calendarYear = now.getFullYear();
    calendarMonth = now.getMonth();
    renderActivityCalendar();
}

function renderActivityCalendar() {
    const grid = document.getElementById('activityCalendarGrid');
    const monthTitle = document.getElementById('activityCalendarMonthTitle');
    const totalDaysSpan = document.getElementById('activityTotalDays');
    if (!grid) return;

    const now = new Date();
    const realYear = now.getFullYear();
    const realMonth = now.getMonth();
    const todayDate = now.getDate();

    if (monthTitle) {
        monthTitle.textContent = `${calendarYear}年${calendarMonth + 1}月`;
    }

    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();

    const feeds = getSpaceFeeds();
    let activeDaysCount = 0;
    let gridHtml = '';

    // 月首空白占位
    for (let i = 0; i < firstDayOfWeek; i++) {
        gridHtml += `<div style="aspect-ratio:1/1; border-radius:6px; opacity:0; pointer-events:none;"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(calendarMonth + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${calendarYear}-${mm}-${dd}`;

        const artCount = (articles || []).filter(a => a.date === dateStr).length;
        const feedCount = (feeds || []).filter(f => f.date && f.date.startsWith(dateStr)).length;
        const total = artCount + feedCount;

        if (total > 0) activeDaysCount++;

        const isToday = (calendarYear === realYear && calendarMonth === realMonth && d === todayDate);
        const memoText = typeof getDateMemo === 'function' ? getDateMemo(dateStr) : '';
        const hasMemo = !!(memoText && memoText.trim());

        let bg = 'var(--bg-body)';
        let textColor = 'var(--text-main)';
        let borderStyle = isToday ? '2px solid var(--primary)' : '1px solid var(--border-color)';

        if (total === 1) bg = 'rgba(99, 102, 241, 0.25)';
        else if (total === 2) { bg = 'rgba(99, 102, 241, 0.55)'; textColor = '#ffffff'; }
        else if (total >= 3) { bg = 'var(--primary)'; textColor = '#ffffff'; }

        if (isToday && total === 0) {
            bg = 'var(--primary-light)';
            textColor = 'var(--primary)';
        }

        const tooltipText = `${dateStr}: ${total} 次活动${isToday ? ' (今天)' : ''}${hasMemo ? ' | 📌 有备忘录' : ''}`;

        gridHtml += `
            <div title="${escapeHtml(tooltipText)}" 
                 onclick="openCalendarMemoModal('${dateStr}')"
                 style="aspect-ratio:1/1; border-radius:6px; background:${bg}; color:${textColor}; border:${borderStyle}; font-size:12px; font-weight:${isToday ? '800' : '600'}; display:flex; align-items:center; justify-content:center; cursor:pointer; position:relative; transition:transform 0.15s ease, box-shadow 0.15s ease;"
                 onmouseover="this.style.transform='scale(1.18)'; this.style.zIndex='2';"
                 onmouseout="this.style.transform='scale(1)'; this.style.zIndex='1';">
                ${d}
                ${hasMemo ? `<span style="position:absolute; top:1px; right:2px; font-size:8px; line-height:1;">📌</span>` : ''}
            </div>
        `;
    }

    grid.innerHTML = gridHtml;

    if (totalDaysSpan) {
        totalDaysSpan.textContent = `本月活跃 ${activeDaysCount} 天`;
    }
}

// ========== 顶栏提示标语 (搜索框左侧逐字跳动 + 上下翻转轮播) ==========

let topNoticeTimer = null;
let topNoticeIndex = 0;

function renderTopNoticeBanner() {
    const container = document.getElementById('topNoticeBanner');
    if (!container) return;

    const upcoming = typeof getUpcomingMemosWithin3Days === 'function' ? getUpcomingMemosWithin3Days() : [];
    const hasUpcoming = upcoming.length > 0;

    const titleText = hasUpcoming ? '近3天有事情要做哦' : '今天也要开心';
    const bounceTitle = Array.from(titleText).map((ch, idx) => 
        `<span class="bounce-char" style="animation-delay:${idx * 0.08}s;">${ch}</span>`
    ).join('');

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const adminTip = (state && state.isAdmin) ? '点击直接编辑此备忘事项' : '点击查看事项 (仅管理员可编辑)';

    const linesHtml = hasUpcoming 
        ? upcoming.map(item => `
            <div class="flip-item" onclick="openCalendarMemoModal('${item.date}')" title="${item.date} ${adminTip}" style="height:22px; line-height:22px; font-size:12px; color:var(--text-main); white-space:nowrap; text-overflow:ellipsis; overflow:hidden; cursor:pointer;">
                ${escapeHtml(item.text)}
            </div>
          `).join('')
        : `
            <div class="flip-item" onclick="openCalendarMemoModal('${todayStr}')" title="${adminTip}" style="height:22px; line-height:22px; font-size:12px; color:var(--text-main); white-space:nowrap; text-overflow:ellipsis; overflow:hidden; cursor:pointer;">今天也要开心 ✨</div>
            <div class="flip-item" onclick="openCalendarMemoModal('${todayStr}')" title="${adminTip}" style="height:22px; line-height:22px; font-size:12px; color:var(--text-main); white-space:nowrap; text-overflow:ellipsis; overflow:hidden; cursor:pointer;">保持热爱，奔赴山海 🚀</div>
            <div class="flip-item" onclick="openCalendarMemoModal('${todayStr}')" title="${adminTip}" style="height:22px; line-height:22px; font-size:12px; color:var(--text-main); white-space:nowrap; text-overflow:ellipsis; overflow:hidden; cursor:pointer;">把期待降到最低，收获都是惊喜 🌸</div>
          `;

    const totalItems = hasUpcoming ? upcoming.length : 3;

    container.innerHTML = `
        <div style="display:flex; align-items:center; gap:5px; flex-shrink:0; cursor:pointer;" onclick="openCalendarMemoModal('${todayStr}')" title="${adminTip}">
            <span style="font-size:13px;">${hasUpcoming ? '⏰' : '🎈'}</span>
            <span class="bounce-title" style="color:${hasUpcoming ? 'var(--danger)' : 'var(--primary)'}; font-weight:700; white-space:nowrap;">${bounceTitle}</span>
        </div>
        <div class="flip-box" style="flex:1; min-width:0; height:22px; overflow:hidden; position:relative;">
            <div class="flip-list" id="topNoticeFlipList" style="transform:translateY(0px); transition:transform 0.5s ease;">
                ${linesHtml}
            </div>
        </div>
    `;

    if (topNoticeTimer) clearInterval(topNoticeTimer);
    topNoticeIndex = 0;

    if (totalItems > 1) {
        topNoticeTimer = setInterval(() => {
            topNoticeIndex = (topNoticeIndex + 1) % totalItems;
            const flipList = document.getElementById('topNoticeFlipList');
            if (flipList) {
                flipList.style.transform = `translateY(-${topNoticeIndex * 22}px)`;
            }
        }, 3000);
    }
}

// ========== 纪念日 / 备忘录 Modal 逻辑 ==========

let currentEditingMemoDate = '';

function openCalendarMemoModal(dateStr) {
    if (!state || !state.isAdmin) {
        if (typeof showToast === 'function') showToast('只有管理员才可以编辑待办事项与备忘录哦！');
        return;
    }
    currentEditingMemoDate = dateStr;
    const modal = document.getElementById('calendarMemoModal');
    const title = document.getElementById('memoModalDateTitle');
    const input = document.getElementById('calendarMemoInput');
    if (!modal) return;

    if (modal.parentNode !== document.documentElement) {
        document.documentElement.appendChild(modal);
    }

    if (title) title.textContent = `${dateStr} 纪念日 / 备忘录 (管理员编辑)`;
    if (input) input.value = typeof getDateMemo === 'function' ? getDateMemo(dateStr) : '';

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    if (input) setTimeout(() => input.focus(), 80);
}

function closeCalendarMemoModal() {
    const modal = document.getElementById('calendarMemoModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    currentEditingMemoDate = '';
}

function saveCalendarMemo() {
    if (!currentEditingMemoDate) return;
    const input = document.getElementById('calendarMemoInput');
    const content = input ? input.value.trim() : '';

    if (typeof setDateMemo === 'function') {
        setDateMemo(currentEditingMemoDate, content);
    }

    closeCalendarMemoModal();
    if (typeof showToast === 'function') showToast('备忘录已更新！');
    renderActivityCalendar();
    renderTopNoticeBanner();
}

function deleteCalendarMemo() {
    if (!currentEditingMemoDate) return;
    if (confirm('确定要删除该日期的备忘录吗？')) {
        if (typeof setDateMemo === 'function') {
            setDateMemo(currentEditingMemoDate, '');
        }
        closeCalendarMemoModal();
        if (typeof showToast === 'function') showToast('备忘录已删除');
        renderActivityCalendar();
        renderTopNoticeBanner();
    }
}

function handleFeedImageSelect(input) {
    const files = input.files;
    if (!files || !files.length) return;
    
    const tip = document.getElementById('feedImageTip');
    if (tip) tip.textContent = `已选择 ${files.length} 张图片`;

    tempFeedImages = [];
    const wrap = document.getElementById('feedImagePreviewWrap');
    if (wrap) wrap.innerHTML = '';

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            tempFeedImages.push(e.target.result);
            if (wrap) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width:60px; height:60px; object-fit:cover; border-radius:8px; border:1px solid var(--border-color);';
                wrap.appendChild(img);
            }
        };
        reader.readAsDataURL(file);
    });
}

function submitNewFeed() {
    const textEl = document.getElementById('feedPublishText');
    const content = textEl ? textEl.value.trim() : '';
    if (!content) {
        if (typeof showToast === 'function') showToast('请输入动态内容！');
        return;
    }

    createSpaceFeed({ content, images: [...tempFeedImages] });
    if (textEl) textEl.value = '';
    tempFeedImages = [];
    const wrap = document.getElementById('feedImagePreviewWrap');
    if (wrap) wrap.innerHTML = '';
    const tip = document.getElementById('feedImageTip');
    if (tip) tip.textContent = '';
    const input = document.getElementById('feedImageInput');
    if (input) input.value = '';

    if (typeof showToast === 'function') showToast('动态发布成功！');
    renderSpaceView();
}

function deleteSpaceFeedItem(feedId) {
    if (confirm('确定要删除这条动态吗？')) {
        deleteSpaceFeed(feedId);
        if (typeof showToast === 'function') showToast('动态已删除');
        renderSpaceView();
    }
}

function handleLikeFeed(event, feedId) {
    const res = likeSpaceFeed(feedId);
    const countSpan = document.getElementById(`feed-like-count-${feedId}`);
    const likeBtn = document.getElementById(`feed-like-btn-${feedId}`);
    if (countSpan) countSpan.textContent = res.likes;
    if (likeBtn) {
        likeBtn.style.color = res.isLiked ? 'var(--danger)' : 'var(--text-muted)';
        likeBtn.classList.toggle('liked', res.isLiked);
    }
    
    if (res.isLiked && typeof triggerBurstEffect === 'function') {
        triggerBurstEffect(likeBtn || event);
    }
}

function toggleFeedComments(feedId) {
    const wrap = document.getElementById(`feed-comments-wrap-${feedId}`);
    if (!wrap) return;
    wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

function submitFeedComment(feedId) {
    const input = document.getElementById(`feed-comment-text-${feedId}`);
    const text = input ? input.value.trim() : '';
    if (!text) {
        if (typeof showToast === 'function') showToast('请输入评论内容！');
        return;
    }

    const visitor = (typeof loadVisitorInfo === 'function') ? loadVisitorInfo() : { name: '', contact: '' };
    if (!visitor.name || !visitor.contact) {
        if (typeof showVisitorInfoModal === 'function') {
            showVisitorInfoModal({
                customSubmit: (name, contact) => {
                    addSpaceFeedComment(feedId, { name, contact, text });
                    if (input) input.value = '';
                    if (typeof showToast === 'function') showToast('评论发表成功！');
                    renderSpaceView(feedId);
                }
            });
        } else {
            const name = prompt('请输入您的昵称：') || '热心访客';
            addSpaceFeedComment(feedId, { name, contact: 'guest@blog.com', text });
            if (input) input.value = '';
            renderSpaceView(feedId);
        }
        return;
    }

    addSpaceFeedComment(feedId, { name: visitor.name, contact: visitor.contact, text });
    if (input) input.value = '';
    if (typeof showToast === 'function') showToast('评论发表成功！');
    renderSpaceView(feedId);
}

function showFeedReplyInput(feedId, commentId, authorName) {
    const container = document.getElementById(`feed-reply-box-${feedId}-${commentId}`);
    if (!container) return;
    
    container.style.display = 'block';
    container.innerHTML = `
        <div style="display:flex; gap:8px; margin-top:6px;">
            <input type="text" id="feed-reply-text-${feedId}-${commentId}" placeholder="回复 @${authorName}..." style="flex:1; padding:6px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main); font-size:12.5px; outline:none;">
            <button type="button" class="primary-btn" onclick="submitFeedReply(${feedId}, ${commentId})" style="padding:6px 14px; font-size:12px; border-radius:999px;">回复</button>
        </div>
    `;
    const input = document.getElementById(`feed-reply-text-${feedId}-${commentId}`);
    if (input) {
        input.value = `@${authorName} `;
        input.focus();
    }
}

function submitFeedReply(feedId, commentId) {
    const input = document.getElementById(`feed-reply-text-${feedId}-${commentId}`);
    const text = input ? input.value.trim() : '';
    if (!text) {
        if (typeof showToast === 'function') showToast('请输入回复内容！');
        return;
    }

    const visitor = (typeof loadVisitorInfo === 'function') ? loadVisitorInfo() : { name: '', contact: '' };
    if (!visitor.name || !visitor.contact) {
        if (typeof showVisitorInfoModal === 'function') {
            showVisitorInfoModal({
                customSubmit: (name, contact) => {
                    addSpaceFeedComment(feedId, { name, contact, text, replyToId: commentId });
                    if (typeof showToast === 'function') showToast('回复发表成功！');
                    renderSpaceView(feedId);
                }
            });
        } else {
            const name = prompt('请输入您的昵称：') || '热心访客';
            addSpaceFeedComment(feedId, { name, contact: 'guest@blog.com', text, replyToId: commentId });
            renderSpaceView(feedId);
        }
        return;
    }

    addSpaceFeedComment(feedId, { name: visitor.name, contact: visitor.contact, text, replyToId: commentId });
    if (typeof showToast === 'function') showToast('回复发表成功！');
    renderSpaceView(feedId);
}

function openSpaceImageViewer(feedId, imgIdx) {
    const feeds = getSpaceFeeds();
    const target = feeds.find(f => f.id === Number(feedId));
    if (!target || !target.images || !target.images.length) return;
    if (typeof openImageViewer === 'function') {
        openImageViewer(imgIdx, target.images);
    }
}
