//! Bing Ads Chat – themed installer.
//!
//! Shows its own window (ui/) and runs the embedded NSIS installer silently
//! (`/S`, per-user install, no admin rights), then starts the app.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

const PAYLOAD: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/payload.exe"));
const APP_DIR: &str = "Bing Ads Chat";
const APP_EXE: &str = "BingAdsChat.exe";

/// Per-user install location of the NSIS installer (`installMode: currentUser`).
fn app_exe() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|p| PathBuf::from(p).join(APP_DIR).join(APP_EXE))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Info {
    version: String,
    installed: bool,
    has_payload: bool,
}

#[tauri::command]
fn info() -> Info {
    Info {
        version: option_env!("BAC_VERSION").unwrap_or("").to_string(),
        installed: app_exe().map(|p| p.exists()).unwrap_or(false),
        has_payload: !PAYLOAD.is_empty(),
    }
}

/// Extracts and runs the NSIS installer; emits `install-step` (extract → install → done).
#[tauri::command]
async fn install(app: AppHandle) -> Result<(), String> {
    if PAYLOAD.is_empty() {
        return Err("Denne installer indeholder ikke selve appen. Hent den nyeste fra download-siden.".into());
    }
    let _ = app.emit("install-step", "extract");
    let dir = std::env::temp_dir().join(format!("bing-ads-chat-setup-{}", std::process::id()));
    std::fs::create_dir_all(&dir).map_err(|e| format!("Kunne ikke pakke ud: {e}"))?;
    let exe = dir.join("Bing-Ads-Chat-Setup.exe");
    std::fs::write(&exe, PAYLOAD).map_err(|e| format!("Kunne ikke pakke ud: {e}"))?;

    let _ = app.emit("install-step", "install");
    let status = tauri::async_runtime::spawn_blocking(move || std::process::Command::new(exe).arg("/S").status())
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("Installationen kunne ikke starte: {e}"))?;
    let _ = std::fs::remove_dir_all(&dir);
    if !status.success() {
        return Err(format!("Installationen fejlede (kode {}). Luk Bing Ads Chat, hvis den kører, og prøv igen.", status.code().unwrap_or(-1)));
    }
    let _ = app.emit("install-step", "done");
    Ok(())
}

#[tauri::command]
fn launch(app: AppHandle) -> Result<(), String> {
    let exe = app_exe().filter(|p| p.exists()).ok_or("Appen blev ikke fundet – åbn Bing Ads Chat fra Start-menuen.")?;
    std::process::Command::new(exe).spawn().map_err(|e| e.to_string())?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![info, install, launch, quit])
        .run(tauri::generate_context!())
        .expect("error while running the Bing Ads Chat installer");
}
