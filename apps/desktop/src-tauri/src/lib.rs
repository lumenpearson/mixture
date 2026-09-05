/* ------------------------------------------------------------------ *
 * mixture · screenkit — the windows desktop shell
 *
 * The shell is a local application, not a browser pointed at the site. The
 * interface is a static export of apps/web that ships inside the bundle
 * (`frontendDist` in tauri.conf.json, produced by `pnpm --filter web
 * build:desktop`), so the window opens with no network at all; only the
 * business operations — the library, the changelog, the cloud drive — go out
 * to the deployment over rpc. `tauri dev` still loads `devUrl`, which is what
 * `WebviewUrl::default()` resolves to in a debug build.
 *
 * The window is frameless: `decorations(false)` plus the title bar the web
 * side draws (apps/web/components/screenkit/desktop/titlebar.tsx). Windows
 * keeps its resize borders and snapping on an undecorated window as long as
 * it stays resizable, which is why `resizable(true)` is spelled out here.
 *
 * The commands below are the desktop half of LocalFsBridge
 * (apps/web/lib/local/bridge.ts): their names are exactly TAURI_COMMANDS and
 * their payloads are the camelCase argument names the browser bridge sends.
 * Everything they touch is checked against the granted root in local.rs.
 * ------------------------------------------------------------------ */

mod local;

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_window_state::StateFlags;

use local::{LocalEntry, LocalResult, LocalScan};

const WINDOW_LABEL: &str = "main";
const WINDOW_TITLE: &str = "mixture · screenkit";

/// what the window-state plugin remembers.
///
/// Deliberately not `StateFlags::all()`: DECORATIONS would restore the system
/// frame this build exists to remove, and VISIBLE / FULLSCREEN are not what
/// the "remember size and position" setting promises.
const REMEMBERED_STATE: StateFlags = StateFlags::SIZE
    .union(StateFlags::POSITION)
    .union(StateFlags::MAXIMIZED);

/* ------------------------- the granted root ------------------------- */

fn store_dir(app: &AppHandle) -> LocalResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app data directory: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("app data directory: {error}"))?;
    Ok(dir)
}

fn granted_root(app: &AppHandle) -> LocalResult<PathBuf> {
    let dir = store_dir(app)?;
    local::read_root(&dir).ok_or_else(|| "no local folder granted".to_string())
}

/// let the asset protocol stream from the granted folder; the static scope in
/// tauri.conf.json is empty because the folder is only known at runtime
fn allow_asset_access(app: &AppHandle, root: &std::path::Path) {
    if let Err(error) = app.asset_protocol_scope().allow_directory(root, true) {
        eprintln!("asset protocol scope: {error}");
    }
}

/* ---------------------------- the commands ---------------------------- */

#[tauri::command(rename_all = "camelCase")]
async fn local_permission(app: AppHandle) -> LocalResult<&'static str> {
    let Ok(root) = granted_root(&app) else {
        return Ok("prompt");
    };
    // remembered but gone (an unplugged drive, a renamed folder) asks again
    if fs::read_dir(&root).is_err() {
        return Ok("prompt");
    }
    allow_asset_access(&app, &root);
    Ok("granted")
}

#[tauri::command(rename_all = "camelCase")]
async fn local_request_root(app: AppHandle) -> LocalResult<Option<String>> {
    let Some(picked) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|error| error.to_string())?;
    let root = fs::canonicalize(&path).map_err(|error| format!("{}: {error}", path.display()))?;
    if fs::read_dir(&root).is_err() {
        return Err("the chosen folder cannot be read".to_string());
    }
    local::write_root(&store_dir(&app)?, &root)?;
    allow_asset_access(&app, &root);
    Ok(Some(local::display_name(&root)))
}

#[tauri::command(rename_all = "camelCase")]
async fn local_forget_root(app: AppHandle) -> LocalResult<()> {
    local::clear_root(&store_dir(&app)?)
}

