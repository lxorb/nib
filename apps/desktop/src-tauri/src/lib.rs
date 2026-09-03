mod export;
mod mcp;
mod notes;
mod themes;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            notes::read_note,
            notes::write_note,
            notes::read_tree,
            notes::delete_note,
            notes::rename_note,
            notes::create_folder,
            notes::delete_folder,
            notes::save_asset,
            notes::search_space,
            mcp::mcp_config,
            export::has_pandoc,
            export::run_pandoc,
            themes::theme_dir,
            themes::list_themes,
            themes::read_theme,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start Nib");
}
