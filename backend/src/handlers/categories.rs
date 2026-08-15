//! Categories & tags CRUD.

use axum::{extract::{Path, State}, http::HeaderMap, Json};
use rusqlite::params;

use crate::auth::is_authorized;
use crate::db::Db;
use crate::logging::log_operation;
use crate::models::{AppError, ApiResult, Category, IdResponse, OkResponse, RenameCategoryInput, TagInput};

/// GET /api/categories
pub async fn list(State(db): State<Db>) -> ApiResult<Vec<Category>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name FROM categories ORDER BY id ASC")
        .map_err(|e| AppError::internal(e.to_string()))?;
    let cat_rows: Vec<(i64, String)> = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| AppError::internal(e.to_string()))?
        .filter_map(|r| r.ok()).collect();

    let mut out = Vec::with_capacity(cat_rows.len());
    for (cid, name) in cat_rows {
        let mut tag_stmt = conn.prepare("SELECT tag FROM category_tags WHERE category_id=?1 ORDER BY id ASC")
            .map_err(|e| AppError::internal(e.to_string()))?;
        let tags: Vec<String> = tag_stmt.query_map(params![cid], |r| r.get::<_, String>(0))
            .map_err(|e| AppError::internal(e.to_string()))?
            .filter_map(|r| r.ok()).collect();
        out.push(Category { name, tags });
    }
    Ok(Json(out))
}

/// POST /api/categories  (admin) — body: { "name": "新分类" }
pub async fn create(
    State(db): State<Db>,
    headers: HeaderMap,
    Json(cat): Json<Category>,
) -> ApiResult<IdResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    conn.execute("INSERT OR IGNORE INTO categories (name) VALUES (?1)", params![cat.name])
        .map_err(|e| AppError::internal(e.to_string()))?;
    let id = conn.last_insert_rowid();
    // also seed any provided tags
    for t in &cat.tags {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO category_tags (category_id, tag) VALUES (?1, ?2)",
            params![id, t],
        );
    }
    log_operation::<Category, Category>(&conn, "create", "category", Some(cat.name.clone()), None, Some(&cat));
    Ok(Json(IdResponse { id }))
}

/// PUT /api/categories/:name  (admin) — rename
pub async fn rename(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(old): Path<String>,
    Json(input): Json<RenameCategoryInput>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    let n = conn.execute("UPDATE categories SET name=?1 WHERE name=?2", params![input.new_name, old])
        .map_err(|e| AppError::internal(e.to_string()))?;
    // also update articles
    let _ = conn.execute("UPDATE articles SET category=?1 WHERE category=?2", params![input.new_name, old]);
    Ok(Json(OkResponse { ok: n > 0 }))
}

/// DELETE /api/categories/:name  (admin)
pub async fn delete(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    let n = conn.execute("DELETE FROM categories WHERE name=?1", params![name])
        .map_err(|e| AppError::internal(e.to_string()))?;
    if n > 0 {
        log_operation::<String, String>(&conn, "delete", "category", Some(name.clone()), Some(&name), None);
    }
    Ok(Json(OkResponse { ok: n > 0 }))
}

/// POST /api/categories/:name/tags  (admin)
pub async fn add_tag(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(name): Path<String>,
    Json(input): Json<TagInput>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    // ensure category exists
    conn.execute("INSERT OR IGNORE INTO categories (name) VALUES (?1)", params![name])
        .map_err(|e| AppError::internal(e.to_string()))?;
    let cid: i64 = conn.query_row("SELECT id FROM categories WHERE name=?1", params![name], |r| r.get(0))
        .map_err(|e| AppError::internal(e.to_string()))?;
    let n = conn.execute(
        "INSERT OR IGNORE INTO category_tags (category_id, tag) VALUES (?1, ?2)",
        params![cid, input.tag],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(OkResponse { ok: n > 0 }))
}

/// DELETE /api/categories/:name/tags/:tag  (admin)
pub async fn delete_tag(
    State(db): State<Db>,
    headers: HeaderMap,
    Path((name, tag)): Path<(String, String)>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    let n = conn.execute(
        "DELETE FROM category_tags WHERE category_id=(SELECT id FROM categories WHERE name=?1) AND tag=?2",
        params![name, tag],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(OkResponse { ok: n > 0 }))
}
