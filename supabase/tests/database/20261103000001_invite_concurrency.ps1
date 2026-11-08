<#
Runs a real last-invite-use race against an already-started, local Supabase DB.
Supply only the local URL shown by `supabase status`; non-local hosts are rejected.
The two join attempts use separate psql processes and independent connections.
If host psql is absent, the script runs psql inside the one local Supabase DB container
through the local Docker Desktop context.
#>
[CmdletBinding()]
param(
  [Parameter()]
  [string] $DatabaseUrl = $env:NATIVA_LOCAL_DATABASE_URL,
  [Parameter()]
  [string] $DatabaseContainer = $env:NATIVA_LOCAL_DB_CONTAINER
)

$ErrorActionPreference = 'Stop'

if (-not $DatabaseUrl) {
  throw 'Set NATIVA_LOCAL_DATABASE_URL to the local database URL from `supabase status`.'
}
$parsedUrl = [Uri]::new($DatabaseUrl)
if ($parsedUrl.Host -notin @('localhost', '127.0.0.1', '::1')) {
  throw "Refusing non-local database host '$($parsedUrl.Host)'. No remote database is allowed."
}
$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
$dockerCommand = Get-Command docker.exe,docker -ErrorAction SilentlyContinue | Select-Object -First 1
$useDocker = -not $psqlCommand
if ($useDocker) {
  if (-not $dockerCommand) {
    throw 'Neither psql nor Docker CLI is available to open the local test connections.'
  }

  $dockerContext = (& $dockerCommand.Source context inspect --format '{{.Endpoints.docker.Host}}' 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $dockerContext -notmatch '^(npipe:|unix://)') {
    throw "Refusing a Docker context that is not a local named pipe/socket: '$dockerContext'."
  }

  if (-not $DatabaseContainer) {
    $containers = @(& $dockerCommand.Source ps --filter 'name=^/supabase_db_' --format '{{.Names}}')
    if ($LASTEXITCODE -ne 0 -or $containers.Count -ne 1) {
      throw 'Set NATIVA_LOCAL_DB_CONTAINER when exactly one running local Supabase database container cannot be identified.'
    }
    $DatabaseContainer = $containers[0].Trim()
  }
  $knownContainers = @(& $dockerCommand.Source ps --filter "name=^/$([regex]::Escape($DatabaseContainer))$" --format '{{.Names}}')
  if ($LASTEXITCODE -ne 0 -or $knownContainers -notcontains $DatabaseContainer) {
    throw "The selected database container '$DatabaseContainer' is not running on the local Docker context."
  }
}

$masterId = [guid]::NewGuid().ToString()
$playerOneId = [guid]::NewGuid().ToString()
$playerTwoId = [guid]::NewGuid().ToString()
$roomId = [guid]::NewGuid().ToString()
$inviteId = [guid]::NewGuid().ToString()
$token = 'concurrency-' + [guid]::NewGuid().ToString('N') + '-invite-token'
$tokenSql = $token.Replace("'", "''")
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('nativa-invite-race-' + [guid]::NewGuid().ToString('N'))
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
$tempRootFull = [IO.Path]::GetFullPath($tempRoot)
if (-not $tempRootFull.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing temporary directory outside the system temp root: '$tempRootFull'."
}
New-Item -ItemType Directory -Path $tempRoot | Out-Null

function Invoke-LocalSql([string] $Sql) {
  if ($useDocker) {
    & $dockerCommand.Source exec $DatabaseContainer psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -At -c $Sql
  } else {
    & $psqlCommand.Source --dbname $DatabaseUrl -X -q -v ON_ERROR_STOP=1 -At -c $Sql
  }
  if ($LASTEXITCODE -ne 0) { throw "Local psql command failed with exit code $LASTEXITCODE." }
}

$fixtureSql = @"
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at) values
('$masterId','authenticated','authenticated','$masterId@example.test','',now()),
('$playerOneId','authenticated','authenticated','$playerOneId@example.test','',now()),
('$playerTwoId','authenticated','authenticated','$playerTwoId@example.test','',now());
insert into public.rooms (id, created_by, name) values ('$roomId','$masterId','invite concurrency test');
insert into public.room_members (room_id,user_id,role) values ('$roomId','$masterId','master');
insert into public.room_state (room_id,revision,state,updated_by) values ('$roomId',0,'{}','$masterId');
insert into public.room_events (room_id,revision,actor_id,event_type) values ('$roomId',0,'$masterId','room_created');
insert into public.room_invites (id,room_id,kind,token_hash,created_by,expires_at,max_uses)
values ('$inviteId','$roomId','link',extensions.digest(convert_to('$tokenSql','UTF8'),'sha256'),'$masterId',now()+interval '1 hour',1);
"@

