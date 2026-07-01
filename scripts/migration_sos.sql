-- ============================================================
-- Migration : fix alerte SOS mobile → incidents
-- Problème  : l'agent mobile utilise la clé anon (pas de session
--             Supabase Auth). Un INSERT direct sur incidents peut
--             être silencieusement bloqué par RLS (pas d'erreur
--             retournée mais aucune ligne écrite).
-- Solution  : fonction SECURITY DEFINER exécutée avec les droits
--             du propriétaire → bypass RLS garanti.
-- Idempotent : oui (CREATE OR REPLACE + IF NOT EXISTS)
-- ============================================================

-- 1. Fonction d'insertion alerte SOS ─────────────────────────
CREATE OR REPLACE FUNCTION public.inserer_alerte_sos(
  p_nom_agent   TEXT,
  p_site        TEXT,
  p_description TEXT    DEFAULT 'Alerte panique',
  p_lat         FLOAT8  DEFAULT 36.75,
  p_lng         FLOAT8  DEFAULT 3.05
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.incidents (
    nom_agent,
    site,
    heure_incident,
    resolu,
    lat,
    lng,
    description
  )
  VALUES (
    NULLIF(TRIM(p_nom_agent),   ''),
    NULLIF(TRIM(p_site),        ''),
    TO_CHAR(NOW() AT TIME ZONE 'Africa/Algiers', 'HH24:MI:SS'),
    false,
    COALESCE(p_lat, 36.75),
    COALESCE(p_lng,  3.05),
    COALESCE(NULLIF(TRIM(p_description), ''), 'Alerte panique')
  );
END;
$$;

-- 2. Autoriser l'exécution aux deux rôles Supabase ───────────
-- anon         = utilisateur mobile non-authentifié (carte pro)
-- authenticated = admin web connecté
GRANT EXECUTE ON FUNCTION public.inserer_alerte_sos(TEXT, TEXT, TEXT, FLOAT8, FLOAT8)
  TO anon, authenticated;

-- 3. Vérification ────────────────────────────────────────────
SELECT
  routine_name,
  security_type,
  routine_definition IS NOT NULL AS has_body
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'inserer_alerte_sos';
