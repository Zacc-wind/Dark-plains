Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$sourceRoot = Join-Path $repoRoot 'assetsv2'
$publicAssets = Join-Path $repoRoot 'public\assets'
$equipmentRoot = Join-Path $publicAssets 'equipment'
$iconsRoot = Join-Path $publicAssets 'icons'
$minionsRoot = Join-Path $publicAssets 'minions'

if (-not (Test-Path $sourceRoot)) {
  throw "Missing source asset folder: $sourceRoot"
}

New-Item -ItemType Directory -Force -Path $publicAssets, $equipmentRoot, $iconsRoot, $minionsRoot | Out-Null

$obsoleteAssets = @(
  'public\mapbackground.png',
  'public\uibackground.png',
  'public\modal-background.png',
  'public\gold-loot.PNG',
  'public\hp.png',
  'public\xp.png',
  'public\sword-decent.png',
  'public\sword-rare.png',
  'public\sword-epic.png',
  'public\sword-legendary.png',
  'public\shield-decent.png',
  'public\shield-rare.png',
  'public\shield-epic.png',
  'public\shield-legendary.png',
  'public\armor-rare.png',
  'public\armor-epic.png',
  'public\armor-legendary.png',
  'public\armor-pants-decent.png',
  'public\armor-pants-rare.png',
  'public\armor-pants-epic.png',
  'public\armor-pants-legendary.png',
  'public\Armor-Decent.png',
  'public\Boot-Decent.png',
  'public\Boot-Rare.png',
  'public\Boot-Epic.png',
  'public\Boot-Legendary.png',
  'public\Gloves-decent.png',
  'public\Gloves-rare.png',
  'public\Gloves-epic.png',
  'public\Gloves-legendary.png',
  'public\Helmet-Decent.png',
  'public\Helmet-Rare.png',
  'public\Helmet-Epic.png',
  'public\Helmet-Legendary.png',
  'public\assets\attack.PNG',
  'public\assets\defence.PNG',
  'public\assets\gold-loot.PNG',
  'public\assets\loot.PNG',
  'public\assets\rare gems.PNG',
  'public\assets\speed.PNG',
  'public\assets\city1.png',
  'public\assets\city2.png',
  'public\assets\Coffee Plantation.png',
  'public\assets\Crab Trap.png',
  'public\assets\Fishing Dock.png',
  'public\assets\Granite Quarry.png',
  'public\assets\Hunting Lodge.png',
  'public\assets\grass.png',
  'public\assets\water.png',
  'public\assets\road.png'
)

foreach ($asset in $obsoleteAssets) {
  $assetPath = Join-Path $repoRoot $asset
  if (Test-Path $assetPath) {
    Remove-Item -LiteralPath $assetPath -Force
  }
}

function Copy-Asset([string]$sourceName, [string]$targetPath) {
  $sourcePath = Join-Path $sourceRoot $sourceName
  if (-not (Test-Path $sourcePath)) {
    throw "Missing source asset: $sourceName"
  }

  $targetDir = Split-Path -Parent $targetPath
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
}

