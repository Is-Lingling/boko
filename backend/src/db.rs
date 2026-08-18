//! SQLite connection pool & schema/seed initialization.
//!
//! Seed strategy:
//! * Demo data (articles, space_feeds, comments, default playlist, etc.) is
//!   applied ONLY on the very first startup, tracked by a KV marker
//!   `seed_demo_v1`. This guarantees that if the user deletes an article or
//!   clears a feed, a subsequent server restart won't silently resurrect
//!   the deleted rows via `INSERT OR IGNORE`.
//! * Essential singleton rows (profile id=1, home_resume id=1,
//!   admin_user id=1, music_config id=1) use `INSERT OR IGNORE` and are
//!   re-applied every start — they never overwrite existing data.

use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};

/// Simple connection wrapper. SQLite is single-writer; for this minimalist
/// blog a `Mutex<Connection>` is plenty fast and avoids the complexity of
/// a real pool like `r2d2`.
pub type Db = Arc<Mutex<Connection>>;

pub const SCHEMA_SQL: &str = include_str!("../sql/schema.sql");
pub const SEED_SQL: &str = include_str!("../sql/seed.sql");

/// Essential singleton rows (safe to re-run with INSERT OR IGNORE).
/// These must exist even when the demo marker has already been set.
const ESSENTIAL_SEED_SQL: &str = r#"
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
INSERT OR IGNORE INTO home_resume (id, data) VALUES (1, '{"hero":{"greeting":"你好，我是","name":"是令令啊","avatar":"img/img6.jpg","status":"探索创造中","title":"全栈开发工程师 · 前端架构探索者 · 独立创作者","motto":"\"探索数字边界，专注于打造优雅、极致、有温度的交互与产品体验。热爱代码与设计在像素间的精妙交融。\"","tags":["Web 全栈开发","交互与 UI/UX 设计","现代化前端架构","极客生活探索"],"github":"https://github.com/Is-Lingling","primaryBtnText":"阅读我的文章","primaryBtnLink":"list","secondaryBtnText":"空间动态","secondaryBtnLink":"space","githubBtnText":"GitHub"},"aboutSection":{"title":"关于我 · About Me","subtitle":"个人背景与技术哲学","icon":"info"},"about":[{"icon":"layers","title":"全栈视野与工程化","desc":"深耕现代化 Web 生态，精通模块化组件设计、状态管理、性能极致优化与工程化构建流程，兼具良好的全栈开发视野。"},{"icon":"palette","title":"极致美学与交互","desc":"笃信“Less, but better”设计哲学。热衷于玻璃拟态、流光微动效与丝滑触控反馈，让每一次点击都充满愉悦感。"},{"icon":"lightbulb","title":"探索未知与敏捷实践","desc":"对前沿技术保持敏锐好奇心，积极将现代化 Web 标准、Canvas 图形渲染与 AI 智能体生产力工具落地于实际项目。"},{"icon":"sprout","title":"知识沉淀与开放开源","desc":"坚持通过写作沉淀技术心得，乐于开源分享。在数字花园中记录每一次突破与成长，与同行者共同进步。"}],"skillsSection":{"title":"专业技能 · Skills & Stack","subtitle":"熟练运用的技术栈与工具链","icon":"code"},"skillsCategories":[{"title":"前端开发 (Frontend Core)","indicator":"front","items":["JavaScript (ES6+)","TypeScript","Vue.js 3 / Pinia","React / Next.js","HTML5 / Semantic Web","CSS3 / Flexbox / Grid","TailwindCSS / Vanilla CSS","Canvas / CSS Animation"]},{"title":"后端服务与数据 (Backend & Storage)","indicator":"back","items":["Node.js / Express","Python / FastAPI","RESTful APIs / GraphQL","PostgreSQL / MySQL","Redis 缓存","LocalStorage / IndexedDB"]},{"title":"工程化与设计协同 (DevOps & Tools)","indicator":"tool","items":["Vite / Webpack","Git / GitHub Workflow","Docker 容器化","CI / CD 自动化流水线","Figma UI/UX 设计","Chrome DevTools 性能调优"]}],"projectsSection":{"title":"精选作品 · Featured Projects","subtitle":"近期主导与独立开发的代表项目","icon":"layout"},"projects":[{"badge":"核心开源项目","title":"Boko 现代化极简玻璃拟态博客系统","desc":"一款采用原生 Web 技术与 CSS 变量驱动的高颜值个人博客平台。具备实时主题调色盘、卡片比例调优、纯净 PDF 打印导出、分类风箱折叠与完整管理后台。","tags":["Vanilla JS","Glassmorphism","CSS Variables","Responsive"],"link":"list","customUrl":""},{"badge":"互动体验","title":"个人动态空间与实时轻量互动 Feed","desc":"支持富媒体图片上传、即时点赞动效、多层评论回复树与访客专属个性化标识，打造轻量化专属个人社交展示墙。","tags":["DOM Engine","Event Delegation","Web Storage"],"link":"space","customUrl":""}],"timelineSection":{"title":"成长历程 · Milestones","subtitle":"技术探索与创作轨迹","icon":"calendar"},"timeline":[{"year":"2026","title":"深度全栈与智能体协作实践","desc":"全面重构与迭代个人博客生态系统，探索 AI 编程代理深度集成，打造高交互质感的前端精品应用。"},{"year":"2025","title":"现代化前端架构与设计系统规范","desc":"搭建高内聚低耦合的前端工程化基座，沉淀多套设计 Token 与响应式交互规范，提升研发效能。"},{"year":"2024","title":"独立数字花园启航","desc":"上线第一代个人站点，坚持技术随笔与心得记录，积累了丰富的前端重构与性能调优实战经验。"}],"contactSection":{"title":"让我们开始连接 · Let''s Connect","desc":"无论是技术探讨、项目合作，还是单纯想打个招呼，都欢迎随时与我联系！","pills":["邮箱交流","博客留言","GitHub 开源"],"ctaText":"进入文章专区","ctaLink":"list","customUrl":""}}');
INSERT OR IGNORE INTO admin_user (id, username, password) VALUES (1, 'admin', 'admin123');
INSERT OR IGNORE INTO music_config (id, api_base) VALUES (1, '');
"#;

