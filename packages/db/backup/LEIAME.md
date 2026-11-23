# Backup da Tendencias MakeUp (no computador de casa)

Copia **todos os dados da loja** (produtos, vendas, caixas, clientes, estoque, financeiro, atividades) para uma pasta
com a data. Roda sem interface e pode ser agendado.

## Preparar (uma vez)
1. Instale o **Node.js LTS** (nodejs.org) no computador de casa.
2. Copie a pasta `packages/db` do projeto (ou clone o repositório) e, dentro de `packages/db`, rode `npm install`.
3. Em `packages/db/backup`, copie `backup.env.exemplo` para `backup.env` e preencha:
   - `SUPABASE_URL`: endereço do projeto.
   - `SUPABASE_SECRET_KEY`: chave secreta (Supabase → Project Settings → API Keys). **Fica só neste computador.**
   - `BACKUP_DIR`: pasta dos backups (ex.: `C:\Backups\TendenciasMakeUp`, ou uma pasta do Google Drive/OneDrive).
4. Teste: dê dois cliques em `backup.bat`. Deve surgir uma pasta `tendencias-backup-AAAA-MM-DD_HHMM`.

## Agendar todo dia (Agendador de Tarefas do Windows)
1. Abra **Agendador de Tarefas** → **Criar Tarefa Básica**.
2. Nome: `Backup Tendencias MakeUp`. Disparador: **Diariamente** (ex.: 23:00).
3. Ação: **Iniciar um programa** → escolha o arquivo `backup.bat`.
4. Em propriedades, marque **Executar estando o usuário conectado ou não** se quiser que rode com o PC bloqueado.

Backups com mais de 60 dias são apagados automaticamente (`KEEP_DAYS`).

## Importante
- A senha dos usuários **não** entra no backup. Em uma restauração, cada pessoa recebe uma senha nova.
- Guarde o backup em **outro lugar além do computador**: nuvem ou pen drive.
- O banco no plano gratuito do Supabase **não** faz backup próprio. Este script é a sua cópia de segurança.
