// Tendencias MakeUp - programa de Windows (PDV + Administracao).
// As telas ficam DENTRO do programa (arquivos estaticos); somente os dados vem da internet (Supabase).
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Configuracao simples (impressora etc.), guardada na pasta de dados do usuario
// ---------------------------------------------------------------------------
const cfgFile = () => path.join(app.getPath("userData"), "config.json");
function readConfig() {
  try {
    return { printer: "", silent: true, ...JSON.parse(fs.readFileSync(cfgFile(), "utf8")) };
  } catch {
    return { printer: "", silent: true };
  }
}
function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  try {
    fs.mkdirSync(path.dirname(cfgFile()), { recursive: true });
    fs.writeFileSync(cfgFile(), JSON.stringify(next, null, 2));
  } catch (e) {
    console.error("nao foi possivel salvar a configuracao", e);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Servidor local somente-leitura para os dois sites estaticos (127.0.0.1)
// ---------------------------------------------------------------------------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const webRoot = () => (app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..")); // dev: ../admin/out e ../pdv/out
const siteDir = (name) => (app.isPackaged ? path.join(webRoot(), name) : path.join(webRoot(), name, "out"));

function resolveFile(root, rel) {
  const base = path.normalize(path.join(root, rel));
  if (!base.startsWith(root)) return null;
  for (const c of [base, `${base}.html`, path.join(base, "index.html")]) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      /* tenta o proximo */
    }
  }
  return null;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        res.writeHead(400).end();
        return;
      }
      if (pathname === "/") {
        res.writeHead(302, { Location: "/pdv/" }).end();
        return;
      }
      const m = /^\/(admin|pdv)(\/.*)?$/.exec(pathname);
      if (!m) {
        res.writeHead(404).end("Nao encontrado");
        return;
      }
      const root = siteDir(m[1]);
      const rel = (m[2] ?? "/").replace(/^\//, "");
      const file = resolveFile(root, rel) ?? resolveFile(root, "404");
      if (!file) {
        res.writeHead(404).end("Nao encontrado");
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(file.endsWith("404.html") && !rel.endsWith("404") ? 404 : 200, { "Content-Type": type, "Cache-Control": "no-cache" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

// ---------------------------------------------------------------------------
// Janela
// ---------------------------------------------------------------------------
let win = null;
let port = 0;
let currentApp = "pdv";

function openApp(name) {
  currentApp = name;
  if (win) {
    void win.loadURL(`http://127.0.0.1:${port}/${name}/`);
    win.setTitle(name === "pdv" ? "Tendencias MakeUp - PDV" : "Tendencias MakeUp - Administração");
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#fdf9f6",
    icon: path.join(__dirname, "assets", "icon.png"),
    title: "Tendencias MakeUp",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => {
    win.maximize();
    win.show();
  });
  // so navega dentro do proprio programa; links externos abrem no navegador
  const origin = `http://127.0.0.1:${port}`;
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(origin)) {
      e.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });
  win.on("closed", () => {
    win = null;
  });
  openApp(currentApp);
}

// ---------------------------------------------------------------------------
// Impressao (comprovantes): silenciosa na impressora escolhida, ou janela do Windows
// ---------------------------------------------------------------------------
ipcMain.handle("desktop:print", (event) => {
  const cfg = readConfig();
  return new Promise((resolve) => {
    event.sender.print(
      {
        silent: cfg.silent,
        deviceName: cfg.printer || undefined,
        printBackground: true,
        margins: { marginType: "none" },
      },
      (success, reason) => resolve({ ok: success, reason: reason || "" }),
    );
  });
});
ipcMain.handle("desktop:info", () => ({ version: app.getVersion(), printer: readConfig().printer, silent: readConfig().silent }));

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
async function buildMenu() {
  const cfg = readConfig();
  let printers = [];
  try {
    printers = win ? await win.webContents.getPrintersAsync() : [];
  } catch {
    printers = [];
  }
  const template = [
    {
      label: "Programa",
      submenu: [
        { label: "PDV (caixa)", accelerator: "CmdOrCtrl+1", click: () => openApp("pdv") },
        { label: "Administração", accelerator: "CmdOrCtrl+2", click: () => openApp("admin") },
        { type: "separator" },
        {
          label: "Abrir ao ligar o computador",
          type: "checkbox",
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
        },
        { type: "separator" },
        { label: "Tela cheia", accelerator: "F11", click: () => win && win.setFullScreen(!win.isFullScreen()) },
        { role: "reload", label: "Recarregar" },
        { type: "separator" },
        { role: "quit", label: "Sair" },
      ],
    },
    {
      label: "Impressora",
      submenu: [
        {
          label: "Imprimir direto, sem janela de confirmação",
          type: "checkbox",
          checked: cfg.silent,
          click: (item) => {
            writeConfig({ silent: item.checked });
            void buildMenu();
          },
        },
        { type: "separator" },
        {
          label: "Padrão do Windows",
          type: "radio",
          checked: !cfg.printer,
          click: () => {
            writeConfig({ printer: "" });
            void buildMenu();
          },
        },
        ...printers.map((p) => ({
          label: p.displayName || p.name,
          type: "radio",
          checked: cfg.printer === p.name,
          click: () => {
            writeConfig({ printer: p.name });
            void buildMenu();
          },
        })),
      ],
    },
    {
      label: "Ajuda",
      submenu: [
        { label: "Verificar atualizações", click: () => checkUpdates(true) },
        {
          label: `Versão ${app.getVersion()}`,
          click: () => dialog.showMessageBox({ message: `Tendencias MakeUp\nVersão ${app.getVersion()}`, buttons: ["OK"] }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Atualizacao automatica (GitHub Releases). Sem internet, segue funcionando na versao atual.
// ---------------------------------------------------------------------------
function checkUpdates(manual) {
  if (!app.isPackaged) {
    if (manual) void dialog.showMessageBox({ message: "Atualizações só funcionam no programa instalado.", buttons: ["OK"] });
    return;
  }
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.removeAllListeners();
    autoUpdater.on("update-downloaded", (info) => {
      void dialog
        .showMessageBox({
          type: "info",
          message: `Nova versão ${info.version} pronta.`,
          detail: "Reiniciar agora para atualizar? Seus dados não são afetados.",
          buttons: ["Reiniciar e atualizar", "Depois"],
          defaultId: 0,
        })
        .then((r) => {
          if (r.response === 0) autoUpdater.quitAndInstall();
        });
    });
    autoUpdater.on("update-not-available", () => {
      if (manual) void dialog.showMessageBox({ message: "Você já está na versão mais recente.", buttons: ["OK"] });
    });
    autoUpdater.on("error", () => {
      if (manual) void dialog.showMessageBox({ type: "warning", message: "Não foi possível verificar atualizações agora. Confira a internet.", buttons: ["OK"] });
    });
    void autoUpdater.checkForUpdates();
  } catch {
    /* sem updater: ignora */
  }
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(async () => {
    port = await startServer();
    createWindow();
    await buildMenu();
    setTimeout(() => checkUpdates(false), 8000);
  });
  app.on("window-all-closed", () => app.quit());
}
