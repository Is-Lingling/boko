/**
 * main.js - 应用入口，初始化所有模块
 */

async function init() {
    // 加载数据 + 旧数据字段迁移（补评论 id / contact）
    migrateCommentsIfNeeded();
    await loadProfileData();
    if (typeof loadTrashFromStorage === 'function') loadTrashFromStorage();
    if (typeof loadMusicFromStorage === 'function') await loadMusicFromStorage();
    // 拉取首页简历数据（写入 localStorage 缓存）
    if (typeof loadHomeResumeDataFromApi === 'function') await loadHomeResumeDataFromApi();
    // 拉取站点评论（覆盖 state.comments）
    if (typeof loadCommentsFromApi === 'function') await loadCommentsFromApi();
    // 拉取空间动态（写入内存缓存）
    if (typeof loadSpaceFeedsFromApi === 'function') await loadSpaceFeedsFromApi();
    // 拉取所有 KV 配置数据（图册命名、封面计数、图片库、文件、备忘、快捷链接）
    if (typeof loadKvFromApi === 'function') await loadKvFromApi();

    // 初始化分类/标签结构（必须在 renderLeftNav 之前，且 articles 已加载）
    if (typeof initCategories === 'function') await initCategories();

    // 渲染基础 UI
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

    // 顶栏跳动提示标语
    if (typeof renderTopNoticeBanner === 'function') renderTopNoticeBanner();

    // 访客统计
    updateVisitorStats();
    updateStats();

    // 绑定事件
    bindEvents();

    // 音乐播放器增强
    initMusicPlayer();

    // 渲染文章列表
    renderArticles();

    // 默认激活首页（个人简历与介绍）
    switchView('home');

    // 置顶轮播
    changeHero(0);

    // 恢复音乐播放状态：用当前索引下的歌（网易云 API 真实 URL）
    if (state.musicPlaying) {
        playSongByIndex(state.curSongIdx || 0, true);
    } else {
        updateMusicStatus();
    }

    // 隐藏骨架屏
    setTimeout(() => {
        const skeleton = document.getElementById('skeletonOverlay');
        if (skeleton) skeleton.style.display = 'none';
    }, 800);
}

// DOM 就绪后启动
window.addEventListener('DOMContentLoaded', () => {
    loadArticlesFromFile().then(init).catch(err => {
        console.error('[Init] 启动失败:', err);
        // 即便初始化抛错，也尝试隐藏骨架屏，避免页面卡在加载态
        const skeleton = document.getElementById('skeletonOverlay');
        if (skeleton) skeleton.style.display = 'none';
    });
});
