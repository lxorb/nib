# Captures a running window to a PNG. Used to eyeball the real app during development.
# Enumerates top-level windows rather than trusting MainWindowHandle: an
# undecorated Tauri window is often not what Windows nominates as "main".
param(
  [string]$ProcessName = 'nib',
  [string]$Out = "$env:TEMP\nib-window.png",
  [switch]$ListOnly
)

Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class NibCapture {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public delegate bool EnumProc(IntPtr hWnd, IntPtr param);

  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr param);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder text, int count);

  public static List<string> Windows(uint pid) {
    var found = new List<string>();
    EnumWindows((hWnd, param) => {
      uint owner;
      GetWindowThreadProcessId(hWnd, out owner);
      if (owner != pid) return true;

      RECT r;
      GetWindowRect(hWnd, out r);
      var title = new StringBuilder(256);
      GetWindowTextW(hWnd, title, title.Capacity);
      found.Add(string.Format("{0}|{1}|{2}|{3}|{4}|{5}|{6}",
        hWnd.ToInt64(), IsWindowVisible(hWnd), r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top, title));
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@

$process = Get-Process -Name $ProcessName -ErrorAction Stop | Select-Object -First 1
$rows = [NibCapture]::Windows($process.Id) | ForEach-Object {
  $parts = $_ -split '\|'
  [pscustomobject]@{
    Handle  = [int64]$parts[0]
    Visible = [bool]::Parse($parts[1])
    X       = [int]$parts[2]
    Y       = [int]$parts[3]
    Width   = [int]$parts[4]
    Height  = [int]$parts[5]
    Title   = $parts[6]
  }
}

if ($ListOnly) { return $rows | Sort-Object -Property Width -Descending }

$target = $rows |
  Where-Object { $_.Visible -and $_.Width -gt 200 -and $_.Height -gt 200 } |
  Sort-Object -Property Width -Descending |
  Select-Object -First 1

if (-not $target) { throw "no sizeable visible window for '$ProcessName'" }

$handle = [IntPtr]$target.Handle
[void][NibCapture]::ShowWindow($handle, 9)
[void][NibCapture]::SetForegroundWindow($handle)
Start-Sleep -Milliseconds 700

$rect = New-Object NibCapture+RECT
[void][NibCapture]::GetWindowRect($handle, [ref]$rect)
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
$bitmap.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "$Out ${width}x${height}"
