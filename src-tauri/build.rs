fn main() {
    // Declaring the app's commands generates one `allow-<command>` permission per
    // command. Commands are then only callable from windows whose capability
    // explicitly lists them (see capabilities/default.json).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "secret_get",
            "secret_set",
            "secret_delete",
            "oauth_listen",
            "export_save",
            "export_open_folder",
            "check_for_update",
            "install_update",
            "open_download_page",
        ]),
    ))
    .expect("failed to run tauri-build");
}
