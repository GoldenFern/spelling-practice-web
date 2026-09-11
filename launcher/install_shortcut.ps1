<#
.SYNOPSIS
    在桌面创建“拼写练习”一键启动快捷方式。

.DESCRIPTION
    快捷方式指向 pythonw.exe + launcher\launcher.py，双击后无控制台窗口，
    自动启动本地服务并用 Edge 应用模式打开界面。

.EXAMPLE
    pwsh -NoProfile -File webapp\launcher\install_shortcut.ps1
#>
[CmdletBinding()]
param(
    [string]$Name = '拼写练习',
    [string]$PythonwPath
)

$ErrorActionPreference = 'Stop'
$launcherDir = $PSScriptRoot
$launcherPy = Join-Path $launcherDir 'launcher.py'
$iconPath = Join-Path $launcherDir 'icon.ico'

if (-not (Test-Path -LiteralPath $launcherPy)) {
    throw "launcher.py not found at $launcherPy"
}

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "$Name.lnk"
$shell = New-Object -ComObject WScript.Shell

if (-not $PythonwPath) {
    $cmd = Get-Command pythonw.exe -ErrorAction SilentlyContinue
    if (-not $cmd) { throw 'pythonw.exe not found in PATH, pass -PythonwPath explicitly' }
    $PythonwPath = $cmd.Source
}

$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $PythonwPath
$shortcut.Arguments = "`"$launcherPy`""
$shortcut.WorkingDirectory = $launcherDir
$shortcut.Description = '雅思听力拼写练习'
if (Test-Path -LiteralPath $iconPath) {
    $shortcut.IconLocation = $iconPath
}
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Host "shortcut created: $shortcutPath"
Write-Host "target: $PythonwPath `"$launcherPy`""
