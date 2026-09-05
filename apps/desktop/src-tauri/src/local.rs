/* ------------------------------------------------------------------ *
 * local file access for the desktop shell
 *
 * The web view speaks the LocalFsBridge contract (apps/web/lib/local/bridge.ts):
 * root-relative posix paths, entries shaped like LocalEntry, a scan shaped like
 * LocalScan. This module is the half that touches the disk. Two rules hold for
 * every operation:
 *   - the resolved path is canonicalised and must stay inside the canonical
 *     granted root, so a symlink pointing outside is rejected, not followed;
 *   - nothing absolute leaves this module except the one path the asset
 *     protocol needs (`local_stream_url`), which the web view only hands back
 *     to convertFileSrc.
 * The granted root itself is remembered in a small json file in the app data
 * directory, so the choice survives a restart.
 * ------------------------------------------------------------------ */

use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

/// how many entries a scan looks at before it reports `truncated`
pub const SCAN_LIMIT: usize = 5000;

/// the file in the app data directory that remembers the granted root
const ROOT_FILE: &str = "local-root.json";

/// what `byExtension` uses for files without an extension (same as the web bridge)
const NO_EXTENSION: &str = "—";

pub type LocalResult<T> = Result<T, String>;

/* ------------------------------ shapes ------------------------------ */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEntry {
    /// root-relative posix path, "" for the root itself
    pub path: String,
    pub name: String,
    /// "file" or "directory"
    pub kind: &'static str,
    pub size: u64,
    /// unix ms, 0 when unknown
    pub modified_at: i64,
    pub content_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalScan {
    pub root: String,
    pub files: u64,
    pub directories: u64,
    pub bytes: u64,
    pub by_extension: HashMap<String, u64>,
    pub truncated: bool,
}

/* ------------------------- the remembered root ------------------------- */

#[derive(Serialize, Deserialize, Default)]
struct RootFile {
    root: Option<String>,
}

fn root_file(dir: &Path) -> PathBuf {
    dir.join(ROOT_FILE)
}

/// the remembered root, or None when nothing was granted (or the file is unreadable)
pub fn read_root(dir: &Path) -> Option<PathBuf> {
    let raw = fs::read_to_string(root_file(dir)).ok()?;
    let parsed: RootFile = serde_json::from_str(&raw).ok()?;
    let root = parsed.root?;
    if root.is_empty() {
        return None;
    }
    Some(PathBuf::from(root))
}

pub fn write_root(dir: &Path, root: &Path) -> LocalResult<()> {
    fs::create_dir_all(dir).map_err(|error| format!("app data directory: {error}"))?;
    let body = serde_json::to_string_pretty(&RootFile {
        root: Some(root.to_string_lossy().to_string()),
    })
    .map_err(|error| error.to_string())?;
    fs::write(root_file(dir), body).map_err(|error| format!("remember the folder: {error}"))
}

pub fn clear_root(dir: &Path) -> LocalResult<()> {
    match fs::remove_file(root_file(dir)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("forget the folder: {error}")),
    }
}

/// what the permission screen shows: the folder name, or the whole path for a drive root
pub fn display_name(path: &Path) -> String {
    match path.file_name() {
        Some(name) => name.to_string_lossy().to_string(),
        None => path.to_string_lossy().to_string(),
    }
}

/* ---------------------------- path handling ---------------------------- */

/// split a root-relative posix path into safe segments, mirroring
/// `normalizeRelative` in apps/web/lib/local/paths.ts
fn relative_parts(path: &str) -> LocalResult<Vec<String>> {
    let mut parts: Vec<String> = Vec::new();
    for raw in path.replace('\\', "/").split('/') {
        match raw {
            "" | "." => continue,
            ".." => {
                if parts.pop().is_none() {
                    return Err("path escapes the root".to_string());
                }
            }
            segment => {
                // a drive letter, an NTFS alternate stream or a control character
                // would all reach outside the folder the user picked
                if segment.contains(':') || segment.chars().any(|c| c.is_control()) {
                    return Err("path contains a forbidden character".to_string());
                }
                parts.push(segment.to_string());
            }
        }
    }
    Ok(parts)
}

fn canonical_root(root: &Path) -> LocalResult<PathBuf> {
    fs::canonicalize(root).map_err(|error| format!("the granted folder is unavailable: {error}"))
}

/// resolve a path that must already exist; the real target has to stay inside the root
pub fn resolve_existing(root: &Path, path: &str) -> LocalResult<PathBuf> {
    let base = canonical_root(root)?;
    let mut target = base.clone();
    for part in relative_parts(path)? {
        target.push(part);
    }
    let real = fs::canonicalize(&target).map_err(|error| format!("{path}: {error}"))?;
    if !real.starts_with(&base) {
        return Err("path escapes the granted folder".to_string());
    }
    Ok(real)
}

