//! Secrets (the workspace session, the Outlook calendar sign-in, older keys) live in the
//! OS credential store – Windows Credential Manager on Windows – never on disk.

const SERVICE: &str = "dk.bingadschat.app";

/// Only these names can be read or written from the web layer.
const ALLOWED: &[&str] = &[
    "app_session",
    "anthropic_api_key",
    "ms_refresh_token",
    "ms_graph_refresh_token",
    "ms_developer_token",
    "ms_client_secret",
    "google_api_key",
];

fn entry(name: &str) -> Result<keyring::Entry, String> {
    if !ALLOWED.contains(&name) {
        return Err(format!("unknown secret '{name}'"));
    }
    keyring::Entry::new(SERVICE, name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_get(name: String) -> Result<Option<String>, String> {
    match entry(&name)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secret_set(name: String, value: String) -> Result<(), String> {
    entry(&name)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_delete(name: String) -> Result<(), String> {
    match entry(&name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_names() {
        assert!(entry("something_else").is_err());
    }
}
