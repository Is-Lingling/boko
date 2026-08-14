/**
 * config.js - 配置常量与默认数据
 */
const STORAGE_KEYS = {
    theme: 'blogTheme',
    likes: 'blogLikedArticles',
    favorites: 'blogFavoriteArticles',
    comments: 'blogComments',
    pv: 'blogPV',
    uv: 'blogUV',
    lastVisit: 'blogLastVisit',
    musicPlaying: 'blogMusicPlaying',
    categories: 'blogCategories',
    musicPlaylist: 'blogMusicPlaylist',
    musicApiBase: 'blogMusicApiBase',
    galleryNames: 'blogGalleryNames',
    coverUsage: 'blogCoverUsage',
    articleDraft: 'blogArticleDraft',
    articleContentImages: 'blogArticleContentImages',
    otherImages: 'blogOtherImages',
    files: 'blogFiles',
    homeResume: 'blogHomeResume'
};

// ========== 首页个人简历与介绍默认配置 ==========
const defaultHomeResume = {
    hero: {
        greeting: '你好，我是',
        name: '是令令啊',
        avatar: 'img/img6.jpg',
        status: '探索创造中',
        title: '全栈开发工程师 · 前端架构探索者 · 独立创作者',
        motto: '“探索数字边界，专注于打造优雅、极致、有温度的交互与产品体验。热爱代码与设计在像素间的精妙交融。”',
        tags: ['Web 全栈开发', '交互与 UI/UX 设计', '现代化前端架构', '极客生活探索'],
        github: 'https://github.com/Is-Lingling',
        primaryBtnText: '阅读我的文章',
        primaryBtnLink: 'list',
        secondaryBtnText: '空间动态',
        secondaryBtnLink: 'space',
        githubBtnText: 'GitHub'
    },
    aboutSection: {
        title: '关于我 · About Me',
        subtitle: '个人背景与技术哲学',
        icon: 'info'
    },
    about: [
        { icon: 'layers', title: '全栈视野与工程化', desc: '深耕现代化 Web 生态，精通模块化组件设计、状态管理、性能极致优化与工程化构建流程，兼具良好的全栈开发视野。' },
        { icon: 'palette', title: '极致美学与交互', desc: '笃信“Less, but better”设计哲学。热衷于玻璃拟态、流光微动效与丝滑触控反馈，让每一次点击都充满愉悦感。' },
        { icon: 'lightbulb', title: '探索未知与敏捷实践', desc: '对前沿技术保持敏锐好奇心，积极将现代化 Web 标准、Canvas 图形渲染与 AI 智能体生产力工具落地于实际项目。' },
        { icon: 'sprout', title: '知识沉淀与开放开源', desc: '坚持通过写作沉淀技术心得，乐于开源分享。在数字花园中记录每一次突破与成长，与同行者共同进步。' }
    ],
    skillsSection: {
        title: '专业技能 · Skills & Stack',
        subtitle: '熟练运用的技术栈与工具链',
        icon: 'code'
    },
    skillsCategories: [
        {
            title: '前端开发 (Frontend Core)',
            indicator: 'front',
            items: ['JavaScript (ES6+)', 'TypeScript', 'Vue.js 3 / Pinia', 'React / Next.js', 'HTML5 / Semantic Web', 'CSS3 / Flexbox / Grid', 'TailwindCSS / Vanilla CSS', 'Canvas / CSS Animation']
        },
        {
            title: '后端服务与数据 (Backend & Storage)',
            indicator: 'back',
            items: ['Node.js / Express', 'Python / FastAPI', 'RESTful APIs / GraphQL', 'PostgreSQL / MySQL', 'Redis 缓存', 'LocalStorage / IndexedDB']
        },
        {
            title: '工程化与设计协同 (DevOps & Tools)',
            indicator: 'tool',
            items: ['Vite / Webpack', 'Git / GitHub Workflow', 'Docker 容器化', 'CI / CD 自动化流水线', 'Figma UI/UX 设计', 'Chrome DevTools 性能调优']
        }
    ],
    projectsSection: {
        title: '精选作品 · Featured Projects',
        subtitle: '近期主导与独立开发的代表项目',
        icon: 'layout'
    },
    projects: [
        {
            badge: '核心开源项目',
            title: 'Boko 现代化极简玻璃拟态博客系统',
            desc: '一款采用原生 Web 技术与 CSS 变量驱动的高颜值个人博客平台。具备实时主题调色盘、卡片比例调优、纯净 PDF 打印导出、分类风箱折叠与完整管理后台。',
            tags: ['Vanilla JS', 'Glassmorphism', 'CSS Variables', 'Responsive'],
            link: 'list',
            customUrl: ''
        },
        {
            badge: '互动体验',
            title: '个人动态空间与实时轻量互动 Feed',
            desc: '支持富媒体图片上传、即时点赞动效、多层评论回复树与访客专属个性化标识，打造轻量化专属个人社交展示墙。',
            tags: ['DOM Engine', 'Event Delegation', 'Web Storage'],
            link: 'space',
            customUrl: ''
        }
    ],
    timelineSection: {
        title: '成长历程 · Milestones',
        subtitle: '技术探索与创作轨迹',
        icon: 'calendar'
    },
    timeline: [
        { year: '2026', title: '深度全栈与智能体协作实践', desc: '全面重构与迭代个人博客生态系统，探索 AI 编程代理深度集成，打造高交互质感的前端精品应用。' },
        { year: '2025', title: '现代化前端架构与设计系统规范', desc: '搭建高内聚低耦合的前端工程化基座，沉淀多套设计 Token 与响应式交互规范，提升研发效能。' },
        { year: '2024', title: '独立数字花园启航', desc: '上线第一代个人站点，坚持技术随笔与心得记录，积累了丰富的前端重构与性能调优实战经验。' }
    ],
    contactSection: {
        title: "让我们开始连接 · Let's Connect",
        desc: '无论是技术探讨、项目合作，还是单纯想打个招呼，都欢迎随时与我联系！',
        pills: ['邮箱交流', '博客留言', 'GitHub 开源'],
        ctaText: '进入文章专区',
        ctaLink: 'list',
        customUrl: ''
    }
};

