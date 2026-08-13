/**
 * ui.js - UI 交互层：主题、音乐、内联视图切换、内联编辑器、内联文章阅读器
 */

// ========== 主题 ==========

function setTheme(theme) {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    state.theme = theme;
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.innerHTML = theme === 'dark' 
            ? `${getIcon('sun', '', 15)} <span>浅色</span>` 
            : `${getIcon('moon', '', 15)} <span>暗黑</span>`;
    }
    if (typeof vditorInstance !== 'undefined' && vditorInstance) {
        vditorInstance.setTheme(theme === 'dark' ? 'dark' : 'classic', theme === 'dark' ? 'dark' : 'light');
    }
}

function toggleTheme() {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ========== 遮罩层 ==========

function showOverlay(show) {
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.toggle('active', show);
}

// ========== 音乐播放器 ==========

/** 顶栏内联播放器：不再有浮窗 open/close 概念，openMusic 仅作为兼容入口 */
function openMusic() {
    renderMusicPlayerUI();
    // 顶栏播放器始终可见，无需切换 display
    showOverlay(false);
}

function closeMusic() {
    // 兼容旧调用：仅关闭歌单 popover（如打开）
    const popover = document.getElementById('mpListPopover');
    if (popover) popover.style.display = 'none';
    const listBtn = document.getElementById('mpListBtn');
    if (listBtn) listBtn.classList.remove('is-open');
    showOverlay(false);
}

/** 切换歌单 popover 显隐（顶栏 ☰ 按钮调用） */
function toggleMusicListPopover() {
    const popover = document.getElementById('mpListPopover');
    const listBtn = document.getElementById('mpListBtn');
    if (!popover) return;
    const willOpen = popover.style.display === 'none' || !popover.style.display;
    popover.style.display = willOpen ? '' : 'none';
    popover.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
    if (listBtn) listBtn.classList.toggle('is-open', willOpen);
    if (willOpen) renderMusicPlayerUI();
}

/** 播放按钮 / 封面旋转同步（顶栏内联版） */
function updateMusicStatus() {
    const inline = document.getElementById('mpInline');
    const playBtn = document.getElementById('mpPlayBtn');
    const isPlaying = !!(state && state.musicPlaying);
    if (inline) inline.classList.toggle('is-playing', isPlaying);
    if (!playBtn) return;
    playBtn.innerHTML = isPlaying ? getIcon('pause', '', 14) : getIcon('play', '', 14);
    // 同步封面图片
    const coverImg = document.getElementById('mpCover');
    const cur = (typeof getCurrentSong === 'function') ? getCurrentSong() : null;
    if (coverImg && cur && cur.picUrl) {
        if (coverImg.src !== cur.picUrl) {
            coverImg.src = cur.picUrl;
            coverImg.onerror = function() { this.src = 'img/img6.jpg'; };
        }
    }
}

/** 渲染顶栏内联播放器：封面 / 歌名 / 齿轮显隐 / 歌单列表高亮 */
function renderMusicPlayerUI() {
    if (typeof loadMusicFromStorage === 'function' && !state.musicPlaylist.length) loadMusicFromStorage();
    const titleEl = document.getElementById('mpTitle');
    const coverImg = document.getElementById('mpCover');
    const gearBtn = document.getElementById('mpGearBtn');
    const playList = document.getElementById('mpPlayList');
    const cur = getCurrentSong ? getCurrentSong() : null;
    if (cur) {
        if (titleEl) titleEl.textContent = `${cur.name}${cur.artist ? ' - ' + cur.artist : ''}`;
        if (coverImg && cur.picUrl) {
            coverImg.src = cur.picUrl;
            coverImg.onerror = function () { this.src = 'img/img6.jpg'; };
        } else if (coverImg && !coverImg.src) {
            coverImg.src = 'img/img6.jpg';
        }
    } else if (titleEl) {
        titleEl.textContent = state.musicPlaylist.length ? '未播放' : '未播放（歌单为空）';
    }
    if (gearBtn) gearBtn.style.display = (state && state.isAdmin) ? '' : 'none';
    if (playList) {
        if (!state.musicPlaylist.length) {
            playList.innerHTML = `<li class="mp-item" style="justify-content:center; color:#94a3b8; padding:20px 10px; font-size:13px; text-align:center;">🎵 歌单为空，管理员可在管理模式下搜索并添加歌曲</li>`;
        } else {
            const idx = Number(state.curSongIdx) || 0;
            playList.innerHTML = (state.musicPlaylist || []).map((s, i) => `
                <li data-mp-idx="${i}" class="${i === idx ? 'is-active' : ''}">
                    <span class="mp-song-name">${s.name}</span>
                    <span class="mp-song-artist">${s.artist || ''}</span>
                </li>
            `).join('');
        }
    }
    updateMusicStatus();
}

/**
 * 根据索引播放一首歌曲：通过网易云 API 获取播放地址 → 赋值给 bgAudio.src → play()
 * @param {number} idx 播放列表下标
 * @param {boolean} autoPlay 是否自动播放（默认 true）
 */
let _isChangingSong = false;

/**
 * 根据索引播放一首歌曲：通过网易云 API 获取播放地址 → 赋值给 bgAudio.src → play()
 * @param {number} idx 播放列表下标
 * @param {boolean} autoPlay 是否自动播放（默认 true）
 */
function playSongByIndex(idx, autoPlay) {
    if (typeof loadMusicFromStorage === 'function' && !state.musicPlaylist.length) loadMusicFromStorage();
    const list = state.musicPlaylist || [];
    if (!list.length) return Promise.resolve(false);
    const i = Number(idx);
    const iFixed = Number.isInteger(i) && i >= 0 ? Math.min(i, list.length - 1) : 0;
    state.curSongIdx = iFixed;
    const meta = list[iFixed];
    if (!meta) return Promise.resolve(false);
    const audio = document.getElementById('bgAudio');
    if (!audio) return Promise.resolve(false);
    const titleEl = document.getElementById('mpTitle');
    const coverImg = document.getElementById('mpCover');
    if (titleEl) titleEl.textContent = `${meta.name}${meta.artist ? ' - ' + meta.artist : ''}`;
    if (coverImg && meta.picUrl) {
        coverImg.src = meta.picUrl;
        coverImg.onerror = function () { this.src = 'img/img6.jpg'; };
    }

    _isChangingSong = true;

    // 1) 同步指派音源 URL（防浏览器跨异步 Promise 阻断用户手势授权导致的立刻暂停）
    let targetUrl = meta.url || '';
    if (!targetUrl && meta.id) {
        targetUrl = `https://api.injahow.cn/meting/?type=url&id=${meta.id}`;
    }

    const shouldPlay = (autoPlay === undefined) ? true : !!autoPlay;

    if (targetUrl) {
        audio.src = targetUrl;
        localStorage.removeItem('bgAudioTime');
        state.musicPlaying = shouldPlay;
        localStorage.setItem(STORAGE_KEYS.musicPlaying, shouldPlay ? 'true' : 'false');
        renderMusicPlayerUI();
        if (shouldPlay) {
            const p = audio.play();
            if (p && typeof p.catch === 'function') {
                p.catch(err => {
                    console.warn('[播放拦截，尝试备用音源]', err);
                    _isChangingSong = false;
                });
            }
        } else {
            audio.pause();
        }
        setTimeout(() => { _isChangingSong = false; }, 400);
        return Promise.resolve(true);
    }

    // 2) 备用异步解析通路
    return (typeof getNeteaseSongUrl === 'function' ? getNeteaseSongUrl(meta, 192) : Promise.resolve({ url: null, reason: 'no-url' }))
        .then(result => {
            const url = result ? result.url : null;
            if (!url) {
                _isChangingSong = false;
                alert(`无法获取「${meta.name}」的播放地址，请切换其他歌曲。`);
                return false;
            }
            audio.src = url;
            localStorage.removeItem('bgAudioTime');
            state.musicPlaying = shouldPlay;
            localStorage.setItem(STORAGE_KEYS.musicPlaying, shouldPlay ? 'true' : 'false');
            renderMusicPlayerUI();
            if (shouldPlay) {
                const p = audio.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
            } else {
                audio.pause();
            }
            setTimeout(() => { _isChangingSong = false; }, 400);
            return true;
        });
}

/** 统一播放/暂停切换控制（保证绝对可切换且可暂停） */
function toggleMusicPlayPause() {
    const audio = document.getElementById('bgAudio');
    if (!audio) return;

    // 1) 如果当前记录为正在播放状态，点击必须触发暂停
    if (state.musicPlaying && (!audio.paused || audio.src)) {
        audio.pause();
        state.musicPlaying = false;
        localStorage.setItem(STORAGE_KEYS.musicPlaying, 'false');
        updateMusicStatus();
        return;
    }

    // 2) 如果未装载有效音频 src，指派播放当前选中歌曲
    const hasValidSrc = (typeof isAudioUrlValid === 'function') ? isAudioUrlValid(audio.src) : (audio.src && !audio.src.startsWith('data:') && !audio.src.endsWith('.html'));
    if (!hasValidSrc) {
        playSongByIndex(state.curSongIdx || 0, true);
    } else {
        state.musicPlaying = true;
        localStorage.setItem(STORAGE_KEYS.musicPlaying, 'true');
        updateMusicStatus();
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
            p.catch(err => {
                console.warn('[播放被拦截，重新取流]', err);
                playSongByIndex(state.curSongIdx || 0, true);
            });
        }
    }
}

