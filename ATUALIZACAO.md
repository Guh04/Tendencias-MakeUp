# Como gerar e publicar uma nova versão do programa

O programa instalado na loja se atualiza sozinho quando existe uma versão nova publicada no GitHub.
Dados da loja ficam no Supabase, então atualizar o programa **nunca** apaga nada.

## 1. Gerar o instalador (neste computador de desenvolvimento)
1. Aumente o número da versão em `apps/desktop/package.json` (ex.: `0.1.0` → `0.1.1`).
2. Rode na raiz do projeto: `npm run dist:desktop`
3. O instalador fica em `apps/desktop/dist/TendenciasMakeUp-Setup-<versao>.exe`.

## 2. Publicar para atualizar a loja
1. No GitHub: **Releases → Draft a new release**. Tag `v<versao>` (ex.: `v0.1.1`).
2. Anexe **3 arquivos** de `apps/desktop/dist/`: o `.exe`, o `.exe.blockmap` e o `latest.yml`.
3. Publique. Na próxima vez que o programa abrir (ou em Ajuda → Verificar atualizações), ele baixa e pergunta se pode reiniciar.

## Primeira instalação na loja
Copie o `TendenciasMakeUp-Setup-<versao>.exe` para o computador (pen drive) e execute.
O Windows pode avisar "editor desconhecido" (SmartScreen), pois o programa não tem certificado digital pago:
clique em **Mais informações → Executar assim mesmo**.
