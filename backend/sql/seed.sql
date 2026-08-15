-- Boko blog seed data (idempotent: uses INSERT OR IGNORE)
-- Migrated from the original static frontend data sources:
--   * config.js   : defaultProfile, defaultHomeResume, friendLinks
--   * data.js     : FALLBACK_PLAYLIST
--   * index.js    : 10 fallback articles (summary + meta)
--   * article.js  : 3 articles with full markdown content (merged by id)

-- ========== Profile ==========
INSERT OR IGNORE INTO profile (id, name, bio, avatar, about, socials, qq, wechat, github, email) VALUES (
    1,
    '是令令啊',
    'it''s me~',
    'img/img6.jpg',
    '热衷于前端开发与 UI/UX 极致交互体验，喜爱全栈探索、设计系统与静态博客雕琢。欢迎来到我的个人空间动态！✨',
    '[]',
    '',
    '',
    '',
    ''
);

-- ========== Home resume (full JSON blob, from defaultHomeResume in config.js) ==========
INSERT OR IGNORE INTO home_resume (id, data) VALUES (1, '{"hero":{"greeting":"你好，我是","name":"是令令啊","avatar":"img/img6.jpg","status":"探索创造中","title":"全栈开发工程师 · 前端架构探索者 · 独立创作者","motto":"\"探索数字边界，专注于打造优雅、极致、有温度的交互与产品体验。热爱代码与设计在像素间的精妙交融。\"","tags":["Web 全栈开发","交互与 UI/UX 设计","现代化前端架构","极客生活探索"],"github":"https://github.com/Is-Lingling","primaryBtnText":"阅读我的文章","primaryBtnLink":"list","secondaryBtnText":"空间动态","secondaryBtnLink":"space","githubBtnText":"GitHub"},"aboutSection":{"title":"关于我 · About Me","subtitle":"个人背景与技术哲学","icon":"info"},"about":[{"icon":"layers","title":"全栈视野与工程化","desc":"深耕现代化 Web 生态，精通模块化组件设计、状态管理、性能极致优化与工程化构建流程，兼具良好的全栈开发视野。"},{"icon":"palette","title":"极致美学与交互","desc":"笃信“Less, but better”设计哲学。热衷于玻璃拟态、流光微动效与丝滑触控反馈，让每一次点击都充满愉悦感。"},{"icon":"lightbulb","title":"探索未知与敏捷实践","desc":"对前沿技术保持敏锐好奇心，积极将现代化 Web 标准、Canvas 图形渲染与 AI 智能体生产力工具落地于实际项目。"},{"icon":"sprout","title":"知识沉淀与开放开源","desc":"坚持通过写作沉淀技术心得，乐于开源分享。在数字花园中记录每一次突破与成长，与同行者共同进步。"}],"skillsSection":{"title":"专业技能 · Skills & Stack","subtitle":"熟练运用的技术栈与工具链","icon":"code"},"skillsCategories":[{"title":"前端开发 (Frontend Core)","indicator":"front","items":["JavaScript (ES6+)","TypeScript","Vue.js 3 / Pinia","React / Next.js","HTML5 / Semantic Web","CSS3 / Flexbox / Grid","TailwindCSS / Vanilla CSS","Canvas / CSS Animation"]},{"title":"后端服务与数据 (Backend & Storage)","indicator":"back","items":["Node.js / Express","Python / FastAPI","RESTful APIs / GraphQL","PostgreSQL / MySQL","Redis 缓存","LocalStorage / IndexedDB"]},{"title":"工程化与设计协同 (DevOps & Tools)","indicator":"tool","items":["Vite / Webpack","Git / GitHub Workflow","Docker 容器化","CI / CD 自动化流水线","Figma UI/UX 设计","Chrome DevTools 性能调优"]}],"projectsSection":{"title":"精选作品 · Featured Projects","subtitle":"近期主导与独立开发的代表项目","icon":"layout"},"projects":[{"badge":"核心开源项目","title":"Boko 现代化极简玻璃拟态博客系统","desc":"一款采用原生 Web 技术与 CSS 变量驱动的高颜值个人博客平台。具备实时主题调色盘、卡片比例调优、纯净 PDF 打印导出、分类风箱折叠与完整管理后台。","tags":["Vanilla JS","Glassmorphism","CSS Variables","Responsive"],"link":"list","customUrl":""},{"badge":"互动体验","title":"个人动态空间与实时轻量互动 Feed","desc":"支持富媒体图片上传、即时点赞动效、多层评论回复树与访客专属个性化标识，打造轻量化专属个人社交展示墙。","tags":["DOM Engine","Event Delegation","Web Storage"],"link":"space","customUrl":""}],"timelineSection":{"title":"成长历程 · Milestones","subtitle":"技术探索与创作轨迹","icon":"calendar"},"timeline":[{"year":"2026","title":"深度全栈与智能体协作实践","desc":"全面重构与迭代个人博客生态系统，探索 AI 编程代理深度集成，打造高交互质感的前端精品应用。"},{"year":"2025","title":"现代化前端架构与设计系统规范","desc":"搭建高内聚低耦合的前端工程化基座，沉淀多套设计 Token 与响应式交互规范，提升研发效能。"},{"year":"2024","title":"独立数字花园启航","desc":"上线第一代个人站点，坚持技术随笔与心得记录，积累了丰富的前端重构与性能调优实战经验。"}],"contactSection":{"title":"让我们开始连接 · Let''s Connect","desc":"无论是技术探讨、项目合作，还是单纯想打个招呼，都欢迎随时与我联系！","pills":["邮箱交流","博客留言","GitHub 开源"],"ctaText":"进入文章专区","ctaLink":"list","customUrl":""}}');

