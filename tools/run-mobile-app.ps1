# One-shot: boot the Android emulator, start Metro, and open the development
# build. Safe to re-run: reuses an already-running emulator and Metro.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\run-mobile-app.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\run-mobile-app.ps1 -Restart
#
# This always talks to STAGING (https://staging.solvedblue.com). There is no
# local-backend mode: one address, the same one the Mac mini uses, so a bug
# reproduces the same way on both. Nothing needs to be running on port 3000 and
# spyder-backend does not need to be started.
#
# It opens the DEVELOPMENT BUILD, not Expo Go. That is deliberate and not
# interchangeable:
#
#   - Google sign-in cannot work in Expo Go. makeRedirectUri only returns the
#     native `com.spyder.mobile:/oauthredirect` when executionEnvironment is
#     Standalone or Bare (expo-auth-session/build/AuthSession.js). Expo Go is
#     StoreClient, so the redirect becomes `exp://127.0.0.1:8081/--/`, and
#     Google answers 400 redirect_uri_mismatch. See SETUP.md.
#   - Install the build once with:
#         npx eas-cli build --profile development --platform android
#         npx eas-cli build:run -p android --latest
#     The development profile reads the `preview` EAS environment, which is
#     where the staging API URL and the Google client ids live. Do not point it
#     at the `development` environment: that one is empty, and a build from it
#     has no client ids, so sign-in disables itself with "Sign-in is
#     unavailable right now".
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

param(
    [string]$Avd      = 'Pixel_API_34',
    [string]$AppDir   = 'D:\spyder-mobile-app',
    [int]   $Port     = 8081,
    [string]$Package  = 'com.spyder.mobile',
    # 0.3 made a 822px-tall window on an 816px work area, so the bottom of the
    # phone sat under the taskbar. 0.28 fits with room to spare;
    # fix-emulator-window.ps1 still shrinks it if a display is smaller again.
    [double]$Scale    = 0.28,
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
        '-scale', "$Scale"
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

# 4 ------------------------------------------------------- development build
# Checked before Metro starts, so a missing build is reported in two seconds
# rather than after waiting for a bundler that nothing will connect to.
Step 4 "Checking for the development build ($Package)"
$installed = (cmd /c "`"$adb`" -s emulator-5554 shell pm list packages $Package 2>nul" |
              Out-String).Trim()
if (-not $installed) {
    Write-Host "  $Package is not installed on this emulator." -ForegroundColor Red
    Write-Host '  Install it once, then re-run this script:' -ForegroundColor Yellow
    Write-Host '    npx eas-cli build --profile development --platform android' -ForegroundColor Yellow
    Write-Host '    npx eas-cli build:run -p android --latest' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Expo Go is not a substitute: Google sign-in cannot work there' -ForegroundColor Yellow
    Write-Host '  (redirect_uri_mismatch). See the header of this script.' -ForegroundColor Yellow
    exit 1
}
Write-Host '  found' -ForegroundColor Green

# 5 ------------------------------------------------------------------- metro
$listening = (netstat -ano | Select-String ":$Port\s" | Select-String 'LISTENING')
if ($listening) {
    Step 5 "Metro already listening on $Port, reusing it"
} else {
    Step 5 "Starting Metro in a separate window on port $Port"
    # --dev-client, because the app being opened is the development build. In
    # Expo Go mode Metro serves a bundle the dev build will not ask for.
    Start-Process powershell -ArgumentList @(
        '-NoExit', '-NoProfile', '-Command',
        "Set-Location '$AppDir'; npx expo start --dev-client --port $Port"
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

# 6 ----------------------------------------------------------------- connect
# `adb reverse` makes 127.0.0.1:8081 inside the guest reach Metro on the host,
# so no LAN IP is needed for the bundle.
#
# Only the Metro port is reversed. The API is staging over https, which the
# emulator reaches over its own network like any other site, so there is
# nothing to forward and no local backend to start.
Step 6 'Wiring the emulator to Metro and opening the app'
cmd /c "`"$adb`" -s emulator-5554 reverse tcp:$Port tcp:$Port" | Out-Null

# The dev-client deep link: the app's scheme, then the Metro URL to load.
$metroUrl = [System.Uri]::EscapeDataString("http://127.0.0.1:$Port")
$deepLink = "$Package`://expo-development-client/?url=$metroUrl"
cmd /c "`"$adb`" -s emulator-5554 shell am start -a android.intent.action.VIEW -d `"$deepLink`" 2>&1" |
    Out-String | Write-Host

Write-Host ''
Write-Host 'Done. Pointing at https://staging.solvedblue.com.' -ForegroundColor Green
Write-Host 'First bundle takes ~25s; watch the Metro window for progress.' -ForegroundColor Green
