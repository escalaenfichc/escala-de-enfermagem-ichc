import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Lock, Mail, Building2, ShieldCheck, FlaskConical } from 'lucide-react';
import { isNominal } from '../config/ambiente';

function slugUnidade(nome = '') {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function Login() {
  const navigate = useNavigate();
  const { loginUnidadeSemSenha } = useAuth();

  const [abaLogin, setAbaLogin] = useState(isNominal ? 'EMAIL' : 'UNIDADE'); // 'UNIDADE' | 'EMAIL'
  const [unidades, setUnidades] = useState([]);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erroMsg, setErroMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    async function carregarUnidadesLogin() {
      // Tenta primeiro a view pública unidades_login (migração 001), com fallback para setores_unidades
      const { data: vData, error: vErr } = await supabase
        .from('unidades_login')
        .select('*')
        .order('nome_oficial');

      if (!vErr && Array.isArray(vData) && vData.length > 0) {
        setUnidades(
          vData.map((u) => ({
            id: u.id,
            nome: u.nome_oficial,
            login_email: u.login_email,
          }))
        );
        return;
      }

      const { data: sData } = await supabase
        .from('setores_unidades')
        .select('*')
        .order('nome_oficial');

      if (Array.isArray(sData)) {
        const ativas = sData
          .filter((s) => (s.status || s.Status || '').toUpperCase() === 'ATIVO')
          .map((s) => {
            const nome = s.nome_oficial || s.Nome_Oficial || s.nome || '';
            return {
              id: s.id,
              sigla: s.sigla_localizacao || s.Sigla_Localizacao || '',
              nome,
              login_email:
                s.login_email || `${slugUnidade(nome)}@unidades.escalaenf.app`,
            };
          });
        setUnidades(ativas);
      }
    }
    carregarUnidadesLogin();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErroMsg('');

    // Modo Login da Unidade: permite entrar sem senha para testes (ou com senha se digitada)
    if (abaLogin === 'UNIDADE' && !isNominal) {
      if (!unidadeSelecionada) {
        return alert('Selecione a sua Unidade na lista.');
      }
      const uObj = unidades.find((u) => u.nome === unidadeSelecionada) || {
        nome: unidadeSelecionada,
      };

      // Se não digitou senha, entra diretamente em modo de teste da unidade
      if (!senha.trim()) {
        loginUnidadeSemSenha(uObj);
        navigate('/');
        return;
      }

      // Se digitou senha, tenta autenticar no Supabase; se o login ainda não existir no banco, libera para teste
      setLoading(true);
      try {
        const emailParaLogin =
          uObj.login_email || `${slugUnidade(unidadeSelecionada)}@unidades.escalaenf.app`;
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailParaLogin,
          password: senha,
        });
        if (!error && data?.user) {
          setTimeout(() => navigate('/'), 300);
          return;
        }
        // Fallback para teste caso as senhas ainda não tenham sido geradas no banco
        loginUnidadeSemSenha(uObj);
        navigate('/');
        return;
      } finally {
        setLoading(false);
      }
    }

    const emailParaLogin = email.trim();
    if (!emailParaLogin) {
      return alert('Digite seu e-mail.');
    }
    if (!senha) return alert('Digite sua senha.');

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailParaLogin,
        password: senha,
      });

      if (error) {
        console.error('Erro no login:', error.message);
        setErroMsg('E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      if (data?.user) {
        setTimeout(() => {
          navigate('/');
        }, 400);
      }
    } catch (err) {
      alert('Erro inesperado ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div
          className={`p-8 text-center ${
            isNominal ? 'bg-amber-600' : 'bg-indigo-600'
          }`}
        >
          <div className="bg-white/20 p-4 rounded-2xl inline-block mb-4 backdrop-blur-sm">
            <Activity size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Escala<span className="text-white/80">Enf</span>
          </h1>
          <p className="text-white/90 mt-2 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
            {isNominal ? (
              <>
                <FlaskConical size={14} /> Versão 1 · Demonstração Nominal
              </>
            ) : (
              <>
                <ShieldCheck size={14} /> Versão 2 · Supervisão
              </>
            )}
          </p>
        </div>

        {/* Seletor de Modo de Login na V2 (Por Unidade vs Supervisão/Gestão) */}
        {!isNominal && (
          <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => {
                setAbaLogin('UNIDADE');
                setErroMsg('');
              }}
              className={`py-3 text-xs font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                abaLogin === 'UNIDADE'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Building2 size={15} /> Login da Unidade
            </button>
            <button
              type="button"
              onClick={() => {
                setAbaLogin('EMAIL');
                setErroMsg('');
              }}
              className={`py-3 text-xs font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                abaLogin === 'EMAIL'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Mail size={15} /> Supervisão / Gestão
            </button>
          </div>
        )}

        {erroMsg && (
          <div className="bg-red-50 text-red-600 p-3 mx-8 mt-6 rounded-lg text-sm font-medium border border-red-100 text-center">
            {erroMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {abaLogin === 'UNIDADE' && !isNominal ? (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Selecione a Unidade *
              </label>
              <div className="relative">
                <select
                  required
                  value={unidadeSelecionada}
                  onChange={(e) => setUnidadeSelecionada(e.target.value)}
                  className="w-full border border-slate-300 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-semibold text-sm text-slate-800 transition-all"
                >
                  <option value="">Escolha a sua unidade na lista...</option>
                  {unidades.map((u) => (
                    <option key={u.id || u.nome} value={u.nome}>
                      {u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {isNominal ? 'E-mail de Acesso (Demo V1)' : 'E-mail Institucional'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={18} className="text-slate-400" />
                </div>
                <input
                  type="email"
                  className="w-full border border-slate-300 pl-11 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium transition-all"
                  placeholder="Seu e-mail de acesso"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {abaLogin === 'UNIDADE' && !isNominal
                ? 'Senha da Unidade (Opcional para teste)'
                : 'Senha'}
            </label>
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-slate-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full border border-slate-300 pl-11 pr-12 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium transition-all"
                placeholder={
                  abaLogin === 'UNIDADE' && !isNominal
                    ? 'Deixe em branco para entrar em modo de teste'
                    : 'Digite a senha'
                }
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-bold p-4 rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 ${
              isNominal
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
