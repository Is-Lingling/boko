/**
 * main.js - 应用入口，优先渲染界面，再按访问场景分批加载数据
 */

function hideSkeleton(delay = 120) {
    setTimeout(() => {
        const skeleton = document.getElementById('skeletonOverlay');
        if (skeleton) skeleton.style.display = 'none';
    }, delay);
}

function runIdle(task, timeout = 1200) {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(task, { timeout });
    } else {
        setTimeout(task, 80);
    }
}

function getInitialView() {
    const hash = String(window.location.hash || '').replace(/^#\/?/, '');
    if (hash.startsWith('space')) return 'space';
    if (hash.startsWith('list') || hash.startsWith('articles')) return 'list';
    if (hash.startsWith('admin')) return 'adminControl';
    if (hash.startsWith('gallery')) return 'gallery';
    if (hash.startsWith('trash')) return 'trash';
    return 'home';
}

function renderShell(view) {
    if (typeof initCategories === 'function') initCategories();

    renderProfile();
    setTheme(state.theme);
    if (typeof applyThemeCustomizations === 'function') applyThemeCustomizations();
    renderAdminUI();
    renderLeftNav();
    renderHotList();
    renderTagCloud();
    renderArchive();
    renderFriendLinks();
    renderFilters();
    renderComments();
    if (typeof renderTopNoticeBanner === 'function') renderTopNoticeBanner();
    updateStats();
    renderArticles();
    switchView(view);
    changeHero(0);
    updateMusicStatus();
}

function refreshArticleUi() {
    if (typeof syncCategoriesFromArticles === 'function') syncCategoriesFromArticles();
    if (typeof initCategories === 'function') initCategories();
    renderLeftNav();
    renderHotList();
    renderTagCloud();
    renderArchive();
    renderFilters();
    renderArticles();
    changeHero(0);
}

function refreshDeferredUi() {
    renderProfile();
    renderFriendLinks();
    renderComments();
    if (typeof renderTopNoticeBanner === 'function') renderTopNoticeBanner();
    if (typeof renderMusicPlayerUI === 'function') renderMusicPlayerUI();
}

async function loadPrimaryData(view) {
    const tasks = [
        loadProfileData().then(renderProfile),
    ];

    if (view === 'home') {
        if (typeof loadHomeResumeDataFromApi === 'function') {
            tasks.push(loadHomeResumeDataFromApi().then(() => switchView('home')));
        }
    } else if (view === 'space') {
        if (typeof loadSpaceFeedsFromApi === 'function') {
            tasks.push(loadSpaceFeedsFromApi().then(() => {
                if (typeof renderSpaceView === 'function') renderSpaceView();
            }));
        }
    } else {
        tasks.push(loadArticlesFromFile().then(refreshArticleUi));
    }

    await Promise.allSettled(tasks);
}

function loadDeferredData(view) {
    const jobs = [];

    if (view !== 'home' && typeof loadHomeResumeDataFromApi === 'function') {
        jobs.push(loadHomeResumeDataFromApi);
    }
    if (view !== 'space' && typeof loadSpaceFeedsFromApi === 'function') {
        jobs.push(loadSpaceFeedsFromApi);
    }
    if (typeof loadCommentsFromApi === 'function') {
        jobs.push(() => loadCommentsFromApi().then(renderComments));
    }
    if (typeof loadMusicFromStorage === 'function') {
        jobs.push(() => loadMusicFromStorage().then(() => {
            if (typeof initMusicPlayer === 'function') initMusicPlayer();
            if (state.musicPlaying) {
                playSongByIndex(state.curSongIdx || 0, true);
            } else {
                updateMusicStatus();
            }
        }));
    }
    if (typeof loadKvFromApi === 'function') {
        jobs.push(() => loadKvFromApi().then(refreshDeferredUi));
    }

    jobs.forEach((job, index) => {
        runIdle(() => {
            Promise.resolve()
                .then(job)
                .catch(err => console.warn('[Init] 后台数据加载失败:', err && err.message));
        }, 800 + index * 400);
    });
}

async function init() {
    migrateCommentsIfNeeded();
    if (typeof loadArticlesFromCache === 'function') loadArticlesFromCache();
    if (typeof loadProfileFromCache === 'function') loadProfileFromCache();
    if (typeof loadCommentsFromCache === 'function') loadCommentsFromCache();
    if (typeof loadTrashFromStorage === 'function') loadTrashFromStorage();

    // 初始化主题（支持系统偏好跟随）
    if (typeof initTheme === 'function') initTheme();
    if (typeof watchSystemTheme === 'function') watchSystemTheme();

    // 初始化响应式系统
    if (typeof initResponsive === 'function') initResponsive();

    const initialView = getInitialView();
    renderShell(initialView);
    bindEvents();
    if (typeof initMusicPlayer === 'function') initMusicPlayer();
    hideSkeleton();

    updateVisitorStats();
    await loadPrimaryData(initialView);
    loadDeferredData(initialView);
}

// DOM 就绪后启动
window.addEventListener('DOMContentLoaded', () => {
    init().catch(err => {
        console.error('[Init] 启动失败:', err);
        hideSkeleton(0);
    });
});
