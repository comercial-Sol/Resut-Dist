-- RADIS Solar security hardening. Preserves all business rows.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE IF NOT EXISTS private.distribuidor_cnpj_links (
  cnpj_raiz_a varchar(8) NOT NULL REFERENCES public.distribuidores(cnpj_raiz),
  cnpj_raiz_b varchar(8) NOT NULL REFERENCES public.distribuidores(cnpj_raiz),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT distribuidor_cnpj_links_pk PRIMARY KEY (cnpj_raiz_a, cnpj_raiz_b),
  CONSTRAINT distribuidor_cnpj_links_order_ck CHECK (cnpj_raiz_a < cnpj_raiz_b)
);
ALTER TABLE private.distribuidor_cnpj_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.distribuidor_cnpj_links FROM PUBLIC, anon, authenticated;

INSERT INTO private.distribuidor_cnpj_links (cnpj_raiz_a, cnpj_raiz_b, ativo)
VALUES ('41649269', '76823327', true)
ON CONFLICT (cnpj_raiz_a, cnpj_raiz_b) DO UPDATE SET ativo = true;

CREATE OR REPLACE FUNCTION private.get_user_access()
RETURNS TABLE(perfil text, cnpj_raiz varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT ua.perfil, ua.cnpj_raiz
  FROM public.usuarios_acesso ua
  WHERE lower(ua.email) = lower(auth.jwt() ->> 'email') AND ua.perfil = 'admin'
  UNION
  SELECT ua.perfil, ua.cnpj_raiz
  FROM public.usuarios_acesso ua
  WHERE lower(ua.email) = lower(auth.jwt() ->> 'email') AND ua.perfil = 'distribuidor'
  UNION
  SELECT ua.perfil,
         CASE WHEN ua.cnpj_raiz = links.cnpj_raiz_a
              THEN links.cnpj_raiz_b ELSE links.cnpj_raiz_a END::varchar
  FROM public.usuarios_acesso ua
  JOIN private.distribuidor_cnpj_links links
    ON links.ativo AND ua.cnpj_raiz IN (links.cnpj_raiz_a, links.cnpj_raiz_b)
  WHERE lower(ua.email) = lower(auth.jwt() ->> 'email') AND ua.perfil = 'distribuidor';
$function$;

REVOKE ALL ON FUNCTION private.get_user_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_user_access() TO authenticated;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('distribuidores','usuarios_acesso','projetos_pag_fat','projetos_funil','revendas_crm','importacoes_log','solicitacoes_acesso')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END
$$;

CREATE POLICY usuarios_acesso_select ON public.usuarios_acesso
FOR SELECT TO authenticated
USING (lower(email) = lower(auth.jwt() ->> 'email')
  OR EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY usuarios_acesso_insert_admin ON public.usuarios_acesso
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY usuarios_acesso_update_admin ON public.usuarios_acesso
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY distribuidores_select_scoped ON public.distribuidores
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = distribuidores.cnpj_raiz));
CREATE POLICY distribuidores_insert_admin ON public.distribuidores
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY distribuidores_update_admin ON public.distribuidores
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY projetos_pag_fat_select_scoped ON public.projetos_pag_fat
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = projetos_pag_fat.cnpj_raiz));
CREATE POLICY projetos_pag_fat_insert_admin ON public.projetos_pag_fat
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY projetos_pag_fat_update_admin ON public.projetos_pag_fat
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY projetos_funil_select_scoped ON public.projetos_funil
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = projetos_funil.cnpj_raiz));
CREATE POLICY projetos_funil_insert_admin ON public.projetos_funil
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY projetos_funil_update_admin ON public.projetos_funil
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY revendas_crm_select_scoped ON public.revendas_crm
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = revendas_crm.cnpj_raiz));
CREATE POLICY revendas_crm_insert_scoped ON public.revendas_crm
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = revendas_crm.cnpj_raiz));
CREATE POLICY revendas_crm_update_scoped ON public.revendas_crm
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin' OR u.cnpj_raiz = revendas_crm.cnpj_raiz))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin' OR u.cnpj_raiz = revendas_crm.cnpj_raiz));

CREATE POLICY importacoes_log_select_admin ON public.importacoes_log
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY importacoes_log_insert_admin ON public.importacoes_log
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY solicitacoes_acesso_insert_public ON public.solicitacoes_acesso
FOR INSERT TO anon, authenticated
WITH CHECK (status = 'pendente' AND analisado_em IS NULL AND analisado_por IS NULL AND observacao_admin IS NULL);
CREATE POLICY solicitacoes_acesso_select_admin ON public.solicitacoes_acesso
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY solicitacoes_acesso_update_admin ON public.solicitacoes_acesso
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

ALTER TABLE public.distribuidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuidores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_acesso FORCE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_pag_fat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_pag_fat FORCE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_funil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_funil FORCE ROW LEVEL SECURITY;
ALTER TABLE public.revendas_crm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revendas_crm FORCE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_acesso FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.distribuidores, public.usuarios_acesso, public.projetos_pag_fat,
 public.projetos_funil, public.revendas_crm, public.importacoes_log, public.solicitacoes_acesso
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.distribuidores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.usuarios_acesso TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.projetos_pag_fat TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.projetos_funil TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.revendas_crm TO authenticated;
GRANT SELECT, INSERT ON TABLE public.importacoes_log TO authenticated;
GRANT INSERT ON TABLE public.solicitacoes_acesso TO anon;
GRANT INSERT, SELECT, UPDATE ON TABLE public.solicitacoes_acesso TO authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_usuarios_acesso_cnpj_raiz ON public.usuarios_acesso(cnpj_raiz);

REVOKE ALL ON FUNCTION public.get_user_access() FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.get_user_access();
