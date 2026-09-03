/// Notes the reader opens are handed to the shell, which is what fills the
/// taskbar Jump List's Recent category and the Start menu's recent documents.
/// Windows keeps and orders the list itself; there is nothing to store here.
#[tauri::command]
pub fn remember_recent(path: String) -> Result<(), String> {
    add_to_recent(&path);
    Ok(())
}

#[cfg(target_os = "windows")]
fn add_to_recent(path: &str) {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::UI::Shell::{SHAddToRecentDocs, SHARD_PATHW};

    let wide: Vec<u16> = std::ffi::OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    // Safe: the pointer is a null-terminated buffer that outlives the call, and
    // the shell only reads from it.
    unsafe {
        SHAddToRecentDocs(SHARD_PATHW.0 as u32, Some(wide.as_ptr() as *const _));
    }
}

#[cfg(not(target_os = "windows"))]
fn add_to_recent(_path: &str) {
    // Other desktops read recent documents from their own files, which the
    // portal writes; nothing for the app to do.
}
