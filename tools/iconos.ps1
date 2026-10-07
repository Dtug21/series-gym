# Genera el ícono de la app y las pantallas de carga de iPhone (anillo del temporizador sobre fondo oscuro).
# Uso: powershell -ExecutionPolicy Bypass -File tools\iconos.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$icons = Join-Path $root 'icons'; New-Item -ItemType Directory -Force $icons | Out-Null
$splash = Join-Path $root 'splash'; New-Item -ItemType Directory -Force $splash | Out-Null
$teal = [System.Drawing.Color]::FromArgb(47,211,193)

function Draw-Ring($g, [single]$cx, [single]$cy, [single]$r, [single]$w) {
  # Pista
  $track = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(34,255,255,255)), $w
  $g.DrawEllipse($track, $cx-$r, $cy-$r, 2*$r, 2*$r)
  # Brillo suave bajo el arco
  foreach ($k in 6,5,4,3,2,1) {
    $glow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(7,47,211,193)), ($w*(1+$k*0.28))
    $glow.StartCap='Round'; $glow.EndCap='Round'
    $g.DrawArc($glow, $cx-$r, $cy-$r, 2*$r, 2*$r, -90, 270)
  }
  # Arco turquesa (3/4 del tiempo)
  $arc = New-Object System.Drawing.Pen $teal, $w
  $arc.StartCap='Round'; $arc.EndCap='Round'
  $g.DrawArc($arc, $cx-$r, $cy-$r, 2*$r, 2*$r, -90, 270)
  # Punto blanco donde va el tiempo
  $kx = $cx - $r; $ky = $cy; $kr = $w*0.82
  $sh = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70,0,0,0))
  $g.FillEllipse($sh, $kx-$kr, $ky-$kr+$w*0.18, 2*$kr, 2*$kr)
  $g.FillEllipse([System.Drawing.Brushes]::White, $kx-$kr, $ky-$kr, 2*$kr, 2*$kr)
}
function Fill-Bg($g, [int]$w, [int]$h, [single]$cx, [single]$cy) {
  $g.Clear([System.Drawing.Color]::FromArgb(11,17,18))
  # Brillo turquesa muy suave alrededor del anillo
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $R = [Math]::Max($w,$h)*0.55
  $path.AddEllipse($cx-$R, $cy-$R, 2*$R, 2*$R)
  $pg = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
  $pg.CenterColor = [System.Drawing.Color]::FromArgb(40,47,211,193)
  $pg.SurroundColors = @([System.Drawing.Color]::FromArgb(0,47,211,193))
  $g.FillRectangle($pg, 0, 0, $w, $h)
}

# Íconos
foreach ($p in @(@(1024,'icon-1024.png'),@(512,'icon-512.png'),@(192,'icon-192.png'),@(180,'apple-touch-icon.png'))) {
  $s=$p[0]; $bmp=New-Object System.Drawing.Bitmap $s,$s; $g=[System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode='AntiAlias'
  Fill-Bg $g $s $s ($s/2) ($s/2)
  Draw-Ring $g ($s/2) ($s/2) ($s*0.27) ($s*0.068)
  $bmp.Save((Join-Path $icons $p[1]), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
}
# Ícono "maskable" (Android): anillo más chico para que no lo corte la máscara
$s=512; $bmp=New-Object System.Drawing.Bitmap $s,$s; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode='AntiAlias'
Fill-Bg $g $s $s ($s/2) ($s/2); Draw-Ring $g ($s/2) ($s/2) ($s*0.22) ($s*0.056)
$bmp.Save((Join-Path $icons 'icon-maskable-512.png'), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()

# Pantallas de carga (ancho, alto en píxeles reales)
$sizes = @(@(1320,2868),@(1290,2796),@(1206,2622),@(1179,2556),@(1284,2778),@(1170,2532),@(1125,2436),@(1242,2688),@(828,1792),@(750,1334))
foreach ($z in $sizes) {
  $w=$z[0]; $h=$z[1]; $bmp=New-Object System.Drawing.Bitmap $w,$h; $g=[System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode='AntiAlias'; $g.TextRenderingHint='AntiAliasGridFit'
  $cx=$w/2; $cy=$h*0.44
  Fill-Bg $g $w $h $cx $cy
  Draw-Ring $g $cx $cy ($w*0.17) ($w*0.034)
  $font = New-Object System.Drawing.Font 'Segoe UI Semibold', ([single]($w*0.062)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment='Center'
  $g.DrawString('Series', $font, [System.Drawing.Brushes]::White, $cx, ($cy + $w*0.26), $fmt)
  $bmp.Save((Join-Path $splash "splash-$w`x$h.png"), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
}
Get-ChildItem $icons, $splash | Select-Object Name, Length | Format-Table -AutoSize