#[tauri::command(rename_all = "camelCase")]
async fn local_root_name(app: AppHandle) -> LocalResult<Option<String>> {
    Ok(granted_root(&app).ok().map(|root| local::display_name(&root)))
}

#[tauri::command(rename_all = "camelCase")]
async fn local_scan(app: AppHandle, max_entries: Option<usize>) -> LocalResult<LocalScan> {
    local::scan(&granted_root(&app)?, max_entries)
}

#[tauri::command(rename_all = "camelCase")]
async fn local_list(app: AppHandle, path: String) -> LocalResult<Vec<LocalEntry>> {
    local::list(&granted_root(&app)?, &path)
}

#[tauri::command(rename_all = "camelCase")]
async fn local_stat(app: AppHandle, path: String) -> LocalResult<Option<LocalEntry>> {
    local::stat(&granted_root(&app)?, &path)
}

/// the bytes travel as a raw ipc response instead of a json array of numbers,
/// which is what makes opening a video in the preview bearable
#[tauri::command(rename_all = "camelCase")]
async fn local_read(
    app: AppHandle,
    path: String,
    max_bytes: Option<u64>,
) -> LocalResult<tauri::ipc::Response> {
    let bytes = local::read(&granted_root(&app)?, &path, max_bytes)?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command(rename_all = "camelCase")]
async fn local_stream_url(app: AppHandle, path: String) -> LocalResult<Option<String>> {
    let root = granted_root(&app)?;
    allow_asset_access(&app, &root);
    local::stream_path(&root, &path)
}

#[tauri::command(rename_all = "camelCase")]
async fn local_write(app: AppHandle, path: String, content: Vec<u8>) -> LocalResult<LocalEntry> {
    local::write(&granted_root(&app)?, &path, &content)
}

#[tauri::command(rename_all = "camelCase")]
async fn local_mkdir(app: AppHandle, path: String) -> LocalResult<LocalEntry> {
    local::mkdir(&granted_root(&app)?, &path)
}

#[tauri::command(rename_all = "camelCase")]
async fn local_move(app: AppHandle, from: String, to: String) -> LocalResult<LocalEntry> {
    local::move_entry(&granted_root(&app)?, &from, &to)
}

#[tauri::command(rename_all = "camelCase")]
async fn local_remove(app: AppHandle, path: String) -> LocalResult<()> {
    local::remove(&granted_root(&app)?, &path)
}

/* ------------------------------- the app ------------------------------- */

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // the plugin owns the window geometry: it tracks and saves size,
        // position and maximized state on its own, next to the app data.
        // Restoring is not automatic — `skip_initial_state` hands that
        // decision to the "remember size and position" setting, which calls
        // `plugin:window-state|restore_state` from use-window.ts. Without the
        // skip the plugin would restore before the page loads and the setting
        // would be a switch that changes nothing.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(REMEMBERED_STATE)
                .skip_initial_state(WINDOW_LABEL)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            local_permission,
            local_request_root,
            local_forget_root,
            local_root_name,
            local_scan,
            local_list,
            local_stat,
            local_read,
            local_stream_url,
            local_write,
            local_mkdir,
            local_move,
            local_remove,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Ok(root) = granted_root(&handle) {
                allow_asset_access(&handle, &root);
            }
            // the window is built here rather than in tauri.conf.json so the
            // asset-protocol grant above is in place before the page loads.
            // `WebviewUrl::default()` is the bundled index.html in a release
            // build and `devUrl` under `tauri dev`.
            WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::default())
                .title(WINDOW_TITLE)
                .inner_size(1280.0, 800.0)
                .min_inner_size(720.0, 560.0)
                // no system frame: the title bar is drawn by the page, and a
                // resizable undecorated window keeps the Windows resize
                // borders, snapping and the Aero shake
                .decorations(false)
                .resizable(true)
                .center()
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("mixture · screenkit failed to start");
}
