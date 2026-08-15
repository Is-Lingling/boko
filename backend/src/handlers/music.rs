//! Music playlist + API base config.

use axum::{extract::{Path, State}, http::HeaderMap, Json};
use rusqlite::params;

use crate::auth::is_authorized;
use crate::db::Db;
use crate::models::{AppError, ApiResult, MusicApiBaseInput, MusicConfig, Song, SongInput};

fn row_to_song(row: &rusqlite::Row<'_>) -> rusqlite::Result<Song> {
    let song_id_str: String = row.get("song_id")?;
    // Try to parse as number for backwards-compat with the frontend (which uses
    // numeric IDs in some places). If it fails, fall back to string.
    let id_num = song_id_str.parse::<i64>().unwrap_or(0);
    Ok(Song {
        id: id_num,
        song_id: song_id_str,
        name: row.get("name")?,
        artist: row.get("artist")?,
        pic_url: row.get("pic_url")?,
        url: row.get("url")?,
        song_id_enc: row.get("song_id_enc")?,
        platform: row.get("platform")?,
    })
}

/// GET /api/music
pub async fn get(State(db): State<Db>) -> ApiResult<MusicConfig> {
    let conn = db.lock().unwrap();
    let api_base: String = conn.query_row("SELECT api_base FROM music_config WHERE id=1", [], |r| r.get(0))
        .unwrap_or_else(|_| "https://netease-cloud-music-api.fe-mm.com".to_string());

    let mut stmt = conn.prepare(
        "SELECT id, song_id, name, artist, pic_url, url, song_id_enc, platform FROM music_playlist ORDER BY sort_order ASC, id ASC"
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let rows = stmt.query_map([], row_to_song).map_err(|e| AppError::internal(e.to_string()))?;
    let playlist: Vec<Song> = rows.filter_map(|r| r.ok()).collect();
    Ok(Json(MusicConfig { api_base, playlist }))
}

/// POST /api/music/playlist  (admin) — append a song
pub async fn add_song(
    State(db): State<Db>,
    headers: HeaderMap,
    Json(input): Json<SongInput>,
) -> ApiResult<Song> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    // Normalize song_id from possibly-numeric JSON value
    let song_id = match input.id {
        Some(serde_json::Value::Number(n)) => n.to_string(),
        Some(serde_json::Value::String(s)) => s,
        _ => String::new(),
    };
    let name = input.name;
    let artist = input.artist.unwrap_or_else(|| "未知艺术家".into());
    let pic_url = input.pic_url.unwrap_or_default();
    let url = input.url.unwrap_or_default();
    let song_id_enc = input.song_id_enc.unwrap_or_default();
    let platform = input.platform.unwrap_or_else(|| "netease".into());

    let conn = db.lock().unwrap();
    // Determine next sort_order
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM music_playlist", [], |r| r.get(0)
    ).unwrap_or(0);
    conn.execute(
        "INSERT INTO music_playlist (song_id, name, artist, pic_url, url, song_id_enc, platform, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![song_id, name, artist, pic_url, url, song_id_enc, platform, next_order],
    ).map_err(|e| AppError::internal(e.to_string()))?;

    let _row_id = conn.last_insert_rowid();
    Ok(Json(Song {
        id: song_id.parse::<i64>().unwrap_or(0),
        song_id, name, artist, pic_url, url, song_id_enc, platform,
    }))
}

/// DELETE /api/music/playlist/:index  (admin) — remove by 0-based index
pub async fn remove_song(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(idx): Path<i64>,
) -> ApiResult<serde_json::Value> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    // Fetch ids ordered by sort_order
    let ids: Vec<i64> = {
        let mut stmt = conn.prepare("SELECT id FROM music_playlist ORDER BY sort_order ASC, id ASC")
            .map_err(|e| AppError::internal(e.to_string()))?;
        let rows = stmt.query_map([], |r| r.get::<_, i64>(0)).map_err(|e| AppError::internal(e.to_string()))?;
        rows.filter_map(|r| r.ok()).collect()
    };
    if idx < 0 || idx as usize >= ids.len() {
        return Err(AppError::bad_request("index out of range"));
    }
    let target = ids[idx as usize];
    conn.execute("DELETE FROM music_playlist WHERE id=?1", params![target])
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

/// PUT /api/music/api-base  (admin)
pub async fn set_api_base(
    State(db): State<Db>,
    headers: HeaderMap,
    Json(input): Json<MusicApiBaseInput>,
) -> ApiResult<serde_json::Value> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let clean = input.api_base.trim().trim_end_matches('/').to_string();
    if !(clean.starts_with("http://") || clean.starts_with("https://")) {
        return Err(AppError::bad_request("invalid url"));
    }
    let conn = db.lock().unwrap();
    conn.execute("UPDATE music_config SET api_base=?1 WHERE id=1", params![clean])
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "apiBase": clean })))
}
