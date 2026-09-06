param([switch]$Purge)

$ErrorActionPreference = "SilentlyContinue"

$hostName = "com.cineby.rpc"
$destDir  = Join-Path $env:LOCALAPPDATA "cinebyRPC"

Get-Process -Name "cinebyRPC-helper" -ErrorAction SilentlyContinue | Stop-Process -Force

foreach ($key in @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName",
  "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$hostName",
  "HKCU:\Software\Chromium\NativeMessagingHosts\$hostName"
)) {
  if (Test-Path $key) { Remove-Item $key -Force; Write-Host "Removed $key" }
}

if (Get-ScheduledTask -TaskName "CinebyDiscordRPC" -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName "CinebyDiscordRPC" -Confirm:$false
  Write-Host "Removed old scheduled task CinebyDiscordRPC"
}

if (Test-Path $destDir) {
  if ($Purge) {
    Remove-Item $destDir -Recurse -Force
    Write-Host "Deleted $destDir"
  } else {
    Remove-Item (Join-Path $destDir "cinebyRPC-helper.exe") -Force
    Remove-Item (Join-Path $destDir "$hostName.json") -Force
    Write-Host "Removed the helper. Kept config.json and alora.log (use -Purge to delete those too)."
  }
}
Write-Host "Done. Also remove the extension from your browser."
