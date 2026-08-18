# UI 组件模块说明文档

本文档说明博客系统中拆分出的 UI 组件模块，包括各组件的职责、对外接口及依赖关系。

---

## 目录

1. [模块概览](#模块概览)
2. [markdown-renderer.js](#markdown-rendererjs)
3. [theme-manager.js](#theme-managerjs)
4. [responsive.js](#responsivejs)
5. [article-viewer.js](#article-viewerjs)
6. [article-editor.js](#article-editorjs)
7. [article-unified.css](#article-unifiedcss)
8. [使用方式与加载顺序](#使用方式与加载顺序)

---

## 模块概览

| 文件 | 职责 | 依赖 |
|------|------|------|
| `markdown-renderer.js` | 统一的 Markdown 渲染引擎 | 全局 `resolveGalleryUrlByName`（可选） |
| `theme-manager.js` | 主题切换与系统偏好监听 | 全局 `state`, `STORAGE_KEYS`, `getIcon` |
| `responsive.js` | 响应式断点检测与移动端抽屉 | 无（仅 DOM 操作） |
| `article-viewer.js` | 文章阅读器（详情页渲染与交互） | 上述全部 + `data.js` 相关函数 |
| `article-editor.js` | 文章编辑器（Vditor 集成与保存） | 上述全部 + Vditor 库 |
| `article-unified.css` | 阅读/编辑器界面统一样式与响应式 | CSS 变量（来自 `index.css`） |

---

## markdown-renderer.js

### 功能

提供统一的 Markdown 到 HTML 渲染能力，替代原先散落在 `state.js`、`article.js`、`index.js` 中的多个 `parseMarkdown` 实现，确保文章阅读界面与编辑器预览的渲染结果完全一致。

### 核心函数

```javascript
parseMarkdown(markdown: string): string
```

- 支持代码块（含语法高亮、Mac 窗口装饰、行号、复制按钮）
- 支持表格、引用块、有序/无序列表
- 支持图片居中与图注（`![alt](src)`）
- 支持六级标题、加粗、斜体、删除线、行内代码、分割线
- 自动处理 HTML 转义

```javascript
highlightCodeSyntax(codeText: string, lang: string): string
```

- 内置 C/C++、Python、JavaScript/TypeScript 语法高亮
- 通用回退高亮支持注释、字符串、关键字、数字

```javascript
copyCodeBlock(btn: HTMLButtonElement): void
```

- 复制代码块内容到剪贴板，带 "已复制" 状态反馈

### 样式配合

代码块依赖 `article-unified.css` 中的 `.code-block-wrapper`、`.code-block-header`、`.line-numbers-gutter`、`.token.*` 等样式呈现 Mac 窗口风格与 One Dark Pro 高亮。

---

## theme-manager.js

### 功能

负责博客系统的暗黑/浅色主题切换、主题状态持久化到 `localStorage`，以及联动更新 Vditor 编辑器的主题。支持跟随系统 `prefers-color-scheme` 偏好。

### 核心函数

```javascript
setTheme(theme: 'dark' | 'light'): void
```

- 切换 `body.dark` 类
- 持久化到 `localStorage`
- 更新主题按钮文案与图标
- 联动 Vditor 主题
- 触发自定义 `themechange` 事件

```javascript
toggleTheme(): void
```

- 在 `dark` 与 `light` 之间切换

```javascript
initTheme(): void
```

- 从 `localStorage` 恢复已保存主题；无保存时跟随系统偏好

```javascript
watchSystemTheme(): void
```

- 监听 `prefers-color-scheme` 变化，仅在用户未手动设置时自动切换

### 事件

- `themechange` — `{ detail: { theme: 'dark' | 'light' } }`

---

## responsive.js

### 功能

统一处理界面缩放、移动端适配、侧边栏折叠、抽屉菜单等响应式行为。根据窗口宽度自动设置 `body[data-device]` 属性（`mobile` / `tablet` / `desktop`）。

### 核心函数

```javascript
initResponsive(): void
```

- 初始化设备检测、resize 防抖监听、抽屉外部点击关闭、ESC 键关闭

```javascript
openMobileDrawer(): void
```

```javascript
closeMobileDrawer(): void
```

```javascript
toggleMobileDrawer(): void
```

```javascript
isMobileDevice(): boolean
```

```javascript
getBreakpoint(): { width, height, isMobile, device }
```

### 断点常量

```javascript
RESPONSIVE_BREAKPOINTS = {
    mobile: 768,   // 手机端
    tablet: 900,   // 平板端
    desktop: 1100  // 桌面端
}
```

### 事件

- `devicechange` — `{ detail: { isMobile, width } }`
- `appresize` — `{ detail: { width, height, isMobile } }`

---

## article-viewer.js

### 功能

文章详情页阅读器的完整生命周期管理，包括文章头部信息渲染、Markdown 内容渲染、点赞/收藏交互、评论列表渲染、面包屑导航、目录生成等。

### 核心函数

```javascript
openArticleViewer(id: number): void
```

- 根据文章 ID 获取文章并渲染到 `detailView`
- 自动增加阅读数
- 渲染标题、元数据、封面、标签、Markdown 内容、评论
- 移动端自动滚动到内容顶部

```javascript
closeArticleViewer(): void
```

```javascript
editFromViewer(): void
```

- 从阅读器跳转到编辑器（编辑当前文章）

```javascript
renderDetailLikeFavoriteBar(item: Article): void
```

- 渲染并绑定点赞/收藏按钮，支持爆炸特效

```javascript
renderInlineArticleComments(articleId: number): void
```

- 渲染文章详情页内联评论列表，支持嵌套回复、删除按钮权限控制

```javascript
getCurrentViewerArticleId(): number | null
```

```javascript
setCurrentViewerArticleId(id: number | null): void
```

### 依赖

- `parseMarkdown`（来自 `markdown-renderer.js`）
- `getArticleById`, `saveArticlesToStorage`, `toggleLike`, `toggleFavorite`（来自 `data.js`）
- `switchView`, `generateTOC`, `scrollToComments`, `triggerBurstEffect`（来自 `ui.js`）

---

## article-editor.js

### 功能

文章编辑器的完整生命周期管理，集成 Vditor Markdown 编辑器（即时渲染 IR 模式），支持分类选择、标签选择、封面上传/URL/无封面三种模式，自动保存草稿与恢复。

### 核心函数

```javascript
openArticleEditor(article: Article | null): void
```

- 打开编辑器视图，传入文章对象表示编辑，传入 `null` 表示新增
- 自动恢复未保存草稿（通过确认弹窗）
- 回填标题、分类、标签、封面、Markdown 内容

```javascript
closeArticleEditor(): void
```

```javascript
resetArticleEditor(): void
```

```javascript
saveArticle(): Promise<void>
```

- 验证并保存文章，支持新建、编辑、从回收站恢复三种模式
- 自动生成纯文本摘要
- 保存成功后跳转回阅读器或列表

```javascript
initVditor(initialValue: string): void
```

- 初始化 Vditor 编辑器实例（IR 模式）
- 配置工具栏、上传、预览主题、自动保存联动

```javascript
setLiveMarkdownContent(editorEl, contentStr): void
```

```javascript
getLiveMarkdownContent(): string
```

```javascript
setCoverMode(mode: 'none' | 'url' | 'file'): void
```

### 状态变量

| 变量 | 说明 |
|------|------|
| `currentEditingArticleId` | 当前编辑的文章 ID，`null` 表示新增 |
| `currentCoverMode` | 当前封面模式 |
| `tempCoverDataUrl` | 本地上传封面的临时 DataURL |
| `vditorInstance` | Vditor 实例引用 |

### 依赖

- Vditor 库（CDN 加载）
- `parseMarkdown`（来自 `markdown-renderer.js`）
- `getArticleById`, `updateArticle`, `createArticle`, `restoreFromTrash`（来自 `data.js`）
- `switchView`, `showToast`, `showConfirmModal`, `renderAll`（来自 `ui.js`）

---

## article-unified.css

### 功能

统一文章阅读界面（`.inline-detail-card`）与编辑器界面（`.inline-editor-card`）的排版、字体、间距、代码块、图片等样式，确保两者显示一致。同时优化响应式布局，适配手机端、平板端和桌面端。

### 主要覆盖范围

1. **阅读卡片背景**：从纯白改为微妙的渐变背景（`#ffffff -> #fafbfc`），增强层次感
2. **Markdown 内容统一样式**：`.inline-content`、`.markdown-content`、`.vditor-reset` 三者的标题、段落、引用、列表、代码、表格、图片、链接样式完全一致
3. **编辑器卡片样式**：与阅读卡片保持相同的圆角、阴影、背景
4. **响应式优化**：
   - `max-width: 900px`：平板端字体与间距收缩
   - `max-width: 768px`：手机端单列布局、抽屉适配、按钮全宽
   - `max-width: 420px`：小屏手机进一步收缩
   - `max-width: 1100px / 960px`：缩放时网格布局保护
5. **Vditor 预览区样式**：强制覆盖 Vditor 默认样式，与阅读区视觉统一

### 加载顺序

在 `index.html` 的 `<head>` 中，于 `css/index.css` **之后**加载：

```html
<link rel="stylesheet" href="css/index.css">
<link rel="stylesheet" href="css/article-unified.css">
```

这样可利用 CSS 层叠规则覆盖和补充原有样式。

---

## 使用方式与加载顺序

### index.html 中的加载顺序

```html
<!-- 基础样式 -->
<link rel="stylesheet" href="css/index.css">
<link rel="stylesheet" href="css/article-unified.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vditor@3.10.8/dist/index.css">

<!-- Vditor 编辑器库 -->
<script src="https://cdn.jsdelivr.net/npm/vditor@3.10.8/dist/index.min.js"></script>

<!-- 原有核心模块 -->
<script src="js/config.js"></script>
<script src="js/api.js"></script>
<script src="js/state.js"></script>
<script src="js/data.js"></script>
<script src="js/render.js"></script>
<script src="js/ui.js"></script>
<script src="js/events.js"></script>
<script src="js/admin-panels.js"></script>
<script src="js/main.js"></script>

<!-- UI 组件模块（覆盖并增强原有实现） -->
<script src="js/components/markdown-renderer.js"></script>
<script src="js/components/theme-manager.js"></script>
<script src="js/components/responsive.js"></script>
<script src="js/components/article-viewer.js"></script>
<script src="js/components/article-editor.js"></script>
```

### 设计原则

1. **向后兼容**：原有 `js/ui.js`、`js/state.js` 等文件中的函数实现仍然保留，组件模块在其后加载，通过同名全局函数覆盖来提供增强实现
2. **依赖注入**：组件通过检测全局函数是否存在来实现松耦合（如 `typeof getArticleById === 'function'`）
3. **事件驱动**：主题切换、设备变化通过自定义事件广播，便于其他模块监听
4. **渐进增强**：即使组件模块加载失败，原有实现仍可保证基本功能可用

---

## 维护建议

- **修改 Markdown 渲染逻辑**：统一在 `js/components/markdown-renderer.js` 中维护
- **修改主题行为**：统一在 `js/components/theme-manager.js` 中维护
- **修改响应式断点**：统一在 `js/components/responsive.js` 中维护
- **修改文章阅读界面**：统一在 `js/components/article-viewer.js` 和 `css/article-unified.css` 中维护
- **修改文章编辑器**：统一在 `js/components/article-editor.js` 和 `css/article-unified.css` 中维护

避免在原有 `js/ui.js`、`js/state.js`、`js/index.js` 中重复修改相同逻辑，以保持代码单一职责。
