Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$assetsRoot = Join-Path $repoRoot 'public\assets'
$equipmentRoot = Join-Path $assetsRoot 'equipment'
$iconsRoot = Join-Path $assetsRoot 'icons'
$minionsRoot = Join-Path $assetsRoot 'minions'

New-Item -ItemType Directory -Force -Path $assetsRoot, $equipmentRoot, $iconsRoot, $minionsRoot | Out-Null

# Windows preserves old filename casing when overwriting, but the browser URLs are case-sensitive.
foreach ($legacyCaseName in @('Windmill.png', 'campfire.PNG')) {
  $legacyPath = Join-Path $assetsRoot $legacyCaseName
  if (Test-Path $legacyPath) {
    Remove-Item -LiteralPath $legacyPath -Force
  }
}

function C([string]$hex, [int]$alpha = 255) {
  $value = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb(
    $alpha,
    [Convert]::ToInt32($value.Substring(0, 2), 16),
    [Convert]::ToInt32($value.Substring(2, 2), 16),
    [Convert]::ToInt32($value.Substring(4, 2), 16)
  )
}

function Brush([string]$hex, [int]$alpha = 255) {
  return [System.Drawing.SolidBrush]::new((C $hex $alpha))
}

function Pen([string]$hex, [single]$width = 1, [int]$alpha = 255) {
  return [System.Drawing.Pen]::new((C $hex $alpha), $width)
}

