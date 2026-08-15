//! Minimal admin auth: a fixed session token stored in-memory.
//! The frontend continues to set `localStorage.isAdmin = 'true'` after login,
//! mirroring the original behaviour. Each mutating request must send
//! `Authorization: Bearer <token>`.

use std::sync::Mutex;
use once_cell::sync::Lazy;

static TOKEN: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new(String::new()));

pub fn set_token(t: String) {
    *TOKEN.lock().unwrap() = t;
}

pub fn current_token() -> String {
    TOKEN.lock().unwrap().clone()
}

/// Validate `Authorization: Bearer <token>` header.
pub fn is_authorized(header: Option<&str>) -> bool {
    let Some(h) = header else { return false; };
    let t = h.trim();
    if let Some(rest) = t.strip_prefix("Bearer ") {
        let cur = current_token();
        return !cur.is_empty() && rest.trim() == cur;
    }
    false
}

/// Generate a weak-but-sufficient token (timestamp + random suffix).
pub fn generate_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{:x}{:x}", now.as_millis(), now.subsec_nanos())
}