function initMusicPlayer() {
    const audio = document.getElementById('bgAudio');
    const progressWrap = document.getElementById('musicProgress');
    const progressBar = document.getElementById('musicProgressBar');
    const timeCur = document.getElementById('musicTimeCur');
    const timeTot = document.getElementById('musicTimeTot');
    const timeCur2 = document.getElementById('musicTimeCur2');
    const timeTot2 = document.getElementById('musicTimeTot2');
    const musicClose = document.getElementById('musicClose');

    if (!audio) return;

    // 1) 播放状态同步（防伪 pause 触发导致立刻暂停）
    audio.addEventListener('play', () => {
        state.musicPlaying = true;
        localStorage.setItem(STORAGE_KEYS.musicPlaying, 'true');
        updateMusicStatus();
    });
    audio.addEventListener('pause', () => {
        // 过滤切歌/设置src时浏览器自动触发的伪 pause 事件
        if (_isChangingSong || audio.readyState === 0 || !audio.src) return;
        state.musicPlaying = false;
        localStorage.setItem(STORAGE_KEYS.musicPlaying, 'false');
        updateMusicStatus();
    });
    // 2) 歌曲加载完：显示总时长，恢复上次播放时间
    audio.addEventListener('loadedmetadata', () => {
        const totStr = secToTime(audio.duration);
        if (timeTot) timeTot.textContent = totStr;
        if (timeTot2) timeTot2.textContent = totStr;
        const saved = Number(localStorage.getItem('bgAudioTime') || 0);
        if (saved && saved < audio.duration) audio.currentTime = saved;
    });
    // 3) 播放中：进度条 + 当前时间 + 持久化位置
    audio.addEventListener('timeupdate', () => {
        const pct = (audio.currentTime / (audio.duration || 1)) * 100;
        if (progressBar) progressBar.style.width = pct + '%';
        const curStr = secToTime(audio.currentTime);
        if (timeCur) timeCur.textContent = curStr;
        if (timeCur2) timeCur2.textContent = curStr;
        localStorage.setItem('bgAudioTime', Math.floor(audio.currentTime));
    });
    // 4) 点击进度条跳转（顶栏细进度条）
    if (progressWrap) {
        progressWrap.addEventListener('click', e => {
            const rect = progressWrap.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            audio.currentTime = pct * (audio.duration || 0);
        });
    }
    // 5) 一首播完 → 自动下一首
    audio.addEventListener('ended', () => {
        stepSong(1);
        playSongByIndex(state.curSongIdx, true);
    });
    // 6) 兼容旧 #musicClose 按钮（如果存在）
    if (musicClose) musicClose.addEventListener('click', closeMusic);
    // 7) 点击封面 = 切换播放/暂停
    const coverBtn = document.getElementById('mpInlineCoverBtn');
    if (coverBtn) {
        coverBtn.addEventListener('click', toggleMusicPlayPause);
    }
    // 8) 第一次进入：渲染 UI；如果上次正在播放则恢复
    setTimeout(() => {
        if (!state.musicPlaylist.length && typeof loadMusicFromStorage === 'function') loadMusicFromStorage();
        renderMusicPlayerUI();
        if (state.musicPlaying && (!audio.src || audio.src.startsWith('data:'))) {
            playSongByIndex(state.curSongIdx || 0, true);
        }
    }, 120);
}

// ========== 主区域内联视图切换 (list / detail / editor) ==========

let currentViewerArticleId = null;

