use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Anything past this and the file is rolled over, so a loop cannot fill a disk.
const MAX_BYTES: u64 = 1024 * 1024;

fn log_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("nib.log"))
}

#[tauri::command]
pub fn log_dir(app: AppHandle) -> Result<String, String> {
    Ok(log_file(&app)?.to_string_lossy().to_string())
}

/// Appends one line. `at` comes from the caller so the timestamp matches the
/// clock the message was written by.
#[tauri::command]
pub fn write_log(app: AppHandle, level: String, message: String, at: String) -> Result<(), String> {
    let path = log_file(&app)?;

    // One previous file is kept, which is enough to span a crash and a restart.
    if fs::metadata(&path).map(|m| m.len()).unwrap_or(0) > MAX_BYTES {
        let _ = fs::rename(&path, path.with_extension("log.1"));
    }

    let line = format!("{at} {:<5} {}\n", level.to_uppercase(), one_line(&message));

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;

    file.write_all(line.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_log(app: AppHandle) -> Result<String, String> {
    fs::read_to_string(log_file(&app)?).or_else(|_| Ok(String::new()))
}

/// A log line is one line, so a stack trace cannot pass itself off as several
/// separate entries.
fn one_line(message: &str) -> String {
    message
        .replace(['\r', '\n'], " ⏎ ")
        .chars()
        .take(2000)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folds_a_message_onto_one_line() {
        assert_eq!(one_line("a\nb\r\nc"), "a ⏎ b ⏎  ⏎ c");
        assert_eq!(one_line("plain"), "plain");
    }

    #[test]
    fn caps_how_long_a_line_can_get() {
        assert_eq!(one_line(&"x".repeat(5000)).chars().count(), 2000);
    }
}
