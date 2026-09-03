//! A Model Context Protocol server over stdio, so any LLM client can read and
//! edit a Nib space. Speaks newline-delimited JSON-RPC 2.0; no SDK needed.

mod notes;
mod protocol;

use notes::Vault;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::process::ExitCode;

fn main() -> ExitCode {
    let mut root: Option<PathBuf> = std::env::var("NIB_SPACE").ok().map(PathBuf::from);
    let mut read_only = std::env::var("NIB_READ_ONLY").is_ok();

    let mut args = std::env::args().skip(1);
    while let Some(argument) = args.next() {
        match argument.as_str() {
            "--space" => root = args.next().map(PathBuf::from),
            "--read-only" => read_only = true,
            "--help" | "-h" => {
                eprintln!("nib-mcp --space <folder> [--read-only]");
                return ExitCode::SUCCESS;
            }
            other => {
                eprintln!("unknown option: {other}");
                return ExitCode::FAILURE;
            }
        }
    }

    let Some(root) = root else {
        eprintln!("no space given: pass --space <folder> or set NIB_SPACE");
        return ExitCode::FAILURE;
    };

    if !root.is_dir() {
        eprintln!("not a folder: {}", root.display());
        return ExitCode::FAILURE;
    }

    let vault = Vault::new(root, read_only);
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }

        // A notification has no id and expects no answer.
        if let Some(response) = protocol::handle(&vault, &line) {
            if writeln!(stdout, "{response}").is_err() {
                break;
            }
            let _ = stdout.flush();
        }
    }

    ExitCode::SUCCESS
}
