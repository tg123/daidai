param(
    [Parameter(Mandatory = $true)]
    [string] $Package,

    [ValidateSet("draft", "flight", "production")]
    [string] $Target = "draft",

    [string] $ProductId = "9MV7XJPTM52D",
    [string] $FlightId
)

$ErrorActionPreference = "Stop"

$packagePath = (Resolve-Path $Package).Path
$arguments = @("publish", $packagePath, "--appId", $ProductId)

switch ($Target) {
    "draft" {
        $arguments += "--noCommit"
    }
    "flight" {
        if (-not $FlightId) {
            throw "Set the MSSTORE_FLIGHT_ID variable (or the flight_id input) to publish to a package flight."
        }
        $arguments += @("--flightId", $FlightId)
    }
}

Write-Host "Publishing $packagePath to Microsoft Store product $ProductId ($Target)."
& msstore @arguments
if ($LASTEXITCODE -ne 0) {
    throw "msstore publish failed with exit code $LASTEXITCODE."
}