function Save-PixelImage([string]$path, [int]$width, [int]$height, [int]$lowWidth, [int]$lowHeight, [bool]$transparent, [scriptblock]$draw) {
  $low = [System.Drawing.Bitmap]::new($lowWidth, $lowHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($low)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

  if ($transparent) { $g.Clear([System.Drawing.Color]::Transparent) } else { $g.Clear((C '#11130f')) }
  & $draw $g $lowWidth $lowHeight

  $out = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $og = [System.Drawing.Graphics]::FromImage($out)
  $og.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $og.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $og.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $og.Clear([System.Drawing.Color]::Transparent)
  $og.DrawImage($low, ([System.Drawing.Rectangle]::new(0, 0, $width, $height)))

  $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $og.Dispose(); $out.Dispose(); $g.Dispose(); $low.Dispose()
}

function Fill-Poly($g, [string]$color, [object[]]$points, [int]$alpha = 255) {
  $brush = Brush $color $alpha
  $g.FillPolygon($brush, [System.Drawing.Point[]]$points)
  $brush.Dispose()
}

function Draw-WorldMap($g, [int]$w, [int]$h) {
  $rng = [System.Random]::new(1337)
  $g.Clear((C '#142016'))

  for ($i = 0; $i -lt 4800; $i++) {
    $x = $rng.Next(0, $w)
    $y = $rng.Next(0, $h)
    $colors = @('#172716', '#1f321b', '#26351d', '#111a13', '#2d2d22')
    $b = Brush $colors[$rng.Next(0, $colors.Count)] $rng.Next(90, 190)
    $g.FillRectangle($b, $x, $y, $rng.Next(1, 4), $rng.Next(1, 4))
    $b.Dispose()
  }

  $water = Brush '#0b2028' 245
  $waterEdge = Pen '#24424a' 2 210
  $lakes = @(
    @(120, 115, 94, 70),
    @(360, 285, 112, 78),
    @(210, 388, 86, 62)
  )
  foreach ($lake in $lakes) {
    $g.FillEllipse($water, $lake[0] - $lake[2] / 2, $lake[1] - $lake[3] / 2, $lake[2], $lake[3])
    $g.DrawEllipse($waterEdge, $lake[0] - $lake[2] / 2, $lake[1] - $lake[3] / 2, $lake[2], $lake[3])
  }
  $water.Dispose(); $waterEdge.Dispose()

  $roadShadow = Pen '#100c09' 9 190
  $road = Pen '#4a3828' 6 230
  $roadHi = Pen '#6c573d' 2 180
  $paths = @(
    @([System.Drawing.Point]::new(38, 438), [System.Drawing.Point]::new(160, 360), [System.Drawing.Point]::new(280, 205), [System.Drawing.Point]::new(438, 42)),
    @([System.Drawing.Point]::new(16, 240), [System.Drawing.Point]::new(170, 230), [System.Drawing.Point]::new(320, 250), [System.Drawing.Point]::new(468, 232)),
    @([System.Drawing.Point]::new(42, 42), [System.Drawing.Point]::new(120, 98), [System.Drawing.Point]::new(205, 178), [System.Drawing.Point]::new(244, 244)),
    @([System.Drawing.Point]::new(244, 244), [System.Drawing.Point]::new(300, 318), [System.Drawing.Point]::new(390, 390), [System.Drawing.Point]::new(440, 440))
  )
  foreach ($path in $paths) {
    $g.DrawBezier($roadShadow, $path[0], $path[1], $path[2], $path[3])
    $g.DrawBezier($road, $path[0], $path[1], $path[2], $path[3])
    $g.DrawBezier($roadHi, $path[0], $path[1], $path[2], $path[3])
  }
  $roadShadow.Dispose(); $road.Dispose(); $roadHi.Dispose()

  for ($i = 0; $i -lt 260; $i++) {
    $x = $rng.Next(0, $w)
    $y = $rng.Next(0, $h)
    $b = Brush ($(if ($rng.NextDouble() -gt 0.45) { '#26331d' } else { '#232727' })) 210
    $g.FillRectangle($b, $x, $y, $rng.Next(2, 6), $rng.Next(1, 4))
    $b.Dispose()
  }
}

function Draw-TreeCluster($g) {
  $trunk = Brush '#2a1a12'
  $leaf1 = Brush '#102318'
  $leaf2 = Brush '#18402f'
  $glow = Brush '#2d7a69' 180
  foreach ($p in @(@(18,36), @(30,24), @(42,36), @(25,44), @(45,25))) {
    $g.FillRectangle($trunk, $p[0] + 4, $p[1] + 12, 4, 12)
    $g.FillEllipse($leaf1, $p[0], $p[1], 18, 18)
    $g.FillEllipse($leaf2, $p[0] + 4, $p[1] + 3, 12, 10)
    $g.FillRectangle($glow, $p[0] + 9, $p[1] + 9, 2, 2)
  }
  $trunk.Dispose(); $leaf1.Dispose(); $leaf2.Dispose(); $glow.Dispose()
}

function Draw-Building($g, [int]$x, [int]$y, [int]$w, [int]$h, [string]$body = '#2b2420', [string]$roof = '#191313') {
  $b = Brush $body; $r = Brush $roof; $light = Brush '#d79b45'
  $g.FillRectangle($b, $x, $y, $w, $h)
  Fill-Poly $g $roof @([System.Drawing.Point]::new($x - 3, $y), [System.Drawing.Point]::new($x + $w / 2, $y - 8), [System.Drawing.Point]::new($x + $w + 3, $y))
  $g.FillRectangle($light, $x + [Math]::Floor($w / 2) - 2, $y + [Math]::Floor($h / 2), 3, 4)
  $b.Dispose(); $r.Dispose(); $light.Dispose()
}

function Draw-Poi([string]$name, [int]$size, [scriptblock]$draw) {
  Save-PixelImage (Join-Path $assetsRoot $name) $size $size 64 64 $true $draw
}

Draw-Poi 'forest.png' 256 { param($g) Draw-TreeCluster $g }
Draw-Poi 'mountain.png' 256 {
  param($g)
  Fill-Poly $g '#14171a' @([System.Drawing.Point]::new(8,52), [System.Drawing.Point]::new(28,12), [System.Drawing.Point]::new(46,52))
  Fill-Poly $g '#252a2e' @([System.Drawing.Point]::new(22,52), [System.Drawing.Point]::new(43,18), [System.Drawing.Point]::new(58,52))
  Fill-Poly $g '#9ea8aa' @([System.Drawing.Point]::new(28,12), [System.Drawing.Point]::new(23,23), [System.Drawing.Point]::new(34,24))
}
Draw-Poi 'farm.png' 256 {
  param($g)
  $field = Brush '#2b311d'; $line = Pen '#514229' 2
  $g.FillRectangle($field, 8, 34, 48, 22)
  for ($x = 12; $x -lt 56; $x += 9) { $g.DrawLine($line, $x, 35, $x - 9, 55) }
  Draw-Building $g 22 22 20 14 '#332116' '#421719'
  $field.Dispose(); $line.Dispose()
}
Draw-Poi 'hunting-lodge.png' 256 {
  param($g)
  Draw-Building $g 18 30 30 20 '#2a1b13' '#15100c'
  $antler = Pen '#86633c' 2
  $g.DrawLine($antler, 24, 24, 16, 14); $g.DrawLine($antler, 42, 24, 50, 14)
  $antler.Dispose()
}
Draw-Poi 'windmill.png' 256 {
  param($g)
  Draw-Building $g 26 29 16 24 '#27211c' '#14100d'
  $p = Pen '#c2a36b' 3
  $g.DrawLine($p, 34, 27, 34, 7); $g.DrawLine($p, 34, 27, 51, 27); $g.DrawLine($p, 34, 27, 34, 45); $g.DrawLine($p, 34, 27, 17, 27)
  $p.Dispose()
}
Draw-Poi 'crab-trap.png' 256 {
  param($g)
  $water = Brush '#0b2530'; $wood = Pen '#6b4a2e' 3; $trap = Pen '#9a6a3d' 2
  $g.FillEllipse($water, 10, 34, 45, 18)
  $g.DrawLine($wood, 12, 35, 52, 25)
  $g.DrawRectangle($trap, 28, 28, 16, 12)
  $water.Dispose(); $wood.Dispose(); $trap.Dispose()
}
Draw-Poi 'fishing-dock.png' 256 {
  param($g)
  $water = Brush '#0a2430'; $wood = Pen '#6a492e' 4; $net = Pen '#a69173' 1
  $g.FillRectangle($water, 7, 38, 50, 18)
  $g.DrawLine($wood, 12, 32, 54, 32); $g.DrawLine($wood, 20, 26, 20, 44); $g.DrawLine($wood, 38, 26, 38, 44)
  $g.DrawEllipse($net, 40, 18, 10, 12)
  $water.Dispose(); $wood.Dispose(); $net.Dispose()
}
Draw-Poi 'granite-quarry.png' 256 {
  param($g)
  $pit = Brush '#1b1d1f'; $stone = Brush '#555a5e'; $edge = Pen '#848b8e' 2
  $g.FillEllipse($pit, 8, 24, 48, 32)
  $g.FillRectangle($stone, 24, 30, 12, 9); $g.FillRectangle($stone, 38, 38, 10, 8)
  $g.DrawLine($edge, 18, 18, 45, 10); $g.DrawLine($edge, 45, 10, 50, 32)
  $pit.Dispose(); $stone.Dispose(); $edge.Dispose()
}
Draw-Poi 'coffee-plantation.png' 256 {
  param($g)
  $row = Pen '#2f4d27' 3
  for ($y = 34; $y -le 52; $y += 6) { $g.DrawLine($row, 10, $y, 54, $y - 12) }
  Draw-Building $g 24 18 20 12 '#2a2018' '#18110e'
  $row.Dispose()
}
Draw-Poi 'campfire.png' 128 {
  param($g)
  $ash = Brush '#2b2925'; $wood = Pen '#714a2b' 3
  $g.FillEllipse($ash, 18, 38, 30, 12)
  $g.DrawLine($wood, 22, 43, 45, 35); $g.DrawLine($wood, 22, 35, 45, 43)
  Fill-Poly $g '#d75a2a' @([System.Drawing.Point]::new(32,37), [System.Drawing.Point]::new(37,23), [System.Drawing.Point]::new(42,38))
  Fill-Poly $g '#ffd06a' @([System.Drawing.Point]::new(34,37), [System.Drawing.Point]::new(37,29), [System.Drawing.Point]::new(40,38))
  $ash.Dispose(); $wood.Dispose()
}

Save-PixelImage (Join-Path $assetsRoot 'town-harborview-map.png') 512 512 128 128 $true {
  param($g)
  $wall = Pen '#74706a' 5; $water = Brush '#0b2631'
  $g.FillRectangle($water, 6, 88, 116, 28)
  $g.DrawRectangle($wall, 22, 20, 82, 68)
  Draw-Building $g 38 42 18 16; Draw-Building $g 67 36 20 18; Draw-Building $g 52 63 18 16
  $dock = Pen '#6b4a2e' 4; $g.DrawLine($dock, 50, 88, 50, 118); $g.DrawLine($dock, 74, 88, 74, 118)
  $wall.Dispose(); $water.Dispose(); $dock.Dispose()
}

Save-PixelImage (Join-Path $assetsRoot 'town-riverside-map.png') 512 512 128 128 $true {
  param($g)
  $wall = Pen '#74706a' 5; $river = Brush '#0b2631'; $bridge = Pen '#735032' 5
  $g.FillRectangle($river, 0, 54, 128, 20)
  $g.DrawLine($bridge, 18, 64, 110, 64)
  $g.DrawRectangle($wall, 24, 22, 78, 76)
  Draw-Building $g 38 38 18 16; Draw-Building $g 68 42 20 18; Draw-Building $g 54 72 18 16
  $wall.Dispose(); $river.Dispose(); $bridge.Dispose()
}

function Draw-TownBackground([string]$file, [bool]$harbor) {
  Save-PixelImage (Join-Path $assetsRoot $file) 1920 1080 480 270 $false {
    param($g)
    $sky = Brush '#111722'; $ground = Brush '#17120f'; $mist = Brush '#62737d' 80
    $g.FillRectangle($sky, 0, 0, 480, 120)
    $g.FillRectangle($ground, 0, 120, 480, 150)
    for ($i = 0; $i -lt 8; $i++) { Draw-Building $g (30 + $i * 50) (88 + ($i % 3) * 8) 38 42 '#211a18' '#0d0b0a' }
    if ($harbor) {
      $water = Brush '#0b2530'; $dock = Pen '#6b4a2e' 5
      $g.FillRectangle($water, 0, 180, 480, 90)
      for ($x = 40; $x -lt 440; $x += 80) { $g.DrawLine($dock, $x, 150, $x + 28, 260) }
      Fill-Poly $g '#0f0f12' @([System.Drawing.Point]::new(330,162), [System.Drawing.Point]::new(382,148), [System.Drawing.Point]::new(430,162), [System.Drawing.Point]::new(410,178), [System.Drawing.Point]::new(350,178))
    } else {
      $river = Brush '#0c2630'; $bridge = Pen '#5f4733' 8
      $g.FillRectangle($river, 0, 176, 480, 50)
      $g.DrawArc($bridge, 135, 135, 210, 80, 0, 180)
      $g.DrawLine($bridge, 125, 176, 355, 176)
    }
    $g.FillRectangle($mist, 0, 88, 480, 12)
    $sky.Dispose(); $ground.Dispose(); $mist.Dispose()
  }
}
Draw-TownBackground 'town-harborview-bg.png' $true
Draw-TownBackground 'town-riverside-bg.png' $false

Save-PixelImage (Join-Path $assetsRoot 'world-map.png') 1920 1920 480 480 $false { param($g, $w, $h) Draw-WorldMap $g $w $h }

function Draw-Minion([string]$file, [string]$kind, [int]$tier) {
  Save-PixelImage (Join-Path $minionsRoot $file) 256 256 64 64 $true {
    param($g)
    $body = switch ($kind) {
      'wizard' { '#25325a' }
      'knight' { '#5b6066' }
      'templar' { '#d7d0bc' }
      default { '#44314d' }
    }
    $accent = switch ($tier) { 3 { '#d0a64a' } 2 { '#5ba6b5' } default { '#9b9385' } }
    $b = Brush $body; $a = Brush $accent; $dark = Brush '#171111'; $skin = Brush '#c09a75'
    $g.FillEllipse($skin, 26, 10, 12, 13)
    $g.FillRectangle($b, 24, 24, 16, 24)
    $g.FillRectangle($dark, 20, 48, 24, 5)
    if ($kind -eq 'wizard' -or $kind -eq 'priest') {
      Fill-Poly $g $body @([System.Drawing.Point]::new(20,49), [System.Drawing.Point]::new(32,20), [System.Drawing.Point]::new(44,49))
      $p = Pen $accent 2; $g.DrawLine($p, 47, 18, 47, 50); $p.Dispose()
      $g.FillEllipse($a, 43, 14, 8, 8)
    } elseif ($kind -eq 'templar') {
      $g.FillRectangle($a, 30, 25, 4, 20); $g.FillRectangle($a, 25, 32, 14, 4)
      $p = Pen '#6f6f73' 2; $g.DrawLine($p, 45, 22, 45, 48); $p.Dispose()
    } else {
      $p = Pen '#a8adb2' 2; $g.DrawLine($p, 44, 19, 52, 46); $p.Dispose()
      $g.FillEllipse($a, 15, 27, 10, 14)
    }
    $b.Dispose(); $a.Dispose(); $dark.Dispose(); $skin.Dispose()
  }
}

$minionSpecs = @(
  @('wizard-apprentice.png','wizard',1), @('wizard-magus.png','wizard',2), @('wizard-archmage.png','wizard',3),
  @('knight-squire.png','knight',1), @('knight-man-at-arms.png','knight',2), @('knight-champion.png','knight',3),
  @('templar-initiate.png','templar',1), @('templar-crusader.png','templar',2), @('templar-paragon.png','templar',3),
  @('priest-acolyte.png','priest',1), @('priest-cleric.png','priest',2), @('priest-high-priest.png','priest',3)
)
foreach ($spec in $minionSpecs) { Draw-Minion $spec[0] $spec[1] $spec[2] }

function Draw-Equipment([string]$file, [string]$slot, [string]$rarity) {
  Save-PixelImage (Join-Path $equipmentRoot $file) 192 192 64 64 $true {
    param($g)
    $palette = @{
      decent = @('#858078', '#4b4740')
      rare = @('#72b8cf', '#273d52')
      epic = @('#9a5acb', '#281c34')
      legendary = @('#d49d45', '#5b1c1c')
    }[$rarity]
    $main = Brush $palette[0]; $dark = Pen $palette[1] 3; $glow = Pen $palette[0] 2 150
    switch ($slot) {
      'sword' { $g.DrawLine($dark, 18, 52, 48, 15); $g.DrawLine($glow, 22, 48, 50, 12); $g.FillRectangle($main, 15, 48, 15, 4) }
      'shield' { Fill-Poly $g $palette[0] @([System.Drawing.Point]::new(32,12), [System.Drawing.Point]::new(50,20), [System.Drawing.Point]::new(45,48), [System.Drawing.Point]::new(32,56), [System.Drawing.Point]::new(19,48), [System.Drawing.Point]::new(14,20)) }
      'armor' { $g.FillRectangle($main, 20, 18, 24, 34); $g.DrawRectangle($dark, 20, 18, 24, 34) }
      'armor-pants' { $g.FillRectangle($main, 20, 18, 9, 34); $g.FillRectangle($main, 35, 18, 9, 34) }
      'boots' { $g.FillRectangle($main, 17, 34, 14, 13); $g.FillRectangle($main, 34, 34, 14, 13); $g.DrawLine($dark, 17, 47, 52, 47) }
      'gloves' { $g.FillEllipse($main, 15, 25, 16, 20); $g.FillEllipse($main, 35, 25, 16, 20) }
      'helmet' { $g.FillEllipse($main, 18, 15, 28, 24); $g.FillRectangle($main, 17, 30, 30, 12); $g.DrawLine($dark, 22, 31, 43, 31) }
    }
    $main.Dispose(); $dark.Dispose(); $glow.Dispose()
  }
}

$slots = @('sword','shield','armor','armor-pants','boots','gloves','helmet')
$rarities = @('decent','rare','epic','legendary')
foreach ($slot in $slots) {
  foreach ($rarity in $rarities) {
    Draw-Equipment "$slot-$rarity.png" $slot $rarity
  }
}

function Draw-Icon([string]$file, [scriptblock]$draw) {
  Save-PixelImage (Join-Path $iconsRoot $file) 96 96 48 48 $true $draw
}

Draw-Icon 'gold.png' { param($g) $b=Brush '#d4a145'; $g.FillEllipse($b, 8,28,30,12); $g.FillEllipse($b, 14,20,25,12); $b.Dispose() }
Draw-Icon 'xp.png' { param($g) Fill-Poly $g '#4ca7df' @([System.Drawing.Point]::new(24,6), [System.Drawing.Point]::new(34,28), [System.Drawing.Point]::new(24,44), [System.Drawing.Point]::new(14,28)) }
Draw-Icon 'health.png' { param($g) $b=Brush '#b83436'; $g.FillEllipse($b, 9,10,14,14); $g.FillEllipse($b,25,10,14,14); Fill-Poly $g '#b83436' @([System.Drawing.Point]::new(10,20), [System.Drawing.Point]::new(38,20), [System.Drawing.Point]::new(24,40)); $b.Dispose() }
Draw-Icon 'rare-gem.png' { param($g) Fill-Poly $g '#9b65db' @([System.Drawing.Point]::new(24,5), [System.Drawing.Point]::new(41,18), [System.Drawing.Point]::new(34,40), [System.Drawing.Point]::new(14,40), [System.Drawing.Point]::new(7,18)) }
Draw-Icon 'loot-chest.png' { param($g) $b=Brush '#5b3420'; $m=Brush '#d4a145'; $g.FillRectangle($b,8,20,32,18); $g.FillRectangle($m,21,21,6,16); $b.Dispose(); $m.Dispose() }
Draw-Icon 'attack.png' { param($g) $p=Pen '#c4c7c9' 4; $g.DrawLine($p,10,38,38,10); $g.DrawLine($p,10,10,38,38); $p.Dispose() }
Draw-Icon 'defense.png' { param($g) Fill-Poly $g '#77b6c8' @([System.Drawing.Point]::new(24,6), [System.Drawing.Point]::new(39,13), [System.Drawing.Point]::new(35,36), [System.Drawing.Point]::new(24,43), [System.Drawing.Point]::new(13,36), [System.Drawing.Point]::new(9,13)) }
Draw-Icon 'speed.png' { param($g) $p=Pen '#8dd7c8' 4; $g.DrawLine($p,8,34,34,34); $g.DrawLine($p,18,24,40,24); $g.DrawLine($p,26,14,44,14); $p.Dispose() }
Draw-Icon 'magic.png' { param($g) Fill-Poly $g '#8b5fd3' @([System.Drawing.Point]::new(24,5), [System.Drawing.Point]::new(29,19), [System.Drawing.Point]::new(44,19), [System.Drawing.Point]::new(31,28), [System.Drawing.Point]::new(36,43), [System.Drawing.Point]::new(24,34), [System.Drawing.Point]::new(12,43), [System.Drawing.Point]::new(17,28), [System.Drawing.Point]::new(4,19), [System.Drawing.Point]::new(19,19)) }
Draw-Icon 'healing.png' { param($g) $b=Brush '#d8d1b1'; $g.FillRectangle($b,20,8,8,32); $g.FillRectangle($b,8,20,32,8); $b.Dispose() }

Write-Host "Generated dark gothic placeholder assets in $assetsRoot"