function Save-TrimmedSprite(
  [string]$sourceName,
  [string]$targetPath,
  [int]$targetSize,
  [int]$padding
) {
  $sourcePath = Join-Path $sourceRoot $sourceName
  if (-not (Test-Path $sourcePath)) {
    throw "Missing source sprite: $sourceName"
  }

  $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
  $trimLeft = $source.Width
  $trimTop = $source.Height
  $trimRight = -1
  $trimBottom = -1
  $alphaThreshold = 24
  $cleanSource = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      $pixel = $source.GetPixel($x, $y)
      if ($pixel.A -gt $alphaThreshold) {
        $cleanSource.SetPixel($x, $y, $pixel)
        if ($x -lt $trimLeft) { $trimLeft = $x }
        if ($x -gt $trimRight) { $trimRight = $x }
        if ($y -lt $trimTop) { $trimTop = $y }
        if ($y -gt $trimBottom) { $trimBottom = $y }
      } else {
        $cleanSource.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
      }
    }
  }

  if ($trimRight -lt 0 -or $trimBottom -lt 0) {
    $cleanSource.Dispose()
    $source.Dispose()
    throw "Sprite trim produced an empty image: $sourceName"
  }

  $trimWidth = $trimRight - $trimLeft + 1
  $trimHeight = $trimBottom - $trimTop + 1
  $drawArea = [Math]::Max(1, $targetSize - ($padding * 2))
  $scale = [Math]::Min($drawArea / $trimWidth, $drawArea / $trimHeight)
  $drawWidth = [Math]::Max(1, [int][Math]::Round($trimWidth * $scale))
  $drawHeight = [Math]::Max(1, [int][Math]::Round($trimHeight * $scale))
  $drawX = [int][Math]::Floor(($targetSize - $drawWidth) / 2)
  $drawY = [int][Math]::Floor(($targetSize - $drawHeight) / 2)

  $targetDir = Split-Path -Parent $targetPath
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

  $out = [System.Drawing.Bitmap]::new($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $srcRect = [System.Drawing.Rectangle]::new($trimLeft, $trimTop, $trimWidth, $trimHeight)
  $destRect = [System.Drawing.Rectangle]::new($drawX, $drawY, $drawWidth, $drawHeight)
  $g.DrawImage($cleanSource, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

  $out.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $out.Dispose()
  $cleanSource.Dispose()
  $source.Dispose()
}

function Save-CroppedEquipmentIcon(
  [System.Drawing.Bitmap]$sheet,
  [string]$targetPath,
  [int]$x1,
  [int]$x2,
  [int]$y1,
  [int]$y2
) {
  $cropWidth = $x2 - $x1
  $cropHeight = $y2 - $y1
  $trimLeft = $cropWidth
  $trimTop = $cropHeight
  $trimRight = -1
  $trimBottom = -1
  $transparentThreshold = 22

  $crop = [System.Drawing.Bitmap]::new($cropWidth, $cropHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $cropHeight; $y++) {
    for ($x = 0; $x -lt $cropWidth; $x++) {
      $pixel = $sheet.GetPixel($x1 + $x, $y1 + $y)
      $isBlackBackground = $pixel.R -le $transparentThreshold -and $pixel.G -le $transparentThreshold -and $pixel.B -le $transparentThreshold
      if ($pixel.A -eq 0 -or $isBlackBackground) {
        $crop.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
      } else {
        $crop.SetPixel($x, $y, $pixel)
        if ($x -lt $trimLeft) { $trimLeft = $x }
        if ($x -gt $trimRight) { $trimRight = $x }
        if ($y -lt $trimTop) { $trimTop = $y }
        if ($y -gt $trimBottom) { $trimBottom = $y }
      }
    }
  }

  if ($trimRight -lt 0 -or $trimBottom -lt 0) {
    throw "Equipment crop produced an empty icon: $targetPath"
  }

  $trimWidth = $trimRight - $trimLeft + 1
  $trimHeight = $trimBottom - $trimTop + 1
  $targetSize = 192
  $padding = 16
  $scale = [Math]::Min(($targetSize - $padding * 2) / $trimWidth, ($targetSize - $padding * 2) / $trimHeight)
  $drawWidth = [Math]::Max(1, [int][Math]::Round($trimWidth * $scale))
  $drawHeight = [Math]::Max(1, [int][Math]::Round($trimHeight * $scale))
  $drawX = [int][Math]::Floor(($targetSize - $drawWidth) / 2)
  $drawY = [int][Math]::Floor(($targetSize - $drawHeight) / 2)

  $out = [System.Drawing.Bitmap]::new($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $srcRect = [System.Drawing.Rectangle]::new($trimLeft, $trimTop, $trimWidth, $trimHeight)
  $destRect = [System.Drawing.Rectangle]::new($drawX, $drawY, $drawWidth, $drawHeight)
  $g.DrawImage($crop, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

  $out.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $out.Dispose()
  $crop.Dispose()
}

$largeAssets = @(
  'world-map.jpg',
  'world-map.png',
  'rougealike-backgorund.png',
  'town-harborview-bg.png',
  'town-riverside-bg.png'
)

foreach ($asset in $largeAssets) {
  $targetName = if ($asset -eq 'rougealike-backgorund.png') { 'roguelike-background.png' } else { $asset }
  Copy-Asset $asset (Join-Path $publicAssets $targetName)
}

Copy-Asset 'qrcode.png' (Join-Path $publicAssets 'qrcode.png')

$runBackgroundJpg = Join-Path $sourceRoot 'run-bg.jpg'
$runBackgroundPng = Join-Path $sourceRoot 'run-bg.png'
$runBackgroundLegacy = Join-Path $sourceRoot 'run-bakground.png'
if (Test-Path $runBackgroundJpg) {
  $runBackgroundTargetJpg = Join-Path $publicAssets 'run-background.jpg'
  Copy-Asset 'run-bg.jpg' $runBackgroundTargetJpg
  Copy-Item -LiteralPath $runBackgroundTargetJpg -Destination (Join-Path $publicAssets 'run-background.png') -Force
} elseif (Test-Path $runBackgroundPng) {
  Copy-Asset 'run-bg.png' (Join-Path $publicAssets 'run-background.png')
} elseif (Test-Path $runBackgroundLegacy) {
  Copy-Asset 'run-bakground.png' (Join-Path $publicAssets 'run-background.png')
}

$musicAssets = @(
  @{ source = 'background-track\Goblet Bounce.mp3'; target = 'audio\music\goblet-bounce.mp3' },
  @{ source = 'background-track\Goblet Bounce v.2.mp3'; target = 'audio\music\goblet-bounce-v2.mp3' },
  @{ source = 'background-track\Tavern Crown Shuffle.mp3'; target = 'audio\music\tavern-crown-shuffle.mp3' },
  @{ source = 'background-track\Tavern Crown Shuffle v.2.mp3'; target = 'audio\music\tavern-crown-shuffle-v2.mp3' },
  @{ source = 'background-track\808 - In the tavern.mp3'; target = 'audio\music\in-the-tavern.mp3' },
  @{ source = 'background-track\Guards are cleaning the tavern !.mp3'; target = 'audio\music\guards-cleaning-tavern.mp3' },
  @{ source = 'background-track\Burning them wiches.mp3'; target = 'audio\music\burning-them-witches.mp3' },
  @{ source = 'background-track\Mason of the Crown.mp3'; target = 'audio\music\mason-of-the-crown.mp3' },
  @{ source = 'background-track\Tavern Trap.mp3'; target = 'audio\music\tavern-trap.mp3' },
  @{ source = 'background-track\Tavern Trap (1).mp3'; target = 'audio\music\tavern-trap-2.mp3' },
  @{ source = 'background-track\Tavern Trap (2).mp3'; target = 'audio\music\tavern-trap-3.mp3' },
  @{ source = 'background-track\Royal Pursuit.mp3'; target = 'audio\music\royal-pursuit.mp3' },
  @{ source = 'background-track\banger1.mp3'; target = 'audio\music\banger-1.mp3' },
  @{ source = 'background-track\banger2.mp3'; target = 'audio\music\banger-2.mp3' },
  @{ source = 'background-track\nextone.mp3'; target = 'audio\music\next-one.mp3' }
)

foreach ($asset in $musicAssets) {
  Copy-Asset $asset.source (Join-Path $publicAssets $asset.target)
}

$poiSprites = @(
  @{ source = 'forest.png'; target = 'forest.png'; size = 256; padding = 8 },
  @{ source = 'mountain.png'; target = 'mountain.png'; size = 256; padding = 8 },
  @{ source = 'farm.png'; target = 'farm.png'; size = 256; padding = 8 },
  @{ source = 'hunting-lodge.png'; target = 'hunting-lodge.png'; size = 256; padding = 8 },
  @{ source = 'windmill.png'; target = 'windmill.png'; size = 256; padding = 8 },
  @{ source = 'crab-trap.png'; target = 'crab-trap.png'; size = 256; padding = 8 },
  @{ source = 'fishing-dock.png'; target = 'fishing-dock.png'; size = 256; padding = 8 },
  @{ source = 'granite-quarry.png'; target = 'granite-quarry.png'; size = 256; padding = 8 },
  @{ source = 'coffee-plantation.png'; target = 'coffee-plantation.png'; size = 256; padding = 8 },
  @{ source = 'campfire.png'; target = 'campfire.png'; size = 128; padding = 6 },
  @{ source = 'town-harborview-map.png'; target = 'town-harborview-map.png'; size = 512; padding = 12 },
  @{ source = 'town-riverside-map.png'; target = 'town-riverside-map.png'; size = 512; padding = 12 }
)

foreach ($asset in $poiSprites) {
  Save-TrimmedSprite $asset.source (Join-Path $publicAssets $asset.target) $asset.size $asset.padding
}

$playerAssets = @(
  @{ source = 'playermodel1.png'; target = 'playermodel1.png' },
  @{ source = 'playermodel1.png'; target = 'playermodel.png' },
  @{ source = 'playermodel2.png'; target = 'playermodel2.png' },
  @{ source = 'playermodel3.png'; target = 'playermodel3.png' },
  @{ source = 'playermodel4.png'; target = 'playermodel4.png' },
  @{ source = 'playermodel5.png'; target = 'playermodel5.png' },
  @{ source = 'playermodel6.png'; target = 'playermodel6.png' }
)

foreach ($asset in $playerAssets) {
  Save-TrimmedSprite $asset.source (Join-Path $publicAssets $asset.target) 512 20
}

$optionalBattlefield = Join-Path $sourceRoot 'battlefield-bg.png'
if (Test-Path $optionalBattlefield) {
  Copy-Asset 'battlefield-bg.png' (Join-Path $publicAssets 'battlefield-bg.png')
} else {
  Copy-Asset 'world-map.png' (Join-Path $publicAssets 'battlefield-bg.png')
}

$iconAssets = @(
  'attack.png',
  'defense.png',
  'speed.png',
  'gold.png',
  'health.png',
  'xp.png',
  'loot-chest.png',
  'rare-gem.png',
  'magic.png',
  'healing.png'
)

foreach ($asset in $iconAssets) {
  Save-TrimmedSprite $asset (Join-Path $iconsRoot $asset) 96 6
}

$directIconAssets = @('dice.png')
foreach ($asset in $directIconAssets) {
  $sourcePath = Join-Path $sourceRoot $asset
  if (Test-Path $sourcePath) {
    Copy-Asset $asset (Join-Path $iconsRoot $asset)
  }
}

$bossAssetsRoot = Join-Path $publicAssets 'bosses'
New-Item -ItemType Directory -Force -Path $bossAssetsRoot | Out-Null
foreach ($index in 1..8) {
  $bossName = "boss$index.png"
  $sourcePath = Join-Path $sourceRoot $bossName
  if (Test-Path $sourcePath) {
    Copy-Asset $bossName (Join-Path $bossAssetsRoot $bossName)
  }
}

if (Test-Path (Join-Path $sourceRoot 'reaper.png')) {
  Copy-Asset 'reaper.png' (Join-Path $publicAssets 'reaper.png')
}

$minionAssets = @(
  'wizard-apprentice.png',
  'wizard-magus.png',
  'wizard-archmage.png',
  'knight-squire.png',
  'knight-man-at-arms.png',
  'knight-champion.png',
  'templar-initiate.png',
  'templar-crusader.png',
  'templar-paragon.png',
  'priest-acolyte.png',
  'priest-cleric.png',
  'priest-high-priest.png'
)

foreach ($asset in $minionAssets) {
  Save-TrimmedSprite $asset (Join-Path $minionsRoot $asset) 512 20
}

$sheetPath = Join-Path $sourceRoot 'Equipment Icons sheet.png'
if (-not (Test-Path $sheetPath)) {
  throw "Missing equipment sheet: $sheetPath"
}

$sheet = [System.Drawing.Bitmap]::FromFile($sheetPath)

$itemColumns = @(
  @{ slot = 'sword'; x1 = 0; x2 = 285 },
  @{ slot = 'shield'; x1 = 285; x2 = 510 },
  @{ slot = 'armor'; x1 = 510; x2 = 760 },
  @{ slot = 'armor-pants'; x1 = 760; x2 = 970 },
  @{ slot = 'boots'; x1 = 970; x2 = 1205 },
  @{ slot = 'gloves'; x1 = 1205; x2 = 1420 },
  @{ slot = 'helmet'; x1 = 1420; x2 = 1630 }
)

$rarityRows = @(
  @{ rarity = 'decent'; y1 = 20; y2 = 250 },
  @{ rarity = 'rare'; y1 = 250; y2 = 465 },
  @{ rarity = 'epic'; y1 = 465; y2 = 685 },
  @{ rarity = 'legendary'; y1 = 685; y2 = 910 }
)

foreach ($item in $itemColumns) {
  foreach ($rarity in $rarityRows) {
    $fileName = "$($item.slot)-$($rarity.rarity).png"
    Save-CroppedEquipmentIcon `
      -sheet $sheet `
      -targetPath (Join-Path $equipmentRoot $fileName) `
      -x1 $item.x1 `
      -x2 ([Math]::Min($item.x2, $sheet.Width)) `
      -y1 $rarity.y1 `
      -y2 ([Math]::Min($rarity.y2, $sheet.Height))
  }
}

$sheet.Dispose()

$assetVersion = Get-Date -Format 'yyyyMMddHHmmss'
$generatedDir = Join-Path $repoRoot 'lib\generated'
New-Item -ItemType Directory -Force -Path $generatedDir | Out-Null
$assetVersionFile = Join-Path $generatedDir 'assetVersion.ts'
@"
// Auto-updated by ``npm run import-assets``. Do not edit manually.
export const ASSET_VERSION = '$assetVersion';
"@ | Set-Content -Path $assetVersionFile -Encoding utf8

Write-Host "Imported assetsv2 into public/assets and generated 28 equipment icons from the sheet."
Write-Host "Asset cache version: $assetVersion"
