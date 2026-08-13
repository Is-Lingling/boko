/**
 * main.js - 应用入口，初始化所有模块
 */

function init() {
    // 加载数据 + 旧数据字段迁移（补评论 id / contact）
    migrateCommentsIfNeeded();
    loadProfileData();
    if (typeof loadTrashFromStorage === 'function') loadTrashFromStorage();
    if (typeof loadMusicFromStorage === 'function') loadMusicFromStorage();

    // 初始化分类/标签结构（必须在 renderLeftNav 之前，且 articles 已加载）
    if (typeof initCategories === 'function') initCategories();

    // 渲染基础 UI
    renderProfile();
    setTheme(state.theme);
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
    loadArticlesFromFile().then(init);
});
