# Centres the Android emulator window on the primary display, shrinks it if it
# is taller than the desktop, and clears always-on-top.
#
# Why this is needed: the primary display is 1536x864 with only 816px usable
# once the taskbar is subtracted, while the AVD is a 1080x2400 phone. At the
# emulator's own scale the window came out 822px tall — 6px more than fits — so
# the bottom of the device was cut off by the taskbar. Repositioning alone
# cannot fix that, so this resizes as well. emulator-user.ini is rewritten by
# the emulator on exit, so both are re-applied here at runtime.
#
# The emulator shows two windows: the device itself ("Android Emulator - <avd>")
# and a narrow strip of extended controls ("Emulator"). The device is centred
# and the strip is parked just to its left, so they do not overlap.

param(
    # Breathing room kept between the window and the edges of the work area.
    [int]$Margin = 12
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
  public const uint SWP_NOSIZE = 0x0001;
  public const uint SWP_SHOWWINDOW = 0x0040;
}
'@

# The visible window is owned by qemu-system-x86_64, not the emulator.exe launcher.
$procs = Get-Process qemu-system-x86_64, emulator -ErrorAction SilentlyContinue
if (-not $procs) { Write-Output 'emulator is not running'; exit 1 }
$pids = @($procs.Id)

$found = @()
$cb = [Win+EnumProc]{
  param($h, $p)
  $wpid = 0
  [Win]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
  if ($pids -contains [int]$wpid -and [Win]::IsWindowVisible($h)) {
    $len = [Win]::GetWindowTextLength($h)
    if ($len -gt 0) {
      $sb = New-Object Text.StringBuilder ($len + 1)
      [Win]::GetWindowText($h, $sb, $sb.Capacity) | Out-Null
      $script:found += [pscustomobject]@{ Handle = $h; Title = $sb.ToString() }
    }
  }
  return $true
}
[Win]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null

if (-not $found) { Write-Output 'No visible emulator window yet; wait for boot and retry'; exit 1 }

$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$maxH = $area.Height - ($Margin * 2)

function Get-Rect($handle) {
  $r = New-Object Win+RECT
  [Win]::GetWindowRect($handle, [ref]$r) | Out-Null
  return [pscustomobject]@{
    W = $r.Right - $r.Left
    H = $r.Bottom - $r.Top
    X = $r.Left
    Y = $r.Top
  }
}

# The device window carries the AVD name; the controls strip is just "Emulator".
$device = $found | Where-Object { $_.Title -like 'Android Emulator*' } | Select-Object -First 1
$strip  = $found | Where-Object { $_.Handle -ne $device.Handle }
if (-not $device) { $device = $found | Select-Object -First 1; $strip = @() }

# --- the device window: fit, then centre ---------------------------------
$d = Get-Rect $device.Handle
$newW = $d.W
$newH = $d.H

if ($d.H -gt $maxH) {
  # Scale both sides by the same factor, so the phone keeps its aspect ratio
  # instead of being squashed.
  $factor = $maxH / $d.H
  $newH = $maxH
  $newW = [int]($d.W * $factor)
}

$dx = $area.X + [int](($area.Width - $newW) / 2)
$dy = $area.Y + [int](($area.Height - $newH) / 2)
$dx = [Math]::Max($area.X, $dx)
$dy = [Math]::Max($area.Y, $dy)

[Win]::ShowWindow($device.Handle, 9) | Out-Null   # SW_RESTORE
if ($newH -ne $d.H) {
  [Win]::SetWindowPos($device.Handle, [Win]::HWND_NOTOPMOST, $dx, $dy, $newW, $newH,
    [Win]::SWP_SHOWWINDOW) | Out-Null
  Write-Output ("device '{0}': resized {1}x{2} -> {3}x{4} to fit {5}px of usable height" -f `
    $device.Title, $d.W, $d.H, $newW, $newH, $area.Height)
} else {
  [Win]::SetWindowPos($device.Handle, [Win]::HWND_NOTOPMOST, $dx, $dy, 0, 0,
    ([Win]::SWP_NOSIZE -bor [Win]::SWP_SHOWWINDOW)) | Out-Null
}
Write-Output ("device '{0}' {1}x{2} centred at ({3},{4}); always-on-top cleared" -f `
  $device.Title, $newW, $newH, $dx, $dy)

# --- the controls strip: parked beside the device ------------------------
foreach ($w in $strip) {
  $s = Get-Rect $w.Handle
  # Left of the device by preference; right if there is no room there.
  $sx = $dx - $s.W - 4
  if ($sx -lt $area.X) { $sx = $dx + $newW + 4 }
  $sx = [Math]::Min([Math]::Max($area.X, $sx), $area.Right - $s.W)
  $sy = [Math]::Max($area.Y, $dy + [int](($newH - $s.H) / 2))
  [Win]::ShowWindow($w.Handle, 9) | Out-Null
  [Win]::SetWindowPos($w.Handle, [Win]::HWND_NOTOPMOST, $sx, $sy, 0, 0,
    ([Win]::SWP_NOSIZE -bor [Win]::SWP_SHOWWINDOW)) | Out-Null
  Write-Output ("controls '{0}' {1}x{2} parked at ({3},{4})" -f $w.Title, $s.W, $s.H, $sx, $sy)
}
