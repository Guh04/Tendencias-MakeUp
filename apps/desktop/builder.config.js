// Configuracao do instalador. APP_TARGET=pdv|admin escolhe qual programa gerar.
const target = process.env.APP_TARGET;
const APPS = {
  pdv: { name: "Tendencias PDV", id: "br.com.tendenciasmakeup.pdv", file: "TendenciasPDV", channel: "pdv" },
  admin: { name: "Tendencias Admin", id: "br.com.tendenciasmakeup.admin", file: "TendenciasAdmin", channel: "admin" },
};
const app = APPS[target];
if (!app) throw new Error("Defina APP_TARGET=pdv ou APP_TARGET=admin");

module.exports = {
  appId: app.id,
  productName: app.name,
  artifactName: `${app.file}-Setup-\${version}.\${ext}`,
  directories: { output: `dist/${target}` },
  files: ["main.js", "preload.js", `assets/icon-${target}.png`],
  // grava no package.json empacotado qual programa e este
  extraMetadata: { appTarget: target, main: "main.js" },
  extraResources: [{ from: `../${target}/out`, to: `web/${target}` }],
  win: { target: "nsis", icon: `assets/icon-${target}.ico` },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: app.name,
  },
  // cada programa acompanha o seu proprio arquivo de versao (pdv.yml / admin.yml) na mesma Release
  publish: [{ provider: "github", owner: "Guh04", repo: "Tendencias-MakeUp", channel: app.channel }],
};
