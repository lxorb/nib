use std::io::Write;
use std::process::{Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Keeps a console window from flashing up on Windows.
// `mut` is only used by the Windows branch below; elsewhere it is dead.
#[cfg_attr(not(windows), allow(unused_mut))]
fn command(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    command
}

#[tauri::command]
pub fn has_pandoc() -> bool {
    command("pandoc")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// Converts markdown with pandoc, the same way Typora does. The source is piped
/// in rather than written to a temp file, so nothing is left behind.
#[tauri::command]
pub fn run_pandoc(source: String, output: String, format: String) -> Result<(), String> {
    let mut child = command("pandoc")
        .args([
            "--from",
            "markdown+tex_math_dollars+pipe_tables+task_lists+footnotes+strikeout",
            "--to",
            &format,
            "--standalone",
            "--output",
            &output,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("pandoc could not start: {e}. Is it installed?"))?;

    child
        .stdin
        .as_mut()
        .ok_or("could not write to pandoc")?
        .write_all(source.as_bytes())
        .map_err(|e| e.to_string())?;

    let result = child.wait_with_output().map_err(|e| e.to_string())?;

    if result.status.success() {
        return Ok(());
    }

    let message = String::from_utf8_lossy(&result.stderr);
    Err(if message.trim().is_empty() {
        "pandoc failed".into()
    } else {
        message.trim().to_string()
    })
}
