; XavierOS was called "Bing Ads Chat" before version 0.3. Windows sees a new product name
; as a new app (new folder, new uninstall entry), so the first XavierOS setup removes the
; old installation and puts the shortcuts back under the new name. Conversations, keys
; and settings are kept: they belong to the app id (dk.bingadschat.app), which is unchanged.
!include "LogicLib.nsh"
!include "FileFunc.nsh"

Var OldBacFound
Var OldBacDesktop

!macro NSIS_HOOK_PREINSTALL
  Push $R0
  Push $R1
  Push $R2
  StrCpy $OldBacFound 0
  StrCpy $OldBacDesktop 0
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bing Ads Chat" "UninstallString"
  ${If} $R0 != ""
    StrCpy $OldBacFound 1
    ${If} ${FileExists} "$DESKTOP\Bing Ads Chat.lnk"
      StrCpy $OldBacDesktop 1
    ${EndIf}
    ; The old app may still be closing after it started this update.
    nsExec::Exec 'taskkill /F /IM BingAdsChat.exe'
    Pop $R1
    Sleep 500
    ; "C:\...\Bing Ads Chat\uninstall.exe" (with quotes) → the exe and its folder.
    StrCpy $R1 $R0 1
    ${If} $R1 == '"'
      StrCpy $R0 $R0 "" 1
      StrCpy $R0 $R0 -1
    ${EndIf}
    ${GetParent} $R0 $R2
    ${If} ${FileExists} $R0
      ; Silent and without /UPDATE: removes the old files, shortcuts and uninstall entry,
      ; but never the app data. _?= makes it run in place so we can wait for it.
      ExecWait '"$R0" /S _?=$R2'
      Delete $R0
      RMDir $R2
    ${EndIf}
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Bing Ads Chat"
  ${EndIf}
  Pop $R2
  Pop $R1
  Pop $R0
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; An app update (/UPDATE) creates no shortcuts – make the ones the old app had.
  ${If} $OldBacFound = 1
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    ${If} $OldBacDesktop = 1
      CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    ${EndIf}
  ${EndIf}
!macroend