function switchView(viewName) {
    // 切换任何视图时，必定关闭抽屉并解除页面滚动锁
    if (typeof closeMobileDrawer === 'function') {
        closeMobileDrawer();
    }
    document.body.style.overflow = '';
    document.body.style.removeProperty('overflow');

    // 兼容别名：'admin' / 'adminControl' 都可打开控制台
    let view = String(viewName || 'list');
    if (view === 'admin') view = 'adminControl';
    if (!(view === 'list' || view === 'detail' || view === 'editor' || view === 'adminControl' || view === 'gallery' || view === 'trash' || view === 'space')) {
        view = 'list';
    }

    const listView = document.getElementById('listView');
    const detailView = document.getElementById('detailView');
    const editorView = document.getElementById('editorView');
    const adminControlView = document.getElementById('adminControlView');
    const galleryView = document.getElementById('galleryView');
    const trashView = document.getElementById('trashView');
    const spaceView = document.getElementById('spaceView');

    if (!listView || !detailView || !editorView) return;

    listView.style.display = view === 'list' ? 'block' : 'none';
    listView.classList.toggle('active', view === 'list');

    detailView.style.display = view === 'detail' ? 'block' : 'none';
    detailView.classList.toggle('active', view === 'detail');

    editorView.style.display = view === 'editor' ? 'block' : 'none';
    editorView.classList.toggle('active', view === 'editor');

    if (adminControlView) {
        adminControlView.style.display = view === 'adminControl' ? 'block' : 'none';
        adminControlView.classList.toggle('active', view === 'adminControl');
    }

    if (galleryView) {
        galleryView.style.display = view === 'gallery' ? 'block' : 'none';
        galleryView.classList.toggle('active', view === 'gallery');
    }

    if (trashView) {
        trashView.style.display = view === 'trash' ? 'block' : 'none';
        trashView.classList.toggle('active', view === 'trash');
    }

    if (spaceView) {
        spaceView.style.display = view === 'space' ? 'block' : 'none';
        spaceView.classList.toggle('active', view === 'space');
        if (view === 'space' && typeof renderSpaceView === 'function') {
            renderSpaceView();
        }
    }

    // 控制右侧边栏 (.box3) 隐藏与网格布局全宽展开 (.yinying)
    const rightSidebar = document.querySelector('.box3');
    const layout = document.getElementById('pageLayout') || document.querySelector('.yinying');
    
    // 编辑文章 (editor)、控制台 (adminControl)、图床 (gallery)、回收站 (trash)、个人动态 (space) 视图隐藏全局右侧栏
    const hideSidebarViews = ['editor', 'adminControl', 'gallery', 'trash', 'space'];
    const shouldHide = hideSidebarViews.includes(view);

    if (rightSidebar) {
        rightSidebar.style.display = shouldHide ? 'none' : '';
    }
    if (layout) {
        layout.classList.toggle('hide-right-sidebar', shouldHide);
    }

    // 非详情视图时，还原右侧边栏（如果原先生成过 TOC）
    if (view !== 'detail') {
        restoreSidebar();
    }

    // 页面平滑滚动至主区域顶部
    const mainContent = document.getElementById('mainContent') || document.querySelector('main');
    if (mainContent) {
        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ========== 文章详情内联阅读器 ==========

function openArticleViewer(id) {
    const item = getArticleById(id);
    if (!item) return;

    currentViewerArticleId = item.id;
    // 增加阅读数
    item.read = (item.read || 0) + 1;
    saveArticlesToStorage();
    updateStats();

    const titleEl = document.getElementById('inlineDetailTitle');
    const metaEl = document.getElementById('inlineDetailMeta');
    const coverEl = document.getElementById('inlineDetailCover');
    const tagsEl = document.getElementById('inlineDetailTags');
    const contentEl = document.getElementById('inlineDetailContent');
    const adminActions = document.getElementById('detailAdminActions');

    if (titleEl) titleEl.textContent = item.title;
    if (metaEl) {
        metaEl.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; width:100%; margin-bottom:8px;">
                <div class="breadcrumb-nav" style="margin:0;">
                    <span class="breadcrumb-item" onclick="switchView('list'); activeFilters = []; renderArticles();">首页</span>
                    <span class="breadcrumb-separator">/</span>
                    <span class="breadcrumb-item active" onclick="switchView('list'); activeFilters = ['${item.category}']; renderArticles();">${item.category}</span>
                </div>
                <div class="article-tools" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                    <button type="button" class="secondary-btn" onclick="exportArticlePDF()" title="打印 / 导出 PDF" style="padding:5px 12px; font-size:12px; border-radius:999px; display:inline-flex; align-items:center; gap:4px;">
                        ${getIcon('print', '', 14)} <span>打印 PDF</span>
                    </button>
                    <button type="button" class="secondary-btn" onclick="downloadArticleMD('${item.id}')" title="下载为 .md 文件" style="padding:5px 12px; font-size:12px; border-radius:999px; display:inline-flex; align-items:center; gap:4px;">
                        ${getIcon('download', '', 14)} <span>下载 .md</span>
                    </button>
                    <button type="button" class="secondary-btn" onclick="copyArticleShareLink('${item.id}')" title="复制分享链接" style="padding:5px 12px; font-size:12px; border-radius:999px; display:inline-flex; align-items:center; gap:4px;">
                        ${getIcon('share', '', 14)} <span>分享</span>
                    </button>
                </div>
            </div>
            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; color:var(--text-muted); font-size:13px; margin-top:4px;">
                <span>${getIcon('calendar', '', 14)} 发布日期：${formatDate(item.date)}</span> · 
                <span>${getIcon('like', '', 14)} 阅读 (${item.read})</span> · 
                <span style="cursor:pointer; color:var(--primary);" onclick="scrollToComments()">${getIcon('comment', '', 14)} 评论 (${item.comment})</span>
            </div>
        `;
    }

    if (coverEl) {
        // 仅显示真实封面；无封面时不显示封面图
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
            `<span class="tag-item" data-tag="${tag}">${tag}</span>`
        ).join(' ');
        tagsEl.querySelectorAll('.tag-item[data-tag]').forEach(tagEl => {
            tagEl.addEventListener('click', () => {
                toggleFilter(tagEl.dataset.tag);
                switchView('list');
            });
        });
    }

    if (contentEl) {
        const contentHtml = item.content ? parseMarkdown(item.content) : `<p>${item.summary}</p>`;
        contentEl.innerHTML = contentHtml;
    }

    if (adminActions) {
        adminActions.style.display = state.isAdmin ? 'inline-flex' : 'none';
    }

    // —— 详情页：内容下方居中 → 点赞 / 收藏 按钮 ——
    renderDetailLikeFavoriteBar(item);

    renderInlineArticleComments(item.id);
    switchView('detail');

    // 生成右侧边栏目录 (TOC)
    generateTOC('inlineDetailContent');
}

/**
 * 刷新文章详情页底部的"点赞/收藏"按钮显示与交互（状态变化后可重复调用）。
 * 功能：读取 liked / favorited，切换按钮的激活样式和文字；绑定点击事件（去重）。
 */
function renderDetailLikeFavoriteBar(item) {
    if (!item) return;
    const bar = document.getElementById('detailLikeFavoriteBar');
    if (!bar) return;

    const liked = Array.isArray(state.likes) && state.likes.includes(item.id);
    const favorited = Array.isArray(state.favorites) && state.favorites.includes(item.id);

    // 点赞按钮：状态 + 文案 + 爆炸特效
    const likeBtn = bar.querySelector('[data-viewer-action="like"]');
    if (likeBtn) {
        const textEl = likeBtn.querySelector('.btn-text');
        if (textEl) textEl.textContent = liked ? '已点赞' : '点赞';
        likeBtn.classList.toggle('is-active', liked);
        likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
        likeBtn.setAttribute('title', liked ? '取消对这篇文章的点赞' : '为这篇文章点赞');
        likeBtn.onclick = (e) => {
            toggleLike(item.id);
            if (!liked) {
                triggerBurstEffect(e, 'heart');
            }
            renderDetailLikeFavoriteBar(getArticleById(item.id));
            refreshDetailMetaIfNeeded(item.id);
        };
    }

    // 收藏按钮：状态 + 文案
    const favBtn = bar.querySelector('[data-viewer-action="favorite"]');
    if (favBtn) {
        const textEl = favBtn.querySelector('.btn-text');
        if (textEl) textEl.textContent = favorited ? '已收藏' : '收藏';
        favBtn.classList.toggle('is-active', favorited);
        favBtn.setAttribute('aria-pressed', favorited ? 'true' : 'false');
        favBtn.setAttribute('title', favorited ? '取消对这篇文章的收藏' : '把这篇文章加入收藏夹');
        favBtn.onclick = () => {
            toggleFavorite(item.id);
            renderDetailLikeFavoriteBar(getArticleById(item.id));
        };
    }
}

// 小工具：详情页"点赞数"随点赞操作变化时，把 inlineDetailMeta 中 👍 后面的数字也同步刷新
function refreshDetailMetaIfNeeded(id) {
    const item = getArticleById(id);
    const metaEl = document.getElementById('inlineDetailMeta');
    if (!item || !metaEl) return;
    metaEl.innerHTML = `
        <span>分类：${item.category}</span> · 
        <span>发布日期：${formatDate(item.date)}</span> · 
        <span>阅读量：${item.read}</span> · 
        <span>评论数：${item.comment}</span>
    `;
}

function renderInlineArticleComments(articleId) {
    const listEl = document.getElementById('inlineArticleCommentList');
    if (!listEl) return;

    const article = getArticleById(articleId);
    if (!article) return;

    if (!article.commentList) article.commentList = [];

    if (article.commentList.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:14px; padding:10px 0;">暂无针对本文的评论，快来抢沙发发表第一条想法吧！</p>';
        return;
    }

    const esc = typeof escHtml === 'function' ? escHtml : (s => String(s == null ? '' : s));
    const contactBadge = c => c.contact
        ? `<span class="comment-contact" title="联系方式：${esc(c.contact)}">${esc(c.contact)}</span>`
        : '';
    const adminDelete = c => state.isAdmin
        ? `<button type="button" class="delete-comment-btn" data-action="delete-comment"
              data-scope="article" data-article-id="${articleId}" data-id="${c.id}"
              title="删除此条评论">🗑️ 删除</button>`
        : '';

    // 只渲染顶级评论
    const topList = (typeof getTopLevelComments === 'function')
        ? getTopLevelComments('article', articleId)
        : article.commentList.filter(c => !c.parentId || Number(c.parentId) === 0);

    // 渲染回复列表
    const renderReplies = (parentId) => {
        const replies = (typeof getReplies === 'function') ? getReplies(parentId, 'article', articleId) : [];
        if (!replies.length) return '';
        return replies.map(r => `
            <div class="comment-reply-item">
                <div class="comment-item-row">
                    <div class="comment-meta" style="flex:1 1 auto;">
                        <div class="comment-byline">
                            <span class="comment-name">${esc(r.name)}</span>${contactBadge(r)}
                        </div>
                        <div style="opacity:0.75; margin-top:2px;">${esc(r.date || '刚刚')}</div>
                    </div>
                    ${adminDelete(r)}
                </div>
                <div style="font-size:14px; color:#334155; line-height:1.6;">${esc(r.content)}</div>
            </div>
        `).join('');
    };

    listEl.innerHTML = topList.map(c => `
        <div class="comment-item" data-comment-id="${c.id}">
            <div class="comment-item-row">
                <div class="comment-meta" style="flex:1 1 auto;">
                    <div class="comment-byline">
                        <span class="comment-name">${esc(c.name)}</span>${contactBadge(c)}
                    </div>
                    <div style="opacity:0.75; margin-top:2px;">${esc(c.date || '刚刚')}</div>
                </div>
                ${adminDelete(c)}
            </div>
            <div style="font-size:14px; color:#334155; line-height:1.6;">${esc(c.content)}</div>
            <div class="comment-actions">
                <button type="button" class="reply-toggle-btn" data-action="toggle-reply" data-scope="article" data-article-id="${articleId}" data-id="${c.id}" title="回复此评论">回复</button>
            </div>
            <div class="comment-reply-box" data-reply-box="${c.id}" style="display:none;">
                <textarea class="reply-textarea" rows="2" placeholder="写下你的回复..." data-reply-input="${c.id}"></textarea>
                <div class="reply-box-actions">
                    <button type="button" class="reply-submit-btn" data-action="submit-reply" data-scope="article" data-article-id="${articleId}" data-id="${c.id}">发表回复</button>
                    <button type="button" class="reply-cancel-btn" data-action="cancel-reply" data-id="${c.id}">取消</button>
                </div>
            </div>
            <div class="comment-reply-list" data-reply-list="${c.id}">
                ${renderReplies(c.id)}
            </div>
        </div>
    `).join('');
}

function closeArticleViewer() {
    currentViewerArticleId = null;
    switchView('list');
}

function editFromViewer() {
    if (!currentViewerArticleId) return;
    const article = getArticleById(currentViewerArticleId);
    openArticleEditor(article);
}

// ========== 文章编辑器 (主区域内联编辑) ==========

let currentCoverMode = 'url'; // 'url' | 'file' | 'none'
let tempCoverDataUrl = '';

function updateCoverPreview(src) {
    const wrap = document.getElementById('coverPreviewWrap');
    const img = document.getElementById('coverPreviewImg');
    if (!wrap || !img) return;

    if (src && src.trim()) {
        img.src = src.trim();
        wrap.style.display = 'block';
    } else {
        wrap.style.display = 'none';
        img.src = '';
    }
}

function setCoverMode(mode) {
    currentCoverMode = mode;
    const tabUrl = document.getElementById('coverTabUrl');
    const tabFile = document.getElementById('coverTabFile');
    const tabNone = document.getElementById('coverTabNone');
    const urlPane = document.getElementById('coverUrlPane');
    const filePane = document.getElementById('coverFilePane');
    const coverInput = document.getElementById('inlineArticleCover');

    if (tabUrl) tabUrl.classList.toggle('active', mode === 'url');
    if (tabFile) tabFile.classList.toggle('active', mode === 'file');
    if (tabNone) tabNone.classList.toggle('active', mode === 'none');

    if (urlPane) urlPane.style.display = mode === 'url' ? 'block' : 'none';
    if (filePane) filePane.style.display = mode === 'file' ? 'block' : 'none';

    if (mode === 'none') {
        if (coverInput) coverInput.value = '';
        tempCoverDataUrl = '';
        updateCoverPreview('');
    } else if (mode === 'url') {
        updateCoverPreview(coverInput ? coverInput.value : '');
    } else if (mode === 'file') {
        updateCoverPreview(tempCoverDataUrl);
    }
}

// ========== 文章草稿自动保存 (防丢失机制) ==========

let autoSaveTimer = null;

function saveArticleDraft() {
    const titleInput = document.getElementById('inlineArticleTitle');
    const categoryInput = document.getElementById('inlineArticleCategory');
    const tagsInput = document.getElementById('inlineArticleTags');
    const coverInput = document.getElementById('inlineArticleCover');
    const statusEl = document.getElementById('editorAutoSaveStatus');

    const title = titleInput ? titleInput.value.trim() : '';
    const category = categoryInput ? categoryInput.value.trim() : '';
    const tags = tagsInput ? tagsInput.value.trim() : '';
    const cover = currentCoverMode === 'file' ? tempCoverDataUrl : (coverInput ? coverInput.value.trim() : '');
    const content = getLiveMarkdownContent();

    // 如果未输入任何内容且没处于编辑现有文章状态，不保存
    if (!title && !content && !cover && !currentEditingArticleId) {
        if (statusEl) statusEl.textContent = '💾 实时防丢自动保存开启';
        return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const draftData = {
        editingId: currentEditingArticleId,
        title,
        category,
        tags,
        coverMode: currentCoverMode,
        cover,
        content,
        savedAt: timeStr,
        timestamp: Date.now()
    };

    try {
        localStorage.setItem(STORAGE_KEYS.articleDraft, JSON.stringify(draftData));
        if (statusEl) {
            statusEl.textContent = `💾 已自动保存草稿 (${timeStr})`;
            statusEl.style.color = '#10b981';
            statusEl.style.background = 'rgba(16, 185, 129, 0.1)';
        }
    } catch (e) {
        console.warn('草稿自动保存超限:', e);
    }
}

function triggerAutoSave() {
    const statusEl = document.getElementById('editorAutoSaveStatus');
    if (statusEl) {
        statusEl.textContent = '✍️ 正在自动保存中...';
        statusEl.style.color = '#3b82f6';
        statusEl.style.background = 'rgba(59, 130, 246, 0.1)';
    }
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveArticleDraft, 600);
}

function clearArticleDraft() {
    localStorage.removeItem(STORAGE_KEYS.articleDraft);
    const statusEl = document.getElementById('editorAutoSaveStatus');
    if (statusEl) {
        statusEl.textContent = '💾 实时防丢自动保存开启';
        statusEl.style.color = '#2563eb';
        statusEl.style.background = 'rgba(37,99,235,0.1)';
    }
}

let vditorInstance = null;

function initVditor(initialValue = '') {
    const vditorContainer = document.getElementById('vditor');
    if (!vditorContainer || typeof Vditor === 'undefined') return;

    if (vditorInstance) {
        vditorInstance.setValue(initialValue);
        return;
    }

    const isDark = (state && state.theme === 'dark');

    vditorInstance = new Vditor('vditor', {
        height: 580,
        mode: 'ir', // Instant Rendering (Typora 实时即时渲染模式)
        placeholder: '在此处像 Typora 一样直接书写文章，支持拖拽图片自动存入图册并引用、输入 # 标题、**加粗**、> 引用、- 列表、代码块、表格等...',
        theme: isDark ? 'dark' : 'classic',
        preview: {
            theme: {
                current: isDark ? 'dark' : 'light'
            },
            hljs: {
                enable: true,
                style: isDark ? 'dracula' : 'github',
                lineNumber: true,
                defaultLang: 'python', // 点击代码块工具默认使用 python 语言
                langs: ['python', 'c', 'cpp', 'javascript', 'typescript', 'html', 'css', 'bash', 'json', 'sql', 'java', 'go', 'rust']
            }
        },
        toolbarConfig: {
            pin: true
        },
        cache: {
            enable: false
        },
        input() {
            triggerAutoSave();
        },
        upload: {
            accept: 'image/*',
            multiple: true,
            handler(files) {
                if (!files || !files.length) return Promise.resolve('');
                
                const statusEl = document.getElementById('editorAutoSaveStatus');
                if (statusEl) {
                    statusEl.textContent = '🖼️ 正在将图片上传保存至图册...';
                    statusEl.style.color = '#3b82f6';
                    statusEl.style.background = 'rgba(59, 130, 246, 0.1)';
                }

                const promises = Array.from(files).map((file, idx) => {
                    return new Promise((res) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const dataUrl = e.target.result;
                            // 确定简洁数据名 (如 my_photo.png) 与 相对路径 (如 img/my_photo.png)
                            const rawFileName = (file.name || `image_${Date.now()}_${idx + 1}`).replace(/\s+/g, '_');
                            const cleanDataName = rawFileName;
                            const relativePath = rawFileName.startsWith('img/') ? rawFileName : `img/${rawFileName}`;

                            // 1. 自动存入本地「图册 / 图床」 (getGalleryImages & saveGalleryImages)
                            let images = (typeof getGalleryImages === 'function') ? getGalleryImages() : [];
                            images.unshift(dataUrl);
                            if (typeof saveGalleryImages === 'function') {
                                saveGalleryImages(images);
                            }

                            // 2. 将数据名与相对路径均关联映射至 DataURL
                            if (typeof setGalleryImageName === 'function') {
                                setGalleryImageName(dataUrl, cleanDataName);
                                setGalleryImageName(dataUrl, relativePath);
                            }

                            // 3. 如果打开了图册视图，即时刷新图册列表
                            if (typeof renderGallery === 'function') {
                                renderGallery();
                            }

                            res({ imageName: cleanDataName, relativePath, url: dataUrl });
                        };
                        reader.readAsDataURL(file);
                    });
                });

                return Promise.all(promises).then((results) => {
                    // 写入包含简洁数据名 (alt) 与 相对路径 (src) 的 Markdown 语法：![简洁数据名](img/相对路径)
                    results.forEach(item => {
                        if (vditorInstance) {
                            vditorInstance.insertValue(`![${item.imageName}](${item.relativePath})\n`);
                        }
                    });

                    if (typeof triggerAutoSave === 'function') {
                        triggerAutoSave();
                    }

                    if (statusEl) {
                        statusEl.textContent = `🖼️ 已成功上传 ${results.length} 张图片存入图册并引用`;
                        statusEl.style.color = '#10b981';
                        statusEl.style.background = 'rgba(16, 185, 129, 0.1)';
                    }

                    return null;
                });
            }
        },
        toolbar: [
            'headings', 'bold', 'italic', 'strike', 'link', '|',
            'list', 'ordered-list', 'check', 'quote', '|',
            'code', 'inline-code', 'table', 'line', '|',
            'upload', 'record', '|',
            'undo', 'redo', '|',
            'outline', 'preview', 'fullscreen', 'edit-mode'
        ],
        after() {
            if (initialValue) {
                vditorInstance.setValue(initialValue);
            }
            bindVditorImageClickSelection();
        }
    });
}

function bindVditorImageClickSelection() {
    const vditorContainer = document.getElementById('vditor');
    if (!vditorContainer || vditorContainer.__imageClickBound) return;
    vditorContainer.__imageClickBound = true;

    vditorContainer.addEventListener('click', (e) => {
        let target = e.target;
        if (!target) return;
        
        if (target.tagName === 'IMG' || target.classList.contains('vditor-ir__node--img') || target.closest('.vditor-ir__node--img')) {
            const imgNode = target.closest('.vditor-ir__node--img') || target.closest('.vditor-ir__node') || target.parentNode;
            if (imgNode) {
                try {
                    const range = document.createRange();
                    range.selectNode(imgNode);
                    const sel = window.getSelection();
                    if (sel) {
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                } catch (err) {
                    console.warn('选区选中失败:', err);
                }

                document.querySelectorAll('.vditor-img-selected').forEach(el => el.classList.remove('vditor-img-selected'));
                imgNode.classList.add('vditor-img-selected');
            }
        } else {
            document.querySelectorAll('.vditor-img-selected').forEach(el => el.classList.remove('vditor-img-selected'));
        }
    });
}

function setLiveMarkdownContent(editorEl, contentStr) {
    if (vditorInstance) {
        vditorInstance.setValue(contentStr || '');
    } else {
        initVditor(contentStr || '');
    }
}

function getLiveMarkdownContent(editorEl) {
    if (vditorInstance) {
        return vditorInstance.getValue().trim();
    }
    return '';
}

function openArticleEditor(article) {
    currentEditingArticleId = article ? article.id : null;
    tempCoverDataUrl = '';

    const titleInput = document.getElementById('inlineArticleTitle');
    const categoryInput = document.getElementById('inlineArticleCategory');
    const tagsInput = document.getElementById('inlineArticleTags');
    const coverInput = document.getElementById('inlineArticleCover');
    const formTitleEl = document.getElementById('editorFormTitle');

    if (formTitleEl) {
        formTitleEl.textContent = article ? `编辑文章：${article.title}` : '新增文章';
    }

    if (titleInput) titleInput.value = article ? article.title : '';
    const rawCat = article && article.category ? article.category : '';
    if (categoryInput) categoryInput.value = rawCat;
    if (typeof refreshCategorySelectUI === 'function') refreshCategorySelectUI(rawCat);
    const initialTags = article && article.tags ? article.tags : [];
    if (typeof renderTagPickerUI === 'function') renderTagPickerUI(rawCat, initialTags);
    if (tagsInput) tagsInput.value = '';
    
    let rawContent = article ? (article.content || article.summary) : '';

    // 如果是新增文章且未传参，检查是否有上次未保存的草稿
    if (!article) {
        const rawDraft = localStorage.getItem(STORAGE_KEYS.articleDraft);
        if (rawDraft) {
            try {
                const draft = JSON.parse(rawDraft);
                if (draft && (draft.title || draft.content)) {
                    if (confirm(`检测到您上次于 ${draft.savedAt} 编辑的未保存文章草稿，是否恢复？`)) {
                        if (titleInput) titleInput.value = draft.title || '';
                        const draftCat = draft.category || '';
                        if (categoryInput) categoryInput.value = draftCat;
                        if (typeof refreshCategorySelectUI === 'function') refreshCategorySelectUI(draftCat);
                        if (tagsInput) tagsInput.value = draft.tags || '';
                        if (draft.cover) {
                            if (draft.cover.startsWith('data:image')) {
                                tempCoverDataUrl = draft.cover;
                                setCoverMode('file');
                            } else {
                                if (coverInput) coverInput.value = draft.cover;
                                setCoverMode('url');
                            }
                        }
                        rawContent = draft.content || '';
                    } else {
                        clearArticleDraft();
                    }
                }
            } catch (e) {
                console.warn('解析草稿失败:', e);
            }
        }
    }

    setLiveMarkdownContent(null, rawContent);

    const coverVal = article && article.cover ? article.cover : '';
    if (coverInput && !tempCoverDataUrl) coverInput.value = coverVal;

    if (!coverVal && !tempCoverDataUrl) {
        setCoverMode('none');
    } else if (tempCoverDataUrl || coverVal.startsWith('data:image')) {
        setCoverMode('file');
    } else {
        setCoverMode('url');
    }

    switchView('editor');
}

function closeArticleEditor() {
    if (currentViewerArticleId) {
        switchView('detail');
    } else {
        switchView('list');
    }
}

function resetArticleEditor() {
    const titleInput = document.getElementById('inlineArticleTitle');
    const categoryInput = document.getElementById('inlineArticleCategory');
    const tagsInput = document.getElementById('inlineArticleTags');
    const coverInput = document.getElementById('inlineArticleCover');

    if (titleInput) titleInput.value = '';
    if (categoryInput) categoryInput.value = '';
    if (tagsInput) tagsInput.value = '';
    if (coverInput) coverInput.value = '';
    if (vditorInstance) vditorInstance.setValue('');
    tempCoverDataUrl = '';
    setCoverMode('none');
    clearArticleDraft();
    if (typeof refreshCategorySelectUI === 'function') refreshCategorySelectUI('');
    if (typeof renderTagPickerUI === 'function') renderTagPickerUI('', []);
}

function saveArticle() {
    const titleInput = document.getElementById('inlineArticleTitle');
    const categoryInput = document.getElementById('inlineArticleCategory');
    const coverInput = document.getElementById('inlineArticleCover');

    const title = titleInput ? titleInput.value.trim() : '';
    const category = categoryInput ? categoryInput.value.trim() || '随笔' : '随笔';
    const tags = typeof collectTagsFromPickerAndInput === 'function'
        ? collectTagsFromPickerAndInput()
        : ['随笔'];
    const finalTags = tags.length ? tags : ['随笔'];
    const markdown = getLiveMarkdownContent();

    let cover = '';
    if (currentCoverMode === 'url') {
        cover = coverInput ? coverInput.value.trim() : '';
    } else if (currentCoverMode === 'file') {
        cover = tempCoverDataUrl;
    } else {
        cover = '';
    }

    if (!title || !markdown) {
        alert('请填写文章标题和正文内容');
        return;
    }

    // 提纯纯文本摘要：剥离 Markdown 标记，只截取部分文本并追加省略号 ...
    const plainSnippet = markdown
        .replace(/#+\s+/g, '')
        .replace(/[*_~`>#+\-\[\]()!|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const summary = plainSnippet.length > 100 ? plainSnippet.slice(0, 100) + '...' : (plainSnippet || '无摘要内容');
    const newData = { title, category, tags: finalTags, cover, content: markdown, summary };

    // —— 判断是否从回收站"编辑再发布"——
    let isEditingFromTrash = false;
    const trashId = Number(window.__editingFromTrashId || 0) || null;
    if (trashId && typeof getTrashById === 'function' && getTrashById(trashId)) {
        isEditingFromTrash = true;
    } else if (currentEditingArticleId
               && typeof getArticleById === 'function' && !getArticleById(currentEditingArticleId)
               && typeof getTrashById === 'function' && getTrashById(currentEditingArticleId)) {
        isEditingFromTrash = true;
        window.__editingFromTrashId = currentEditingArticleId;
    }

    let savedArticle = null;
    if (isEditingFromTrash) {
        const target = Number(window.__editingFromTrashId) || Number(currentEditingArticleId) || 0;
        if (target && typeof restoreFromTrash === 'function') {
            savedArticle = restoreFromTrash(target, newData);
        }
        window.__editingFromTrashId = null;
    } else if (currentEditingArticleId) {
        savedArticle = updateArticle(currentEditingArticleId, newData);
    } else {
        savedArticle = createArticle(Object.assign({ date: new Date().toISOString().slice(0,10) }, newData));
    }

    if (typeof syncCategoriesFromArticles === 'function') syncCategoriesFromArticles();

    clearArticleDraft();
    resetArticleEditor();
    renderAll();

    if (savedArticle) {
        openArticleViewer(savedArticle.id);
    } else {
        switchView('list');
    }
}

// ========== 文章编辑器：分类下拉 + 标签多选联动 ==========

/**
 * 重填「分类」下拉选项。selectedValue：如果是自定义分类（不在 state.categories 里），
 * 则作为一个临时 option 附加上去，保证回填成功。
 */
/**
 * 刷新「分类」选择器 UI：同标签一样提供输入框 + 快捷分类胶囊选择
 */
function refreshCategorySelectUI(selectedValue) {
    const input = document.getElementById('inlineArticleCategoryInput');
    const hidden = document.getElementById('inlineArticleCategory');
    const picker = document.getElementById('inlineArticleCategoryPicker');
    const select = document.getElementById('inlineArticleCategorySelect');

    const sel = (selectedValue || (hidden ? hidden.value : '') || (input ? input.value : '') || '').toString().trim();

    if (input) input.value = sel;
    if (hidden) hidden.value = sel;
    if (select) select.value = sel;

    if (!picker) return;

    const cats = Array.isArray(state.categories) ? state.categories.map(c => c.name) : [];
    if (sel && cats.indexOf(sel) === -1) {
        cats.push(sel);
    }

    picker.innerHTML = cats.map(cat => {
        const checked = (cat === sel);
        return `<button type="button" class="category-chip" data-cat="${cat}" style="
            display:inline-flex; align-items:center; gap:6px;
            padding:5px 12px; border-radius:999px; cursor:pointer;
            border:1px solid ${checked ? '#2563eb' : '#cbd5e1'};
            background:${checked ? '#2563eb' : '#fff'};
            color:${checked ? '#ffffff' : '#334155'};
            font-size:13px;
            font-weight:${checked ? '600' : '500'};
            transition:all 0.18s ease;
            user-select:none;
            box-shadow:${checked ? '0 1px 3px rgba(37,99,235,0.25)' : 'none'};
        "><span aria-hidden="true" style="
            width:6px; height:6px; border-radius:50%;
            background:${checked ? '#ffffff' : '#cbd5e1'};
            display:inline-block;
        "></span>${cat}</button>`;
    }).join('');

    // 给分类胶囊绑定点击刷新
    picker.querySelectorAll('.category-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const catName = chip.getAttribute('data-cat') || '';
            if (input) input.value = catName;
            if (hidden) hidden.value = catName;

            refreshCategorySelectUI(catName);
            renderTagPickerUI(catName, typeof collectTagsFromPickerAndInput === 'function' ? collectTagsFromPickerAndInput() : []);
            if (typeof triggerAutoSave === 'function') triggerAutoSave();
        });
    });
}

