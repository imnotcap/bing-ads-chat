//! Opening animation: a transparent, frameless "splash" window plays the XavierOS logo
//! animation (splash.html) while the app loads behind it; then the main window appears.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{App, AppHandle, Manager};

use crate::tray::show_main_window;

struct SplashDone(AtomicBool);

pub fn init(app: &App) {
    app.manage(SplashDone(AtomicBool::new(false)));
    // If the animation never reports back (e.g. transparent windows unsupported), the
    // app appears anyway.
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(6));
        finish(&handle);
    });
}

/// Shows the main window and removes the splash (once).
pub fn finish(app: &AppHandle) {
    if app.state::<SplashDone>().0.swap(true, Ordering::SeqCst) {
        return;
    }
    show_main_window(app);
    if let Some(splash) = app.get_webview_window("splash") {
        // destroy, not close: closing is turned into "hide to tray" for the app's windows.
        let _ = splash.destroy();
    }
}

/// Called by splash.html when its animation has played.
#[tauri::command]
pub fn splash_finished(app: AppHandle) {
    finish(&app);
}
