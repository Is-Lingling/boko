
        const STORAGE_KEYS = {
            theme: 'blogTheme',
            likes: 'blogLikedArticles',
            favorites: 'blogFavoriteArticles',
            comments: 'blogComments',
            pv: 'blogPV',
            uv: 'blogUV',
            lastVisit: 'blogLastVisit',
            musicPlaying: 'blogMusicPlaying'
        };
        const pageStart = new Date('2024-01-01');
        const pageNow = new Date();
        const articlesPerPage = 4;
        let articles = [
            {
                id: 1,
                title: '前端性能优化实战指南',
                date: '2026-08-09',
                category: '前端',
                tags: ['前端', '性能', '优化'],
                read: 1540,
                comment: 21,
                summary: '从资源加载、图片懒加载到缓存策略，逐步提升页面首屏与交互速度。',
                cover: 'img/img6.jpg',
                featured: true
            },
            {
                id: 2,
                title: 'CSS 布局与响应式设计技巧',
                date: '2026-07-28',
                category: '前端',
                tags: ['CSS', '响应式', '布局'],
                read: 1284,
                comment: 18,
                summary: '在网格和弹性布局间切换，打造桌面、平板、手机三端适配体验。',
                cover: 'img/firstlogo.gif',
                featured: true
            },
            {
                id: 3,
                title: '我的考研备考与时间管理',
                date: '2026-06-10',
                category: '随笔',
                tags: ['考研', '学习', '时间管理'],
                read: 980,
                comment: 14,
                summary: '分享学习计划、复习方法与如何在忙碌中保持稳定节奏。',
                cover: 'img/img6.jpg',
                featured: true
            },
            {
                id: 4,
                title: 'VSCode 插件推荐与工作流',
                date: '2026-05-15',
                category: '工具',
                tags: ['VSCode', '开发效率', '插件'],
                read: 820,
                comment: 9,
                summary: '推荐实用插件与快捷键设置，让编辑器成为高效生产力工具。',
                cover: 'img/img6.jpg'
            },
            {
                id: 5,
                title: '静态博客页面的 SEO 优化',
                date: '2026-04-22',
                category: '前端',
                tags: ['SEO', '博客', '静态站点'],
                read: 760,
                comment: 12,
                summary: '包括元标签、语义结构与页面性能优化，提升搜索引擎可见度。',
                cover: 'img/firstlogo.gif'
            },
            {
                id: 6,
                title: '个人网站的暗黑模式实现方案',
                date: '2026-04-03',
                category: '设计',
                tags: ['暗黑模式', '主题切换', '体验'],
                read: 690,
                comment: 7,
                summary: '从变量主题到用户偏好存储，打造舒适的多主题浏览。',
                cover: 'img/img6.jpg'
            },
            {
                id: 7,
                title: '友链与站点生态建设心得',
                date: '2026-03-19',
                category: '随笔',
                tags: ['友链', '社区', '站点'],
                read: 540,
                comment: 6,
                summary: '谈谈友链交换、内容互联与圈层流量的价值。',
                cover: 'img/img6.jpg'
            },
            {
                id: 8,
                title: '简易 RSS 订阅与站点地图生成',
                date: '2026-02-12',
                category: '工具',
                tags: ['RSS', 'Sitemap', '订阅'],
                read: 480,
                comment: 8,
                summary: '用简单方式提供 RSS 订阅入口和自动站点地图链接。',
                cover: 'img/firstlogo.gif'
            },
            {
                id: 9,
                title: '移动端导航与触控优化',
                date: '2026-01-26',
                category: '前端',
                tags: ['移动端', '触控', '导航'],
                read: 430,
                comment: 5,
                summary: '对移动端交互区域、汉堡菜单和触控反馈进行优化。',
                cover: 'img/img6.jpg'
            },
            {
                id: 10,
                title: '访客统计与本地存储交互设计',
                date: '2025-12-20',
                category: '产品',
                tags: ['统计', '本地存储', '交互'],
                read: 390,
                comment: 4,
                summary: '前端统计与本地存储结合，打造简单访客数据展示。',
                cover: 'img/img6.jpg'
            }
        ];
        const defaultArticles = JSON.parse(JSON.stringify(articles));
        async function loadArticlesFromFile() {
            try {
                const response = await fetch('articles.json');
                if (response.ok) {
                    const fileData = await response.json();
                    if (Array.isArray(fileData) && fileData.length) {
                        articles = fileData;
                    }
                }
            } catch (error) {}
            try {
                const saved = JSON.parse(localStorage.getItem('articlesData') || 'null');
                if (Array.isArray(saved) && saved.length) {
                    saved.forEach(savedItem => {
                        const index = articles.findIndex(item => item.id === savedItem.id);
                        if (index > -1) {
                            articles[index] = Object.assign(articles[index], savedItem);
                        } else {
                            articles.push(savedItem);
                        }
                    });
                }
            } catch (error) {}
        }
        function saveArticlesToStorage() {
            localStorage.setItem('articlesData', JSON.stringify(articles));
        }
        const defaultProfile = {
            name: '是令令啊',
            bio: "it's me~",
            avatar: 'img/img6.jpg'
        };
        let profile = Object.assign({}, defaultProfile);
        function loadProfileData() {
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
            localStorage.setItem('blogProfile', JSON.stringify(profile));
        }
        function renderProfile() {
            document.getElementById('profileName').textContent = profile.name;
            document.getElementById('profileBio').textContent = profile.bio;
            document.getElementById('profileAvatar').src = profile.avatar;
            document.getElementById('profileAvatar').alt = profile.name + ' 头像';
        }
        function renderAdminUI() {
            document.getElementById('adminAddBtn').style.display = state.isAdmin ? 'inline-flex' : 'none';
            document.getElementById('adminLogoutBtn').style.display = state.isAdmin ? 'inline-flex' : 'none';
            document.getElementById('editProfileBtn').style.display = state.isAdmin ? 'inline-flex' : 'none';
        }
        function parseMarkdown(markdown) {
            if (!markdown) return '';
            let html = markdown
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
            html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
            html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
            html = html.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');
            html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
            html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
            html = html.replace(/^\s*[-*+] (.*)$/gm, '<li>$1</li>');
            html = html.replace(/(<li>.*<\/li>)/gm, '<ul>$1</ul>');
            html = html.replace(/\n\n/g, '</p><p>');
            html = '<p>' + html + '</p>';
            html = html.replace(/<p><ul>/g, '<ul>').replace(/<\/li><\/p>/g, '</li></ul>');
            html = html.replace(/\n/g, '<br>');
            return html;
        }
        let currentEditingArticleId = null;
        function openArticleEditor(article) {
            const modal = document.getElementById('articleEditorModal');
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            currentEditingArticleId = article ? article.id : null;
            document.getElementById('articleTitle').value = article ? article.title : '';
            document.getElementById('articleCategory').value = article ? article.category : '';
            document.getElementById('articleTags').value = article ? article.tags.join(',') : '';
            document.getElementById('articleCover').value = article ? article.cover : 'img/img6.jpg';
            document.getElementById('articleMarkdown').value = article ? (article.content || article.summary) : '';
            document.getElementById('markdownPreview').innerHTML = parseMarkdown(document.getElementById('articleMarkdown').value);
        }
        function closeArticleEditor() {
            const modal = document.getElementById('articleEditorModal');
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }
        function resetArticleEditor() {
            document.getElementById('articleTitle').value = '';
            document.getElementById('articleCategory').value = '';
            document.getElementById('articleTags').value = '';
            document.getElementById('articleCover').value = 'img/img6.jpg';
            document.getElementById('articleMarkdown').value = '';
            document.getElementById('markdownPreview').innerHTML = '';
            currentEditingArticleId = null;
        }
        function openProfileEditor() {
            const modal = document.getElementById('profileEditorModal');
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            document.getElementById('profileNameInput').value = profile.name;
            document.getElementById('profileBioInput').value = profile.bio;
            document.getElementById('profileAvatarInput').value = profile.avatar;
        }
        function closeProfileEditor() {
            const modal = document.getElementById('profileEditorModal');
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }
        function saveProfileEditor() {
            profile.name = document.getElementById('profileNameInput').value.trim() || defaultProfile.name;
            profile.bio = document.getElementById('profileBioInput').value.trim() || defaultProfile.bio;
            profile.avatar = document.getElementById('profileAvatarInput').value.trim() || defaultProfile.avatar;
            saveProfileData();
            renderProfile();
            closeProfileEditor();
        }
        function handleAdminLogout() {
            localStorage.removeItem('isAdmin');
            state.isAdmin = false;
            renderAdminUI();
            renderArticles();
            alert('已退出管理员模式');
        }
        function handleAdminDelete(id) {
            if (!confirm('确定删除这篇文章吗？')) return;
            articles = articles.filter(item => item.id !== id);
            saveArticlesToStorage();
            renderArticles();
            renderHotList();
            renderTagCloud();
            renderArchive();
        }
        function setHeroReadLink(id) {
            document.getElementById('heroRead').href = `article.html?id=${id}`;
        }
        function getArticleById(id) {
            return articles.find(item => item.id === Number(id));
        }
        function getSortedArticles(list) {
            return sortArticles(list);
        }
        const friendLinks = [
            {title: '前端笔记', url: '#', titleText: '前端笔记站点'},
            {title: '技术栈', url: '#', titleText: '技术栈分享'},
            {title: '个人项目', url: '#', titleText: '个人项目展示'}
        ];
        const initialComments = [
            {name: '访客A', content: '很喜欢你的博客布局，内容很实用。', date: '2026-08-11'},
            {name: '读者B', content: '暗黑模式切换很顺畅，体验很好。', date: '2026-08-10'}
        ];
        let currentPage = 1;
        let activeSort = 'date';
        let activeFilters = [];
        let activeSearch = '';
        let currentHero = 0;
        function getHeroItems() {
            return articles.filter(item => item.featured).slice(0, 3);
        }
        const state = {
            likes: JSON.parse(localStorage.getItem(STORAGE_KEYS.likes) || '[]'),
            favorites: JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '[]'),
            comments: JSON.parse(localStorage.getItem(STORAGE_KEYS.comments) || '[]'),
            theme: localStorage.getItem(STORAGE_KEYS.theme) || 'light',
            musicPlaying: localStorage.getItem(STORAGE_KEYS.musicPlaying) === 'true',
            isAdmin: localStorage.getItem('isAdmin') === 'true'
        };
        const musicBtn = document.getElementById('musicBtn');
        const closeMusicBtn = document.getElementById('musicClose') || document.getElementById('closeMusic');
        function formatNumber(value) {
            return value.toLocaleString('zh-CN');
        }
        function formatDate(value) {
            const date = new Date(value);
            return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
        function computeSiteDays() {
            const oneDay = 24 * 60 * 60 * 1000;
            return Math.max(1, Math.floor((pageNow - pageStart) / oneDay));
        }
        function updateStats() {
            const total = articles.length;
            const categories = new Set(articles.map(item => item.category)).size;
            const tags = new Set(articles.flatMap(item => item.tags)).size;
            const pv = Number(localStorage.getItem(STORAGE_KEYS.pv) || '0');
            const uv = Number(localStorage.getItem(STORAGE_KEYS.uv) || '0');
            document.getElementById('statArticles').textContent = total;
            document.getElementById('statCategories').textContent = categories;
            document.getElementById('statTags').textContent = tags;
            document.getElementById('statPV').textContent = formatNumber(pv);
            document.getElementById('statUV').textContent = formatNumber(uv);
            document.getElementById('statDays').textContent = computeSiteDays();
        }
        function setTheme(theme) {
            document.body.classList.toggle('dark', theme === 'dark');
            localStorage.setItem(STORAGE_KEYS.theme, theme);
            state.theme = theme;
        }
        function toggleTheme() {
            setTheme(state.theme === 'dark' ? 'light' : 'dark');
        }
        function showOverlay(show) {
            document.getElementById('overlay').classList.toggle('active', show);
        }
        function openMusic() {
            document.getElementById('musicModal').classList.add('active');
            showOverlay(true);
        }
        function closeMusic() {
            document.getElementById('musicModal').classList.remove('active');
            showOverlay(false);
        }
        function updateMusicStatus() {
            document.getElementById('musicStatus').textContent = state.musicPlaying ? '播放状态：正在播放' : '播放状态：已暂停';
        }
        function changeHero(index) {
            const heroItems = getHeroItems();
            if (!heroItems.length) return;
            currentHero = (index + heroItems.length) % heroItems.length;
            const item = heroItems[currentHero];
            document.getElementById('heroCover').src = item.cover;
            document.getElementById('heroCover').alt = item.title + ' 封面';
            document.getElementById('heroMeta').textContent = `${item.category} · ${formatDate(item.date)} · 阅读 ${item.read}`;
            document.getElementById('heroTitle').textContent = item.title;
            document.getElementById('heroSummary').textContent = item.summary;
            setHeroReadLink(item.id);
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
                const matchesSearch = !searchText || item.title.toLowerCase().includes(searchText) || item.summary.toLowerCase().includes(searchText) || item.tags.some(tag => tag.toLowerCase().includes(searchText));
                const matchesTag = activeFilters.length === 0 || item.tags.some(tag => activeFilters.includes(tag)) || activeFilters.includes(item.category) || activeFilters.includes(item.date.slice(0, 7));
                return matchesSearch && matchesTag;
            });
        }
        function highlight(text, phrase) {
            if (!phrase) return text;
            const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, 'gi');
            return text.replace(regex, '<span class="highlight">$1</span>');
        }
        function renderArticles() {
            const list = sortArticles(filterArticles());
            const articleList = document.getElementById('articleList');
            const start = (currentPage - 1) * articlesPerPage;
            const pageArticles = list.slice(start, start + articlesPerPage);
            articleList.innerHTML = pageArticles.map(item => {
                const liked = state.likes.includes(item.id);
                const favorited = state.favorites.includes(item.id);
                const title = highlight(item.title, activeSearch);
                const summary = highlight(item.summary, activeSearch);
                return `
                <article class="article-card" id="article-${item.id}">
                    <div class="cover"><img src="${item.cover}" alt="${item.title} 封面" loading="lazy"></div>
                    <div class="card-body">
                        <div class="label-group">
                            <span class="tag-item" data-tag="${item.category}">${item.category}</span>
                            ${item.tags.map(tag => `<span class="tag-item" data-tag="${tag}">${tag}</span>`).join('')}
                        </div>
                        <h3>${title}</h3>
                        <div class="article-meta">${formatDate(item.date)} · 阅读 ${item.read} · 评论 ${item.comment}</div>
                        <div class="article-content"><p>${summary}</p></div>
                        <div class="article-actions">
                            <a href="article.html?id=${item.id}" title="阅读全文">阅读全文</a>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <button type="button" class="action-btn" data-action="like" data-article-id="${item.id}">${liked ? '已点赞' : '点赞'}</button>
                                <button type="button" class="action-btn" data-action="favorite" data-article-id="${item.id}">${favorited ? '已收藏' : '收藏'}</button>
                                ${state.isAdmin ? `<button type="button" class="action-btn admin-edit" data-edit-id="${item.id}">编辑</button><button type="button" class="action-btn delete-btn" data-delete-id="${item.id}">删除</button>` : ''}
                            </div>
                        </div>
                    </div>
                </article>`;
            }).join('');
            if (!pageArticles.length) {
                articleList.innerHTML = '<p style="padding:24px;">暂无匹配文章，尝试更换关键词或标签。</p>';
            }
            articleList.querySelectorAll('.tag-item[data-tag]').forEach(tagEl => {
                tagEl.addEventListener('click', () => toggleFilter(tagEl.dataset.tag));
            });
            articleList.querySelectorAll('.action-btn').forEach(button => {
                button.addEventListener('click', () => {
                    if (button.dataset.deleteId) {
                        handleAdminDelete(Number(button.dataset.deleteId));
                        return;
                    }
                    if (button.dataset.editId) {
                        openArticleEditor(getArticleById(Number(button.dataset.editId)));
                        return;
                    }
                    const articleId = Number(button.dataset.articleId);
                    const action = button.dataset.action;
                    if (action === 'like') {
                        state.likes = state.likes.includes(articleId) ? state.likes.filter(id => id !== articleId) : [...state.likes, articleId];
                        localStorage.setItem(STORAGE_KEYS.likes, JSON.stringify(state.likes));
                    }
                    if (action === 'favorite') {
                        state.favorites = state.favorites.includes(articleId) ? state.favorites.filter(id => id !== articleId) : [...state.favorites, articleId];
                        localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites));
                    }
                    renderArticles();
                });
            });
            renderPagination(list.length);
        }
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
        function renderHotList() {
            const hot = [...articles].sort((a, b) => b.read - a.read).slice(0, 5);
            document.getElementById('hotList').innerHTML = hot.map(item => `<li><a href="article.html?id=${item.id}" title="${item.title}">${item.title}</a></li>`).join('');
        }
        function renderTagCloud() {
            const counts = {};
            articles.forEach(item => item.tags.forEach(tag => counts[tag] = (counts[tag] || 0) + 1));
            const cloud = document.getElementById('tagCloud');
            cloud.innerHTML = Object.keys(counts).map(tag => {
                const size = 12 + counts[tag] * 2;
                return `<span class="tag-item" data-tag="${tag}" style="font-size:${size}px;">${tag}</span>`;
            }).join('');
            cloud.querySelectorAll('[data-tag]').forEach(el => {
                el.addEventListener('click', () => toggleFilter(el.dataset.tag));
            });
        }
        function renderArchive() {
            const months = {};
            articles.forEach(item => {
                const key = item.date.slice(0, 7);
                months[key] = (months[key] || 0) + 1;
            });
            const archive = document.getElementById('archiveList');
            archive.innerHTML = Object.keys(months).sort((a, b) => b.localeCompare(a)).map(key => `<a href="#" data-archive="${key}" title="查看${key}归档">${key} (${months[key]})</a>`).join('');
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
        function renderFriendLinks() {
            document.getElementById('friendLinks').innerHTML = friendLinks.map(link => `<a href="${link.url}" title="${link.titleText}">${link.title}</a>`).join('');
        }
        function renderFilters() {
            const container = document.getElementById('activeFilters');
            container.innerHTML = activeFilters.map(tag => `<span class="filter-chip">${tag}<button type="button" data-remove="${tag}" title="移除过滤">×</button></span>`).join('');
            container.querySelectorAll('button[data-remove]').forEach(button => {
                button.addEventListener('click', () => {
                    activeFilters = activeFilters.filter(tag => tag !== button.dataset.remove);
                    currentPage = 1;
                    renderArticles();
                    renderFilters();
                });
            });
        }
        function toggleFilter(tag) {
            activeFilters = activeFilters.includes(tag) ? activeFilters.filter(item => item !== tag) : [...activeFilters, tag];
            currentPage = 1;
            renderArticles();
            renderFilters();
        }
        function renderComments() {
            const comments = state.comments.length ? state.comments : initialComments;
            document.getElementById('commentList').innerHTML = comments.map(item => `
                <div class="comment-item">
                    <div class="comment-meta">${item.name} · ${item.date}</div>
                    <div>${item.content}</div>
                </div>
            `).join('');
        }
        function addComment(name, content) {
            const today = formatDate(new Date().toISOString());
            state.comments.unshift({name, content, date: today});
            localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(state.comments));
            renderComments();
        }
        function initSearch(inputId, callback) {
            const input = document.getElementById(inputId);
            let timer;
            input.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(() => callback(input.value.trim()), 300);
            });
        }
        function updateVisitorStats() {
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
        }
        function bindEvents() {
            const tToggle = document.getElementById('themeToggle');
            const mBtn = document.getElementById('musicBtn');
            const cmBtn = document.getElementById('closeMusicBtn') || document.getElementById('closeMusic');
            const ov = document.getElementById('overlay');
            const hPrev = document.getElementById('heroPrev');
            const hNext = document.getElementById('heroNext');
            const hBg = document.getElementById('hamburger');
            const dClose = document.getElementById('drawerClose');

            if (tToggle) tToggle.addEventListener('click', toggleTheme);
            if (mBtn) mBtn.addEventListener('click', openMusic);
            if (cmBtn) cmBtn.addEventListener('click', closeMusic);
            if (ov) ov.addEventListener('click', closeMusic);
            if (hPrev) hPrev.addEventListener('click', () => changeHero(currentHero - 1));
            if (hNext) hNext.addEventListener('click', () => changeHero(currentHero + 1));
            if (hBg) {
                hBg.addEventListener('click', () => {
                    openMobileDrawer();
                });
            }
            if (dClose) {
                dClose.addEventListener('click', () => {
                    closeMobileDrawer();
                });
            }
            const mPlay = document.getElementById('musicPlay');
            const mPause = document.getElementById('musicPause');
            const aAdd = document.getElementById('adminAddBtn');
            const aLogout = document.getElementById('adminLogoutBtn');
            const eProfile = document.getElementById('editProfileBtn');

            if (mPlay) {
                mPlay.addEventListener('click', () => {
                    const audio = document.getElementById('bgAudio');
                    if (audio) audio.play().catch(() => {});
                    state.musicPlaying = true;
                    if (typeof updateMusicStatus === 'function') updateMusicStatus();
                    localStorage.setItem(STORAGE_KEYS.musicPlaying, 'true');
                });
            }
            if (mPause) {
                mPause.addEventListener('click', () => {
                    const audio = document.getElementById('bgAudio');
                    if (audio) audio.pause();
                    state.musicPlaying = false;
                    if (typeof updateMusicStatus === 'function') updateMusicStatus();
                    localStorage.setItem(STORAGE_KEYS.musicPlaying, 'false');
                });
            }
            if (aAdd) aAdd.addEventListener('click', () => openArticleEditor(null));
            if (aLogout) aLogout.addEventListener('click', handleAdminLogout);
            if (eProfile) eProfile.addEventListener('click', openProfileEditor);
            document.getElementById('closeArticleEditor').addEventListener('click', closeArticleEditor);
            document.getElementById('closeProfileEditor').addEventListener('click', closeProfileEditor);
            document.getElementById('saveArticleBtn').addEventListener('click', () => {
                const title = document.getElementById('articleTitle').value.trim();
                const category = document.getElementById('articleCategory').value.trim() || '随笔';
                const tags = document.getElementById('articleTags').value.split(',').map(tag => tag.trim()).filter(Boolean);
                const cover = document.getElementById('articleCover').value.trim() || 'img/img6.jpg';
                const markdown = document.getElementById('articleMarkdown').value.trim();
                if (!title || !markdown) {
                    alert('请填写标题和文章内容');
                    return;
                }
                const summary = markdown.replace(/\n/g, ' ').slice(0, 120);
                if (currentEditingArticleId) {
                    const article = getArticleById(currentEditingArticleId);
                    if (article) {
                        article.title = title;
                        article.category = category;
                        article.tags = tags.length ? tags : ['随笔'];
                        article.cover = cover;
                        article.content = markdown;
                        article.summary = summary;
                    }
                } else {
                    const newArticle = {
                        id: Date.now(),
                        title,
                        date: new Date().toISOString().slice(0, 10),
                        category,
                        tags: tags.length ? tags : ['随笔'],
                        read: 0,
                        comment: 0,
                        summary,
                        cover,
                        content: markdown
                    };
                    articles.unshift(newArticle);
                }
                saveArticlesToStorage();
                renderArticles();
                renderHotList();
                renderTagCloud();
                renderArchive();
                closeArticleEditor();
            });
            document.getElementById('resetArticleBtn').addEventListener('click', resetArticleEditor);
            document.getElementById('articleMarkdown').addEventListener('input', () => {
                document.getElementById('markdownPreview').innerHTML = parseMarkdown(document.getElementById('articleMarkdown').value);
            });
            document.getElementById('saveProfileBtn').addEventListener('click', saveProfileEditor);
            document.getElementById('searchForm').addEventListener('submit', event => {
                event.preventDefault();
                const value = document.getElementById('search_input').value.trim();
                if (!value) {
                    alert('请输入搜索关键词');
                    return;
                }
                activeSearch = value;
                currentPage = 1;
                renderArticles();
                renderFilters();
            });
            initSearch('sidebarSearchInput', value => {
                activeSearch = value;
                currentPage = 1;
                renderArticles();
                renderFilters();
            });
            document.querySelectorAll('.sort-group button').forEach(button => {
                button.addEventListener('click', () => {
                    activeSort = button.dataset.sort;
                    document.querySelectorAll('.sort-group button').forEach(btn => btn.classList.toggle('active', btn === button));
                    renderArticles();
                });
            });
            document.getElementById('commentForm').addEventListener('submit', event => {
                event.preventDefault();
                const name = document.getElementById('commentName').value.trim();
                const content = document.getElementById('commentContent').value.trim();
                if (!name || !content) {
                    alert('请填写昵称和留言内容');
                    return;
                }
                addComment(name, content);
                event.target.reset();
            });
            document.getElementById('mobileDrawer').addEventListener('click', event => {
                if (event.target === document.getElementById('mobileDrawer')) {
                    const drawer = document.getElementById('mobileDrawer');
                    drawer.classList.remove('active');
                    drawer.setAttribute('aria-hidden', 'true');
                }
            });
        }
        // 额外交互：音乐进度、文章详情弹窗、管理员前端登录与编辑
        function secToTime(sec) {
            if (!isFinite(sec) || sec <= 0) return '00:00';
            const m = Math.floor(sec / 60).toString().padStart(2,'0');
            const s = Math.floor(sec % 60).toString().padStart(2,'0');
            return `${m}:${s}`;
        }
        function enhanceInteractions() {
            const audio = document.getElementById('bgAudio');
            const progressWrap = document.getElementById('musicProgress');
            const progressBar = document.getElementById('musicProgressBar');
            const timeCur = document.getElementById('musicTimeCur');
            const timeTot = document.getElementById('musicTimeTot');
            const musicClose = document.getElementById('musicClose');
            if (audio) {
                audio.addEventListener('loadedmetadata', () => {
                    timeTot.textContent = secToTime(audio.duration);
                    const saved = Number(localStorage.getItem('bgAudioTime') || 0);
                    if (saved && saved < audio.duration) audio.currentTime = saved;
                });
                audio.addEventListener('timeupdate', () => {
                    const pct = (audio.currentTime / (audio.duration || 1)) * 100;
                    progressBar.style.width = pct + '%';
                    timeCur.textContent = secToTime(audio.currentTime);
                    localStorage.setItem('bgAudioTime', Math.floor(audio.currentTime));
                });
                if (progressWrap) {
                    progressWrap.addEventListener('click', e => {
                        const rect = progressWrap.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        audio.currentTime = pct * (audio.duration || 0);
                    });
                }
                if (musicClose) musicClose.addEventListener('click', closeMusic);
            }

            // 文章详情弹窗与“阅读全文”拦截
            const articleList = document.getElementById('articleList');
            const articleModal = document.getElementById('articleModal');
            const articleModalBody = document.getElementById('articleModalBody');
            const articleModalTitle = document.getElementById('articleModalTitle');
            const articleCloseBtn = document.getElementById('articleCloseBtn');
            const articleEditBtn = document.getElementById('articleEditBtn');
            function openArticleModal(id) {
                const item = articles.find(a => a.id === Number(id));
                if (!item) return;
                articleModalTitle.textContent = item.title;
                articleModalBody.innerHTML = `
                    <img src="${item.cover}" alt="${item.title} 封面" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:8px;">
                    <div style="color:#64748b;font-size:13px;margin-bottom:8px;">${item.category} · ${formatDate(item.date)} · 阅读 ${item.read} · 评论 ${item.comment}</div>
                    <div style="line-height:1.8;color:inherit">${item.summary}<p>${item.summary}</p><p>（此处为示例全文内容）</p></div>
                `;
                articleModal.style.display = 'block';
                document.getElementById('overlay').classList.add('active');
                articleEditBtn.style.display = state.isAdmin ? 'inline-flex' : 'none';
                articleEditBtn.dataset.current = item.id;
            }
            if (articleList) {
                articleList.addEventListener('click', e => {
                    const a = e.target.closest('a[href^="#article-"]');
                    if (a) {
                        e.preventDefault();
                        const id = a.getAttribute('href').replace('#article-','');
                        openArticleModal(id);
                    }
                });
            }
            if (articleCloseBtn) {
                articleCloseBtn.addEventListener('click', () => {
                    articleModal.style.display = 'none';
                    document.getElementById('overlay').classList.remove('active');
                });
            }
            // 管理：打开登录弹窗（拦截原有管理链接）
            // 若 localStorage 存储了编辑后的文章，加载覆盖
            try {
                const saved = JSON.parse(localStorage.getItem('articlesData') || 'null');
                if (Array.isArray(saved) && saved.length) {
                    for (let i=0;i<saved.length;i++){
                        const idx = articles.findIndex(a=>a.id===saved[i].id);
                        if (idx>-1) articles[idx] = Object.assign(articles[idx], saved[i]);
                    }
                }
            } catch (e) {}
        }
        function init() {
            loadProfileData();
            renderProfile();
            setTheme(state.theme);
            renderAdminUI();
            renderHotList();
            renderTagCloud();
            renderArchive();
            renderFriendLinks();
            renderFilters();
            renderComments();
            updateVisitorStats();
            updateStats();
            bindEvents();
            enhanceInteractions();
            renderArticles();
            changeHero(0);
            if (state.musicPlaying) {
                document.getElementById('bgAudio').play().catch(() => {});
            }
            updateMusicStatus();
            document.getElementById('backTop').addEventListener('click', () => window.scrollTo({top: 0, behavior: 'smooth'}));
            setTimeout(() => document.getElementById('skeletonOverlay').style.display = 'none', 800);
        }
        window.addEventListener('DOMContentLoaded', () => {
            loadArticlesFromFile().then(init);
        });
    