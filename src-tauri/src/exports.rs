//! Conversation exports: written to "Downloads/Bing Ads Chat" and shown in Explorer.

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

fn exports_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app.path().download_dir().map_err(|e| e.to_string())?.join("Bing Ads Chat");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Keeps file names to a safe, readable subset (no paths, no reserved characters).
fn safe_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || " -_.()æøåÆØÅ".contains(c) { c } else { '-' })
        .collect();
    let trimmed = cleaned.trim_matches(|c: char| c == '.' || c == ' ' || c == '-');
    let short: String = trimmed.chars().take(120).collect();
    if short.is_empty() { "eksport.md".into() } else { short }
}

/// Picks "name.md", "name (2).md", … so earlier exports are never overwritten.
fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = match name.rfind('.') {
        Some(i) => (&name[..i], &name[i..]),
        None => (name, ""),
    };
    (2..1000)
        .map(|n| dir.join(format!("{stem} ({n}){ext}")))
        .find(|p| !p.exists())
        .unwrap_or(first)
}

#[tauri::command]
pub fn export_save<R: Runtime>(app: AppHandle<R>, file_name: String, contents: String) -> Result<String, String> {
    let dir = exports_dir(&app)?;
    let path = unique_path(&dir, &safe_name(&file_name));
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// Opens the exports folder, optionally with one exported file selected.
#[tauri::command]
pub fn export_open_folder<R: Runtime>(app: AppHandle<R>, select: Option<String>) -> Result<(), String> {
    let dir = exports_dir(&app)?;
    // Only files inside the exports folder can be selected.
    let selected = select
        .map(PathBuf::from)
        .filter(|p| p.parent() == Some(dir.as_path()) && p.exists());
    reveal(&dir, selected.as_deref()).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn reveal(dir: &Path, file: Option<&Path>) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    let mut cmd = std::process::Command::new("explorer");
    match file {
        // Explorer wants the path quoted after the comma: /select,"C:\…\fil.md"
        Some(f) => cmd.raw_arg(format!("/select,\"{}\"", f.display())),
        None => cmd.arg(dir),
    };
    cmd.spawn().map(|_| ())
}

#[cfg(target_os = "macos")]
fn reveal(dir: &Path, file: Option<&Path>) -> std::io::Result<()> {
    let mut cmd = std::process::Command::new("open");
    match file {
        Some(f) => cmd.arg("-R").arg(f),
        None => cmd.arg(dir),
    };
    cmd.spawn().map(|_| ())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn reveal(dir: &Path, _file: Option<&Path>) -> std::io::Result<()> {
    std::process::Command::new("xdg-open").arg(dir).spawn().map(|_| ())
}
