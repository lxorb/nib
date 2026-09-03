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

/// An image, as a `data:` URI, so an exported page carries its own pictures.
/// Refuses anything large enough to bloat the file past usefulness.
#[tauri::command]
pub fn read_asset(path: String) -> Result<String, String> {
    const LIMIT: u64 = 12 * 1024 * 1024;

    let target = PathBuf::from(&path);
    let size = fs::metadata(&target).map_err(|e| e.to_string())?.len();
    if size > LIMIT {
        return Err(format!("{path} is larger than 12 MB"));
    }

    let bytes = fs::read(&target).map_err(|e| e.to_string())?;
    Ok(format!("data:{};base64,{}", mime_of(&target), encode(&bytes)))
}

fn mime_of(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let block = chunk
            .iter()
            .enumerate()
            .fold(0u32, |acc, (i, byte)| acc | (u32::from(*byte) << (16 - 8 * i)));

        for i in 0..4 {
            // The tail is padded to a whole quantum with `=`.
            if i <= chunk.len() {
                out.push(ALPHABET[(block >> (18 - 6 * i)) as usize & 0x3f] as char);
            } else {
                out.push('=');
            }
        }
    }

    out
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

#[derive(Serialize)]
pub struct Tag {
    tag: String,
    count: usize,
}

/// Every `#tag` used in a space, most-used first. A heading is not a tag: it
/// has a space after the hash, and a tag never does.
#[tauri::command]
pub fn space_tags(root: String) -> Result<Vec<Tag>, String> {
    let mut files = Vec::new();
    collect(&PathBuf::from(&root), &mut files);

    let mut counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    for path in files {
        let Ok(body) = fs::read_to_string(&path) else {
            continue;
        };

        for tag in tags_in(&body) {
            *counts.entry(tag).or_default() += 1;
        }
    }

    let mut tags: Vec<Tag> = counts
        .into_iter()
        .map(|(tag, count)| Tag { tag, count })
        .collect();

    // Most used first, and alphabetical within a count so the list holds still.
    tags.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.tag.cmp(&b.tag)));
    Ok(tags)
}

fn tags_in(body: &str) -> Vec<String> {
    let mut found = Vec::new();
    let mut in_fence = false;

    for line in body.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }

        let chars: Vec<char> = line.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            if chars[i] != '#' {
                i += 1;
                continue;
            }

            // A tag starts a word, so what comes before must be a space.
            let opens = i == 0 || chars[i - 1].is_whitespace() || chars[i - 1] == '(';
            let mut end = i + 1;
            while end < chars.len() && (chars[end].is_alphanumeric() || "-_/".contains(chars[end])) {
                end += 1;
            }

            // The first character has to be a letter, which rules out `#1`.
            let named = end > i + 1 && chars[i + 1].is_alphabetic();

            if opens && named {
                found.push(chars[i..end].iter().collect());
            }

            i = end.max(i + 1);
        }
    }

    found
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_the_rfc_4648_vectors() {
        assert_eq!(encode(b""), "");
        assert_eq!(encode(b"f"), "Zg==");
        assert_eq!(encode(b"fo"), "Zm8=");
        assert_eq!(encode(b"foo"), "Zm9v");
        assert_eq!(encode(b"foob"), "Zm9vYg==");
        assert_eq!(encode(b"fooba"), "Zm9vYmE=");
        assert_eq!(encode(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn encodes_bytes_that_are_not_text() {
        assert_eq!(encode(&[0x00, 0xff, 0x80]), "AP+A");
        assert_eq!(encode(&[0xfb, 0xff]), "+/8=");
    }

    #[test]
    fn finds_tags_but_not_headings() {
        assert_eq!(tags_in("# Heading\n#tag here"), vec!["#tag"]);
        assert_eq!(tags_in("## Also a heading"), Vec::<String>::new());
    }

    #[test]
    fn a_tag_has_to_start_a_word() {
        assert_eq!(tags_in("a#b"), Vec::<String>::new());
        assert_eq!(tags_in("(#nested)"), vec!["#nested"]);
        assert_eq!(tags_in("issue #42"), Vec::<String>::new());
    }

    #[test]
    fn keeps_the_characters_a_tag_may_contain() {
        assert_eq!(tags_in("#work/2026 #a-b #c_d"), vec!["#work/2026", "#a-b", "#c_d"]);
    }

    #[test]
    fn ignores_anything_inside_a_fence() {
        assert_eq!(tags_in("```\n#notatag\n```\n#real"), vec!["#real"]);
    }

    #[test]
    fn counts_a_tag_once_per_use() {
        assert_eq!(tags_in("#a #a #b").len(), 3);
    }

    #[test]
    fn names_the_type_from_the_extension() {
        assert_eq!(mime_of(Path::new("a/b.PNG")), "image/png");
        assert_eq!(mime_of(Path::new("a/b.jpeg")), "image/jpeg");
        assert_eq!(mime_of(Path::new("a/b.svg")), "image/svg+xml");
        assert_eq!(mime_of(Path::new("a/b.xyz")), "application/octet-stream");
        assert_eq!(mime_of(Path::new("noextension")), "application/octet-stream");
    }
}
