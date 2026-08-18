/**
 * responsive.js - 响应式布局管理组件
 *
 * 负责处理界面缩放、移动端适配、侧边栏折叠、抽屉菜单等响应式行为。
 * 统一处理桌面端、平板端、手机端的布局切换与显示优化。
 *
 * @module ResponsiveManager
 */

(function() {
    'use strict';

    const RESPONSIVE_BREAKPOINTS = {
        mobile: 768,
        tablet: 900,
        desktop: 1100
    };

    let _lastWidth = window.innerWidth;
    let _isMobile = false;
    let _resizeTimer = null;

    /**
     * 检测设备类型并更新 body 的 data-device 属性
     */
    function detectDevice() {
        const width = window.innerWidth;
        const body = document.body;

        if (width < RESPONSIVE_BREAKPOINTS.mobile) {
            body.setAttribute('data-device', 'mobile');
            _isMobile = true;
        } else if (width < RESPONSIVE_BREAKPOINTS.tablet) {
            body.setAttribute('data-device', 'tablet');
            _isMobile = false;
        } else {
            body.setAttribute('data-device', 'desktop');
            _isMobile = false;
        }

        // 触发设备变更事件
        if (width !== _lastWidth) {
            const prevMobile = _lastWidth < RESPONSIVE_BREAKPOINTS.mobile;
            if (prevMobile !== _isMobile) {
                window.dispatchEvent(new CustomEvent('devicechange', {
                    detail: { isMobile: _isMobile, width }
                }));
            }
            _lastWidth = width;
        }
    }

    /**
     * 打开移动端侧边栏抽屉
     */
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

    /**
     * 关闭移动端侧边栏抽屉
     */
    function closeMobileDrawer() {
        const drawer = document.getElementById('mobileDrawer');
        if (drawer) {
            drawer.classList.remove('active');
            drawer.setAttribute('aria-hidden', 'true');
        }
        document.body.style.overflow = '';
    }

    /**
     * 切换移动端侧边栏抽屉
     */
    function toggleMobileDrawer() {
        const drawer = document.getElementById('mobileDrawer');
        if (drawer && drawer.classList.contains('active')) {
            closeMobileDrawer();
        } else {
            openMobileDrawer();
        }
    }

    /**
     * 防抖处理的 resize 监听
     */
    function onResize() {
        if (_resizeTimer) clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(() => {
            detectDevice();

            // 当窗口从小屏恢复到大屏时，自动关闭移动端抽屉
            if (!_isMobile) {
                closeMobileDrawer();
            }

            // 触发 resize 事件供其他组件使用
            window.dispatchEvent(new CustomEvent('appresize', {
                detail: { width: window.innerWidth, height: window.innerHeight, isMobile: _isMobile }
            }));
        }, 150);
    }

    /**
     * 初始化响应式系统
     */
    function initResponsive() {
        detectDevice();
        window.addEventListener('resize', onResize);

        // 点击抽屉外部区域关闭抽屉
        document.addEventListener('click', (e) => {
            const drawer = document.getElementById('mobileDrawer');
            const hamburger = document.getElementById('hamburger');
            if (!drawer || !drawer.classList.contains('active')) return;
            if (drawer.contains(e.target)) return;
            if (hamburger && hamburger.contains(e.target)) return;
            closeMobileDrawer();
        });

        // ESC 键关闭抽屉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMobileDrawer();
            }
        });
    }

    /**
     * 获取当前是否处于移动端
     * @returns {boolean}
     */
    function isMobileDevice() {
        return _isMobile;
    }

    /**
     * 获取当前断点信息
     * @returns {{width: number, height: number, isMobile: boolean, device: string}}
     */
    function getBreakpoint() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            isMobile: _isMobile,
            device: document.body.getAttribute('data-device') || 'desktop'
        };
    }

    // 暴露到全局
    window.openMobileDrawer = openMobileDrawer;
    window.closeMobileDrawer = closeMobileDrawer;
    window.toggleMobileDrawer = toggleMobileDrawer;
    window.initResponsive = initResponsive;
    window.isMobileDevice = isMobileDevice;
    window.getBreakpoint = getBreakpoint;
    window.RESPONSIVE_BREAKPOINTS = RESPONSIVE_BREAKPOINTS;

})();
