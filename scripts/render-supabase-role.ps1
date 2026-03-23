param(
  [string]$Password = $env:SUPABASE_PRISMA_DB_PASSWORD
)

if ([string]::IsNullOrWhiteSpace($Password)) {
  throw "Defina SUPABASE_PRISMA_DB_PASSWORD antes de gerar supabase/roles.sql."
}

$root = Split-Path -Parent $PSScriptRoot
$templatePath = Join-Path $root "supabase\\roles.sql.template"
$outputPath = Join-Path $root "supabase\\roles.sql"

$template = Get-Content -Raw -Path $templatePath
$rendered = $template.Replace("__PRISMA_DB_PASSWORD__", $Password)

Set-Content -Path $outputPath -Value $rendered -NoNewline

Write-Host "Arquivo gerado em $outputPath"
