-- =============================================================================
--  DZ SECURITY FUSION — Migration : Module Paie & Déclarations CNAS
--  Combine 005_paie.sql + 006_declarations.sql (source : Structura)
--  IDEMPOTENTE — peut être exécutée plusieurs fois sans erreur.
--  À coller dans : Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 1 — Extensions parametres_entreprise
--  Colonnes nécessaires au calcul paie légal algérien
-- ══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parametres_entreprise' AND column_name='snmg') THEN
    ALTER TABLE public.parametres_entreprise ADD COLUMN snmg NUMERIC(10,2) DEFAULT 20000;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parametres_entreprise' AND column_name='prime_transport') THEN
    ALTER TABLE public.parametres_entreprise ADD COLUMN prime_transport NUMERIC(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parametres_entreprise' AND column_name='prime_zone') THEN
    ALTER TABLE public.parametres_entreprise ADD COLUMN prime_zone NUMERIC(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parametres_entreprise' AND column_name='prime_salissure') THEN
    ALTER TABLE public.parametres_entreprise ADD COLUMN prime_salissure NUMERIC(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parametres_entreprise' AND column_name='taux_cacobatph_sal') THEN
    ALTER TABLE public.parametres_entreprise ADD COLUMN taux_cacobatph_sal NUMERIC(5,4) DEFAULT 0.005;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parametres_entreprise' AND column_name='taux_cacobatph_pat') THEN
    ALTER TABLE public.parametres_entreprise ADD COLUMN taux_cacobatph_pat NUMERIC(5,4) DEFAULT 0.150;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parametres_entreprise' AND column_name='nb_jours_mois') THEN
    ALTER TABLE public.parametres_entreprise ADD COLUMN nb_jours_mois SMALLINT DEFAULT 26;
  END IF;
END $$;

-- Initialisation des valeurs par défaut sur la ligne singleton
UPDATE public.parametres_entreprise SET
  snmg          = COALESCE(NULLIF(snmg, 0), 20000),
  nb_jours_mois = COALESCE(nb_jours_mois, 26)
WHERE id = 1;


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 2 — Table bulletins_paie
--  Un bulletin par agent par mois — immuable après validation (loi 90-11)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bulletins_paie (
  id                   BIGSERIAL     PRIMARY KEY,
  company_id           UUID,
  agent_id             BIGINT        NOT NULL
                       REFERENCES public.agents(id) ON DELETE RESTRICT,
  periode              DATE          NOT NULL,

  salaire_base         NUMERIC(12,2) NOT NULL DEFAULT 0,
  ind_panier           NUMERIC(12,2) NOT NULL DEFAULT 0,
  ind_transport        NUMERIC(12,2) NOT NULL DEFAULT 0,
  ind_zone             NUMERIC(12,2) NOT NULL DEFAULT 0,
  ind_salissure        NUMERIC(12,2) NOT NULL DEFAULT 0,
  ind_nuit             NUMERIC(12,2) NOT NULL DEFAULT 0,
  ind_dimanche         NUMERIC(12,2) NOT NULL DEFAULT 0,
  salaire_brut         NUMERIC(12,2) NOT NULL DEFAULT 0,

  assiette_cnas        NUMERIC(12,2) NOT NULL DEFAULT 0,
  cnas_sal             NUMERIC(12,2) NOT NULL DEFAULT 0,
  cnas_pat             NUMERIC(12,2) NOT NULL DEFAULT 0,

  cacobatph_sal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  cacobatph_pat        NUMERIC(12,2) NOT NULL DEFAULT 0,

  abattement_irg       NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_imposable        NUMERIC(12,2) NOT NULL DEFAULT 0,
  irg                  NUMERIC(12,2) NOT NULL DEFAULT 0,

  net_a_payer          NUMERIC(12,2) NOT NULL DEFAULT 0,

  conges_acquis        NUMERIC(4,2)  NOT NULL DEFAULT 2.5,
  conges_cumul         NUMERIC(6,2)  NOT NULL DEFAULT 0,

  nb_jours_travailles  SMALLINT      NOT NULL DEFAULT 26,
  statut               TEXT          NOT NULL DEFAULT 'brouillon'
                       CHECK (statut IN ('brouillon', 'valide', 'paye')),
  hash_bulletin        TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bulletin_agent_periode UNIQUE (agent_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_bulletins_agent    ON public.bulletins_paie(agent_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_periode  ON public.bulletins_paie(periode);
CREATE INDEX IF NOT EXISTS idx_bulletins_statut   ON public.bulletins_paie(statut);
CREATE INDEX IF NOT EXISTS idx_bulletins_company  ON public.bulletins_paie(company_id);

COMMENT ON TABLE  public.bulletins_paie          IS 'Bulletins de paie mensuels — loi 90-11 — barème IRG 2024';
COMMENT ON COLUMN public.bulletins_paie.cnas_sal IS '9% salarié — SACRÉ — jamais modifier ce taux';
COMMENT ON COLUMN public.bulletins_paie.irg      IS 'Barème progressif 5 tranches — arrondi supérieur 10 DA';


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 3 — Table conges
--  Suivi des congés payés et absences (loi 90-11, art. 26 à 45)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.conges (
  id          BIGSERIAL    PRIMARY KEY,
  company_id  UUID,
  agent_id    BIGINT       NOT NULL
              REFERENCES public.agents(id) ON DELETE CASCADE,
  type_conge  TEXT         NOT NULL DEFAULT 'ANNUEL'
              CHECK (type_conge IN (
                'ANNUEL', 'MALADIE', 'MATERNITE', 'EXCEPTIONNEL', 'SANS_SOLDE'
              )),
  date_debut  DATE         NOT NULL,
  date_fin    DATE         NOT NULL,
  nb_jours    SMALLINT     NOT NULL CHECK (nb_jours > 0),
  statut      TEXT         NOT NULL DEFAULT 'EN_ATTENTE'
              CHECK (statut IN ('EN_ATTENTE', 'VALIDE', 'REFUSE', 'PRIS')),
  motif       TEXT,
  approuve_par TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_conge_dates CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_conges_agent   ON public.conges(agent_id);
CREATE INDEX IF NOT EXISTS idx_conges_statut  ON public.conges(statut);
CREATE INDEX IF NOT EXISTS idx_conges_company ON public.conges(company_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 4 — RLS (permissive — isolation par company_id gérée au niveau app)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bulletins_paie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conges         ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS bulletins_paie_auth ON public.bulletins_paie;
  CREATE POLICY bulletins_paie_auth ON public.bulletins_paie
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS conges_auth ON public.conges;
  CREATE POLICY conges_auth ON public.conges
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 5 — FONCTION calculer_bulletin()
--  Barème IRG 2024 · CNAS 9% · CACOBATPH BTP · Congés 2,5 j/mois
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculer_bulletin(
  p_agent_id    BIGINT,
  p_periode     DATE,
  p_company_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent          RECORD;
  v_params         RECORD;
  v_salaire_base   NUMERIC(12,2) := 0;
  v_snmg           NUMERIC(12,2) := 20000;
  v_nb_jours       SMALLINT      := 26;
  v_secteur        TEXT          := 'services';
  v_ind_panier     NUMERIC(12,2) := 0;
  v_ind_transport  NUMERIC(12,2) := 0;
  v_ind_zone       NUMERIC(12,2) := 0;
  v_ind_salissure  NUMERIC(12,2) := 0;
  v_ind_nuit       NUMERIC(12,2) := 0;
  v_ind_dimanche   NUMERIC(12,2) := 0;
  v_salaire_brut   NUMERIC(12,2) := 0;
  v_assiette_cnas  NUMERIC(12,2) := 0;
  v_cnas_sal       NUMERIC(12,2) := 0;
  v_cnas_pat       NUMERIC(12,2) := 0;
  v_cacobatph_sal  NUMERIC(12,2) := 0;
  v_cacobatph_pat  NUMERIC(12,2) := 0;
  v_abattement     NUMERIC(12,2) := 0;
  v_net_imposable  NUMERIC(12,2) := 0;
  v_irg_raw        NUMERIC(14,4) := 0;
  v_irg            NUMERIC(12,2) := 0;
  v_net_a_payer    NUMERIC(12,2) := 0;
  v_conges_pris    NUMERIC(6,2)  := 0;
  v_conges_cumul   NUMERIC(6,2)  := 0;
  v_reste          NUMERIC(12,2) := 0;
  v_bulletin_id    BIGINT;
BEGIN

  SELECT * INTO v_agent FROM public.agents WHERE id = p_agent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent introuvable (id = %)', p_agent_id;
  END IF;

  SELECT * INTO v_params FROM public.parametres_entreprise WHERE id = 1;

  v_snmg     := COALESCE(v_params.snmg,             20000);
  v_secteur  := COALESCE(v_params.secteur_activite, 'services');
  v_nb_jours := COALESCE(v_params.nb_jours_mois,    26);

  v_salaire_base := GREATEST(COALESCE(v_agent.salaire_brut, v_snmg), v_snmg);

  v_ind_panier    := v_nb_jours * COALESCE(v_params.prime_panier, 0);
  v_ind_transport := COALESCE(v_params.prime_transport, 0);
  v_ind_zone      := COALESCE(v_params.prime_zone, 0);
  v_ind_salissure := COALESCE(v_params.prime_salissure, COALESCE(v_params.prime_risque, 0));
  v_ind_nuit      := COALESCE(v_params.prime_nuit, 0);
  v_ind_dimanche  := COALESCE(v_params.prime_dimanche, 0);

  v_salaire_brut := v_salaire_base + v_ind_panier + v_ind_transport
                  + v_ind_zone + v_ind_salissure + v_ind_nuit + v_ind_dimanche;

  v_assiette_cnas := v_salaire_brut - v_ind_transport;

  -- CNAS 9% — SACRÉ (art. 16, loi 83-14)
  v_cnas_sal := ROUND(v_assiette_cnas * 0.09, 2);
  v_cnas_pat := ROUND(v_assiette_cnas * 0.25, 2);

  -- CACOBATPH (BTP uniquement — décret 76-38)
  IF v_secteur = 'btp' THEN
    v_cacobatph_sal := ROUND(v_assiette_cnas * COALESCE(v_params.taux_cacobatph_sal, 0.005), 2);
    v_cacobatph_pat := ROUND(v_assiette_cnas * COALESCE(v_params.taux_cacobatph_pat, 0.150), 2);
  END IF;

  -- ── BARÈME IRG 2024 — SACRÉ — Art. 104bis CIDTA ──────────────────────────
  -- Abattement 40% · min 1 000 DA · max 1 500 DA/mois
  -- Tranches : 0-20k → 0% | 20k-40k → 23% | 40k-80k → 27% | 80k-160k → 30% | >160k → 35%
  v_abattement    := GREATEST(1000, LEAST(1500, v_assiette_cnas * 0.40));
  v_net_imposable := GREATEST(0, v_assiette_cnas - v_cnas_sal - v_abattement);

  v_reste   := v_net_imposable;
  v_irg_raw := 0;

  IF v_reste > 0 THEN v_reste := v_reste - LEAST(v_reste, 20000); END IF;
  IF v_reste > 0 THEN v_irg_raw := v_irg_raw + LEAST(v_reste, 20000) * 0.23; v_reste := v_reste - LEAST(v_reste, 20000); END IF;
  IF v_reste > 0 THEN v_irg_raw := v_irg_raw + LEAST(v_reste, 40000) * 0.27; v_reste := v_reste - LEAST(v_reste, 40000); END IF;
  IF v_reste > 0 THEN v_irg_raw := v_irg_raw + LEAST(v_reste, 80000) * 0.30; v_reste := v_reste - LEAST(v_reste, 80000); END IF;
  IF v_reste > 0 THEN v_irg_raw := v_irg_raw + v_reste * 0.35; END IF;

  v_irg := CEIL(v_irg_raw / 10) * 10;

  v_net_a_payer := v_salaire_brut - v_cnas_sal - v_irg - v_cacobatph_sal;

  -- Congés cumulés
  SELECT COALESCE(SUM(nb_jours), 0) INTO v_conges_pris
  FROM public.conges WHERE agent_id = p_agent_id AND statut = 'PRIS';

  SELECT COALESCE(SUM(conges_acquis), 0) INTO v_conges_cumul
  FROM public.bulletins_paie
  WHERE agent_id = p_agent_id AND statut IN ('valide', 'paye') AND periode < p_periode;

  v_conges_cumul := GREATEST(0, v_conges_cumul - v_conges_pris);

  -- Supprimer l'ancien brouillon si présent (idempotence)
  DELETE FROM public.bulletins_paie
  WHERE agent_id = p_agent_id AND periode = p_periode AND statut = 'brouillon';

  INSERT INTO public.bulletins_paie (
    company_id, agent_id, periode,
    salaire_base, ind_panier, ind_transport, ind_zone,
    ind_salissure, ind_nuit, ind_dimanche,
    salaire_brut,
    assiette_cnas, cnas_sal, cnas_pat,
    cacobatph_sal, cacobatph_pat,
    abattement_irg, net_imposable, irg,
    net_a_payer,
    conges_acquis, conges_cumul,
    nb_jours_travailles, statut
  ) VALUES (
    p_company_id, p_agent_id, p_periode,
    v_salaire_base, v_ind_panier, v_ind_transport, v_ind_zone,
    v_ind_salissure, v_ind_nuit, v_ind_dimanche,
    v_salaire_brut,
    v_assiette_cnas, v_cnas_sal, v_cnas_pat,
    v_cacobatph_sal, v_cacobatph_pat,
    v_abattement, v_net_imposable, v_irg,
    v_net_a_payer,
    2.5, v_conges_cumul,
    v_nb_jours, 'brouillon'
  )
  RETURNING id INTO v_bulletin_id;

  RETURN jsonb_build_object(
    'bulletin_id',          v_bulletin_id,
    'agent_id',             p_agent_id,
    'matricule',            v_agent.matricule,
    'nom_complet',          TRIM(v_agent.nom || ' ' || COALESCE(v_agent.prenom, '')),
    'qualification',        v_agent.qualification,
    'type_contrat',         v_agent.type_contrat,
    'site',                 v_agent.site_affecte,
    'periode',              to_char(p_periode, 'MM/YYYY'),
    'periode_iso',          to_char(p_periode, 'YYYY-MM-DD'),
    'salaire_base',         v_salaire_base,
    'ind_panier',           v_ind_panier,
    'ind_transport',        v_ind_transport,
    'ind_zone',             v_ind_zone,
    'ind_salissure',        v_ind_salissure,
    'ind_nuit',             v_ind_nuit,
    'ind_dimanche',         v_ind_dimanche,
    'salaire_brut',         v_salaire_brut,
    'nb_jours',             v_nb_jours,
    'assiette_cnas',        v_assiette_cnas,
    'cnas_sal',             v_cnas_sal,
    'cnas_pat',             v_cnas_pat,
    'cacobatph_sal',        v_cacobatph_sal,
    'cacobatph_pat',        v_cacobatph_pat,
    'cacobatph_applicable', (v_secteur = 'btp'),
    'abattement_irg',       v_abattement,
    'net_imposable',        v_net_imposable,
    'irg',                  v_irg,
    'net_a_payer',          v_net_a_payer,
    'conges_acquis',        2.5,
    'conges_cumul',         v_conges_cumul + 2.5,
    'secteur',              v_secteur,
    'snmg',                 v_snmg,
    'statut',               'brouillon'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'calculer_bulletin: % — agent_id=% · periode=%',
      SQLERRM, p_agent_id, p_periode;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculer_bulletin TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 6 — FONCTION valider_bulletin()
--  Rend un bulletin définitif (immuable — loi 90-11)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.valider_bulletin(p_bulletin_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows INTEGER;
BEGIN
  UPDATE public.bulletins_paie
  SET statut = 'valide', updated_at = NOW()
  WHERE id = p_bulletin_id AND statut = 'brouillon';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Bulletin introuvable ou déjà validé (id = %)', p_bulletin_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'bulletin_id', p_bulletin_id, 'statut', 'valide');
END;
$$;

GRANT EXECUTE ON FUNCTION public.valider_bulletin TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 7 — FONCTION tableau_bord_paie()
--  Agrégats mensuels pour le dashboard
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.tableau_bord_paie(p_periode DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'nb_bulletins',      COUNT(*),
    'nb_valides',        COUNT(*) FILTER (WHERE statut IN ('valide', 'paye')),
    'nb_brouillons',     COUNT(*) FILTER (WHERE statut = 'brouillon'),
    'nb_payes',          COUNT(*) FILTER (WHERE statut = 'paye'),
    'masse_salariale',   COALESCE(ROUND(SUM(salaire_brut),  2), 0),
    'total_cnas_sal',    COALESCE(ROUND(SUM(cnas_sal),      2), 0),
    'total_cnas_pat',    COALESCE(ROUND(SUM(cnas_pat),      2), 0),
    'total_irg',         COALESCE(ROUND(SUM(irg),           2), 0),
    'total_net_a_payer', COALESCE(ROUND(SUM(net_a_payer),   2), 0),
    'salaire_moyen',     COALESCE(ROUND(AVG(salaire_brut),  2), 0),
    'net_moyen',         COALESCE(ROUND(AVG(net_a_payer),   2), 0)
  )
  FROM public.bulletins_paie
  WHERE periode = p_periode;
$$;

GRANT EXECUTE ON FUNCTION public.tableau_bord_paie TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 8 — Table declarations_cnas
--  G50 mensuel + DAS annuelle — circulaire CNAS 2024
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.declarations_cnas (
  id                   BIGSERIAL PRIMARY KEY,
  type_declaration     TEXT        NOT NULL CHECK (type_declaration IN ('G50_MENSUEL','DAS_ANNUEL')),
  periode              DATE        NOT NULL,
  annee                SMALLINT    GENERATED ALWAYS AS (EXTRACT(YEAR FROM periode)::SMALLINT) STORED,
  statut               TEXT        NOT NULL DEFAULT 'brouillon'
                                   CHECK (statut IN ('brouillon','soumise','validee')),
  nb_employes          INT         NOT NULL DEFAULT 0,
  masse_salariale      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cnas_sal       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cnas_pat       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cotisations    NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_irg            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_a_verser       NUMERIC(15,2) NOT NULL DEFAULT 0,
  details              JSONB,
  date_soumission      TIMESTAMPTZ,
  reference_paiement   TEXT,
  notes                TEXT,
  company_id           UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (type_declaration, periode, company_id)
);

CREATE INDEX IF NOT EXISTS idx_declarations_periode ON public.declarations_cnas(periode DESC);
CREATE INDEX IF NOT EXISTS idx_declarations_type    ON public.declarations_cnas(type_declaration);
CREATE INDEX IF NOT EXISTS idx_declarations_company ON public.declarations_cnas(company_id);
CREATE INDEX IF NOT EXISTS idx_declarations_statut  ON public.declarations_cnas(statut);

ALTER TABLE public.declarations_cnas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS declarations_company_isolation ON public.declarations_cnas;
CREATE POLICY declarations_company_isolation ON public.declarations_cnas
  FOR ALL TO authenticated
  USING (
    company_id IS NULL
    OR company_id IN (
      SELECT company_id FROM public.profils_admin WHERE id = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 9 — FONCTION generer_g50()
--  Déclaration mensuelle CNAS — agrège bulletins validés/payés
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generer_g50(
  p_periode    DATE,
  p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periode     DATE := DATE_TRUNC('month', p_periode)::DATE;
  v_nb_employes INT;
  v_masse_sal   NUMERIC(15,2);
  v_cnas_sal    NUMERIC(15,2);
  v_cnas_pat    NUMERIC(15,2);
  v_irg         NUMERIC(15,2);
  v_details     JSONB;
  v_decl_id     BIGINT;
BEGIN
  SELECT
    COUNT(*)::INT,
    COALESCE(SUM(bp.salaire_brut), 0),
    COALESCE(SUM(bp.cnas_sal),     0),
    COALESCE(SUM(bp.cnas_pat),     0),
    COALESCE(SUM(bp.irg),          0)
  INTO v_nb_employes, v_masse_sal, v_cnas_sal, v_cnas_pat, v_irg
  FROM public.bulletins_paie bp
  WHERE bp.periode = v_periode
    AND bp.statut IN ('valide','paye')
    AND (p_company_id IS NULL OR bp.company_id = p_company_id);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'agent_id',      bp.agent_id,
      'matricule',     a.matricule,
      'nom',           a.nom,
      'prenom',        a.prenom,
      'qualification', a.qualification,
      'site',          a.site_affecte,
      'salaire_brut',  bp.salaire_brut,
      'assiette_cnas', bp.assiette_cnas,
      'cnas_sal',      bp.cnas_sal,
      'cnas_pat',      bp.cnas_pat,
      'irg',           bp.irg,
      'net_a_payer',   bp.net_a_payer,
      'ind_transport', bp.ind_transport
    ) ORDER BY a.nom, a.prenom
  ), '[]'::jsonb)
  INTO v_details
  FROM public.bulletins_paie bp
  JOIN public.agents a ON a.id = bp.agent_id
  WHERE bp.periode = v_periode
    AND bp.statut IN ('valide','paye')
    AND (p_company_id IS NULL OR bp.company_id = p_company_id);

  INSERT INTO public.declarations_cnas
    (type_declaration, periode, nb_employes, masse_salariale,
     total_cnas_sal, total_cnas_pat, total_cotisations,
     total_irg, total_a_verser, details, company_id)
  VALUES
    ('G50_MENSUEL', v_periode, v_nb_employes, v_masse_sal,
     v_cnas_sal, v_cnas_pat, v_cnas_sal + v_cnas_pat,
     v_irg, v_cnas_sal + v_cnas_pat + v_irg, v_details, p_company_id)
  ON CONFLICT (type_declaration, periode, company_id) DO UPDATE
    SET nb_employes       = EXCLUDED.nb_employes,
        masse_salariale   = EXCLUDED.masse_salariale,
        total_cnas_sal    = EXCLUDED.total_cnas_sal,
        total_cnas_pat    = EXCLUDED.total_cnas_pat,
        total_cotisations = EXCLUDED.total_cotisations,
        total_irg         = EXCLUDED.total_irg,
        total_a_verser    = EXCLUDED.total_a_verser,
        details           = EXCLUDED.details,
        updated_at        = NOW()
  WHERE public.declarations_cnas.statut = 'brouillon'
  RETURNING id INTO v_decl_id;

  RETURN jsonb_build_object(
    'declaration_id',         v_decl_id,
    'type',                   'G50_MENSUEL',
    'periode',                TO_CHAR(v_periode, 'MM/YYYY'),
    'periode_iso',            v_periode,
    'nb_employes',            v_nb_employes,
    'masse_salariale',        v_masse_sal,
    'total_cnas_sal',         v_cnas_sal,
    'total_cnas_pat',         v_cnas_pat,
    'total_cotisations_cnas', v_cnas_sal + v_cnas_pat,
    'total_irg',              v_irg,
    'total_a_verser',         v_cnas_sal + v_cnas_pat + v_irg,
    'details',                v_details
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generer_g50 TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 10 — FONCTION generer_das_annuelle()
--  Déclaration Annuelle des Salaires — art. 26 loi 83-14
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generer_das_annuelle(
  p_annee      INT,
  p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debut       DATE := MAKE_DATE(p_annee, 1, 1);
  v_fin         DATE := MAKE_DATE(p_annee, 12, 31);
  v_nb_employes INT;
  v_masse_sal   NUMERIC(15,2);
  v_cnas_sal    NUMERIC(15,2);
  v_cnas_pat    NUMERIC(15,2);
  v_irg         NUMERIC(15,2);
  v_details     JSONB;
  v_decl_id     BIGINT;
BEGIN
  SELECT
    COUNT(DISTINCT bp.agent_id)::INT,
    COALESCE(SUM(bp.salaire_brut), 0),
    COALESCE(SUM(bp.cnas_sal),     0),
    COALESCE(SUM(bp.cnas_pat),     0),
    COALESCE(SUM(bp.irg),          0)
  INTO v_nb_employes, v_masse_sal, v_cnas_sal, v_cnas_pat, v_irg
  FROM public.bulletins_paie bp
  WHERE bp.periode BETWEEN v_debut AND v_fin
    AND bp.statut IN ('valide','paye')
    AND (p_company_id IS NULL OR bp.company_id = p_company_id);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'agent_id',        sub.agent_id,
      'matricule',       sub.matricule,
      'nom',             sub.nom,
      'prenom',          sub.prenom,
      'qualification',   sub.qualification,
      'nb_mois',         sub.nb_mois,
      'salaire_brut_an', sub.salaire_brut_an,
      'cnas_sal_an',     sub.cnas_sal_an,
      'cnas_pat_an',     sub.cnas_pat_an,
      'irg_an',          sub.irg_an,
      'net_an',          sub.net_an
    ) ORDER BY sub.nom, sub.prenom
  ), '[]'::jsonb)
  INTO v_details
  FROM (
    SELECT
      bp.agent_id,
      a.matricule,
      a.nom,
      a.prenom,
      a.qualification,
      COUNT(*)::INT                 AS nb_mois,
      SUM(bp.salaire_brut)::NUMERIC AS salaire_brut_an,
      SUM(bp.cnas_sal)::NUMERIC     AS cnas_sal_an,
      SUM(bp.cnas_pat)::NUMERIC     AS cnas_pat_an,
      SUM(bp.irg)::NUMERIC          AS irg_an,
      SUM(bp.net_a_payer)::NUMERIC  AS net_an
    FROM public.bulletins_paie bp
    JOIN public.agents a ON a.id = bp.agent_id
    WHERE bp.periode BETWEEN v_debut AND v_fin
      AND bp.statut IN ('valide','paye')
      AND (p_company_id IS NULL OR bp.company_id = p_company_id)
    GROUP BY bp.agent_id, a.matricule, a.nom, a.prenom, a.qualification
  ) sub;

  INSERT INTO public.declarations_cnas
    (type_declaration, periode, nb_employes, masse_salariale,
     total_cnas_sal, total_cnas_pat, total_cotisations,
     total_irg, total_a_verser, details, company_id)
  VALUES
    ('DAS_ANNUEL', v_debut, v_nb_employes, v_masse_sal,
     v_cnas_sal, v_cnas_pat, v_cnas_sal + v_cnas_pat,
     v_irg, v_cnas_sal + v_cnas_pat + v_irg, v_details, p_company_id)
  ON CONFLICT (type_declaration, periode, company_id) DO UPDATE
    SET nb_employes       = EXCLUDED.nb_employes,
        masse_salariale   = EXCLUDED.masse_salariale,
        total_cnas_sal    = EXCLUDED.total_cnas_sal,
        total_cnas_pat    = EXCLUDED.total_cnas_pat,
        total_cotisations = EXCLUDED.total_cotisations,
        total_irg         = EXCLUDED.total_irg,
        total_a_verser    = EXCLUDED.total_a_verser,
        details           = EXCLUDED.details,
        updated_at        = NOW()
  WHERE public.declarations_cnas.statut = 'brouillon'
  RETURNING id INTO v_decl_id;

  RETURN jsonb_build_object(
    'declaration_id',         v_decl_id,
    'type',                   'DAS_ANNUEL',
    'annee',                  p_annee,
    'nb_employes',            v_nb_employes,
    'masse_salariale_an',     v_masse_sal,
    'total_cnas_sal_an',      v_cnas_sal,
    'total_cnas_pat_an',      v_cnas_pat,
    'total_cotisations_cnas', v_cnas_sal + v_cnas_pat,
    'total_irg_an',           v_irg,
    'total_a_verser_an',      v_cnas_sal + v_cnas_pat + v_irg,
    'details',                v_details
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generer_das_annuelle TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 11 — FONCTION soumettre_declaration()
--  Marque une déclaration soumise — transition irréversible
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.soumettre_declaration(
  p_declaration_id     BIGINT,
  p_reference_paiement TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_statut TEXT;
BEGIN
  SELECT statut INTO v_statut FROM public.declarations_cnas WHERE id = p_declaration_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Déclaration % introuvable', p_declaration_id;
  END IF;

  IF v_statut <> 'brouillon' THEN
    RAISE EXCEPTION 'Déclaration déjà soumise ou validée — immuable';
  END IF;

  UPDATE public.declarations_cnas
  SET statut             = 'soumise',
      date_soumission    = NOW(),
      reference_paiement = p_reference_paiement,
      updated_at         = NOW()
  WHERE id = p_declaration_id;

  RETURN jsonb_build_object('success', true, 'declaration_id', p_declaration_id, 'statut', 'soumise');
END;
$$;

GRANT EXECUTE ON FUNCTION public.soumettre_declaration TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
--  PARTIE 12 — VUE historique_declarations
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.historique_declarations AS
SELECT
  id,
  type_declaration,
  TO_CHAR(periode, 'MM/YYYY') AS periode_label,
  periode,
  annee,
  statut,
  nb_employes,
  masse_salariale,
  total_cnas_sal,
  total_cnas_pat,
  total_cotisations,
  total_irg,
  total_a_verser,
  date_soumission,
  reference_paiement,
  company_id,
  created_at
FROM public.declarations_cnas
ORDER BY periode DESC, type_declaration;

GRANT SELECT ON public.historique_declarations TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
--  VÉRIFICATION FINALE
-- ══════════════════════════════════════════════════════════════════════════════

SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculer_bulletin', 'valider_bulletin', 'tableau_bord_paie',
    'generer_g50', 'generer_das_annuelle', 'soumettre_declaration'
  )
ORDER BY routine_name;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('bulletins_paie', 'conges', 'declarations_cnas')
ORDER BY table_name;
