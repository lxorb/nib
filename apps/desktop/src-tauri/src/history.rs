use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// How many snapshots of one note are kept before the oldest is dropped.
const KEEP: usize = 40;

#[derive(Serialize)]
pub struct Snapshot {
    /// Milliseconds since the epoch, and also the file's name.
    taken_at: u64,
    size: u64,
    path: String,
}

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis() as u64)
        .unwrap_or(0)
}

/// A stable, filesystem-safe folder name for a note's full path.
fn key(note_path: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in note_path.to_lowercase().bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

fn history_root(app: &AppHandle, note_path: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("history")
        .join(key(note_path));

    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Keeps a copy of a note before it is overwritten, so a bad edit or a sync
/// conflict is never the end of the story.
#[tauri::command]
pub fn snapshot_note(app: AppHandle, path: String, content: String) -> Result<(), String> {
    if content.trim().is_empty() {
        return Ok(());
    }

    let dir = history_root(&app, &path)?;

    // Skip when nothing changed since the last snapshot.
    let mut existing = snapshot_files(&dir);
    if let Some(last) = existing.last() {
        if fs::read_to_string(last)
            .map(|body| body == content)
            .unwrap_or(false)
        {
            return Ok(());
        }
    }

    fs::write(dir.join(format!("{}.md", now())), &content).map_err(|e| e.to_string())?;

    existing = snapshot_files(&dir);
    if existing.len() > KEEP {
        for stale in &existing[..existing.len() - KEEP] {
            let _ = fs::remove_file(stale);
        }
    }

    // The note's own path is recorded so history can be listed by name later.
    let _ = fs::write(dir.join("origin.txt"), &path);
    Ok(())
}

fn snapshot_files(dir: &PathBuf) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.extension().and_then(|e| e.to_str()) == Some("md"))
                .collect()
        })
        .unwrap_or_default();

    files.sort();
    files
}

#[tauri::command]
pub fn list_snapshots(app: AppHandle, path: String) -> Result<Vec<Snapshot>, String> {
    let dir = history_root(&app, &path)?;

    let mut snapshots: Vec<Snapshot> = snapshot_files(&dir)
        .into_iter()
        .filter_map(|file| {
            let taken_at = file
                .file_stem()
                .and_then(|stem| stem.to_str())
                .and_then(|stem| stem.parse::<u64>().ok())?;

            Some(Snapshot {
                taken_at,
                size: fs::metadata(&file).map(|m| m.len()).unwrap_or(0),
                path: file.to_string_lossy().to_string(),
            })
        })
        .collect();

    snapshots.reverse();
    Ok(snapshots)
}

#[tauri::command]
pub fn read_snapshot(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::key;

    #[test]
    fn the_same_path_always_gets_the_same_folder() {
        assert_eq!(key("/notes/a.md"), key("/notes/a.md"));
    }

    #[test]
    fn different_paths_get_different_folders() {
        assert_ne!(key("/notes/a.md"), key("/notes/b.md"));
    }

    #[test]
    fn the_name_is_filesystem_safe() {
        assert!(key("C:\\notes\\a b.md")
            .chars()
            .all(|c| c.is_ascii_hexdigit()));
    }
}
