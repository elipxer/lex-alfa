$ErrorActionPreference = 'Stop'
$connectionPath = Join-Path $PSScriptRoot '.runtime/connection.json'
if (-not (Test-Path -LiteralPath $connectionPath)) { Write-Output 'Não há processador registrado.'; exit 0 }
$connection = Get-Content -Raw -LiteralPath $connectionPath | ConvertFrom-Json
$workerInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$connection.pid)"
$expectedPath = Join-Path $PSScriptRoot 'processor/server.py'
if ($workerInfo -and $workerInfo.CommandLine.Contains($expectedPath)) {
    Invoke-RestMethod 'http://127.0.0.1:47831/shutdown' -Method Post -ContentType 'application/json' -Body '{}' -Headers @{ Authorization = "Bearer $($connection.token)" } -TimeoutSec 3 | Out-Null
    Write-Output 'Processador Lex Alfa encerrado.'
} else { Write-Output 'O processador desta pasta não está em execução.' }
