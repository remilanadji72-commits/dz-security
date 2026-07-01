-- ============================================================
-- Migration : synchronisation mobile → tableau de bord web
-- Problème  : l'app mobile (/mobile) utilise la clé anon Supabase
--             (pas de signInWithPassword). Les INSERT directs sont
--             silencieusement bloqués par les RLS WITH CHECK.
--             Sans ligne écrite, le Realtime ne notifie jamais
--             le dashboard admin.
-- Solution  : 4 fonctions SECURITY DEFINER + Realtime FULL.
-- Idempotent : oui (CREATE OR REPLACE + DO $$ guards)
-- Note      : cette app est React web (pas React Native / Expo).
-- ============================================================

-- ─── 1. REPLICA IDENTITY FULL pour Realtime complet ────────
-- Nécessaire pour que les événements UPDATE/DELETE transmettent
-- l'ancienne valeur (et pour que RLS puisse vérifier la visibilité).
ALTER TABLE public.incidents             REPLICA IDENTITY FULL;
ALTER TABLE public.pointages_journaliers REPLICA IDENTITY FULL;
ALTER TABLE public.passations            REPLICA IDENTITY FULL;
ALTER TABLE public.rondes                REPLICA IDENTITY FULL;

-- ─── 2. Ajouter les tables à la publication Realtime ────────
-- Idempotent via pg_publication_tables.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['incidents','pointages_journaliers','passations','rondes']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Table % ajoutée à supabase_realtime', t;
    ELSE
      RAISE NOTICE 'Table % déjà dans supabase_realtime', t;
    END IF;
  END LOOP;
END;
$$;

-- ─── 3. RPC : enregistrement de pointage ────────────────────
-- Remplace le double INSERT/UPDATE direct de pointerService()
-- • INSERT pointages_journaliers  (présence terrain)
-- • UPDATE agents.lat/lng/heure_pointage  (position GPS)
CREATE OR REPLACE FUNCTION public.mobile_enregistrer_pointage(
  p_nom_agent       TEXT,
  p_site_affecte    TEXT,
  p_date_pointage   TEXT,           -- 'YYYY-MM-DD'
  p_heure_arrivee   TEXT,           -- 'HH:MM:SS'
  p_type_vacation   TEXT    DEFAULT 'JOUR',
  p_lat             FLOAT8  DEFAULT NULL,
  p_lng             FLOAT8  DEFAULT NULL,
  p_num_carte_pro   TEXT    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enregistrer la présence
  INSERT INTO public.pointages_journaliers (
    nom_agent, site_affecte, date_pointage,
    heure_arrivee, type_vacation, statut_validation
  )
  VALUES (
    NULLIF(TRIM(p_nom_agent),    ''),
    NULLIF(TRIM(p_site_affecte), ''),
    p_date_pointage,
    p_heure_arrivee,
    COALESCE(NULLIF(TRIM(p_type_vacation), ''), 'JOUR'),
    'EN ATTENTE'
  );

  -- Mettre à jour la position GPS de l'agent (si données disponibles)
  IF p_num_carte_pro IS NOT NULL AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    UPDATE public.agents
    SET
      heure_pointage = p_heure_arrivee,
      lat            = p_lat,
      lng            = p_lng
    WHERE num_carte_pro ILIKE p_num_carte_pro;
  END IF;
END;
$$;

-- ─── 4. RPC : transmission d'un relevé / itinéraire ─────────
-- Utilisée par transmettreReleve() ET transmettreItineraire()
-- (même table passations, colonnes identiques)
CREATE OR REPLACE FUNCTION public.mobile_transmettre_passation(
  p_site            TEXT,
  p_chef_montant    TEXT,
  p_chef_descendant TEXT    DEFAULT '',
  p_consignes       TEXT    DEFAULT 'R.A.S',
  p_anomalies       TEXT    DEFAULT 'R.A.S',
  p_materiel_ok     BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.passations (
    site, chef_montant, chef_descendant,
    materiel_ok, consignes, anomalies
  )
  VALUES (
    NULLIF(TRIM(p_site),            ''),
    NULLIF(TRIM(p_chef_montant),    ''),
    COALESCE(NULLIF(TRIM(p_chef_descendant), ''), '—'),
    p_materiel_ok,
    COALESCE(NULLIF(TRIM(p_consignes), ''), 'R.A.S'),
    COALESCE(NULLIF(TRIM(p_anomalies), ''), 'R.A.S')
  );
END;
$$;

-- ─── 5. RPC : scan d'un point de contrôle (ronde) ───────────
CREATE OR REPLACE FUNCTION public.mobile_scanner_ronde(
  p_nom_agent      TEXT,
  p_site           TEXT,
  p_point_controle TEXT,
  p_heure_passage  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rondes (nom_agent, site, point_controle, heure_passage)
  VALUES (
    NULLIF(TRIM(p_nom_agent),      ''),
    NULLIF(TRIM(p_site),           ''),
    NULLIF(TRIM(p_point_controle), ''),
    p_heure_passage
  );
END;
$$;

-- ─── 6. RPC : signalement d'un problème matériel ────────────
CREATE OR REPLACE FUNCTION public.mobile_signaler_probleme_materiel(
  p_nom_agent       TEXT,
  p_notes           TEXT,
  p_arme_id         BIGINT  DEFAULT NULL,
  p_radio_id        BIGINT  DEFAULT NULL,
  p_date_maintenance TEXT    DEFAULT NULL   -- 'YYYY-MM-DD', NULL = aujourd'hui
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.maintenances_armes (
    arme_id, radio_id, type_maintenance, notes, date_maintenance
  )
  VALUES (
    p_arme_id,
    p_radio_id,
    'SIGNALEMENT_AGENT',
    COALESCE(NULLIF(TRIM(p_notes), ''), '[Mobile] Signalement sans description'),
    COALESCE(p_date_maintenance, CURRENT_DATE::TEXT)
  );
END;
$$;

-- ─── 7. Grants — toutes les fonctions ───────────────────────
GRANT EXECUTE ON FUNCTION public.mobile_enregistrer_pointage(TEXT,TEXT,TEXT,TEXT,TEXT,FLOAT8,FLOAT8,TEXT)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mobile_transmettre_passation(TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mobile_scanner_ronde(TEXT,TEXT,TEXT,TEXT)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mobile_signaler_probleme_materiel(TEXT,TEXT,BIGINT,BIGINT,TEXT)
  TO anon, authenticated;

-- ─── 8. Vérification ────────────────────────────────────────
SELECT
  routine_name,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'inserer_alerte_sos',
    'mobile_enregistrer_pointage',
    'mobile_transmettre_passation',
    'mobile_scanner_ronde',
    'mobile_signaler_probleme_materiel'
  )
ORDER BY routine_name;
