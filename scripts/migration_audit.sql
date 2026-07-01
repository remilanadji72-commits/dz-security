-- ============================================================
-- Migration : Audit Log — Traçabilité complète des actions
--
-- Crée :
--   • public.audit_log          — table d'historique
--   • public.fn_audit_trigger() — fonction trigger générique
--   • trg_audit                 — trigger sur 6 tables critiques
--
-- Idempotent : oui (IF NOT EXISTS + CREATE OR REPLACE + DROP TRIGGER IF EXISTS)
-- Dépendances : les tables cibles doivent exister
-- ============================================================

-- ─── 1. Table audit_log ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGSERIAL    PRIMARY KEY,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Qui a fait l'action
  user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  TEXT,
  user_role   TEXT,

  -- Quelle action, sur quoi
  table_name  TEXT         NOT NULL,
  operation   TEXT         NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  row_id      BIGINT,

  -- Valeurs avant/après (NULL selon l'opération)
  old_data    JSONB,
  new_data    JSONB
);

COMMENT ON TABLE public.audit_log IS
  'Traçabilité complète : qui a modifié quoi, quand, avec les valeurs avant/après.';

-- ─── 2. Index pour requêtes d'audit fréquentes ──────────────
CREATE INDEX IF NOT EXISTS idx_audit_created
  ON public.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_table_created
  ON public.audit_log (table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user_created
  ON public.audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_operation
  ON public.audit_log (operation, table_name);

-- ─── 3. Droits d'accès ──────────────────────────────────────
-- RLS désactivé : la table est protégée par GRANT/REVOKE
-- (activer RLS sur audit_log créerait une récursion avec le trigger)
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;

-- Aucun accès direct pour anon
REVOKE ALL ON public.audit_log FROM anon;

-- Lecture seule pour les utilisateurs authentifiés
REVOKE ALL ON public.audit_log FROM authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

-- La séquence est gérée par le trigger (SECURITY DEFINER) — pas besoin de GRANT
REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM anon, authenticated;

-- ─── 4. Fonction trigger générique ──────────────────────────
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire
-- même si l'utilisateur n'a pas de GRANT INSERT sur audit_log.
-- SET search_path = public : protège contre les attaques de schema.
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    user_email,
    user_role,
    table_name,
    operation,
    row_id,
    old_data,
    new_data
  )
  VALUES (
    auth.uid(),
    auth.email(),
    COALESCE(auth.jwt() ->> 'role', 'anon'),
    TG_TABLE_NAME,
    TG_OP,
    CASE TG_OP
      WHEN 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    CASE TG_OP
      WHEN 'INSERT' THEN NULL
      ELSE to_jsonb(OLD)
    END,
    CASE TG_OP
      WHEN 'DELETE' THEN NULL
      ELSE to_jsonb(NEW)
    END
  );

  -- Pour UPDATE/INSERT retourner NEW, pour DELETE retourner OLD
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─── 5. Attacher le trigger aux tables critiques ─────────────
-- Idempotent : DROP TRIGGER IF EXISTS avant chaque CREATE.
-- Le DO block vérifie que la table existe avant d'attacher.
DO $$
DECLARE
  t TEXT;
  tables_cibles TEXT[] := ARRAY[
    'agents',
    'armes',
    'radios_uhf',
    'vehicules',
    'contrats',
    'paie_bulletins'
  ];
BEGIN
  FOREACH t IN ARRAY tables_cibles
  LOOP
    -- Vérifier que la table existe avant d'attacher
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- Supprimer le trigger existant (idempotence)
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_audit ON public.%I',
        t
      );

      -- Créer le trigger AFTER INSERT OR UPDATE OR DELETE
      EXECUTE format(
        'CREATE TRIGGER trg_audit
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger()',
        t, t
      );

      RAISE NOTICE 'Trigger audit_log attaché → %', t;
    ELSE
      RAISE WARNING 'Table % non trouvée — trigger ignoré (créer la table puis relancer)', t;
    END IF;
  END LOOP;
END;
$$;

-- ─── 6. Vue pratique pour l'interface SuperAdmin ─────────────
CREATE OR REPLACE VIEW public.v_audit_recent AS
SELECT
  a.id,
  a.created_at AT TIME ZONE 'Africa/Algiers' AS created_at_local,
  a.user_email,
  a.user_role,
  a.table_name,
  a.operation,
  a.row_id,
  -- Résumé lisible du changement
  CASE a.operation
    WHEN 'INSERT' THEN 'Création'
    WHEN 'UPDATE' THEN 'Modification'
    WHEN 'DELETE' THEN 'Suppression'
  END AS operation_fr,
  -- Champ "nom" de la ligne si disponible
  COALESCE(
    a.new_data ->> 'nom',
    a.new_data ->> 'matricule',
    a.new_data ->> 'immatriculation',
    a.old_data ->> 'nom',
    a.old_data ->> 'matricule',
    a.old_data ->> 'immatriculation',
    '—'
  ) AS libelle_entite
FROM public.audit_log a
ORDER BY a.created_at DESC;

COMMENT ON VIEW public.v_audit_recent IS
  'Vue simplifiée pour l''affichage dans le tableau de bord SuperAdmin.';

GRANT SELECT ON public.v_audit_recent TO authenticated;

-- ─── 7. Requêtes de vérification ────────────────────────────
-- Exécuter après la migration pour confirmer le déploiement.

-- Liste des triggers créés :
SELECT
  trigger_name,
  event_object_table AS table_name,
  event_manipulation AS event,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name   = 'trg_audit'
ORDER BY event_object_table;

-- Vérification de la fonction :
SELECT
  routine_name,
  security_type,
  routine_definition IS NOT NULL AS has_body
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'fn_audit_trigger';

-- Test manuel : insérer une ligne de test et vérifier l'audit
-- (à commenter en production)
-- INSERT INTO public.agents (matricule, nom, date_recrutement, statut_agent)
-- VALUES ('TEST-AUDIT-001', 'TEST AUDIT', CURRENT_DATE, 'ACTIF');
-- SELECT * FROM public.audit_log ORDER BY id DESC LIMIT 1;
-- DELETE FROM public.agents WHERE matricule = 'TEST-AUDIT-001';
