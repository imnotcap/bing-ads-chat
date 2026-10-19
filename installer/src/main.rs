//! XavierOS – installer.
//!
//! A step-by-step guide (ui/) in the app's own layout. The embedded, signed NSIS
//! installer does the actual work silently (`/S /D=<folder>`, per user, no admin
//! rights); this program only collects the choices and shows the progress.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

const PAYLOAD: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/payload.exe"));
const PRODUCT: &str = "XavierOS";
const APP_EXE: &str = "XavierOS.exe";
const UNINSTALL_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\XavierOS";

#[cfg(windows)]
fn hidden(cmd: &mut Command) -> &mut Command {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000) // CREATE_NO_WINDOW – no console flash
}
#[cfg(not(windows))]
fn hidden(cmd: &mut Command) -> &mut Command {
    cmd
}

/// Reads a value of the app's uninstall key (written by the NSIS installer).
fn registry_value(name: &str) -> Option<String> {
    let out = hidden(Command::new("reg").args(["query", UNINSTALL_KEY, "/v", name])).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let line = text.lines().find(|l| l.trim_start().starts_with(name))?;
    let value = line.split("REG_SZ").nth(1)?.trim().trim_matches('"').to_string();
    (!value.is_empty()).then_some(value)
}

fn default_dir() -> PathBuf {
    std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join(PRODUCT)
}

/// Folder of an existing installation (from the uninstall key's DisplayIcon).
fn installed_dir() -> Option<PathBuf> {
    let icon = registry_value("DisplayIcon")?;
    let dir = Path::new(&icon).parent()?.to_path_buf();
    dir.join(APP_EXE).exists().then_some(dir)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Info {
    version: String,
    installed_version: Option<String>,
    install_dir: String,
    /// Approximate size on disk after installation.
    size_mb: u64,
    has_payload: bool,
}

#[tauri::command]
fn info() -> Info {
    let existing = installed_dir();
    Info {
        version: option_env!("BAC_VERSION").unwrap_or("").to_string(),
        installed_version: existing.as_ref().and_then(|_| registry_value("DisplayVersion")),
        install_dir: existing.unwrap_or_else(default_dir).to_string_lossy().into_owned(),
        size_mb: ((PAYLOAD.len() as u64 * 3) / 1_048_576).max(1),
        has_payload: !PAYLOAD.is_empty(),
    }
}

/// Checks that the folder can be written by this user (per-user install, no admin).
#[tauri::command]
fn check_dir(dir: String) -> Result<(), String> {
    let path = PathBuf::from(dir.trim());
    if !path.is_absolute() {
        return Err("Vælg en fuld sti, fx C:\\Users\\dig\\AppData\\Local\\XavierOS.".into());
    }
    std::fs::create_dir_all(&path).map_err(|_| "Mappen kan ikke oprettes. Vælg en mappe, du har adgang til.".to_string())?;
    let probe = path.join(".bing-ads-chat-write-test");
    std::fs::write(&probe, b"ok").map_err(|_| "Du har ikke skriveadgang til mappen. Vælg en mappe under din egen bruger.".to_string())?;
    let _ = std::fs::remove_file(probe);
    Ok(())
}

fn step(app: &AppHandle, name: &str) {
    let _ = app.emit("install-step", name);
}

#[tauri::command]
async fn install(app: AppHandle, dir: String, desktop_shortcut: bool) -> Result<(), String> {
    if PAYLOAD.is_empty() {
        return Err("Denne installer indeholder ikke selve appen. Hent den nyeste fra download-siden.".into());
    }
    check_dir(dir.clone())?;
    // The app was called "Bing Ads Chat" before 0.3 – its desktop shortcut counts too
    // (the setup removes that installation and puts XavierOS in its place).
    let had_shortcut = app
        .path()
        .desktop_dir()
        .map(|d| d.join(format!("{PRODUCT}.lnk")).exists() || d.join("Bing Ads Chat.lnk").exists())
        .unwrap_or(false);

    step(&app, "extract");
    let temp = std::env::temp_dir().join(format!("bing-ads-chat-setup-{}", std::process::id()));
    std::fs::create_dir_all(&temp).map_err(|e| format!("Kunne ikke pakke ud: {e}"))?;
    let exe = temp.join("XavierOS-Setup.exe");
    std::fs::write(&exe, PAYLOAD).map_err(|e| format!("Kunne ikke pakke ud: {e}"))?;

    step(&app, "install");
    // `/D=` must be the last argument and is taken verbatim (no quotes) by NSIS.
    let target = dir.trim().to_string();
    let status = tauri::async_runtime::spawn_blocking(move || Command::new(exe).arg("/S").arg(format!("/D={target}")).status())
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("Installationen kunne ikke starte: {e}"))?;
    if !status.success() {
        let _ = std::fs::remove_dir_all(&temp);
        return Err(format!("Installationen fejlede (kode {}). Luk XavierOS, hvis den kører, og prøv igen.", status.code().unwrap_or(-1)));
    }

    step(&app, "shortcuts");
    // Silent NSIS always creates the desktop shortcut – remove it if it wasn't wanted.
    if !desktop_shortcut && !had_shortcut {
        if let Ok(desktop) = app.path().desktop_dir() {
            let _ = std::fs::remove_file(desktop.join(format!("{PRODUCT}.lnk")));
        }
    }

    step(&app, "cleanup");
    let _ = std::fs::remove_dir_all(&temp);
    step(&app, "done");
    Ok(())
}

#[tauri::command]
fn launch(app: AppHandle, dir: String) -> Result<(), String> {
    let exe = PathBuf::from(dir.trim()).join(APP_EXE);
    if !exe.exists() {
        return Err("Appen blev ikke fundet – åbn XavierOS fra Start-menuen.".into());
    }
    Command::new(exe).spawn().map_err(|e| e.to_string())?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![info, check_dir, install, launch, quit])
        .run(tauri::generate_context!())
        .expect("error while running the XavierOS installer");
}
