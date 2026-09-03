use crate::notes::Vault;
use serde_json::{json, Value};

const PROTOCOL_VERSION: &str = "2025-06-18";

/// Answers one JSON-RPC message. Returns None for notifications.
pub fn handle(vault: &Vault, line: &str) -> Option<String> {
    let request: Value = match serde_json::from_str(line) {
        Ok(value) => value,
        Err(error) => return Some(error_response(Value::Null, -32700, &error.to_string())),
    };

    let id = request.get("id").cloned();
    let method = request.get("method").and_then(Value::as_str).unwrap_or("");
    let params = request.get("params").cloned().unwrap_or(json!({}));

    // Notifications carry no id, so nothing goes back.
    let id = id?;

    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": { "tools": { "listChanged": false } },
            "serverInfo": { "name": "nib", "version": env!("CARGO_PKG_VERSION") },
        })),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({ "tools": tools(vault) })),
        "tools/call" => call(vault, &params),
        other => Err(format!("unknown method: {other}")),
    };

    Some(match result {
        Ok(value) => json!({ "jsonrpc": "2.0", "id": id, "result": value }).to_string(),
        Err(message) => error_response(id, -32603, &message),
    })
}

fn error_response(id: Value, code: i32, message: &str) -> String {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } }).to_string()
}

fn text(body: String) -> Value {
    json!({ "content": [{ "type": "text", "text": body }] })
}

fn failure(message: String) -> Value {
    json!({ "content": [{ "type": "text", "text": message }], "isError": true })
}

fn tools(vault: &Vault) -> Vec<Value> {
    let mut list = vec![
        json!({
            "name": "list_notes",
            "description": "List every note in the space, as paths relative to its root.",
            "inputSchema": { "type": "object", "properties": {} },
        }),
        json!({
            "name": "read_note",
            "description": "Read one note's markdown.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string", "description": "Path relative to the space root, e.g. Notes/Ideas.md" } },
                "required": ["path"],
            },
        }),
        json!({
            "name": "search_notes",
            "description": "Find notes containing a phrase. Returns the matching lines.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "limit": { "type": "integer", "description": "Maximum matches to return (default 20)" },
                },
                "required": ["query"],
            },
        }),
    ];

    if !vault.read_only {
        list.push(json!({
            "name": "write_note",
            "description": "Create a note or replace its contents. Folders are created as needed.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Path relative to the space root, ending in .md" },
                    "content": { "type": "string" },
                },
                "required": ["path", "content"],
            },
        }));
        list.push(json!({
            "name": "delete_note",
            "description": "Delete a note.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"],
            },
        }));
    }

    list
}

fn call(vault: &Vault, params: &Value) -> Result<Value, String> {
    let name = params.get("name").and_then(Value::as_str).unwrap_or("");
    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));
    let string = |key: &str| arguments.get(key).and_then(Value::as_str).unwrap_or("").to_string();

    Ok(match name {
        "list_notes" => {
            let paths = vault.list();
            if paths.is_empty() {
                text("The space has no notes yet.".into())
            } else {
                text(paths.join("\n"))
            }
        }

        "read_note" => match vault.read(&string("path")) {
            Ok(body) => text(body),
            Err(message) => failure(message),
        },

        "search_notes" => {
            let limit = arguments.get("limit").and_then(Value::as_u64).unwrap_or(20) as usize;
            let matches = vault.search(&string("query"), limit);

            if matches.is_empty() {
                text("No notes matched.".into())
            } else {
                let body = matches
                    .iter()
                    .map(|hit| format!("{}:{}  {}", hit.path, hit.line, hit.text))
                    .collect::<Vec<_>>()
                    .join("\n");
                text(body)
            }
        }

        "write_note" => {
            let path = string("path");
            match vault.write(&path, &string("content")) {
                Ok(()) => text(format!("Wrote {path}.")),
                Err(message) => failure(message),
            }
        }

        "delete_note" => {
            let path = string("path");
            match vault.delete(&path) {
                Ok(()) => text(format!("Deleted {path}.")),
                Err(message) => failure(message),
            }
        }

        other => return Err(format!("unknown tool: {other}")),
    })
}
