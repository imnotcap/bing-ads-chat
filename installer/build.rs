use std::path::PathBuf;

fn main() {
    // Embed the NSIS installer built by `tauri build` (CI sets BAC_SETUP_PAYLOAD).
    // Without it the payload is empty and the installer explains that.
    println!("cargo:rerun-if-env-changed=BAC_SETUP_PAYLOAD");
    println!("cargo:rerun-if-env-changed=BAC_VERSION");
    let out = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("payload.exe");
    match std::env::var("BAC_SETUP_PAYLOAD") {
        Ok(path) if !path.is_empty() => {
            println!("cargo:rerun-if-changed={path}");
            std::fs::copy(&path, &out).unwrap_or_else(|e| panic!("cannot read installer payload {path}: {e}"));
        }
        _ => std::fs::write(&out, []).unwrap(),
    }
    tauri_build::build();
}
