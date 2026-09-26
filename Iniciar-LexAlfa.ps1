$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$runtimePath = Join-Path $taskRoot '.runtime'
New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
$connectionPath = Join-Path $runtimePath 'connection.json'
if (Test-Path -LiteralPath $connectionPath) {
    try {
        $connection = Get-Content -Raw -LiteralPath $connectionPath | ConvertFrom-Json
        $health = Invoke-RestMethod 'http://127.0.0.1:47831/health' -Headers @{ Authorization = "Bearer $($connection.token)" } -TimeoutSec 2
        if ($health.app -eq 'lex-alfa') { Write-Output 'Processador Lex Alfa já está em execução.'; exit 0 }
    } catch { }
}
$pythonPath = (Get-Command python -ErrorAction Stop).Source
Get-Command ffmpeg -ErrorAction Stop | Out-Null
Get-Command ffprobe -ErrorAction Stop | Out-Null
$serverPath = Join-Path $taskRoot 'processor/server.py'
$workerProcess = Start-Process -FilePath $pythonPath -ArgumentList @('"' + $serverPath + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'server.log') -RedirectStandardError (Join-Path $runtimePath 'server-error.log') -PassThru
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    $workerProcess.Refresh()
    if ($workerProcess.HasExited) { throw 'O processador não iniciou. Consulte .runtime/server-error.log (a porta 47831 pode estar em uso).' }
    try {
        $connection = Get-Content -Raw -LiteralPath $connectionPath | ConvertFrom-Json
        if ($connection.pid -ne $workerProcess.Id) { continue }
        $health = Invoke-RestMethod 'http://127.0.0.1:47831/health' -Headers @{ Authorization = "Bearer $($connection.token)" } -TimeoutSec 1
        if ($health.app -eq 'lex-alfa') { Write-Output 'Processador conectado. No painel, clique em Verificar processador.'; exit 0 }
    } catch { }
}
throw 'O processador ainda não respondeu. Consulte .runtime/server-error.log.'
