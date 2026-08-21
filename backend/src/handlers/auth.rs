//! Admin login endpoint.

use axum::{extract::State, Json};
use rusqlite::params;

use crate::auth::{generate_token, set_token};
use crate::db::Db;
use crate::models::{AdminLoginInput, AdminLoginResponse, AppError, ApiResult};

/// POST /api/auth/login
pub async fn login(
    State(db): State<Db>,
    Json(input): Json<AdminLoginInput>,
) -> ApiResult<AdminLoginResponse> {
    let conn = db.lock().unwrap();
    let row: (String, String) = conn.query_row(
        "SELECT username, password FROM admin_user WHERE id=1", [], |r| {
            Ok((r.get(0)?, r.get(1)?))
        }).map_err(|e| AppError::internal(e.to_string()))?;
    let (u, p) = row;
    if input.username == u && input.password == p {
        let token = generate_token();
        set_token(token.clone());
        Ok(Json(AdminLoginResponse {
            success: true, token, message: "登录成功".into(),
        }))
    } else {
        Ok(Json(AdminLoginResponse {
            success: false, token: String::new(), message: "账号或密码错误".into(),
        }))
    }
}

/// POST /api/auth/logout
pub async fn logout() -> Json<serde_json::Value> {
    set_token(String::new());
    Json(serde_json::json!({ "ok": true }))
}

/// GET /api/auth/check
pub async fn check(headers: axum::http::HeaderMap) -> Json<serde_json::Value> {
    let authed = crate::auth::is_authorized(
        headers.get("authorization").and_then(|v| v.to_str().ok()),
    );
    Json(serde_json::json!({ "isAdmin": authed }))
}

/// PUT /api/auth/password  (admin) — change password
#[derive(serde::Deserialize)]
pub struct ChangePasswordInput {
    #[serde(rename = "newPassword")]
    pub new_password: String,
}

pub async fn change_password(
    State(db): State<Db>,
    headers: axum::http::HeaderMap,
    Json(input): Json<ChangePasswordInput>,
) -> ApiResult<serde_json::Value> {
    if !crate::auth::is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    conn.execute("UPDATE admin_user SET password=?1 WHERE id=1", params![input.new_password])
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

/// GET /api/auth/me  — 返回当前管理员用户名
pub async fn me(
    State(db): State<Db>,
    headers: axum::http::HeaderMap,
) -> ApiResult<serde_json::Value> {
    if !crate::auth::is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    let username: String = conn.query_row(
        "SELECT username FROM admin_user WHERE id=1", [], |r| r.get(0))
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "username": username })))
}

/// PUT /api/auth/username  (admin) — change username
#[derive(serde::Deserialize)]
pub struct ChangeUsernameInput {
    #[serde(rename = "newUsername")]
    pub new_username: String,
}

pub async fn change_username(
    State(db): State<Db>,
    headers: axum::http::HeaderMap,
    Json(input): Json<ChangeUsernameInput>,
) -> ApiResult<serde_json::Value> {
    if !crate::auth::is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let new_username = input.new_username.trim().to_string();
    if new_username.is_empty() {
        return Err(AppError::bad_request("用户名不能为空"));
    }
    let conn = db.lock().unwrap();
    conn.execute("UPDATE admin_user SET username=?1 WHERE id=1", params![new_username])
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "ok": true, "username": new_username })))
}
