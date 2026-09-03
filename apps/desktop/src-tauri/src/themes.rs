use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct ThemeFile {
    id: String,
    name: String,
    path: String,
}

/// Themes live next to the app's config, so dropping a `.css` file in there is
/// all it takes to install one — the same contract Typora uses.
fn themes_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("themes");

    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn theme_dir(app: AppHandle) -> Result<String, String> {
    Ok(themes_root(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_themes(app: AppHandle) -> Result<Vec<ThemeFile>, String> {
    let dir = themes_root(&app)?;
    let mut themes = Vec::new();

    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("css") {
            continue;
        }

        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("theme")
            .to_string();

        themes.push(ThemeFile {
            id: format!("file:{stem}"),
            name: humanise(&stem),
            path: path.to_string_lossy().to_string(),
        });
    }

    themes.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(themes)
}

#[tauri::command]
pub fn read_theme(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// `custom.css` sits beside the themes and is applied on top of whichever one
/// is active, so a tweak survives switching themes.
fn custom_css_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(themes_root(app)?
        .parent()
        .unwrap_or(Path::new("."))
        .join("custom.css"))
}

#[tauri::command]
pub fn custom_css_path(app: AppHandle) -> Result<String, String> {
    let path = custom_css_file(&app)?;
    if !path.exists() {
        fs::write(
            &path,
            "/* Loaded after the active theme. Anything here wins. */\n",
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_custom_css(app: AppHandle) -> String {
    custom_css_file(&app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .unwrap_or_default()
}

/// `night-owl` becomes `Night owl`, matching how Typora labels theme files.
fn humanise(stem: &str) -> String {
    let spaced = stem.replace(['-', '_'], " ");
    let mut chars = spaced.chars();

    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => spaced,
    }
}
