# One-shot: boot the Android emulator, start Metro, and open the app in Expo Go.
# Safe to re-run: reuses an already-running emulator and an already-running Metro.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\run-mobile-app.ps1
#
# Notes that matter on this machine:
#  - Use the Pixel_API_34 AVD. The API 36.1 image crash-loops surfaceflinger
#    ("Assertion failed: !rcEnc->featureInfo()->hasReadColorBufferDma"), which
#    takes system_server with it and makes app installs/launches fail randomly.
#  - Always kill BOTH emulator.exe and qemu-system-x86_64.exe; a leftover qemu
#    holds the AVD lock and the next launch dies with
#    "Running multiple emulators with the same AVD".
#  - The emulator rewrites emulator-user.ini on exit, so window position is
#    re-applied at runtime by fix-emulator-window.ps1 instead of being trusted.
#  - This starts the app, not the backend. spyder-backend lives in the Spyder
#    repo and has to be running separately, or every screen shows its error
#    state and the app looks broken.

param(
    [string]$Avd      = 'Pixel_API_34',
    [string]$AppDir   = 'D:\spyder-mobile-app',
    [int]   $Port     = 8081,
    [int]   $ApiPort  = 3000,  # spyder-backend, reversed so 127.0.0.1 works in the guest
    [switch]$Restart          # force a clean emulator restart
)

$ErrorActionPreference = 'Stop'
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$adb = "$sdk\platform-tools\adb.exe"
$emu = "$sdk\emulator\emulator.exe"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Step($n, $msg) { Write-Host "[$n] $msg" -ForegroundColor Cyan }

# 1 ---------------------------------------------------------------- emulator
$running = Get-Process qemu-system-x86_64 -ErrorAction SilentlyContinue

if ($Restart -and $running) {
    Step 1 'Stopping existing emulator'
    Get-Process qemu-system-x86_64, emulator -ErrorAction SilentlyContinue |
        Stop-Process -Force
    Start-Sleep 4
    $running = $null
}

if ($running) {
    Step 1 'Emulator already running, reusing it'
} else {
    Step 1 "Launching AVD $Avd"
    Start-Process $emu -ArgumentList @(
        '-avd', $Avd, '-gpu', 'host',
        '-no-snapshot', '-no-audio', '-no-boot-anim',
        '-scale', '0.3'
    )
}

# 2 -------------------------------------------------------------------- boot
# Bounded poll that bails the moment qemu dies, instead of `adb wait-for-device`
# which blocks forever when the emulator never comes up.
Step 2 'Waiting for boot'
$booted = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep 5
    if (-not (Get-Process qemu-system-x86_64 -ErrorAction SilentlyContinue)) {
        Write-Host '  emulator process died during boot' -ForegroundColor Red
        exit 1
    }
    # adb prints "device offline"/"not found" to stderr until the guest is up.
    # Route through cmd so PowerShell doesn't turn that noise into a
    # terminating error under $ErrorActionPreference = 'Stop'.
    $flag = (cmd /c "`"$adb`" -s emulator-5554 shell getprop sys.boot_completed 2>nul" |
             Out-String).Trim()
    if ($flag -eq '1') {
        $booted = $true
        Write-Host "  booted after ~$(($i + 1) * 5)s" -ForegroundColor Green
        break
    }
}
if (-not $booted) { Write-Host '  timed out waiting for boot' -ForegroundColor Red; exit 1 }

# 3 ------------------------------------------------------------------ window
Step 3 'Placing the emulator window on screen'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here 'fix-emulator-window.ps1')

# 4 ------------------------------------------------------------------- metro
$listening = (netstat -ano | Select-String ":$Port\s" | Select-String 'LISTENING')
if ($listening) {
    Step 4 "Metro already listening on $Port, reusing it"
} else {
    Step 4 "Starting Metro in a separate window on port $Port"
    Start-Process powershell -ArgumentList @(
        '-NoExit', '-NoProfile', '-Command',
        "Set-Location '$AppDir'; npx expo start --port $Port"
    )
    $up = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep 5
        if ((netstat -ano | Select-String ":$Port\s" | Select-String 'LISTENING')) {
            $up = $true
            Write-Host "  Metro up after ~$(($i + 1) * 5)s" -ForegroundColor Green
            break
        }
    }
    if (-not $up) { Write-Host '  Metro did not start' -ForegroundColor Red; exit 1 }
}

# 5 ------------------------------------------------------------------ connect
# `adb reverse` makes 127.0.0.1:8081 inside the guest reach Metro on the host,
# so no LAN IP is needed for the bundle.
#
# The API gets the same treatment on $ApiPort. Without it, EXPO_PUBLIC_API_URL's
# 127.0.0.1 resolves to the emulator itself, every /api call is refused, and each
# screen renders only its error state: a header and a tab bar over a blank page.
# Reversing the port (rather than switching the URL to 10.0.2.2) keeps one
# address working from the emulator and from a browser on the host.
Step 5 'Wiring the emulator to Metro and the API, and opening the app'
cmd /c "`"$adb`" -s emulator-5554 reverse tcp:$Port tcp:$Port" | Out-Null
cmd /c "`"$adb`" -s emulator-5554 reverse tcp:$ApiPort tcp:$ApiPort" | Out-Null

# The backend is a separate repo, so this script cannot start it. Say so plainly
# here instead of letting it look like a bug in the app.
if (-not (netstat -ano | Select-String ":$ApiPort\s" | Select-String 'LISTENING')) {
    Write-Host "  WARNING: nothing is listening on $ApiPort, so the API is down." -ForegroundColor Yellow
    Write-Host '  Every screen will show "Could not load ...". Start it with:' -ForegroundColor Yellow
    Write-Host '    cd D:\Spyder\spyder-backend; npm run dev' -ForegroundColor Yellow
}
cmd /c "`"$adb`" -s emulator-5554 shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:$Port 2>&1" |
    Out-String | Write-Host

Write-Host ''
Write-Host 'Done. First bundle takes ~25s; watch the Metro window for progress.' -ForegroundColor Green
