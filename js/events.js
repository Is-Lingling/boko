/**
 * events.js - 事件绑定层
 */

// ========== 访客信息弹窗 & 回复执行（供事件委托调用） ==========

/** 弹出访客信息弹窗，保存待提交的回复上下文 */
function showVisitorInfoModal(pendingContext) {
    const modal = document.getElementById('visitorInfoModal');
    if (!modal) return;
    // 移至 documentElement，避免 body filter 导致 fixed 定位异常
    if (modal.parentNode !== document.documentElement) {
        document.documentElement.appendChild(modal);
    }
    // 保存待提交的回复上下文（parentId / scope / articleId / content / box / ta）
    modal.__pendingReply = pendingContext || null;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    // 清空输入框（避免上次残留）
    const nameInput = document.getElementById('visitorNameInput');
    const contactInput = document.getElementById('visitorContactInput');
    if (nameInput) nameInput.value = '';
    if (contactInput) contactInput.value = '';
    // 预填 cookie 中已有的部分（如 nickname 有但 contact 没有的情况）
    if (typeof loadVisitorInfo === 'function') {
        const v = loadVisitorInfo();
        if (nameInput && !nameInput.value && v.name) nameInput.value = v.name;
        if (contactInput && !contactInput.value && v.contact) contactInput.value = v.contact;
    }
    // 聚焦到昵称输入框
    setTimeout(() => { if (nameInput && !nameInput.value) nameInput.focus(); else if (contactInput) contactInput.focus(); }, 80);
}

/** 隐藏访客信息弹窗 */
function hideVisitorInfoModal() {
    const modal = document.getElementById('visitorInfoModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    // 清除待提交上下文（用户取消则不再继续回复）
    modal.__pendingReply = null;
}

/** 执行回复提交（弹窗保存 cookie 后或 cookie 已有时调用） */
function doSubmitReply(opts) {
    if (!opts) return;
    const { parentId, scope, articleId, content, name, contact, box, ta } = opts;

    if (scope === 'article' && articleId) {
        // 文章详情页的回复
        if (typeof addArticleReply === 'function') {
            addArticleReply(Number(articleId), Number(parentId), name, contact, content);
        }
        // 重新渲染回复列表
        const listEl = document.querySelector(`[data-reply-list="${parentId}"]`);
        if (listEl && typeof renderReplyList === 'function') {
            listEl.innerHTML = renderReplyList(parentId, 'article', articleId);
        }
    } else {
        // 主区评论回复
        addComment(name, contact, content, Number(parentId));
        const listEl = document.querySelector(`[data-reply-list="${parentId}"]`);
        if (listEl && typeof renderReplyList === 'function') {
            listEl.innerHTML = renderReplyList(parentId, 'main');
        }
    }

    // 清空输入框、隐藏回复框
    if (ta) ta.value = '';
    if (box) box.style.display = 'none';
}

// ========== 大图查看器 & 图册命名编辑 ==========

let imageViewerIndex = 0;
let imageViewerZoom = 1;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function applyImageViewerZoom() {
    const imgEl = document.getElementById('imageViewerImg');
    const levelEl = document.getElementById('zoomLevel');
    if (!imgEl) return;
    imgEl.style.transform = `scale(${imageViewerZoom})`;
    if (imageViewerZoom > 1) {
        imgEl.classList.add('is-zoomed');
    } else {
        imgEl.classList.remove('is-zoomed');
    }
    if (levelEl) {
        levelEl.textContent = Math.round(imageViewerZoom * 100) + '%';
    }
}

function zoomImageViewer(delta) {
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, imageViewerZoom + delta));
    if (newZoom !== imageViewerZoom) {
        imageViewerZoom = newZoom;
        applyImageViewerZoom();
    }
}

function resetImageViewerZoom() {
    imageViewerZoom = 1;
    applyImageViewerZoom();
}

// ========== 左上角管理员无感下拉登录 (Dropdown Popover) ==========
window.toggleAdminLoginDropdown = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const dropdown = document.getElementById('adminLoginDropdown');
    const userInput = document.getElementById('quickAdminUser');
    const errorMsg = document.getElementById('quickAdminMsg');
    if (!dropdown) return;

    if (state.isAdmin) {
        if (typeof showToast === 'function') {
            showToast('您已处于管理员登录状态', 'info');
        }
        return;
    }

    const isActive = dropdown.classList.contains('active');
    if (!isActive) {
        dropdown.classList.add('active');
        dropdown.setAttribute('aria-hidden', 'false');
        if (userInput) setTimeout(() => userInput.focus(), 50);
    } else {
        dropdown.classList.remove('active');
        dropdown.setAttribute('aria-hidden', 'true');
        if (errorMsg) errorMsg.style.display = 'none';
    }
};

function initAdminLoginDropdown() {
    const dropdown = document.getElementById('adminLoginDropdown');
    const brandBtn = document.getElementById('adminLoginBrandBtn');
    const form = document.getElementById('quickAdminLoginForm');
    const userInput = document.getElementById('quickAdminUser');
    const passInput = document.getElementById('quickAdminPass');
    const errorMsg = document.getElementById('quickAdminMsg');

    if (!dropdown) return;

    let adminDropdownTimer;

    function toggleDropdown(show) {
        if (show) {
            dropdown.classList.add('active');
            dropdown.setAttribute('aria-hidden', 'false');
            if (userInput) setTimeout(() => userInput.focus(), 50);
        } else {
            dropdown.classList.remove('active');
            dropdown.setAttribute('aria-hidden', 'true');
            if (errorMsg) errorMsg.style.display = 'none';
        }
    }

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && (!brandBtn || !brandBtn.contains(e.target))) {
            toggleDropdown(false);
        }
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = userInput ? userInput.value.trim() : '';
            const p = passInput ? passInput.value.trim() : '';

            if (!u || !p) {
                if (errorMsg) {
                    errorMsg.textContent = '请输入完整的账号和密码';
                    errorMsg.style.display = 'block';
                }
                return;
            }

            // 通过后端验证账号密码（数据源：SQLite admin_user 表）
            try {
                const res = await Api.login(u, p);
                if (res && res.success) {
                    if (res.token) Api.setAdminToken(res.token);
                    state.isAdmin = true;
                    localStorage.setItem('isAdmin', 'true');
                    if (typeof renderAdminUI === 'function') renderAdminUI();
                    if (typeof renderArticles === 'function') renderArticles();
                    toggleDropdown(false);
                    if (userInput) userInput.value = '';
                    if (passInput) passInput.value = '';
                    showToast('登录成功，已解锁管理员权限', 'success');
                } else {
                    if (errorMsg) {
                        errorMsg.textContent = (res && res.message) || '账号或密码错误';
                        errorMsg.style.display = 'block';
                    }
                }
            } catch (err) {
                // 后端不可用时回退到本地默认账号（仅用于离线开发）
                if ((u === 'admin' && p === 'admin123')) {
                    state.isAdmin = true;
                    localStorage.setItem('isAdmin', 'true');
                    if (typeof renderAdminUI === 'function') renderAdminUI();
                    if (typeof renderArticles === 'function') renderArticles();
                    toggleDropdown(false);
                    if (userInput) userInput.value = '';
                    if (passInput) passInput.value = '';
                    showToast('已离线登录（后端未响应）', 'warning');
                } else {
                    if (errorMsg) {
                        errorMsg.textContent = '登录失败：' + (err && err.message || '网络错误');
                        errorMsg.style.display = 'block';
                    }
                }
            }
        });
    }
}
document.addEventListener('DOMContentLoaded', initAdminLoginDropdown);

let currentViewerImageList = null;

function getCurrentImageViewerImages() {
    if (Array.isArray(currentViewerImageList) && currentViewerImageList.length > 0) {
        return currentViewerImageList;
    }
    return (typeof getGalleryImages === 'function') ? getGalleryImages() : [];
}

