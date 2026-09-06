param(
  [string]$ExtensionId = "mdgoeaelfcglnapppbljjbfgmnfbmlgd"
)

$ErrorActionPreference = "Stop"

$hostName = "com.cineby.rpc"
$srcExe   = Join-Path $PSScriptRoot "dist\cinebyRPC-helper.exe"
$srcCfg   = Join-Path $PSScriptRoot "config.json"
$destDir  = Join-Path $env:LOCALAPPDATA "cinebyRPC"
$destExe  = Join-Path $destDir "cinebyRPC-helper.exe"
$destCfg  = Join-Path $destDir "config.json"
$manifest = Join-Path $destDir "$hostName.json"

if (-not (Test-Path $srcExe)) {
  throw "Missing $srcExe`nBuild it first:  cd packaging; npm install; node build.mjs"
}

Write-Host "Installing to $destDir"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

Get-Process -Name "cinebyRPC-helper" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 300
Copy-Item $srcExe $destExe -Force
if ((Test-Path $srcCfg) -and -not (Test-Path $destCfg)) {
  Copy-Item $srcCfg $destCfg -Force
  Write-Host "Copied config.json"
}

$manifestObj = [ordered]@{
  name            = $hostName
  description     = "Cineby Discord Rich Presence helper"
  path            = $destExe
  type            = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$json = $manifestObj | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($manifest, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Wrote $manifest"

$browsers = @{
  "Chrome"   = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
  "Edge"     = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
  "Brave"    = "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$hostName"
  "Chromium" = "HKCU:\Software\Chromium\NativeMessagingHosts\$hostName"
}
$registered = @()
foreach ($name in $browsers.Keys) {
  $key = $browsers[$name]
  try {
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name "(default)" -Value $manifest
    $registered += $name
  } catch {
    Write-Warning "Could not register for $name : $_"
  }
}

Write-Host ""
Write-Host "Installed." -ForegroundColor Green
Write-Host ("  helper:      {0}" -f $destExe)
Write-Host ("  registered:  {0}" -f ($registered -join ", "))
Write-Host ("  extension:   {0}" -f $ExtensionId)
Write-Host ("  log:         {0}\alora.log" -f $destDir)
Write-Host ""
Write-Host "Next:"
Write-Host "  1. <browser>://extensions -> Developer mode -> Load unpacked -> the 'extension' folder"
Write-Host "     Its ID must show as $ExtensionId"
Write-Host "  2. Open the Discord desktop app"
Write-Host "  3. Play something on cineby.rocks"
Write-Host ""
Write-Host "Remove with:  powershell -ExecutionPolicy Bypass -File packaging\uninstall.ps1"
