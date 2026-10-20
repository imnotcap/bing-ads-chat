//! Signed in-app updates (tauri-plugin-updater) – same setup as Inventarland.
//!
//! The updater is only active when the build contains an updater configuration
//! (public key + endpoint). Development and test builds don't, so they never
//! contact the update server. Release builds add it via
//! `tauri.release.conf.json` – see docs/RELEASE.md.

use serde::Serialize;
use tauri::{App, AppHandle, Emitter, Manager};

pub struct UpdaterEnabled(pub bool);

pub fn init(app: &mut App) -> tauri::Result<()> {
    let configured = app.config().plugins.0.contains_key("updater");
    #[cfg(desktop)]
    if configured {
        app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
    }
    app.manage(UpdaterEnabled(configured));
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub configured: bool,
    pub available: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub notes: Option<String>,
}

fn enabled(app: &AppHandle) -> bool {
    app.try_state::<UpdaterEnabled>().map(|s| s.0).unwrap_or(false)
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<UpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    if !enabled(&app) {
        return Ok(UpdateInfo { configured: false, available: false, current_version, version: None, notes: None });
    }
    #[cfg(desktop)]
    {
        use tauri_plugin_updater::UpdaterExt;
        let update = app
            .updater()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|_| "Opdateringsserveren kunne ikke kontaktes.".to_string())?;
        return Ok(UpdateInfo {
            configured: true,
            available: update.is_some(),
            current_version,
            version: update.as_ref().map(|u| u.version.clone()),
            notes: update.and_then(|u| u.body),
        });
    }
    #[allow(unreachable_code)]
    Ok(UpdateInfo { configured: false, available: false, current_version, version: None, notes: None })
}

/// Payload of the `update-progress` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProgress {
    stage: &'static str,
    downloaded: u64,
    total: Option<u64>,
    finished: bool,
}

/// Downloads, verifies (signature) and installs the update, then restarts.
/// On Windows the NSIS installer closes the app, installs and starts it again.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    if !enabled(&app) {
        return Err("Automatiske opdateringer er ikke slået til i denne version.".into());
    }
    #[cfg(desktop)]
    {
        use tauri_plugin_updater::UpdaterExt;

        let update = app
            .updater()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|_| "Opdateringsserveren kunne ikke kontaktes. Tjek internetforbindelsen og prøv igen.".to_string())?;
        let Some(update) = update else { return Ok(()) };

        let mut downloaded: u64 = 0;
        let progress_app = app.clone();
        let bytes = update
            .download(
                move |chunk, total| {
                    downloaded += chunk as u64;
                    let _ = progress_app.emit(
                        "update-progress",
                        UpdateProgress { stage: "download", downloaded, total, finished: false },
                    );
                },
                || {},
            )
            .await
            .map_err(|e| {
                let detail = e.to_string();
                if detail.to_lowercase().contains("signature") {
                    "Opdateringens signatur kunne ikke bekræftes, så den installeres ikke af sikkerhedshensyn.".to_string()
                } else {
                    format!("Opdateringen kunne ikke hentes ({detail}). Tjek internetforbindelsen og prøv igen.")
                }
            })?;

        let _ = app.emit(
            "update-progress",
            UpdateProgress { stage: "install", downloaded: bytes.len() as u64, total: None, finished: true },
        );
        tauri::async_runtime::spawn_blocking(move || update.install(bytes))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| format!("Opdateringen kunne ikke installeres ({e})."))?;
        app.restart();
    }
    #[allow(unreachable_code)]
    Ok(())
}

/// Opens the download page (manual install fallback). The address is compiled in.
#[tauri::command]
pub fn open_download_page(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let Some(url) = option_env!("BING_ADS_CHAT_SITE_URL") else {
        return Err("Download-siden er ikke sat op i denne version.".into());
    };
    let page = format!("{}/download", url.trim_end_matches('/'));
    app.opener().open_url(page, None::<&str>).map_err(|e| e.to_string())
}
