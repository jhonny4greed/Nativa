<#
Runs two save_nativa calls using independent psql connections against the
already-running local Supabase database. A coordinator holds an exclusive
advisory lock until both workers are confirmed waiting for a shared lock on
that key, then releases them together. No reset or remote connection is used.
Set NATIVA_LOCAL_DATABASE_URL to the local database URL shown by `supabase status`.
#>
[CmdletBinding()]
param([string] $DatabaseUrl = $env:NATIVA_LOCAL_DATABASE_URL)

$ErrorActionPreference = 'Stop'
if (-not $DatabaseUrl) { throw 'Set NATIVA_LOCAL_DATABASE_URL to the local database URL from `supabase status`.' }
$parsedUrl = [Uri]::new($DatabaseUrl)
if ($parsedUrl.Scheme -notin @('postgres', 'postgresql') -or
    $parsedUrl.Host -notin @('localhost', '127.0.0.1') -or
    $parsedUrl.Port -ne 54322 -or $parsedUrl.AbsolutePath -ne '/postgres' -or
    $parsedUrl.Query -or $parsedUrl.Fragment) {
  throw 'Refusing the connection: only localhost or 127.0.0.1:54322/postgres is accepted.'
}
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) { throw 'Docker CLI is required to open independent psql sessions in the local Supabase container.' }
$containerName = 'supabase_db_NATIVA_Prototipo_Atualizado'
$dockerContextJson = & $docker.Source context inspect 2>$null
if ($LASTEXITCODE -ne 0) {
  throw 'Could not inspect the active Docker context.'
}
try {
  $dockerContext = ConvertFrom-Json -InputObject ($dockerContextJson -join [Environment]::NewLine) -ErrorAction Stop
  $dockerContextHost = $dockerContext[0].Endpoints.docker.Host
} catch {
  throw 'Could not read the Docker endpoint from the active context.'
}
if ($dockerContextHost -notmatch '^npipe://') {
  throw 'Refusing to continue: the active Docker context must use a local Windows named pipe.'
}
$containerRunning = & $docker.Source inspect --format '{{.State.Running}}' $containerName 2>&1
if ($LASTEXITCODE -ne 0 -or $containerRunning.Trim() -ne 'true') {
  throw "The required local Supabase container '$containerName' is not running."
}
$psqlVersion = & $docker.Source exec $containerName psql --version 2>&1
if ($LASTEXITCODE -ne 0) { throw "Could not run psql inside the local container: $psqlVersion" }

$ownerId = [guid]::NewGuid().ToString()
$localId = 'sync-race-' + [guid]::NewGuid().ToString('N')
$operationOne = [guid]::NewGuid().ToString()
$operationTwo = [guid]::NewGuid().ToString()
$runMarker = 'NATIVASYNCGATE' + [guid]::NewGuid().ToString('N')
$barrierKey = [BitConverter]::ToInt64([guid]::NewGuid().ToByteArray(), 0)
$email = "$ownerId@example.test"
$fixtureSql = @"
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('$ownerId','authenticated','authenticated','$email','',now());
insert into public.nativas (owner_id, local_id, format_version, data)
values ('$ownerId','$localId',1,jsonb_build_object('id','$localId','name','before race'));
"@

function ConvertTo-WindowsCommandLineArgument([string] $Value) {
  # Escape an argument using the quoting rules consumed by Windows processes.
  # Quoting every argument also keeps spaces and embedded quotes unambiguous.
  $builder = [System.Text.StringBuilder]::new()
  [void]$builder.Append([char]34)
  $backslashCount = 0
  for ($index = 0; $index -lt $Value.Length; $index++) {
    $character = $Value[$index]
    if ($character -eq [char]92) {
      $backslashCount++
      continue
    }
    if ($character -eq [char]34) {
      for ($slash = 0; $slash -lt (2 * $backslashCount + 1); $slash++) {
        [void]$builder.Append([char]92)
      }
      [void]$builder.Append([char]34)
      $backslashCount = 0
      continue
    }
    for ($slash = 0; $slash -lt $backslashCount; $slash++) {
      [void]$builder.Append([char]92)
    }
    $backslashCount = 0
    [void]$builder.Append($character)
  }
  for ($slash = 0; $slash -lt (2 * $backslashCount); $slash++) {
    [void]$builder.Append([char]92)
  }
  [void]$builder.Append([char]34)
  return $builder.ToString()
}

