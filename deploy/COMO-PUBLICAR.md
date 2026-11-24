# Como publicar no cPanel (app.seudominio.com.br)

Tempo estimado na primeira vez: ~20 minutos. Depois, cada atualização é um comando.

> Troque `seudominio.com.br` e `cpaneluser` pelos seus dados reais em todos os passos.

---

## Parte 1 — No painel do cPanel (uma vez só)

### 1. Banco de dados
1. **Bancos de dados MySQL®** → *Criar novo banco*: `dietaetreino` (vira `cpaneluser_dietaetreino`).
2. *Adicionar novo usuário*: `dtapp` (vira `cpaneluser_dtapp`) com uma senha forte. **Guarde a senha.**
3. *Adicionar usuário ao banco* → marque **TODOS OS PRIVILÉGIOS**.

### 2. Subdomínio
1. **Domínios** → *Criar um novo domínio* → `app.seudominio.com.br`.
2. **Desmarque** "Compartilhar a raiz do documento" e, em *Raiz do documento*, coloque:
   `dietaetreino/public`
3. Salvar.

### 3. PHP 8.3
1. **MultiPHP Manager** → marque `app.seudominio.com.br` → versão **PHP 8.3**.
2. **Selecionar versão do PHP / Extensões** (se existir): confirme ativas
   `pdo_mysql`, `mbstring`, `gd`, `fileinfo`, `openssl`, `tokenizer`, `xml`, `ctype`, `bcmath`.

### 4. HTTPS
**SSL/TLS Status** → selecione o subdomínio → *Run AutoSSL*. Espere o cadeado ficar verde
(a câmera e a instalação do app no celular só funcionam com HTTPS).

### 5. Acesso SSH por chave (recomendado)
No seu computador, crie uma chave **só deste projeto** (o `-f` dá outro nome e não mexe em chaves que você já tem):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_dietaetreino -C "deploy dieta-treino"   # Enter nas perguntas
cat ~/.ssh/id_ed25519_dietaetreino.pub                                              # copie o resultado
```
> Se aparecer "already exists. Overwrite (y/n)?", responda **n** — e confira se usou o `-f` com o nome acima.

No cPanel: **Acesso SSH** → *Gerenciar chaves SSH* → *Importar chave* → cole o conteúdo do `.pub` → depois *Autorizar*.

Teste (deve entrar sem pedir a senha do cPanel):
```bash
ssh -i ~/.ssh/id_ed25519_dietaetreino -o IdentitiesOnly=yes cpaneluser@seudominio.com.br
```

---

## Parte 2 — No servidor, via SSH (uma vez só)

```bash
ssh cpaneluser@seudominio.com.br
mkdir -p ~/dietaetreino
nano ~/dietaetreino/.env
```
Cole o conteúdo de `deploy/env.production.example`, preencha `APP_URL`, `DB_DATABASE`,
`DB_USERNAME`, `DB_PASSWORD` e salve (Ctrl+O, Enter, Ctrl+X). Deixe `APP_KEY=` vazio
(o deploy gera sozinho).

Descubra o caminho do PHP 8.3:
```bash
ls /opt/cpanel/ea-php83/root/usr/bin/php && echo OK   # se aparecer OK, use esse caminho
```

---

## Parte 3 — No seu computador (primeiro deploy)

```bash
cd /var/www/html/dietaetreino
cp deploy/deploy.config.example deploy/deploy.config
nano deploy/deploy.config        # SSH_USER, SSH_HOST, REMOTE_DIR=dietaetreino, PHP_BIN

bash deploy/build.sh             # monta a versão de produção
bash deploy/deploy.sh --seed     # envia + cria tabelas + importa TACO e exercícios
```

Abra **https://app.seudominio.com.br** → crie sua conta → pronto. 🎉

---

## Atualizações futuras

```bash
bash deploy/build.sh && bash deploy/deploy.sh
```
O `.env` e a pasta `storage/` (fotos dos check-ins) **nunca são sobrescritos**.
O app instalado no celular se atualiza sozinho ao abrir.

---

## Backup (importante)
No cPanel, **Backup** → inclua:
- o banco `cpaneluser_dietaetreino`;
- a pasta `~/dietaetreino/storage/app/private` (fotos dos check-ins).

## Se algo der errado
| Sintoma | O que verificar |
|---|---|
| Página em branco / erro 500 | `~/dietaetreino/storage/logs/` (último arquivo `laravel-*.log`) |
| "Falta o arquivo .env" no deploy | Parte 2 |
| Erro de conexão com o banco | nome/usuário com o prefixo `cpaneluser_`, senha, privilégios |
| Câmera não abre | o site precisa estar em **https://** (Parte 1, passo 4) |
| `php: command not found` / versão errada | `PHP_BIN` em `deploy/deploy.config` |
| Foto não envia (muito grande) | `public/.user.ini` (já incluso: 12 MB) — alguns cPanels exigem ajustar em *MultiPHP INI Editor* |
