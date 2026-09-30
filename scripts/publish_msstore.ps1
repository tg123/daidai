param(
    [Parameter(Mandatory = $true)]
    [string] $Package,

    [ValidateSet("draft", "flight", "production")]
    [string] $Target = "draft",

    [string] $ProductId = "9MV7XJPTM52D",
    [string] $FlightId
)

$ErrorActionPreference = "Stop"

function Invoke-MSStore([string[]] $Arguments) {
    & msstore @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "msstore $($Arguments[0..1] -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Get-PartnerCenterHeaders {
    foreach ($name in "PARTNER_CENTER_TENANT_ID", "PARTNER_CENTER_CLIENT_ID", "PARTNER_CENTER_CLIENT_SECRET") {
        if (-not [Environment]::GetEnvironmentVariable($name)) {
            throw "$name must be set."
        }
    }
    $token = Invoke-RestMethod -Method Post `
        -Uri "https://login.microsoftonline.com/$env:PARTNER_CENTER_TENANT_ID/oauth2/token" `
        -Body @{
            grant_type = "client_credentials"
            client_id = $env:PARTNER_CENTER_CLIENT_ID
            client_secret = $env:PARTNER_CENTER_CLIENT_SECRET
            resource = "https://manage.devcenter.microsoft.com"
        }
    return @{ Authorization = "Bearer $($token.access_token)" }
}

function Repair-PendingSubmission {
    # The native build targets Windows.Desktop only. Submissions cloned from the earlier
    # PWA also enable Holographic, which fails the commit with InvalidParameterValue.
    # New API submissions also reset every listing title to the primary product name,
    # so the reserved localized titles are copied back from the published submission.
    $headers = Get-PartnerCenterHeaders
    $application = "https://manage.devcenter.microsoft.com/v1.0/my/applications/$ProductId"
    $app = Invoke-RestMethod -Headers $headers -Uri $application
    $submissionId = $app.pendingApplicationSubmission.id
    if (-not $submissionId) {
        throw "Product $ProductId has no pending submission to update."
    }
    $submissionUri = "$application/submissions/$submissionId"
    $submission = Invoke-RestMethod -Headers $headers -Uri $submissionUri
    $changed = $false

    foreach ($family in @($submission.allowTargetFutureDeviceFamilies.PSObject.Properties)) {
        $enabled = $family.Name -eq "Desktop"
        if ($family.Value -ne $enabled) {
            $family.Value = $enabled
            $changed = $true
        }
    }

    $publishedId = $app.lastPublishedApplicationSubmission.id
    if ($publishedId) {
        $published = Invoke-RestMethod -Headers $headers -Uri "$application/submissions/$publishedId"
        foreach ($listing in @($submission.listings.PSObject.Properties)) {
            $publishedListing = $published.listings.PSObject.Properties[$listing.Name]
            $title = $publishedListing.Value.baseListing.title
            if ($title -and $listing.Value.baseListing.title -ne $title) {
                $listing.Value.baseListing.title = $title
                $changed = $true
            }
        }
    }

    if ($changed) {
        Invoke-RestMethod -Method Put -Headers $headers -Uri $submissionUri `
            -ContentType "application/json; charset=utf-8" `
            -Body ([Text.Encoding]::UTF8.GetBytes(($submission | ConvertTo-Json -Depth 32))) | Out-Null
        Write-Host "Submission $submissionId targets Windows.Desktop only and keeps the published listing titles."
    }
    return $submissionUri
}

$packagePath = (Resolve-Path $Package).Path
Write-Host "Publishing $packagePath to Microsoft Store product $ProductId ($Target)."

if ($Target -eq "flight") {
    if (-not $FlightId) {
        throw "Set the MSSTORE_FLIGHT_ID variable (or the flight_id input) to publish to a package flight."
    }
    Invoke-MSStore @("publish", $packagePath, "--appId", $ProductId, "--flightId", $FlightId)
    return
}

Invoke-MSStore @("publish", $packagePath, "--appId", $ProductId, "--noCommit")
$submissionUri = Repair-PendingSubmission

if ($Target -eq "production") {
    Invoke-MSStore @("submission", "publish", $ProductId)
    & msstore submission poll $ProductId
    $status = (Invoke-RestMethod -Headers (Get-PartnerCenterHeaders) -Uri "$submissionUri/status").status
    Write-Host "Submission status: $status"
    if ($status -eq "CommitFailed") {
        throw "The Microsoft Store rejected the submission; see the errors above or in Partner Center."
    }
}
