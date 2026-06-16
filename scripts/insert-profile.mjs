import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuyvkmscqvmhgqrgzqhd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eXZrbXNjcXZtaGdxcmd6cWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODc2NzUsImV4cCI6MjA5NTY2MzY3NX0.qA_6Yc4jFDV3epvRoH8-A_f4GXeHT6XjN9O4sqmRJ0Y'
);

// UUID créé à l'étape précédente
const UUID = 'af5b3297-4cec-4d77-b0e8-0ec9be90f347';

// Récupérer les colonnes réelles de profils_admin
const { data: cols, error: colErr } = await supabase
  .from('profils_admin')
  .select('*')
  .limit(1);

if (colErr) {
  console.log('Colonnes inconnues, tentative avec champs courants...');
}

// Tentative 1 : avec nom_complet
const attempts = [
  { id: UUID, role: 'GERANT', nom_complet: 'Administrateur DZ Security' },
  { id: UUID, role: 'GERANT', nom_complet: 'Administrateur DZ Security', email: 'admin@dzsecurity.com' },
  { id: UUID, role: 'GERANT' },
];

let success = false;
for (const payload of attempts) {
  const { error } = await supabase
    .from('profils_admin')
    .upsert(payload, { onConflict: 'id' });

  if (!error) {
    console.log('✅ Profil inséré avec payload :', JSON.stringify(payload));
    success = true;
    break;
  } else {
    console.log('⚠️  Tentative échouée :', error.message);
  }
}

if (!success) {
  console.log('\n❌ Impossible d\'insérer via anon key (RLS probablement actif).');
  console.log('Lance ce SQL dans le SQL Editor de Supabase :');
  console.log(`
INSERT INTO profils_admin (id, role, nom_complet)
VALUES ('${UUID}', 'GERANT', 'Administrateur DZ Security')
ON CONFLICT (id) DO UPDATE SET role = 'GERANT';
  `);
} else {
  // Vérification
  const { data } = await supabase.from('profils_admin').select('*').eq('id', UUID).single();
  console.log('\n══════════════════════════════════════════════');
  console.log('  RÉSULTAT FINAL');
  console.log('  Email    : admin@dzsecurity.com');
  console.log('  Password : Admin123! (hashé bcrypt dans auth.users)');
  console.log('  UUID     : ' + UUID);
  console.log('  Profil   :', JSON.stringify(data));
  console.log('══════════════════════════════════════════════');
}