/// resolve a path that may not exist yet (a write, a mkdir, a move target).
/// The deepest existing ancestor is canonicalised, so a symlinked parent that
/// points outside the root is caught before anything is created.
pub fn resolve_new(root: &Path, path: &str) -> LocalResult<PathBuf> {
    let base = canonical_root(root)?;
    let parts = relative_parts(path)?;
    if parts.is_empty() {
        return Err("path is empty".to_string());
    }
    let mut target = base.clone();
    for part in &parts {
        target.push(part);
    }

    let mut probe = target.clone();
    loop {
        if probe.exists() {
            let real = fs::canonicalize(&probe).map_err(|error| format!("{path}: {error}"))?;
            if !real.starts_with(&base) {
                return Err("path escapes the granted folder".to_string());
            }
            return Ok(target);
        }
        match probe.parent() {
            // the walk up always meets the root, which exists
            Some(parent) if parent.starts_with(&base) => probe = parent.to_path_buf(),
            _ => return Err("path escapes the granted folder".to_string()),
        }
    }
}

/// join a root-relative parent with a child name, posix style
fn join_relative(parent: &str, name: &str) -> String {
    if parent.is_empty() {
        name.to_string()
    } else {
        format!("{parent}/{name}")
    }
}

/// lower-case extension without the dot, "" when there is none
/// (`extensionOf` in apps/web/lib/media/kinds.ts: a leading dot is not one)
fn extension_of(name: &str) -> String {
    match name.rfind('.') {
        Some(dot) if dot > 0 => name[dot + 1..].to_lowercase(),
        _ => String::new(),
    }
}

fn content_type_of(name: &str) -> String {
    mime_guess::from_path(name)
        .first_raw()
        .unwrap_or("application/octet-stream")
        .to_string()
}

/* ------------------------------ entries ------------------------------ */

fn modified_ms(meta: &fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|since| since.as_millis() as i64)
        .unwrap_or(0)
}

/// describe one entry; `path` is root-relative and `name` falls back to the
/// folder name for the root itself, where the relative path is empty
pub fn entry_of(absolute: &Path, path: &str) -> LocalResult<LocalEntry> {
    let meta = fs::metadata(absolute).map_err(|error| format!("{path}: {error}"))?;
    let name = if path.is_empty() {
        display_name(absolute)
    } else {
        path.rsplit('/').next().unwrap_or(path).to_string()
    };
    if meta.is_dir() {
        // directories carry no size and no type, exactly like the web bridge
        return Ok(LocalEntry {
            path: path.to_string(),
            name,
            kind: "directory",
            size: 0,
            modified_at: 0,
            content_type: String::new(),
        });
    }
    Ok(LocalEntry {
        path: path.to_string(),
        name: name.clone(),
        kind: "file",
        size: meta.len(),
        modified_at: modified_ms(&meta),
        content_type: content_type_of(&name),
    })
}

/* ----------------------------- operations ----------------------------- */

