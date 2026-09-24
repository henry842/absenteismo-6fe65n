# Abre testes/saida/exemplo.xlsx no Excel (invisível), confere algumas células
# e salva uma cópia pelo Excel, para o teste de leitura do backup depois de salvo.
# Rodar depois de: node --test testes/*.test.js
$ErrorActionPreference = 'Stop'
$saida = Join-Path $PSScriptRoot 'saida'
$origem = Join-Path $saida 'exemplo.xlsx'
$copia = Join-Path $saida 'exemplo-salvo-pelo-excel.xlsx'
if (Test-Path $copia) { Remove-Item $copia -Confirm:$false }

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
    $wb = $xl.Workbooks.Open($origem)
    foreach ($ws in $wb.Worksheets) {
        $usado = $ws.UsedRange
        "{0} | visivel={1} | linhas={2} colunas={3}" -f $ws.Name, $ws.Visible, $usado.Rows.Count, $usado.Columns.Count
    }
    $aus = $wb.Worksheets.Item(3)
    "Ausencias A2 = {0} (texto na tela: {1})" -f $aus.Range('A2').Value2, $aus.Range('A2').Text
    "Ausencias B2..G2 = {0} | {1} | {2} | {3} | {4}" -f $aus.Range('B2').Text, $aus.Range('C2').Text, $aus.Range('E2').Text, $aus.Range('F2').Text, $aus.Range('G2').Text
    $res = $wb.Worksheets.Item(1)
    "Resumo G2 = {0} (texto na tela: {1})" -f $res.Range('G2').Value2, $res.Range('G2').Text
    "Filtro ligado em Ausencias: {0}" -f $aus.AutoFilterMode
    $wb.SaveAs($copia, 51)
    $wb.Close($false)
    "Salvo pelo Excel: $copia"
} finally {
    $xl.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}