const KV_SEED_MARKER: &str = "seed_demo_v1";

/// Resolve the default database path when `BOKO_DB_PATH` is not set.
///
/// The database must NOT live inside the project tree — it holds persistent
/// user data and should survive redeploys. We follow the XDG base directory
/// spec (`$XDG_DATA_HOME`, falling back to `$HOME/.local/share`), which keeps
/// the file out of the repo on both local dev machines and servers.
/// Docker deployments override this entirely via `BOKO_DB_PATH`.
pub fn default_db_path() -> String {
    // XDG base directory spec: $XDG_DATA_HOME, or $HOME/.local/share if unset.
    let base = match std::env::var("XDG_DATA_HOME") {
        Ok(v) if !v.is_empty() => std::path::PathBuf::from(v),
        _ => {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            let mut p = std::path::PathBuf::from(home);
            p.push(".local");
            p.push("share");
            p
        }
    };
    let mut p = base;
    p.push("boko");
    p.push("boko.db");
    p.to_string_lossy().into_owned()
}

/// Open (or create) the SQLite database file, apply schema & seed.
pub fn open(path: &str) -> Result<Db> {
    // Ensure the parent directory exists so a fresh deploy doesn't crash.
    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("failed to create db directory {}", parent.display()))?;
        }
    }

    let conn = Connection::open(path)
        .with_context(|| format!("failed to open sqlite db at {}", path))?;

    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
        .context("failed to set pragmas")?;

    conn.execute_batch(SCHEMA_SQL)
        .context("failed to apply schema.sql")?;

    // Migrations
    migrate_profile_socials(&conn)?;

    // Always re-apply essential singleton seeds (idempotent via INSERT OR IGNORE).
    // They will never overwrite user edits because the rows already exist.
    conn.execute_batch(ESSENTIAL_SEED_SQL)
        .context("failed to apply essential seed")?;

    // Demo data: articles / feeds / comments / playlist / friend_links / KV
    // defaults — apply ONLY on the very first run so we don't resurrect
    // rows the user intentionally deleted on subsequent restarts.
    let has_marker: bool = conn
        .prepare("SELECT 1 FROM kv_store WHERE key = ?1")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_row([KV_SEED_MARKER], |_r| Ok(true))
                .ok()
        })
        .unwrap_or(false);

    if !has_marker {
        conn.execute_batch(SEED_SQL)
            .context("failed to apply seed.sql (demo data)")?;
        conn.execute(
            "INSERT OR IGNORE INTO kv_store (key, value) VALUES (?1, '1')",
            [KV_SEED_MARKER],
        )
        .context("failed to write seed demo marker to kv_store")?;
    }

    Ok(Arc::new(Mutex::new(conn)))
}

/// Check if the `socials` column exists in the profile table; if not, add it.
fn migrate_profile_socials(conn: &Connection) -> Result<()> {
    let cols: Vec<String> = conn
        .prepare("PRAGMA table_info(profile)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !cols.iter().any(|c| c == "socials") {
        conn.execute("ALTER TABLE profile ADD COLUMN socials TEXT NOT NULL DEFAULT '[]'", [])
            .context("failed to add socials column to profile")?;
    }
    // Legacy compat columns: qq / wechat / github / email
    for (col, default) in [
        ("qq",     "''"),
        ("wechat", "''"),
        ("github", "''"),
        ("email",  "''"),
    ] {
        if !cols.iter().any(|c| c == col) {
            let sql = format!("ALTER TABLE profile ADD COLUMN {col} TEXT NOT NULL DEFAULT {default}");
            conn.execute(&sql, [])
                .with_context(|| format!("failed to add {col} column to profile"))?;
        }
    }
    Ok(())
}
