import { create } from 'zustand';
import { supabase } from '../supabaseClient';

// Retarde l'exécution de fn de ms millisecondes après le dernier appel
// Nécessaire pour éviter les cascades de re-fetches lors des events Realtime simultanés
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const useDataStore = create((set, get) => ({
  // --- State ---
  agentsData: [],
  incidentsData: [],
  contratsData: [],
  armesData: [],
  historiquePointages: [],
  passationsData: [],
  sitesData: [],
  alertesData: [],
  roleAdmin: null,
  _cachedUserId: null,
  _realtimeChannel: null, // référence au channel actif pour cleanup

  // --- Fetchers individuels (appelés par Realtime et après CRUD ciblés) ---
  fetchAgents: async () => {
    const { data } = await supabase.from('agents').select('*').order('id', { ascending: false });
    if (data) set({ agentsData: data });
  },

  fetchIncidents: async () => {
    const { data } = await supabase.from('incidents').select('*').eq('resolu', false).order('id', { ascending: false });
    if (data) set({ incidentsData: data });
  },

  fetchContrats: async () => {
    const { data } = await supabase.from('contrats').select('*, clients(nom_entreprise)');
    if (data) set({ contratsData: data });
  },

  fetchArmes: async () => {
    const { data } = await supabase.from('armes').select('*, agents(nom), contrats(nom_site)');
    if (data) set({ armesData: data });
  },

  // Fenêtre glissante 90 jours + LIMIT 2000 + jointure agents en une seule requête
  // Empêche le payload de croître indéfiniment (100 agents × 365j = 36 500 lignes/an)
  fetchPointages: async () => {
    const cutoff = new Date(Date.now() - 90 * 86400000)
      .toISOString()
      .split('T')[0];

    const { data } = await supabase
      .from('pointages_journaliers')
      .select(`
        id, agent_id,
        agents(nom, matricule),
        site_affecte, date_pointage,
        heure_arrivee, heure_depart,
        statut_validation
      `)
      .gte('date_pointage', cutoff)
      .order('site_affecte', { ascending: true })
      .order('date_pointage', { ascending: false })
      .order('heure_arrivee', { ascending: true })
      .limit(2000);

    if (data) set({ historiquePointages: data });
  },

  fetchPassations: async () => {
    const { data, error } = await supabase
      .from('passations')
      .select('*')
      .order('date_heure', { ascending: false })
      .limit(500); // limite aux 500 dernières passations
    if (error) {
      console.error('[useDataStore] fetchPassations', error);
      return;
    }
    if (data) set({ passationsData: data });
  },

  fetchSites: async () => {
    const { data } = await supabase.from('sites').select('*').order('type').order('nom');
    if (data) set({ sitesData: data });
  },

  // Alertes légales visibles aujourd'hui — silent-fail si table non encore créée (migration SQL optionnelle)
  fetchAlertes: async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('alertes_legales')
        .select('*, agents(nom, matricule)')
        .in('statut', ['PLANIFIEE', 'ENVOYEE'])
        .lte('date_notification', today)
        .order('date_echeance', { ascending: true })
        .limit(200);
      if (!error && data) set({ alertesData: data });
    } catch {
      // table alertes_legales non encore créée — silencieux
    }
  },

  // --- Fetch initial complet (chargement au login) ---
  fetchToutesLesDonnees: async (userId) => {
    const id = userId || get()._cachedUserId;
    if (!id) return;
    if (userId) set({ _cachedUserId: userId });
    try {
      const { data: profil } = await supabase
        .from('profils_admin')
        .select('role')
        .eq('id', id)
        .single();
      if (profil?.role) set({ roleAdmin: profil.role });
    } catch { /* profil admin introuvable — utilisateur terrain */ }
    const { fetchAgents, fetchIncidents, fetchContrats, fetchArmes, fetchPointages, fetchPassations, fetchSites, fetchAlertes } = get();
    await Promise.all([fetchAgents(), fetchIncidents(), fetchContrats(), fetchArmes(), fetchPointages(), fetchPassations(), fetchSites(), fetchAlertes()]);
  },

  // --- Actions métier ---
  resoudreIncident: async (id) => {
    if (!id) return;
    await supabase.from('incidents').update({ resolu: true }).eq('id', id);
    // await explicite — évite la course avec le rendu suivant
    await get().fetchIncidents();
  },

  marquerAlerteLue: async (id) => {
    await supabase.from('alertes_legales').update({ statut: 'LUE', updated_at: new Date().toISOString() }).eq('id', id);
    await get().fetchAlertes();
  },

  ignorerAlerte: async (id) => {
    await supabase.from('alertes_legales').update({ statut: 'IGNOREE', updated_at: new Date().toISOString() }).eq('id', id);
    await get().fetchAlertes();
  },

  // --- Initialisation Realtime ---
  // Guard anti-fuite : ferme le channel précédent avant d'en créer un nouveau
  // Debounce 500ms : évite les cascades lors de changements simultanés sur plusieurs tables
  initRealtime: () => {
    const existing = get()._realtimeChannel;
    if (existing) supabase.removeChannel(existing);

    const {
      fetchAgents, fetchIncidents, fetchContrats,
      fetchArmes, fetchPointages, fetchPassations, fetchSites, fetchAlertes,
    } = get();

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' },
          debounce(fetchAgents, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' },
          debounce(fetchIncidents, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contrats' },
          debounce(fetchContrats, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'armes' },
          debounce(fetchArmes, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages_journaliers' },
          debounce(fetchPointages, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passations' },
          debounce(fetchPassations, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' },
          debounce(fetchSites, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertes_legales' },
          debounce(fetchAlertes, 500))
      .subscribe();

    set({ _realtimeChannel: channel });
    // Retourne la fonction de cleanup pour le useEffect dans AdminLayout
    return () => supabase.removeChannel(channel);
  },
}));
