Option Explicit

Dim shell, fso, scriptDir, ccxPath, upiaPath, candidate, exitCode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ccxPath = fso.BuildPath(scriptDir, "Lex-Alfa-2.0.1-Windows.ccx")

If Not fso.FileExists(ccxPath) Then
  MsgBox "Coloque este arquivo e Lex-Alfa-2.0.1-Windows.ccx na mesma pasta e tente novamente.", vbExclamation, "Instalar Lex Alfa"
  WScript.Quit 2
End If

If shell.ExpandEnvironmentStrings("%CommonProgramFiles%") <> "%CommonProgramFiles%" Then
  candidate = fso.BuildPath(shell.ExpandEnvironmentStrings("%CommonProgramFiles%"), "Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe")
  If fso.FileExists(candidate) Then upiaPath = candidate
End If
If upiaPath = "" And shell.ExpandEnvironmentStrings("%ProgramFiles%") <> "%ProgramFiles%" Then
  candidate = fso.BuildPath(shell.ExpandEnvironmentStrings("%ProgramFiles%"), "Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe")
  If fso.FileExists(candidate) Then upiaPath = candidate
End If

If upiaPath = "" Then
  MsgBox "Não encontrei o instalador de plug-ins da Adobe (UPIA). Instale ou atualize o aplicativo Creative Cloud Desktop e tente novamente.", vbExclamation, "Creative Cloud não encontrado"
  WScript.Quit 3
End If

exitCode = shell.Run(Chr(34) & upiaPath & Chr(34) & " /install " & Chr(34) & ccxPath & Chr(34), 0, True)
If exitCode = 0 Then
  MsgBox "O instalador da Adobe concluiu a solicitação. Se o Creative Cloud mostrar uma confirmação, escolha Instalar localmente e aceite as permissões do Lex Alfa.", vbInformation, "Lex Alfa enviado ao Creative Cloud"
Else
  MsgBox "O instalador da Adobe retornou o código " & exitCode & ". Atualize o Creative Cloud Desktop, abra o Premiere ao menos uma vez e tente novamente.", vbCritical, "Falha ao instalar Lex Alfa"
End If
