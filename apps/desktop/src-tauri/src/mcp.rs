use serde::Serialize;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Serialize)]
pub struct McpConfig {
    /// Absolute path to the server binary.
    binary: String,
    /// True once the binary is actually on disk.
    installed: bool,
    /// Ready to paste into an LLM client's config file.
    snippet: String,
}

/// Where `nib-mcp` lives: bundled with the app once installed, or in the Cargo
/// target folder while developing.
fn binary_path(app: &AppHandle) -> PathBuf {
    let name = if cfg!(windows) {
        "nib-mcp.exe"
    } else {
        "nib-mcp"
    };

    if let Ok(dir) = app
        .path()
        .resolve("binaries", tauri::path::BaseDirectory::Resource)
    {
        let bundled = dir.join(name);
        if bundled.exists() {
            return bundled;
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let beside = dir.join(name);
            if beside.exists() {
                return beside;
            }

            // Development layout: services/mcp/target/release next to the workspace.
            let developed = dir
                .ancestors()
                .nth(4)
                .map(|root| root.join("services/mcp/target/release").join(name));

            if let Some(path) = developed {
                if path.exists() {
                    return path;
                }
            }
        }
    }

    PathBuf::from(name)
}

use tauri::Manager;

#[tauri::command]
pub fn mcp_config(app: AppHandle, space: String, read_only: bool) -> McpConfig {
    let binary = binary_path(&app);
    let installed = binary.exists();

    let mut args = vec![serde_json::json!("--space"), serde_json::json!(space)];
    if read_only {
        args.push(serde_json::json!("--read-only"));
    }

    let snippet = serde_json::to_string_pretty(&serde_json::json!({
        "mcpServers": {
            "nib": {
                "command": binary.to_string_lossy(),
                "args": args,
            }
        }
    }))
    .unwrap_or_default();

    McpConfig {
        binary: binary.to_string_lossy().to_string(),
        installed,
        snippet,
    }
}
