$DownloadsDir = "C:\Users\0000\Downloads"
$TargetDir = "C:\Users\0000\AGABY_2026\00_INBOX"
$LogFile = "C:\Users\0000\AGABY_2026\00_INBOX\Cleanup_Log.txt"
$TimeLimit = (Get-Date).AddHours(-48)

if (-not (Test-Path $TargetDir)) { New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null }

$FilesToMove = Get-ChildItem -Path $DownloadsDir -File -Recurse | Where-Object { $_.LastWriteTime -lt $TimeLimit }

if ($FilesToMove.Count -gt 0) {
    Add-Content -Path $LogFile -Value "--- Nettoyage du $(Get-Date) ---"
    foreach ($file in $FilesToMove) {
        try {
            $currentDate = (Get-Date).ToString('yyyyMMdd')
            
            # Check if filename already starts with 8 digits
            if ($file.Name -match '^\d{8}') {
                $NewName = $file.Name
            } else {
                $NewName = "$currentDate_$($file.Name)"
            }
            
            $DestinationPath = Join-Path $TargetDir $NewName
            
            # Ensure unique name to avoid overwriting
            $Counter = 1
            while (Test-Path $DestinationPath) {
                $NameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($NewName)
                $Ext = [System.IO.Path]::GetExtension($NewName)
                $DestinationPath = Join-Path $TargetDir ("$NameWithoutExt" + "_$Counter" + "$Ext")
                $Counter++
            }

            Move-Item -Path $file.FullName -Destination $DestinationPath -Force
            Add-Content -Path $LogFile -Value "Moved: $($file.Name) -> $(Split-Path $DestinationPath -Leaf)"
        } catch {
            Add-Content -Path $LogFile -Value "Failed to move: $($file.Name) - $_"
        }
    }
}
