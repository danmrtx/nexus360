const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedAdmin() {
  console.log('Criando usuario admin...');
  const { data: user, error } = await supabase.auth.admin.createUser({
    email: 'admin@admin.com',
    password: 'admin',
    email_confirm: true
  });

  if (error) {
    console.error('Erro ao criar usuario:', error.message);
    if (!error.message.includes('already exists')) return;
  }

  // Pegar ID do usuario
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const adminUser = usersData.users.find(u => u.email === 'admin@admin.com');

  if (adminUser) {
    console.log('Atualizando perfil do admin...');
    const { error: perfilError } = await supabase.from('perfis').upsert({
      id: adminUser.id,
      nome: 'Administrador Master',
      papel: 'Administrador'
    });
    if (perfilError) {
      console.error('Erro ao atualizar perfil:', perfilError.message);
    } else {
      console.log('Admin configurado com sucesso!');
    }
  }
}

seedAdmin();

