use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const MARKDOWN_EXTENSIONS: [&str; 4] = ["md", "markdown", "mdown", "mkd"];

#[derive(Serialize)]
pub struct Entry {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<Entry>,
}

#[tauri::command]
pub fn read_note(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Writes atomically: a sibling temp file is flushed, then renamed over the target,
/// so a crash mid-write can never truncate an existing note. Missing folders are
/// created, which is what lets sync land a note at a path that is new locally.
#[tauri::command]
pub fn write_note(path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    let parent = target.parent().ok_or("path has no parent directory")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let temp = parent.join(format!(
        ".{}.nib-tmp",
        target.file_name().and_then(|n| n.to_str()).unwrap_or("note")
    ));

    fs::write(&temp, content).map_err(|e| e.to_string())?;
    fs::rename(&temp, &target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_note(from: String, to: String) -> Result<(), String> {
    let target = PathBuf::from(&to);
    if target.exists() {
        return Err("something already lives there".into());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// Removes a folder and everything under it.
#[tauri::command]
pub fn delete_folder(path: String) -> Result<(), String> {
    fs::remove_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_tree(root: String) -> Result<Entry, String> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err("root is not a directory".into());
    }
    Ok(walk(&path))
}

fn walk(path: &Path) -> Entry {
    let mut children = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let child = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') {
                continue;
            }
            if child.is_dir() {
                children.push(walk(&child));
            } else if is_markdown(&child) {
                children.push(Entry {
                    name,
                    path: child.to_string_lossy().to_string(),
                    is_dir: false,
                    children: Vec::new(),
                });
            }
        }
    }

    // Folders first, then notes, each alphabetical.
    children.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));

    Entry {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string()),
        path: path.to_string_lossy().to_string(),
        is_dir: true,
        children,
    }
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MARKDOWN_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}
