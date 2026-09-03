fn main() {
    // re-run when the url baked into the binary changes, otherwise a rebuild
    // with a different MIXTURE_DESKTOP_URL would keep the cached option_env!
    println!("cargo:rerun-if-env-changed=MIXTURE_DESKTOP_URL");
    tauri_build::build()
}
