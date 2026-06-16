import { create } from 'zustand';
import { supabase } from '../supabaseClient';

export const useDataStore = create((set, get) => ({
  // --- State ---
  agentsData: [],
  incidentsData: [],
  contratsData: [],
  armesData: [],
  historiquePointages: [],
  roleAdmin: 'GERANT',
  _cachedUserId: null,

  // --- Fetchers individuels (appelés par Realtime) ---
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

  fetchPointages: async () => {
    const { data } = await supabase.from('pointages_journaliers').select('*');
    if (data) set({ historiquePointages: data });
  },

  // --- Fetch initial complet (chargement au login ou après CRUD) ---
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
    const { fetchAgents, fetchIncidents, fetchContrats, fetchArmes, fetchPointages } = get();
    await Promise.all([fetchAgents(), fetchIncidents(), fetchContrats(), fetchArmes(), fetchPointages()]);
  },

  // --- Actions métier ---
  resoudreIncident: async (id) => {
    if (!id) return;
    await supabase.from('incidents').update({ resolu: true }).eq('id', id);
    get().fetchIncidents();
  },

  // --- Initialisation Realtime (appelé une fois après login) ---
  initRealtime: () => {
    const { fetchAgents, fetchIncidents, fetchContrats, fetchArmes, fetchPointages } = get();
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchAgents)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, fetchIncidents)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contrats' }, fetchContrats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'armes' }, fetchArmes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages_journaliers' }, fetchPointages)
      .subscribe();

    return () => supabase.removeChannel(channel);
  },
}));