function Set-ProcessArguments([Diagnostics.ProcessStartInfo] $Info, [string[]] $Arguments) {
  $quotedArguments = @()
  foreach ($argument in $Arguments) {
    $quotedArguments += (ConvertTo-WindowsCommandLineArgument $argument)
  }
  $Info.Arguments = [string]::Join(' ', [string[]]$quotedArguments)
}

function New-LocalPsqlInfo {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $docker.Source
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  # -i is required for the coordinator's persistent SQL session. Redirect stdin
  # for all sessions; one-shot workers close it immediately after starting.
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  # Environment is passed as a Docker CLI option, not through the newer
  # ProcessStartInfo.Environment dictionary unavailable in .NET Framework.
  Set-ProcessArguments $info @('exec', '-i', '-e', 'PGCONNECT_TIMEOUT=3', $containerName,
    'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1')
  return $info
}

function Invoke-LocalSql([string] $Sql, [int] $TimeoutMs = 10000) {
  $info = New-LocalPsqlInfo
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $info
  if (-not $process.Start()) { throw 'Could not start local psql.' }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  try {
    $process.StandardInput.Write($Sql)
    $process.StandardInput.Close()
    if (-not $process.WaitForExit($TimeoutMs)) {
      $process.Kill()
      $process.WaitForExit()
      throw "Local psql command exceeded timeout ${TimeoutMs}ms."
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) { throw "Local psql command failed ($($process.ExitCode)): $stderr" }
    return $stdout.Trim()
  } finally {
    if (-not $process.HasExited) {
      $process.Kill()
      $process.WaitForExit()
    }
    $process.Dispose()
  }
}

function Stop-IfRunning([Diagnostics.Process] $Process) {
  if ($Process -and -not $Process.HasExited) {
    $Process.Kill()
    $Process.WaitForExit()
  }
}

$fixtureCreated = $false
$gateProcess = $null
$gateErrorTask = $null
$gateHeld = $false
$workers = @()
try {
  $fixtureCreated = $true
  Invoke-LocalSql $fixtureSql | Out-Null

  # Keep this session open: its exclusive lock blocks both workers' shared
  # transaction locks until pg_stat_activity confirms they are both waiting.
  $gateInfo = New-LocalPsqlInfo
  $gateProcess = [Diagnostics.Process]::new()
  $gateProcess.StartInfo = $gateInfo
  if (-not $gateProcess.Start()) { throw 'Could not start the local advisory-lock coordinator.' }
  $gateErrorTask = $gateProcess.StandardError.ReadToEndAsync()
  $gateProcess.StandardInput.WriteLine("select pg_advisory_lock($barrierKey); select 'gate-held';")
  $gateProcess.StandardInput.Flush()
  $gateAck = $null
  $gateDeadline = [DateTime]::UtcNow.AddSeconds(5)
  $lineTask = $gateProcess.StandardOutput.ReadLineAsync()
  while ([DateTime]::UtcNow -lt $gateDeadline -and -not $gateProcess.HasExited) {
    if (-not $lineTask.Wait(250)) { continue }
    $gateLine = $lineTask.GetAwaiter().GetResult()
    if ($null -eq $gateLine) { break }
    if ($gateLine -eq 'gate-held') { $gateAck = $gateLine; break }
    $lineTask = $gateProcess.StandardOutput.ReadLineAsync()
  }
  if ($gateAck -ne 'gate-held') { throw 'Coordinator did not confirm acquisition of the exclusive barrier lock.' }
  $gateHeld = $true

  $workerSql = @(
    @"
begin;
set local statement_timeout = '45s';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"$ownerId","role":"authenticated"}',true);
select pg_advisory_xact_lock_shared($barrierKey) /* ${runMarker}_A */;
select public.save_nativa('$operationOne','$localId',1,
  jsonb_build_object('id','$localId','name','first writer'),1)->>'status';
commit;
"@,
    @"
begin;
set local statement_timeout = '45s';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"$ownerId","role":"authenticated"}',true);
select pg_advisory_xact_lock_shared($barrierKey) /* ${runMarker}_B */;
select public.save_nativa('$operationTwo','$localId',1,
  jsonb_build_object('id','$localId','name','second writer'),1)->>'status';
