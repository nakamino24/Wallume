Add-Type -AssemblyName System.Drawing

function New-WallumeAsset([string]$Path, [int]$Size, [string]$Background, [string]$Foreground, [float]$MarkScale) {
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($Background))

  $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($Foreground), ($Size * 0.125))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $offset = ($Size * (1 - $MarkScale)) / 2
  $scale = $Size * $MarkScale / 48
  $points = New-Object 'System.Drawing.PointF[]' 5
  $points[0] = New-Object System.Drawing.PointF([float]($offset + (8 * $scale)), [float]($offset + (11.5 * $scale)))
  $points[1] = New-Object System.Drawing.PointF([float]($offset + (15.5 * $scale)), [float]($offset + (34.5 * $scale)))
  $points[2] = New-Object System.Drawing.PointF([float]($offset + (24 * $scale)), [float]($offset + (19 * $scale)))
  $points[3] = New-Object System.Drawing.PointF([float]($offset + (32.5 * $scale)), [float]($offset + (34.5 * $scale)))
  $points[4] = New-Object System.Drawing.PointF([float]($offset + (40 * $scale)), [float]($offset + (11.5 * $scale)))
  $graphics.DrawLines($pen, [System.Drawing.PointF[]]$points)
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$images = Join-Path $PSScriptRoot '..\assets\images'
New-WallumeAsset (Join-Path $images 'icon.png') 1024 '#164B43' '#FFFFFF' 0.72
New-WallumeAsset (Join-Path $images 'adaptive-icon.png') 1024 '#164B43' '#FFFFFF' 0.48
New-WallumeAsset (Join-Path $images 'splash-logo.png') 512 '#F6F7F3' '#164B43' 0.56
New-WallumeAsset (Join-Path $images 'favicon.png') 64 '#164B43' '#FFFFFF' 0.72