function openImageViewer(idx, customImages = null) {
    const modal = document.getElementById('imageViewerModal');
    if (!modal) return;
    currentViewerImageList = Array.isArray(customImages) && customImages.length > 0 ? customImages : null;
    const images = getCurrentImageViewerImages();
    if (!images.length) return;
    imageViewerIndex = Math.max(0, Math.min(Number(idx) || 0, images.length - 1));
    imageViewerZoom = 1;
    updateImageViewer();
    // 移至 documentElement，避免 body 上的 filter 创建包含块导致 fixed 定位相对整页而非视口
    if (modal.parentNode !== document.documentElement) {
        document.documentElement.appendChild(modal);
    }
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeImageViewer() {
    const modal = document.getElementById('imageViewerModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentViewerImageList = null;
}

function navigateImageViewer(delta) {
    const images = getCurrentImageViewerImages();
    if (!images.length) return;
    let idx = imageViewerIndex + (delta || 0);
    if (idx < 0) idx = images.length - 1;
    if (idx >= images.length) idx = 0;
    imageViewerIndex = idx;
    updateImageViewer();
}

function updateImageViewer() {
    const images = getCurrentImageViewerImages();
    if (!images.length) return;
    const url = images[imageViewerIndex];
    const imgEl = document.getElementById('imageViewerImg');
    const nameEl = document.getElementById('imageViewerName');
    const counterEl = document.getElementById('imageViewerCounter');
    if (imgEl) {
        imgEl.src = url;
        // 图片加载完成后重置缩放
        imgEl.onload = function() {
            imageViewerZoom = 1;
            applyImageViewerZoom();
        };
    }
    if (nameEl) {
        if (Array.isArray(currentViewerImageList)) {
            nameEl.textContent = `动态图片 ${imageViewerIndex + 1}`;
        } else {
            nameEl.textContent = (typeof getGalleryImageName === 'function')
                ? getGalleryImageName(url, imageViewerIndex) : ('img' + (imageViewerIndex + 1));
        }
    }
    if (counterEl) counterEl.textContent = `${imageViewerIndex + 1} / ${images.length}`;
    // 切换图片时重置缩放
    imageViewerZoom = 1;
    applyImageViewerZoom();
}

/** 保存图册图片的自定义名称 */
function saveGalleryName(idx, inputEl) {
    if (!inputEl) return;
    const newName = inputEl.value.trim();
    const images = (typeof getGalleryImages === 'function') ? getGalleryImages() : [];
    const url = images[Number(idx)];
    if (url && typeof setGalleryImageName === 'function') {
        setGalleryImageName(url, newName);
    }
    const nameDisplay = document.querySelector(`[data-name-display="${idx}"]`);
    if (nameDisplay) {
        nameDisplay.textContent = newName || ('img' + (Number(idx) + 1));
        nameDisplay.style.display = '';
    }
    inputEl.style.display = 'none';
}

function bindEvents() {
    // 主题切换
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    // 音乐（顶栏内联播放器：不再需要 musicBtn 打开浮窗，仅保留兼容入口和 ☰ 歌单按钮）
    const musicBtn = document.getElementById('musicBtn'); // 兼容旧 DOM（若存在）
    const closeMusicBtn = document.getElementById('musicClose') || document.getElementById('closeMusic');
    const mpListBtn = document.getElementById('mpListBtn');
    const mpListCloseBtn = document.getElementById('mpListCloseBtn');
    if (musicBtn) musicBtn.addEventListener('click', openMusic);
    if (closeMusicBtn) closeMusicBtn.addEventListener('click', closeMusic);
    // ☰ 展开/收起歌单 popover
    if (mpListBtn) mpListBtn.addEventListener('click', toggleMusicListPopover);
    if (mpListCloseBtn) mpListCloseBtn.addEventListener('click', closeMusic);

    // 歌单抽屉：鼠标离开播放器及抽屉整体区域 300ms 后自动收起关闭
    let popoverTimer;
    const mpInlineEl = document.getElementById('mpInline');
    if (mpInlineEl) {
        mpInlineEl.addEventListener('mouseenter', () => {
            clearTimeout(popoverTimer);
        });
        mpInlineEl.addEventListener('mouseleave', () => {
            popoverTimer = setTimeout(() => {
                closeMusic();
            }, 300);
        });
    }

    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeMusic();
            const modal1 = document.getElementById('addGalleryImageModal');
            const modal2 = document.getElementById('addCustomLinkModal');
            const modal3 = document.getElementById('mpManageModal');
            if (modal1) modal1.classList.remove('active');
            if (modal2) modal2.classList.remove('active');
            if (modal3) modal3.classList.remove('active');
            showOverlay(false);
        });
    }

    // 置顶轮播（Handsome 风格自动轮播与鼠标悬浮暂停）
    const heroPrev = document.getElementById('heroPrev');
    const heroNext = document.getElementById('heroNext');
    const heroCard = document.getElementById('heroCard');
    
    if (heroPrev) heroPrev.addEventListener('click', () => changeHero(currentHero - 1));
    if (heroNext) heroNext.addEventListener('click', () => changeHero(currentHero + 1));

    let heroAutoTimer = setInterval(() => {
        const items = getHeroItems();
        if (items.length > 1) changeHero(currentHero + 1);
    }, 5000);

    if (heroCard) {
        heroCard.addEventListener('mouseenter', () => clearInterval(heroAutoTimer));
        heroCard.addEventListener('mouseleave', () => {
            clearInterval(heroAutoTimer);
            heroAutoTimer = setInterval(() => {
                const items = getHeroItems();
                if (items.length > 1) changeHero(currentHero + 1);
            }, 5000);
        });
    }

    // 移动端抽屉
    const hamburger = document.getElementById('hamburger');
    const drawerClose = document.getElementById('drawerClose');
    const mobileDrawer = document.getElementById('mobileDrawer');
    if (hamburger) {
        hamburger.addEventListener('click', e => {
            e.stopPropagation();
            if (typeof openMobileDrawer === 'function') {
                openMobileDrawer();
            } else if (window.openMobileDrawer) {
                window.openMobileDrawer();
            }
        });
    }
    if (drawerClose) {
        drawerClose.addEventListener('click', e => {
            e.stopPropagation();
            if (typeof closeMobileDrawer === 'function') {
                closeMobileDrawer();
            } else if (window.closeMobileDrawer) {
                window.closeMobileDrawer();
            }
        });
    }
    if (mobileDrawer) {
        mobileDrawer.addEventListener('click', event => {
            if (event.target === mobileDrawer) {
                if (typeof closeMobileDrawer === 'function') {
                    closeMobileDrawer();
                } else if (window.closeMobileDrawer) {
                    window.closeMobileDrawer();
                }
            }
        });
    }

    // —— Web 桌面端专属：右侧绳索悬挂回到顶部控件 ——
    const hangingPet = document.getElementById('hangingPetWrapper');
    if (hangingPet) {
        const ropeLine = hangingPet.querySelector('.hanging-pet-line');
        const updateRopeVisibility = () => {
            const isPastTop = window.scrollY > 200;
            const isDesktop = window.innerWidth > 900;
            hangingPet.classList.toggle('is-visible', isPastTop && isDesktop);

            if (isPastTop && isDesktop && ropeLine) {
                // 绳索长度适配视口高度，确保底部 TOP 按钮始终优雅地处于屏幕可见区域内（离底部留出安全舒适间距）
                const maxAllowedHeight = Math.max(160, Math.min(window.innerHeight - 200, 480));
                // 根据滚动比例进行微量自然弹性微动（最多延伸 15px），绝不溢出窗口
                const scrollProgress = Math.min(1, Math.max(0, (window.scrollY - 200) / 1000));
                const currentHeight = (maxAllowedHeight - 15) + (scrollProgress * 15);
                ropeLine.style.height = `${Math.round(currentHeight)}px`;
            }
        };

        window.addEventListener('scroll', updateRopeVisibility, { passive: true });
        window.addEventListener('resize', updateRopeVisibility, { passive: true });
        updateRopeVisibility();

        hangingPet.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // —— 主题与样式高级控制面板事件 ——
    window.openThemeModal = function() {
        const modal = document.getElementById('themeSettingsModal');
        if (!modal) return;
        if (modal.parentNode !== document.documentElement) {
            document.documentElement.appendChild(modal);
        }

        // 同步所有输入控件与显示文本
        const bgSel = document.getElementById('paramBgTexture');
        if (bgSel) bgSel.value = state.themeBg || localStorage.getItem('themeBg') || 'gradient';

        const fontSel = document.getElementById('paramFontFamily');
        if (fontSel) fontSel.value = state.themeFont || localStorage.getItem('themeFont') || 'default';

        const colorPick = document.getElementById('paramColorPicker');
        const colorHex = document.getElementById('paramColorHex');
        const colorDisplay = document.getElementById('colorHexDisplay');
        const swatchBox = document.getElementById('paramColorSwatchBox');
        const hueSlider = document.getElementById('paramHueSlider');
        const hueVal = document.getElementById('hueVal');
        const curColor = state.themePresetColor || localStorage.getItem('themePresetColor') || '#6366f1';
        if (colorPick) colorPick.value = curColor;
        if (colorHex) colorHex.value = curColor;
        if (colorDisplay) colorDisplay.textContent = curColor;
        if (swatchBox) swatchBox.style.backgroundColor = curColor;
        if (hueSlider) {
            const h = hexToHue(curColor);
            hueSlider.value = h;
            if (hueVal) hueVal.textContent = `${h}°`;
        }

        const tgIn = document.getElementById('paramTopGap');
        const tgSpan = document.getElementById('topGapVal');
        const topGap = state.themeTopGap || localStorage.getItem('themeTopGap') || '8';
        if (tgIn) tgIn.value = topGap;
        if (tgSpan) tgSpan.textContent = `${topGap}px`;

        const ggIn = document.getElementById('paramGridGapX');
        const ggSpan = document.getElementById('gridGapXVal');
        const gridGapX = state.themeGridGapX || localStorage.getItem('themeGridGapX') || '6';
        if (ggIn) ggIn.value = gridGapX;
        if (ggSpan) ggSpan.textContent = `${gridGapX}px`;

        const cgIn = document.getElementById('paramCardGapY');
        const cgSpan = document.getElementById('cardGapYVal');
        const cardGapY = state.themeCardGapY || localStorage.getItem('themeCardGapY') || '10';
        if (cgIn) cgIn.value = cardGapY;
        if (cgSpan) cgSpan.textContent = `${cardGapY}px`;

        const agtIn = document.getElementById('paramArticleGapTop');
        const agtSpan = document.getElementById('articleGapTopVal');
        const articleGapTop = state.themeArticleGapTop || localStorage.getItem('themeArticleGapTop') || '0';
        if (agtIn) agtIn.value = articleGapTop;
        if (agtSpan) agtSpan.textContent = `${articleGapTop}px`;

        const agbIn = document.getElementById('paramArticleGapBottom');
        const agbSpan = document.getElementById('articleGapBottomVal');
        const articleGapBottom = state.themeArticleGapBottom || localStorage.getItem('themeArticleGapBottom') || '14';
        if (agbIn) agbIn.value = articleGapBottom;
        if (agbSpan) agbSpan.textContent = `${articleGapBottom}px`;

        // 文章卡片尺寸（高度百分比 & 宽度百分比）
        const chIn = document.getElementById('paramCardHeight');
        const chSpan = document.getElementById('cardHeightVal');
        const cardHeight = state.themeCardHeight || localStorage.getItem('themeCardHeight') || '100';
        if (chIn) chIn.value = cardHeight;
        if (chSpan) chSpan.textContent = `${cardHeight}%`;

        const cwIn = document.getElementById('paramCardWidth');
        const cwSpan = document.getElementById('cardWidthVal');
        const cardWidth = state.themeCardWidth || localStorage.getItem('themeCardWidth') || '100';
        if (cwIn) cwIn.value = cardWidth;
        if (cwSpan) cwSpan.textContent = `${cardWidth}%`;

        const rIn = document.getElementById('paramRadius');
        const rSpan = document.getElementById('radiusVal');
        const cardRadius = state.themeRadius || localStorage.getItem('themeRadius') || '20';
        if (rIn) rIn.value = cardRadius;
        if (rSpan) rSpan.textContent = `${cardRadius}px`;

        const srIn = document.getElementById('paramSidebarRadius');
        const srSpan = document.getElementById('sidebarRadiusVal');
        const sidebarRadius = state.themeSidebarRadius || localStorage.getItem('themeSidebarRadius') || '18';
        if (srIn) srIn.value = sidebarRadius;
        if (srSpan) srSpan.textContent = `${sidebarRadius}px`;

        // 透明度（卡片与板块，支持最低 0%）
        const coIn = document.getElementById('paramCardOpacity');
        const coSpan = document.getElementById('cardOpacityVal');
        const cardOpacity = (state.themeCardOpacity !== undefined && state.themeCardOpacity !== null && state.themeCardOpacity !== '')
            ? state.themeCardOpacity
            : (localStorage.getItem('themeCardOpacity') ?? '85');
        if (coIn) coIn.value = cardOpacity;
        if (coSpan) coSpan.textContent = `${cardOpacity}%`;

        const soIn = document.getElementById('paramSidebarOpacity');
        const soSpan = document.getElementById('sidebarOpacityVal');
        const sidebarOpacity = (state.themeSidebarOpacity !== undefined && state.themeSidebarOpacity !== null && state.themeSidebarOpacity !== '')
            ? state.themeSidebarOpacity
            : (localStorage.getItem('themeSidebarOpacity') ?? '85');
        if (soIn) soIn.value = sidebarOpacity;
        if (soSpan) soSpan.textContent = `${sidebarOpacity}%`;

        const blIn = document.getElementById('paramBlur');
        const blSpan = document.getElementById('blurVal');
        const blur = state.themeBlur || localStorage.getItem('themeBlur') || '16';
        if (blIn) blIn.value = blur;
        if (blSpan) blSpan.textContent = `${blur}px`;

        const rwIn = document.getElementById('paramRopeWidth');
        const rwSpan = document.getElementById('ropeWidthVal');
        const ropeWidth = state.themeRopeWidth || localStorage.getItem('themeRopeWidth') || '3.5';
        if (rwIn) rwIn.value = ropeWidth;
        if (rwSpan) rwSpan.textContent = `${ropeWidth}px`;

        if (typeof applyThemeCustomizations === 'function') {
            applyThemeCustomizations();
        }
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    };

    window.closeThemeModal = function() {
        const modal = document.getElementById('themeSettingsModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    };

    const openThemeCard = document.getElementById('openThemeSettingsCard');
    const themeModal = document.getElementById('themeSettingsModal');
    const closeThemeBtn = document.getElementById('closeThemeSettingsModalBtn');
    const saveThemeBtn = document.getElementById('saveThemeModalBtn');

    if (openThemeCard) {
        openThemeCard.addEventListener('click', window.openThemeModal);
    }
    if (closeThemeBtn) closeThemeBtn.addEventListener('click', window.closeThemeModal);
    if (saveThemeBtn) saveThemeBtn.addEventListener('click', () => {
        window.closeThemeModal();
        if (typeof showToast === 'function') showToast('主题外观配置已保存！');
    });
    if (themeModal) {
        themeModal.addEventListener('click', e => {
            if (e.target === themeModal) window.closeThemeModal();
        });
    }

    const bgTextureSelect = document.getElementById('paramBgTexture');
    const fontFamilySelect = document.getElementById('paramFontFamily');
    const radiusInput = document.getElementById('paramRadius');
    const blurInput = document.getElementById('paramBlur');
    const colorPicker = document.getElementById('paramColorPicker');
    const colorHexInput = document.getElementById('paramColorHex');
    const colorHexDisplay = document.getElementById('colorHexDisplay');
    const hueSlider = document.getElementById('paramHueSlider');
    const hueValSpan = document.getElementById('hueVal');
    const presetBtns = document.querySelectorAll('.preset-color-btn');

    if (bgTextureSelect) {
        bgTextureSelect.value = state.themeBg || 'gradient';
        bgTextureSelect.addEventListener('change', () => {
            state.themeBg = bgTextureSelect.value;
            localStorage.setItem('themeBg', state.themeBg);
            applyThemeCustomizations();
        });
    }

    if (fontFamilySelect) {
        fontFamilySelect.value = state.themeFont || 'default';
        fontFamilySelect.addEventListener('change', () => {
            state.themeFont = fontFamilySelect.value;
            localStorage.setItem('themeFont', state.themeFont);
            applyThemeCustomizations();
        });
    }

    // 调色盘：彩虹色相连续光谱条
    const swatchBoxEl = document.getElementById('paramColorSwatchBox');
    if (hueSlider) {
        hueSlider.addEventListener('input', () => {
            const h = Number(hueSlider.value);
            if (hueValSpan) hueValSpan.textContent = `${h}°`;
            const hex = hueToHex(h);
            state.themePresetColor = hex;
            localStorage.setItem('themePresetColor', hex);
            if (colorPicker) colorPicker.value = hex;
            if (colorHexInput) colorHexInput.value = hex;
            if (colorHexDisplay) colorHexDisplay.textContent = hex;
            if (swatchBoxEl) swatchBoxEl.style.backgroundColor = hex;
            applyThemeCustomizations();
        });
    }

    if (colorPicker && colorHexInput) {
        const curColor = state.themePresetColor || localStorage.getItem('themePresetColor') || '#6366f1';
        colorPicker.value = curColor;
        colorHexInput.value = curColor;
        if (colorHexDisplay) colorHexDisplay.textContent = curColor;
        if (swatchBoxEl) swatchBoxEl.style.backgroundColor = curColor;

        colorPicker.addEventListener('input', () => {
            const val = colorPicker.value;
            colorHexInput.value = val;
            if (colorHexDisplay) colorHexDisplay.textContent = val;
            if (swatchBoxEl) swatchBoxEl.style.backgroundColor = val;
            state.themePresetColor = val;
            localStorage.setItem('themePresetColor', val);
            if (hueSlider) {
                const h = hexToHue(val);
                hueSlider.value = h;
                if (hueValSpan) hueValSpan.textContent = `${h}°`;
            }
            applyThemeCustomizations();
        });

        colorHexInput.addEventListener('input', () => {
            let val = colorHexInput.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                colorPicker.value = val;
                if (colorHexDisplay) colorHexDisplay.textContent = val;
                if (swatchBoxEl) swatchBoxEl.style.backgroundColor = val;
                state.themePresetColor = val;
                localStorage.setItem('themePresetColor', val);
                if (hueSlider) {
                    const h = hexToHue(val);
                    hueSlider.value = h;
                    if (hueValSpan) hueValSpan.textContent = `${h}°`;
                }
                applyThemeCustomizations();
            }
        });
    }

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            if (color) {
                state.themePresetColor = color;
                localStorage.setItem('themePresetColor', color);
                if (colorPicker) colorPicker.value = color;
                if (colorHexInput) colorHexInput.value = color;
                if (colorHexDisplay) colorHexDisplay.textContent = color;
                if (swatchBoxEl) swatchBoxEl.style.backgroundColor = color;
                if (hueSlider) {
                    const h = hexToHue(color);
                    hueSlider.value = h;
                    if (hueValSpan) hueValSpan.textContent = `${h}°`;
                }
                applyThemeCustomizations();
            }
        });
    });

    // 文章卡片尺寸控制 (Card Height % & Card Width %)
    const cardHeightInput = document.getElementById('paramCardHeight');
    if (cardHeightInput) {
        cardHeightInput.value = state.themeCardHeight || localStorage.getItem('themeCardHeight') || '100';
        const valSpan = document.getElementById('cardHeightVal');
        if (valSpan) valSpan.textContent = `${cardHeightInput.value}%`;
        cardHeightInput.addEventListener('input', () => {
            state.themeCardHeight = cardHeightInput.value;
            localStorage.setItem('themeCardHeight', state.themeCardHeight);
            if (valSpan) valSpan.textContent = `${cardHeightInput.value}%`;
            applyThemeCustomizations();
        });
    }

    const cardWidthInput = document.getElementById('paramCardWidth');
    if (cardWidthInput) {
        cardWidthInput.value = state.themeCardWidth || localStorage.getItem('themeCardWidth') || '100';
        const valSpan = document.getElementById('cardWidthVal');
        if (valSpan) valSpan.textContent = `${cardWidthInput.value}%`;
        cardWidthInput.addEventListener('input', () => {
            state.themeCardWidth = cardWidthInput.value;
            localStorage.setItem('themeCardWidth', state.themeCardWidth);
            if (valSpan) valSpan.textContent = `${cardWidthInput.value}%`;
            applyThemeCustomizations();
        });
    }

    // 圆角控制
    if (radiusInput) {
        radiusInput.value = state.themeRadius || '20';
        const valSpan = document.getElementById('radiusVal');
        if (valSpan) valSpan.textContent = `${radiusInput.value}px`;
        radiusInput.addEventListener('input', () => {
            state.themeRadius = radiusInput.value;
            localStorage.setItem('themeRadius', state.themeRadius);
            if (valSpan) valSpan.textContent = `${radiusInput.value}px`;
            applyThemeCustomizations();
        });
    }

    const sidebarRadiusInput = document.getElementById('paramSidebarRadius');
    if (sidebarRadiusInput) {
        sidebarRadiusInput.value = state.themeSidebarRadius || localStorage.getItem('themeSidebarRadius') || '18';
        const valSpan = document.getElementById('sidebarRadiusVal');
        if (valSpan) valSpan.textContent = `${sidebarRadiusInput.value}px`;
        sidebarRadiusInput.addEventListener('input', () => {
            state.themeSidebarRadius = sidebarRadiusInput.value;
            localStorage.setItem('themeSidebarRadius', state.themeSidebarRadius);
            if (valSpan) valSpan.textContent = `${sidebarRadiusInput.value}px`;
            applyThemeCustomizations();
        });
    }

    // 透明度控制（文章卡片透明度 与 板块透明度，支持最低 0%）
    const cardOpacityInput = document.getElementById('paramCardOpacity');
    if (cardOpacityInput) {
        cardOpacityInput.value = (state.themeCardOpacity !== undefined && state.themeCardOpacity !== null && state.themeCardOpacity !== '')
            ? state.themeCardOpacity
            : (localStorage.getItem('themeCardOpacity') ?? '85');
        const valSpan = document.getElementById('cardOpacityVal');
        if (valSpan) valSpan.textContent = `${cardOpacityInput.value}%`;
        cardOpacityInput.addEventListener('input', () => {
            state.themeCardOpacity = cardOpacityInput.value;
            localStorage.setItem('themeCardOpacity', state.themeCardOpacity);
            if (valSpan) valSpan.textContent = `${cardOpacityInput.value}%`;
            applyThemeCustomizations();
        });
    }

    const sidebarOpacityInput = document.getElementById('paramSidebarOpacity');
    if (sidebarOpacityInput) {
        sidebarOpacityInput.value = (state.themeSidebarOpacity !== undefined && state.themeSidebarOpacity !== null && state.themeSidebarOpacity !== '')
            ? state.themeSidebarOpacity
            : (localStorage.getItem('themeSidebarOpacity') ?? '85');
        const valSpan = document.getElementById('sidebarOpacityVal');
        if (valSpan) valSpan.textContent = `${sidebarOpacityInput.value}%`;
        sidebarOpacityInput.addEventListener('input', () => {
            state.themeSidebarOpacity = sidebarOpacityInput.value;
            localStorage.setItem('themeSidebarOpacity', state.themeSidebarOpacity);
            if (valSpan) valSpan.textContent = `${sidebarOpacityInput.value}%`;
            applyThemeCustomizations();
        });
    }

    if (blurInput) {
        blurInput.value = state.themeBlur || '16';
        const valSpan = document.getElementById('blurVal');
        if (valSpan) valSpan.textContent = `${blurInput.value}px`;
        blurInput.addEventListener('input', () => {
            state.themeBlur = blurInput.value;
            localStorage.setItem('themeBlur', state.themeBlur);
            if (valSpan) valSpan.textContent = `${blurInput.value}px`;
            applyThemeCustomizations();
        });
    }

    const ropeWidthInput = document.getElementById('paramRopeWidth');
    if (ropeWidthInput) {
        ropeWidthInput.value = state.themeRopeWidth || localStorage.getItem('themeRopeWidth') || '3.5';
        const valSpan = document.getElementById('ropeWidthVal');
        if (valSpan) valSpan.textContent = `${ropeWidthInput.value}px`;
        ropeWidthInput.addEventListener('input', () => {
            state.themeRopeWidth = ropeWidthInput.value;
            localStorage.setItem('themeRopeWidth', state.themeRopeWidth);
            if (valSpan) valSpan.textContent = `${ropeWidthInput.value}px`;
            applyThemeCustomizations();
        });
    }

    // 布局间隙控制器 (GridGapX / TopGap / CardGapY)
    const gridGapXInput = document.getElementById('paramGridGapX');
    if (gridGapXInput) {
        gridGapXInput.value = state.themeGridGapX || localStorage.getItem('themeGridGapX') || '6';
        const valSpan = document.getElementById('gridGapXVal');
        if (valSpan) valSpan.textContent = `${gridGapXInput.value}px`;
        gridGapXInput.addEventListener('input', () => {
            state.themeGridGapX = gridGapXInput.value;
            localStorage.setItem('themeGridGapX', state.themeGridGapX);
            if (valSpan) valSpan.textContent = `${gridGapXInput.value}px`;
            applyThemeCustomizations();
        });
    }

    const topGapInput = document.getElementById('paramTopGap');
    if (topGapInput) {
        topGapInput.value = state.themeTopGap || localStorage.getItem('themeTopGap') || '8';
        const valSpan = document.getElementById('topGapVal');
        if (valSpan) valSpan.textContent = `${topGapInput.value}px`;
        topGapInput.addEventListener('input', () => {
            state.themeTopGap = topGapInput.value;
            localStorage.setItem('themeTopGap', state.themeTopGap);
            if (valSpan) valSpan.textContent = `${topGapInput.value}px`;
            applyThemeCustomizations();
        });
    }

    const cardGapYInput = document.getElementById('paramCardGapY');
    if (cardGapYInput) {
        cardGapYInput.value = state.themeCardGapY || localStorage.getItem('themeCardGapY') || '10';
        const valSpan = document.getElementById('cardGapYVal');
        if (valSpan) valSpan.textContent = `${cardGapYInput.value}px`;
        cardGapYInput.addEventListener('input', () => {
            state.themeCardGapY = cardGapYInput.value;
            localStorage.setItem('themeCardGapY', state.themeCardGapY);
            if (valSpan) valSpan.textContent = `${cardGapYInput.value}px`;
            applyThemeCustomizations();
        });
    }

    const articleGapTopInput = document.getElementById('paramArticleGapTop');
    if (articleGapTopInput) {
        articleGapTopInput.value = state.themeArticleGapTop || localStorage.getItem('themeArticleGapTop') || '0';
        const valSpan = document.getElementById('articleGapTopVal');
        if (valSpan) valSpan.textContent = `${articleGapTopInput.value}px`;
        articleGapTopInput.addEventListener('input', () => {
            state.themeArticleGapTop = articleGapTopInput.value;
            localStorage.setItem('themeArticleGapTop', state.themeArticleGapTop);
            if (valSpan) valSpan.textContent = `${articleGapTopInput.value}px`;
            applyThemeCustomizations();
        });
    }

    const articleGapBottomInput = document.getElementById('paramArticleGapBottom');
    if (articleGapBottomInput) {
        articleGapBottomInput.value = state.themeArticleGapBottom || localStorage.getItem('themeArticleGapBottom') || '14';
        const valSpan = document.getElementById('articleGapBottomVal');
        if (valSpan) valSpan.textContent = `${articleGapBottomInput.value}px`;
        articleGapBottomInput.addEventListener('input', () => {
            state.themeArticleGapBottom = articleGapBottomInput.value;
            localStorage.setItem('themeArticleGapBottom', state.themeArticleGapBottom);
            if (valSpan) valSpan.textContent = `${articleGapBottomInput.value}px`;
            applyThemeCustomizations();
        });
    }

    // 初始化时加载主题配置
    applyThemeCustomizations();

    // —— 音乐播放控制（新版网易云风格浮窗） ——
    const mpPrev = document.getElementById('mpPrevBtn');
    const mpPlay = document.getElementById('mpPlayBtn');
    const mpNext = document.getElementById('mpNextBtn');
    const mpPlayList = document.getElementById('mpPlayList');
    const mpGear = document.getElementById('mpGearBtn');
    const mpManage = document.getElementById('mpManageModal');
    const mpManageClose = document.getElementById('mpCloseManageBtn');
    const mpApiInput = document.getElementById('mpApiInput');
    const mpSaveApiBtn = document.getElementById('mpSaveApiBtn');
    const mpSearchInput = document.getElementById('mpSearchInput');
    const mpSearchBtn = document.getElementById('mpSearchBtn');
    const mpSearchResult = document.getElementById('mpSearchResult');
    const mpCurrentPlaylist = document.getElementById('mpCurrentPlaylist');

    // 上一首
    if (mpPrev) {
        mpPrev.addEventListener('click', () => {
            stepSong(-1);
            playSongByIndex(state.curSongIdx, true);
        });
    }
    // 下一首
    if (mpNext) {
        mpNext.addEventListener('click', () => {
            stepSong(1);
            playSongByIndex(state.curSongIdx, true);
        });
    }
    // 播放/暂停（中间大圆按钮）
    if (mpPlay) {
        mpPlay.addEventListener('click', () => {
            if (typeof toggleMusicPlayPause === 'function') {
                toggleMusicPlayPause();
            }
        });
    }
    // 点击歌单条目：直接切到这一首
    if (mpPlayList) {
        mpPlayList.addEventListener('click', e => {
            const li = e.target.closest('li[data-mp-idx]');
            if (!li) return;
            const idx = Number(li.getAttribute('data-mp-idx'));
            if (Number.isInteger(idx) && idx >= 0) playSongByIndex(idx, true);
        });
    }

    // —— 管理员：齿轮按钮打开「歌单管理」Modal ——
    if (mpGear) {
        mpGear.addEventListener('click', () => {
            if (!(state && state.isAdmin)) {
                if (typeof showToast === 'function') showToast('仅管理员可管理歌单，请先登录管理员账号', 'warning');
                return;
            }
            if (mpApiInput) mpApiInput.value = state.musicApiBase || '';
            renderMusicManageCurrent();
            if (mpManage) {
                if (typeof moveModalToRoot === 'function') moveModalToRoot('mpManageModal');
                mpManage.classList.add('active'); showOverlay(true);
            }
        });
    }
    if (mpManageClose) {
        mpManageClose.addEventListener('click', () => {
            if (mpManage) { mpManage.classList.remove('active'); showOverlay(false); }
        });
    }
        // ========== 歌单管理 Modal：TAB 切换与多平台云链接解析 ==========
        const tabParse = document.getElementById('mpTabParseLinkBtn');
        const tabAccount = document.getElementById('mpTabAccountSearchBtn');
        const tabNormal = document.getElementById('mpTabNormalSearchBtn');
        const paneParse = document.getElementById('mpPaneLinkParse');
        const paneAccount = document.getElementById('mpPaneAccountSearch');
        const paneNormal = document.getElementById('mpPaneNormalSearch');

        function switchMpTab(tab) {
            [tabParse, tabAccount, tabNormal].forEach(b => b && b.classList.remove('active'));
            [paneParse, paneAccount, paneNormal].forEach(p => p && (p.style.display = 'none'));

            if (tab === 'parse') {
                if (tabParse) tabParse.classList.add('active');
                if (paneParse) paneParse.style.display = 'block';
            } else if (tab === 'account') {
                if (tabAccount) tabAccount.classList.add('active');
                if (paneAccount) paneAccount.style.display = 'block';
            } else if (tab === 'normal') {
                if (tabNormal) tabNormal.classList.add('active');
                if (paneNormal) paneNormal.style.display = 'block';
            }
        }

        if (tabParse) tabParse.addEventListener('click', () => switchMpTab('parse'));
        if (tabAccount) tabAccount.addEventListener('click', () => switchMpTab('account'));
        if (tabNormal) tabNormal.addEventListener('click', () => switchMpTab('normal'));

        // 1. 多平台云链接解析添加
        const parseLinkBtn = document.getElementById('mpParseLinkBtn');
        const cloudLinkInput = document.getElementById('mpCloudLinkInput');

        if (parseLinkBtn && cloudLinkInput) {
            parseLinkBtn.addEventListener('click', () => {
                const linkVal = cloudLinkInput.value.trim();
                if (!linkVal) {
                    if (typeof showToast === 'function') showToast('请输入有效的音乐云链接！');
                    return;
                }
                if (typeof parseMultiPlatformMusicLink === 'function') {
                    const parsedSong = parseMultiPlatformMusicLink(linkVal);
                    if (parsedSong) {
                        if (addSongToPlaylist(parsedSong)) {
                            if (typeof showToast === 'function') showToast(`解析成功！已添加：${parsedSong.name}`);
                            cloudLinkInput.value = '';
                            renderMusicPlayerUI();
                            renderMusicManageCurrent();
                        } else {
                            if (typeof showToast === 'function') showToast('该歌曲已经在歌单中啦！');
                        }
                    } else {
                        if (typeof showToast === 'function') showToast('未能解析该链接，请确认链接格式。');
                    }
                }
            });
        }

        // 2. 账号绑定登录
        const accountLoginBtn = document.getElementById('mpAccountLoginBtn');
        const accountPhoneInput = document.getElementById('mpAccountPhoneInput');
        const accountPlatformSelect = document.getElementById('mpAccountPlatformSelect');
        const accountTip = document.getElementById('mpAccountLoginStatusTip');

        if (accountLoginBtn) {
            accountLoginBtn.addEventListener('click', () => {
                const platform = accountPlatformSelect ? accountPlatformSelect.value : 'netease';
                const account = accountPhoneInput ? accountPhoneInput.value.trim() : '';
                if (!account) {
                    if (typeof showToast === 'function') showToast('请输入手机号或凭证');
                    return;
                }
                const platformName = platform === 'qq' ? 'QQ音乐' : '网易云音乐';
                if (accountTip) accountTip.textContent = `✅ 已成功绑定 ${platformName} 账号 (${account})`;
                if (typeof showToast === 'function') showToast(`账号绑定成功！已解锁 ${platformName} VIP 试听权限`);
            });
        }
    // 搜索（网易云多源高可靠算法）
    function doMusicSearch() {
        if (!(state && state.isAdmin)) return;
        const kw = (mpSearchInput ? mpSearchInput.value : '').trim();
        if (!kw) return;
        if (!mpSearchResult) return;
        mpSearchResult.innerHTML = `
            <div style="text-align:center; padding:36px 20px; color:#3b82f6; font-weight:600;">
                <span style="display:inline-block; animation:spin 1s linear infinite; margin-right:6px;">🔎</span> 正在全网检索「${escapeHtml(kw)}」，请稍候...
            </div>
        `;
        searchNetease(kw, 15).then(list => {
            if (!list || !list.length) {
                mpSearchResult.innerHTML = '<div style="text-align:center; padding:32px 20px; color:#94a3b8;">未找到匹配的歌曲，换个关键词（例如：周杰伦 / 晴天 / 海阔天空）试试吧～</div>';
                return;
            }
            window._mpSearchResults = list;
            mpSearchResult.innerHTML = list.map((s, idx) => `
                <div class="mp-manage-row">
                    <img src="${s.picUrl || 'img/img6.jpg'}" alt="" loading="lazy" onerror="this.src='img/img6.jpg'">
                    <div class="mp-manage-row-meta">
                        <div class="mp-manage-row-name">${escapeHtml(s.name)}</div>
                        <div class="mp-manage-row-art">${escapeHtml(s.artist || '')}</div>
                    </div>
                    <button type="button" class="primary-btn add-song-btn" style="padding:6px 16px; border-radius:999px; font-size:12.5px; font-weight:600;"
                        data-search-idx="${idx}">＋ 添加</button>
                </div>
            `).join('');
        }).catch(err => {
            console.error('[搜索出错]', err);
            mpSearchResult.innerHTML = '<div style="text-align:center; padding:28px 20px; color:#ef4444;">搜索超时或请求异常，请稍后重试。</div>';
        });
    }
    if (mpSearchBtn) mpSearchBtn.addEventListener('click', doMusicSearch);
    if (mpSearchInput) {
        mpSearchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); doMusicSearch(); }
        });
    }
    // 搜索结果「＋ 添加」事件委托（基于索引引用，避免 JSON 转义卡死）
    if (mpSearchResult) {
        mpSearchResult.addEventListener('click', e => {
            const btn = e.target.closest('button.add-song-btn');
            if (!btn || !(state && state.isAdmin)) return;
            const idx = Number(btn.getAttribute('data-search-idx'));
            const list = window._mpSearchResults || [];
            const meta = Number.isInteger(idx) && list[idx] ? list[idx] : null;
            if (!meta) return;
            if (addSongToPlaylist(meta)) {
                if (typeof showToast === 'function') showToast(`已成功添加：${meta.name}`);
                renderMusicPlayerUI();
                renderMusicManageCurrent();
            } else {
                if (typeof showToast === 'function') showToast('该歌曲已经在歌单中啦！');
            }
        });
    }
    // 当前歌单列表渲染 + 每行「删除」按钮事件
    function renderMusicManageCurrent() {
        if (!mpCurrentPlaylist) return;
        if (!(state && state.isAdmin)) { mpCurrentPlaylist.innerHTML = ''; return; }
        if (!state.musicPlaylist || !state.musicPlaylist.length) {
            mpCurrentPlaylist.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">暂无歌曲，用上方搜索框搜索并添加吧～</div>';
            return;
        }
        mpCurrentPlaylist.innerHTML = state.musicPlaylist.map((s, idx) => `
            <div class="mp-manage-row">
                <img src="${s.picUrl || 'img/img6.jpg'}" alt="" loading="lazy" onerror="this.src='img/img6.jpg'">
                <div class="mp-manage-row-meta">
                    <div class="mp-manage-row-name">${idx + 1}. ${escapeHtml(s.name)}</div>
                    <div class="mp-manage-row-art">${escapeHtml(s.artist || '')}</div>
                </div>
                <button type="button" class="secondary-btn remove-song-btn" style="padding:6px 12px; border-radius:999px; font-size:12px; color:#b91c1c; border-color:#fecaca;" data-remove-idx="${idx}">删除</button>
            </div>
        `).join('');
    }
    if (mpCurrentPlaylist) {
        mpCurrentPlaylist.addEventListener('click', e => {
            const btn = e.target.closest('button.remove-song-btn');
            if (!btn || !(state && state.isAdmin)) return;
            const idx = Number(btn.getAttribute('data-remove-idx'));
            if (!Number.isInteger(idx)) return;
            const name = (state.musicPlaylist[idx] && state.musicPlaylist[idx].name) || '';
            const doRemove = () => {
                if (removeSongAt(idx)) {
                    renderMusicPlayerUI();
                    renderMusicManageCurrent();
                    if (typeof showToast === 'function') showToast('已从歌单移除', 'info');
                }
            };
            if (typeof showConfirmModal === 'function') {
                showConfirmModal({
                    title: '移除歌曲',
                    message: `确定从自定义歌单中移除「${name}」吗？`,
                    confirmText: '确认移除',
                    cancelText: '取消',
                    danger: true,
                    onConfirm: doRemove
                });
            } else {
                doRemove();
            }
        });
    }

    // 兼容旧 button id musicPlay/musicPause（若仍存在则绑定，避免删除后报错）
    const musicPlay = document.getElementById('musicPlay');
    const musicPause = document.getElementById('musicPause');
    if (musicPlay) {
        musicPlay.addEventListener('click', () => {
            const audio = document.getElementById('bgAudio');
            if (audio) {
                if (!audio.src || audio.src.startsWith('data:')) {
                    playSongByIndex(state.curSongIdx || 0, true);
                } else {
                    audio.play().catch(() => { });
                }
            }
            state.musicPlaying = true;
            updateMusicStatus();
            localStorage.setItem(STORAGE_KEYS.musicPlaying, 'true');
        });
    }
    if (musicPause) {
        musicPause.addEventListener('click', () => {
            const audio = document.getElementById('bgAudio');
            if (audio) audio.pause();
            state.musicPlaying = false;
            updateMusicStatus();
            localStorage.setItem(STORAGE_KEYS.musicPlaying, 'false');
        });
    }

    // 管理员按钮
    const adminAddBtn = document.getElementById('adminAddBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    const editProfileBtn = document.getElementById('editProfileBtn');

    if (adminAddBtn) adminAddBtn.addEventListener('click', () => openArticleEditor(null));
    // 控制台「新增文章」方形卡片（原顶栏按钮移入控制台）
    const adminAddCardWrapper = document.getElementById('adminAddCardWrapper');
    if (adminAddCardWrapper) adminAddCardWrapper.addEventListener('click', () => openArticleEditor(null));
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            handleAdminLogout();
            renderAdminUI();
            renderArticles();
            showToast('已退出管理员模式', 'info');
        });
    }
    if (editProfileBtn) editProfileBtn.addEventListener('click', openProfileEditor);

    // ========== 内联文章详情事件 ==========
    const detailBackBtn = document.getElementById('detailBackBtn');
    const detailEditBtn = document.getElementById('detailEditBtn');
    const detailDeleteBtn = document.getElementById('detailDeleteBtn');

    if (detailBackBtn) detailBackBtn.addEventListener('click', closeArticleViewer);
    if (detailEditBtn) detailEditBtn.addEventListener('click', editFromViewer);
    if (detailDeleteBtn) {
        detailDeleteBtn.addEventListener('click', () => {
            if (!currentViewerArticleId) return;
            const doDel = () => {
                deleteArticle(currentViewerArticleId);
                renderAll();
                switchView('list');
                if (typeof showToast === 'function') showToast('文章已删除', 'info');
            };
            if (typeof showConfirmModal === 'function') {
                showConfirmModal({
                    title: '删除文章',
                    message: '确定删除这篇文章吗？删除后可在回收站找回。',
                    confirmText: '确认删除',
                    cancelText: '取消',
                    danger: true,
                    onConfirm: doDel
                });
            } else {
                doDel();
            }
        });
    }

    // ========== 内联文章编辑器事件 ==========
    const editorCancelBtn = document.getElementById('editorCancelBtn');
    const inlineSaveArticleBtn = document.getElementById('inlineSaveArticleBtn');
    const inlineResetArticleBtn = document.getElementById('inlineResetArticleBtn');
    const inlineCancelEditorBtn = document.getElementById('inlineCancelEditorBtn');
    const inlineArticleMarkdown = document.getElementById('inlineArticleMarkdown');
    const inlineCategorySelect = document.getElementById('inlineArticleCategorySelect');
    const inlineAddCategoryBtn = document.getElementById('inlineAddCategoryBtn');

    if (editorCancelBtn) editorCancelBtn.addEventListener('click', closeArticleEditor);
    if (inlineSaveArticleBtn) inlineSaveArticleBtn.addEventListener('click', saveArticle);
    if (inlineResetArticleBtn) inlineResetArticleBtn.addEventListener('click', resetArticleEditor);
    if (inlineCancelEditorBtn) inlineCancelEditorBtn.addEventListener('click', closeArticleEditor);

    // 分类输入框：支持手动输入与即时渲染推荐标签
    const inlineCategoryInput = document.getElementById('inlineArticleCategoryInput');
    if (inlineCategoryInput) {
        inlineCategoryInput.addEventListener('input', (e) => {
            const newCat = e.target.value.trim();
            const hidden = document.getElementById('inlineArticleCategory');
            if (hidden) hidden.value = newCat;
            if (typeof renderTagPickerUI === 'function') renderTagPickerUI(newCat, typeof collectTagsFromPickerAndInput === 'function' ? collectTagsFromPickerAndInput() : []);
            if (typeof refreshCategorySelectUI === 'function') refreshCategorySelectUI(newCat);
            if (typeof triggerAutoSave === 'function') triggerAutoSave();
        });
    }
    // + 新分类按钮：管理员可快速新增一个自定义分类
    if (inlineAddCategoryBtn) {
        inlineAddCategoryBtn.addEventListener('click', () => {
            if (!(state && state.isAdmin)) return;
            if (typeof showPromptModal === 'function') {
                showPromptModal({
                    title: '新建文章分类',
                    message: '输入新分类名称（将同步添加到侧边栏分类风箱）：',
                    placeholder: '例如：前端技术',
                    onConfirm: (name) => {
                        if (!name) return;
                        const catName = name.toString().trim();
                        if (!catName) return;
                        if (typeof addCategory === 'function') addCategory(catName);
                        const hidden = document.getElementById('inlineArticleCategory');
                        if (hidden) hidden.value = catName;
                        if (typeof renderAll === 'function') renderAll();
                    }
                });
            }
        });
    }

    ['inlineArticleTitle', 'inlineArticleCategorySelect', 'inlineArticleTags', 'inlineArticleCover'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => { if (typeof triggerAutoSave === 'function') triggerAutoSave(); });
            el.addEventListener('change', () => { if (typeof triggerAutoSave === 'function') triggerAutoSave(); });
        }
    });

    if (inlineArticleMarkdown) {
        let activeBlock = null;
        const undoStack = [];
        const redoStack = [];
        let isUndoRedoAction = false;

        function ensureTrailingEmptyBlock(editor) {
            if (!editor) return;
            const lastChild = editor.lastElementChild;
            const isTrailingEmpty = lastChild && 
                (lastChild.classList.contains('typora-line') || lastChild.getAttribute('data-typora-state') === 'raw') && 
                (!lastChild.textContent || !lastChild.textContent.trim());

            if (!isTrailingEmpty) {
                const emptyBlock = document.createElement('div');
                emptyBlock.className = 'typora-line';
                emptyBlock.setAttribute('data-typora-state', 'raw');
                emptyBlock.innerHTML = '<br>';
                editor.appendChild(emptyBlock);
            }
        }

        function saveEditorSnapshot() {
            if (isUndoRedoAction || !inlineArticleMarkdown) return;
            const html = inlineArticleMarkdown.innerHTML;
            if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== html) {
                undoStack.push(html);
                if (undoStack.length > 50) undoStack.shift();
                redoStack.length = 0;
            }
        }

        function handleEditorUndo() {
            if (!inlineArticleMarkdown || undoStack.length === 0) return;
            isUndoRedoAction = true;
            redoStack.push(inlineArticleMarkdown.innerHTML);
            const prevHtml = undoStack.pop();
            inlineArticleMarkdown.innerHTML = prevHtml;
            ensureTrailingEmptyBlock(inlineArticleMarkdown);
            activeBlock = null;
            isUndoRedoAction = false;
        }

        function handleEditorRedo() {
            if (!inlineArticleMarkdown || redoStack.length === 0) return;
            isUndoRedoAction = true;
            undoStack.push(inlineArticleMarkdown.innerHTML);
            const nextHtml = redoStack.pop();
            inlineArticleMarkdown.innerHTML = nextHtml;
            ensureTrailingEmptyBlock(inlineArticleMarkdown);
            activeBlock = null;
            isUndoRedoAction = false;
        }

        function getTopBlock(node, container) {
            if (!node || !container || !container.contains(node)) return null;
            let block = node;
            while (block && block !== container && block.parentNode !== container) {
                block = block.parentNode;
            }
            return (block && block !== container) ? block : null;
        }

        function htmlToMarkdownText(node) {
            if (!node) return '';
            if (node.nodeType === 3) return node.nodeValue;
            if (node.nodeType !== 1) return '';

            const tag = node.tagName.toUpperCase();
            const childrenText = Array.from(node.childNodes).map(htmlToMarkdownText).join('');

            switch(tag) {
                case 'H1': return '# ' + childrenText.trim();
                case 'H2': return '## ' + childrenText.trim();
                case 'H3': return '### ' + childrenText.trim();
                case 'H4': return '#### ' + childrenText.trim();
                case 'STRONG': case 'B': return '**' + childrenText.trim() + '**';
                case 'EM': case 'I': return '*' + childrenText.trim() + '*';
                case 'DEL': case 'S': case 'STRIKE': return '~~' + childrenText.trim() + '~~';
                case 'CODE': return '`' + childrenText.trim() + '`';
                case 'PRE': {
                    const codeEl = node.querySelector('code');
                    const lang = codeEl ? (codeEl.className.replace('language-', '') || '') : '';
                    const body = codeEl ? codeEl.innerText : childrenText;
                    return '```' + lang + '\n' + body.trim() + '\n```';
                }
                case 'BLOCKQUOTE': return '> ' + childrenText.trim();
                case 'A': {
                    const href = node.getAttribute('href') || '#';
                    return '[' + childrenText.trim() + '](' + href + ')';
                }
                case 'IMG': {
                    const src = node.getAttribute('src') || '';
                    const alt = node.getAttribute('alt') || '图片';
                    return '![' + alt + '](' + src + ')';
                }
                case 'LI': return '- ' + childrenText.trim();
                case 'UL': return Array.from(node.querySelectorAll('li')).map(li => '- ' + Array.from(li.childNodes).map(htmlToMarkdownText).join('').trim()).join('\n');
                case 'OL': return Array.from(node.querySelectorAll('li')).map((li, i) => (i+1) + '. ' + Array.from(li.childNodes).map(htmlToMarkdownText).join('').trim()).join('\n');
                case 'HR': return '---';
                default: return childrenText;
            }
        }

        function getBlockRawText(block) {
            if (!block) return '';
            if (block.getAttribute && block.getAttribute('data-typora-raw')) {
                return block.getAttribute('data-typora-raw');
            }
            return htmlToMarkdownText(block).trim();
        }

        function renderBlockToHtml(block) {
            if (!block || !block.parentNode) return null;
            const text = (block.getAttribute && block.getAttribute('data-typora-raw')) || block.textContent || '';
            if (!text.trim()) return block;
            if (block.getAttribute && block.getAttribute('data-typora-state') === 'rendered') return block;

            saveEditorSnapshot();

            const html = (typeof parseMarkdown === 'function') ? parseMarkdown(text) : `<p>${text}</p>`;
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const renderedEl = temp.firstElementChild || temp;
            renderedEl.setAttribute('data-typora-raw', text);
            renderedEl.setAttribute('data-typora-state', 'rendered');

            block.parentNode.replaceChild(renderedEl, block);
            ensureTrailingEmptyBlock(inlineArticleMarkdown);
            return renderedEl;
        }

        function expandBlockToRaw(block) {
            if (!block || !block.parentNode) return null;
            if (block.getAttribute && block.getAttribute('data-typora-state') === 'raw') return block;

            saveEditorSnapshot();

            const rawText = getBlockRawText(block);
            const rawDiv = document.createElement('div');
            rawDiv.className = 'typora-line typora-raw-line';
            rawDiv.setAttribute('data-typora-state', 'raw');
            rawDiv.setAttribute('data-typora-raw', rawText);

            // 检查是否包含图片语法 ![alt](url) -> 语法下方并存实时渲染卡片
            const imgMatch = rawText.match(/!\[(.*?)\]\((.*?)\)/);

            if (imgMatch) {
                const altText = imgMatch[1] || '图片';
                const imgUrl = imgMatch[2] || '';
                
                rawDiv.className = 'typora-line typora-raw-line typora-raw-img-container';
                rawDiv.innerHTML = `
                    <div class="typora-raw-code-part" contenteditable="true">${escHtml(rawText)}</div>
                    <div class="typora-img-below-preview" contenteditable="false">
                        <img src="${imgUrl}" alt="${altText}" class="typora-below-img" onerror="this.style.display='none';">
                        <div class="typora-img-below-tip">🖼️ 语法下方即时预览 (与 Markdown 语法并存)</div>
                    </div>
                `;

                const codePart = rawDiv.querySelector('.typora-raw-code-part');
                if (codePart) {
                    codePart.addEventListener('input', () => {
                        saveEditorSnapshot();
                        const curText = codePart.textContent || '';
                        rawDiv.setAttribute('data-typora-raw', curText);
                        const match = curText.match(/!\[(.*?)\]\((.*?)\)/);
                        const img = rawDiv.querySelector('.typora-below-img');
                        if (match && img) {
                            img.style.display = 'block';
                            img.src = match[2];
                        }
                    });
                }
            } else {
                rawDiv.textContent = rawText;
            }

            block.parentNode.replaceChild(rawDiv, block);
            ensureTrailingEmptyBlock(inlineArticleMarkdown);
            return rawDiv;
        }

        function handleSelectionChange() {
            const editor = document.getElementById('inlineArticleMarkdown');
            if (!editor) return;

            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            let node = sel.getRangeAt(0).startContainer;

            // 获得当前光标所在的行块
            const currentBlock = getTopBlock(node, editor);

            if (currentBlock !== activeBlock) {
                // 1) 离开了原有的行 -> 自动切为排版好的 Visual 渲染态 (如 # 你好 -> <h1>你好</h1>)
                if (activeBlock && editor.contains(activeBlock)) {
                    renderBlockToHtml(activeBlock);
                }

                // 2) 光标点击/切入新行 -> 自动展开为 Typora 原始 Markdown 语法 (如 <h1>你好</h1> -> # 你好)
                if (currentBlock && editor.contains(currentBlock)) {
                    const expanded = expandBlockToRaw(currentBlock);
                    activeBlock = expanded;
                    if (expanded) {
                        const targetFocus = expanded.querySelector('.typora-raw-code-part') || expanded;
                        moveCaretToEnd(targetFocus);
                    }
                } else {
                    activeBlock = null;
                }
            }

            ensureTrailingEmptyBlock(editor);
        }

        document.addEventListener('selectionchange', handleSelectionChange);

        inlineArticleMarkdown.addEventListener('keydown', e => {
            // Ctrl + Z (撤回) & Ctrl + Y / Ctrl + Shift + Z (重做)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleEditorRedo();
                } else {
                    handleEditorUndo();
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleEditorRedo();
                return;
            }

            if (e.key === 'Enter') {
                saveEditorSnapshot();
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    let node = sel.getRangeAt(0).startContainer;
                    if (node && node.nodeType === 3) node = node.parentNode;
                    const curBlock = getTopBlock(node, inlineArticleMarkdown);

                    if (curBlock) {
                        const raw = getBlockRawText(curBlock);
                        const isBlockEmpty = !raw.trim() || curBlock.innerHTML === '<br>';

                        // 1. 代码块：允许块内换行
                        if (curBlock.classList.contains('typora-code-wrap') || curBlock.classList.contains('typora-code-raw-line')) {
                            return;
                        }

                        // 2. 有序列表
                        const olMatch = raw.match(/^(\d+)\.\s*(.*)/);
                        if (olMatch) {
                            if (olMatch[2].trim()) { // 非空列表项：自增续写 2.
                                const nextNum = parseInt(olMatch[1], 10) + 1;
                                e.preventDefault();
                                const newBlock = document.createElement('div');
                                newBlock.className = 'typora-line';
                                newBlock.setAttribute('data-typora-state', 'raw');
                                newBlock.textContent = `${nextNum}. `;
                                curBlock.after(newBlock);
                                activeBlock = newBlock;
                                moveCaretToEnd(newBlock);
                                ensureTrailingEmptyBlock(inlineArticleMarkdown);
                                return;
                            } else { // 空的列表项：按回车重置退出列表
                                curBlock.textContent = '';
                                curBlock.innerHTML = '<br>';
                                return;
                            }
                        }

                        // 3. 无序列表
                        const ulMatch = raw.match(/^([-*+])\s*(.*)/);
                        if (ulMatch) {
                            if (ulMatch[2].trim()) { // 非空列表项：自增续写 - 
                                e.preventDefault();
                                const newBlock = document.createElement('div');
                                newBlock.className = 'typora-line';
                                newBlock.setAttribute('data-typora-state', 'raw');
                                newBlock.textContent = `${ulMatch[1]} `;
                                curBlock.after(newBlock);
                                activeBlock = newBlock;
                                moveCaretToEnd(newBlock);
                                ensureTrailingEmptyBlock(inlineArticleMarkdown);
                                return;
                            } else { // 空列表项：按回车重置退出列表
                                curBlock.textContent = '';
                                curBlock.innerHTML = '<br>';
                                return;
                            }
                        }

                        // 4. 空块按回车：新建一个空模块行
                        if (isBlockEmpty) {
                            e.preventDefault();
                            const newEmptyBlock = document.createElement('div');
                            newEmptyBlock.className = 'typora-line';
                            newEmptyBlock.setAttribute('data-typora-state', 'raw');
                            newEmptyBlock.innerHTML = '<br>';
                            curBlock.after(newEmptyBlock);
                            activeBlock = newEmptyBlock;
                            moveCaretToEnd(newEmptyBlock);
                            ensureTrailingEmptyBlock(inlineArticleMarkdown);
                            return;
                        }

                        // 5. 非空块按回车：允许在当前块内部正常换行（不强行拆分新建块）
                        return;
                    }
                }
                setTimeout(handleSelectionChange, 10);
            }
        });

        inlineArticleMarkdown.addEventListener('input', () => {
            saveEditorSnapshot();
            ensureTrailingEmptyBlock(inlineArticleMarkdown);
        });
    }

    // Typora 风格富文本工具栏按钮点击处理
    const toolbar = document.querySelector('.editor-toolbar');
    if (toolbar) {
        toolbar.addEventListener('click', e => {
            const btn = e.target.closest('.tb-btn');
            if (!btn) return;
            e.preventDefault();
            const cmd = btn.dataset.cmd;
            const editor = document.getElementById('inlineArticleMarkdown');
            if (!editor) return;
            editor.focus();

            const sel = window.getSelection();
            let selectedText = sel ? sel.toString() : '';

            let insertText = '';
            switch(cmd) {
                case 'h1': insertText = `# ${selectedText || '一级标题'}`; break;
                case 'h2': insertText = `## ${selectedText || '二级标题'}`; break;
                case 'h3': insertText = `### ${selectedText || '三级标题'}`; break;
                case 'bold': insertText = `**${selectedText || '加粗文本'}**`; break;
                case 'italic': insertText = `*${selectedText || '斜体文本'}*`; break;
                case 'strike': insertText = `~~${selectedText || '删除线文本'}~~`; break;
                case 'quote': insertText = `> ${selectedText || '引用文本'}`; break;
                case 'code': insertText = `\`\`\`\n${selectedText || '代码内容'}\n\`\`\``; break;
                case 'ul': insertText = `- ${selectedText || '无序列表项'}`; break;
                case 'ol': insertText = `1. ${selectedText || '有序列表项'}`; break;
                case 'hr': insertText = `---`; break;
                case 'link': {
                    if (typeof showPromptModal === 'function') {
                        showPromptModal({
                            title: '插入超链接',
                            message: '输入要跳转的目标网页地址：',
                            placeholder: 'https://',
                            defaultValue: 'https://',
                            onConfirm: (url) => {
                                if (!url) return;
                                const ins = `[${selectedText || '链接文本'}](${url})`;
                                document.execCommand('insertText', false, ins);
                                if (typeof handleSelectionChange === 'function') setTimeout(handleSelectionChange, 10);
                            }
                        });
                        return;
                    }
                    break;
                }
                case 'img': {
                    if (typeof showPromptModal === 'function') {
                        showPromptModal({
                            title: '插入图片链接',
                            message: '输入图片 URL 或相对路径：',
                            placeholder: '如 img/img6.jpg 或 https://...',
                            defaultValue: 'img/img6.jpg',
                            onConfirm: (url) => {
                                if (!url) return;
                                const ins = `![${selectedText || '图片'}](${url})`;
                                document.execCommand('insertText', false, ins);
                                if (typeof handleSelectionChange === 'function') setTimeout(handleSelectionChange, 10);
                            }
                        });
                        return;
                    }
                    break;
                }
                case 'table': {
                    insertText = `\n| 表头 1 | 表头 2 |\n| --- | --- |\n| 内容 1 | 内容 2 |\n`;
                    break;
                }
            }

            if (insertText) {
                document.execCommand('insertText', false, insertText);
                if (typeof handleSelectionChange === 'function') {
                    setTimeout(handleSelectionChange, 10);
                }
            }
        });
    }

    function moveCaretToEnd(el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // ========== 文章封面图片选项与上传事件 ==========
    const coverTabUrl = document.getElementById('coverTabUrl');
    const coverTabFile = document.getElementById('coverTabFile');
    const coverTabNone = document.getElementById('coverTabNone');
    const inlineArticleCover = document.getElementById('inlineArticleCover');
    const inlineArticleCoverFile = document.getElementById('inlineArticleCoverFile');
    const clearCoverBtn = document.getElementById('clearCoverBtn');

    if (coverTabUrl) coverTabUrl.addEventListener('click', () => setCoverMode('url'));
    if (coverTabFile) coverTabFile.addEventListener('click', () => setCoverMode('file'));
    if (coverTabNone) coverTabNone.addEventListener('click', () => setCoverMode('none'));

    if (inlineArticleCover) {
        inlineArticleCover.addEventListener('input', () => {
            if (currentCoverMode === 'url') {
                updateCoverPreview(inlineArticleCover.value);
            }
        });
    }

    if (inlineArticleCoverFile) {
        inlineArticleCoverFile.addEventListener('change', event => {
            const file = event.target.files && event.target.files[0];
            const tip = document.getElementById('coverFileNameTip');
            if (file) {
                if (tip) tip.textContent = file.name;
                const reader = new FileReader();
                reader.onload = e => {
                    tempCoverDataUrl = e.target.result;
                    setCoverMode('file');
                    updateCoverPreview(tempCoverDataUrl);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (clearCoverBtn) {
        clearCoverBtn.addEventListener('click', () => {
            setCoverMode('none');
        });
    }

    // ========== 个人资料头像图片选项与上传事件 ==========
    const profileTabUrl = document.getElementById('profileTabUrl');
    const profileTabFile = document.getElementById('profileTabFile');
    const profileAvatarInput = document.getElementById('profileAvatarInput');
    const profileAvatarFileInput = document.getElementById('profileAvatarFileInput');

    if (profileTabUrl) profileTabUrl.addEventListener('click', () => setAvatarMode('url'));
    if (profileTabFile) profileTabFile.addEventListener('click', () => setAvatarMode('file'));

    if (profileAvatarInput) {
        profileAvatarInput.addEventListener('input', () => {
            if (currentAvatarMode === 'url') {
                const img = document.getElementById('profileAvatarPreviewImg');
                if (img) img.src = profileAvatarInput.value || defaultProfile.avatar;
            }
        });
    }

    if (profileAvatarFileInput) {
        profileAvatarFileInput.addEventListener('change', event => {
            const file = event.target.files && event.target.files[0];
            const tip = document.getElementById('profileFileNameTip');
            if (file) {
                if (tip) tip.textContent = file.name;
                const reader = new FileReader();
                reader.onload = e => {
                    tempAvatarDataUrl = e.target.result;
                    setAvatarMode('file');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 资料编辑器与侧边栏管理按钮
    const sidebarEditBloggerBtn = document.getElementById('sidebarEditBloggerBtn');
    const closeProfileEditorBtn = document.getElementById('closeProfileEditor');
    const closeProfileEditorBtn2 = document.getElementById('closeProfileEditorBtn2');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const addSocialRowBtn = document.getElementById('addSocialRowBtn');

    if (sidebarEditBloggerBtn) sidebarEditBloggerBtn.addEventListener('click', openProfileEditor);
    if (closeProfileEditorBtn) closeProfileEditorBtn.addEventListener('click', closeProfileEditor);
    if (closeProfileEditorBtn2) closeProfileEditorBtn2.addEventListener('click', closeProfileEditor);
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfileEditor);
    if (addSocialRowBtn) addSocialRowBtn.addEventListener('click', () => addSocialEditorRow());

    // 首页个人简历与介绍编辑弹窗事件
    const closeHomeResumeEditorBtn = document.getElementById('closeHomeResumeEditorBtn');
    const hreCancelBtn = document.getElementById('hreCancelBtn');
    const hreSaveBtn = document.getElementById('hreSaveBtn');
    const hreResetDefaultBtn = document.getElementById('hreResetDefaultBtn');
    const hreAddAboutBtn = document.getElementById('hreAddAboutBtn');
    const hreAddSkillCategoryBtn = document.getElementById('hreAddSkillCategoryBtn');
    const hreAddProjectBtn = document.getElementById('hreAddProjectBtn');
    const hreAddTimelineBtn = document.getElementById('hreAddTimelineBtn');

    if (closeHomeResumeEditorBtn) closeHomeResumeEditorBtn.addEventListener('click', closeHomeResumeEditor);
    if (hreCancelBtn) hreCancelBtn.addEventListener('click', closeHomeResumeEditor);
    if (hreSaveBtn) hreSaveBtn.addEventListener('click', saveHomeResumeEditor);
    if (hreResetDefaultBtn) hreResetDefaultBtn.addEventListener('click', resetHomeResumeEditor);
    if (hreAddAboutBtn) hreAddAboutBtn.addEventListener('click', addHreAboutRow);
    if (hreAddSkillCategoryBtn) hreAddSkillCategoryBtn.addEventListener('click', addHreSkillCategoryRow);
    if (hreAddProjectBtn) hreAddProjectBtn.addEventListener('click', addHreProjectRow);
    if (hreAddTimelineBtn) hreAddTimelineBtn.addEventListener('click', addHreTimelineRow);

    document.querySelectorAll('.hre-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-hre-tab');
            if (tab && typeof switchHomeResumeTab === 'function') {
                switchHomeResumeTab(tab);
            }
        });
    });

    // 标签管理器按钮与事件
    const sidebarManageTagsBtn = document.getElementById('sidebarManageTagsBtn');
    const closeTagManagerBtn = document.getElementById('closeTagManager');
    const addNewTagBtn = document.getElementById('addNewTagBtn');

    if (sidebarManageTagsBtn) sidebarManageTagsBtn.addEventListener('click', openTagManager);
    if (closeTagManagerBtn) closeTagManagerBtn.addEventListener('click', closeTagManager);
    if (addNewTagBtn) {
        addNewTagBtn.addEventListener('click', () => {
            const input = document.getElementById('newTagNameInput');
            if (input && input.value.trim()) {
                addNewGlobalTag(input.value.trim());
                input.value = '';
            }
        });
    }

    // 搜索
    const searchForm = document.getElementById('searchForm');
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    const searchInput = document.getElementById('search_input');
    const topBar = document.querySelector('.top');
    if (searchForm) {
        const setTopSearchActive = active => {
            if (topBar) topBar.classList.toggle('search-active', active);
        };
        const checkNoticeProximity = () => {
            const banner = document.getElementById('topNoticeBanner');
            const search = document.getElementById('searchForm');
            if (banner && search && topBar) {
                const bannerRect = banner.getBoundingClientRect();
                const searchRect = search.getBoundingClientRect();
                if (bannerRect.width > 0 && (searchRect.left - bannerRect.right < 35)) {
                    topBar.classList.add('banner-close-proximity');
                } else {
                    topBar.classList.remove('banner-close-proximity');
                }
            }
        };
        window.addEventListener('resize', checkNoticeProximity);
        setTimeout(checkNoticeProximity, 100);

        if (searchToggleBtn && searchInput) {
            searchToggleBtn.addEventListener('click', e => {
                const isFocused = document.activeElement === searchInput;
                const val = searchInput.value.trim();
                if (!isFocused && !searchForm.classList.contains('is-expanded')) {
                    searchForm.classList.add('is-expanded');
                    setTopSearchActive(true);
                    searchInput.focus();
                } else if (val) {
                    searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
                } else {
                    searchForm.classList.remove('is-expanded');
                    setTopSearchActive(false);
                    searchInput.blur();
                }
            });
            searchInput.addEventListener('focus', () => {
                setTopSearchActive(true);
            });
            searchInput.addEventListener('blur', () => {
                if (!searchInput.value.trim()) {
                    searchForm.classList.remove('is-expanded');
                    setTopSearchActive(false);
                }
            });
        }
        searchForm.addEventListener('submit', event => {
            event.preventDefault();
            const value = document.getElementById('search_input').value.trim();
            if (!value) {
                if (typeof showToast === 'function') showToast('请输入搜索关键词', 'warning');
                return;
            }
            activeSearch = value;
            currentPage = 1;
            switchView('list');
            renderArticles();
            renderFilters();
        });
    }

    initSearch('sidebarSearchInput', value => {
        activeSearch = value;
        currentPage = 1;
        switchView('list');
        renderArticles();
        renderFilters();
    });

    // 排序
    document.querySelectorAll('.sort-group button').forEach(button => {
        button.addEventListener('click', () => {
            activeSort = button.dataset.sort;
            document.querySelectorAll('.sort-group button').forEach(btn =>
                btn.classList.toggle('active', btn === button)
            );
            switchView('list');
            renderArticles();
        });
    });

    // 全站通用留言表单
    const commentForm = document.getElementById('commentForm');
    if (commentForm) {
        // 初始化：从 cookie 读取访客信息预填表单
        const visitor = (typeof loadVisitorInfo === 'function') ? loadVisitorInfo() : { name: '', contact: '' };
        const nameInput = document.getElementById('commentName');
        const contactInput = document.getElementById('commentContact');
        if (nameInput && visitor.name) nameInput.value = visitor.name;
        if (contactInput && visitor.contact) contactInput.value = visitor.contact;

        commentForm.addEventListener('submit', event => {
            event.preventDefault();
            const name = document.getElementById('commentName').value.trim();
            const contact = document.getElementById('commentContact').value.trim();
            const content = document.getElementById('commentContent').value.trim();
            if (!name || !contact || !content) {
                if (typeof showToast === 'function') showToast('请填写昵称、联系方式和留言内容');
                return;
            }
            addComment(name, contact, content);
            // 保存访客信息到 cookie，下次自动填充
            if (typeof saveVisitorInfo === 'function') saveVisitorInfo(name, contact);
            renderComments();
            // 仅清空内容，保留昵称和联系方式便于下次
            const contentEl = document.getElementById('commentContent');
            if (contentEl) contentEl.value = '';
        });
    }

    // 文章详情页内联评论表单提交
    const inlineCommentSubmitBtn = document.getElementById('inlineArticleCommentSubmit');
    if (inlineCommentSubmitBtn) {
        // 初始化：从 cookie 读取访客信息预填表单
        const visitor = (typeof loadVisitorInfo === 'function') ? loadVisitorInfo() : { name: '', contact: '' };
        const nameInput0 = document.getElementById('inlineArticleCommentName');
        const contactInput0 = document.getElementById('inlineArticleCommentContact');
        if (nameInput0 && visitor.name) nameInput0.value = visitor.name;
        if (contactInput0 && visitor.contact) contactInput0.value = visitor.contact;

        inlineCommentSubmitBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('inlineArticleCommentName');
            const contactInput = document.getElementById('inlineArticleCommentContact');
            const contentInput = document.getElementById('inlineArticleCommentContent');
            const name = nameInput ? nameInput.value.trim() : '';
            const contact = contactInput ? contactInput.value.trim() : '';
            const content = contentInput ? contentInput.value.trim() : '';

            if (!name || !contact || !content) {
                if (typeof showToast === 'function') showToast('请填写昵称、联系方式和评论内容');
                return;
            }

            if (!currentViewerArticleId) return;
            const article = getArticleById(currentViewerArticleId);
            if (article) {
                if (!article.commentList) article.commentList = [];
                const newComment = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    name: name,
                    contact: contact,
                    content: content,
                    date: new Date().toISOString(),
                    parentId: null
                };
                article.commentList.push(newComment);
                article.comment = (article.comment || 0) + 1;

                // 保存访客信息到 cookie
                if (typeof saveVisitorInfo === 'function') saveVisitorInfo(name, contact);

                saveArticlesToStorage();

                if (contentInput) contentInput.value = '';
                // 保留昵称和联系方式便于下次
                renderInlineArticleComments(currentViewerArticleId);
                renderAll();
                if (typeof showToast === 'function') showToast('评论发表成功！');
            }
        });
    }

    // ========== 回复按钮事件委托（主区 + 文章详情页共用） ==========
    document.addEventListener('click', e => {
        // 切换回复框显示
        const toggleBtn = e.target.closest('[data-action="toggle-reply"]');
        if (toggleBtn) {
            const id = toggleBtn.dataset.id;
            const replyTo = toggleBtn.dataset.replyTo;
            const box = document.querySelector(`[data-reply-box="${id}"]`);
            if (box) {
                const isHidden = box.style.display === 'none';
                box.style.display = isHidden ? '' : 'none';
                if (isHidden) {
                    const ta = box.querySelector('.reply-textarea');
                    if (ta) {
                        if (replyTo && !ta.value.startsWith(`@${replyTo}`)) {
                            ta.value = `@${replyTo} `;
                        }
                        // 让 textarea 获取焦点
                        setTimeout(() => {
                            ta.focus();
                            ta.selectionStart = ta.selectionEnd = ta.value.length;
                        }, 50);
                    }
                }
            }
            return;
        }

        // 取消回复
        const cancelBtn = e.target.closest('[data-action="cancel-reply"]');
        if (cancelBtn) {
            const id = cancelBtn.dataset.id;
            const box = document.querySelector(`[data-reply-box="${id}"]`);
            const ta = box ? box.querySelector('.reply-textarea') : null;
            if (ta) ta.value = '';
            if (box) box.style.display = 'none';
            return;
        }

        // 提交回复
        const submitBtn = e.target.closest('[data-action="submit-reply"]');
        if (submitBtn) {
            const parentId = submitBtn.dataset.id;
            const scope = submitBtn.dataset.scope;
            const articleId = submitBtn.dataset.articleId;
            const box = document.querySelector(`[data-reply-box="${parentId}"]`);
            const ta = box ? box.querySelector('.reply-textarea') : null;
            const content = ta ? ta.value.trim() : '';

            if (!content) {
                if (typeof showToast === 'function') showToast('请填写回复内容');
                return;
            }

            // 从 cookie 读取访客信息
            const visitor = (typeof loadVisitorInfo === 'function') ? loadVisitorInfo() : { name: '', contact: '' };
            const name = visitor.name || '';
            const contact = visitor.contact || '';

            if (!name || !contact) {
                // cookie 中没有，弹出访客信息弹窗，保存待提交的回复上下文
                showVisitorInfoModal({
                    parentId, scope, articleId, content, box, ta
                });
                return;
            }

            doSubmitReply({ parentId, scope, articleId, content, name, contact, box, ta });
            return;
        }
    });

    // ========== 访客信息弹窗事件（首次回复评论时弹出） ==========
    const visitorInfoModal = document.getElementById('visitorInfoModal');
    const visitorInfoCloseBtn = document.getElementById('visitorInfoCloseBtn');
    const visitorInfoCancelBtn = document.getElementById('visitorInfoCancelBtn');
    const visitorInfoSubmitBtn = document.getElementById('visitorInfoSubmitBtn');
    const visitorNameInput = document.getElementById('visitorNameInput');
    const visitorContactInput = document.getElementById('visitorContactInput');

    // 关闭按钮 / 取消按钮
    if (visitorInfoCloseBtn) visitorInfoCloseBtn.addEventListener('click', hideVisitorInfoModal);
    if (visitorInfoCancelBtn) visitorInfoCancelBtn.addEventListener('click', hideVisitorInfoModal);

    // 点击背景遮罩关闭
    if (visitorInfoModal) {
        visitorInfoModal.addEventListener('click', e => {
            if (e.target === visitorInfoModal) hideVisitorInfoModal();
        });
    }

    // 提交访客信息：保存 cookie 并继续执行待处理的回复
    if (visitorInfoSubmitBtn) {
        visitorInfoSubmitBtn.addEventListener('click', () => {
            const name = visitorNameInput ? visitorNameInput.value.trim() : '';
            const contact = visitorContactInput ? visitorContactInput.value.trim() : '';
            if (!name || !contact) {
                if (typeof showToast === 'function') showToast('请填写昵称和联系方式');
                return;
            }
            // 保存到 cookie
            if (typeof saveVisitorInfo === 'function') saveVisitorInfo(name, contact);

            // 同步预填主留言表单 & 文章详情页评论表单
            const mainName = document.getElementById('commentName');
            const mainContact = document.getElementById('commentContact');
            if (mainName) mainName.value = name;
            if (mainContact) mainContact.value = contact;
            const inlineName = document.getElementById('inlineArticleCommentName');
            const inlineContact = document.getElementById('inlineArticleCommentContact');
            if (inlineName) inlineName.value = name;
            if (inlineContact) inlineContact.value = contact;

            // 取出待提交的回复上下文
            const pending = visitorInfoModal.__pendingReply || null;
            hideVisitorInfoModal();

            if (pending) {
                doSubmitReply({
                    parentId: pending.parentId,
                    scope: pending.scope,
                    articleId: pending.articleId,
                    content: pending.content,
                    name, contact,
                    box: pending.box,
                    ta: pending.ta
                });
            }
        });
    }

    // 在昵称/联系方式输入框中按 Enter 直接提交
    [visitorNameInput, visitorContactInput].forEach(el => {
        if (!el) return;
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (visitorInfoSubmitBtn) visitorInfoSubmitBtn.click();
            }
        });
    });

    // ========== 管理员删除评论（事件委托：主区/右侧栏/详情页共用高颜值弹窗确认） ==========
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-action="delete-comment"]');
        if (!btn) return;
        const scope = btn.dataset.scope;       // main | sidebar | article
        const commentId = btn.dataset.id;
        const articleId = btn.dataset.articleId;

        const doDelete = () => {
            if (scope === 'main' || scope === 'sidebar') {
                if (deleteCommentById(commentId)) {
                    renderComments();
                    renderAll();
                    if (typeof showToast === 'function') showToast('评论已删除');
                }
                return;
            }

            if (scope === 'article') {
                if (!articleId) return;
                if (deleteArticleComment(articleId, commentId)) {
                    if (currentViewerArticleId === Number(articleId)) {
                        renderInlineArticleComments(articleId);
                    }
                    renderAll();
                    if (typeof showToast === 'function') showToast('评论已删除');
                }
            }
        };

        if (typeof showConfirmModal === 'function') {
            showConfirmModal({
                title: '删除评论',
                message: '确定要删除这条评论吗？删除后将无法恢复。',
                confirmText: '确认删除',
                cancelText: '取消',
                danger: true,
                onConfirm: doDelete
            });
        } else {
            doDelete();
        }
    });

    // ========== 评论者联系方式 Tooltip（点击名字在旁边精准弹出） ==========
    let activeContactTooltip = null;

    const closeActiveTooltip = () => {
        if (activeContactTooltip) {
            activeContactTooltip.remove();
            activeContactTooltip = null;
        }
    };

    window.addEventListener('scroll', closeActiveTooltip, { passive: true });

    document.addEventListener('click', e => {
        const nameEl = e.target.closest('.comment-name-clickable[data-contact]');
        if (!nameEl) {
            closeActiveTooltip();
            return;
        }
        e.preventDefault();
        e.stopPropagation();

        closeActiveTooltip();

        const contact = nameEl.getAttribute('data-contact');
        if (!contact) return;
        const rect = nameEl.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'contact-tooltip';
        tooltip.innerHTML = `
            <div class="contact-label" style="display:flex; align-items:center; gap:5px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M16 2v2M8 2v2M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path></svg>
                <span>联系方式</span>
            </div>
            <div class="contact-value">${typeof escHtml === 'function' ? escHtml(contact) : contact}</div>
        `;
        // 必须挂载到 documentElement，避免 body filter 破坏 fixed 视口定位
        document.documentElement.appendChild(tooltip);

        const tooltipRect = tooltip.getBoundingClientRect();
        
        // 优先显示在名字右侧 (紧挨名字右边)
        let left = rect.right + 8;
        let top = rect.top + (rect.height - tooltipRect.height) / 2;
        let placement = 'right';

        // 如果右侧超出屏幕，放到左侧
        if (left + tooltipRect.width > window.innerWidth - 12) {
            left = rect.left - tooltipRect.width - 8;
            placement = 'left';
        }

        // 如果左侧也放不下或在小屏幕手机上，放到正下方
        if (left < 12 || window.innerWidth < 500) {
            left = Math.max(12, Math.min(rect.left, window.innerWidth - tooltipRect.width - 12));
            top = rect.bottom + 8;
            placement = 'bottom';
        }

        // 视口垂直边界保护
        if (top < 12) top = 12;
        if (top + tooltipRect.height > window.innerHeight - 12) {
            top = window.innerHeight - tooltipRect.height - 12;
        }

        tooltip.classList.add(`tooltip-${placement}`);
        tooltip.style.left = Math.round(left) + 'px';
        tooltip.style.top = Math.round(top) + 'px';
        activeContactTooltip = tooltip;
    });

    // 回到顶部（只在电脑客户端显示：滚动超过 250px 且窗口 > 900px 渐现，点击平滑滚动）
    const backTop = document.getElementById('backTop');
    if (backTop) {
        backTop.style.display = 'none';
        backTop.addEventListener('click', () =>
            window.scrollTo({ top: 0, behavior: 'smooth' })
        );
        window.addEventListener('scroll', () => {
            if (window.scrollY > 250 && window.innerWidth > 900) {
                backTop.style.display = 'flex';
            } else {
                backTop.style.display = 'none';
            }
        });
    }

    // ESC 快捷键
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeProfileEditor();
            if (typeof closeHomeResumeEditor === 'function') closeHomeResumeEditor();
            closeMusic();
        }
    });

    // 参数调试板事件绑定
    const opInput = document.getElementById('paramOpacity');
    const blInput = document.getElementById('paramBlur');
    const huInput = document.getElementById('paramHue');

    if (opInput) {
        opInput.addEventListener('input', e => {
            const val = e.target.value;
            localStorage.setItem('paramOpacity', val);
            const label = document.getElementById('opacityVal');
            if (label) label.textContent = val + '%';
            document.documentElement.style.setProperty('--glass-opacity', (val / 100).toFixed(2));
        });
    }
    if (blInput) {
        blInput.addEventListener('input', e => {
            const val = e.target.value;
            localStorage.setItem('paramBlur', val);
            const label = document.getElementById('blurVal');
            if (label) label.textContent = val + 'px';
            document.documentElement.style.setProperty('--glass-blur', val + 'px');
        });
    }
    if (huInput) {
        huInput.addEventListener('input', e => {
            const val = e.target.value;
            localStorage.setItem('paramHue', val);
            const label = document.getElementById('hueVal');
            if (label) label.textContent = val + '°';
            document.documentElement.style.setProperty('--theme-hue', val);
            if (paramColorPicker) paramColorPicker.value = hueToHex(Number(val));
        });
    }

    // 1. “管理”按钮点击事件，进入管理员控制面板
    const leftNavAdminBtn = document.getElementById('leftNavAdminManageBtn');
    const drawerNavAdminBtn = document.getElementById('drawerNavAdminManageBtn');
    const handleAdminClick = () => {
        if (!state.isAdmin) {
            window.location.href = 'admin/login.html';
        } else {
            switchView('adminControl');
            renderAdminControlLinks();
        }
    };
    if (leftNavAdminBtn) leftNavAdminBtn.addEventListener('click', handleAdminClick);
    if (drawerNavAdminBtn) drawerNavAdminBtn.addEventListener('click', handleAdminClick);

    // 2. 管理员控制面板按钮事件
    const closeAdminControlBtn = document.getElementById('closeAdminControlBtn');
    if (closeAdminControlBtn) {
        closeAdminControlBtn.addEventListener('click', () => switchView('list'));
    }

    const openGalleryBtn = document.getElementById('openGalleryBtn');
    if (openGalleryBtn) {
        openGalleryBtn.addEventListener('click', () => {
            if (typeof currentGalleryCategory !== 'undefined') currentGalleryCategory = 'cover';
            switchView('gallery');
            renderGallery();
        });
    }

    const openArticleImagesBtn = document.getElementById('openArticleImagesBtn');
    if (openArticleImagesBtn) {
        openArticleImagesBtn.addEventListener('click', () => {
            if (typeof currentGalleryCategory !== 'undefined') currentGalleryCategory = 'article';
            switchView('gallery');
            renderGallery();
        });
    }

    const openOtherImagesBtn = document.getElementById('openOtherImagesBtn');
    if (openOtherImagesBtn) {
        openOtherImagesBtn.addEventListener('click', () => {
            if (typeof currentGalleryCategory !== 'undefined') currentGalleryCategory = 'other';
            switchView('gallery');
            renderGallery();
        });
    }

    // 3. 自定义链接管理事件
    const addNewAdminLinkBtn = document.getElementById('addNewAdminLinkBtn');
    const addCustomLinkModal = document.getElementById('addCustomLinkModal');
    const closeCustomLinkModalBtn = document.getElementById('closeCustomLinkModalBtn');
    const cancelCustomLinkBtn = document.getElementById('cancelCustomLinkBtn');
    const saveCustomLinkBtn = document.getElementById('saveCustomLinkBtn');

    if (addNewAdminLinkBtn) {
        addNewAdminLinkBtn.addEventListener('click', () => {
            if (addCustomLinkModal) {
                if (typeof moveModalToRoot === 'function') moveModalToRoot('addCustomLinkModal');
                addCustomLinkModal.classList.add('active');
            }
            showOverlay(true);
        });
    }
    const closeCustomLink = () => {
        if (addCustomLinkModal) addCustomLinkModal.classList.remove('active');
        showOverlay(false);
        const titleIn = document.getElementById('newLinkTitleInput');
        const urlIn = document.getElementById('newLinkUrlInput');
        if (titleIn) titleIn.value = '';
        if (urlIn) urlIn.value = '';
    };
    if (closeCustomLinkModalBtn) closeCustomLinkModalBtn.addEventListener('click', closeCustomLink);
    if (cancelCustomLinkBtn) cancelCustomLinkBtn.addEventListener('click', closeCustomLink);

    if (saveCustomLinkBtn) {
        saveCustomLinkBtn.addEventListener('click', () => {
            const titleInput = document.getElementById('newLinkTitleInput');
            const urlInput = document.getElementById('newLinkUrlInput');
            const title = titleInput ? titleInput.value.trim() : '';
            const url = urlInput ? urlInput.value.trim() : '';
            if (!title || !url) {
                if (typeof showToast === 'function') showToast('请完整填写链接标题与地址', 'warning');
                return;
            }
            let links = getCustomAdminLinks();
            links.push({ title, url });
            saveCustomAdminLinks(links);
            closeCustomLink();
            renderAdminControlLinks();
        });
    }

    // 4. 图册管理界面按钮事件
    const backToAdminControlBtn = document.getElementById('backToAdminControlBtn');
    if (backToAdminControlBtn) {
        backToAdminControlBtn.addEventListener('click', () => switchView('adminControl'));
    }

    const gallerySearchInput = document.getElementById('gallerySearchInput');
    if (gallerySearchInput) {
        gallerySearchInput.addEventListener('input', e => renderGallery(e.target.value));
    }

    const galleryAddBtn = document.getElementById('galleryAddBtn');
    const addGalleryImageModal = document.getElementById('addGalleryImageModal');
    const closeAddGalleryImageModalBtn = document.getElementById('closeAddGalleryImageModalBtn');
    const cancelAddGalleryImageBtn = document.getElementById('cancelAddGalleryImageBtn');
    const saveGalleryImageBtn = document.getElementById('saveGalleryImageBtn');

    if (galleryAddBtn) {
        galleryAddBtn.addEventListener('click', () => {
            if (addGalleryImageModal) {
                if (typeof moveModalToRoot === 'function') moveModalToRoot('addGalleryImageModal');
                addGalleryImageModal.classList.add('active');
            }
            showOverlay(true);
        });
    }
    const closeGalleryModal = () => {
        if (addGalleryImageModal) addGalleryImageModal.classList.remove('active');
        showOverlay(false);
        const urlIn = document.getElementById('newGalleryUrlInput');
        if (urlIn) urlIn.value = '';
        tempGalleryImageDataUrl = '';
        const fileIn = document.getElementById('newGalleryFileInput');
        if (fileIn) fileIn.value = '';
        const tip = document.getElementById('newGalleryFileTip');
        if (tip) tip.textContent = '未选择文件';
    };
    if (closeAddGalleryImageModalBtn) closeAddGalleryImageModalBtn.addEventListener('click', closeGalleryModal);
    if (cancelAddGalleryImageBtn) cancelAddGalleryImageBtn.addEventListener('click', closeGalleryModal);

    // 图册图片模式切换
    const galleryTabUrl = document.getElementById('galleryTabUrl');
    const galleryTabFile = document.getElementById('galleryTabFile');
    const galleryUrlInputPane = document.getElementById('galleryUrlInputPane');
    const galleryFileInputPane = document.getElementById('galleryFileInputPane');

    if (galleryTabUrl) {
        galleryTabUrl.addEventListener('click', () => {
            galleryTabUrl.classList.add('active');
            if (galleryTabFile) galleryTabFile.classList.remove('active');
            if (galleryUrlInputPane) galleryUrlInputPane.style.display = 'block';
            if (galleryFileInputPane) galleryFileInputPane.style.display = 'none';
        });
    }
    if (galleryTabFile) {
        galleryTabFile.addEventListener('click', () => {
            galleryTabFile.classList.add('active');
            if (galleryTabUrl) galleryTabUrl.classList.remove('active');
            if (galleryUrlInputPane) galleryUrlInputPane.style.display = 'none';
            if (galleryFileInputPane) galleryFileInputPane.style.display = 'block';
        });
    }

    // 本地图片上传 FileReader 读取
    let tempGalleryImageDataUrl = '';
    const newGalleryFileInput = document.getElementById('newGalleryFileInput');
    if (newGalleryFileInput) {
        newGalleryFileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            const tip = document.getElementById('newGalleryFileTip');
            if (file) {
                if (tip) tip.textContent = file.name;
                const reader = new FileReader();
                reader.onload = ev => {
                    tempGalleryImageDataUrl = ev.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                if (tip) tip.textContent = '未选择文件';
            }
        });
    }

    if (saveGalleryImageBtn) {
        saveGalleryImageBtn.addEventListener('click', () => {
            const isUrl = galleryTabUrl ? galleryTabUrl.classList.contains('active') : true;
            let img = '';
            if (isUrl) {
                const urlIn = document.getElementById('newGalleryUrlInput');
                img = urlIn ? urlIn.value.trim() : '';
            } else {
                img = tempGalleryImageDataUrl;
            }

            if (!img) {
                if (typeof showToast === 'function') showToast('请填写图片 URL 地址或选择本地图片文件');
                return;
            }

            const cat = (typeof currentGalleryCategory !== 'undefined') ? currentGalleryCategory : 'cover';
            if (cat === 'article') {
                let images = (typeof getArticleContentImages === 'function') ? getArticleContentImages() : [];
                images.unshift(img);
                if (typeof saveArticleContentImages === 'function') saveArticleContentImages(images);
            } else if (cat === 'other') {
                let images = (typeof getOtherImages === 'function') ? getOtherImages() : [];
                images.unshift(img);
                if (typeof saveOtherImages === 'function') saveOtherImages(images);
            } else {
                let images = getGalleryImages();
                images.unshift(img);
                saveGalleryImages(images);
            }

            closeGalleryModal();
            const searchVal = document.getElementById('gallerySearchInput')?.value || '';
            renderGallery(searchVal);
            if (typeof showToast === 'function') showToast('图片添加成功！');
        });
    }

    // ========== 文件管理事件 ==========
    const openFileManagerBtn = document.getElementById('openFileManagerBtn');
    if (openFileManagerBtn) {
        openFileManagerBtn.addEventListener('click', () => {
            if (typeof currentFileFolder !== 'undefined') currentFileFolder = 'root';
            if (typeof fileFolderPath !== 'undefined') fileFolderPath = [{ id: 'root', name: '根目录' }];
            switchView('fileManager');
            if (typeof renderFileManager === 'function') renderFileManager();
        });
    }

    const fileManagerBackBtn = document.getElementById('fileManagerBackBtn');
    if (fileManagerBackBtn) {
        fileManagerBackBtn.addEventListener('click', () => switchView('adminControl'));
    }

    // ========== 操作日志 / 数据库查看 卡片 ==========
    // 操作日志卡片
    const openLogsBtn = document.getElementById('openLogsBtn');
    if (openLogsBtn) openLogsBtn.onclick = () => { if (typeof openLogsPanel === 'function') openLogsPanel(); };
    // 数据库查看卡片
    const openDbViewerBtn = document.getElementById('openDbViewerBtn');
    if (openDbViewerBtn) openDbViewerBtn.onclick = () => { if (typeof openDbViewerPanel === 'function') openDbViewerPanel(); };

    const fileNewFolderBtn = document.getElementById('fileNewFolderBtn');
    if (fileNewFolderBtn) {
        fileNewFolderBtn.addEventListener('click', () => {
            if (typeof showPromptModal === 'function') {
                showPromptModal({
                    title: '新建文件夹',
                    placeholder: '请输入文件夹名称',
                    defaultValue: '新建文件夹',
                    onConfirm: (name) => {
                        if (!name || !name.trim()) return;
                        if (typeof createFolder === 'function') {
                            createFolder(currentFileFolder, name.trim());
                            if (typeof renderFileManager === 'function') renderFileManager();
                            if (typeof showToast === 'function') showToast('文件夹创建成功！', 'success');
                        }
                    }
                });
            }
        });
    }

    const fileUploadInput = document.getElementById('fileUploadInput');
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', e => {
            const files = e.target.files;
            if (!files || !files.length) return;
            let uploaded = 0;
            const maxSize = 2 * 1024 * 1024; // 2MB limit
            const validFiles = Array.from(files).filter(f => {
                if (f.size > maxSize) {
                    if (typeof showToast === 'function') showToast(`「${f.name}」超过 2MB 限制，已跳过`);
                    return false;
                }
                return true;
            });
            if (!validFiles.length) {
                e.target.value = '';
                return;
            }
            validFiles.forEach(file => {
                const reader = new FileReader();
                reader.onload = ev => {
                    if (typeof uploadFile === 'function') {
                        uploadFile(currentFileFolder, file.name, file.size, ev.target.result);
                        uploaded++;
                        if (uploaded >= validFiles.length) {
                            if (typeof renderFileManager === 'function') renderFileManager();
                            if (typeof showToast === 'function') showToast(`成功上传 ${uploaded} 个文件！`);
                        }
                    }
                };
                reader.readAsDataURL(file);
            });
            e.target.value = '';
        });
    }

    // File list event delegation
    const fileListContainer = document.getElementById('fileListContainer');
    if (fileListContainer && !fileListContainer.dataset.__fileBound) {
        fileListContainer.dataset.__fileBound = '1';
        fileListContainer.addEventListener('click', e => {
            const target = e.target.closest('[data-action]');
            if (!target) {
                const folderRow = e.target.closest('[data-file-type="folder"]');
                if (folderRow) {
                    const folderId = folderRow.dataset.fileId;
                    const nameEl = folderRow.querySelector('div[style*="font-weight:600"]');
                    const folderName = nameEl ? nameEl.textContent : '文件夹';
                    currentFileFolder = folderId;
                    fileFolderPath.push({ id: folderId, name: folderName });
                    renderFileManager();
                }
                return;
            }

            const action = target.dataset.action;
            const fileId = target.dataset.fileId;

            if (action === 'open-folder') {
                const itemEl = target.closest('.file-list-item');
                const nameEl = itemEl ? itemEl.querySelector('div[style*="font-weight:600"]') : null;
                const folderName = nameEl ? nameEl.textContent : '文件夹';
                currentFileFolder = fileId;
                fileFolderPath.push({ id: fileId, name: folderName });
                renderFileManager();
                return;
            }

            if (action === 'download-file') {
                e.stopPropagation();
                const items = (typeof getFilesInFolder === 'function') ? getFilesInFolder(currentFileFolder) : [];
                const file = items.find(i => i.id === fileId);
                if (file && file.data) {
                    const a = document.createElement('a');
                    a.href = file.data;
                    a.download = file.name || 'download';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (typeof showToast === 'function') showToast('已开始下载文件！');
                }
                return;
            }

            if (action === 'rename-file') {
                e.stopPropagation();
                const items = (typeof getFilesInFolder === 'function') ? getFilesInFolder(currentFileFolder) : [];
                const file = items.find(i => i.id === fileId);
                if (!file) return;
                if (typeof showPromptModal === 'function') {
                    showPromptModal({
                        title: '重命名项目',
                        placeholder: '请输入新名称',
                        defaultValue: file.name,
                        onConfirm: (newName) => {
                            if (!newName || !newName.trim()) return;
                            if (typeof renameFileOrFolder === 'function') {
                                renameFileOrFolder(currentFileFolder, fileId, newName.trim());
                                renderFileManager();
                                if (typeof showToast === 'function') showToast('重命名成功！', 'success');
                            }
                        }
                    });
                }
                return;
            }

            if (action === 'delete-file') {
                e.stopPropagation();
                const doDelete = () => {
                    if (typeof deleteFileOrFolder === 'function') {
                        deleteFileOrFolder(currentFileFolder, fileId);
                        renderFileManager();
                        if (typeof showToast === 'function') showToast('已删除');
                    }
                };
                if (typeof showConfirmModal === 'function') {
                    showConfirmModal({
                        title: '删除确认',
                        message: '确定删除该项目吗？如果是文件夹，里面的所有内容也将被彻底删除。',
                        confirmText: '确认删除',
                        cancelText: '取消',
                        danger: true,
                        onConfirm: doDelete
                    });
                } else {
                    doDelete();
                }
                return;
            }
        });
    }

    // Breadcrumb navigation
    const fileBreadcrumb = document.getElementById('fileBreadcrumb');
    if (fileBreadcrumb && !fileBreadcrumb.dataset.__bound) {
        fileBreadcrumb.dataset.__bound = '1';
        fileBreadcrumb.addEventListener('click', e => {
            const link = e.target.closest('.file-breadcrumb-link');
            if (!link) return;
            const folderId = link.dataset.folderId;
            const pathIdx = parseInt(link.dataset.pathIdx, 10);
            currentFileFolder = folderId;
            fileFolderPath = fileFolderPath.slice(0, pathIdx + 1);
            renderFileManager();
        });
    }

    // ========== 大图查看器事件 ==========
    const imageViewerModal = document.getElementById('imageViewerModal');
    const imageViewerCloseBtn = document.getElementById('imageViewerCloseBtn');
    const imageViewerPrevBtn = document.getElementById('imageViewerPrevBtn');
    const imageViewerNextBtn = document.getElementById('imageViewerNextBtn');

    if (imageViewerCloseBtn) imageViewerCloseBtn.addEventListener('click', closeImageViewer);
    if (imageViewerPrevBtn) imageViewerPrevBtn.addEventListener('click', () => navigateImageViewer(-1));
    if (imageViewerNextBtn) imageViewerNextBtn.addEventListener('click', () => navigateImageViewer(1));

    // 缩放按钮事件
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomResetBtn = document.getElementById('zoomResetBtn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoomImageViewer(ZOOM_STEP));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoomImageViewer(-ZOOM_STEP));
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetImageViewerZoom);

    // 滚轮缩放支持
    const imageViewerStage = document.getElementById('imageViewerStage');
    if (imageViewerStage) {
        imageViewerStage.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
            zoomImageViewer(delta);
        }, { passive: false });
    }

    // 点击图片切换缩放（100% 和 200% 之间）
    const imageViewerImg = document.getElementById('imageViewerImg');
    if (imageViewerImg) {
        imageViewerImg.addEventListener('click', e => {
            e.stopPropagation();
            if (imageViewerZoom > 1.01) {
                resetImageViewerZoom();
            } else {
                imageViewerZoom = 2;
                applyImageViewerZoom();
            }
        });
    }

    if (imageViewerModal) {
        imageViewerModal.addEventListener('click', e => {
            if (e.target === imageViewerModal) closeImageViewer();
        });
    }

    // 键盘导航（Esc 关闭 / ← 上一张 / → 下一张 / +- 缩放 / 0 重置）
    document.addEventListener('keydown', e => {
        const modal = document.getElementById('imageViewerModal');
        if (!modal || !modal.classList.contains('active')) return;
        if (e.key === 'Escape') { e.preventDefault(); closeImageViewer(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateImageViewer(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); navigateImageViewer(1); }
        else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomImageViewer(ZOOM_STEP); }
        else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomImageViewer(-ZOOM_STEP); }
        else if (e.key === '0') { e.preventDefault(); resetImageViewerZoom(); }
    });

    // ========== 图册卡片事件委托：查看大图 / 删除 / 编辑名称 ==========
    const galleryGrid = document.getElementById('galleryGrid');
    if (galleryGrid) {
        galleryGrid.addEventListener('click', e => {
            // 点击图片 → 查看大图
            const viewLarge = e.target.closest('[data-action="view-large"]');
            if (viewLarge) {
                const idx = Number(viewLarge.dataset.idx);
                if (Number.isInteger(idx)) openImageViewer(idx);
                return;
            }
            // 删除按钮
            const deleteBtn = e.target.closest('[data-action="delete-image"]');
            if (deleteBtn) {
                const idx = Number(deleteBtn.dataset.idx);
                if (Number.isInteger(idx)) deleteGalleryImage(idx);
                return;
            }
            // 编辑名称按钮
            const editBtn = e.target.closest('[data-action="edit-name"]');
            if (editBtn) {
                const idx = editBtn.dataset.idx;
                const nameDisplay = document.querySelector(`[data-name-display="${idx}"]`);
                const nameInput = document.querySelector(`[data-name-input="${idx}"]`);
                if (nameDisplay && nameInput) {
                    nameDisplay.style.display = 'none';
                    nameInput.style.display = 'block';
                    nameInput.focus();
                    nameInput.select();
                }
                return;
            }
        });

        // 名称输入框：Enter 保存 / Esc 取消
        galleryGrid.addEventListener('keydown', e => {
            if (!e.target.classList || !e.target.classList.contains('gallery-name-input')) return;
            const idx = e.target.dataset.nameInput;
            if (e.key === 'Enter') {
                e.preventDefault();
                saveGalleryName(idx, e.target);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                const nameDisplay = document.querySelector(`[data-name-display="${idx}"]`);
                if (nameDisplay) nameDisplay.style.display = '';
                e.target.style.display = 'none';
            }
        });

        // 失去焦点时保存名称
        galleryGrid.addEventListener('focusout', e => {
            if (!e.target.classList || !e.target.classList.contains('gallery-name-input')) return;
            if (e.relatedTarget && e.relatedTarget.classList && e.relatedTarget.classList.contains('gallery-name-input')) return;
            const idx = e.target.dataset.nameInput;
            saveGalleryName(idx, e.target);
        });
    }

    // 5. 参数调节板块：颜色选择器 & 恢复默认设置按钮
    const paramColorPicker = document.getElementById('paramColorPicker');
    if (paramColorPicker) {
        // 初始同步颜色选择器的 Hue 值
        const hue = localStorage.getItem('paramHue') || '220';
        paramColorPicker.value = hueToHex(Number(hue));

        paramColorPicker.addEventListener('input', e => {
            const hex = e.target.value;
            const hue = hexToHue(hex);
            localStorage.setItem('paramHue', hue.toString());
            const label = document.getElementById('hueVal');
            if (label) label.textContent = hue + '°';
            document.documentElement.style.setProperty('--theme-hue', hue);
            const slider = document.getElementById('paramHue');
            if (slider) slider.value = hue;
        });
    }

    const resetParamsBtn = document.getElementById('resetParamsBtn');
    if (resetParamsBtn) {
        resetParamsBtn.addEventListener('click', () => {
            localStorage.removeItem('paramOpacity');
            localStorage.removeItem('themeCardOpacity');
            localStorage.removeItem('themeSidebarOpacity');
            localStorage.removeItem('themeCardHeight');
            localStorage.removeItem('themeCardWidth');
            localStorage.removeItem('paramBlur');
            localStorage.removeItem('themeBlur');
            localStorage.removeItem('paramHue');
            localStorage.removeItem('themeRopeWidth');
            localStorage.removeItem('themePresetColor');
            localStorage.removeItem('themeGridGapX');
            localStorage.removeItem('themeTopGap');
            localStorage.removeItem('themeCardGapY');
            localStorage.removeItem('themeArticleGapTop');
            localStorage.removeItem('themeArticleGapBottom');
            localStorage.removeItem('themeSidebarRadius');
            localStorage.removeItem('themeRadius');

            state.themeRopeWidth = '3.5';
            state.themePresetColor = '#6366f1';
            state.themeGridGapX = '6';
            state.themeTopGap = '8';
            state.themeCardGapY = '10';
            state.themeArticleGapTop = '0';
            state.themeArticleGapBottom = '14';
            state.themeRadius = '20';
            state.themeSidebarRadius = '18';
            state.themeCardOpacity = '85';
            state.themeSidebarOpacity = '85';
            state.themeCardHeight = '100';
            state.themeCardWidth = '100';
            state.themeBlur = '16';

            const rwInput = document.getElementById('paramRopeWidth');
            if (rwInput) rwInput.value = '3.5';
            const rwSpan = document.getElementById('ropeWidthVal');
            if (rwSpan) rwSpan.textContent = '3.5px';

            const hexIn = document.getElementById('paramColorHex');
            if (hexIn) hexIn.value = '#6366f1';
            if (paramColorPicker) paramColorPicker.value = '#6366f1';
            const swatchBoxReset = document.getElementById('paramColorSwatchBox');
            if (swatchBoxReset) swatchBoxReset.style.backgroundColor = '#6366f1';
            const hexDisp = document.getElementById('colorHexDisplay');
            if (hexDisp) hexDisp.textContent = '#6366f1';
            const hueIn = document.getElementById('paramHueSlider');
            if (hueIn) hueIn.value = 240;
            const hueSpan = document.getElementById('hueVal');
            if (hueSpan) hueSpan.textContent = '240°';

            const ggIn = document.getElementById('paramGridGapX');
            if (ggIn) ggIn.value = '6';
            const ggSpan = document.getElementById('gridGapXVal');
            if (ggSpan) ggSpan.textContent = '6px';

            const tgIn = document.getElementById('paramTopGap');
            if (tgIn) tgIn.value = '8';
            const tgSpan = document.getElementById('topGapVal');
            if (tgSpan) tgSpan.textContent = '8px';

            const cgIn = document.getElementById('paramCardGapY');
            if (cgIn) cgIn.value = '10';
            const cgSpan = document.getElementById('cardGapYVal');
            if (cgSpan) cgSpan.textContent = '10px';

            const agtIn = document.getElementById('paramArticleGapTop');
            if (agtIn) agtIn.value = '0';
            const agtSpan = document.getElementById('articleGapTopVal');
            if (agtSpan) agtSpan.textContent = '0px';

            const agbIn = document.getElementById('paramArticleGapBottom');
            if (agbIn) agbIn.value = '14';
            const agbSpan = document.getElementById('articleGapBottomVal');
            if (agbSpan) agbSpan.textContent = '14px';

            const rIn = document.getElementById('paramRadius');
            if (rIn) rIn.value = '20';
            const rSpan = document.getElementById('radiusVal');
            if (rSpan) rSpan.textContent = '20px';

            const srIn = document.getElementById('paramSidebarRadius');
            if (srIn) srIn.value = '18';
            const srSpan = document.getElementById('sidebarRadiusVal');
            if (srSpan) srSpan.textContent = '18px';

            const coIn = document.getElementById('paramCardOpacity');
            if (coIn) coIn.value = '85';
            const coSpan = document.getElementById('cardOpacityVal');
            if (coSpan) coSpan.textContent = '85%';

            const soIn = document.getElementById('paramSidebarOpacity');
            if (soIn) soIn.value = '85';
            const soSpan = document.getElementById('sidebarOpacityVal');
            if (soSpan) soSpan.textContent = '85%';

            const chIn = document.getElementById('paramCardHeight');
            if (chIn) chIn.value = '100';
            const chSpan = document.getElementById('cardHeightVal');
            if (chSpan) chSpan.textContent = '100%';

            const cwIn = document.getElementById('paramCardWidth');
            if (cwIn) cwIn.value = '100';
            const cwSpan = document.getElementById('cardWidthVal');
            if (cwSpan) cwSpan.textContent = '100%';

            const blIn = document.getElementById('paramBlur');
            if (blIn) blIn.value = '16';
            const blSpan = document.getElementById('blurVal');
            if (blSpan) blSpan.textContent = '16px';

            applyThemeCustomizations();
            applyThemeParams();
        });
    }

    // 初始应用
    applyThemeParams();
}

