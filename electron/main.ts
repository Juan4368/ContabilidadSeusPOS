import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { execFile } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const logsDir = path.join(process.env.APP_ROOT, 'logs')
const MICRONS_PER_MM = 1000
const MICRONS_PER_PX = 264.583

const sendRawToPrinter = async (deviceName: string, bytes: number[]) => {
  const safeDeviceName = deviceName.replace(/"/g, '""')
  const byteList = bytes.map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(',')
  const logFile = path.join(logsDir, 'print-raw.log').replace(/"/g, '""')
  const script = `
$printer = "${safeDeviceName}"
$raw = [byte[]] (${byteList})
Add-Content -Path "${logFile}" -Value "[${new Date().toISOString()}] START device=${safeDeviceName} bytes=${bytes.length}"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
"@
$h = New-Object IntPtr
if (-not [RawPrinterHelper]::OpenPrinter($printer, [ref]$h, [IntPtr]::Zero)) { throw "OpenPrinter failed" }
$doc = New-Object RawPrinterHelper+DOCINFOA
$doc.pDocName = "SeusPOS Cash Drawer"
$doc.pDataType = "RAW"
[RawPrinterHelper]::StartDocPrinter($h, 1, $doc) | Out-Null
[RawPrinterHelper]::StartPagePrinter($h) | Out-Null
[int]$written = 0
[RawPrinterHelper]::WritePrinter($h, $raw, $raw.Length, [ref]$written) | Out-Null
[RawPrinterHelper]::EndPagePrinter($h) | Out-Null
[RawPrinterHelper]::EndDocPrinter($h) | Out-Null
[RawPrinterHelper]::ClosePrinter($h) | Out-Null
Add-Content -Path "${logFile}" -Value "[${new Date().toISOString()}] DONE written=$written"
exit 0
`
  const tmpFile = path.join(
    os.tmpdir(),
    `seuspos-print-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`
  )
  await fs.writeFile(tmpFile, script, 'utf8')
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile],
      { windowsHide: true },
      async (error, stdout, stderr) => {
        try {
          if (stdout) {
            await fs.appendFile(logFile, `[${new Date().toISOString()}] STDOUT ${stdout}\n`, 'utf8')
          }
          if (stderr) {
            await fs.appendFile(logFile, `[${new Date().toISOString()}] STDERR ${stderr}\n`, 'utf8')
          }
        } catch {
          // ignore
        }
        try {
          await fs.unlink(tmpFile)
        } catch {
          // ignore
        }
        if (error) {
          reject(error)
          return
        }
        resolve()
      }
    )
    const timeout = setTimeout(() => {
      try {
        child.kill()
      } catch {
        // ignore
      }
      reject(new Error('Tiempo de espera al imprimir (RAW).'))
    }, 30000)
    child.on('exit', () => clearTimeout(timeout))
  })
}

ipcMain.handle('log:append', async (_event, payload: { filename?: string; lines?: string[] }) => {
  const filename = payload?.filename?.trim() || 'app.log'
  const lines = Array.isArray(payload?.lines) ? payload.lines : []
  if (!lines.length) return
  await fs.mkdir(logsDir, { recursive: true })
  const filePath = path.join(logsDir, filename)
  const content = lines.map((line) => `${line}\n`).join('')
  await fs.appendFile(filePath, content, 'utf8')
})

ipcMain.handle('pos:list-printers', async () => {
  if (!win) return []
  try {
    return await win.webContents.getPrintersAsync()
  } catch {
    return []
  }
})

ipcMain.handle(
  'pos:open-cash-drawer',
  async (_event, payload: { deviceName?: string } | null) => {
    const deviceName = payload?.deviceName?.trim()
    if (!deviceName) {
      throw new Error('deviceName requerido para abrir cajon.')
    }
    // ESC p m t1 t2 (pulso del cajon)
    await sendRawToPrinter(deviceName, [0x1b, 0x70, 0x00, 0x19, 0xfa])
    return { ok: true }
  }
)

ipcMain.handle(
  'pos:print-raw',
  async (_event, payload: { deviceName?: string; bytes?: number[] } | null) => {
    const deviceName = payload?.deviceName?.trim()
    const bytes = Array.isArray(payload?.bytes) ? payload?.bytes : []
    if (!deviceName) {
      throw new Error('deviceName requerido para imprimir.')
    }
    if (!bytes.length) {
      throw new Error('bytes vacios para imprimir.')
    }
    try {
      await fs.mkdir(logsDir, { recursive: true })
      await fs.appendFile(
        path.join(logsDir, 'print-raw.log'),
        `[${new Date().toISOString()}] device=${deviceName} bytes=${bytes.length}\n`,
        'utf8'
      )
    } catch {
      // ignore
    }
    await sendRawToPrinter(deviceName, bytes)
    return { ok: true }
  }
)

ipcMain.handle(
  'pos:print-ticket',
  async (
    _event,
    payload: { html?: string; deviceName?: string; widthMm?: number; silent?: boolean } | null
  ) => {
    const html = payload?.html?.trim()
    if (!html) {
      throw new Error('HTML vacio para imprimir.')
    }
    const widthMm = Number(payload?.widthMm) || 80
    const widthMicrons = Math.max(1, Math.round(widthMm * MICRONS_PER_MM))
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
      },
    })

    const safeHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>${html}</body>
</html>`

    try {
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(safeHtml)}`
      await printWindow.loadURL(dataUrl)
      await new Promise<void>((resolve) => {
        if (printWindow.webContents.isLoading()) {
          printWindow.webContents.once('did-finish-load', () => resolve())
        } else {
          resolve()
        }
      })

      const bodyText = await printWindow.webContents.executeJavaScript(
        'document.body && document.body.innerText ? document.body.innerText.trim().length : 0',
        true
      )
      if (!bodyText) {
        throw new Error('Contenido vacio para imprimir.')
      }

      const heightPx = await printWindow.webContents.executeJavaScript('document.body.scrollHeight', true)
      const heightMicrons = Math.max(1, Math.round(Number(heightPx) * MICRONS_PER_PX))

      const silent = payload?.silent !== false
      const printOptions = {
        silent,
        printBackground: true,
        deviceName: payload?.deviceName || undefined,
        margins: { marginType: 'none' },
        landscape: false,
        preferCSSPageSize: true,
        pageSize: { width: widthMicrons, height: heightMicrons },
      } as Electron.WebContentsPrintOptions & { preferCSSPageSize?: boolean }

      await new Promise<void>((resolve, reject) => {
        printWindow.webContents.print(printOptions, (success, errorType) => {
          if (!success) {
            reject(new Error(errorType || 'No se pudo imprimir.'))
            return
          }
          resolve()
        })
      })
      return { ok: true }
    } finally {
      if (!printWindow.isDestroyed()) {
        printWindow.close()
      }
    }
  }
)

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'seuspos.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  const menu = Menu.buildFromTemplate([
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Abrir DevTools',
          click: () => {
            if (!win) return
            if (win.webContents.isDevToolsOpened()) {
              win.webContents.closeDevTools()
            } else {
              win.webContents.openDevTools({ mode: 'detach' })
            }
          },
        },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools({ mode: 'detach' })
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    if (process.env.OPEN_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  try {
    await fs.mkdir(logsDir, { recursive: true })
  } catch {
    // Ignora errores de creación de logs
  }
  createWindow()
})
