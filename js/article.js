
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
            const adminButtons = admin ? `<div class="article-actions" style="margin-top:20px;"><button id="editFullArticle" class="action-btn admin-edit">✏️ 编辑文章</button><button class="action-btn delete-btn" id="deleteFullArticle">🗑️ 删除文章</button></div>` : '';
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
                    if (!confirm('确定删除这篇文章吗？')) return;
                    articles = articles.filter(item => item.id !== article.id);
                    localStorage.setItem(STORAGE_KEYS.articles, JSON.stringify(articles));
                    window.location.href = 'index.html';
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
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                                <div>
                                    <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">分类</label>
                                    <input id="editCategoryInput" type="text" value="${article.category || '随笔'}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1;">
                                </div>
                                <div>
                                    <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">标签（逗号分隔）</label>
                                    <input id="editTagsInput" type="text" value="${(article.tags || []).join(', ')}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1;">
                                </div>
                            </div>
                            <div>
                                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">封面图片设置</label>
                                <div style="display:flex; gap:8px; margin-bottom:8px;">
                                    <button type="button" id="sCoverTabUrl" style="padding:6px 12px; border-radius:999px; border:1px solid #cbd5e1; background:${standaloneCoverMode === 'url' ? '#2563eb' : '#f1f5f9'}; color:${standaloneCoverMode === 'url' ? '#fff' : '#334155'}; cursor:pointer;">网络 URL 链接</button>
                                    <button type="button" id="sCoverTabFile" style="padding:6px 12px; border-radius:999px; border:1px solid #cbd5e1; background:${standaloneCoverMode === 'file' ? '#2563eb' : '#f1f5f9'}; color:${standaloneCoverMode === 'file' ? '#fff' : '#334155'}; cursor:pointer;">上传本地图片</button>
                                    <button type="button" id="sCoverTabNone" style="padding:6px 12px; border-radius:999px; border:1px solid #cbd5e1; background:${standaloneCoverMode === 'none' ? '#2563eb' : '#f1f5f9'}; color:${standaloneCoverMode === 'none' ? '#fff' : '#334155'}; cursor:pointer;">无封面</button>
                                </div>
                                <div id="sCoverUrlPane" style="display:${standaloneCoverMode === 'url' ? 'block' : 'none'};">
                                    <input id="editCoverInput" type="text" value="${article.cover || ''}" placeholder="输入封面地址 (如 img/img6.jpg)" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1;">
                                </div>
                                <div id="sCoverFilePane" style="display:${standaloneCoverMode === 'file' ? 'block' : 'none'};">
                                    <label style="display:inline-block; padding:8px 16px; border-radius:10px; background:#eff6ff; color:#2563eb; cursor:pointer; border:1px dashed #93c5fd;">
                                        📁 选择本地图片文件
                                        <input id="editCoverFileInput" type="file" accept="image/*" style="display:none;">
                                    </label>
                                    <span id="sCoverFileTip" style="margin-left:8px; font-size:13px; color:#64748b;">未选择文件</span>
                                </div>
                            </div>
                            <div>
                                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">Markdown 正文内容</label>
                                <textarea id="editMarkdownInput" rows="12" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-family:inherit;">${article.content || article.summary}</textarea>
                            </div>
                            <div>
                                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:14px;">实时预览</label>
                                <div id="editPreviewArea" class="markdown-content" style="padding:14px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; max-height:260px; overflow-y:auto;">${parseMarkdown(article.content || article.summary)}</div>
                            </div>
                            <div style="display:flex; gap:12px; margin-top:8px;">
                                <button type="button" id="saveArticleEdit" style="padding:10px 20px; border-radius:999px; background:#2563eb; color:#fff; cursor:pointer; border:none; font-weight:600;">保存文章</button>
                                <button type="button" id="cancelArticleEditBtn" style="padding:10px 18px; border-radius:999px; background:#f1f5f9; color:#475569; cursor:pointer; border:none;">取消</button>
                            </div>
                        </div>
                    `;

                    const urlTab = document.getElementById('sCoverTabUrl');
                    const fileTab = document.getElementById('sCoverTabFile');
                    const noneTab = document.getElementById('sCoverTabNone');
                    const urlPane = document.getElementById('sCoverUrlPane');
                    const filePane = document.getElementById('sCoverFilePane');
                    const fileInput = document.getElementById('editCoverFileInput');

                    function updateSTabs(mode) {
                        standaloneCoverMode = mode;
                        urlTab.style.background = mode === 'url' ? '#2563eb' : '#f1f5f9';
                        urlTab.style.color = mode === 'url' ? '#fff' : '#334155';
                        fileTab.style.background = mode === 'file' ? '#2563eb' : '#f1f5f9';
                        fileTab.style.color = mode === 'file' ? '#fff' : '#334155';
                        noneTab.style.background = mode === 'none' ? '#2563eb' : '#f1f5f9';
                        noneTab.style.color = mode === 'none' ? '#fff' : '#334155';
                        urlPane.style.display = mode === 'url' ? 'block' : 'none';
                        filePane.style.display = mode === 'file' ? 'block' : 'none';
                    }

                    urlTab.addEventListener('click', () => updateSTabs('url'));
                    fileTab.addEventListener('click', () => updateSTabs('file'));
                    noneTab.addEventListener('click', () => updateSTabs('none'));

                    if (fileInput) {
                        fileInput.addEventListener('change', e => {
                            const file = e.target.files && e.target.files[0];
                            if (file) {
                                document.getElementById('sCoverFileTip').textContent = file.name;
                                const reader = new FileReader();
                                reader.onload = ev => {
                                    standaloneCoverDataUrl = ev.target.result;
                                    updateSTabs('file');
                                };
                                reader.readAsDataURL(file);
                            }
                        });
                    }

                    document.getElementById('editMarkdownInput').addEventListener('input', e => {
                        document.getElementById('editPreviewArea').innerHTML = parseMarkdown(e.target.value);
                    });

                    document.getElementById('cancelArticleEdit').addEventListener('click', renderArticle);
                    document.getElementById('cancelArticleEditBtn').addEventListener('click', renderArticle);

                    document.getElementById('saveArticleEdit').addEventListener('click', () => {
                        const title = document.getElementById('editTitleInput').value.trim();
                        const category = document.getElementById('editCategoryInput').value.trim() || '随笔';
                        const tags = document.getElementById('editTagsInput').value.split(',').map(t => t.trim()).filter(Boolean);
                        const markdown = document.getElementById('editMarkdownInput').value.trim();

                        let cover = '';
                        if (standaloneCoverMode === 'url') {
                            cover = document.getElementById('editCoverInput').value.trim();
                        } else if (standaloneCoverMode === 'file') {
                            cover = standaloneCoverDataUrl;
                        } else {
                            cover = '';
                        }

                        if (!title || !markdown) {
                            alert('请填写标题和文章内容');
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
                const name = prompt('编辑昵称', profile.name);
                const bio = prompt('编辑签名', profile.bio);
                const avatar = prompt('编辑头像路径', profile.avatar);
                if (name != null && bio != null && avatar != null) {
                    profile.name = name;
                    profile.bio = bio;
                    profile.avatar = avatar;
                    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
                    renderProfile();
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
    