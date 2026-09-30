param(
    [Parameter(Mandatory = $true)]
    [string] $Version,

    [Parameter(Mandatory = $true)]
    [string] $Publisher,

    [Parameter(Mandatory = $true)]
    [string] $OutputPath,

    [string] $X64Executable,
    [string] $Arm64Executable,
    [string] $IdentityName = "62505tgic.daidaiworm",
    [string] $PublisherDisplayName = "Boshi Lian",
    [string] $DisplayName = "DaiDai Worm",
    [string] $ExpectedPublisherId = "jt60csy3p7b26"
)

$ErrorActionPreference = "Stop"

$normalizedVersion = $Version.TrimStart("v")
if ($normalizedVersion -notmatch "^\d+\.\d+\.\d+$") {
    throw "Version must use semantic versioning (for example, v2.0.0)."
}
$packageVersion = "$normalizedVersion.0"

function Get-PublisherId([string] $publisherName) {
    # Package family names encode the first 64 bits of SHA-256(UTF-16LE publisher)
    # as 13 Crockford base32 characters.
    $alphabet = "0123456789abcdefghjkmnpqrstvwxyz"
    $hash = [Security.Cryptography.SHA256]::HashData(
        [Text.Encoding]::Unicode.GetBytes($publisherName)
    )
    $bits = -join ($hash[0..7] | ForEach-Object { [Convert]::ToString($_, 2).PadLeft(8, "0") })
    $bits += "0"
    return -join (0..12 | ForEach-Object { $alphabet[[Convert]::ToInt32($bits.Substring($_ * 5, 5), 2)] })
}

$publisherId = Get-PublisherId $Publisher
if ($ExpectedPublisherId -and $publisherId -ne $ExpectedPublisherId) {
    throw "Publisher '$Publisher' maps to '$publisherId', but the Store listing expects '$ExpectedPublisherId'. Copy Package/Identity/Publisher from Partner Center > Product identity."
}

$executables = [ordered]@{}
if ($X64Executable) { $executables["x64"] = (Resolve-Path $X64Executable).Path }
if ($Arm64Executable) { $executables["arm64"] = (Resolve-Path $Arm64Executable).Path }
if ($executables.Count -eq 0) {
    throw "Provide at least one of -X64Executable or -Arm64Executable."
}

$sdkBin = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
$makeAppx = Get-ChildItem -Path $sdkBin -Filter makeappx.exe -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Directory.Name -eq "x64" } |
    Sort-Object { [version] $_.Directory.Parent.Name } -Descending |
    Select-Object -First 1
if (-not $makeAppx) {
    throw "MakeAppx.exe was not found. Install the Windows 10/11 SDK."
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $repositoryRoot "godot\icon.png"
$languages = @(
    "zh-cn", "zh-tw", "en-us", "ja-jp", "ko-kr", "es-es", "fr-fr",
    "it-it", "de-de", "pt-br", "pl-pl", "ru-ru", "th-th"
)
$escape = { param($value) [Security.SecurityElement]::Escape($value) }

$workRoot = Join-Path ([IO.Path]::GetTempPath()) "daidai-msix-$([Guid]::NewGuid().ToString('N'))"
$packagesDirectory = Join-Path $workRoot "packages"
New-Item -ItemType Directory -Path $packagesDirectory -Force | Out-Null

try {
    Add-Type -AssemblyName System.Drawing
    $source = [Drawing.Image]::FromFile($iconPath)
    try {
        foreach ($architecture in $executables.Keys) {
            $layout = Join-Path $workRoot "layout-$architecture"
            $assets = Join-Path $layout "Assets"
            New-Item -ItemType Directory -Path $assets -Force | Out-Null
            Copy-Item -LiteralPath $executables[$architecture] -Destination (Join-Path $layout "DaiDai.exe")

            foreach ($asset in @(
                @{ Name = "StoreLogo.png"; Width = 50; Height = 50 },
                @{ Name = "Square44x44Logo.png"; Width = 44; Height = 44 },
                @{ Name = "Square150x150Logo.png"; Width = 150; Height = 150 },
                @{ Name = "Wide310x150Logo.png"; Width = 310; Height = 150 }
            )) {
                $bitmap = [Drawing.Bitmap]::new($asset.Width, $asset.Height, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
                try {
                    $graphics = [Drawing.Graphics]::FromImage($bitmap)
                    try {
                        $graphics.Clear([Drawing.Color]::Transparent)
                        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                        $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
                        $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
                        $size = [Math]::Min($asset.Width, $asset.Height)
                        $x = [int](($asset.Width - $size) / 2)
                        $y = [int](($asset.Height - $size) / 2)
                        $graphics.DrawImage($source, $x, $y, $size, $size)
                    } finally {
                        $graphics.Dispose()
                    }
                    $bitmap.Save((Join-Path $assets $asset.Name), [Drawing.Imaging.ImageFormat]::Png)
                } finally {
                    $bitmap.Dispose()
                }
            }

            $resources = ($languages | ForEach-Object { "    <Resource Language=`"$_`" />" }) -join "`n"
            $manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">
  <Identity
    Name="$(& $escape $IdentityName)"
    Publisher="$(& $escape $Publisher)"
    Version="$packageVersion"
    ProcessorArchitecture="$architecture" />
  <Properties>
    <DisplayName>$(& $escape $DisplayName)</DisplayName>
    <PublisherDisplayName>$(& $escape $PublisherDisplayName)</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.22621.0" />
  </Dependencies>
  <Resources>
$resources
  </Resources>
  <Applications>
    <Application Id="DaiDai" Executable="DaiDai.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="$(& $escape $DisplayName)"
        Description="$(& $escape $DisplayName)"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile Wide310x150Logo="Assets\Wide310x150Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"@
            [IO.File]::WriteAllText((Join-Path $layout "AppxManifest.xml"), $manifest, [Text.UTF8Encoding]::new($false))

            $package = Join-Path $packagesDirectory "DaiDai_${packageVersion}_$architecture.msix"
            & $makeAppx.FullName pack /d $layout /p $package /o
            if ($LASTEXITCODE -ne 0) {
                throw "MakeAppx pack failed for $architecture with exit code $LASTEXITCODE."
            }
        }
    } finally {
        $source.Dispose()
    }

    $output = [IO.Path]::GetFullPath($OutputPath)
    New-Item -ItemType Directory -Path (Split-Path -Parent $output) -Force | Out-Null
    & $makeAppx.FullName bundle /d $packagesDirectory /p $output /bv $packageVersion /o
    if ($LASTEXITCODE -ne 0) {
        throw "MakeAppx bundle failed with exit code $LASTEXITCODE."
    }
    Write-Host "Created $output ($($executables.Keys -join ', '), $packageVersion, $IdentityName)."
} finally {
    Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