pub fn scan(root: &Path, max_entries: Option<usize>) -> LocalResult<LocalScan> {
    let base = canonical_root(root)?;
    let limit = max_entries.unwrap_or(SCAN_LIMIT);
    let mut result = LocalScan {
        root: display_name(&base),
        files: 0,
        directories: 0,
        bytes: 0,
        by_extension: HashMap::new(),
        truncated: false,
    };

    let mut seen = 0usize;
    // symlinks are counted, never followed: a link out of the folder must not
    // pull the rest of the disk into the summary
    for entry in WalkDir::new(&base).min_depth(1).follow_links(false) {
        let Ok(entry) = entry else { continue };
        seen += 1;
        if seen > limit {
            result.truncated = true;
            return Ok(result);
        }
        if entry.file_type().is_dir() {
            result.directories += 1;
            continue;
        }
        result.files += 1;
        if let Ok(meta) = entry.metadata() {
            result.bytes += meta.len();
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let extension = extension_of(&name);
        let key = if extension.is_empty() { NO_EXTENSION.to_string() } else { extension };
        *result.by_extension.entry(key).or_insert(0) += 1;
    }
    Ok(result)
}

pub fn list(root: &Path, path: &str) -> LocalResult<Vec<LocalEntry>> {
    let directory = resolve_existing(root, path)?;
    let parent = relative_parts(path)?.join("/");
    let mut entries: Vec<LocalEntry> = Vec::new();
    for child in fs::read_dir(&directory).map_err(|error| format!("{path}: {error}"))? {
        let Ok(child) = child else { continue };
        let name = child.file_name().to_string_lossy().to_string();
        let relative = join_relative(&parent, &name);
        if let Ok(entry) = entry_of(&child.path(), &relative) {
            entries.push(entry);
        }
    }
    // directories first, then by name — the order the file manager expects
    entries.sort_by(|a, b| {
        if a.kind != b.kind {
            return if a.kind == "directory" { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    Ok(entries)
}

pub fn stat(root: &Path, path: &str) -> LocalResult<Option<LocalEntry>> {
    let relative = relative_parts(path)?.join("/");
    match resolve_existing(root, path) {
        Ok(absolute) => Ok(entry_of(&absolute, &relative).ok()),
        Err(_) => Ok(None),
    }
}

pub fn read(root: &Path, path: &str, max_bytes: Option<u64>) -> LocalResult<Vec<u8>> {
    let absolute = resolve_existing(root, path)?;
    let meta = fs::metadata(&absolute).map_err(|error| format!("{path}: {error}"))?;
    if meta.is_dir() {
        return Err(format!("{path} is a directory"));
    }
    let file = fs::File::open(&absolute).map_err(|error| format!("{path}: {error}"))?;
    let cap = max_bytes.unwrap_or(meta.len()).min(meta.len());
    let mut bytes = Vec::with_capacity(cap as usize);
    file.take(cap).read_to_end(&mut bytes).map_err(|error| format!("{path}: {error}"))?;
    Ok(bytes)
}

/// the absolute path the asset protocol streams from; the only absolute path
/// that reaches the web view, and only to be passed to convertFileSrc
pub fn stream_path(root: &Path, path: &str) -> LocalResult<Option<String>> {
    match resolve_existing(root, path) {
        Ok(absolute) if absolute.is_file() => Ok(Some(absolute.to_string_lossy().to_string())),
        _ => Ok(None),
    }
}

pub fn write(root: &Path, path: &str, content: &[u8]) -> LocalResult<LocalEntry> {
    let absolute = resolve_new(root, path)?;
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("{path}: {error}"))?;
    }
    fs::write(&absolute, content).map_err(|error| format!("{path}: {error}"))?;
    entry_of(&absolute, &relative_parts(path)?.join("/"))
}

pub fn mkdir(root: &Path, path: &str) -> LocalResult<LocalEntry> {
    let absolute = resolve_new(root, path)?;
    fs::create_dir_all(&absolute).map_err(|error| format!("{path}: {error}"))?;
    entry_of(&absolute, &relative_parts(path)?.join("/"))
}

pub fn move_entry(root: &Path, from: &str, to: &str) -> LocalResult<LocalEntry> {
    let source = resolve_existing(root, from)?;
    let target = resolve_new(root, to)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("{to}: {error}"))?;
    }
    if fs::rename(&source, &target).is_err() {
        // a different volume: copy then drop the original
        if source.is_dir() {
            return Err(format!("{from}: cannot move a folder across volumes"));
        }
        fs::copy(&source, &target).map_err(|error| format!("{to}: {error}"))?;
        fs::remove_file(&source).map_err(|error| format!("{from}: {error}"))?;
    }
    entry_of(&target, &relative_parts(to)?.join("/"))
}

pub fn remove(root: &Path, path: &str) -> LocalResult<()> {
    let absolute = resolve_existing(root, path)?;
    if absolute == canonical_root(root)? {
        return Err("the granted folder itself cannot be removed".to_string());
    }
    if absolute.is_dir() {
        fs::remove_dir_all(&absolute).map_err(|error| format!("{path}: {error}"))
    } else {
        fs::remove_file(&absolute).map_err(|error| format!("{path}: {error}"))
    }
}

/* ------------------------------- tests ------------------------------- */

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("screenkit-local-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("nested")).unwrap();
        fs::write(dir.join("nested/note.txt"), b"hello").unwrap();
        dir
    }

    #[test]
    fn relative_parts_rejects_escapes() {
        assert!(relative_parts("../secrets").is_err());
        assert!(relative_parts("a/../../secrets").is_err());
        assert!(relative_parts("C:/windows").is_err());
        assert_eq!(relative_parts("a/./b").unwrap(), vec!["a", "b"]);
        assert_eq!(relative_parts("a/b/../c").unwrap(), vec!["a", "c"]);
    }

    #[test]
    fn resolve_stays_inside_the_root() {
        let root = temp_root("resolve");
        assert!(resolve_existing(&root, "nested/note.txt").is_ok());
        assert!(resolve_existing(&root, "../").is_err());
        assert!(resolve_new(&root, "nested/new.txt").is_ok());
        assert!(resolve_new(&root, "").is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn resolve_rejects_a_symlink_out_of_the_root() {
        let root = temp_root("symlink");
        let outside = std::env::temp_dir().join("screenkit-local-outside.txt");
        fs::write(&outside, b"secret").unwrap();
        std::os::unix::fs::symlink(&outside, root.join("escape.txt")).unwrap();
        assert!(resolve_existing(&root, "escape.txt").is_err());
        let _ = fs::remove_file(&outside);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn scan_counts_files_and_extensions() {
        let root = temp_root("scan");
        let summary = scan(&root, None).unwrap();
        assert_eq!(summary.files, 1);
        assert_eq!(summary.directories, 1);
        assert_eq!(summary.bytes, 5);
        assert_eq!(summary.by_extension.get("txt"), Some(&1));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn read_honours_max_bytes() {
        let root = temp_root("read");
        assert_eq!(read(&root, "nested/note.txt", Some(2)).unwrap(), b"he");
        assert_eq!(read(&root, "nested/note.txt", None).unwrap(), b"hello");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn extension_of_ignores_a_leading_dot() {
        assert_eq!(extension_of(".gitignore"), "");
        assert_eq!(extension_of("frame.PNG"), "png");
        assert_eq!(extension_of("noext"), "");
    }
}
