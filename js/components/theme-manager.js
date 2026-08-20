/**
 * theme-manager.js - 主题管理组件
 *
 * 负责博客系统的暗黑/浅色主题切换、主题状态持久化、以及联动更新各 UI 子系统的主题。
 *
 * @module ThemeManager
 * @requires state (全局状态对象，需包含 state.theme)
 * @requires STORAGE_KEYS (全局常量，需包含 STORAGE_KEYS.theme)
 * @requires getIcon (全局辅助函数)
 */

(function() {
    'use strict';

    /**
     * 设置当前主题
     * @param {string} theme - 'dark' 或 'light'
     */
    function setTheme(theme) {
        const isDark = theme === 'dark';
        document.body.classList.toggle('dark', isDark);
        localStorage.setItem(STORAGE_KEYS.theme, theme);

        if (typeof state !== 'undefined' && state) {
            state.theme = theme;
        }

        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn && typeof getIcon === 'function') {
            themeBtn.innerHTML = isDark
                ? `${getIcon('sun', '', 15)} <span>浅色</span>`
                : `${getIcon('moon', '', 15)} <span>暗黑</span>`;
        }

        // 联动 Vditor 编辑器主题
        if (typeof vditorInstance !== 'undefined' && vditorInstance) {
            try {
                vditorInstance.setTheme(isDark ? 'dark' : 'classic', isDark ? 'dark' : 'light');
            } catch (e) {
                // Vditor 未完全初始化时忽略
            }
        }

        // 触发主题变更事件，供其他组件监听
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    /**
     * 切换当前主题（暗黑 <=> 浅色）
     */
    function toggleTheme() {
        const current = (typeof state !== 'undefined' && state.theme) ? state.theme : 'light';
        setTheme(current === 'dark' ? 'light' : 'dark');
        // 管理员切换深色/浅色也属于站点外观配置，需写回后端以保证全站一致
        if (typeof state !== 'undefined' && state.isAdmin && typeof saveThemeSettings === 'function') {
            saveThemeSettings();
        }
    }

    /**
     * 从 localStorage 恢复保存的主题偏好，无保存时跟随系统偏好
     */
    function initTheme() {
        let saved = null;
        try {
            saved = localStorage.getItem(STORAGE_KEYS.theme);
        } catch (e) {}

        if (saved === 'dark' || saved === 'light') {
            setTheme(saved);
            return;
        }

        // 默认跟随系统偏好
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }

    /**
     * 监听系统主题变化（可选）
     */
    function watchSystemTheme() {
        if (!window.matchMedia) return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) {
            mq.addEventListener('change', (e) => {
                // 仅在用户未手动设置主题时自动跟随系统
                const saved = localStorage.getItem(STORAGE_KEYS.theme);
                if (!saved) {
                    setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // 暴露到全局
    window.setTheme = setTheme;
    window.toggleTheme = toggleTheme;
    window.initTheme = initTheme;
    window.watchSystemTheme = watchSystemTheme;

})();
