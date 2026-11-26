# Auditoria técnica — Portal RADIS Solar

Data das planilhas: 26/11/2026  
Período analisado: todo o histórico disponível nas bases recebidas.

## Arquivos examinados
- `Resut-Dist-main.zip`: todos os arquivos do projeto React/Vite, utilitários, Dashboards, SQL e seed.
- `SUPABASE.xlsx`: todas as quatro abas com comandos SQL.
- `Sem título - 26 de novembro de 2026 (1).xlsx`: base PAG/FAT, 65 colunas.
- `Criadas Campanha - 26 de novembro de 2026.xlsx`: base Criadas/Funil, 65 colunas.

## Validação quantitativa das planilhas

| Verificação | PAG/FAT | Criadas/Funil |
|---|---:|---:|
| Linhas brutas | 17,980 | 43,165 |
| Códigos únicos | 16,645 | 42,853 |
| Linhas repetidas além do primeiro código | 1,335 | 312 |
| Raízes de CNPJ distintas | 73 | 92 |
| Colunas | 65 | 65 |

As duas planilhas têm o mesmo conjunto de 65 nomes de colunas. Foram encontrados 3,927 códigos repetidos entre as bases. São conjuntos funcionais diferentes; não somar os totais das duas planilhas para obter faturamento.

### Descoberta crítica no funil
Na base Criadas, os 36,175 projetos únicos da etapa `Pré-orçamento` têm `Valor Total` igual a zero. Entretanto, `Valor Produtos com Desconto` está preenchido em 36,061 deles e soma R$ 972,480,472.32. O Dashboard antigo somava `Valor Total`, portanto o indicador de Pré-orçamento podia aparecer zerado.

Correção aplicada: para a base Criadas, `valor_total` usa `Valor Total` quando positivo; se o Qlik entrega zero (caso do Pré-orçamento), usa `Valor Produtos com Desconto` como valor estimado. Essa estimativa não é faturamento realizado.

### PAG/FAT e status
Após deduplicação por código:
- Pago: 16,068 projetos, soma de Valor Total R$ 263,830,070.54.
- Cancelado: 373.
- Existem 58 projetos Pago sem NF, mas com data de pagamento. A lógica mantém esses projetos como pagos, usando a data de pagamento quando não há data de NF.
- A existência de NF também pode validar faturamento mesmo quando o status não é `Pago`.

### Duplicidades e campos complementares
Os valores financeiros, código, CNPJ distribuidor, data de criação e status são consistentes dentro dos grupos repetidos verificados. O código antigo mantinha a primeira linha e descartava as demais. A nova programação mantém um registro financeiro por projeto e agrega pagamentos/componentes distintos em estruturas JSONB, sem somar novamente o valor total.

### Cadastro de distribuidores
O seed original continha 93 raízes de CNPJ. A planilha Criadas apresenta 92 raízes, das quais 17 não estavam no seed original. As 17 raízes novas foram acrescentadas a `supabase/seed_distribuidores.sql`. A rotina de importação também faz upsert dos distribuidores antes de inserir os projetos.

## Falhas de programação corrigidas

1. **Paginação Supabase:** `select('*')` sem paginação podia limitar o retorno a 1.000 registros por consulta. O `App.jsx` agora busca páginas de 1.000 até esgotar cada tabela.
2. **Fallback de dados demo:** quando o Supabase falhava, o app podia manter dados demonstrativos. Agora limpa os dados reais antes do carregamento e exibe erro explícito em caso de falha.
3. **Importação:** erros no upsert de distribuidores e no log agora interrompem a importação e são apresentados; os projetos são gravados em lotes de 500.
4. **Deduplicação:** mantém um projeto por código e preserva pagamentos/componentes distintos em JSONB; não soma valores repetidos.
5. **CNPJ/CPF:** documentos de revenda com 11 dígitos (CPF) não são convertidos em CNPJ artificial. CNPJs com zeros à esquerda são normalizados.
6. **Pré-orçamento:** corrige o valor zero de `Valor Total` na etapa Pré-orçamento usando o campo de produtos com desconto como estimativa, não como faturamento.
7. **Funil aberto:** a aba de funil e o pré-orçamento deixam de incluir projetos pagos, cancelados ou recusados.
8. **Carteira e ticket médio:** carteira considera registros sem NF e não cancelados; ticket médio usa apenas projetos pagos ou com NF.
9. **Possibilidade de conversão:** o indicador foi definido como 10% do valor de pré-orçamento aberto, coerente com o rótulo do card. Se a regra comercial pretendida for outra, precisa ser confirmada.
10. **Período TODOS:** corrige `NaN` no ano de referência das revendas e calcula o trimestre com base no ano mais recente presente nos dados.
11. **Comissões:** mantém a comissão percentual do Qlik separada da estimativa RADIS (percentual da faixa sobre faturamento trimestral), para não misturar bases de cálculo.
12. **Supabase SQL:** unifica as abas do Excel e o `schema.sql`, adiciona `cargo`, `importacoes_log`, status do funil, colunas JSONB para origem/pagamentos/componentes, índices, grants e políticas RLS reexecutáveis.
13. **Segurança:** a função `get_user_access()` usa `SECURITY DEFINER` com `search_path` fixo; políticas de leitura e escrita separam administradores e distribuidores.

## Limitações e validações pendentes de ambiente
- Não tenho acesso às credenciais do seu projeto Supabase; portanto não executei o SQL no seu banco nem validei políticas com usuários reais.
- A instalação de dependências excedeu o tempo disponível. A compilação Vite (`npm run build`) não pôde ser executada neste ambiente.
- Foi feita validação sintática dos arquivos JS/JSX com o compilador TypeScript (transpilação/parsing): todos os dez arquivos JS/JSX do diretório `src` passaram sem diagnóstico.
- Depois de executar o SQL e publicar o código, faça primeiro um teste com um usuário administrador e um usuário distribuidor para validar o isolamento RLS.
- A importação faz upsert por código. Ela atualiza os códigos presentes no arquivo e preserva registros históricos que não aparecem na exportação seguinte; não apaga automaticamente registros ausentes.
