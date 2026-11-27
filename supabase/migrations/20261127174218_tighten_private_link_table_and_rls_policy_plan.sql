DROP POLICY IF EXISTS usuarios_acesso_select ON public.usuarios_acesso;
CREATE POLICY usuarios_acesso_select ON public.usuarios_acesso
FOR SELECT TO authenticated
USING (
  lower(email) = lower((SELECT auth.jwt() ->> 'email'))
  OR EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin')
);
CREATE INDEX IF NOT EXISTS idx_distribuidor_cnpj_links_b
  ON private.distribuidor_cnpj_links(cnpj_raiz_b);
DROP POLICY IF EXISTS deny_client_access ON private.distribuidor_cnpj_links;
CREATE POLICY deny_client_access ON private.distribuidor_cnpj_links
AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);
