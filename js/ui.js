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
    // 兼容旧调用：收起歌单抽屉
    const popover = document.getElementById('mpListPopover');
    if (popover) {
        popover.classList.remove('active');
        popover.setAttribute('aria-hidden', 'true');
    }
    const listBtn = document.getElementById('mpListBtn');
    if (listBtn) listBtn.classList.remove('is-open');
    showOverlay(false);
}

/** 切换歌单抽屉显隐（顶栏 ☰ 按钮调用） */
function toggleMusicListPopover() {
    const popover = document.getElementById('mpListPopover');
    const listBtn = document.getElementById('mpListBtn');
    if (!popover) return;
    const willOpen = !popover.classList.contains('active');
    popover.classList.toggle('active', willOpen);
    popover.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
    if (listBtn) listBtn.classList.toggle('is-open', willOpen);
    if (willOpen && typeof renderMusicPlayerUI === 'function') {
        renderMusicPlayerUI();
    }
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
        if (coverImg) {
            const container = coverImg.closest('.mp-inline-cover');
            const showGoldFallback = () => {
                coverImg.classList.add('img-hidden');
                if (container) container.classList.add('has-gold-fallback');
            };
            const showRealCover = (url) => {
                coverImg.classList.remove('img-hidden');
                if (container) container.classList.remove('has-gold-fallback');
                coverImg.src = url;
            };

            if (cur.picUrl) {
                showRealCover(cur.picUrl);
                coverImg.onerror = function () {
                    showGoldFallback();
                };
            } else {
                showGoldFallback();
            }
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
    if (coverImg) {
        const container = coverImg.closest('.mp-inline-cover');
        if (meta.picUrl) {
            coverImg.classList.remove('img-hidden');
            if (container) container.classList.remove('has-gold-fallback');
            coverImg.src = meta.picUrl;
            coverImg.onerror = function () {
                coverImg.classList.add('img-hidden');
                if (container) container.classList.add('has-gold-fallback');
            };
        } else {
            coverImg.classList.add('img-hidden');
            if (container) container.classList.add('has-gold-fallback');
        }
    }

    _isChangingSong = true;

    // 优先采用高可用多源解析（如果配置了 meta.url 或可以用在线流解解析）
    const shouldPlay = (autoPlay === undefined) ? true : !!autoPlay;

    return (typeof getNeteaseSongUrl === 'function' ? getNeteaseSongUrl(meta, 192) : Promise.resolve({ url: null }))
        .then(result => {
            let finalUrl = (result && result.url) ? result.url : (meta.url || `https://api.injahow.cn/meting/?type=url&id=${meta.id}`);
            if (!finalUrl) {
                _isChangingSong = false;
                if (typeof showToast === 'function') showToast(`无法获取「${meta.name}」的播放地址，请切换其他歌曲。`);
                return false;
            }
            audio.src = finalUrl;
            localStorage.removeItem('bgAudioTime');
            state.musicPlaying = shouldPlay;
            localStorage.setItem(STORAGE_KEYS.musicPlaying, shouldPlay ? 'true' : 'false');
            renderMusicPlayerUI();
            if (shouldPlay) {
                const p = audio.play();
                if (p && typeof p.catch === 'function') {
                    p.catch(err => {
                        console.warn('[音频自动播放阻止/拦截]', err);
                    });
                }
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

    // 兼容别名：'admin' / 'adminControl' 都可打开控制台，'articles' -> 'list'
    let view = String(viewName || 'home');
    if (view === 'admin') view = 'adminControl';
    if (view === 'articles') view = 'list';
    if (!(view === 'home' || view === 'list' || view === 'detail' || view === 'editor' || view === 'adminControl' || view === 'gallery' || view === 'trash' || view === 'space' || view === 'fileManager')) {
        view = 'home';
    }

    // 动态页专属标记：用于隐藏全局文章页右侧栏（.box3），避免与动态页自身日历列重复
    document.body.classList.toggle('view-space', view === 'space');
    // 文章详情页标记：全局右侧栏(.box3) 仅在该视图显示（见 responsive.css body.view-detail 规则）
    document.body.classList.toggle('view-detail', view === 'detail');

    const homeView = document.getElementById('homeView');
    const listView = document.getElementById('listView');
    const detailView = document.getElementById('detailView');
    const editorView = document.getElementById('editorView');
    const adminControlView = document.getElementById('adminControlView');
    const galleryView = document.getElementById('galleryView');
    const trashView = document.getElementById('trashView');
    const spaceView = document.getElementById('spaceView');
    const fileManagerView = document.getElementById('fileManagerView');

    if (homeView) {
        homeView.style.display = view === 'home' ? 'block' : 'none';
        homeView.classList.toggle('active', view === 'home');
        if (view === 'home' && typeof renderHomeResumeView === 'function') {
            renderHomeResumeView();
        }
    }

    if (listView) {
        listView.style.display = view === 'list' ? 'block' : 'none';
        listView.classList.toggle('active', view === 'list');
    }

    if (detailView) {
        detailView.style.display = view === 'detail' ? 'block' : 'none';
        detailView.classList.toggle('active', view === 'detail');
    }

    if (editorView) {
        editorView.style.display = view === 'editor' ? 'block' : 'none';
        editorView.classList.toggle('active', view === 'editor');
    }

    if (adminControlView) {
        adminControlView.style.display = view === 'adminControl' ? 'block' : 'none';
        adminControlView.classList.toggle('active', view === 'adminControl');
    }

    if (galleryView) {
        galleryView.style.display = view === 'gallery' ? 'block' : 'none';
        galleryView.classList.toggle('active', view === 'gallery');
    }

    if (fileManagerView) {
        fileManagerView.style.display = view === 'fileManager' ? 'block' : 'none';
        fileManagerView.classList.toggle('active', view === 'fileManager');
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

    // 同步更新所有侧边栏导航链接的激活状态高亮
    document.querySelectorAll('.daohang a[data-nav]').forEach(a => {
        const nav = a.getAttribute('data-nav');
        if (view === 'home' && nav === 'home') {
            a.classList.add('active');
        } else if (view === 'list' && nav === 'articles') {
            a.classList.add('active');
        } else if (view === 'space' && nav === 'space') {
            a.classList.add('active');
        } else {
            a.classList.remove('active');
        }
    });

    // 控制右侧边栏 (.box3) 隐藏与网格布局全宽展开 (.yinying)
    const rightSidebar = document.querySelector('.box3');
    const layout = document.getElementById('pageLayout') || document.querySelector('.yinying');
    
    // 首页简历 (home)、编辑文章 (editor)、控制台 (adminControl)、图床 (gallery)、回收站 (trash)、个人动态 (space)、文件管理 (fileManager) 视图隐藏全局右侧栏
    const hideSidebarViews = ['home', 'list', 'editor', 'adminControl', 'gallery', 'trash', 'space', 'fileManager'];
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

    // 页面切换时整页迅速且完全地回到最顶端（兼容 window / documentElement / body）
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    });
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
            <div class="detail-breadcrumb-bar">
                <div class="breadcrumb-nav">
                    <span class="breadcrumb-item" onclick="switchView('home');">首页</span>
                    <span class="breadcrumb-separator">/</span>
                    <span class="breadcrumb-item" onclick="switchView('list'); activeFilters = []; renderArticles();">文章</span>
                    <span class="breadcrumb-separator">/</span>
                    <span class="breadcrumb-item active" onclick="switchView('list'); activeFilters = ['${item.category}']; renderArticles();">${item.category}</span>
                </div>
                <div class="detail-action-tools">
                    <button type="button" class="detail-tool-btn" onclick="exportArticlePDF()" title="打印文章">
                        ${getIcon('print', '', 14)} <span>打印</span>
                    </button>
                    <button type="button" class="detail-tool-btn" onclick="downloadArticleMD('${item.id}')" title="下载为 .md 文件">
                        ${getIcon('download', '', 14)} <span>下载</span>
                    </button>
                    <button type="button" class="detail-tool-btn" onclick="copyArticleShareLink('${item.id}')" title="复制分享链接">
                        ${getIcon('share', '', 14)} <span>分享</span>
                    </button>
                </div>
            </div>
            <div class="detail-meta-stats" id="detailMetaStats">
                <span>${getIcon('calendar', '', 14)} 发布日期：${typeof formatDateTime === 'function' ? formatDateTime(item.date) : formatDate(item.date)}</span> · 
                <span>${getIcon('book-open', '', 14)} 阅读 (${item.read})</span> · 
                <span>${getIcon('like', '', 14)} 点赞 (${typeof getArticleLikes === 'function' ? getArticleLikes(item) : (item.like || 0)})</span> · 
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
            if (!liked && typeof triggerBurstEffect === 'function') {
                triggerBurstEffect(likeBtn, 'heart');
            }
            renderDetailLikeFavoriteBar(getArticleById(item.id));
            refreshDetailMetaIfNeeded(item.id);
        };
    }

    // 收藏按钮：状态 + 文案 + 星星爆炸特效
    const favBtn = bar.querySelector('[data-viewer-action="favorite"]');
    if (favBtn) {
        const textEl = favBtn.querySelector('.btn-text');
        if (textEl) textEl.textContent = favorited ? '已收藏' : '收藏';
        favBtn.classList.toggle('is-active', favorited);
        favBtn.setAttribute('aria-pressed', favorited ? 'true' : 'false');
        favBtn.setAttribute('title', favorited ? '取消对这篇文章的收藏' : '把这篇文章加入收藏夹');
        favBtn.onclick = (e) => {
            toggleFavorite(item.id);
            if (!favorited && typeof triggerBurstEffect === 'function') {
                triggerBurstEffect(favBtn, 'star');
            }
            renderDetailLikeFavoriteBar(getArticleById(item.id));
        };
    }
}

// 小工具：详情页点赞/收藏操作变化时，仅刷新数据统计行，保留顶部的首页/分类面包屑与操作按钮
function refreshDetailMetaIfNeeded(id) {
    const item = getArticleById(id);
    if (!item) return;
    const statsEl = document.getElementById('detailMetaStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <span>${getIcon('calendar', '', 14)} 发布日期：${typeof formatDateTime === 'function' ? formatDateTime(item.date) : formatDate(item.date)}</span> · 
            <span>${getIcon('book-open', '', 14)} 阅读 (${item.read})</span> · 
            <span>${getIcon('like', '', 14)} 点赞 (${typeof getArticleLikes === 'function' ? getArticleLikes(item) : (item.like || 0)})</span> · 
            <span style="cursor:pointer; color:var(--primary);" onclick="scrollToComments()">${getIcon('comment', '', 14)} 评论 (${item.comment})</span>
        `;
    }
}

function renderInlineArticleComments(articleId) {
    const listEl = document.getElementById('inlineArticleCommentList');
    if (!listEl) return;

    const article = getArticleById(articleId);
    if (!article) return;

    if (!article.commentList) article.commentList = [];

    if (article.commentList.length === 0) {
        listEl.innerHTML = '<p style="color:var(--text-muted); font-size:13.5px; padding:20px 0; text-align:center;">暂无针对本文的评论，快来抢沙发发表第一条想法吧！</p>';
        return;
    }

    const esc = typeof escHtml === 'function' ? escHtml : (typeof escapeHtml === 'function' ? escapeHtml : (s => String(s == null ? '' : s)));

    const visitor = (typeof loadVisitorInfo === 'function') ? loadVisitorInfo() : null;
    const visitorName = visitor ? (visitor.name || '') : '';
    const visitorContact = visitor ? (visitor.contact || '') : '';
    const isAdmin = !!(state && state.isAdmin);

    const userCanDelete = (c) => isAdmin || (visitorName && c.name === visitorName) || (visitorContact && c.contact && c.contact === visitorContact);

    const renderDeleteBtn = (c) => userCanDelete(c)
        ? `<button type="button" class="comment-link-btn delete-btn" data-action="delete-comment"
              data-scope="article" data-article-id="${articleId}" data-id="${c.id}"
              title="删除此条评论">删除</button>`
        : '';

    // 只渲染顶级评论
    const topList = (typeof getTopLevelComments === 'function')
        ? getTopLevelComments('article', articleId)
        : article.commentList.filter(c => !c.parentId || Number(c.parentId) === 0);

    // 渲染回复列表
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
                            if (typeof addArticleContentImage === 'function') {
                                addArticleContentImage(dataUrl);
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
                    const doRestore = () => {
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
                        if (typeof setLiveMarkdownContent === 'function') {
                            setLiveMarkdownContent(null, draft.content || '');
                        }
                        if (typeof showToast === 'function') showToast('已恢复未保存草稿', 'success');
                    };
                    if (typeof showConfirmModal === 'function') {
                        showConfirmModal({
                            title: '恢复文章草稿',
                            message: `检测到您上次于 ${draft.savedAt} 编辑的未保存文章草稿，是否恢复？`,
                            confirmText: '恢复草稿',
                            cancelText: '放弃草稿',
                            onConfirm: doRestore,
                            onCancel: () => clearArticleDraft()
                        });
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

async function saveArticle() {
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
        if (typeof showToast === 'function') showToast('请填写文章标题和正文内容', 'warning');
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
            savedArticle = await restoreFromTrash(target, newData);
        }
        window.__editingFromTrashId = null;
    } else if (currentEditingArticleId) {
        savedArticle = await updateArticle(currentEditingArticleId, newData);
    } else {
        savedArticle = await createArticle(Object.assign({ date: new Date().toISOString().slice(0,10) }, newData));
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
    const trashIcon = (typeof getIcon === 'function') ? getIcon('trash', '', 14) : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    container.innerHTML = socials.map(item => `
        <div class="social-edit-row">
            <input type="text" class="social-label-input" placeholder="名称(如 GitHub/QQ)" value="${item.label || ''}" style="width:120px;">
            <input type="text" class="social-value-input" placeholder="内容/用户名(如 用户名 或 URL)" value="${item.value || ''}" style="flex:1;">
            <button type="button" class="action-btn delete-btn remove-social-row-btn" style="padding:6px 10px;" title="删除此项">${trashIcon}</button>
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

    const trashIcon = (typeof getIcon === 'function') ? getIcon('trash', '', 14) : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    const div = document.createElement('div');
    div.className = 'social-edit-row';
    div.innerHTML = `
        <input type="text" class="social-label-input" placeholder="名称(如 GitHub/QQ)" value="${label}" style="width:120px;">
        <input type="text" class="social-value-input" placeholder="内容/用户名(如 用户名 或 URL)" value="${value}" style="flex:1;">
        <button type="button" class="action-btn delete-btn remove-social-row-btn" style="padding:6px 10px;" title="删除此项">${trashIcon}</button>
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
            if (typeof showPromptModal === 'function') {
                showPromptModal({
                    title: '重命名标签',
                    message: `把标签 "${oldTag}" 重命名为：`,
                    defaultValue: oldTag,
                    placeholder: '输入新标签名称',
                    onConfirm: (newTag) => {
                        if (newTag && newTag.trim() && newTag.trim() !== oldTag) {
                            renameTagInArticles(oldTag, newTag.trim());
                            if (typeof showToast === 'function') showToast('标签重命名成功', 'success');
                        }
                    }
                });
            }
        });
    });

    container.querySelectorAll('button[data-delete-tag]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tagToDelete = btn.dataset.deleteTag;
            const doDelTag = () => {
                deleteTagFromArticles(tagToDelete);
                if (typeof showToast === 'function') showToast(`标签「${tagToDelete}」已删除`, 'info');
            };
            if (typeof showConfirmModal === 'function') {
                showConfirmModal({
                    title: '删除标签',
                    message: `确定要在所有文章中移除标签 "${tagToDelete}" 吗？`,
                    confirmText: '确认移除',
                    cancelText: '取消',
                    danger: true,
                    onConfirm: doDelTag
                });
            } else {
                doDelTag();
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

// ========== 极简优雅 Toast 浮动提示通知 (统一矢量图标 + 毛玻璃) ==========
function showToast(message, type = 'info', duration = 2500) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    } else if (container.parentElement !== document.body) {
        document.body.appendChild(container);
    }
    const esc = typeof escHtml === 'function' ? escHtml : (typeof escapeHtml === 'function' ? escapeHtml : (s => String(s || '')));
    
    // 矢量图标映射
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = typeof getIcon === 'function' ? getIcon('check-circle', 'toast-icon success', 18) : '';
    } else if (type === 'warning') {
        iconSvg = typeof getIcon === 'function' ? getIcon('alert', 'toast-icon warning', 18) : '';
    } else if (type === 'error') {
        iconSvg = typeof getIcon === 'function' ? getIcon('close', 'toast-icon error', 18) : '';
    } else {
        iconSvg = typeof getIcon === 'function' ? getIcon('info', 'toast-icon info', 18) : '';
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon-wrap">${iconSvg}</span>
        <span class="toast-text">${esc(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-leave');
        setTimeout(() => toast.remove(), 250);
    }, duration);
}

// ========== 高颜值确认弹窗 (Confirm Modal) ==========
function showConfirmModal(options) {
    const {
        title = '确认操作',
        message = '确定要执行此操作吗？',
        confirmText = '确定',
        cancelText = '取消',
        danger = false,
        icon = '',
        onConfirm = () => {},
        onCancel = () => {}
    } = options || {};

    const esc = typeof escHtml === 'function' ? escHtml : (typeof escapeHtml === 'function' ? escapeHtml : (s => String(s || '')));

    const existing = document.getElementById('globalConfirmModal');
    if (existing) existing.remove();

    const iconHtml = icon || (danger 
        ? (typeof getIcon === 'function' ? getIcon('trash', '', 24) : '') 
        : (typeof getIcon === 'function' ? getIcon('alert', '', 24) : ''));

    const modal = document.createElement('div');
    modal.id = 'globalConfirmModal';
    modal.className = 'confirm-modal-backdrop';
    modal.innerHTML = `
        <div class="confirm-modal-card" role="dialog" aria-modal="true">
            <div class="confirm-modal-icon-wrap ${danger ? 'danger' : 'primary'}">
                ${iconHtml}
            </div>
            <h4 class="confirm-modal-title">${esc(title)}</h4>
            <p class="confirm-modal-message">${esc(message)}</p>
            <div class="confirm-modal-actions">
                <button type="button" class="confirm-modal-btn cancel-btn" id="confirmModalCancelBtn">${esc(cancelText)}</button>
                <button type="button" class="confirm-modal-btn ok-btn ${danger ? 'danger' : 'primary'}" id="confirmModalOkBtn">${esc(confirmText)}</button>
            </div>
        </div>
    `;

    document.documentElement.appendChild(modal);

    const close = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
    };

    const handleKey = (e) => {
        if (e.key === 'Escape') {
            close();
            onCancel();
            document.removeEventListener('keydown', handleKey);
        }
    };
    document.addEventListener('keydown', handleKey);

    const cancelBtn = modal.querySelector('#confirmModalCancelBtn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            document.removeEventListener('keydown', handleKey);
            close();
            onCancel();
        };
    }

    const okBtn = modal.querySelector('#confirmModalOkBtn');
    if (okBtn) {
        okBtn.onclick = () => {
            document.removeEventListener('keydown', handleKey);
            close();
            onConfirm();
        };
    }

    modal.onclick = (e) => {
        if (e.target === modal) {
            document.removeEventListener('keydown', handleKey);
            close();
            onCancel();
        }
    };

    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

// ========== 高颜值输入弹窗 (Prompt Modal - 替代原生 prompt) ==========
function showPromptModal(options) {
    const {
        title = '请输入内容',
        message = '',
        placeholder = '请输入...',
        defaultValue = '',
        confirmText = '确定',
        cancelText = '取消',
        inputType = 'text',
        onConfirm = () => {},
        onCancel = () => {}
    } = options || {};

    const esc = typeof escHtml === 'function' ? escHtml : (typeof escapeHtml === 'function' ? escapeHtml : (s => String(s || '')));

    const existing = document.getElementById('globalPromptModal');
    if (existing) existing.remove();

    const editIcon = typeof getIcon === 'function' ? getIcon('edit', '', 22) : '';

    const modal = document.createElement('div');
    modal.id = 'globalPromptModal';
    modal.className = 'confirm-modal-backdrop prompt-modal-backdrop';
    modal.innerHTML = `
        <div class="confirm-modal-card prompt-modal-card" role="dialog" aria-modal="true">
            <div class="confirm-modal-icon-wrap primary">
                ${editIcon}
            </div>
            <h4 class="confirm-modal-title">${esc(title)}</h4>
            ${message ? `<p class="confirm-modal-message">${esc(message)}</p>` : ''}
            <div style="margin: 14px 0 20px 0;">
                <input type="${inputType}" class="prompt-input" id="globalPromptInput" value="${esc(defaultValue)}" placeholder="${esc(placeholder)}">
            </div>
            <div class="confirm-modal-actions">
                <button type="button" class="confirm-modal-btn cancel-btn" id="promptModalCancelBtn">${esc(cancelText)}</button>
                <button type="button" class="confirm-modal-btn ok-btn primary" id="promptModalOkBtn">${esc(confirmText)}</button>
            </div>
        </div>
    `;

    document.documentElement.appendChild(modal);
    const input = modal.querySelector('#globalPromptInput');

    const close = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
    };

    const submit = () => {
        const val = input ? input.value : '';
        document.removeEventListener('keydown', handleKey);
        close();
        onConfirm(val);
    };

    const cancel = () => {
        document.removeEventListener('keydown', handleKey);
        close();
        onCancel();
    };

    const handleKey = (e) => {
        if (e.key === 'Escape') {
            cancel();
        } else if (e.key === 'Enter') {
            submit();
        }
    };
    document.addEventListener('keydown', handleKey);

    const cancelBtn = modal.querySelector('#promptModalCancelBtn');
    if (cancelBtn) cancelBtn.onclick = cancel;

    const okBtn = modal.querySelector('#promptModalOkBtn');
    if (okBtn) okBtn.onclick = submit;

    modal.onclick = (e) => {
        if (e.target === modal) cancel();
    };

    requestAnimationFrame(() => {
        modal.classList.add('active');
        if (input) {
            input.focus();
            input.select();
        }
    });
}

// ========== 高颜值信息提示弹窗 (Alert Modal - 替代原生 alert) ==========
function showAlertModal(options) {
    let opts = options;
    if (typeof options === 'string') {
        opts = { message: options, title: '系统提示' };
    }
    const {
        title = '系统提示',
        message = '',
        confirmText = '我知道了',
        type = 'info',
        onConfirm = () => {}
    } = opts || {};

    const esc = typeof escHtml === 'function' ? escHtml : (typeof escapeHtml === 'function' ? escapeHtml : (s => String(s || '')));

    const existing = document.getElementById('globalAlertModal');
    if (existing) existing.remove();

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = typeof getIcon === 'function' ? getIcon('check-circle', '', 24) : '';
    } else if (type === 'warning') {
        iconSvg = typeof getIcon === 'function' ? getIcon('alert', '', 24) : '';
    } else if (type === 'error') {
        iconSvg = typeof getIcon === 'function' ? getIcon('close', '', 24) : '';
    } else {
        iconSvg = typeof getIcon === 'function' ? getIcon('info', '', 24) : '';
    }

    const modal = document.createElement('div');
    modal.id = 'globalAlertModal';
    modal.className = 'confirm-modal-backdrop';
    modal.innerHTML = `
        <div class="confirm-modal-card" role="dialog" aria-modal="true">
            <div class="confirm-modal-icon-wrap ${type === 'error' || type === 'warning' ? 'danger' : 'primary'}">
                ${iconSvg}
            </div>
            <h4 class="confirm-modal-title">${esc(title)}</h4>
            <p class="confirm-modal-message">${esc(message)}</p>
            <div class="confirm-modal-actions">
                <button type="button" class="confirm-modal-btn ok-btn primary" id="alertModalOkBtn" style="width:100%;">${esc(confirmText)}</button>
            </div>
        </div>
    `;

    document.documentElement.appendChild(modal);

    const close = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
    };

    const handleKey = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
            document.removeEventListener('keydown', handleKey);
            close();
            onConfirm();
        }
    };
    document.addEventListener('keydown', handleKey);

    const okBtn = modal.querySelector('#alertModalOkBtn');
    if (okBtn) {
        okBtn.onclick = () => {
            document.removeEventListener('keydown', handleKey);
            close();
            onConfirm();
        };
    }

    modal.onclick = (e) => {
        if (e.target === modal) {
            document.removeEventListener('keydown', handleKey);
            close();
            onConfirm();
        }
    };

    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

// ========== 动感交互：点赞 / 收藏爆炸特效 ==========
function triggerBurstEffect(eventOrEl, type = 'heart') {
    let x, y;

    let el = null;
    if (eventOrEl instanceof HTMLElement) {
        el = eventOrEl;
    } else if (eventOrEl && eventOrEl.currentTarget instanceof HTMLElement) {
        el = eventOrEl.currentTarget;
    } else if (eventOrEl && eventOrEl.target instanceof HTMLElement) {
        el = eventOrEl.target.closest('button') || eventOrEl.target;
    }

    if (el) {
        const rect = el.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
    } else if (eventOrEl && typeof eventOrEl.clientX === 'number' && eventOrEl.clientX > 0) {
        x = eventOrEl.clientX;
        y = eventOrEl.clientY;
    } else {
        x = window.innerWidth / 2;
        y = window.innerHeight / 2;
    }

    const heartSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary, #ec4899)" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
    const starSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="#eab308" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    const sparkleSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#f59e0b" stroke="none"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"></path></svg>';
    
    const svgTemplates = (type === 'heart') ? [heartSvg, sparkleSvg] : [starSvg, sparkleSvg];
    const count = 12;

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'like-particle';
        particle.innerHTML = svgTemplates[i % svgTemplates.length];
        
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 40 + Math.random() * 60;
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed - 30;
        const rot = (Math.random() - 0.5) * 120;

        particle.style.left = `${Math.round(x)}px`;
        particle.style.top = `${Math.round(y)}px`;
        particle.style.setProperty('--dx', `${Math.round(dx)}px`);
        particle.style.setProperty('--dy', `${Math.round(dy)}px`);
        particle.style.setProperty('--rot', `${Math.round(rot)}deg`);

        // 挂载到 documentElement，彻底避免 body filter / transform 导致的定位偏移
        document.documentElement.appendChild(particle);
        setTimeout(() => particle.remove(), 900);
    }
}

// ========== 应用高级主题配置 ==========
function applyThemeCustomizations() {
    // 1. 背景纹理
    const bg = state.themeBg || localStorage.getItem('themeBg') || 'gradient';
    document.body.setAttribute('data-bg', bg);

    // 2. 字体库
    document.body.classList.remove('font-default', 'font-serif', 'font-mono', 'font-rounded');
    const font = state.themeFont || localStorage.getItem('themeFont') || 'default';
    if (font && font !== 'default') {
        document.body.classList.add(`font-${font}`);
    }

    // 3. 卡片圆角与侧栏圆角
    const cardRadius = state.themeRadius || localStorage.getItem('themeRadius') || '20';
    const sidebarRadius = state.themeSidebarRadius || localStorage.getItem('themeSidebarRadius') || '18';
    document.documentElement.style.setProperty('--card-radius', `${cardRadius}px`);
    document.documentElement.style.setProperty('--sidebar-radius', `${sidebarRadius}px`);

    // 4. 玻璃透明度（区分文章卡片透明度与板块透明度，支持最低 0%）与高斯模糊
    const cardOpacityVal = (state.themeCardOpacity !== undefined && state.themeCardOpacity !== null && state.themeCardOpacity !== '')
        ? state.themeCardOpacity
        : (localStorage.getItem('themeCardOpacity') ?? state.themeOpacity ?? '85');
    const sidebarOpacityVal = (state.themeSidebarOpacity !== undefined && state.themeSidebarOpacity !== null && state.themeSidebarOpacity !== '')
        ? state.themeSidebarOpacity
        : (localStorage.getItem('themeSidebarOpacity') ?? state.themeOpacity ?? '85');
    const blurVal = (state.themeBlur !== undefined && state.themeBlur !== null && state.themeBlur !== '')
        ? state.themeBlur
        : (localStorage.getItem('themeBlur') ?? '16');

    const cardOpacity = (!isNaN(Number(cardOpacityVal))) ? Math.max(0, Math.min(1, Number(cardOpacityVal) / 100)) : 0.85;
    const sidebarOpacity = (!isNaN(Number(sidebarOpacityVal))) ? Math.max(0, Math.min(1, Number(sidebarOpacityVal) / 100)) : 0.85;
    const blur = (!isNaN(Number(blurVal))) ? Math.max(0, Number(blurVal)) : 16;

    document.documentElement.style.setProperty('--card-opacity', cardOpacity);
    document.documentElement.style.setProperty('--sidebar-opacity', sidebarOpacity);
    document.documentElement.style.setProperty('--glass-opacity', cardOpacity);
    document.documentElement.style.setProperty('--glass-blur', `${blur}px`);

    document.documentElement.style.setProperty('--card-surface', `rgba(255, 255, 255, ${cardOpacity})`);
    document.documentElement.style.setProperty('--sidebar-surface', `rgba(255, 255, 255, ${sidebarOpacity})`);
    document.documentElement.style.setProperty('--surface', `rgba(255, 255, 255, ${cardOpacity})`);

    // 5. 文章卡片尺寸（高度百分比 & 宽度百分比）
    const cardHeightPercent = state.themeCardHeight || localStorage.getItem('themeCardHeight') || '100';
    const cardWidth = state.themeCardWidth || localStorage.getItem('themeCardWidth') || '100';
    document.documentElement.style.setProperty('--card-height-percent', `${cardHeightPercent}`);
    document.documentElement.style.setProperty('--card-height', `calc(320px * (${cardHeightPercent} / 100))`);
    document.documentElement.style.setProperty('--card-width-percent', `${cardWidth}%`);
    document.documentElement.style.setProperty('--card-max-width', `${cardWidth}%`);

    // 6. 颜色 Preset 或 Color Picker & 衍生变量
    const primaryColor = state.themePresetColor || localStorage.getItem('themePresetColor') || '#6366f1';
    document.documentElement.style.setProperty('--primary', primaryColor);
    try {
        const hex = primaryColor.replace('#', '');
        if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            document.documentElement.style.setProperty('--primary-light', `rgba(${r}, ${g}, ${b}, 0.12)`);
            document.documentElement.style.setProperty('--primary-border', `rgba(${r}, ${g}, ${b}, 0.28)`);
            document.documentElement.style.setProperty('--primary-shadow', `rgba(${r}, ${g}, ${b}, 0.35)`);
        }
    } catch (e) { }

    // 7. 绳索悬挂粗细
    const ropeWidth = state.themeRopeWidth || localStorage.getItem('themeRopeWidth') || '3.5';
    document.documentElement.style.setProperty('--rope-width', `${ropeWidth}px`);

    // 8. 布局间隙、侧栏板块间距与文章卡片上下独立间隙
    const topGap = state.themeTopGap || localStorage.getItem('themeTopGap') || '8';
    const gridGapX = state.themeGridGapX || localStorage.getItem('themeGridGapX') || '6';
    const cardGapY = state.themeCardGapY || localStorage.getItem('themeCardGapY') || '10';
    const articleGapTop = state.themeArticleGapTop || localStorage.getItem('themeArticleGapTop') || '0';
    const articleGapBottom = state.themeArticleGapBottom || localStorage.getItem('themeArticleGapBottom') || '14';

    document.documentElement.style.setProperty('--top-gap', `${topGap}px`);
    document.documentElement.style.setProperty('--grid-gap-x', `${gridGapX}px`);
    document.documentElement.style.setProperty('--card-gap-y', `${cardGapY}px`);
    document.documentElement.style.setProperty('--article-gap-top', `${articleGapTop}px`);
    document.documentElement.style.setProperty('--article-gap-bottom', `${articleGapBottom}px`);

    // 9. 实时联动更新控制面板 Live Preview 沙盘调试区 (顶栏、左侧栏、中间主区、右侧栏)
    const previewStage = document.getElementById('previewStageContainer');
    if (previewStage) {
        previewStage.setAttribute('data-bg', bg);
        previewStage.style.setProperty('--mini-top-gap', `${topGap}px`);
        previewStage.style.setProperty('--mini-grid-gap-x', `${gridGapX}px`);
        previewStage.style.setProperty('--mini-card-gap-y', `${cardGapY}px`);
        previewStage.style.setProperty('--mini-article-gap-top', `${Math.round(Number(articleGapTop) * 0.35)}px`);
        previewStage.style.setProperty('--mini-article-gap-bottom', `${Math.max(2, Math.round(Number(articleGapBottom) * 0.35))}px`);
        previewStage.style.setProperty('--card-radius', `${cardRadius}px`);
        previewStage.style.setProperty('--sidebar-radius', `${sidebarRadius}px`);
        previewStage.style.setProperty('--card-opacity', cardOpacity);
        previewStage.style.setProperty('--sidebar-opacity', sidebarOpacity);
        previewStage.style.setProperty('--glass-opacity', cardOpacity);
        previewStage.style.setProperty('--glass-blur', `${blur}px`);
        previewStage.style.setProperty('--primary', primaryColor);

        // 缩放尺寸到沙盘
        const miniHeight = Math.max(28, Math.round(50 * (Number(cardHeightPercent) / 100)));
        previewStage.style.setProperty('--mini-card-height', `${miniHeight}px`);
        previewStage.style.setProperty('--mini-card-width-percent', `${cardWidth}%`);

        if (font && font !== 'default') {
            previewStage.className = `preview-stage-container font-${font}`;
        } else {
            previewStage.className = 'preview-stage-container';
        }
    }
    const previewBlob1 = document.getElementById('previewBlob1');
    if (previewBlob1) {
        previewBlob1.style.background = primaryColor;
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

// ========== 首页个人简历与介绍编辑弹窗逻辑 (Admin Home Editor) ==========

let tempHeroAvatarDataUrl = '';

function switchHomeResumeTab(tabName) {
    const tabs = document.querySelectorAll('.hre-tabs .tab-btn');
    tabs.forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-hre-tab') === tabName);
    });

    const panes = {
        hero: document.getElementById('hrePaneHero'),
        about: document.getElementById('hrePaneAbout'),
        skills: document.getElementById('hrePaneSkills'),
        projects: document.getElementById('hrePaneProjects'),
        timeline: document.getElementById('hrePaneTimeline'),
        contact: document.getElementById('hrePaneContact')
    };

    Object.keys(panes).forEach(k => {
        if (panes[k]) {
            panes[k].style.display = k === tabName ? 'block' : 'none';
        }
    });
}

function handleHeroAvatarFile(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
        if (typeof showToast === 'function') showToast('头像图片大小不能超过 2MB！');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        tempHeroAvatarDataUrl = e.target.result;
        const avatarInput = document.getElementById('hreHeroAvatar');
        if (avatarInput) avatarInput.value = tempHeroAvatarDataUrl;
        if (typeof showToast === 'function') showToast('已选取本地头像图片');
    };
    reader.readAsDataURL(file);
}

// 辅助生成卡片操作栏（上移/下移/删除）
function getHreCardControlsHtml(label, type) {
    return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:13px; color:var(--text-main); display:inline-flex; align-items:center; gap:5px;">
                <span class="hre-item-index-badge" style="background:var(--primary-light); color:var(--primary); font-size:11px; padding:2px 8px; border-radius:999px; font-weight:700;">${label}</span>
            </strong>
            <div style="display:flex; gap:6px; align-items:center;">
                <button type="button" class="mini-admin-btn" onclick="moveHreRow(this, -1)" title="上移" style="padding:2px 6px;">${getIcon('prev', '', 12)}</button>
                <button type="button" class="mini-admin-btn" onclick="moveHreRow(this, 1)" title="下移" style="padding:2px 6px;">${getIcon('next', '', 12)}</button>
                <button type="button" class="mini-admin-btn" onclick="this.closest('.hre-edit-item-card').remove(); updateHreItemBadges('${type}');" style="color:var(--danger); border-color:var(--danger-light); padding:2px 8px;" title="删除">删除</button>
            </div>
        </div>
    `;
}

function moveHreRow(btn, direction) {
    const card = btn.closest('.hre-edit-item-card');
    if (!card) return;
    const parent = card.parentElement;
    if (!parent) return;
    if (direction === -1 && card.previousElementSibling) {
        parent.insertBefore(card, card.previousElementSibling);
    } else if (direction === 1 && card.nextElementSibling) {
        parent.insertBefore(card.nextElementSibling, card);
    }
}

function updateHreItemBadges(type) {
    const containerMap = {
        about: '#hreAboutCardsContainer',
        skills: '#hreSkillsListContainer',
        projects: '#hreProjectsListContainer',
        timeline: '#hreTimelineListContainer'
    };
    const prefixMap = {
        about: '关于我卡片',
        skills: '分类',
        projects: '作品',
        timeline: '节点'
    };
    const sel = containerMap[type];
    if (!sel) return;
    const container = document.querySelector(sel);
    if (!container) return;
    const badges = container.querySelectorAll('.hre-item-index-badge');
    badges.forEach((b, idx) => {
        b.textContent = `${prefixMap[type]} #${idx + 1}`;
    });
}

// 1. 关于我卡片编辑器
function renderHreAboutEditor(aboutList) {
    const container = document.getElementById('hreAboutCardsContainer');
    if (!container) return;
    const esc = typeof escHtml === 'function' ? escHtml : (typeof escapeHtml === 'function' ? escapeHtml : (s => String(s == null ? '' : s)));
    const items = aboutList || [];
    const iconOptions = ['layers', 'palette', 'lightbulb', 'sprout', 'code', 'rocket', 'globe', 'sparkle', 'terminal', 'cpu', 'card', 'user'];

    container.innerHTML = items.map((item, idx) => {
        let currentIcon = item.icon || 'layers';
        if (currentIcon.includes('🚀')) currentIcon = 'rocket';
        else if (currentIcon.includes('🎨')) currentIcon = 'palette';
        else if (currentIcon.includes('💡')) currentIcon = 'lightbulb';
        else if (currentIcon.includes('🌱')) currentIcon = 'sprout';
        else if (currentIcon.includes('💻')) currentIcon = 'code';

        const optionsHtml = iconOptions.map(opt => `<option value="${opt}" ${opt === currentIcon ? 'selected' : ''}>${opt}</option>`).join('');

        return `
            <div class="hre-edit-item-card hre-about-edit-card" style="padding:12px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-body);" data-about-idx="${idx}">
                ${getHreCardControlsHtml(`关于我卡片 #${idx + 1}`, 'about')}
                <div style="display:flex; gap:10px; margin-bottom:8px; align-items:center;">
                    <select class="hre-about-icon" style="padding:7px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; background:var(--bg-card); color:var(--text-main); min-width:110px;">
                        ${optionsHtml}
                    </select>
                    <input type="text" class="hre-about-title" value="${esc(item.title || '')}" placeholder="卡片标题" style="flex:1;">
                </div>
                <textarea class="hre-about-desc" rows="2" placeholder="卡片描述内容..." style="width:100%; border-radius:8px; border:1px solid #cbd5e1; padding:8px; font-size:13px; outline:none; font-family:inherit;">${esc(item.desc || '')}</textarea>
            </div>
        `;
    }).join('');
}

function addHreAboutRow() {
    const container = document.getElementById('hreAboutCardsContainer');
    if (!container) return;
    const cards = container.querySelectorAll('.hre-about-edit-card');
    const newIdx = cards.length;
    const iconOptions = ['layers', 'palette', 'lightbulb', 'sprout', 'code', 'rocket', 'globe', 'sparkle', 'terminal', 'cpu', 'card', 'user'];
    const optionsHtml = iconOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('');

    const div = document.createElement('div');
    div.className = 'hre-edit-item-card hre-about-edit-card';
    div.style.cssText = 'padding:12px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-body);';
    div.setAttribute('data-about-idx', newIdx);
    div.innerHTML = `
        ${getHreCardControlsHtml(`关于我卡片 #${newIdx + 1}`, 'about')}
        <div style="display:flex; gap:10px; margin-bottom:8px; align-items:center;">
            <select class="hre-about-icon" style="padding:7px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; background:var(--bg-card); color:var(--text-main); min-width:110px;">
                ${optionsHtml}
            </select>
            <input type="text" class="hre-about-title" value="" placeholder="卡片标题" style="flex:1;">
        </div>
        <textarea class="hre-about-desc" rows="2" placeholder="卡片描述内容..." style="width:100%; border-radius:8px; border:1px solid #cbd5e1; padding:8px; font-size:13px; outline:none; font-family:inherit;"></textarea>
    `;
    container.appendChild(div);
}

// 2. 专业技能分类编辑器
function renderHreSkillsEditor(skillsCategories) {
    const container = document.getElementById('hreSkillsListContainer');
    if (!container) return;
    const esc = typeof escHtml === 'function' ? escHtml : (typeof escapeHtml === 'function' ? escapeHtml : (s => String(s == null ? '' : s)));
    const list = skillsCategories || [];

    container.innerHTML = list.map((cat, idx) => `
        <div class="hre-edit-item-card hre-skill-category-edit-card" style="padding:12px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-body);" data-skill-idx="${idx}">
            ${getHreCardControlsHtml(`分类 #${idx + 1}`, 'skills')}
            <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:8px;">
                <div>
                    <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">分类标题</label>
                    <input type="text" class="hre-skill-cat-title" value="${esc(cat.title || '')}" placeholder="分类标题 (如: 前端开发)">
                </div>
                <div>
                    <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">视觉指示色</label>
                    <select class="hre-skill-cat-indicator" style="width:100%; padding:7px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; background:var(--bg-card); color:var(--text-main);">
                        <option value="front" ${cat.indicator === 'front' ? 'selected' : ''}>蓝绿色调 (前端/主色)</option>
                        <option value="back" ${cat.indicator === 'back' ? 'selected' : ''}>蓝紫色调 (后端/数据)</option>
                        <option value="tool" ${cat.indicator === 'tool' ? 'selected' : ''}>橙金色调 (工具/工程)</option>
                    </select>
                </div>
            </div>
            <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">技能标签列表 (逗号或换行分隔)</label>
            <textarea class="hre-skill-cat-items" rows="3" placeholder="JavaScript, TypeScript, Vue.js, React, CSS3..." style="width:100%; border-radius:8px; border:1px solid #cbd5e1; padding:8px; font-size:13px; outline:none; font-family:inherit;">${esc((cat.items || []).join(', '))}</textarea>
        </div>
    `).join('');
}

function addHreSkillCategoryRow() {
    const container = document.getElementById('hreSkillsListContainer');
    if (!container) return;
    const cards = container.querySelectorAll('.hre-skill-category-edit-card');
    const newIdx = cards.length;

    const div = document.createElement('div');
    div.className = 'hre-edit-item-card hre-skill-category-edit-card';
    div.style.cssText = 'padding:12px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-body);';
    div.setAttribute('data-skill-idx', newIdx);
    div.innerHTML = `
        ${getHreCardControlsHtml(`分类 #${newIdx + 1}`, 'skills')}
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:8px;">
            <div>
                <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">分类标题</label>
                <input type="text" class="hre-skill-cat-title" value="" placeholder="分类标题 (如: AI 与智能体实践)">
            </div>
            <div>
                <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">视觉指示色</label>
                <select class="hre-skill-cat-indicator" style="width:100%; padding:7px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; background:var(--bg-card); color:var(--text-main);">
                    <option value="front">蓝绿色调 (前端/主色)</option>
                    <option value="back">蓝紫色调 (后端/数据)</option>
                    <option value="tool" selected>橙金色调 (工具/工程)</option>
                </select>
            </div>
        </div>
        <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">技能标签列表 (逗号或换行分隔)</label>
        <textarea class="hre-skill-cat-items" rows="2" placeholder="输入技能项..." style="width:100%; border-radius:8px; border:1px solid #cbd5e1; padding:8px; font-size:13px; outline:none; font-family:inherit;"></textarea>
    `;
    container.appendChild(div);
}

// 3. 精选作品编辑器
function renderHreProjectsEditor(projectsList) {
    const container = document.getElementById('hreProjectsListContainer');
    if (!container) return;
    const esc = typeof escHtml === 'function' ? escHtml : (typeof escapeHtml === 'function' ? escapeHtml : (s => String(s == null ? '' : s)));
    const items = projectsList || [];

    container.innerHTML = items.map((item, idx) => `
        <div class="hre-edit-item-card hre-project-edit-card" style="padding:12px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-body); position:relative;" data-project-idx="${idx}">
            ${getHreCardControlsHtml(`作品 #${idx + 1}`, 'projects')}
            <div style="display:grid; grid-template-columns:1fr 2fr; gap:8px; margin-bottom:8px;">
                <input type="text" class="hre-proj-badge" value="${esc(item.badge || '')}" placeholder="角标 (如: 核心开源项目)">
                <input type="text" class="hre-proj-title" value="${esc(item.title || '')}" placeholder="作品名称">
            </div>
            <textarea class="hre-proj-desc" rows="2" placeholder="作品详细描述..." style="width:100%; border-radius:8px; border:1px solid #cbd5e1; padding:8px; font-size:13px; outline:none; font-family:inherit; margin-bottom:8px;">${esc(item.desc || '')}</textarea>
            <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:8px; margin-bottom:8px;">
                <input type="text" class="hre-proj-tags" value="${esc((item.tags || []).join(', '))}" placeholder="技术标签 (逗号分隔)">
                <select class="hre-proj-link" onchange="toggleHreProjectCustomUrl(this)" style="border-radius:8px; border:1px solid #cbd5e1; padding:6px 10px; font-size:13px; background:var(--bg-card); color:var(--text-main);">
                    <option value="list" ${item.link === 'list' ? 'selected' : ''}>跳转到文章列表</option>
                    <option value="space" ${item.link === 'space' ? 'selected' : ''}>跳转到空间动态</option>
                    <option value="custom" ${item.link === 'custom' ? 'selected' : ''}>自定义外部链接</option>
                </select>
            </div>
            <div class="hre-proj-custom-url-row" style="display:${item.link === 'custom' ? 'block' : 'none'};">
                <input type="url" class="hre-proj-custom-url" value="${esc(item.customUrl || '')}" placeholder="https://your-project-link.com">
            </div>
        </div>
    `).join('');
}

function toggleHreProjectCustomUrl(selectEl) {
    const row = selectEl.closest('.hre-project-edit-card')?.querySelector('.hre-proj-custom-url-row');
    if (row) {
        row.style.display = selectEl.value === 'custom' ? 'block' : 'none';
    }
}

function addHreProjectRow() {
    const container = document.getElementById('hreProjectsListContainer');
    if (!container) return;
    const cards = container.querySelectorAll('.hre-project-edit-card');
    const newIdx = cards.length;
    const div = document.createElement('div');
    div.className = 'hre-edit-item-card hre-project-edit-card';
    div.style.cssText = 'padding:12px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-body); position:relative;';
    div.setAttribute('data-project-idx', newIdx);
    div.innerHTML = `
        ${getHreCardControlsHtml(`作品 #${newIdx + 1}`, 'projects')}
        <div style="display:grid; grid-template-columns:1fr 2fr; gap:8px; margin-bottom:8px;">
            <input type="text" class="hre-proj-badge" value="代表作品" placeholder="角标">
            <input type="text" class="hre-proj-title" value="" placeholder="作品名称">
        </div>
        <textarea class="hre-proj-desc" rows="2" placeholder="作品详细描述..." style="width:100%; border-radius:8px; border:1px solid #cbd5e1; padding:8px; font-size:13px; outline:none; font-family:inherit; margin-bottom:8px;"></textarea>
        <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:8px; margin-bottom:8px;">
            <input type="text" class="hre-proj-tags" value="" placeholder="技术标签 (逗号分隔)">
            <select class="hre-proj-link" onchange="toggleHreProjectCustomUrl(this)" style="border-radius:8px; border:1px solid #cbd5e1; padding:6px 10px; font-size:13px; background:var(--bg-card); color:var(--text-main);">
                <option value="list">跳转到文章列表</option>
                <option value="space">跳转到空间动态</option>
                <option value="custom">自定义外部链接</option>
            </select>
        </div>
        <div class="hre-proj-custom-url-row" style="display:none;">
            <input type="url" class="hre-proj-custom-url" value="" placeholder="https://your-project-link.com">
        </div>
    `;
    container.appendChild(div);
}

// 4. 成长历程编辑器
function renderHreTimelineEditor(timelineList) {
    const container = document.getElementById('hreTimelineListContainer');
    if (!container) return;
    const esc = typeof escHtml === 'function' ? escHtml : (typeof escapeHtml === 'function' ? escapeHtml : (s => String(s == null ? '' : s)));
    const items = timelineList || [];
    container.innerHTML = items.map((item, idx) => `
        <div class="hre-edit-item-card hre-timeline-edit-card" style="padding:12px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-body); position:relative;" data-timeline-idx="${idx}">
            ${getHreCardControlsHtml(`节点 #${idx + 1}`, 'timeline')}
            <div style="display:grid; grid-template-columns:110px 1fr; gap:8px; margin-bottom:8px;">
                <input type="text" class="hre-time-year" value="${esc(item.year || '')}" placeholder="时间/年份 (如: 2026)">
                <input type="text" class="hre-time-title" value="${esc(item.title || '')}" placeholder="节点标题">
            </div>
            <textarea class="hre-time-desc" rows="2" placeholder="成长经历或突破描述..." style="width:100%; border-radius:8px; border:1px solid #cbd5e1; padding:8px; font-size:13px; outline:none; font-family:inherit;">${esc(item.desc || '')}</textarea>
        </div>
    `).join('');
}

function addHreTimelineRow() {
    const container = document.getElementById('hreTimelineListContainer');
    if (!container) return;
    const cards = container.querySelectorAll('.hre-timeline-edit-card');
    const newIdx = cards.length;
    const div = document.createElement('div');
    div.className = 'hre-edit-item-card hre-timeline-edit-card';
    div.style.cssText = 'padding:12px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-body); position:relative;';
    div.setAttribute('data-timeline-idx', newIdx);
    div.innerHTML = `
        ${getHreCardControlsHtml(`节点 #${newIdx + 1}`, 'timeline')}
        <div style="display:grid; grid-template-columns:110px 1fr; gap:8px; margin-bottom:8px;">
            <input type="text" class="hre-time-year" value="2026" placeholder="时间/年份">
            <input type="text" class="hre-time-title" value="" placeholder="节点标题">
        </div>
        <textarea class="hre-time-desc" rows="2" placeholder="成长经历或突破描述..." style="width:100%; border-radius:8px; border:1px solid #cbd5e1; padding:8px; font-size:13px; outline:none; font-family:inherit;"></textarea>
    `;
    container.appendChild(div);
}

// 5. 打开首页编辑弹窗并回填
function openHomeResumeEditor(targetTab = 'hero') {
    moveModalToRoot('homeResumeEditorModal');
    const modal = document.getElementById('homeResumeEditorModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    const data = typeof getHomeResumeData === 'function' ? getHomeResumeData() : defaultHomeResume;
    tempHeroAvatarDataUrl = '';

    // 1. 回填 Hero
    const hero = data.hero || {};
    const greetingEl = document.getElementById('hreHeroGreeting');
    const nameEl = document.getElementById('hreHeroName');
    const statusEl = document.getElementById('hreHeroStatus');
    const githubEl = document.getElementById('hreHeroGithub');
    const titleEl = document.getElementById('hreHeroTitle');
    const mottoEl = document.getElementById('hreHeroMotto');
    const avatarEl = document.getElementById('hreHeroAvatar');
    const tagsEl = document.getElementById('hreHeroTags');
    const priBtnTextEl = document.getElementById('hreHeroPrimaryBtnText');
    const priBtnLinkEl = document.getElementById('hreHeroPrimaryBtnLink');
    const secBtnTextEl = document.getElementById('hreHeroSecondaryBtnText');
    const secBtnLinkEl = document.getElementById('hreHeroSecondaryBtnLink');

    if (greetingEl) greetingEl.value = hero.greeting || '';
    if (nameEl) nameEl.value = hero.name || '';
    if (statusEl) statusEl.value = hero.status || '';
    if (githubEl) githubEl.value = hero.github || '';
    if (titleEl) titleEl.value = hero.title || '';
    if (mottoEl) mottoEl.value = hero.motto || '';
    if (avatarEl) avatarEl.value = hero.avatar || '';
    if (tagsEl) tagsEl.value = (hero.tags || []).join('\n');
    if (priBtnTextEl) priBtnTextEl.value = hero.primaryBtnText || '阅读我的文章';
    if (priBtnLinkEl) priBtnLinkEl.value = hero.primaryBtnLink || 'list';
    if (secBtnTextEl) secBtnTextEl.value = hero.secondaryBtnText || '空间动态';
    if (secBtnLinkEl) secBtnLinkEl.value = hero.secondaryBtnLink || 'space';

    // 2. 回填关于我
    const aboutSection = data.aboutSection || defaultHomeResume.aboutSection;
    const aboutSecTitleEl = document.getElementById('hreAboutSectionTitle');
    const aboutSecSubtitleEl = document.getElementById('hreAboutSectionSubtitle');
    const aboutSecIconEl = document.getElementById('hreAboutSectionIcon');
    if (aboutSecTitleEl) aboutSecTitleEl.value = aboutSection.title || '';
    if (aboutSecSubtitleEl) aboutSecSubtitleEl.value = aboutSection.subtitle || '';
    if (aboutSecIconEl) aboutSecIconEl.value = aboutSection.icon || 'info';
    renderHreAboutEditor(data.about || defaultHomeResume.about);

    // 3. 回填专业技能
    const skillsSection = data.skillsSection || defaultHomeResume.skillsSection;
    const skillsSecTitleEl = document.getElementById('hreSkillsSectionTitle');
    const skillsSecSubtitleEl = document.getElementById('hreSkillsSectionSubtitle');
    const skillsSecIconEl = document.getElementById('hreSkillsSectionIcon');
    if (skillsSecTitleEl) skillsSecTitleEl.value = skillsSection.title || '';
    if (skillsSecSubtitleEl) skillsSecSubtitleEl.value = skillsSection.subtitle || '';
    if (skillsSecIconEl) skillsSecIconEl.value = skillsSection.icon || 'code';
    renderHreSkillsEditor(data.skillsCategories || defaultHomeResume.skillsCategories);

    // 4. 回填精选作品
    const projectsSection = data.projectsSection || defaultHomeResume.projectsSection;
    const projectsSecTitleEl = document.getElementById('hreProjectsSectionTitle');
    const projectsSecSubtitleEl = document.getElementById('hreProjectsSectionSubtitle');
    const projectsSecIconEl = document.getElementById('hreProjectsSectionIcon');
    if (projectsSecTitleEl) projectsSecTitleEl.value = projectsSection.title || '';
    if (projectsSecSubtitleEl) projectsSecSubtitleEl.value = projectsSection.subtitle || '';
    if (projectsSecIconEl) projectsSecIconEl.value = projectsSection.icon || 'layout';
    renderHreProjectsEditor(data.projects || defaultHomeResume.projects);

    // 5. 回填成长历程
    const timelineSection = data.timelineSection || defaultHomeResume.timelineSection;
    const timelineSecTitleEl = document.getElementById('hreTimelineSectionTitle');
    const timelineSecSubtitleEl = document.getElementById('hreTimelineSectionSubtitle');
    const timelineSecIconEl = document.getElementById('hreTimelineSectionIcon');
    if (timelineSecTitleEl) timelineSecTitleEl.value = timelineSection.title || '';
    if (timelineSecSubtitleEl) timelineSecSubtitleEl.value = timelineSection.subtitle || '';
    if (timelineSecIconEl) timelineSecIconEl.value = timelineSection.icon || 'calendar';
    renderHreTimelineEditor(data.timeline || defaultHomeResume.timeline);

    // 6. 回填底部联系
    const contactSection = data.contactSection || defaultHomeResume.contactSection;
    const cTitle = document.getElementById('hreContactTitle');
    const cDesc = document.getElementById('hreContactDesc');
    const cPills = document.getElementById('hreContactPills');
    const cCta = document.getElementById('hreContactCtaText');
    const cCtaLink = document.getElementById('hreContactCtaLink');

    if (cTitle) cTitle.value = contactSection.title || '';
    if (cDesc) cDesc.value = contactSection.desc || '';
    if (cPills) cPills.value = (contactSection.pills || []).join(', ');
    if (cCta) cCta.value = contactSection.ctaText || '';
    if (cCtaLink) cCtaLink.value = contactSection.ctaLink || 'list';

    // 切换到目标 Tab
    switchHomeResumeTab(targetTab || 'hero');
}

function closeHomeResumeEditor() {
    const modal = document.getElementById('homeResumeEditorModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function saveHomeResumeEditor() {
    // 1. 提取 Hero 数据
    const greeting = document.getElementById('hreHeroGreeting')?.value.trim() || defaultHomeResume.hero.greeting;
    const name = document.getElementById('hreHeroName')?.value.trim() || defaultHomeResume.hero.name;
    const status = document.getElementById('hreHeroStatus')?.value.trim() || defaultHomeResume.hero.status;
    const github = document.getElementById('hreHeroGithub')?.value.trim() || defaultHomeResume.hero.github;
    const title = document.getElementById('hreHeroTitle')?.value.trim() || defaultHomeResume.hero.title;
    const motto = document.getElementById('hreHeroMotto')?.value.trim() || defaultHomeResume.hero.motto;
    const avatar = document.getElementById('hreHeroAvatar')?.value.trim() || defaultHomeResume.hero.avatar;
    const rawTags = document.getElementById('hreHeroTags')?.value || '';
    const tags = rawTags.split(/[\n,，]/).map(t => t.trim()).filter(Boolean);
    const primaryBtnText = document.getElementById('hreHeroPrimaryBtnText')?.value.trim() || '阅读我的文章';
    const primaryBtnLink = document.getElementById('hreHeroPrimaryBtnLink')?.value.trim() || 'list';
    const secondaryBtnText = document.getElementById('hreHeroSecondaryBtnText')?.value.trim() || '空间动态';
    const secondaryBtnLink = document.getElementById('hreHeroSecondaryBtnLink')?.value.trim() || 'space';

    // 2. 提取关于我
    const aboutSecTitle = document.getElementById('hreAboutSectionTitle')?.value.trim() || defaultHomeResume.aboutSection.title;
    const aboutSecSubtitle = document.getElementById('hreAboutSectionSubtitle')?.value.trim() || defaultHomeResume.aboutSection.subtitle;
    const aboutSecIcon = document.getElementById('hreAboutSectionIcon')?.value || 'info';

    const aboutRows = document.querySelectorAll('#hreAboutCardsContainer .hre-about-edit-card');
    const about = [];
    aboutRows.forEach(row => {
        const icon = row.querySelector('.hre-about-icon')?.value.trim() || 'layers';
        const aTitle = row.querySelector('.hre-about-title')?.value.trim() || '';
        const desc = row.querySelector('.hre-about-desc')?.value.trim() || '';
        if (aTitle || desc) {
            about.push({ icon, title: aTitle, desc });
        }
    });

    // 3. 提取专业技能分类
    const skillsSecTitle = document.getElementById('hreSkillsSectionTitle')?.value.trim() || defaultHomeResume.skillsSection.title;
    const skillsSecSubtitle = document.getElementById('hreSkillsSectionSubtitle')?.value.trim() || defaultHomeResume.skillsSection.subtitle;
    const skillsSecIcon = document.getElementById('hreSkillsSectionIcon')?.value || 'code';

    const skillCategoryRows = document.querySelectorAll('#hreSkillsListContainer .hre-skill-category-edit-card');
    const skillsCategories = [];
    skillCategoryRows.forEach(row => {
        const sTitle = row.querySelector('.hre-skill-cat-title')?.value.trim() || '';
        const indicator = row.querySelector('.hre-skill-cat-indicator')?.value || 'tool';
        const sItems = (row.querySelector('.hre-skill-cat-items')?.value || '').split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
        if (sTitle || sItems.length) {
            skillsCategories.push({ title: sTitle, indicator, items: sItems });
        }
    });

    // 4. 提取精选作品
    const projectsSecTitle = document.getElementById('hreProjectsSectionTitle')?.value.trim() || defaultHomeResume.projectsSection.title;
    const projectsSecSubtitle = document.getElementById('hreProjectsSectionSubtitle')?.value.trim() || defaultHomeResume.projectsSection.subtitle;
    const projectsSecIcon = document.getElementById('hreProjectsSectionIcon')?.value || 'layout';

    const projRows = document.querySelectorAll('#hreProjectsListContainer .hre-project-edit-card');
    const projects = [];
    projRows.forEach(row => {
        const pBadge = row.querySelector('.hre-proj-badge')?.value.trim() || '代表作品';
        const pTitle = row.querySelector('.hre-proj-title')?.value.trim() || '';
        const pDesc = row.querySelector('.hre-proj-desc')?.value.trim() || '';
        const pTags = (row.querySelector('.hre-proj-tags')?.value || '').split(/[,，\n]/).map(t => t.trim()).filter(Boolean);
        const link = row.querySelector('.hre-proj-link')?.value || 'list';
        const customUrl = row.querySelector('.hre-proj-custom-url')?.value.trim() || '';
        if (pTitle) {
            projects.push({ badge: pBadge, title: pTitle, desc: pDesc, tags: pTags, link, customUrl });
        }
    });

    // 5. 提取成长历程
    const timelineSecTitle = document.getElementById('hreTimelineSectionTitle')?.value.trim() || defaultHomeResume.timelineSection.title;
    const timelineSecSubtitle = document.getElementById('hreTimelineSectionSubtitle')?.value.trim() || defaultHomeResume.timelineSection.subtitle;
    const timelineSecIcon = document.getElementById('hreTimelineSectionIcon')?.value || 'calendar';

    const timeRows = document.querySelectorAll('#hreTimelineListContainer .hre-timeline-edit-card');
    const timeline = [];
    timeRows.forEach(row => {
        const year = row.querySelector('.hre-time-year')?.value.trim() || '';
        const tTitle = row.querySelector('.hre-time-title')?.value.trim() || '';
        const desc = row.querySelector('.hre-time-desc')?.value.trim() || '';
        if (tTitle || year) {
            timeline.push({ year, title: tTitle, desc });
        }
    });

    // 6. 提取底部联系
    const cTitle = document.getElementById('hreContactTitle')?.value.trim() || defaultHomeResume.contactSection.title;
    const cDesc = document.getElementById('hreContactDesc')?.value.trim() || defaultHomeResume.contactSection.desc;
    const cPills = (document.getElementById('hreContactPills')?.value || '').split(/[,，\n]/).map(p => p.trim()).filter(Boolean);
    const cCta = document.getElementById('hreContactCtaText')?.value.trim() || defaultHomeResume.contactSection.ctaText;
    const cCtaLink = document.getElementById('hreContactCtaLink')?.value.trim() || 'list';

    const dataToSave = {
        hero: { 
            greeting, name, status, github, title, motto, avatar, 
            tags: tags.length ? tags : defaultHomeResume.hero.tags,
            primaryBtnText, primaryBtnLink, secondaryBtnText, secondaryBtnLink,
            githubBtnText: 'GitHub'
        },
        aboutSection: { title: aboutSecTitle, subtitle: aboutSecSubtitle, icon: aboutSecIcon },
        about: about.length ? about : defaultHomeResume.about,
        skillsSection: { title: skillsSecTitle, subtitle: skillsSecSubtitle, icon: skillsSecIcon },
        skillsCategories: skillsCategories.length ? skillsCategories : defaultHomeResume.skillsCategories,
        projectsSection: { title: projectsSecTitle, subtitle: projectsSecSubtitle, icon: projectsSecIcon },
        projects: projects.length ? projects : defaultHomeResume.projects,
        timelineSection: { title: timelineSecTitle, subtitle: timelineSecSubtitle, icon: timelineSecIcon },
        timeline: timeline.length ? timeline : defaultHomeResume.timeline,
        contactSection: { title: cTitle, desc: cDesc, pills: cPills.length ? cPills : defaultHomeResume.contactSection.pills, ctaText: cCta, ctaLink: cCtaLink }
    };

    saveHomeResumeData(dataToSave);
    closeHomeResumeEditor();
    if (typeof renderHomeResumeView === 'function') {
        renderHomeResumeView();
    }
    if (typeof showToast === 'function') {
        showToast('首页内容修改已成功保存并生效！');
    }
}

function resetHomeResumeEditor() {
    if (!confirm('确定要恢复首页内容为系统默认预设吗？自定义修改将被清除。')) return;
    resetHomeResumeData();
    closeHomeResumeEditor();
    if (typeof renderHomeResumeView === 'function') {
        renderHomeResumeView();
    }
    if (typeof showToast === 'function') {
        showToast('已恢复首页默认预设！');
    }
}

