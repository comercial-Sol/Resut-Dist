# Portal RADIS Solar — versão corrigida

Aplicação React + Vite + Supabase para acompanhamento de faturamento, funil, revendas e política RADIS.

## Instalação

1. Execute `supabase/schema.sql` no SQL Editor do Supabase.
2. Execute `supabase/seed_distribuidores.sql`.
3. Crie o usuário administrador em Supabase Authentication.
4. Cadastre o mesmo e-mail na tabela `public.usuarios_acesso` como administrador. Faça a primeira inserção pelo SQL Editor (com privilégios de banco), por exemplo:

```sql
insert into public.usuarios_acesso (email, nome, cargo, perfil, cnpj_raiz)
values ('SEU_EMAIL@EMPRESA.COM', 'Administrador', 'Admin', 'admin', null)
on conflict (email) do update
set nome = excluded.nome, cargo = excluded.cargo, perfil = 'admin', cnpj_raiz = null;
```

5. Configure as variáveis no provedor de deploy:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Instale e execute localmente:

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
```

## Importação de dados

Entre como administrador e importe separadamente:
- a planilha PAG/FAT (`Sem título...xlsx`);
- a planilha Criadas/Funil (`Criadas Campanha...xlsx`).

A importação consolida linhas repetidas por `Código Venda Projeto Solar`, preserva detalhes de pagamentos/componentes em JSONB, normaliza CNPJ, cadastra raízes de distribuidores faltantes e grava os projetos em lotes.

**Importante:** na base Criadas, projetos na etapa Pré-orçamento têm `Valor Total` igual a zero no arquivo de origem. O sistema usa `Valor Produtos com Desconto` como valor estimado quando `Valor Total` é zero. Esse número é pipeline estimado, não faturamento realizado.

## Documentação

- `AUDITORIA_E_CORRECOES.md`: achados, métricas, correções e limitações da validação.
- `supabase/schema.sql`: SQL consolidado do banco e políticas de acesso.
- `supabase/seed_distribuidores.sql`: cadastro inicial de distribuidores, incluindo as 17 raízes encontradas somente na base Criadas.

O app não usa dados demo quando o Supabase está configurado: se o carregamento real falhar, apresenta erro em vez de exibir números de demonstração.
