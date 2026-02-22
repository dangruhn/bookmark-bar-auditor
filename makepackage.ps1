# makepackage.ps1
# Packages all necessary Firefox extension files into favicon-refresher.zip


$files = @(
    "manifest.json",
    "background.js",
    "LICENSE",
    "README.md",
    "popup.html",
    "popup.js"
)

Compress-Archive -Path $files -DestinationPath favicon-refresher.zip -Force
Write-Host "Packaged favicon-refresher.zip with: $($files -join ', ')"
