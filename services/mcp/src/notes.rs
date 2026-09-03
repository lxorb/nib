use std::fs;
use std::path::{Component, Path, PathBuf};

const MARKDOWN: [&str; 4] = ["md", "markdown", "mdown", "mkd"];
const MAX_MATCHES: usize = 50;

pub struct Vault {
    root: PathBuf,
    pub read_only: bool,
}

pub struct Match {
    pub path: String,
    pub line: usize,
    pub text: String,
}

impl Vault {
    pub fn new(root: PathBuf, read_only: bool) -> Self {
        Self { root, read_only }
    }

    /// Resolves a space-relative path, refusing anything that climbs out.
    pub fn resolve(&self, relative: &str) -> Result<PathBuf, String> {
        let candidate = Path::new(relative);

        if candidate.is_absolute() {
            return Err("use a path relative to the space".into());
        }
        if candidate
            .components()
            .any(|part| matches!(part, Component::ParentDir | Component::Prefix(_)))
        {
            return Err("that path leaves the space".into());
        }

        Ok(self.root.join(candidate))
    }

    pub fn list(&self) -> Vec<String> {
        let mut found = Vec::new();
        walk(&self.root, &self.root, &mut found);
        found.sort();
        found
    }

    pub fn read(&self, relative: &str) -> Result<String, String> {
        fs::read_to_string(self.resolve(relative)?).map_err(|e| e.to_string())
    }

    pub fn write(&self, relative: &str, content: &str) -> Result<(), String> {
        if self.read_only {
            return Err("this space is connected read-only".into());
        }

        let target = self.resolve(relative)?;
        if !is_markdown(&target) {
            return Err("notes must end in .md".into());
        }

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(target, content).map_err(|e| e.to_string())
    }

    pub fn delete(&self, relative: &str) -> Result<(), String> {
        if self.read_only {
            return Err("this space is connected read-only".into());
        }
        fs::remove_file(self.resolve(relative)?).map_err(|e| e.to_string())
    }

    /// Case-insensitive substring search across every note, with the line shown.
    pub fn search(&self, query: &str, limit: usize) -> Vec<Match> {
        let needle = query.to_lowercase();
        let mut matches = Vec::new();

        for relative in self.list() {
            let Ok(body) = self.read(&relative) else { continue };

            for (index, line) in body.lines().enumerate() {
                if !line.to_lowercase().contains(&needle) {
                    continue;
                }

                matches.push(Match {
                    path: relative.clone(),
                    line: index + 1,
                    text: line.trim().chars().take(240).collect(),
                });

                if matches.len() >= limit.min(MAX_MATCHES) {
                    return matches;
                }
            }
        }

        matches
    }
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MARKDOWN.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(dir) else { return };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            walk(root, &path, out);
        } else if is_markdown(&path) {
            if let Ok(relative) = path.strip_prefix(root) {
                out.push(relative.to_string_lossy().replace('\\', "/"));
            }
        }
    }
}
