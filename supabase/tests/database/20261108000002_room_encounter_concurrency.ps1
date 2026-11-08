<#
Runs two truly independent PostgreSQL sessions in the local Supabase container.
Both workers are confirmed waiting on a shared advisory-lock barrier before the
coordinator releases them. The RPC then serializes on the room_companions row
and the partial unique index independently prevents duplicate reservations.
#>
[CmdletBinding()]
param([string] $DatabaseUrl = $env:NATIVA_LOCAL_DATABASE_URL)

$ErrorActionPreference = 'Stop'
if (-not $DatabaseUrl) { throw 'Set NATIVA_LOCAL_DATABASE_URL to the local PostgreSQL URL shown by supabase status.' }
$parsedUrl = [Uri]::new($DatabaseUrl)
if ($parsedUrl.Scheme -notin @('postgres', 'postgresql') -or
    $parsedUrl.Host -notin @('localhost', '127.0.0.1') -or
    $parsedUrl.Port -ne 54322 -or $parsedUrl.AbsolutePath -ne '/postgres' -or
    $parsedUrl.Query -or $parsedUrl.Fragment) {
  throw 'Refusing the connection: only localhost or 127.0.0.1:54322/postgres is accepted.'
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) { throw 'Docker CLI is required for independent local PostgreSQL sessions.' }
$containerName = 'supabase_db_NATIVA_Prototipo_Atualizado'
$contextJson = & $docker.Source context inspect 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the active Docker context.' }
try {
  $context = ConvertFrom-Json -InputObject ($contextJson -join [Environment]::NewLine) -ErrorAction Stop
  $contextHost = $context[0].Endpoints.docker.Host
} catch { throw 'Could not read the active Docker endpoint.' }
if ($contextHost -notmatch '^npipe://') { throw 'Refusing to continue: Docker must use a local Windows named pipe.' }
$running = & $docker.Source inspect --format '{{.State.Running}}' $containerName 2>&1
if ($LASTEXITCODE -ne 0 -or $running.Trim() -ne 'true') { throw "Required local container '$containerName' is not running." }
$psqlVersion = & $docker.Source exec $containerName psql --version 2>&1
if ($LASTEXITCODE -ne 0) { throw "Could not run psql in the local container: $psqlVersion" }

$masterId = [guid]::NewGuid().ToString()
$playerId = [guid]::NewGuid().ToString()
$roomId = [guid]::NewGuid().ToString()
$sourceId = [guid]::NewGuid().ToString()
$companionId = [guid]::NewGuid().ToString()
$localId = 'encounter-race-' + [guid]::NewGuid().ToString('N')
$barrierKey = [BitConverter]::ToInt64([guid]::NewGuid().ToByteArray(), 0)
$appNameOne = 'nativa_encounter_worker_1_' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$appNameTwo = 'nativa_encounter_worker_2_' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$claims = '{"sub":"' + $playerId + '","role":"authenticated"}'
$fixtureSql = @"
begin;
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at) values
 ('$masterId','authenticated','authenticated','$masterId@example.test','',now()),
 ('$playerId','authenticated','authenticated','$playerId@example.test','',now());
insert into public.rooms (id,created_by,name) values ('$roomId','$masterId','Encounter concurrency fixture');
insert into public.room_members (room_id,user_id,role) values
 ('$roomId','$masterId','master'), ('$roomId','$playerId','player');
insert into public.nativas (id,owner_id,local_id,format_version,data)
values ('$sourceId','$playerId','$localId',1,jsonb_build_object('id','$localId','name','Concurrent fixture','nivel',1));
insert into public.room_companions (id,room_id,player_id,source_nativa_id,source_local_id,format_version,campaign_data)
values ('$companionId','$roomId','$playerId','$sourceId','$localId',1,jsonb_build_object('id','$localId','name','Concurrent fixture','nivel',1));
commit;
"@

function ConvertTo-WindowsArgument([string] $Value) {
  $builder = [System.Text.StringBuilder]::new()
  [void]$builder.Append([char]34)
  $slashes = 0
  for ($i = 0; $i -lt $Value.Length; $i++) {
    $ch = $Value[$i]
    if ($ch -eq [char]92) { $slashes++; continue }
    if ($ch -eq [char]34) {
      for ($j = 0; $j -lt (2 * $slashes + 1); $j++) { [void]$builder.Append([char]92) }
      [void]$builder.Append([char]34); $slashes = 0; continue
    }
    for ($j = 0; $j -lt $slashes; $j++) { [void]$builder.Append([char]92) }
    $slashes = 0
    [void]$builder.Append($ch)
  }
  for ($j = 0; $j -lt (2 * $slashes); $j++) { [void]$builder.Append([char]92) }
  [void]$builder.Append([char]34)
  return $builder.ToString()
}

