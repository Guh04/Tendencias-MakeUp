const { contextBridge, ipcRenderer } = require("electron");

// Ponte minima e segura entre as telas e o programa (sem acesso ao sistema de arquivos).
contextBridge.exposeInMainWorld("desktop", {
  print: () => ipcRenderer.invoke("desktop:print"),
  info: () => ipcRenderer.invoke("desktop:info"),
});
