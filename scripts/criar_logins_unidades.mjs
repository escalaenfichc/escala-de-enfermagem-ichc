// =============================================================================
// scripts/criar_logins_unidades.mjs
// -----------------------------------------------------------------------------
// Cria 1 login (Supabase Auth) por unidade ATIVA, para a V2 · Rundown.
//  • e-mail técnico gerado a partir do nome (o usuário NÃO digita, escolhe na lista)
//  • senha aleatória legível
//  • perfil em usuarios_perfis: role='Unidade', unidade_id, acesso_v2=true
//  • grava setores_unidades.login_email
//  • exporta scripts/saida/senhas_unidades.csv  (NUNCA versionar / enviar ao git)
//
// Pré-requisitos:
//   1) 001_rundown_v2.sql já executado no Supabase
//   2) arquivo .env.admin na raiz (fora do git) contendo:
//        SUPABASE_URL=https://xxxx.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Settings → API → service_role)
//
// Uso:
//   node scripts/criar_logins_unidades.mjs             → simulação (não grava nada)
//   node scripts/criar_logins_unidades.mjs --executar  → cria de verdade
// Unidades que já têm login_email são ignoradas (pode rodar de novo com segurança).
// =============================================================================
import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const EXECUTAR = process.argv.includes('--executar');
const DOMINIO = 'unidades.escalaenf.app';

if (!existsSync('.env.admin')) {
  console.error('❌ Arquivo .env.admin não encontrado na raiz do projeto.');
  process.exit(1);
}
process.loadEnvFile('.env.admin');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.admin');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const slug = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const gerarSenha = (n = 10) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

const { data: setores, error } = await admin
  .from('setores_unidades')
  .select('id, nome_oficial, status, login_email')
  .order('nome_oficial');
if (error) { console.error('❌ Erro ao ler setores:', error.message); process.exit(1); }

const ativos = setores.filter(s => (s.status || '').toUpperCase() === 'ATIVO');
const pendentes = ativos.filter(s => !s.login_email);
const usados = new Set(setores.map(s => s.login_email).filter(Boolean));

console.log(`Unidades ativas: ${ativos.length} | já com login: ${ativos.length - pendentes.length} | a criar: ${pendentes.length}`);
console.log(EXECUTAR ? '⚙️  MODO EXECUÇÃO\n' : '🧪 MODO SIMULAÇÃO (use --executar para gravar)\n');

const saida = [['unidade', 'email_login', 'senha']];
for (const s of pendentes) {
  let base = slug(s.nome_oficial) || `unidade-${s.id.slice(0, 8)}`;
  let email = `${base}@${DOMINIO}`;
  for (let i = 2; usados.has(email); i++) email = `${base}-${i}@${DOMINIO}`;
  usados.add(email);
  const senha = gerarSenha();

  if (!EXECUTAR) { console.log(`• ${s.nome_oficial}  →  ${email}`); continue; }

  const { data: novo, error: eUser } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true,
    user_metadata: { tipo: 'UNIDADE', unidade: s.nome_oficial },
  });
  if (eUser) { console.error(`✖ ${s.nome_oficial}: ${eUser.message}`); continue; }

  const { error: ePerfil } = await admin.from('usuarios_perfis').upsert({
    id: novo.user.id, role: 'Unidade', nome: s.nome_oficial,
    unidade_id: s.id, acesso_v1: false, acesso_v2: true,
  });
  if (ePerfil) { console.error(`✖ perfil ${s.nome_oficial}: ${ePerfil.message}`); continue; }

  const { error: eSetor } = await admin.from('setores_unidades').update({ login_email: email }).eq('id', s.id);
  if (eSetor) { console.error(`✖ setor ${s.nome_oficial}: ${eSetor.message}`); continue; }

  saida.push([s.nome_oficial, email, senha]);
  console.log(`✔ ${s.nome_oficial}`);
}

if (EXECUTAR && saida.length > 1) {
  mkdirSync('scripts/saida', { recursive: true });
  const csv = saida.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  writeFileSync('scripts/saida/senhas_unidades.csv', '\uFEFF' + csv, 'utf8');
  console.log(`\n📄 Senhas salvas em scripts/saida/senhas_unidades.csv (${saida.length - 1} unidades).`);
  console.log('   Distribua com segurança e APAGUE o arquivo depois.');
}
