use std::path::Path;
use std::sync::Mutex;

const MARKDOWN: [&str; 4] = ["md", "markdown", "mdown", "mkd"];

/// Files named on the command line, waiting for the window to ask for them.
#[derive(Default)]
pub struct Pending(pub Mutex<Vec<String>>);

/// Picks the markdown paths out of a command line, ignoring flags and anything
/// that is not a file we can open.
pub fn markdown_paths<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    args.into_iter()
        .skip(1)
        .filter(|argument| !argument.starts_with('-'))
        .filter(|argument| {
            let path = Path::new(argument);
            path.is_file()
                && path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| MARKDOWN.contains(&e.to_lowercase().as_str()))
                    .unwrap_or(false)
        })
        .collect()
}

/// Handed to the window once it is ready; clearing them stops a reload from
/// reopening the same files a second time.
#[tauri::command]
pub fn take_startup_files(pending: tauri::State<'_, Pending>) -> Vec<String> {
    pending
        .0
        .lock()
        .map(|mut files| std::mem::take(&mut *files))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::markdown_paths;

    #[test]
    fn skips_the_executable_and_flags() {
        let args = vec!["nib.exe".to_string(), "--debug".to_string()];
        assert!(markdown_paths(args).is_empty());
    }

    #[test]
    fn ignores_paths_that_are_not_files() {
        let args = vec!["nib.exe".to_string(), "not-a-real-file.md".to_string()];
        assert!(markdown_paths(args).is_empty());
    }
}
