import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = 'https://kuyvkmscqvmhgqrgzqhd.supabase.co';
const SUPABASE_ANON    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eXZrbXNjcXZtaGdxcmd6cWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODc2NzUsImV4cCI6MjA5NTY2MzY3NX0.qA_6Yc4jFDV3epvRoH8-A_f4GXeHT6XjN9O4sqmRJ0Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const EMAIL    = 'admin@dzsecurity.com';
const PASSWORD = 'Admin123!';
const ROLE     = 'GERANT';

async function main() {
  console.log('── Étape 1 : Création du compte auth ──');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
  });

  if (signUpError) {
    console.error('❌ signUp échoué :', signUpError.message);
    process.exit(1);
  }

  const user = signUpData?.user;
  if (!user) {
    console.error('❌ Aucun utilisateur retourné.');
    process.exit(1);
  }

  console.log('✅ Utilisateur créé');
  console.log('   Email :', user.email);
  console.log('   UUID  :', user.id);
  console.log('   Confirmé :', user.email_confirmed_at ? 'oui' : 'en attente de confirmation');

  console.log('\n── Étape 2 : Insertion du rôle dans profils_admin ──');
  const { error: insertError } = await supabase
    .from('profils_admin')
    .upsert({ id: user.id, role: ROLE, nom_complet: 'Administrateur DZ Security' }, { onConflict: 'id' });

  if (insertError) {
    console.error('❌ Insert profils_admin échoué :', insertError.message);
    console.log('\n⚠️  Le compte auth EST créé (UUID:', user.id, ')');
    console.log('   Lance ce SQL dans Supabase pour finir :');
    console.log(`   INSERT INTO profils_admin (id, role) VALUES ('${user.id}', '${ROLE}') ON CONFLICT (id) DO UPDATE SET role = '${ROLE}';`);
    process.exit(1);
  }

  console.log('✅ Rôle GERANT inséré dans profils_admin');

  console.log('\n── Étape 3 : Vérification ──');
  const { data: profil, error: profilError } = await supabase
    .from('profils_admin')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (profilError || !profil) {
    console.warn('⚠️  Vérification impossible :', profilError?.message);
  } else {
    console.log('✅ Vérification OK');
    console.log('   ID   :', profil.id);
    console.log('   Rôle :', profil.role);
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  COMPTE CRÉÉ AVEC SUCCÈS');
  console.log('  Email    : ' + EMAIL);
  console.log('  Password : ' + PASSWORD);
  console.log('  UUID     : ' + user.id);
  console.log('  Rôle     : ' + ROLE);
  console.log('═══════════════════════════════════════');
}

main();
