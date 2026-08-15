//! Profile (singleton) endpoints — includes socials + legacy qq/wechat/github/email fields.

use axum::{extract::State, http::HeaderMap, Json};
use rusqlite::params;

use crate::auth::is_authorized;
use crate::db::Db;
use crate::logging::log_operation;
use crate::models::{AppError, ApiResult, Profile, SocialLink};

/// GET /api/profile
pub async fn get(State(db): State<Db>) -> ApiResult<Profile> {
    let conn = db.lock().unwrap();
    let (name, bio, avatar, about, socials_json, qq, wechat, github, email) = conn.query_row(
        "SELECT name, bio, avatar, about, socials, \
                COALESCE(qq,''), COALESCE(wechat,''), COALESCE(github,''), COALESCE(email,'') \
         FROM profile WHERE id=1",
        [],
        |r| Ok((
            r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, String>(5)?, r.get::<_, String>(6)?,
            r.get::<_, String>(7)?, r.get::<_, String>(8)?,
        )),
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let socials: Vec<SocialLink> = serde_json::from_str(&socials_json).unwrap_or_default();
    Ok(Json(Profile { name, bio, avatar, about, socials, qq, wechat, github, email }))
}

/// PUT /api/profile  (admin)
pub async fn update(
    State(db): State<Db>,
    headers: HeaderMap,
    Json(p): Json<Profile>,
) -> ApiResult<Profile> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let socials_json = serde_json::to_string(&p.socials).unwrap_or_else(|_| "[]".into());
    let conn = db.lock().unwrap();
    // Read before state (best-effort; None if row doesn't exist).
    let before: Option<Profile> = match conn.query_row(
        "SELECT name, bio, avatar, about, socials, \
                COALESCE(qq,''), COALESCE(wechat,''), COALESCE(github,''), COALESCE(email,'') \
         FROM profile WHERE id=1",
        [],
        |r| Ok((
            r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, String>(5)?, r.get::<_, String>(6)?,
            r.get::<_, String>(7)?, r.get::<_, String>(8)?,
        )),
    ) {
        Ok((name, bio, avatar, about, soc_json, qq, wechat, github, email)) => {
            let socials: Vec<SocialLink> = serde_json::from_str(&soc_json).unwrap_or_default();
            Some(Profile { name, bio, avatar, about, socials, qq, wechat, github, email })
        }
        Err(_) => None,
    };
    conn.execute(
        "UPDATE profile SET name=?1, bio=?2, avatar=?3, about=?4, socials=?5, \
                            qq=?6, wechat=?7, github=?8, email=?9 \
         WHERE id=1",
        params![
            p.name, p.bio, p.avatar, p.about, socials_json,
            p.qq, p.wechat, p.github, p.email,
        ],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    if let Some(b) = &before {
        log_operation(&conn, "update", "profile", Some("1".to_string()), Some(b), Some(&p));
    }
    Ok(Json(p))
}
