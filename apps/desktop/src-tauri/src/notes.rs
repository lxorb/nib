use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MARKDOWN_EXTENSIONS: [&str; 4] = ["md", "markdown", "mdown", "mkd"];

#[derive(Serialize)]
pub struct Entry {
    name: String,
    path: String,
    is_dir: bool,
    /// Milliseconds since the epoch, so the tree can sort by age.
    modified: u64,
    created: u64,
    children: Vec<Entry>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct TreeOptions {
    /// Files and folders beginning with a dot.
    pub show_hidden: bool,
    /// `name`, `modified` or `created`.
    pub sort: String,
    pub descending: bool,
}

fn stamp(time: Option<std::time::SystemTime>) -> u64 {
    time.and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|since| since.as_millis() as u64)
        .unwrap_or(0)
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
        target
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("note")
    ));

    fs::write(&temp, content).map_err(|e| e.to_string())?;
    fs::rename(&temp, &target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

/// Copies a pasted or dropped image next to the note and returns the relative
/// path to write into the markdown, so the note stays portable.
#[tauri::command]
pub fn save_asset(note_path: String, name: String, bytes: Vec<u8>) -> Result<String, String> {
    let note = PathBuf::from(&note_path);
    let dir = note.parent().ok_or("note has no folder")?.join("assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let safe: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();

    // Never clobber an existing asset: add a counter until the name is free.
    let stem = safe
        .rsplit_once('.')
        .map(|(s, _)| s)
        .unwrap_or(&safe)
        .to_string();
    let extension = safe
        .rsplit_once('.')
        .map(|(_, e)| e)
        .unwrap_or("png")
        .to_string();

    let mut candidate = dir.join(&safe);
    let mut counter = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{stem}-{counter}.{extension}"));
        counter += 1;
    }

    fs::write(&candidate, bytes).map_err(|e| e.to_string())?;

    let file = candidate
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("could not name the asset")?;

    Ok(format!("assets/{file}"))
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

#[derive(Serialize)]
pub struct Hit {
    path: String,
    name: String,
    line: usize,
    text: String,
}

/// Case-insensitive search across every note in a space, returning the matching
/// line so the result reads like the note rather than just naming it.
#[tauri::command]
pub fn search_space(root: String, query: String, limit: usize) -> Result<Vec<Hit>, String> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect(&PathBuf::from(&root), &mut files);
    files.sort();

    let mut hits = Vec::new();

    for path in files {
        let Ok(body) = fs::read_to_string(&path) else {
            continue;
        };

        for (index, line) in body.lines().enumerate() {
            if !line.to_lowercase().contains(&needle) {
                continue;
            }

            hits.push(Hit {
                path: path.to_string_lossy().to_string(),
                name: path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                line: index,
                text: line.trim().chars().take(200).collect(),
            });

            if hits.len() >= limit {
                return Ok(hits);
            }
        }
    }

    Ok(hits)
}

fn collect(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect(&path, out);
        } else if is_markdown(&path) {
            out.push(path);
        }
    }
}

#[tauri::command]
pub fn read_tree(root: String, options: Option<TreeOptions>) -> Result<Entry, String> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err("root is not a directory".into());
    }
    Ok(walk(&path, &options.unwrap_or_default()))
}

fn walk(path: &Path, options: &TreeOptions) -> Entry {
    let mut children = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let child = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') && !options.show_hidden {
                continue;
            }

            if child.is_dir() {
                children.push(walk(&child, options));
            } else if is_markdown(&child) {
                let meta = entry.metadata().ok();
                children.push(Entry {
                    name,
                    path: child.to_string_lossy().to_string(),
                    is_dir: false,
                    modified: stamp(meta.as_ref().and_then(|m| m.modified().ok())),
                    created: stamp(meta.as_ref().and_then(|m| m.created().ok())),
                    children: Vec::new(),
                });
            }
        }
    }

    sort_children(&mut children, options);

    let meta = fs::metadata(path).ok();
    Entry {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string()),
        path: path.to_string_lossy().to_string(),
        is_dir: true,
        modified: stamp(meta.as_ref().and_then(|m| m.modified().ok())),
        created: stamp(meta.as_ref().and_then(|m| m.created().ok())),
        children,
    }
}

/// Folders always come first; the chosen key only orders within each group.
fn sort_children(children: &mut [Entry], options: &TreeOptions) {
    children.sort_by(|a, b| {
        let grouped = b.is_dir.cmp(&a.is_dir);
        if grouped != std::cmp::Ordering::Equal {
            return grouped;
        }

        let order = match options.sort.as_str() {
            "modified" => a.modified.cmp(&b.modified),
            "created" => a.created.cmp(&b.created),
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        };

        if options.descending {
            order.reverse()
        } else {
            order
        }
    });
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MARKDOWN_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}
