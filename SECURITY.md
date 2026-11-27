# Segurança do Portal RADIS Solar

## Controles implementados

- Supabase Auth é a única autenticação de produção; o modo de demonstração fica restrito ao desenvolvimento local.
- RLS está ativado e forçado nas sete tabelas públicas da aplicação.
- O papel `anon` não tem leitura nas tabelas comerciais ou na tabela de solicitações.
- O formulário público permite somente inserir uma solicitação pendente; leitura e atualização são reservadas ao administrador.
- Distribuidores recebem apenas raízes de CNPJ explicitamente vinculadas em `private.distribuidor_cnpj_links`. O portal não infere mais acesso pelo nome da empresa.
- `private.get_user_access()` está em schema não exposto à API; a antiga RPC pública foi removida.
- Escrita de dados comerciais/importações é administrativa; CRM é restrito ao próprio grupo de CNPJ.
- O cliente usa apenas a chave publishable/anon do Supabase. A chave service-role deve permanecer exclusivamente no ambiente da Edge Function.
- A importação aceita apenas XLSX/XLS/CSV até 50 MB.
- SheetJS foi atualizado para a distribuição oficial corrigida 0.20.3.
- A página aplica Content Security Policy e política de referrer.
- GitHub Actions usa SHAs fixos e executa `npm audit` antes do build.
- Dependabot acompanha atualizações de dependências e Actions.

## Configurações operacionais ainda necessárias no painel

1. Ativar **Leaked Password Protection** em Supabase Authentication > Settings > Password Security.
2. Cadastrar MFA TOTP para todos os administradores. Só depois de cadastrar e testar o segundo fator, exigir AAL2 nas operações privilegiadas.
3. Ativar CAPTCHA/bot protection e rever limites de envio de e-mail e tentativas de autenticação.
4. Rever tempos de sessão e sessões ativas.
5. Configurar proteção da branch `main`: PR obrigatório, checks obrigatórios e bloqueio de force-push. A conexão GitHub disponível nesta sessão não autorizou consultar/alterar branch protection.
6. Criar e versionar um `package-lock.json` depois de validar a instalação da dependência SheetJS pelo CDN oficial; o repositório ainda não continha lockfile na auditoria.

## Resposta a incidentes

Se uma chave secreta (service-role, token GitHub ou senha) for exposta, revogue/rotacione imediatamente no serviço emissor. Apagar um arquivo do commit atual não invalida um segredo já publicado no histórico. Nunca coloque service-role, senhas ou tokens privados em variáveis `VITE_*`.

## Limites

Nenhum sistema pode ser garantido como impenetrável. Os controles reduzem superfícies de ataque e precisam ser acompanhados por monitorização, testes de autorização e atualização contínua.
