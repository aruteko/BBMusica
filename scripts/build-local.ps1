# Local Android APK build for Windows.
#
# Why a separate work dir: CMake/ninja object paths get very long, so the build must
# run from a SHORT path (default C:\b) with a hoisted node_modules layout, and Windows
# long paths must be enabled (LongPathsEnabled=1) with a ninja >= 1.12.
#
# Usage (from any PowerShell):
#   .\scripts\build-local.ps1                      # jp variant: BBMusica (com.aruteko.bbmusica), installs next to the official app
#   .\scripts\build-local.ps1 -Variant preview     # BBPlayer (Preview)
#   .\scripts\build-local.ps1 -Variant production  # same package name as the official app
#   .\scripts\build-local.ps1 -Prebuild            # force regenerating the android/ project
#
# First-time setup of the work dir (once):
#   - copy this repo (without node_modules) to $Work
#   - add "nodeLinker: hoisted" to $Work\pnpm-workspace.yaml
#   - cd $Work; corepack pnpm install --ignore-scripts --no-frozen-lockfile
param(
	[ValidateSet('jp', 'preview', 'production')][string]$Variant = 'jp',
	[string]$Work = 'C:\b',
	[switch]$Prebuild
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$jbr = 'C:\Program Files\Android\Android Studio\jbr'
$ninja = Join-Path $sdk 'cmake\3.22.1\bin\ninja.exe'

# ---- preflight checks -------------------------------------------------------
if (-not (Test-Path (Join-Path $Work 'node_modules'))) {
	throw "Work dir '$Work' has no node_modules. See the setup notes at the top of this script."
}
$longPaths = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
if ($longPaths -ne 1) {
	throw 'Windows long paths are disabled. Run as admin: Set-ItemProperty ''HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem'' -Name LongPathsEnabled -Value 1  (then reboot)'
}
$ninjaVersion = (& $ninja --version).Trim()
if ([version]($ninjaVersion -replace '[^\d\.].*$', '') -lt [version]'1.12') {
	throw "ninja $ninjaVersion is too old for long paths (need >= 1.12): $ninja"
}

# ---- sync sources into the short work dir -----------------------------------
# JS sources of the app, plus the Orpheus native module (Kotlin + TS)
foreach ($rel in @('apps\mobile\src', 'packages\orpheus\src', 'packages\orpheus\android\src')) {
	robocopy (Join-Path $repo $rel) (Join-Path $Work $rel) /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
	if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $rel ($LASTEXITCODE)" }
}
$global:LASTEXITCODE = 0

# app config, version, Firebase defaults and static assets (the JS sources above are not enough for a release)
foreach ($file in @('apps\mobile\app.config.ts', 'apps\mobile\package.json', 'apps\mobile\firebase.json')) {
	Copy-Item (Join-Path $repo $file) (Join-Path $Work $file) -Force
}
foreach ($rel in @('apps\mobile\assets', 'apps\mobile\expo-plugins')) {
	robocopy (Join-Path $repo $rel) (Join-Path $Work $rel) /E /NFL /NDL /NJH /NJS /NP | Out-Null
	if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $rel ($LASTEXITCODE)" }
}
$global:LASTEXITCODE = 0

# versionCode: number of commits in the real repository (the work dir has no git history)
$commitCount = (git -C $repo rev-list --count HEAD 2>$null)
if ($LASTEXITCODE -eq 0 -and $commitCount) { $env:VERSION_CODE = $commitCount.Trim() }
$global:LASTEXITCODE = 0

# ---- environment ------------------------------------------------------------
$env:JAVA_HOME = $jbr.Replace('\', '/')
$env:ANDROID_HOME = $sdk.Replace('\', '/')
$env:APP_VARIANT = $Variant
$env:ABI_FILTERS = 'arm64-v8a'
$env:NODE_ENV = 'production'
$env:CI = '1'
$env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'

$mobile = Join-Path $Work 'apps\mobile'
$android = Join-Path $mobile 'android'
$marker = Join-Path $Work '.build-variant'

# ---- prebuild when needed (first run, variant change, or -Prebuild) ----------
$needPrebuild = $Prebuild -or -not (Test-Path $android) -or
	-not (Test-Path $marker) -or ((Get-Content $marker -Raw).Trim() -ne $Variant)
if ($needPrebuild) {
	Push-Location $mobile
	try {
		corepack pnpm exec expo prebuild --platform android --no-install --clean
		if ($LASTEXITCODE -ne 0) { throw 'expo prebuild failed' }
	} finally { Pop-Location }
	# forward slashes: backslashes are escape characters in .properties files
	Set-Content -Path (Join-Path $android 'local.properties') -Value ('sdk.dir=' + $sdk.Replace('\', '/')) -Encoding ascii
	Set-Content -Path $marker -Value $Variant -Encoding ascii
}

# ---- build ------------------------------------------------------------------
Push-Location $android
try {
	.\gradlew.bat :app:assembleRelease --no-daemon --console=plain
	if ($LASTEXITCODE -ne 0) { throw "gradle build failed ($LASTEXITCODE)" }
} finally { Pop-Location }

$apk = Get-ChildItem (Join-Path $android 'app\build\outputs\apk\release') -Filter *.apk | Select-Object -First 1
$outDir = Join-Path $Work 'out'
New-Item -ItemType Directory -Force $outDir | Out-Null
$apkName = if ($Variant -eq 'jp') { 'bbmusica' } else { "bbplayer-$Variant" }
$dest = Join-Path $outDir "$apkName-arm64-v8a.apk"
Copy-Item $apk.FullName $dest -Force
Write-Host "APK: $dest"