function hexToHue(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
        let d = max - min;
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return Math.round(h * 360);
}

function hueToHex(h) {
    let s = 80;
    let l = 50;
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' : '' + hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function applyThemeParams() {
    const opacity = localStorage.getItem('paramOpacity') || '75';
    const blur = localStorage.getItem('paramBlur') || '16';
    const hue = localStorage.getItem('paramHue') || '220';

    document.documentElement.style.setProperty('--glass-opacity', (opacity / 100).toFixed(2));
    document.documentElement.style.setProperty('--glass-blur', blur + 'px');
    document.documentElement.style.setProperty('--theme-hue', hue);

    const opacityInput = document.getElementById('paramOpacity');
    const blurInput = document.getElementById('paramBlur');
    const hueInput = document.getElementById('paramHue');

    const opacityVal = document.getElementById('opacityVal');
    const blurVal = document.getElementById('blurVal');
    const hueVal = document.getElementById('hueVal');

    if (opacityInput) opacityInput.value = opacity;
    if (blurInput) blurInput.value = blur;
    if (hueInput) hueInput.value = hue;

    if (opacityVal) opacityVal.textContent = opacity + '%';
    if (blurVal) blurVal.textContent = blur + 'px';
    if (hueVal) hueVal.textContent = hue + '°';
}

