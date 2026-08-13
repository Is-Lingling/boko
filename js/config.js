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
    articleDraft: 'blogArticleDraft'
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
        'cat': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon${cls}"><path d="M12 5c-3.5 0-6 2.5-6 6v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7c0-3.5-2.5-6-6-6z"></path><path d="M6 7L3 3v5"></path><path d="M18 7l3-4v5"></path><circle cx="9" cy="12" r="1" fill="currentColor"></circle><circle cx="15" cy="12" r="1" fill="currentColor"></circle><path d="M12 15v1.5"></path></svg>`
    };
    return icons[name] || '';
}

