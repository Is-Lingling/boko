//! Visitor stats (PV/UV) endpoints.

use axum::{extract::State, Json};
use rusqlite::params;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::db::Db;
use crate::models::{AppError, ApiResult, VisitorStats};

fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64
}

/// POST /api/stats/visit  — increment PV (and UV if first visit in 24h).
/// The frontend doesn't pass an identifier, so UV is approximated by the
/// `X-Visitor-Id` header (a random UUID stored client-side). If absent, UV
/// increments every call.
pub async fn visit(State(db): State<Db>, headers: axum::http::HeaderMap) -> ApiResult<VisitorStats> {
    let conn = db.lock().unwrap();
    let now = now_ms();
    let row: (i64, i64, i64) = conn.query_row(
        "SELECT pv, uv, last_visit FROM visitor_stats WHERE id=1", [], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        }).map_err(|e| AppError::internal(e.to_string()))?;
    let (mut pv, mut uv, last_visit) = row;
    pv += 1;
    // Visitor id header (best-effort UV)
    let vid = headers.get("x-visitor-id").and_then(|v| v.to_str().ok()).unwrap_or("");
    let should_count_uv = vid.is_empty() && (now - last_visit > 24 * 60 * 60 * 1000);
    if should_count_uv {
        uv += 1;
        conn.execute("UPDATE visitor_stats SET pv=?1, uv=?2, last_visit=?3 WHERE id=1",
            params![pv, uv, now]).map_err(|e| AppError::internal(e.to_string()))?;
    } else {
        conn.execute("UPDATE visitor_stats SET pv=?1 WHERE id=1", params![pv])
            .map_err(|e| AppError::internal(e.to_string()))?;
    }
    Ok(Json(VisitorStats { pv, uv }))
}

/// GET /api/stats
pub async fn get(State(db): State<Db>) -> ApiResult<VisitorStats> {
    let conn = db.lock().unwrap();
    let row: (i64, i64) = conn.query_row("SELECT pv, uv FROM visitor_stats WHERE id=1", [], |r| {
        Ok((r.get(0)?, r.get(1)?))
    }).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(VisitorStats { pv: row.0, uv: row.1 }))
}
