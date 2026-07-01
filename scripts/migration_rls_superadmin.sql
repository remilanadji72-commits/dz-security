-- ============================================================
--  MIGRATION : RLS SUPER_ADMIN — DzSecurity-Fusion
--  Idempotent : peut être exécuté plusieurs fois sans erreur.
--  À coller dans : Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  ÉTAPE 0 — Fonction helper is_super_admin()
--  SECURITY DEFINER : bypass RLS pour éviter la récursion
--  (la politique sur profils_admin ne peut pas appeler
--   profils_admin elle-même sans créer une boucle infinie)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profils_admin
    WHERE id = auth.uid()
      AND role = 'SUPER_ADMIN'
  );
$$;

-- ────────────────────────────────────────────────────────────
--  ÉTAPE 1 — Table entreprises (CREATE IF NOT EXISTS)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.entreprises (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              TEXT        NOT NULL,
  email            TEXT        UNIQUE,
  telephone        TEXT,
  wilaya           TEXT,
  adresse          TEXT,
  numero_agrement  TEXT,
  plan             TEXT        NOT NULL DEFAULT 'STARTER'
                               CHECK (plan IN ('STARTER','PME','PRO','ENTREPRISE')),
  statut           TEXT        NOT NULL DEFAULT 'ESSAI'
                               CHECK (statut IN ('ACTIF','ESSAI','SUSPENDU')),
  max_agents       INTEGER     NOT NULL DEFAULT 30,
  date_fin_essai   DATE        DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  owner_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colonne company_id sur profils_admin (liaison tenant)
ALTER TABLE public.profils_admin
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.entreprises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nom        TEXT,
  ADD COLUMN IF NOT EXISTS email      TEXT;

-- Trigger auto updated_at sur entreprises
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_entreprises_updated_at ON public.entreprises;
CREATE TRIGGER trg_entreprises_updated_at
  BEFORE UPDATE ON public.entreprises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
--  ÉTAPE 2 — RLS sur la table entreprises
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.entreprises ENABLE ROW LEVEL SECURITY;

-- Nettoyer les anciennes politiques (idempotence)
DROP POLICY IF EXISTS "sa_select_all_entreprises"   ON public.entreprises;
DROP POLICY IF EXISTS "owner_select_own_entreprise" ON public.entreprises;
DROP POLICY IF EXISTS "sa_insert_entreprise"        ON public.entreprises;
DROP POLICY IF EXISTS "owner_insert_own_entreprise" ON public.entreprises;
DROP POLICY IF EXISTS "sa_update_all_entreprises"   ON public.entreprises;
DROP POLICY IF EXISTS "owner_update_own_entreprise" ON public.entreprises;
DROP POLICY IF EXISTS "sa_delete_entreprise"        ON public.entreprises;
-- Ancienne politique générique (si elle existait)
DROP POLICY IF EXISTS "super_admin_all"  ON public.entreprises;
DROP POLICY IF EXISTS "owner_own_company" ON public.entreprises;

-- ── SELECT ──
-- SUPER_ADMIN : voit toutes les entreprises
CREATE POLICY "sa_select_all_entreprises"
  ON public.entreprises FOR SELECT
  USING (public.is_super_admin());

-- Propriétaire : voit uniquement la sienne
CREATE POLICY "owner_select_own_entreprise"
  ON public.entreprises FOR SELECT
  USING (owner_id = auth.uid());

-- ── INSERT ──
-- SUPER_ADMIN peut créer un tenant manuellement
CREATE POLICY "sa_insert_entreprise"
  ON public.entreprises FOR INSERT
  WITH CHECK (public.is_super_admin());

-- Le propriétaire peut s'inscrire lui-même (onboarding /register)
CREATE POLICY "owner_insert_own_entreprise"
  ON public.entreprises FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- ── UPDATE ──
-- SUPER_ADMIN : peut tout mettre à jour (statut, plan, max_agents…)
CREATE POLICY "sa_update_all_entreprises"
  ON public.entreprises FOR UPDATE
  USING  (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Propriétaire : peut mettre à jour uniquement ses infos de contact
-- (il NE PEUT PAS changer plan / statut / max_agents — colonnes réservées SUPER_ADMIN)
CREATE POLICY "owner_update_own_entreprise"
  ON public.entreprises FOR UPDATE
  USING  (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    -- Empêche l'escalade : le propriétaire ne peut pas s'auto-activer ni changer de plan
    -- Ces checks sont best-effort côté SQL ; les colonnes critiques
    -- sont aussi protégées par des triggers ci-dessous.
  );

-- ── DELETE ──
-- Uniquement SUPER_ADMIN
CREATE POLICY "sa_delete_entreprise"
  ON public.entreprises FOR DELETE
  USING (public.is_super_admin());

-- ────────────────────────────────────────────────────────────
--  ÉTAPE 3 — Trigger : le propriétaire ne peut pas changer
--            plan / statut / max_agents lui-même
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_entreprise_critical_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si l'appelant n'est PAS SUPER_ADMIN, bloquer la modification
  -- des champs sensibles
  IF NOT public.is_super_admin() THEN
    IF NEW.plan      IS DISTINCT FROM OLD.plan      THEN
      RAISE EXCEPTION 'Accès refusé : seul SUPER_ADMIN peut changer le plan.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.statut    IS DISTINCT FROM OLD.statut    THEN
      RAISE EXCEPTION 'Accès refusé : seul SUPER_ADMIN peut changer le statut.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.max_agents IS DISTINCT FROM OLD.max_agents THEN
      RAISE EXCEPTION 'Accès refusé : seul SUPER_ADMIN peut changer max_agents.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_entreprise_critical ON public.entreprises;
CREATE TRIGGER trg_guard_entreprise_critical
  BEFORE UPDATE ON public.entreprises
  FOR EACH ROW EXECUTE FUNCTION public.guard_entreprise_critical_fields();

-- ────────────────────────────────────────────────────────────
--  ÉTAPE 4 — RLS sur la table profils_admin
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profils_admin ENABLE ROW LEVEL SECURITY;

-- Nettoyer les anciennes politiques
DROP POLICY IF EXISTS "self_select_profil"    ON public.profils_admin;
DROP POLICY IF EXISTS "sa_select_all_profils" ON public.profils_admin;
DROP POLICY IF EXISTS "sa_insert_profil"      ON public.profils_admin;
DROP POLICY IF EXISTS "sa_update_profil"      ON public.profils_admin;
DROP POLICY IF EXISTS "sa_delete_profil"      ON public.profils_admin;

-- Chaque utilisateur peut lire son propre profil
-- (nécessaire pour App.jsx resolveRole — supabase.from('profils_admin').select('role').eq('id', userId))
CREATE POLICY "self_select_profil"
  ON public.profils_admin FOR SELECT
  USING (id = auth.uid());

-- SUPER_ADMIN peut voir tous les profils (pour le panel SuperAdmin)
CREATE POLICY "sa_select_all_profils"
  ON public.profils_admin FOR SELECT
  USING (public.is_super_admin());

-- SUPER_ADMIN peut créer / modifier / supprimer des profils
CREATE POLICY "sa_insert_profil"
  ON public.profils_admin FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "sa_update_profil"
  ON public.profils_admin FOR UPDATE
  USING  (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "sa_delete_profil"
  ON public.profils_admin FOR DELETE
  USING (public.is_super_admin());

-- ────────────────────────────────────────────────────────────
--  ÉTAPE 5 — Vérification finale
-- ────────────────────────────────────────────────────────────
-- Exécuter ces requêtes pour confirmer que tout est en place :

-- 1. Lister toutes les politiques créées
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('entreprises', 'profils_admin')
ORDER BY tablename, policyname;

-- 2. Vérifier que la fonction existe
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('is_super_admin', 'guard_entreprise_critical_fields', 'set_updated_at');

-- ────────────────────────────────────────────────────────────
--  RÉSUMÉ DES PROTECTIONS
-- ────────────────────────────────────────────────────────────
-- ┌─────────────────────┬──────────┬───────────────────────────────────────┐
-- │ Table               │ Opération│ Qui peut faire quoi                   │
-- ├─────────────────────┼──────────┼───────────────────────────────────────┤
-- │ entreprises         │ SELECT   │ SUPER_ADMIN (tout) + owner (la sienne)│
-- │ entreprises         │ INSERT   │ SUPER_ADMIN + owner (self-register)   │
-- │ entreprises         │ UPDATE   │ SUPER_ADMIN (tout) + owner (contact)  │
-- │ entreprises         │ UPDATE   │ plan/statut/max_agents → SUPER_ADMIN  │
-- │ entreprises         │ DELETE   │ SUPER_ADMIN uniquement                │
-- ├─────────────────────┼──────────┼───────────────────────────────────────┤
-- │ profils_admin       │ SELECT   │ SUPER_ADMIN (tout) + self (le sien)   │
-- │ profils_admin       │ INSERT   │ SUPER_ADMIN uniquement                │
-- │ profils_admin       │ UPDATE   │ SUPER_ADMIN uniquement                │
-- │ profils_admin       │ DELETE   │ SUPER_ADMIN uniquement                │
-- └─────────────────────┴──────────┴───────────────────────────────────────┘