/**
 * 渲染标签 picker：列出选中分类的已有标签（胶囊按钮），支持多选勾选。
 * selectedTagsArr：当前文章已选中的标签数组 → 自动勾选。
 */
function renderTagPickerUI(categoryName, selectedTagsArr) {
    const box = document.getElementById('inlineArticleTagPicker');
    if (!box) return;
    const cat = (categoryName || '').toString().trim();
    const selected = Array.isArray(selectedTagsArr) ? selectedTagsArr.map(t => (t || '').toString().trim()).filter(Boolean) : [];
    const existingTags = cat && (typeof getCategoryTags === 'function')
        ? getCategoryTags(cat)
        : [];
    // 把 selected 中不在 existingTags 里的也展示成自定义勾选
    const extras = selected.filter(t => existingTags.indexOf(t) === -1);
    const all = existingTags.concat(extras);
    if (!all.length) {
        box.innerHTML = cat
            ? `<span style="color:#94a3b8; font-size:13px;">分类「${cat}」暂无自定义标签，可在下方输入框手动输入，或去左侧边栏添加。</span>`
            : `<span style="color:#94a3b8; font-size:13px;">先选择上方的分类，这里会列出该分类下已有标签供勾选。</span>`;
        return;
    }
    box.innerHTML = all.map(tag => {
        const checked = selected.indexOf(tag) !== -1;
        return `<button type="button" class="tag-chip" data-tag="${tag}"${checked ? ' data-checked="1"' : ''} style="
            display:inline-flex; align-items:center; gap:6px;
            padding:6px 14px; border-radius:999px; cursor:pointer;
            border:1px solid ${checked ? '#2563eb' : '#cbd5e1'};
            background:${checked ? '#2563eb' : '#fff'};
            color:${checked ? '#ffffff' : '#334155'};
            font-size:13px;
            font-weight:${checked ? '600' : '500'};
            transition:background 0.18s, color 0.18s, border-color 0.18s, transform 0.12s;
            user-select:none;
            box-shadow:${checked ? '0 1px 3px rgba(37,99,235,0.25)' : 'none'};
        "><span class="tag-chip-dot" aria-hidden="true" style="
            width:6px; height:6px; border-radius:50%;
            background:${checked ? '#ffffff' : '#cbd5e1'};
            display:inline-block;
        "></span>${tag}</button>`;
    }).join('');
    // 给胶囊绑定点击切换勾选
    box.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const isChecked = chip.hasAttribute('data-checked');
            const tag = chip.getAttribute('data-tag') || '';
            const dotEl = chip.querySelector('.tag-chip-dot');
            if (isChecked) {
                chip.removeAttribute('data-checked');
                chip.style.background = '#fff';
                chip.style.color = '#334155';
                chip.style.borderColor = '#cbd5e1';
                chip.style.fontWeight = '500';
                chip.style.boxShadow = 'none';
                if (dotEl) dotEl.style.background = '#cbd5e1';
            } else {
                chip.setAttribute('data-checked', '1');
                chip.style.background = '#2563eb';
                chip.style.color = '#ffffff';
                chip.style.borderColor = '#2563eb';
                chip.style.fontWeight = '600';
                chip.style.boxShadow = '0 1px 3px rgba(37,99,235,0.25)';
                if (dotEl) dotEl.style.background = '#ffffff';
            }

            // 点击胶囊自动同步回文本框，实现无缝联动
            const input = document.getElementById('inlineArticleTags');
            if (input) {
                const currentPicked = collectTagsFromPickerAndInput();
                input.value = currentPicked.join(', ');
                if (typeof triggerAutoSave === 'function') triggerAutoSave();
            }
        });
    });
}