commit;
"@
  )

  foreach ($sql in $workerSql) {
    $info = New-LocalPsqlInfo
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    if (-not $process.Start()) { throw 'Could not start an independent local psql worker.' }
    $worker = [pscustomobject]@{
      Process = $process
      StdoutTask = $process.StandardOutput.ReadToEndAsync()
      StderrTask = $process.StandardError.ReadToEndAsync()
    }
    $workers += $worker
    $process.StandardInput.Write($sql)
    $process.StandardInput.Close()
  }

  # Verify both distinct worker statements are actively blocked on the same
  # coordinator lock before releasing it. Polling delay is not the barrier.
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  $readyCount = 0
  while ([DateTime]::UtcNow -lt $deadline) {
    $readyCount = [int](Invoke-LocalSql @"
select count(*) from pg_stat_activity
where datname = current_database()
  and wait_event_type = 'Lock'
  and query like '%$runMarker%';
"@).Trim()
    if ($readyCount -eq 2) { break }
    Start-Sleep -Milliseconds 100
  }
  if ($readyCount -ne 2) { throw "Both workers did not reach the lock barrier; observed $readyCount of 2." }

  $gateProcess.StandardInput.WriteLine("select pg_advisory_unlock($barrierKey);")
  $gateProcess.StandardInput.Flush()
  $unlockTask = $gateProcess.StandardOutput.ReadLineAsync()
  if (-not $unlockTask.Wait(5000) -or $unlockTask.GetAwaiter().GetResult() -ne 't') {
    throw 'Coordinator failed to confirm release of the exclusive barrier lock.'
  }
  $gateHeld = $false
  $gateProcess.StandardInput.WriteLine('\q')
  $gateProcess.StandardInput.Flush()
  if (-not $gateProcess.WaitForExit(5000)) { throw 'Coordinator did not close after releasing the barrier.' }

  foreach ($worker in $workers) {
    if (-not $worker.Process.WaitForExit(20000)) {
      throw 'A worker exceeded its completion timeout after barrier release.'
    }
  }

  $statuses = foreach ($worker in $workers) {
    $stdout = $worker.StdoutTask.GetAwaiter().GetResult()
    $stderr = $worker.StderrTask.GetAwaiter().GetResult()
    if ($worker.Process.ExitCode -ne 0) { throw "Worker failed ($($worker.Process.ExitCode)): $stderr" }
    @($stdout -split "`r?`n" | Where-Object { $_.Trim() })[-1].Trim()
  }
  if (@($statuses | Where-Object { $_ -eq 'saved' }).Count -ne 1 -or
      @($statuses | Where-Object { $_ -eq 'conflict' }).Count -ne 1) {
    throw "Expected exactly one saved result and one conflict; got: $($statuses -join ', ')."
  }

  $actual = Invoke-LocalSql @"
select revision || ':' || case
  when data = jsonb_build_object('id','$localId','name','first writer') then 'first writer'
  when data = jsonb_build_object('id','$localId','name','second writer') then 'second writer'
  else 'unexpected payload'
end
from public.nativas where owner_id='$ownerId' and local_id='$localId';
"@
  if ($actual -notin @('2:first writer', '2:second writer')) {
    throw "Expected one complete winning payload at revision 2; got '$actual'."
  }
  Write-Output 'PASS: both independent connections reached the shared-lock barrier before release.'
  Write-Output 'PASS: exactly one save committed and the other received a revision conflict.'
  Write-Output 'PASS: revision advanced once and the complete final JSON matches the accepted payload.'
}
finally {
  if ($gateProcess) {
    if (-not $gateProcess.HasExited) {
      if ($gateHeld) {
        try {
          $gateProcess.StandardInput.WriteLine("select pg_advisory_unlock($barrierKey);")
          $gateProcess.StandardInput.Flush()
          $unlockTask = $gateProcess.StandardOutput.ReadLineAsync()
          [void]$unlockTask.Wait(5000)
        } catch { }
        $gateHeld = $false
      }
      try { $gateProcess.StandardInput.WriteLine('\q'); $gateProcess.StandardInput.Flush() } catch { }
      if (-not $gateProcess.WaitForExit(5000)) { $gateProcess.Kill() }
    }
    $gateProcess.Dispose()
  }
  foreach ($worker in $workers) {
    if (-not $worker.Process.HasExited) { Stop-IfRunning $worker.Process }
    $worker.Process.Dispose()
  }
  if ($gateErrorTask -and $gateErrorTask.IsCompleted) { [void]$gateErrorTask.GetAwaiter().GetResult() }
  if ($fixtureCreated) { Invoke-LocalSql "delete from auth.users where id='$ownerId';" | Out-Null }
}
