# makepackage.ps1
# Packages all necessary Firefox extension files into bookmark-bar-auditor.zip


$files = @(
    "manifest.json",
    "background.js",
    "LICENSE",
    "README.md",
    "popup.html",
    "popup.js"
)

Compress-Archive -Path $files -DestinationPath bookmark-bar-auditor.zip -Force
Write-Host "Packaged bookmark-bar-auditor.zip with: $($files -join ', ')"
