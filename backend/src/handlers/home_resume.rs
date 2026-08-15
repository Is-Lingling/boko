//! Home resume (singleton JSON blob) endpoints.

use axum::{extract::State, http::HeaderMap, Json};
use rusqlite::params;
use serde_json::Value;

use crate::auth::is_authorized;
use crate::db::Db;
use crate::logging::log_operation;
use crate::models::{AppError, ApiResult};

/// GET /api/home-resume  -> returns the parsed JSON object directly.
pub async fn get(State(db): State<Db>) -> ApiResult<Value> {
    let conn = db.lock().unwrap();
    let row: String = conn.query_row(
        "SELECT data FROM home_resume WHERE id=1", [], |r| r.get(0),
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let v: Value = serde_json::from_str(&row).unwrap_or(Value::Null);
    Ok(Json(v))
}

/// PUT /api/home-resume  (admin)
pub async fn update(
    State(db): State<Db>,
    headers: HeaderMap,
    Json(v): Json<Value>,
) -> ApiResult<Value> {
    if !is_authorized(headers.get("authorization").and_then(|x| x.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let s = serde_json::to_string(&v).map_err(|e| AppError::bad_request(e.to_string()))?;
    let conn = db.lock().unwrap();
    // Read before state (best-effort).
    let old_data_string: Option<String> = conn.query_row(
        "SELECT data FROM home_resume WHERE id=1", [], |r| r.get::<_, String>(0),
    ).ok();
    conn.execute("UPDATE home_resume SET data=?1 WHERE id=1", params![s.clone()])
        .map_err(|e| AppError::internal(e.to_string()))?;
    let before_json = old_data_string.map(|d| serde_json::json!({ "data": d }));
    let after_json = serde_json::json!({ "data": s });
    log_operation(&conn, "update", "home_resume", Some("1".to_string()), before_json.as_ref(), Some(&after_json));
    Ok(Json(v))
}
