mod exports;
mod oauth;
mod secrets;
mod splash;
mod tray;
mod updater;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // A second launch focuses the running window instead of opening another one.
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                splash::finish(app);
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.unminimize();
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }))
            // Remember size and position – but never the window decorations: the app draws
            // its own title bar, and an old saved state must not bring Windows' back.
            .plugin(
                tauri_plugin_window_state::Builder::new()
                    .with_denylist(&["splash"])
                    .with_state_flags(
                        tauri_plugin_window_state::StateFlags::all()
                            - tauri_plugin_window_state::StateFlags::DECORATIONS
                            - tauri_plugin_window_state::StateFlags::VISIBLE,
                    )
                    .build(),
            );
    }

    builder
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // The custom title bar replaces Windows' own – make sure it stays hidden.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_decorations(false);
            }
            splash::init(app);
            updater::init(app)?;
            tray::create(app.handle())?;
            Ok(())
        })
        .on_window_event(tray::on_window_event)
        .invoke_handler(tauri::generate_handler![
            exports::export_save,
            exports::export_open_folder,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
            oauth::oauth_listen,
            oauth::oauth_token,
            tray::set_close_to_tray,
            tray::quit_app,
            splash::splash_finished,
            updater::check_for_update,
            updater::install_update,
            updater::open_download_page,
        ])
        .run(tauri::generate_context!())
        .expect("error while running XavierOS");
}
