# Diagnostic seulement : ne propose et ne transmet jamais --create.
$ErrorActionPreference = 'Stop'
$adminPasswordSecret = Read-Host 'Mot de passe envisage pour Admin Fictif' -AsSecureString
$confirmationSecret = Read-Host 'Confirmer ce mot de passe' -AsSecureString
$migrationPasswordSecret = Read-Host 'Mot de passe PostgreSQL de vg_migrator' -AsSecureString
$previousOutputEncoding = $OutputEncoding
$adminPasswordPointer = [IntPtr]::Zero
$confirmationPointer = [IntPtr]::Zero
$migrationPasswordPointer = [IntPtr]::Zero
$diagnosticExitCode = 1
try {
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $adminPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPasswordSecret)
    $confirmationPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmationSecret)
    $migrationPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($migrationPasswordSecret)
    $payload = @{
        password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPasswordPointer)
        confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmationPointer)
        migrationPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($migrationPasswordPointer)
    }
    $payload | ConvertTo-Json -Compress | & node (Join-Path $PSScriptRoot 'provision-demo-admin.js') --check-only
    $diagnosticExitCode = $LASTEXITCODE
} finally {
    if ($adminPasswordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPasswordPointer) }
    if ($confirmationPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmationPointer) }
    if ($migrationPasswordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($migrationPasswordPointer) }
    $payload = $null
    $adminPasswordSecret.Dispose()
    $confirmationSecret.Dispose()
    $migrationPasswordSecret.Dispose()
    $OutputEncoding = $previousOutputEncoding
}
exit $diagnosticExitCode
