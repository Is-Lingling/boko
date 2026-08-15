//! Generic key-value store endpoints for admin-managed config data.

use axum::{extract::{Path, State}, http::HeaderMap, Json};
use rusqlite::params;
use serde_json::Value;

use crate::auth::is_authorized;
use crate::db::Db;
use crate::logging::log_operation;
use crate::models::{AppError, ApiResult, KvEntry};

/// GET /api/kv/:key  — returns the stored JSON value, or null if not found.
pub async fn get(State(db): State<Db>, Path(key): Path<String>) -> ApiResult<Value> {
    let conn = db.lock().unwrap();
    match conn.query_row("SELECT value FROM kv_store WHERE key=?1", params![key], |r| r.get::<_, String>(0)) {
        Ok(s) => {
            let v: Value = serde_json::from_str(&s).unwrap_or(Value::Null);
            Ok(Json(v))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(Json(Value::Null)),
        Err(e) => Err(AppError::internal(e.to_string())),
    }
}

/// PUT /api/kv/:key  (admin) — set or replace the JSON value.
pub async fn set(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(key): Path<String>,
    Json(value): Json<Value>,
) -> ApiResult<KvEntry> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let s = serde_json::to_string(&value).map_err(|e| AppError::internal(e.to_string()))?;
    let conn = db.lock().unwrap();
    // Read current value before (None if key doesn't exist).
    let old_value: Option<Value> = conn.query_row(
        "SELECT value FROM kv_store WHERE key=?1",
        params![key],
        |r| r.get::<_, String>(0),
    ).ok().and_then(|s| serde_json::from_str(&s).ok());
    conn.execute(
        "INSERT INTO kv_store (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, s],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    log_operation(&conn, "update", "kv", Some(key.clone()), old_value.as_ref(), Some(&value));
    Ok(Json(KvEntry { key, value }))
}

/// GET /api/kv  — list all keys (for debugging / admin UI).
pub async fn list(State(db): State<Db>) -> ApiResult<Vec<String>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT key FROM kv_store ORDER BY key ASC")
        .map_err(|e| AppError::internal(e.to_string()))?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| AppError::internal(e.to_string()))?;
    let keys: Vec<String> = rows.filter_map(|r| r.ok()).collect();
    Ok(Json(keys))
}