-- ========== Friend links ==========
INSERT OR IGNORE INTO friend_links (id, title, url, title_text, sort_order) VALUES
    (1, '前端笔记', '#', '前端笔记站点', 0),
    (2, '技术栈',   '#', '技术栈分享',   1),
    (3, '个人项目', '#', '个人项目展示', 2);

-- ========== Music playlist (FALLBACK_PLAYLIST from data.js) ==========
INSERT OR IGNORE INTO music_playlist (id, song_id, name, artist, pic_url, url, song_id_enc, platform, sort_order) VALUES
    (1, '18706346', '君をのせて',           '井上あずみ',                 'https://p2.music.126.net/6y-Ys2CgX4yGqE1ic2x63g==/109951165406022565.jpg', '', '', 'netease', 0),
    (2, '186646',   '願いが叶う場所II',      '麻枝准 / Key Sound Label',   'https://p1.music.126.net/2fI-8R_f_1_s2t_H8x20_A==/109951163185361250.jpg', '', '', 'netease', 1),
    (3, '1.2',      'カノン (Canon in D)',  'Johann Pachelbel',           'https://p2.music.126.net/76_1Gz75P1d7rQx96v4-vA==/109951165609653775.jpg', '', '', 'netease', 2);

-- ========== Visitor stats ==========
INSERT OR IGNORE INTO visitor_stats (id, pv, uv, last_visit) VALUES (1, 0, 0, 0);

-- ========== Admin user ==========
INSERT OR IGNORE INTO admin_user (id, username, password) VALUES (1, 'admin', 'admin123');