/**
 * 汇总：标签 picker 已勾选 + input 里逗号分隔的自定义标签 → 去重返回数组
 */
function collectTagsFromPickerAndInput() {
    const picked = [];
    const box = document.getElementById('inlineArticleTagPicker');
    if (box) {
        box.querySelectorAll('.tag-chip[data-checked="1"]').forEach(c => {
            const t = (c.getAttribute('data-tag') || '').toString().trim();
            if (t) picked.push(t);
        });
    }
    const tagsInput = document.getElementById('inlineArticleTags');
    if (tagsInput && tagsInput.value) {
        tagsInput.value.split(/[,，]/).forEach(raw => {
            const t = (raw || '').toString().trim();
            if (t) picked.push(t);
        });
    }
    // 去重 + 顺序保留
    const seen = new Set();
    const out = [];
    picked.forEach(t => { if (!seen.has(t)) { seen.add(t); out.push(t); } });
    return out;
}

// ========== 个人资料编辑器 ==========

let currentAvatarMode = 'url';
let tempAvatarDataUrl = '';

function setAvatarMode(mode) {
    currentAvatarMode = mode;
    const tabUrl = document.getElementById('profileTabUrl');
    const tabFile = document.getElementById('profileTabFile');
    const urlPane = document.getElementById('profileUrlPane');
    const filePane = document.getElementById('profileFilePane');
    const avatarInput = document.getElementById('profileAvatarInput');
    const previewImg = document.getElementById('profileAvatarPreviewImg');

    if (tabUrl) tabUrl.classList.toggle('active', mode === 'url');
    if (tabFile) tabFile.classList.toggle('active', mode === 'file');
    if (urlPane) urlPane.style.display = mode === 'url' ? 'block' : 'none';
    if (filePane) filePane.style.display = mode === 'file' ? 'block' : 'none';

    if (previewImg) {
        if (mode === 'file' && tempAvatarDataUrl) {
            previewImg.src = tempAvatarDataUrl;
        } else if (avatarInput && avatarInput.value) {
            previewImg.src = avatarInput.value;
        }
    }
}

