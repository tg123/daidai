param(
    [Parameter(Mandatory = $true)]
    [string] $Version
)

$normalizedVersion = $Version.TrimStart("v")
if ($normalizedVersion -notmatch "^\d+\.\d+\.\d+$") {
    throw "Version must use semantic versioning (for example, v1.0.1)."
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$godotRoot = Join-Path $repositoryRoot "godot"
$projectPath = Join-Path $godotRoot "project.godot"
$presetsPath = Join-Path $godotRoot "export_presets.cfg"
$utf8WithoutBom = [Text.UTF8Encoding]::new($false)

$project = [IO.File]::ReadAllText($projectPath)
if ([regex]::Matches($project, '(?m)^config/version=[^\r\n]*(?=\r?$)').Count -ne 1) {
    throw "Expected exactly one application config/version setting."
}
$project = [regex]::Replace(
    $project,
    '(?m)^config/version=[^\r\n]*(?=\r?$)',
    "config/version=`"$normalizedVersion`""
)
[IO.File]::WriteAllText($projectPath, $project, $utf8WithoutBom)

$presets = [IO.File]::ReadAllText($presetsPath)
$replacements = @(
    @{
        Pattern = '(?m)^application/file_version=[^\r\n]*(?=\r?$)'
        Value = "application/file_version=`"$normalizedVersion.0`""
        Count = 2
    },
    @{
        Pattern = '(?m)^application/product_version=[^\r\n]*(?=\r?$)'
        Value = "application/product_version=`"$normalizedVersion.0`""
        Count = 2
    },
    @{
        Pattern = '(?m)^application/short_version=[^\r\n]*(?=\r?$)'
        Value = "application/short_version=`"$normalizedVersion`""
        Count = 1
    },
    @{
        Pattern = '(?m)^application/version=[^\r\n]*(?=\r?$)'
        Value = "application/version=`"$normalizedVersion`""
        Count = 1
    },
    @{
        Pattern = '(?m)^version/name=[^\r\n]*(?=\r?$)'
        Value = "version/name=`"$normalizedVersion`""
        Count = 2
    }
)

foreach ($replacement in $replacements) {
    $matches = [regex]::Matches($presets, $replacement.Pattern).Count
    if ($matches -ne $replacement.Count) {
        throw "Expected $($replacement.Count) matches for $($replacement.Pattern), found $matches."
    }
    $presets = [regex]::Replace($presets, $replacement.Pattern, $replacement.Value)
}
[IO.File]::WriteAllText($presetsPath, $presets, $utf8WithoutBom)

Write-Host "Native release metadata set to $normalizedVersion."
