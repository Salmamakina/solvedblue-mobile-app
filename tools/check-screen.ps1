# Reports the distinct colours in the emulator's content area, to tell a screen
# that is genuinely blank from one uiautomator simply fails to read.
# uiautomator does not reliably walk React Native's view tree, so it reports an
# empty hierarchy even when content is visibly drawn.

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb -s emulator-5554 shell screencap -p /sdcard/_shot.png 2>$null | Out-Null
& $adb -s emulator-5554 pull /sdcard/_shot.png "$env:TEMP\_shot.png" 2>$null | Out-Null

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("$env:TEMP\_shot.png")
$bmp = New-Object System.Drawing.Bitmap $img
Write-Output "screen = $($img.Width)x$($img.Height)"

# Below the header, above the tab bar.
$top = 320
$bottom = [Math]::Min(2200, $img.Height - 1)
$counts = @{}
for ($y = $top; $y -lt $bottom; $y += 40) {
    for ($x = 20; $x -lt $img.Width; $x += 60) {
        $c = $bmp.GetPixel($x, $y)
        $key = "{0},{1},{2}" -f $c.R, $c.G, $c.B
        $counts[$key] = 1 + $counts[$key]
    }
}

Write-Output "distinct colours in content area: $($counts.Count)"
$counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 8 |
    ForEach-Object { Write-Output ("  {0,-16} x{1}" -f $_.Key, $_.Value) }

if ($counts.Count -le 2) {
    Write-Output 'VERDICT: effectively blank'
} else {
    Write-Output 'VERDICT: content is drawn'
}

$bmp.Dispose()
$img.Dispose()
