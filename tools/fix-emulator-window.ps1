# Forces the Android emulator window fully on-screen on the primary display
# and clears always-on-top.
#
# Why this is needed: the primary display is 1536x864 (816px usable) while the
# AVD is a 1080x2400 phone. At the emulator's auto scale the window is taller
# than the desktop, and the saved window.y has previously been negative, so the
# window spawns partly or wholly offscreen. emulator-user.ini is rewritten by
# the emulator on exit, so position is re-applied here at runtime.

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

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$x = $screen.X + 60
$y = $screen.Y + 20

foreach ($w in $found) {
  $r = New-Object Win+RECT
  [Win]::GetWindowRect($w.Handle, [ref]$r) | Out-Null
  $h = $r.Bottom - $r.Top
  $wd = $r.Right - $r.Left
  # clamp so the whole window lands inside the working area
  $ny = [Math]::Max($screen.Y, [Math]::Min($y, $screen.Bottom - $h))
  $nx = [Math]::Max($screen.X, [Math]::Min($x, $screen.Right - $wd))
  [Win]::ShowWindow($w.Handle, 9) | Out-Null   # SW_RESTORE
  [Win]::SetWindowPos($w.Handle, [Win]::HWND_NOTOPMOST, $nx, $ny, 0, 0,
    ([Win]::SWP_NOSIZE -bor [Win]::SWP_SHOWWINDOW)) | Out-Null
  Write-Output ("moved '{0}' {1}x{2} from ({3},{4}) to ({5},{6}); always-on-top cleared" -f `
    $w.Title, $wd, $h, $r.Left, $r.Top, $nx, $ny)
}