function Set-Arguments([Diagnostics.ProcessStartInfo] $Info, [string[]] $Arguments) {
  $quoted = @()
  foreach ($argument in $Arguments) { $quoted += (ConvertTo-WindowsArgument $argument) }
  $Info.Arguments = [string]::Join(' ', [string[]]$quoted)
}

function New-PsqlInfo([string] $ApplicationName = 'nativa_encounter_coordinator') {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $docker.Source
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  Set-Arguments $info @('exec','-i','-e','PGCONNECT_TIMEOUT=5','-e',"PGAPPNAME=$ApplicationName",$containerName,
    'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres')
  return $info
}

function Invoke-LocalSql([string] $Sql, [int] $TimeoutMs = 15000) {
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = New-PsqlInfo
  if (-not $process.Start()) { throw 'Could not start local psql query.' }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  try {
    $process.StandardInput.Write($Sql)
    $process.StandardInput.Close()
    if (-not $process.WaitForExit($TimeoutMs)) {
      $process.Kill(); $process.WaitForExit()
      throw "Local PostgreSQL query exceeded ${TimeoutMs}ms."
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) { throw "Local PostgreSQL query failed ($($process.ExitCode)): $stderr" }
    return $stdout.Trim()
  } finally {
    if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
    $process.Dispose()
  }
}

function Start-Worker([string] $ApplicationName) {
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = New-PsqlInfo $ApplicationName
  if (-not $process.Start()) { throw "Could not start worker $ApplicationName." }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $sql = @"
begin;
select set_config('request.jwt.claims','$claims',true);
select pg_advisory_xact_lock_shared($barrierKey);
select public.start_room_encounter('$roomId',array['$companionId']::uuid[])->>'status';
commit;
"@
  $process.StandardInput.Write($sql)
  $process.StandardInput.Close()
  return [pscustomobject]@{ Process=$process; Stdout=$stdoutTask; Stderr=$stderrTask; Name=$ApplicationName }
}

function Stop-ProcessSafely([Diagnostics.Process] $Process) {
  if ($Process -and -not $Process.HasExited) { $Process.Kill(); $Process.WaitForExit() }
}

