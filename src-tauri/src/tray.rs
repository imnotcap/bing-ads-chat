//! System tray: closing the window keeps Bing Ads Chat running in the background
//! (like Claude). The tray icon brings it back; "Afslut" quits for real.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Window, WindowEvent};

const TRAY_ID: &str = "main";

/// Whether closing the window hides it to the tray (setting in the app, default on).
pub struct CloseToTray(pub AtomicBool);

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    app.manage(CloseToTray(AtomicBool::new(true)));
    let open = MenuItem::with_id(app, "open", "Åbn Bing Ads Chat", true, None::<&str>)?;
    let new_chat = MenuItem::with_id(app, "new-chat", "Ny samtale", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Afslut", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &new_chat, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Bing Ads Chat")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "new-chat" => {
                show_main_window(app);
                let _ = app.emit("tray-action", "new-chat");
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Window close → hide to the tray instead of quitting (when the setting is on).
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let to_tray = window.app_handle().try_state::<CloseToTray>().map(|s| s.0.load(Ordering::Relaxed)).unwrap_or(false);
        if to_tray {
            api.prevent_close();
            let _ = window.hide();
            let _ = window.emit("hidden-to-tray", ());
        }
    }
}

#[tauri::command]
pub fn set_close_to_tray(app: AppHandle, enabled: bool) {
    if let Some(state) = app.try_state::<CloseToTray>() {
        state.0.store(enabled, Ordering::Relaxed);
    }
}

/// Quits the app for real (menu "Afslut").
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}
