//! Boko blog backend entry point.
//!
//! Architecture: Rust + Axum + SQLite (rusqlite, bundled).
//! Serves the REST API under `/api/*` and the static frontend from `../`
//! (the project root containing index.html, css/, js/, img/).

mod auth;
mod db;
mod handlers;
mod logging;
mod models;

use std::net::SocketAddr;

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;

use crate::db::Db;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "boko_backend=info,tower_http=info".into()),
        )
        .init();

    let db_path = std::env::var("BOKO_DB_PATH").unwrap_or_else(|_| db::default_db_path());
    let mode = if db::is_local_mode() { "LOCAL" } else { "CLOUD" };
    tracing::info!("Deployment mode: {} | Database: {}", mode, db_path);
    let db: Db = db::open(&db_path)?;
    tracing::info!("SQLite database ready at {}", db_path);

    // Static frontend dir: parent of the backend crate (project root).
    let static_dir = std::env::var("BOKO_STATIC_DIR")
        .unwrap_or_else(|_| "..".to_string());
    tracing::info!("Serving static frontend from: {}", static_dir);

    // CORS: permissive for local dev (frontend may run on a different port).
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_routes = api_router().with_state(db);

    let app = Router::new()
        .nest("/api", api_routes)
        .fallback_service(ServeDir::new(&static_dir))
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let port: u16 = std::env::var("BOKO_PORT")
        .ok().and_then(|s| s.parse().ok()).unwrap_or(8287);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Boko backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn api_router() -> Router<Db> {
    // `Db` is already `Arc<Mutex<Connection>>` — clone is cheap.
    Router::new()
        // ---- Articles ----
        .route("/articles", get(handlers::articles::list).post(handlers::articles::create))
        .route("/articles/:id", get(handlers::articles::get).put(handlers::articles::update).delete(handlers::articles::soft_delete))
        .route("/articles/:id/like", post(handlers::articles::set_like))
        .route("/articles/trash/:id/restore", post(handlers::articles::restore))
        .route("/articles/trash/:id", delete(handlers::articles::permanent_delete))
        .route("/articles/:id/comments", get(handlers::articles::list_article_comments).post(handlers::articles::add_article_comment))
        .route("/articles/:id/comments/:cid", delete(handlers::articles::delete_article_comment))
        // ---- Site comments ----
        .route("/comments", get(handlers::comments::list).post(handlers::comments::create))
        .route("/comments/:id", delete(handlers::comments::delete))
        // ---- Profile ----
        .route("/profile", get(handlers::profile::get).put(handlers::profile::update))
        // ---- Home resume ----
        .route("/home-resume", get(handlers::home_resume::get).put(handlers::home_resume::update))
        // ---- Friend links ----
        .route("/friend-links", get(handlers::friend_links::list).post(handlers::friend_links::create))
        .route("/friend-links/:id", put(handlers::friend_links::update).delete(handlers::friend_links::delete))
        // ---- Music ----
        .route("/music", get(handlers::music::get))
        .route("/music/playlist", post(handlers::music::add_song))
        .route("/music/playlist/:idx", delete(handlers::music::remove_song))
        .route("/music/api-base", put(handlers::music::set_api_base))
        // ---- Stats ----
        .route("/stats", get(handlers::stats::get))
        .route("/stats/visit", post(handlers::stats::visit))
        // ---- Space feeds (动态/说说) ----
        .route("/feeds", get(handlers::space_feeds::list).post(handlers::space_feeds::create))
        .route("/feeds/:id", get(handlers::space_feeds::get_one).put(handlers::space_feeds::update).delete(handlers::space_feeds::delete))
        .route("/feeds/:id/like", post(handlers::space_feeds::set_like))
        .route("/feeds/:id/comments", post(handlers::space_feeds::add_comment))
        .route("/feeds/:id/comments/:cid", delete(handlers::space_feeds::delete_comment))
        // ---- KV store (admin config data) ----
        .route("/kv", get(handlers::kv::list))
        .route("/kv/:key", get(handlers::kv::get).put(handlers::kv::set))
        // ---- Operation logs (审计日志 + 回滚) ----
        .route("/logs", get(handlers::logs::list))
        .route("/logs/:id", get(handlers::logs::get_one))
        .route("/logs/:id/rollback", post(handlers::logs::rollback))
        // ---- Database viewer (管理员) ----
        .route("/db/tables", get(handlers::db_viewer::list_tables))
        .route("/db/tables/:name", get(handlers::db_viewer::table_data))
        .route("/db/schema/:name", get(handlers::db_viewer::table_schema))
        // ---- Auth ----
        .route("/auth/login", post(handlers::auth::login))
        .route("/auth/logout", post(handlers::auth::logout))
        .route("/auth/check", get(handlers::auth::check))
        .route("/auth/password", put(handlers::auth::change_password))
}
