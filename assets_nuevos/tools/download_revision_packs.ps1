$ErrorActionPreference = 'Stop'

$workspace = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$downloadRoot = Join-Path $workspace 'assets_nuevos\_downloads_revision'
$extractRoot = Join-Path $workspace 'assets_nuevos\_source_extract_revision'

$packs = @(
  @{ Id = 'akami_buff_debuff_cc0'; Url = 'https://akami666.itch.io/buff-debuff-icon-pack-free-vol1' },
  @{ Id = 'akami_cozy_witchcraft'; Url = 'https://akami666.itch.io/cozy-witchcraft-icons-free-sample-pack-20-game-icons' },
  @{ Id = 'deyeshi_vibrant_game_icons'; Url = 'https://deyeshi.itch.io/vgi' },
  @{ Id = 'deyeshi_shiny_game_icons'; Url = 'https://deyeshi.itch.io/sgi' },
  @{ Id = 'assetsmithy_fantasy_loot'; Url = 'https://assetsmithy.itch.io/50-free-fantasy-items-loot-icons-rpg-inventory-pack-sampler' },
  @{ Id = 'marco_consumables'; Url = 'https://marcomyly.itch.io/free-rpg-consumables-icons-pack-png-8-icons-4-styles-4-sizes' },
  @{ Id = 'gobi_shiny_gems'; Url = 'https://gobistudio.itch.io/free-shiny-gems-icon-pack' },
  @{ Id = 'sudoja_game_icons_sampler'; Url = 'https://sudoja.itch.io/free-game-icons-sampler' }
)

New-Item -ItemType Directory -Force -Path $downloadRoot, $extractRoot | Out-Null
$results = @()
$headers = @{
  'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
  'Accept' = 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
}

function Invoke-WithRetry {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Action,
    [int]$Attempts = 5
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      return & $Action
    }
    catch {
      $status = $_.Exception.Response.StatusCode.value__
      if ($status -ne 429 -or $attempt -eq $Attempts) { throw }
      Start-Sleep -Seconds ([Math]::Min(10 * $attempt, 40))
    }
  }
}

function Test-AssetSignature {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $bytes = [IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 8) { return $false }
  $extension = [IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($extension -eq '.zip') {
    return $bytes[0] -eq 0x50 -and $bytes[1] -eq 0x4B
  }
  if ($extension -eq '.png') {
    return $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50 -and $bytes[2] -eq 0x4E -and $bytes[3] -eq 0x47
  }
  return $true
}

foreach ($pack in $packs) {
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $pageUri = [Uri]$pack.Url
  $slug = $pageUri.AbsolutePath.Trim('/')
  $page = Invoke-WithRetry { Invoke-WebRequest -UseBasicParsing -WebSession $session -Headers $headers -Uri $pack.Url }
  $token = [regex]::Match($page.Content, '<meta name="csrf_token" value="([^"]+)"').Groups[1].Value
  $uploadMatches = [regex]::Matches(
    $page.Content,
    'data-upload_id="(?<id>\d+)"[\s\S]*?<strong[^>]*title="(?<name>[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )

  if ($uploadMatches.Count -eq 0) {
    $purchase = Invoke-WithRetry { Invoke-WebRequest -UseBasicParsing -WebSession $session -Headers $headers -Uri ($pack.Url + '/purchase') }
    $token = [regex]::Match($purchase.Content, '<meta name="csrf_token" value="([^"]+)"').Groups[1].Value
    $requestHeaders = $headers.Clone()
    $requestHeaders['X-CSRFToken'] = $token
    $generateEndpoint = '{0}://{1}/{2}/download_url' -f $pageUri.Scheme, $pageUri.Host, $slug
    $generated = Invoke-WithRetry { Invoke-RestMethod -Method Post -Uri $generateEndpoint -WebSession $session -Headers $requestHeaders -Body @{} }
    $downloadPage = Invoke-WithRetry { Invoke-WebRequest -UseBasicParsing -WebSession $session -Headers $headers -Uri $generated.url }
    $page = $downloadPage
    $token = [regex]::Match($page.Content, '<meta name="csrf_token" value="([^"]+)"').Groups[1].Value
    $uploadMatches = [regex]::Matches(
      $page.Content,
      'data-upload_id="(?<id>\d+)"[\s\S]*?<strong[^>]*title="(?<name>[^"]+)"',
      [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
  }

  $packDownloadDir = Join-Path $downloadRoot $pack.Id
  $packExtractDir = Join-Path $extractRoot $pack.Id
  New-Item -ItemType Directory -Force -Path $packDownloadDir, $packExtractDir | Out-Null

  $files = @()
  foreach ($match in $uploadMatches) {
    $uploadId = $match.Groups['id'].Value
    $filename = [System.Net.WebUtility]::HtmlDecode($match.Groups['name'].Value)
    $destination = Join-Path $packDownloadDir $filename
    if (Test-AssetSignature -Path $destination) {
      $files += [ordered]@{
        upload_id = $uploadId
        filename = $filename
        bytes = (Get-Item -LiteralPath $destination).Length
      }
      continue
    }

    if (Test-Path -LiteralPath $destination) {
      Remove-Item -LiteralPath $destination -Force
    }

    $requestHeaders = $headers.Clone()
    $requestHeaders['X-CSRFToken'] = $token
    $fileEndpoint = '{0}://{1}/{2}/file/{3}?source=view_game&as_props=1&bypass_quarantine=true' -f $pageUri.Scheme, $pageUri.Host, $slug, $uploadId
    $download = Invoke-WithRetry { Invoke-RestMethod -Method Post -Uri $fileEndpoint -WebSession $session -Headers $requestHeaders -Body @{} }
    if (-not $download.url) {
      throw "No direct file URL returned for $($pack.Id) upload $uploadId"
    }
    Invoke-WithRetry { Invoke-WebRequest -UseBasicParsing -WebSession $session -Headers $headers -Uri $download.url -OutFile $destination }

    if ([IO.Path]::GetExtension($destination) -ieq '.zip') {
      Expand-Archive -LiteralPath $destination -DestinationPath $packExtractDir -Force
    }
    elseif ([IO.Path]::GetExtension($destination) -ieq '.png') {
      Copy-Item -LiteralPath $destination -Destination (Join-Path $packExtractDir $filename) -Force
    }

    $files += [ordered]@{
      upload_id = $uploadId
      filename = $filename
      bytes = (Get-Item -LiteralPath $destination).Length
    }
  }

  $results += [ordered]@{
    id = $pack.Id
    page = $pack.Url
    downloads = $files
    status = if ($files.Count -gt 0) { 'downloaded' } else { 'no_free_upload_detected' }
  }
  Start-Sleep -Seconds 4
}

$results | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $workspace 'assets_nuevos\download_results_revision.json')
$results | ForEach-Object { "{0}: {1} ({2} files)" -f $_.id, $_.status, $_.downloads.Count }
