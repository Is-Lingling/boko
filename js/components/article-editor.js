/**
 * article-editor.js - 文章编辑器组件
 *
 * 负责文章编辑器的打开、渲染、保存、关闭等全生命周期管理。
 * 集成 Vditor Markdown 编辑器，支持分类选择、标签选择、封面上传等功能。
 *
 * @module ArticleEditor
 * @requires Vditor (来自 CDN 的 Vditor 编辑器库)
 * @requires state, STORAGE_KEYS (全局状态和常量)
 * @requires getArticleById, updateArticle, createArticle, syncCategoriesFromArticles (来自 data.js)
 * @requires showToast, showConfirmModal, switchView, renderAll (全局辅助函数)
 * @requires parseMarkdown (来自 markdown-renderer.js)
 */

(function() {
    'use strict';

    /** @type {number|null} 当前正在编辑的文章 ID */
    let currentEditingArticleId = null;

    /** @type {string} 当前封面模式：'none' | 'url' | 'file' */
    let currentCoverMode = 'none';

    /** @type {string} 临时封面 DataURL */
    let tempCoverDataUrl = '';

    /** @type {Vditor|null} Vditor 实例 */
    let vditorInstance = null;

    /**
     * 初始化 Vditor 编辑器
     * @param {string} initialValue - 初始 Markdown 内容
     */
    function initVditor(initialValue) {
        const vditorContainer = document.getElementById('vditor');
        if (!vditorContainer || typeof Vditor === 'undefined') return;

        if (vditorInstance) {
            vditorInstance.setValue(initialValue || '');
            return;
        }

        const isDark = (typeof state !== 'undefined' && state.theme === 'dark');

        vditorInstance = new Vditor('vditor', {
            height: 580,
            mode: 'ir',
            theme: isDark ? 'dark' : 'classic',
            icon: 'material',
            placeholder: '开始创作...',
            toolbar: [
                'emoji', 'headings', 'bold', 'italic', 'strike', 'line',
                'quote', 'list', 'ordered-list', 'check', 'code', 'inline-code',
                'link', 'table', 'insert-after', 'insert-before', 'undo', 'redo',
                'upload', 'fullscreen', 'edit-mode', 'both', 'preview', 'outline'
            ],
            toolbarConfig: { pin: true },
            preview: {
                theme: { current: isDark ? 'dark' : 'light' },
                hljs: { lineNumber: true }
            },
            counter: { enable: true, type: 'markdown' },
            cache: { enable: false },
            input(value) {
                if (typeof autoSaveArticleDraft === 'function') {
                    autoSaveArticleDraft();
                }
            },
            upload: {
                max: 4 * 1024 * 1024,
                accept: 'image/*',
                url: '#',
                handler(files) {
                    return new Promise((resolve) => {
                        const results = [];
                        let processed = 0;
                        if (!files || !files.length) {
                            resolve(JSON.stringify({ msg: '', code: 0, data: { errFiles: [], succMap: {} } }));
                            return;
                        }
                        Array.from(files).forEach(file => {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                                const dataUrl = evt.target.result;
                                const imageName = file.name || 'image';
                                if (typeof saveContentImageToGallery === 'function') {
                                    saveContentImageToGallery(dataUrl, imageName).then(saved => {
                                        results.push({ imageName: saved.name || imageName, relativePath: saved.relativePath || saved.path || dataUrl });
                                        processed++;
                                        if (processed >= files.length) {
                                            const succMap = {};
                                            results.forEach(r => { succMap[r.imageName] = r.relativePath; });
                                            resolve(JSON.stringify({ msg: '', code: 0, data: { errFiles: [], succMap } }));
                                            results.forEach(item => {
                                                if (vditorInstance) {
                                                    vditorInstance.insertValue(`![${item.imageName}](${item.relativePath})\n`);
                                                }
                                            });
                                        }
                                    });
                                } else {
                                    processed++;
                                    if (processed >= files.length) {
                                        resolve(JSON.stringify({ msg: '', code: 0, data: { errFiles: [], succMap: {} } }));
                                    }
                                }
                            };
                            reader.readAsDataURL(file);
                        });
                    });
                }
            },
            after() {
                if (initialValue) {
                    vditorInstance.setValue(initialValue);
                }
                bindVditorImageClickSelection();
            }
        });
    }

    /**
     * 设置编辑器内容
     * @param {HTMLElement|null} editorEl - 兼容参数，可忽略
     * @param {string} contentStr - Markdown 内容
     */
    function setLiveMarkdownContent(editorEl, contentStr) {
        if (vditorInstance) {
            vditorInstance.setValue(contentStr || '');
        } else {
            initVditor(contentStr || '');
        }
    }

    /**
     * 获取编辑器内容
     * @returns {string} Markdown 文本
     */
    function getLiveMarkdownContent() {
        if (vditorInstance) {
            return vditorInstance.getValue().trim();
        }
        return '';
    }

    /**
     * 绑定 Vditor 内图片点击选中效果
     */
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
                        document.querySelectorAll('.vditor-img-selected').forEach(el => el.classList.remove('vditor-img-selected'));
                        imgNode.classList.add('vditor-img-selected');
                    } catch (err) {}
                }
            } else {
                document.querySelectorAll('.vditor-img-selected').forEach(el => el.classList.remove('vditor-img-selected'));
            }
        });
    }

    /**
     * 设置封面模式
     * @param {string} mode - 'none' | 'url' | 'file'
     */
    function setCoverMode(mode) {
        currentCoverMode = mode;
        const urlWrap = document.getElementById('editorCoverUrlWrap');
        const fileWrap = document.getElementById('editorCoverFileWrap');
        const preview = document.getElementById('editorCoverPreview');

        if (urlWrap) urlWrap.style.display = mode === 'url' ? 'block' : 'none';
        if (fileWrap) fileWrap.style.display = mode === 'file' ? 'block' : 'none';

        if (mode === 'none' && preview) {
            preview.innerHTML = '';
        }
    }

    /**
     * 打开文章编辑器
     * @param {Object|null} article - 要编辑的文章对象，null 表示新增
     */
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

        // 恢复草稿
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
                            setLiveMarkdownContent(null, draft.content || '');
                            if (typeof showToast === 'function') showToast('已恢复未保存草稿', 'success');
                        };
                        if (typeof showConfirmModal === 'function') {
                            showConfirmModal({
                                title: '恢复文章草稿',
                                message: `检测到您上次于 ${draft.savedAt} 编辑的未保存文章草稿，是否恢复？`,
                                confirmText: '恢复草稿',
                                cancelText: '放弃草稿',
                                onConfirm: doRestore,
                                onCancel: () => { if (typeof clearArticleDraft === 'function') clearArticleDraft(); }
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
        } else if (tempCoverDataUrl || (coverVal && coverVal.startsWith('data:image'))) {
            setCoverMode('file');
        } else {
            setCoverMode('url');
        }

        if (typeof switchView === 'function') switchView('editor');
    }

    /**
     * 关闭文章编辑器
     */
    function closeArticleEditor() {
        const viewerId = (typeof getCurrentViewerArticleId === 'function')
            ? getCurrentViewerArticleId()
            : (typeof currentViewerArticleId !== 'undefined' ? currentViewerArticleId : null);
        if (viewerId) {
            if (typeof switchView === 'function') switchView('detail');
        } else {
            if (typeof switchView === 'function') switchView('list');
        }
    }

    /**
     * 重置编辑器表单
     */
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
        if (typeof clearArticleDraft === 'function') clearArticleDraft();
        if (typeof refreshCategorySelectUI === 'function') refreshCategorySelectUI('');
        if (typeof renderTagPickerUI === 'function') renderTagPickerUI('', []);
    }

    /**
     * 保存文章
     */
    async function saveArticle() {
        const titleInput = document.getElementById('inlineArticleTitle');
        const categoryInput = document.getElementById('inlineArticleCategory');
        const coverInput = document.getElementById('inlineArticleCover');

        const title = titleInput ? titleInput.value.trim() : '';
        const category = categoryInput ? categoryInput.value.trim() || '随笔' : '随笔';
        const tags = (typeof collectTagsFromPickerAndInput === 'function')
            ? collectTagsFromPickerAndInput()
            : ['随笔'];
        const finalTags = tags.length ? tags : ['随笔'];
        const markdown = getLiveMarkdownContent();

        let cover = '';
        if (currentCoverMode === 'url') {
            cover = coverInput ? coverInput.value.trim() : '';
        } else if (currentCoverMode === 'file') {
            cover = tempCoverDataUrl;
        }

        if (!title || !markdown) {
            if (typeof showToast === 'function') showToast('请填写文章标题和正文内容', 'warning');
            return;
        }

        const plainSnippet = markdown
            .replace(/#+\s+/g, '')
            .replace(/[*_~`>#+\-\[\]()!|]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const summary = plainSnippet.length > 100 ? plainSnippet.slice(0, 100) + '...' : (plainSnippet || '无摘要内容');
        const newData = { title, category, tags: finalTags, cover, content: markdown, summary };

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
            if (typeof updateArticle === 'function') {
                savedArticle = await updateArticle(currentEditingArticleId, newData);
            }
        } else {
            if (typeof createArticle === 'function') {
                savedArticle = await createArticle(Object.assign({ date: new Date().toISOString().slice(0, 10) }, newData));
            }
        }

        if (typeof syncCategoriesFromArticles === 'function') syncCategoriesFromArticles();
        if (typeof clearArticleDraft === 'function') clearArticleDraft();
        resetArticleEditor();
        if (typeof renderAll === 'function') renderAll();

        if (savedArticle) {
            if (typeof openArticleViewer === 'function') openArticleViewer(savedArticle.id);
        } else {
            if (typeof switchView === 'function') switchView('list');
        }
    }

    // 暴露到全局
    window.initVditor = initVditor;
    window.setLiveMarkdownContent = setLiveMarkdownContent;
    window.getLiveMarkdownContent = getLiveMarkdownContent;
    window.bindVditorImageClickSelection = bindVditorImageClickSelection;
    window.setCoverMode = setCoverMode;
    window.openArticleEditor = openArticleEditor;
    window.closeArticleEditor = closeArticleEditor;
    window.resetArticleEditor = resetArticleEditor;
    window.saveArticle = saveArticle;
    window.vditorInstance = vditorInstance;

    // 定义 getter/setter 以保持兼容性
    Object.defineProperty(window, 'currentEditingArticleId', {
        get() { return currentEditingArticleId; },
        set(v) { currentEditingArticleId = v; }
    });
    Object.defineProperty(window, 'currentCoverMode', {
        get() { return currentCoverMode; },
        set(v) { currentCoverMode = v; }
    });
    Object.defineProperty(window, 'tempCoverDataUrl', {
        get() { return tempCoverDataUrl; },
        set(v) { tempCoverDataUrl = v; }
    });

})();