function renderSocialEditorList() {
    const container = document.getElementById('profileSocialEditorList');
    if (!container) return;

    const socials = getProfileSocials();
    container.innerHTML = socials.map(item => `
        <div class="social-edit-row">
            <input type="text" class="social-label-input" placeholder="名称(如 QQ/微信)" value="${item.label || ''}" style="width:120px;">
            <input type="text" class="social-value-input" placeholder="内容/链接(如 12345 或 URL)" value="${item.value || ''}" style="flex:1;">
            <button type="button" class="action-btn delete-btn remove-social-row-btn" style="padding:6px 10px;" title="删除此项">🗑️</button>
        </div>
    `).join('');

    container.querySelectorAll('.remove-social-row-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('.social-edit-row');
            if (row) row.remove();
        });
    });
}

function addSocialEditorRow(label = '', value = '') {
    const container = document.getElementById('profileSocialEditorList');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'social-edit-row';
    div.innerHTML = `
        <input type="text" class="social-label-input" placeholder="名称(如 QQ/微信)" value="${label}" style="width:120px;">
        <input type="text" class="social-value-input" placeholder="内容/链接(如 12345 或 URL)" value="${value}" style="flex:1;">
        <button type="button" class="action-btn delete-btn remove-social-row-btn" style="padding:6px 10px;" title="删除此项">🗑️</button>
    `;

    div.querySelector('.remove-social-row-btn').addEventListener('click', () => div.remove());
    container.appendChild(div);
}

