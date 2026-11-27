-- Persist a shared economic group for related distributor CNPJ roots.
-- Existing rows are preserved; ungrouped roots become their own economic group.
ALTER TABLE public.distribuidores
  ADD COLUMN IF NOT EXISTS grupo_economico_id text;

UPDATE public.distribuidores
SET grupo_economico_id = cnpj_raiz
WHERE grupo_economico_id IS NULL OR btrim(grupo_economico_id) = '';

UPDATE public.distribuidores
SET grupo_economico_id = '2M_CONNECTIONS'
WHERE cnpj_raiz IN ('41649269','76823327');

CREATE OR REPLACE FUNCTION private.assign_default_distributor_group()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.grupo_economico_id IS NULL OR btrim(NEW.grupo_economico_id) = '' THEN
    NEW.grupo_economico_id := NEW.cnpj_raiz;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_distributor_group ON public.distribuidores;
CREATE TRIGGER trg_assign_distributor_group
BEFORE INSERT OR UPDATE OF cnpj_raiz ON public.distribuidores
FOR EACH ROW EXECUTE FUNCTION private.assign_default_distributor_group();

ALTER TABLE public.distribuidores
  ALTER COLUMN grupo_economico_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distribuidores_grupo_economico
  ON public.distribuidores(grupo_economico_id);
