
        const STORAGE_KEYS = { articles: 'articlesData', isAdmin: 'isAdmin', profile: 'blogProfile' };
        const query = new URLSearchParams(window.location.search);
        const currentId = Number(query.get('id')) || 0;
        let articles = [];
        const defaultProfile = { name: '是令令啊', bio: "it's me~", avatar: 'img/img6.jpg' };
        let profile = Object.assign({}, defaultProfile);
        const fallbackArticles = [
            { id: 1, title: '前端性能优化实战指南', date: '2026-08-09', category: '前端', tags: ['前端','性能','优化'], read:1540, comment:21, summary:'从资源加载、图片懒加载到缓存策略，逐步提升页面首屏与交互速度。', cover:'img/img6.jpg', featured:true, content:'# 前端性能优化实战指南\n\n本文介绍性能优化思路。'},
            { id: 2, title: 'CSS 布局与响应式设计技巧', date: '2026-07-28', category: '前端', tags:['CSS','响应式','布局'], read:1284, comment:18, summary:'在网格和弹性布局间切换，打造桌面、平板、手机三端适配体验。', cover:'img/firstlogo.gif', featured:true, content:'# CSS 布局与响应式设计技巧\n\n学习使用 Flexbox 和 Grid。'},
            { id: 3, title: '我的考研备考与时间管理', date:'2026-06-10', category:'随笔', tags:['考研','学习','时间管理'], read:980, comment:14, summary:'分享学习计划、复习方法与如何在忙碌中保持稳定节奏。', cover:'img/img6.jpg', featured:true, content:'# 我的考研备考与时间管理\n\n分享考研经验和复习方法。'}
        ];
        function loadProfile() {
            try {
                const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.profile) || 'null');
                if (saved && typeof saved === 'object') {
                    profile = Object.assign({}, defaultProfile, saved);
                }
            } catch (e) { profile = Object.assign({}, defaultProfile); }
        }
        function renderProfile() {
            document.getElementById('sidebarName').textContent = profile.name;
            document.getElementById('sidebarBio').textContent = profile.bio;
            document.getElementById('sidebarAvatar').src = profile.avatar;
            document.getElementById('sidebarAvatar').alt = profile.name + ' 头像';
            const isAdmin = localStorage.getItem(STORAGE_KEYS.isAdmin) === 'true';
            document.getElementById('sidebarEditProfile').style.display = isAdmin ? 'inline-flex' : 'none';
        }
        function parseMarkdown(md) {
            let html = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            html = html.replace(/^### (.*)$/gm,'<h3>$1</h3>');
            html = html.replace(/^## (.*)$/gm,'<h2>$1</h2>');
            html = html.replace(/^# (.*)$/gm,'<h1>$1</h1>');
            html = html.replace(/^>\s?(.*)$/gm,'<blockquote>$1</blockquote>');
            html = html.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
            html = html.replace(/\*(.*?)\*/g,'<em>$1</em>');
            html = html.replace(/`([^`]+)`/g,'<code>$1</code>');
            html = html.replace(/^\s*[-*+] (.*)$/gm, '<li>$1</li>');
            html = html.replace(/(<li>.*<\/li>)/gm,'<ul>$1</ul>');
            html = html.replace(/\n\n+/g,'</p><p>');
            html = '<p>' + html + '</p>';
            html = html.replace(/<p><ul>/g,'<ul>').replace(/<\/li><\/p>/g,'</li></ul>');
            html = html.replace(/\n/g,'<br>');
            return html;
        }
        async function loadArticles() {
            try {
                const res = await fetch('articles.json');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) articles = data;
                }
            } catch (e) {
                articles = fallbackArticles;
            }
            try {
                const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.articles) || 'null');
                if (Array.isArray(saved)) {
                    saved.forEach(item => {
                        const idx = articles.findIndex(a => a.id === item.id);
                        if (idx > -1) articles[idx] = Object.assign(articles[idx], item);
                        else articles.push(item);
                    });
                }
            } catch (e) {}
            if (!articles.length) articles = fallbackArticles;
        }
        function formatDate(value) {
            const d = new Date(value);
            return d.toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' });
        }
        function renderArticle() {
            const article = articles.find(item => item.id === currentId) || articles[0];
            const content = article.content ? parseMarkdown(article.content) : `<p>${article.summary}</p>`;
            const admin = localStorage.getItem(STORAGE_KEYS.isAdmin) === 'true';
            const adminButtons = admin ? `
                <div class="article-actions" style="margin-top:20px; display:flex; gap:10px;">
                    <button id="editFullArticle" class="action-btn admin-edit" style="display:inline-flex; align-items:center; gap:6px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        <span>编辑文章</span>
                    </button>
                    <button class="action-btn delete-btn" id="deleteFullArticle" style="display:inline-flex; align-items:center; gap:6px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        <span>删除文章</span>
                    </button>
                </div>
            ` : '';
            const coverHtml = article.cover ? `<img src="${article.cover}" alt="${article.title} 封面">` : '';
            document.getElementById('articleContent').innerHTML = `
                <h1>${article.title}</h1>
                <div class="meta">${article.category} · ${formatDate(article.date)} · 阅读 ${article.read} · 评论 ${article.comment}</div>
                ${coverHtml}
                <div class="markdown-content">${content}</div>
                ${adminButtons}
            `;
            document.getElementById('loginButton').textContent = admin ? '管理员已登录' : '管理员登录';
            if (admin) {
                document.getElementById('deleteFullArticle').addEventListener('click', () => {
                    const doDelete = () => {
                        articles = articles.filter(item => item.id !== article.id);
                        localStorage.setItem(STORAGE_KEYS.articles, JSON.stringify(articles));
                        window.location.href = 'index.html';
                    };
                    if (typeof showConfirmModal === 'function') {
                        showConfirmModal({
                            title: '删除文章',
                            message: '确定要删除这篇文章吗？此操作不可撤销。',
                            danger: true,
                            onConfirm: doDelete
                        });
                    } else {
                        doDelete();
                    }
                });
                document.getElementById('editFullArticle').addEventListener('click', () => {
                    let standaloneCoverMode = article.cover ? (article.cover.startsWith('data:image') ? 'file' : 'url') : 'none';
                    let standaloneCoverDataUrl = article.cover && article.cover.startsWith('data:image') ? article.cover : '';

                    document.getElementById('articleContent').innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:16px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px;">
                                <h2 style="margin:0; font-size:20px;">编辑文章：${article.title}</h2>
                                <button type="button" id="cancelArticleEdit" style="padding:8px 16px; border-radius:999px; background:#eff6ff; color:#2563eb; border:none; cursor:pointer;">← 取消编辑</button>
                            </div>
                            <div>
                                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">文章标题</label>
                                <input id="editTitleInput" type="text" value="${article.title}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1;">
                            </div>
                            <div>
                                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">文章分类</label>
                                <input id="editCategoryInput" type="text" value="${article.category}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1;">
                            </div>
                            <div>
                                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">文章标签（以逗号分隔）</label>
                                <input id="editTagsInput" type="text" value="${article.tags.join(', ')}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1;">
                            </div>
                            <div>
                                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">文章封面设置</label>
                                <div style="display:flex; gap:16px; align-items:center; margin-bottom:8px; font-size:14px;">
                                    <label style="cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                                        <input type="radio" name="standaloneCoverType" value="none" ${standaloneCoverMode === 'none' ? 'checked' : ''}> 无封面
                                    </label>
                                    <label style="cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                                        <input type="radio" name="standaloneCoverType" value="url" ${standaloneCoverMode === 'url' ? 'checked' : ''}> 封面图片 URL
                                    </label>
                                    <label style="cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                                        <input type="radio" name="standaloneCoverType" value="file" ${standaloneCoverMode === 'file' ? 'checked' : ''}> 本地上传图片
                                    </label>
                                </div>
                                <div id="editCoverUrlWrap" style="display:${standaloneCoverMode === 'url' ? 'block' : 'none'};">
                                    <input id="editCoverInput" type="text" value="${article.cover && !article.cover.startsWith('data:image') ? article.cover : ''}" placeholder="例如：https://picsum.photos/800/400 或 img/img6.jpg" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1;">
                                </div>
                                <div id="editCoverFileWrap" style="display:${standaloneCoverMode === 'file' ? 'block' : 'none'};">
                                    <input id="editCoverFileInput" type="file" accept="image/*" style="width:100%; padding:8px 0;">
                                    <div id="editCoverFilePreview" style="margin-top:8px;">${standaloneCoverDataUrl ? `<img src="${standaloneCoverDataUrl}" style="max-width:180px; max-height:120px; border-radius:8px; border:1px solid #cbd5e1; object-fit:cover;">` : ''}</div>
                                </div>
                            </div>
                            <div>
                                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">文章正文 (Markdown)</label>
                                <textarea id="editContentInput" rows="12" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-family:monospace; line-height:1.5;">${article.content}</textarea>
                            </div>
                            <div style="display:flex; gap:12px;">
                                <button type="button" id="saveArticleEdit" style="padding:10px 24px; border-radius:999px; background:#2563eb; color:#fff; border:none; cursor:pointer; font-weight:600;">保存文章</button>
                            </div>
                        </div>
                    `;

                    document.querySelectorAll('input[name="standaloneCoverType"]').forEach(radio => {
                        radio.addEventListener('change', (e) => {
                            standaloneCoverMode = e.target.value;
                            document.getElementById('editCoverUrlWrap').style.display = standaloneCoverMode === 'url' ? 'block' : 'none';
                            document.getElementById('editCoverFileWrap').style.display = standaloneCoverMode === 'file' ? 'block' : 'none';
                        });
                    });

                    const fileInput = document.getElementById('editCoverFileInput');
                    if (fileInput) {
                        fileInput.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                    standaloneCoverDataUrl = evt.target.result;
                                    document.getElementById('editCoverFilePreview').innerHTML = `<img src="${standaloneCoverDataUrl}" style="max-width:180px; max-height:120px; border-radius:8px; border:1px solid #cbd5e1; object-fit:cover;">`;
                                };
                                reader.readAsDataURL(file);
                            }
                        });
                    }

                    document.getElementById('cancelArticleEdit').addEventListener('click', () => {
                        renderArticle();
                    });

                    document.getElementById('saveArticleEdit').addEventListener('click', () => {
                        const title = document.getElementById('editTitleInput').value.trim();
                        const category = document.getElementById('editCategoryInput').value.trim() || '未分类';
                        const tags = document.getElementById('editTagsInput').value.split(/[,，]/).map(item => item.trim()).filter(Boolean);
                        const markdown = document.getElementById('editContentInput').value.trim();

                        let cover = '';
                        if (standaloneCoverMode === 'url') {
                            cover = document.getElementById('editCoverInput').value.trim();
                        } else if (standaloneCoverMode === 'file') {
                            cover = standaloneCoverDataUrl;
                        } else {
                            cover = '';
                        }

                        if (!title || !markdown) {
                            if (typeof showToast === 'function') showToast('请填写标题和文章内容', 'warning');
                            return;
                        }

                        article.title = title;
                        article.category = category;
                        article.tags = tags.length ? tags : ['随笔'];
                        article.cover = cover;
                        article.content = markdown;
                        article.summary = markdown.split('\n')[0].slice(0, 120);

                        localStorage.setItem(STORAGE_KEYS.articles, JSON.stringify(articles));
                        renderArticle();
                        if (typeof showToast === 'function') showToast('文章保存成功', 'success');
                    });
                });
            }
        }
        function renderRelated() {
            const related = articles.filter(item => item.id !== currentId).slice(0, 5);
            document.getElementById('relatedList').innerHTML = related.map(item => `<li><a href="article.html?id=${item.id}">${item.title}</a></li>`).join('');
        }
        function renderTags() {
            const counts = {};
            articles.forEach(item => item.tags.forEach(tag => counts[tag] = (counts[tag] || 0) + 1));
            document.getElementById('tagCloud').innerHTML = Object.keys(counts).map(tag => `<span class="tag" title="${tag}">${tag}</span>`).join(' ');
        }
        function bindEvents() {
            document.getElementById('loginButton').addEventListener('click', () => window.location.href = 'admin/login.html');
            document.getElementById('sidebarEditProfile').addEventListener('click', () => {
                if (typeof showPromptModal === 'function') {
                    showPromptModal({
                        title: '编辑昵称',
                        defaultValue: profile.name,
                        onConfirm: (newName) => {
                            if (!newName) return;
                            showPromptModal({
                                title: '编辑签名',
                                defaultValue: profile.bio,
                                onConfirm: (newBio) => {
                                    profile.name = newName;
                                    profile.bio = newBio || '';
                                    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
                                    renderProfile();
                                    if (typeof showToast === 'function') showToast('个人资料已更新', 'success');
                                }
                            });
                        }
                    });
                }
            });
        }
        loadProfile();
        loadArticles().then(() => {
            renderProfile();
            renderArticle();
            renderRelated();
            renderTags();
            bindEvents();
        });
    