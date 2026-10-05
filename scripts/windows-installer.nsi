; ---------------------------------------------------------------------------
; Tech AI monkey CLI — Windows installer (NSIS)
;
; Builds a per-user installer that needs no administrator rights:
;   * installs tech-ai.exe to %LOCALAPPDATA%\Programs\Tech AI monkey
;   * creates a Start-menu entry with the app icon (runs "tech-ai chat")
;   * optionally creates a desktop shortcut
;   * adds the install folder to the user's PATH
;   * registers an entry under Apps & features with a working uninstaller
;
; Built by scripts/build-cli.sh. Do not run it by hand unless you also pass:
;   makensis -DAPP_VERSION=1.0.0 -DSOURCE_EXE=<path> -DOUTFILE=<path> \
;            scripts/windows-installer.nsi
; ---------------------------------------------------------------------------

Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma

!include "WinMessages.nsh"

!define APP_NAME "Tech AI monkey"
!define APP_ID "TechAIMonkey"
!define PUBLISHER "Salazar Rivero Smart Things"
!define HOMEPAGE "https://tech-ai.tech"
!define EXE_NAME "tech-ai.exe"

!ifndef APP_VERSION
  !define APP_VERSION "1.0.0"
!endif
!ifndef SOURCE_EXE
  !error "SOURCE_EXE mangler - bygg via scripts/build-cli.sh"
!endif
!ifndef OUTFILE
  !define OUTFILE "tech-ai_${APP_VERSION}_windows_x64_setup.exe"
!endif

; The cross-compiled .exe has no embedded icon (bun can only attach one when it
; runs on Windows), so the installer ships icon.ico and the shortcuts use that.
!ifdef SOURCE_ICON
  !define SHORTCUT_ICON "$INSTDIR\icon.ico"
!else
  !define SHORTCUT_ICON "$INSTDIR\${EXE_NAME}"
!endif

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "Software\${APP_ID}" "InstallDir"
ShowInstDetails show
ShowUninstDetails show

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

; ---------------------------------------------------------------------------
Section "Install"
  SetOutPath "$INSTDIR"
  File "/oname=${EXE_NAME}" "${SOURCE_EXE}"
  !ifdef SOURCE_ICON
    File "/oname=icon.ico" "${SOURCE_ICON}"
  !endif

  ; Start-menu folder + entry. The icon is read from the exe, which now has one
  ; embedded, and the argument makes the shortcut open a chat session.
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" \
    "$INSTDIR\${EXE_NAME}" "chat" "${SHORTCUT_ICON}" 0
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\uninstall.exe"

  ; Ask about the desktop shortcut, but never block a silent (/S) install.
  IfSilent no_desktop
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Also create a shortcut on the Desktop?" IDNO no_desktop
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" \
      "$INSTDIR\${EXE_NAME}" "chat" "${SHORTCUT_ICON}" 0
  no_desktop:

  ; --- add the install folder to the user's PATH ---------------------------
  ReadRegStr $0 HKCU "Environment" "Path"
  StrCpy $R1 "$0"
  StrCpy $R2 "$INSTDIR"
  Call StrContains
  StrCmp $R0 "1" path_done
    StrCmp $0 "" 0 path_append
      WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR"
      Goto path_done
    path_append:
      WriteRegExpandStr HKCU "Environment" "Path" "$0;$INSTDIR"
  path_done:
  ; tell running processes that the environment changed
  System::Call 'USER32::SendMessageTimeoutW(i ${HWND_BROADCAST}, i ${WM_WININICHANGE}, i 0, w "Environment", i 0, i 5000, *i .r0)'

  ; --- Apps & features entry ----------------------------------------------
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\${APP_ID}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\${APP_ID}" "Version" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "URLInfoAbout" "${HOMEPAGE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "DisplayIcon" "${SHORTCUT_ICON}"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "NoRepair" 1

  DetailPrint "Ferdig. Apne en ny terminal og skriv:  tech-ai login"
SectionEnd

; ---------------------------------------------------------------------------
Section "Uninstall"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  Delete "$DESKTOP\${APP_NAME}.lnk"

  ; --- remove our folder from PATH, without touching the rest --------------
  ReadRegStr $0 HKCU "Environment" "Path"
  StrCmp $0 "" path_cleanup
    StrCpy $R1 "$0"
    StrCpy $R2 ";$INSTDIR"
    Call un.StrRemove
    StrCpy $0 "$R0"
    StrCpy $R1 "$0"
    StrCpy $R2 "$INSTDIR;"
    Call un.StrRemove
    StrCpy $0 "$R0"
    StrCmp $0 "$INSTDIR" 0 +2
      StrCpy $0 ""
    WriteRegExpandStr HKCU "Environment" "Path" "$0"
  path_cleanup:
  System::Call 'USER32::SendMessageTimeoutW(i ${HWND_BROADCAST}, i ${WM_WININICHANGE}, i 0, w "Environment", i 0, i 5000, *i .r0)'

  !ifdef SOURCE_ICON
    Delete "$INSTDIR\icon.ico"
  !endif
  Delete "$INSTDIR\${EXE_NAME}"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
  DeleteRegKey HKCU "Software\${APP_ID}"
SectionEnd

; ---------------------------------------------------------------------------
; StrContains: sets $R0 to 1 when $R1 contains $R2, otherwise 0.
; Written by hand instead of relying on StrStr's return convention.
Function StrContains
  Push $0
  Push $1
  Push $2
  Push $3
  StrLen $2 $R2
  StrCmp $2 0 notfound
  StrCpy $3 0
  loop:
    StrCpy $0 $R1 "" $3
    StrCmp $0 "" notfound
    StrCpy $0 $R1 $2 $3
    StrCmp $0 $R2 found
    IntOp $3 $3 + 1
    Goto loop
  found:
    StrCpy $R0 1
    Goto done
  notfound:
    StrCpy $R0 0
  done:
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; ---------------------------------------------------------------------------
; un.StrRemove: removes every occurrence of $R2 from $R1, result in $R0.
; Only whole substrings are touched, so no unrelated PATH entry is ever lost.
; The un. prefix is required because the uninstaller calls it.
Function un.StrRemove
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  StrLen $1 $R2
  StrCmp $1 0 copy             ; nothing to remove
  StrCpy $4 0                  ; read position
  StrCpy $0 ""                 ; result
  loop:
    StrCpy $2 $R1 "" $4
    StrCmp $2 "" done
    StrCpy $3 $R1 $1 $4
    StrCmp $3 $R2 skip         ; match -> drop these characters
      StrCpy $0 "$0$3"
      IntOp $4 $4 + 1
      Goto loop
    skip:
      IntOp $4 $4 + $1
      Goto loop
  copy:
    StrCpy $0 "$R1"
  done:
  StrCpy $R0 "$0"
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