function openProfileEditor() {
    moveModalToRoot('profileEditorModal');
    const modal = document.getElementById('profileEditorModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    const nameInput = document.getElementById('profileNameInput');
    const bioInput = document.getElementById('profileBioInput');
    const aboutInput = document.getElementById('profileAboutInput');
    const avatarInput = document.getElementById('profileAvatarInput');
    const previewImg = document.getElementById('profileAvatarPreviewImg');

    if (nameInput) nameInput.value = profile.name || '';
    if (bioInput) bioInput.value = profile.bio || '';
    if (aboutInput) aboutInput.value = profile.about || '';
    if (avatarInput) avatarInput.value = profile.avatar || '';
    if (previewImg) previewImg.src = profile.avatar || defaultProfile.avatar;

    renderSocialEditorList();

    if (profile.avatar && profile.avatar.startsWith('data:image')) {
        tempAvatarDataUrl = profile.avatar;
        setAvatarMode('file');
    } else {
        setAvatarMode('url');
    }
}

function closeProfileEditor() {
    const modal = document.getElementById('profileEditorModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function saveProfileEditor() {
    const nameInput = document.getElementById('profileNameInput');
    const bioInput = document.getElementById('profileBioInput');
    const aboutInput = document.getElementById('profileAboutInput');
    const avatarInput = document.getElementById('profileAvatarInput');

    let avatar = profile.avatar;
    if (currentAvatarMode === 'url') {
        avatar = avatarInput ? avatarInput.value.trim() : defaultProfile.avatar;
    } else if (currentAvatarMode === 'file' && tempAvatarDataUrl) {
        avatar = tempAvatarDataUrl;
    }

    profile.name = nameInput ? nameInput.value.trim() || defaultProfile.name : defaultProfile.name;
    profile.bio = bioInput ? bioInput.value.trim() || defaultProfile.bio : defaultProfile.bio;
    profile.about = aboutInput ? aboutInput.value.trim() || defaultProfile.about : defaultProfile.about;
    profile.avatar = avatar || defaultProfile.avatar;

    // 收集动态社交与联系项
    const rows = document.querySelectorAll('#profileSocialEditorList .social-edit-row');
    const socials = [];
    rows.forEach(row => {
        const labelInput = row.querySelector('.social-label-input');
        const valueInput = row.querySelector('.social-value-input');
        const label = labelInput ? labelInput.value.trim() : '';
        const value = valueInput ? valueInput.value.trim() : '';
        if (label && value) {
            socials.push({ label, value });
        }
    });
    profile.socials = socials;

    saveProfileData();
    renderProfile();
    closeProfileEditor();
}

// ========== 通用弹窗工具 ==========

/** 将 modal 移至 documentElement，避免 body filter 导致 fixed 定位异常 */
function moveModalToRoot(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return modal;
    if (modal.parentNode !== document.documentElement) {
        document.documentElement.appendChild(modal);
    }
    return modal;
}

// ========== 标签云管理器 ==========

function openTagManager() {
    moveModalToRoot('tagManagerModal');
    const modal = document.getElementById('tagManagerModal');
    if (!modal) return;
    renderTagManagerList();
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function closeTagManager() {
    const modal = document.getElementById('tagManagerModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function renderTagManagerList() {
    const container = document.getElementById('tagManageList');
    if (!container) return;

    // 收集所有文章中的唯一标签
    const tagCounts = {};
    articles.forEach(item => {
        (item.tags || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    const tags = Object.keys(tagCounts);

    if (!tags.length) {
        container.innerHTML = '<p style="padding:12px; color:#64748b; font-size:13px;">暂无任何标签。</p>';
        return;
    }

    container.innerHTML = tags.map(tag => `
        <div class="tag-manage-item">
            <span style="font-weight:600; font-size:14px;">${tag} <small style="color:#64748b; font-weight:normal;">(${tagCounts[tag]} 篇)</small></span>
            <div style="display:flex; gap:8px;">
                <button type="button" class="action-btn admin-edit" data-rename-tag="${tag}" style="padding:4px 12px; font-size:12px;">重命名</button>
                <button type="button" class="action-btn delete-btn" data-delete-tag="${tag}" style="padding:4px 12px; font-size:12px;">删除</button>
            </div>
        </div>
    `).join('');

    // 事件绑定
    container.querySelectorAll('button[data-rename-tag]').forEach(btn => {
        btn.addEventListener('click', () => {
            const oldTag = btn.dataset.renameTag;
            const newTag = prompt(`把标签 "${oldTag}" 重命名为：`, oldTag);
            if (newTag && newTag.trim() && newTag.trim() !== oldTag) {
                renameTagInArticles(oldTag, newTag.trim());
            }
        });
    });

    container.querySelectorAll('button[data-delete-tag]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tagToDelete = btn.dataset.deleteTag;
            if (confirm(`确定要在所有文章中移除标签 "${tagToDelete}" 吗？`)) {
                deleteTagFromArticles(tagToDelete);
            }
        });
    });
}

function renameTagInArticles(oldTag, newTag) {
    articles.forEach(item => {
        if (Array.isArray(item.tags)) {
            item.tags = item.tags.map(t => (t === oldTag ? newTag : t));
            item.tags = Array.from(new Set(item.tags));
        }
    });
    saveArticlesToStorage();
    renderAll();
    renderTagManagerList();
}

function deleteTagFromArticles(tagToDelete) {
    articles.forEach(item => {
        if (Array.isArray(item.tags)) {
            item.tags = item.tags.filter(t => t !== tagToDelete);
        }
    });
    saveArticlesToStorage();
    renderAll();
    renderTagManagerList();
}

function addNewGlobalTag(newTag) {
    if (!newTag || !newTag.trim()) return;
    const tag = newTag.trim();
    if (articles.length > 0) {
        if (!articles[0].tags.includes(tag)) {
            articles[0].tags.push(tag);
        }
    }
    saveArticlesToStorage();
    renderAll();
    renderTagManagerList();
}

// ========== 移动端抽屉 ==========

function openMobileDrawer() {
    const drawer = document.getElementById('mobileDrawer');
    if (!drawer) return;
    if (drawer.parentNode !== document.body) {
        document.body.appendChild(drawer);
    }
    drawer.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeMobileDrawer() {
    const drawer = document.getElementById('mobileDrawer');
    if (drawer) {
        drawer.classList.remove('active');
        drawer.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    document.body.style.removeProperty('overflow');
}
window.openMobileDrawer = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;

// ========== 搜索防抖 ==========

function initSearch(inputId, callback) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => callback(input.value.trim()), 300);
    });
}

// ========== 极简 Toast 提示消息 ==========
function showToast(message) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `${getIcon('check', '', 14)} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ========== 动感交互：点赞爆炸特效 ==========
function triggerBurstEffect(event, type = 'heart') {
    let x, y;

    // 优先取触发按钮元素的中心物理坐标
    const targetEl = (event instanceof HTMLElement) 
        ? event 
        : (event && (event.currentTarget || event.target) instanceof HTMLElement 
            ? (event.currentTarget || event.target) 
            : null);

    if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
    } else if (event && typeof event.clientX === 'number' && event.clientX > 0) {
        x = event.clientX;
        y = event.clientY;
    } else {
        x = window.innerWidth / 2;
        y = window.innerHeight / 2;
    }

    const icons = type === 'heart' ? ['❤️', '💖', '✨', '💕', '⭐', '🌸'] : ['✨', '🌟', '🎉', '💥'];
    const count = 12;

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'like-particle';
        particle.textContent = icons[Math.floor(Math.random() * icons.length)];
        
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 40 + Math.random() * 60;
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed - 30;
        const rot = (Math.random() - 0.5) * 120;

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--dx', `${dx}px`);
        particle.style.setProperty('--dy', `${dy}px`);
        particle.style.setProperty('--rot', `${rot}deg`);

        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 900);
    }
}

// ========== 应用高级主题配置 ==========
function applyThemeCustomizations() {
    // 1. 背景纹理
    document.body.setAttribute('data-bg', state.themeBg || 'gradient');
    // 2. 字体库
    document.body.classList.remove('font-default', 'font-serif', 'font-mono', 'font-rounded');
    if (state.themeFont && state.themeFont !== 'default') {
        document.body.classList.add(`font-${state.themeFont}`);
    }
    // 3. 卡片圆角
    if (state.themeRadius) {
        document.documentElement.style.setProperty('--card-radius', `${state.themeRadius}px`);
    }
    // 4. 玻璃透明度与模糊
    const opacity = (Number(state.themeOpacity) || 75) / 100;
    const blur = Number(state.themeBlur) || 16;
    document.documentElement.style.setProperty('--glass-opacity', opacity);
    document.documentElement.style.setProperty('--glass-blur', `${blur}px`);

    // 5. 颜色 Preset 或 Color Picker
    if (state.themePresetColor) {
        document.documentElement.style.setProperty('--primary', state.themePresetColor);
    }
    // 6. 绳索悬挂粗细
    const ropeWidth = state.themeRopeWidth || localStorage.getItem('themeRopeWidth') || '3.5';
    document.documentElement.style.setProperty('--rope-width', `${ropeWidth}px`);

    // 7. 布局间隙与侧边栏圆角
    const gridGapX = state.themeGridGapX || localStorage.getItem('themeGridGapX') || '6';
    const topGap = state.themeTopGap || localStorage.getItem('themeTopGap') || '8';
    const cardGapY = state.themeCardGapY || localStorage.getItem('themeCardGapY') || '10';
    const sidebarRadius = state.themeSidebarRadius || localStorage.getItem('themeSidebarRadius') || '18';

    document.documentElement.style.setProperty('--grid-gap-x', `${gridGapX}px`);
    document.documentElement.style.setProperty('--top-gap', `${topGap}px`);
    document.documentElement.style.setProperty('--card-gap-y', `${cardGapY}px`);
    document.documentElement.style.setProperty('--sidebar-radius', `${sidebarRadius}px`);

    // 8. 实时联动更新控制面板 Live Preview 调试区示例组件
    const previewStage = document.getElementById('previewStageContainer');
    if (previewStage) {
        previewStage.setAttribute('data-bg', state.themeBg || 'gradient');
    }
    const previewRopeLine = document.getElementById('previewRopeLine');
    if (previewRopeLine) {
        previewRopeLine.style.width = `${ropeWidth}px`;
    }
    const previewBlob1 = document.getElementById('previewBlob1');
    if (previewBlob1 && state.themePresetColor) {
        previewBlob1.style.background = state.themePresetColor;
    }
    const previewCard = document.getElementById('previewSampleCard');
    if (previewCard) {
        previewCard.className = `preview-sample-card ${state.themeFont && state.themeFont !== 'default' ? 'font-' + state.themeFont : ''}`;
    }
}

// ========== 文章目录 (TOC) 生成、树状折叠与随阅读位置自动展开高亮 ==========
function generateTOC(contentElId, sidebarBoxClass = '.box3') {
    const contentEl = document.getElementById(contentElId);
    const box3 = document.querySelector(sidebarBoxClass);
    if (!contentEl || !box3) return;

    // 筛选内容中的标题 h1, h2, h3, h4
    const headings = Array.from(contentEl.querySelectorAll('h1, h2, h3, h4'));
    if (!headings.length) return;

    // 为每个标题注入唯一 ID 锚点
    headings.forEach((h, index) => {
        if (!h.id) {
            h.id = `toc-heading-${index}`;
        }
    });

    // 算法：根据标题 level (1~4) 构建树状结构
    function buildTree(list) {
        const root = { level: 0, children: [] };
        const stack = [root];

        list.forEach(h => {
            const level = parseInt(h.tagName.substring(1), 10);
            const node = {
                id: h.id,
                tag: h.tagName.toLowerCase(),
                text: h.textContent.replace(/#/g, '').trim(),
                level: level,
                element: h,
                children: []
            };

            while (stack.length > 1 && stack[stack.length - 1].level >= level) {
                stack.pop();
            }
            stack[stack.length - 1].children.push(node);
            stack.push(node);
        });

        return root.children;
    }

    // 递归渲染树状 HTML
    function renderTreeHTML(nodes, isRoot = false) {
        if (!nodes || !nodes.length) return '';
        const listClass = isRoot ? 'toc-tree' : 'toc-sub-tree';
        const itemsHtml = nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            const toggleBtnHtml = hasChildren
                ? `<button type="button" class="toc-toggle-btn" title="点击折叠/展开子目录">
                    ${getIcon('chevron-right', 'toc-arrow', 12)}
                   </button>`
                : `<span style="width:16px; display:inline-block;"></span>`;

            return `
                <li class="toc-item toc-level-${node.level}" data-id="${node.id}" data-level="${node.level}">
                    <div class="toc-node-wrapper">
                        ${toggleBtnHtml}
                        <a href="#${node.id}" class="toc-link toc-${node.tag}" data-heading-id="${node.id}">
                            ${node.text}
                        </a>
                    </div>
                    ${hasChildren ? renderTreeHTML(node.children, false) : ''}
                </li>
            `;
        }).join('');

        return `<ul class="${listClass}">${itemsHtml}</ul>`;
    }

    const treeData = buildTree(headings);
    const tocTreeHtml = renderTreeHTML(treeData, true);

    const tocCardHtml = `
        <div class="box3-card sidebar-section toc-card" id="articleTocCard">
            <div class="toc-title">
                <span style="display:flex; align-items:center; gap:6px;">
                    ${getIcon('list', '', 16)}
                    <span>文章目录</span>
                </span>
                <button type="button" class="secondary-btn" id="tocFoldAllBtn" style="padding:2px 8px; font-size:11px; border-radius:999px;">全部折叠</button>
            </div>
            ${tocTreeHtml}
        </div>
    `;

    // 暂存侧边栏原有 DOM 结构并替换为 TOC
    if (!box3.dataset.originalContent) {
        box3.dataset.originalContent = box3.innerHTML;
    }
    box3.innerHTML = tocCardHtml;

    const tocCard = document.getElementById('articleTocCard');
    const tocLinks = box3.querySelectorAll('.toc-link');
    const toggleBtns = box3.querySelectorAll('.toc-toggle-btn');
    const foldAllBtn = document.getElementById('tocFoldAllBtn');

    // 折叠/展开切换辅助逻辑
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.toc-item');
            if (item) {
                item.classList.toggle('is-collapsed');
            }
        });
    });

    // 全部折叠/展开切换
    let isAllFolded = false;
    if (foldAllBtn) {
        foldAllBtn.addEventListener('click', () => {
            isAllFolded = !isAllFolded;
            foldAllBtn.textContent = isAllFolded ? '全部展开' : '全部折叠';
            box3.querySelectorAll('.toc-item').forEach(item => {
                if (item.querySelector('.toc-sub-tree')) {
                    item.classList.toggle('is-collapsed', isAllFolded);
                }
            });
        });
    }

    // 绑定点击平滑跳转与高亮
    tocLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const targetId = link.getAttribute('data-heading-id');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // 确保点击的链接及其父节点被展开
                let parentItem = link.closest('.toc-item');
                while (parentItem) {
                    parentItem.classList.remove('is-collapsed');
                    parentItem = parentItem.parentElement ? parentItem.parentElement.closest('.toc-item') : null;
                }
                tocLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });

    // 监听页面滚动，同步高亮当前阅读位置对应目录项，并【随阅读位置逐级展开标题】
    window.removeEventListener('scroll', window._tocScrollHandler);
    window._tocScrollHandler = () => {
        let currentId = '';
        headings.forEach(h => {
            const rect = h.getBoundingClientRect();
            if (rect.top <= 140) {
                currentId = h.id;
            }
        });

        if (currentId) {
            tocLinks.forEach(l => {
                const isCurrent = l.getAttribute('data-heading-id') === currentId;
                l.classList.toggle('active', isCurrent);
                if (isCurrent) {
                    // 随着阅读位置逐级展开当前标题的所有祖先节点目录
                    let parentItem = l.closest('.toc-item');
                    while (parentItem) {
                        parentItem.classList.remove('is-collapsed');
                        parentItem = parentItem.parentElement ? parentItem.parentElement.closest('.toc-item') : null;
                    }
                    // 保持右侧高亮目录项在 TOC 容器可视范围内（仅调整 TOC 内部 scrollTop，绝不锁死 window 主页面）
                    if (tocCard) {
                        const cardHeight = tocCard.clientHeight;
                        const itemTop = l.offsetTop;
                        if (itemTop < tocCard.scrollTop || itemTop > (tocCard.scrollTop + cardHeight - 40)) {
                            tocCard.scrollTop = Math.max(0, itemTop - cardHeight / 2);
                        }
                    }
                }
            });
        }
    };
    window.addEventListener('scroll', window._tocScrollHandler);
}

/** 还原右侧边栏（退出文章详情视图时） */
function restoreSidebar() {
    const box3 = document.querySelector('.box3');
    if (box3 && box3.dataset.originalContent) {
        box3.innerHTML = box3.dataset.originalContent;
        delete box3.dataset.originalContent;
        if (window._tocScrollHandler) {
            window.removeEventListener('scroll', window._tocScrollHandler);
        }
        // 重新渲染侧边栏动态组件
        if (typeof renderSidebarComments === 'function') renderSidebarComments();
        if (typeof renderHotArticles === 'function') renderHotArticles();
        if (typeof renderTagCloud === 'function') renderTagCloud();
        if (typeof renderFriendLinks === 'function') renderFriendLinks();
    }
}

// ========== 文章导出与分享功能 ==========

/** 打印 / 导出 PDF */
function exportArticlePDF() {
    window.print();
}

/** 下载为 Markdown (.md) 文件 */
function downloadArticleMD(articleId) {
    const item = getArticleById(articleId);
    if (!item) return;

    const mdContent = `---
title: "${item.title}"
date: "${item.date}"
category: "${item.category || '未分类'}"
tags: [${(item.tags || []).map(t => `"${t}"`).join(', ')}]
summary: "${item.summary || ''}"
---

# ${item.title}

${item.content || item.summary || ''}
`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title.replace(/[\/\\:*?"<>|]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('已开始下载 Markdown 文件！');
}

/** 复制分享链接 */
function copyArticleShareLink(articleId) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${articleId}#detail`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('已复制文章分享链接到剪贴板！');
        }).catch(() => {
            fallbackCopy(shareUrl);
        });
    } else {
        fallbackCopy(shareUrl);
    }
}

function fallbackCopy(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast('已复制文章分享链接！');
}

/** 平滑滚动至评论区 */
function scrollToComments() {
    const commentSection = document.getElementById('inlineArticleCommentForm') || document.getElementById('sidebarCommentsCard');
    if (commentSection) {
        commentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

