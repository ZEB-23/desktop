$ErrorActionPreference = 'Stop'
$setup = Join-Path $env:RELEASE_OUTPUT 'GitHubDesktopSetup-x64.exe'
$install = Start-Process -FilePath $setup -ArgumentList '--silent' -PassThru
if (-not $install.WaitForExit(180000)) { throw 'Installer timed out' }
if ($install.ExitCode -ne 0) { throw "Installer exited with $($install.ExitCode)" }
$application = Join-Path $env:LOCALAPPDATA 'GitHubDesktop'
$executable = $null
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  $executable = Get-ChildItem "$application\app-*\GitHubDesktop.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($executable) { break }
  Start-Sleep -Seconds 2
}
if (-not $executable) { throw 'Installed GitHubDesktop.exe was not found' }
$metadata = Get-Content (Join-Path $executable.Directory.FullName 'resources\app\package.json') -Raw | ConvertFrom-Json
if ($metadata.productName -ne 'GitHub Desktop') { throw 'Unexpected installed product name' }
if ($metadata.bundleID -ne 'com.github.GitHubClient') { throw 'Unexpected installed bundle ID' }
if ($metadata.version -ne '3.6.8-beta2') { throw 'Unexpected installed version' }
if ($executable.VersionInfo.ProductName -ne 'GitHub Desktop') { throw 'Unexpected executable product name' }
$roots = @(
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
  [Environment]::GetFolderPath('Desktop')
)
$links = @($roots | ForEach-Object { Get-ChildItem $_ -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue } | Where-Object { $_.Name -like '*GitHub*' })
if (-not ($links | Where-Object { $_.Name -eq 'GitHub Desktop.lnk' })) { throw 'Original GitHub Desktop shortcut was not created' }
$shell = New-Object -ComObject WScript.Shell
foreach ($link in $links) {
  $shortcut = $shell.CreateShortcut($link.FullName)
  if (($link.Name + $shortcut.TargetPath + $shortcut.Arguments) -match '(?i)word[\s-]*wrap') { throw 'Unexpected branding in shortcut' }
  Write-Host "Shortcut verified: $($link.Name)"
}
# Close the automatically launched installer session before the isolated E2E session.
Get-Process GitHubDesktop -ErrorAction SilentlyContinue | Stop-Process -Force
"DESKTOP_E2E_APP_PATH=$($executable.FullName)" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
Write-Host "Verified installed Windows x64 application: $($executable.FullName)"