$created = $false
try {
  Invoke-LocalSql $fixtureSql | Out-Null
  $created = $true

  $joinSql = {
    param($Db, $Uid, $InviteToken, $UseDocker, $DockerExe, $ContainerName)
    $ErrorActionPreference = 'Continue'
    $claims = '{"sub":"' + $Uid + '","role":"authenticated"}'
    $claimsSql = $claims.Replace("'", "''")
    $tokenEscaped = $InviteToken.Replace("'", "''")
    $sql = "begin; set local role authenticated; select set_config('request.jwt.claims','$claimsSql',true); select public.join_room_with_invite('$tokenEscaped'); commit;"
    if ($UseDocker) {
      $output = @(& $DockerExe exec $ContainerName psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -At -c $sql 2>&1 | ForEach-Object { $_.ToString() })
    } else {
      $output = @(& psql --dbname $Db -X -q -v ON_ERROR_STOP=1 -At -c $sql 2>&1 | ForEach-Object { $_.ToString() })
    }
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output -join "`n" }
  }

  $jobs = @(
    Start-Job -ScriptBlock $joinSql -ArgumentList $DatabaseUrl, $playerOneId, $token, $useDocker, $dockerCommand.Source, $DatabaseContainer
    Start-Job -ScriptBlock $joinSql -ArgumentList $DatabaseUrl, $playerTwoId, $token, $useDocker, $dockerCommand.Source, $DatabaseContainer
  )
  $jobs | Wait-Job | Out-Null
  $jobResults = foreach ($job in $jobs) {
    $received = @(Receive-Job $job -ErrorAction SilentlyContinue)
    $result = $received | Where-Object { $_.PSObject.Properties.Name -contains 'ExitCode' } | Select-Object -Last 1
    if ($null -eq $result) { [pscustomobject]@{ State = $job.State; ExitCode = 999; Output = 'join process returned no result' } }
    else { [pscustomobject]@{ State = $job.State; ExitCode = $result.ExitCode; Output = $result.Output } }
  }
  $jobs | Remove-Job

  $successes = @($jobResults | Where-Object { $_.State -eq 'Completed' -and $_.ExitCode -eq 0 }).Count
  $expectedRejections = @($jobResults | Where-Object {
    $_.State -eq 'Completed' -and $_.ExitCode -ne 0 -and $_.Output -match 'invalid or unavailable invite'
  }).Count
  if ($successes -ne 1 -or $expectedRejections -ne 1) {
    throw "Expected one successful redemption and one invite-limit rejection; got successes=$successes, expected rejections=$expectedRejections. Results: $($jobResults | ConvertTo-Json -Compress)"
  }

  $actual = (Invoke-LocalSql @"
select (select uses_count from public.room_invites where id='$inviteId') || ':' ||
       (select count(*) from public.room_members where room_id='$roomId' and role='player') || ':' ||
       (select count(distinct user_id) from public.room_members where room_id='$roomId' and role='player');
"@).Trim()
  if ($actual -ne '1:1:1') {
    throw "Expected uses/player-members/distinct-players = 1:1:1; got '$actual'."
  }

  Write-Output 'PASS: exactly one independent connection consumed the final invite use.'
  Write-Output 'PASS: usage count, player membership count, and distinct player count are all exactly one.'
  Write-Output 'PASS: no duplicate room/user membership was created.'
}
finally {
  if ($created) {
    Invoke-LocalSql "delete from public.rooms where id='$roomId'; delete from auth.users where id in ('$masterId','$playerOneId','$playerTwoId');" | Out-Null
  }
  $cleanupTarget = [IO.Path]::GetFullPath($tempRoot)
  if (-not $cleanupTarget.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing cleanup outside the system temp root: '$cleanupTarget'."
  }
  Remove-Item -LiteralPath $cleanupTarget -Recurse -Force -ErrorAction SilentlyContinue
}