-- ========== Articles ==========
-- Merged from index.js (10 articles, meta only) + article.js (3 articles with content)
INSERT OR IGNORE INTO articles (id, title, date, category, tags, read_count, comment_count, summary, cover, content, featured, like_count) VALUES
    (1, '前端性能优化实战指南',
     '2026-08-09', '前端', '["前端","性能","优化"]', 1540, 21,
     '从资源加载、图片懒加载到缓存策略，逐步提升页面首屏与交互速度。',
     'img/img6.jpg',
     '# 前端性能优化实战指南

本文介绍性能优化思路，涵盖资源加载、图片懒加载与缓存策略等核心议题。',
     1, 0),
    (2, 'CSS 布局与响应式设计技巧',
     '2026-07-28', '前端', '["CSS","响应式","布局"]', 1284, 18,
     '在网格和弹性布局间切换，打造桌面、平板、手机三端适配体验。',
     'img/firstlogo.gif',
     '# CSS 布局与响应式设计技巧

学习使用 Flexbox 和 Grid，掌握响应式布局的核心技巧。',
     1, 0),
    (3, '我的考研备考与时间管理',
     '2026-06-10', '随笔', '["考研","学习","时间管理"]', 980, 14,
     '分享学习计划、复习方法与如何在忙碌中保持稳定节奏。',
     'img/img6.jpg',
     '# 我的考研备考与时间管理

分享考研经验和复习方法，以及如何在忙碌中保持稳定节奏。',
     1, 0),
    (4, 'VSCode 插件推荐与工作流',
     '2026-05-15', '工具', '["VSCode","开发效率","插件"]', 820, 9,
     '推荐实用插件与快捷键设置，让编辑器成为高效生产力工具。',
     'img/img6.jpg', '', 0, 0),
    (5, '静态博客页面的 SEO 优化',
     '2026-04-22', '前端', '["SEO","博客","静态站点"]', 760, 12,
     '包括元标签、语义结构与页面性能优化，提升搜索引擎可见度。',
     'img/firstlogo.gif', '', 0, 0),
    (6, '个人网站的暗黑模式实现方案',
     '2026-04-03', '设计', '["暗黑模式","主题切换","体验"]', 690, 7,
     '从变量主题到用户偏好存储，打造舒适的多主题浏览。',
     'img/img6.jpg', '', 0, 0),
    (7, '友链与站点生态建设心得',
     '2026-03-19', '随笔', '["友链","社区","站点"]', 540, 6,
     '谈谈友链交换、内容互联与圈层流量的价值。',
     'img/img6.jpg', '', 0, 0),
    (8, '简易 RSS 订阅与站点地图生成',
     '2026-02-12', '工具', '["RSS","Sitemap","订阅"]', 480, 8,
     '用简单方式提供 RSS 订阅入口和自动站点地图链接。',
     'img/firstlogo.gif', '', 0, 0),
    (9, '移动端导航与触控优化',
     '2026-01-26', '前端', '["移动端","触控","导航"]', 430, 5,
     '对移动端交互区域、汉堡菜单和触控反馈进行优化。',
     'img/img6.jpg', '', 0, 0),
    (10, '访客统计与本地存储交互设计',
     '2025-12-20', '产品', '["统计","本地存储","交互"]', 390, 4,
     '前端统计与本地存储结合，打造简单访客数据展示。',
     'img/img6.jpg', '', 0, 0);

-- ========== Space feeds (动态/说说) — from defaultSpaceFeeds in data.js ==========
INSERT OR IGNORE INTO space_feeds (id, content, date, images, likes) VALUES
    (1723482000000, '🎉 欢迎来到我的个人空间动态！这里记录我的日常随笔、项目想法与极客技术探讨，欢迎在下方点赞与留言交互~ ✨', '2026-08-12 18:30', '["img/img6.jpg"]', 18),
    (1723309200000, '今天抽空为博客优化了日历活跃周期与多调色盘交互，看着代码一步步完善感觉很有成就感。☕💻', '2026-08-10 14:20', '["img/img2.jpg","img/img8.jpg"]', 24);

INSERT OR IGNORE INTO space_feed_comments (id, feed_id, name, contact, text, date, parent_id) VALUES
    (101, 1723482000000, '小明', 'xiaoming@qq.com', '全站的高斯玻璃拟态和卡片圆角设计太棒了！支持博主！❤️', '2026-08-12 19:15', NULL),
    (102, 1723482000000, '是令令啊', 'admin@blog.com', '谢谢支持！近期还会加入更多有趣的功能~ 🥳', '2026-08-12 19:30', 101);

-- ========== KV store (admin-managed config data) ==========
-- gallery_images: default image pool from render.js
INSERT OR IGNORE INTO kv_store (key, value) VALUES ('gallery_images', '["img/img1.jpg","img/img2.jpg","img/img3.jpg","img/img4.jpg","img/img5.jpg","img/img6.jpg","img/img7.jpg","img/img8.jpg","img/img9.jpg","img/img10.jpg","img/firstlogo.gif"]');
INSERT OR IGNORE INTO kv_store (key, value) VALUES ('gallery_names', '{}');
INSERT OR IGNORE INTO kv_store (key, value) VALUES ('cover_usage', '{}');
INSERT OR IGNORE INTO kv_store (key, value) VALUES ('article_content_images', '[]');
INSERT OR IGNORE INTO kv_store (key, value) VALUES ('other_images', '[]');
INSERT OR IGNORE INTO kv_store (key, value) VALUES ('files', '{"root":[]}');
INSERT OR IGNORE INTO kv_store (key, value) VALUES ('custom_admin_links', '[{"title":"官方文档","url":"https://ndmiao.cn/"},{"title":"我的 GitHub","url":"https://github.com"}]');
INSERT OR IGNORE INTO kv_store (key, value) VALUES ('calendar_memos', '{}');
