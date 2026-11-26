# Portal RADIS Solar — Gestão de Distribuidores e Performance

Aplicação Web completa para acompanhamento comercial, apuração de comissões e bônus **Política RADIS**, funil de vendas, gestão de carteira de revendas e simulador de parcelamento.

## Arquitetura e Segurança
- **Front-end:** React + Vite + Tailwind CSS + Recharts + SheetJS (`xlsx`).
- **Back-end & Auth:** Supabase (PostgreSQL + Auth + Row Level Security).
- **Consolidação Matriz + Filiais:** Todos os registros do Qlik são agrupados automaticamente pelos **8 primeiros dígitos do CNPJ (`cnpj_raiz`)**.
- **Controle de Acesso:**
  - **Distribuidores (Vendedores, Gerentes, Diretores):** Cada e-mail cadastrado enxerga **100% dos resultados consolidados do seu distribuidor** (matriz + filiais), sem acesso a outros canais.
  - **Administradores:** Enxergam o **consolidado nacional de todos os 40+ canais**, ranking de faturamento, projeção de comissões/bônus, gestão de metas, cadastro de e-mails e **upload direto das planilhas do Qlik**.

---

## Passo a Passo para Colocar no Ar (GitHub + Vercel + Supabase)

### 1. Configurar o Banco de Dados no Supabase (Gratuito)
1. Crie uma conta em [supabase.com](https://supabase.com) e crie um novo projeto.
2. No menu lateral, abra **SQL Editor** -> **New Query**.
3. Cole e execute todo o conteúdo do arquivo `supabase/schema.sql`.
4. Em seguida, cole e execute o arquivo `supabase/seed_distribuidores.sql` (já contém os distribuidores mapeados da sua planilha).
5. Vá em **Authentication** -> **Users** -> **Add user** para criar o primeiro login do Administrador (e cadastre o mesmo e-mail na tabela `usuarios_acesso` com `perfil = 'admin'`).
6. Vá em **Project Settings** -> **API** e copie a `Project URL` e a chave `anon public`.

### 2. Subir para o GitHub
1. Crie um repositório novo no seu GitHub (ex: `painel-radis-solar`).
2. Envie todos os arquivos desta pasta para o repositório.

### 3. Publicar na Web (Vercel)
1. Acesse [vercel.com](https://vercel.com), conecte sua conta do GitHub e importe o repositório `painel-radis-solar`.
2. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = (URL copiada do Supabase)
   - `VITE_SUPABASE_ANON_KEY` = (Chave anon public copiada do Supabase)
3. Clique em **Deploy**. Em ~1 minuto seu sistema estará online com HTTPS!

---

## Como Atualizar os Dados do Qlik
1. Faça login como **Administrador**.
2. Acesse a aba **Atualizar Base Qlik**.
3. Selecione a planilha de **Projetos Pagos/Pedidos** (`Sem título...xlsx`) e/ou a planilha de **Projetos Criados** (`Criadas Campanha...xlsx`).
4. O sistema remove automaticamente linhas duplicadas de componentes/formas de pagamento por `Código Venda Projeto Solar`, agrupa matriz e filiais pela raiz do CNPJ e atualiza todos os 40 painéis instantaneamente.
