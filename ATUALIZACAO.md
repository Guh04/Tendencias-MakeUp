# Como gerar e publicar uma nova versão dos programas

São **dois programas** independentes, instalados separadamente:

| Programa | Instalador | Para quê |
|---|---|---|
| **Tendencias PDV** | `TendenciasPDV-Setup-<versao>.exe` | Caixa / frente de loja |
| **Tendencias Admin** | `TendenciasAdmin-Setup-<versao>.exe` | Administração (produtos, relatórios, usuários...) |

Os dois podem ficar instalados no mesmo computador. Cada um tem seu ícone, sua pasta de dados e se atualiza sozinho
quando existe versão nova publicada no GitHub. Os dados da loja ficam no Supabase, então atualizar **nunca** apaga nada.

## 1. Gerar os instaladores (neste computador de desenvolvimento)
1. Aumente o número da versão em `apps/desktop/package.json` (ex.: `0.1.0` → `0.1.1`).
2. Rode na raiz do projeto:
   - `npm run dist:desktop` → gera os dois, **ou**
   - `npm run dist:pdv` / `npm run dist:admin` → gera só um.
3. Os arquivos ficam em `apps/desktop/dist/pdv/` e `apps/desktop/dist/admin/`.

## 2. Publicar para atualizar a loja
1. No GitHub: **Releases → Draft a new release**. Tag `v<versao>` (ex.: `v0.1.1`).
2. Anexe os arquivos do programa que mudou (pode anexar os dois):
   - PDV: `TendenciasPDV-Setup-<versao>.exe`, `.exe.blockmap` e `pdv.yml`
   - Admin: `TendenciasAdmin-Setup-<versao>.exe`, `.exe.blockmap` e `admin.yml`
3. Publique. Na próxima vez que o programa abrir (ou em Ajuda → Verificar atualizações), ele baixa e pergunta se pode reiniciar.

## Primeira instalação
Copie o instalador (pen drive) para o computador e execute.
O Windows pode avisar "editor desconhecido" (SmartScreen), pois o programa não tem certificado digital pago:
clique em **Mais informações → Executar assim mesmo**.

> Ao instalar a versão com dois programas, o antigo "Tendencias MakeUp" (versão 0.1.0 única) pode ser desinstalado
> em Configurações do Windows → Aplicativos.
