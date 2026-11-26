# Run from the repo root (PowerShell): .\delete-old-files.ps1
$files = @(
  "backend/administration/tests.py",
  "backend/wellbeing/tests.py",
  "frontend/src/App.css",
  "frontend/src/components/AudioDock.jsx",
  "frontend/src/components/MobileMenu.jsx",
  "frontend/src/components/wellbeing/GratitudeTool.jsx",
  "frontend/src/pages/Login.css",
  "frontend/src/pages/PageHeadingPhoto.css",
  "frontend/src/pages/Register.css",
  "src/App.jsx",
  "src/components/AudioPlayer.css",
  "src/components/AudioPlayer.jsx",
  "src/pages/Resources.css",
  "src/pages/Resources.jsx",
  "src/pages/Wellbeing.css",
  "src/pages/Wellbeing.jsx",
  "src/pages/WellbeingHub.css",
)
foreach ($f in $files) { if (Test-Path $f) { Remove-Item $f -Force; Write-Host "deleted $f" } }
if (Test-Path "src") { Remove-Item "src" -Recurse -Force; Write-Host "deleted stray src/ folder" }
