import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuyvkmscqvmhgqrgzqhd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eXZrbXNjcXZtaGdxcmd6cWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODc2NzUsImV4cCI6MjA5NTY2MzY3NX0.qA_6Yc4jFDV3epvRoH8-A_f4GXeHT6XjN9O4sqmRJ0Y'
);

const EMAIL    = 'dopsgsc@gmail.com';
const PASSWORD = 'DzSec2026!';
const ROLE     = 'GERANT';
const NOM      = 'Gestionnaire DZ Security';

// Étape 1 — signUp (crée le compte auth)
console.log('── Étape 1 : signUp ──');
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email: EMAIL, password: PASSWORD });

let userId;

if (signUpError?.message?.includes('already registered')) {
  console.log('ℹ️  Email déjà enregistré.');
  // Récupérer l'UUID via signIn
  const { data: si } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  userId = si?.user?.id;
} else if (signUpError) {
  console.error('❌ signUp :', signUpError.message);
  process.exit(1);
} else {
  userId = signUpData?.user?.id;
}

if (!userId) { console.error('❌ UUID introuvable'); process.exit(1); }
console.log('✅ UUID :', userId);

// Étape 2 — Confirmer l'email via le lien de confirmation (si possible)
// Avec la clé anon, on ne peut pas confirmer — on insère le profil via SQL affiché
console.log('\n── Étape 2 : Insertion profils_admin ──');

// Essai direct
const { error: e1 } = await supabase
  .from('profils_admin')
  .upsert({ id: userId, role: ROLE, nom_complet: NOM }, { onConflict: 'id' });

if (!e1) {
  console.log('✅ Profil inséré directement');
  printResult(userId, 'succès');
  process.exit(0);
}

console.log('⚠️  Insert direct échoué :', e1.message);
console.log('\n── Solution : SQL à exécuter dans Supabase ──');
console.log('');
console.log('Ouvre : https://supabase.com/dashboard/project/kuyvkmscqvmhgqrgzqhd/sql/new');
console.log('');
console.log('Puis colle et exécute ce SQL :');
console.log('─────────────────────────────────────────────');
console.log(`
-- 1. Confirmer l'email (bypasse la confirmation)
UPDATE auth.users
SET email_confirmed_at = now(),
    confirmed_at       = now()
WHERE email = '${EMAIL}';

-- 2. Insérer le profil GERANT
INSERT INTO profils_admin (id, role, nom_complet)
SELECT id, '${ROLE}', '${NOM}'
FROM auth.users
WHERE email = '${EMAIL}'
ON CONFLICT (id) DO UPDATE SET role = '${ROLE}';

-- 3. Vérification
SELECT u.email, u.email_confirmed_at, p.role
FROM auth.users u
JOIN profils_admin p ON p.id = u.id
WHERE u.email = '${EMAIL}';
`);
console.log('─────────────────────────────────────────────');
console.log('\nUUID pour référence :', userId);

function printResult(uuid, status) {
  console.log('\n══════════════════════════════════════════════');
  console.log('  COMPTE OPÉRATIONNEL');
  console.log(`  Email    : ${EMAIL}`);
  console.log(`  Password : ${PASSWORD}`);
  console.log(`  UUID     : ${uuid}`);
  console.log(`  Rôle     : ${ROLE}`);
  console.log(`  Statut   : ${status}`);
  console.log('══════════════════════════════════════════════');
}