// ========== 网易云音乐 API 配置 ==========

// 非官方 NeteaseCloudMusicApi 默认地址（支持 CORS，作为后备）
const DEFAULT_NETEASE_API_BASE = 'https://netease-cloud-music-api.fe-mm.com';

// 官方 Open API 配置（openapi.music.163.com）
// ⚠️ 官方 API 不支持 CORS，需通过代理访问
const NETEASE_OPEN_API = {
    baseUrl: 'https://interface.music.163.com',
    // CORS 代理列表（自动切换，官方 API 不支持 CORS，必须走代理）
    corsProxies: [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?url=',
        'https://api.codetabs.com/v1/proxy?quest='
    ],
    corsProxyIndex: 0,
    // 应用凭证
    appId: 'b3010d00000000000f335f86a2bc1feb',
    appSecret: 'de104623d92471248abf5b4f8eecbec1',
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCRUGTW06U4NLqGxj1KeMoQp5gbCzE+gFT+6a/mDUArW9r/rGlMuWejutklFYjRNYb5eJWPA8xjSJ5APUZb+3vBbwMoHh0QMu7VkeAFZKAgF2nmIcuU/ZyewMfiKWfpv3YKEAaUb93bwuBuvXNND06RdD3kO7wSASDnjEmoFHFKMywXw+++gR2F8zJq/AsyoHcOewSG8vOXjkV7Oddx0bwzr0VZR/vCulEwpVKrdq8yUYYvWaYftW8pLG8bLDtsiYslharWr7c2kmIWbTNR1yrbHt78El2uJ19EUBHRE6M1p7gO1ybebKsVTvS1bYwaExrTcpQzRZFhCrHc0Ibb7vC5AgMBAAECggEADN9Xx3YBLUzydwzpkgbIM5h9D2w65QP+Q4SU+eaTmCOvbzWpMEw+Q5FCOhhBwfKhbckCSqR1/xeIOT2UVYKeEGESoQOl5HD2mkGtXBzxWFZqoaG9xImAzclbC4xKcbjtrm+D/bM5LoYBVp3+sEVaWuU2tFicTOX/sbNKNRL2hDGJGnQA7jqsticfFEQN5Omm3ExF2NjkZeakCW18RCg1+wTmPxO1Fcpsi37SyeB4TpAkwXACYjCE1WS95i8Wk/4eu+EXtSgrSjd4T0mKpBoEwe06SLDKkBCNZnGqyoB5dfCP7IzDhwhfuu0j7etyakZKS7duAa4rQxPH0WttoMh03wKBgQC+u+UfXG19ErKmZvVAxYubE1VdJnp6TrjA8o8kTacSbKjuS6nrmbwWyV5lex+8gRvOLrcfgdOzeMNtFnld4d7yfSD6PT+yyySSQyvqFm4SlAwjiqmO/fQe/+cD5wj2Xko0TBKZcj3sxK9iX4CT7eKS+9pCrEWsArmnsxgYHI1ftwKBgQDDCcI5CPQqsvp3zXlHe/CZqabOEN3XBRnH/3Xzx6dtVWT1Z0RSBIwXtA3gK/DQNSXJN+tyWIXbnll5IA+WhXRN06MgSKiu4NLKbyQvj9NUHlQ6SgGW2M7B7piq9IC43Hq8AB6G8w4OfZAfTut6OW5wQB1pqkTMdx5mYZRQ11JTDwKBgAPdatcn2FAggN4+V9noJtwNmD06+mBgF/5Q6/WgXTJSYVnyzo6nntgXXIJR7GK1ewrCh5Nr3g5U9CDRw8PTP+FKB9EKTLAizarpEYq8yZ42wcg2lxj+rGO0a8n4dIYJgxdsMzRIzFhv493qcYCN4Xl5AQM42nCR3ZE4X9SdP4AhAoGBAI72Cj2QSJk708gY/rrdKEEaT8BgMJu5i2pD4IuuXxUPMQ+IgFW2K5H8Uudsjfmv22Cg8p5AMO4IJgFY9NQaQmQBq2Kwn6R/+0KTMO0D+Z2BFbAcKwoNJZCVeaZlziyyv+wqEjZM1pLcitXIHWbbzg3NkUGwovlUnx3gjLys+BUVAoGBAIiUsY+QB0G2bsViUu1GH25ZTDJ9wzOQ2RYl23YRYUFw1tR+GHsV3ZO/nTEIM5ZdplH6Kn8Qz9ACetEiXwLJmCUzB+Ee79OmYGs1NjfzrZKEDu0sHRNp7eHYDeRWXoRLYfeVn0nJmQB5Js4lLg5cOfWfyQfoccAiNakqXXlb4+lB
-----END PRIVATE KEY-----`,
    accessToken: '',
    signType: 'RSA_SHA256',
    // 客户端 IP（官方 Open API 必需参数，浏览器端无法自动获取真实 IP，需配置占位 IP）
    clientIp: '114.114.114.114',
    // 设备信息（新应用要求 os/channel/brand 符合约定，空对象可通过校验）
    device: {}
};

// 网易云官方 Open API RSA 公钥
const NETEASE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkVBk1tOlODS6hsY9SnjKEKeYGwsxPoBU/umv5g1AK1va/6xpTLlno7rZJRWI0TWG+XiVjwPMY0ieQD1GW/t7wW8DKB4dEDLu1ZHgBWSgIBdp5iHLlP2cnsDH4iln6b92ChAGlG/d28Lgbr1zTQ9OkXQ95Du8EgEg54xJqBRxSjMsF8PvvoEdhfMyavwLMqB3DnsEhvLzl45FeznXcdG8M69FWUf7wrpRMKVSq3avMlGGL1mmH7VvKSxvGyw7bImLJYWq1q+3NpJiFm0zUdcq2x7e/BJdridfRFAR0ROjNae4Dtcm3myrFU70tW2MGhMa03KUM0WRYQqx3NCG2+7wuQIDAQAB
-----END PUBLIC KEY-----`;

const pageStart = new Date('2024-01-01');
const pageNow = new Date();
const articlesPerPage = 4;

const defaultArticles = [];

const defaultProfile = {
    name: '是令令啊',
    bio: "it's me~",
    avatar: 'img/img6.jpg',
    about: '热衷于前端开发与 UI/UX 极致交互体验，喜爱全栈探索、设计系统与静态博客雕琢。欢迎来到我的个人空间动态！✨'
};

const friendLinks = [
    { title: '前端笔记', url: '#', titleText: '前端笔记站点' },
    { title: '技术栈', url: '#', titleText: '技术栈分享' },
    { title: '个人项目', url: '#', titleText: '个人项目展示' }
];

const initialComments = [];

// ========== 全局 SVG 图标生成辅助库 (Minimalist Premium Line SVG Icons) ==========
function getIcon(name, extraClass = '', size = 16) {
    const cls = extraClass ? ` ${extraClass}` : '';
    const icons = {
        'search': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
        'sun': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
        'moon': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
        'user': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
        'calendar': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        'book': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
        'book-open': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
        'like': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`,
        'fav': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
        'comment': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
        'edit': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
        'trash': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        'restore': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
        'permanent': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
        'folder': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
        'tag': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`,
        'archive': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        'link': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
        'plus': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
        'back': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
        'close': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        'image': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
        'gear': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
        'prev': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>`,
        'play': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" class="svg-icon${cls}"><polygon points="6 4 18 12 6 20 6 4"></polygon></svg>`,
        'pause': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" class="svg-icon${cls}"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`,
        'next': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>`,
        'list': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
        'home': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
        'globe': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
        'code': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
        'save': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`,
        'logout': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
        'music': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
        'arrow-up': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`,
        'print': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`,
        'download': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        'share': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
        'chevron-right': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
        'cat': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M12 5c-3.5 0-6 2.5-6 6v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7c0-3.5-2.5-6-6-6z"></path><path d="M6 7L3 3v5"></path><path d="M18 7l3-4v5"></path><circle cx="9" cy="12" r="1" fill="currentColor"></circle><circle cx="15" cy="12" r="1" fill="currentColor"></circle><path d="M12 15v1.5"></path></svg>`,
        'info': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
        'alert': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        'check': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        'check-circle': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        'card': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`,
        'bell': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
        'eye': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
        'lock': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
        'sparkle': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2"></polygon></svg>`,
        'copy': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        'refresh': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
        'sliders': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`,
        'layout': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
        'palette': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-5-4.5-9-10-9z"></path><circle cx="7.5" cy="11.5" r="1.5" fill="currentColor"></circle><circle cx="12" cy="7.5" r="1.5" fill="currentColor"></circle><circle cx="16.5" cy="11.5" r="1.5" fill="currentColor"></circle></svg>`,
        'rocket': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 9V4s3.03.55 4 2c1.08 1.62 0 5 0 5"></path></svg>`,
        'layers': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
        'cpu': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`,
        'lightbulb': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.22 1.5 3.5.76.76 1.23 1.52 1.41 2.5h6.18z"></path></svg>`,
        'sprout': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M7 20h10"></path><path d="M10 20c5.5-2.5.8-6.4 3-10"></path><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4.1 5.5.8z"></path><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"></path></svg>`,
        'arrow-right': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
        'mail': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
        'github': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>`,
        'terminal': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
        'key': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5L12 8l1.5 1.5L12 11l-3 3a5.5 5.5 0 1 1-2-2l3-3 1.5 1.5L13 9l-1.5-1.5 1.5-1.5L14.5 7.5 16 6l1.5 1.5L19 6l2-2z"></path></svg>`
    };
    return icons[name] || '';
}