$fixturePossible = $true
$coordinator = $null
$coordinatorError = $null
$coordinatorHeld = $false
$workers = @()
$primaryFailure = $null
$cleanupFailure = $null
try {
  Invoke-LocalSql $fixtureSql | Out-Null

  $coordinator = [Diagnostics.Process]::new()
  $coordinator.StartInfo = New-PsqlInfo
  if (-not $coordinator.Start()) { throw 'Could not start coordinator connection.' }
  $coordinatorError = $coordinator.StandardError.ReadToEndAsync()
  $coordinator.StandardInput.WriteLine("select pg_advisory_lock($barrierKey); select 'COORDINATOR_READY';")
  $readyTask = $coordinator.StandardOutput.ReadLineAsync()
  if (-not $readyTask.Wait(15000)) { throw 'Coordinator did not acquire the advisory lock before timeout.' }
  $readyLine = $readyTask.GetAwaiter().GetResult()
  $secondReadyTask = $coordinator.StandardOutput.ReadLineAsync()
  if (-not $secondReadyTask.Wait(15000) -or $secondReadyTask.GetAwaiter().GetResult() -ne 'COORDINATOR_READY') {
    throw 'Coordinator readiness marker was not received.'
  }
  $coordinatorHeld = $true

  $workers += Start-Worker $appNameOne
  $workers += Start-Worker $appNameTwo
  $barrierReady = $false
  for ($attempt = 0; $attempt -lt 150; $attempt++) {
    $waitCount = Invoke-LocalSql "select count(*) from pg_stat_activity where application_name in ('$appNameOne','$appNameTwo') and state='active' and wait_event='advisory' and query like '%pg_advisory_xact_lock_shared%';"
    if ([int]$waitCount -eq 2) { $barrierReady = $true; break }
    Start-Sleep -Milliseconds 200
  }
  if (-not $barrierReady) { throw 'Both workers did not reach the advisory-lock barrier.' }
  Write-Output 'Barrier confirmed: both independent workers are waiting on the shared advisory lock.'

  $coordinator.StandardInput.WriteLine("select pg_advisory_unlock($barrierKey); select 'COORDINATOR_RELEASED';")
  $unlockLine = $coordinator.StandardOutput.ReadLineAsync()
  if (-not $unlockLine.Wait(10000)) { throw 'Coordinator did not return from advisory unlock.' }
  $unlocked = $unlockLine.GetAwaiter().GetResult()
  $releaseMarker = $coordinator.StandardOutput.ReadLineAsync()
  if (-not $releaseMarker.Wait(10000) -or $releaseMarker.GetAwaiter().GetResult() -ne 'COORDINATOR_RELEASED') {
    throw 'Coordinator release marker was not received.'
  }
  if ($unlocked -ne 't') { throw 'Coordinator failed to release the exclusive advisory lock.' }
  $coordinatorHeld = $false

  $results = @()
  foreach ($worker in $workers) {
    if (-not $worker.Process.WaitForExit(30000)) { throw "Worker $($worker.Name) exceeded its timeout." }
    $stdout = $worker.Stdout.GetAwaiter().GetResult()
    $stderr = $worker.Stderr.GetAwaiter().GetResult()
    if ($worker.Process.ExitCode -ne 0) { throw "Worker $($worker.Name) failed ($($worker.Process.ExitCode)): $stderr" }
    $statuses = @($stdout -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -in @('started','companion_busy') })
    if ($statuses.Count -ne 1) { throw "Worker $($worker.Name) returned an unexpected RPC result." }
    $results += $statuses[0]
  }
  $saved = @($results | Where-Object { $_ -eq 'started' }).Count
  $busy = @($results | Where-Object { $_ -eq 'companion_busy' }).Count
  if ($saved -ne 1 -or $busy -ne 1) { throw "Expected one started and one companion_busy; got started=$saved, companion_busy=$busy." }

  $state = Invoke-LocalSql "select (select count(*) from public.room_encounters where room_id='$roomId' and status='active')::text || '|' || (select count(*) from public.room_encounter_participants where room_id='$roomId' and companion_id='$companionId' and released_at is null)::text;"
  if ($state -ne '1|1') { throw "Unexpected final local state '$state'; expected exactly one active encounter and reservation." }
  Write-Output "Worker results: $($results -join ', ')"
  Write-Output 'Final fixture state: one active encounter and one active reservation.'
} catch {
  $primaryFailure = $_
} finally {
  if ($coordinatorHeld -and $coordinator -and -not $coordinator.HasExited) {
    try { $coordinator.StandardInput.WriteLine("select pg_advisory_unlock($barrierKey);"); $coordinator.StandardInput.Close() }
    catch { $cleanupFailure = "Could not release the test advisory lock: $($_.Exception.Message)" }
  }
  foreach ($worker in $workers) {
    try { Stop-ProcessSafely $worker.Process }
    catch { if (-not $cleanupFailure) { $cleanupFailure = "Could not stop a test worker: $($_.Exception.Message)" } }
    try { if ($worker.Process) { $worker.Process.Dispose() } } catch {}
  }
  try {
    if ($coordinator) {
      if (-not $coordinator.HasExited) { $coordinator.StandardInput.Close(); if (-not $coordinator.WaitForExit(5000)) { $coordinator.Kill(); $coordinator.WaitForExit() } }
      $coordinator.Dispose()
    }
  } catch { if (-not $cleanupFailure) { $cleanupFailure = "Could not close coordinator: $($_.Exception.Message)" } }
  if ($fixturePossible) {
    try {
      $cleanupSql = @"
begin;
delete from public.rooms where id='$roomId';
delete from public.nativas where id='$sourceId';
delete from auth.users where id in ('$masterId','$playerId');
commit;
"@
      Invoke-LocalSql $cleanupSql | Out-Null
      Write-Output 'Fixture cleanup completed for only the generated room, source Nativa and two generated users.'
    } catch { if (-not $cleanupFailure) { $cleanupFailure = "Fixture cleanup failed: $($_.Exception.Message)" } }
  }
}

if ($primaryFailure) { throw $primaryFailure }
if ($cleanupFailure) { throw $cleanupFailure }
