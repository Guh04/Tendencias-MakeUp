declare global {
  interface Window {
    /** Presente apenas no programa instalado (Windows). */
    desktop?: {
      print: () => Promise<{ ok: boolean; reason: string }>;
      info: () => Promise<{ version: string; printer: string; silent: boolean }>;
    };
  }
}

/** Imprime a pagina atual (comprovante). No programa instalado imprime direto na impressora escolhida. */
export async function printNow(): Promise<void> {
  if (window.desktop) {
    await window.desktop.print();
    return;
  }
  window.print();
}
