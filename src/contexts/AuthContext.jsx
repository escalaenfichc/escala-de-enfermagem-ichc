import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase'; 
import { isNominal } from '../config/ambiente';

const AuthContext = createContext({});

export const PERFIS = {
  CHEFE_1: "Plantão Assistencial",
  CHEFE_2: "Liderança",
  CHEFE_3: "Supervisão",
  ADMIN: "Administrativo",
  COLABORADOR: "Colaborador",
  UNIDADE: "Unidade",
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [filtroGlobalSetor, setFiltroGlobalSetor] = useState("");
  const [pedidosFolga, setPedidosFolga] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pedidosFolga')) || []; } catch(e) { return []; }
  });

  useEffect(() => {
    localStorage.setItem('pedidosFolga', JSON.stringify(pedidosFolga));
  }, [pedidosFolga]);

  const loadUserProfile = async (currentSession) => {
    if (!currentSession?.user) {
      // Verifica se há uma sessão de teste de Unidade sem senha ativa
      try {
        const rawUnidade = localStorage.getItem('escalaenf_sessao_unidade_teste');
        if (rawUnidade) {
          const uTeste = JSON.parse(rawUnidade);
          setUser(uTeste);
          setSession(null);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Falha ao restaurar sessão de unidade:', e);
      }
      setUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Busca perfil base na tabela usuarios_perfis
      const { data: perfilData } = await supabase
        .from('usuarios_perfis')
        .select('*')
        .eq('id', currentSession.user.id)
        .maybeSingle();

      let nomeReal = perfilData?.nome || perfilData?.Nome || currentSession.user.user_metadata?.unidade || currentSession.user.email;
      let unidadeDoColaborador = null;
      let cargoDoColaborador = null;
      
      let matriculaPerfil = perfilData?.matricula || perfilData?.Matricula;
      let rolePerfil = perfilData?.role || perfilData?.Role || (isNominal ? 'Colaborador' : 'Unidade');
      let unidadePerfil = perfilData?.unidade || perfilData?.Unidade || currentSession.user.user_metadata?.unidade || null;
      let unidadeIdPerfil = perfilData?.unidade_id || null;
      
      // Fallback de segurança apenas para o admin de configuração inicial
      if (currentSession.user.email === 'admin@teste.com' && !matriculaPerfil) {
        rolePerfil = 'Administrador';
        matriculaPerfil = '100069'; 
      }
      
      // Identificador inteligente de poderes
      const isGestorAltoNivel =
        rolePerfil.includes('Administrador') ||
        rolePerfil.includes('Diretor') ||
        rolePerfil.includes('Supervisão');

      // No modo NOMINAL (V1 Demo), busca dados complementares na tabela 'colaboradores'.
      // No modo QUANTITATIVO (V2 Produção), NUNCA consulta a tabela 'colaboradores'.
      if (isNominal && matriculaPerfil) {
        const { data: colabData, error: colabError } = await supabase
          .from('colaboradores')
          .select('*')
          .eq('matricula', String(matriculaPerfil)) 
          .maybeSingle();
          
        if (!colabError && colabData) {
          nomeReal = colabData.nome_completo || colabData.Nome_Completo || colabData.nome || nomeReal;
          unidadeDoColaborador = colabData.unidade_alocacao || colabData.Unidade_Alocacao || colabData.setor || colabData.Setor || null;
          cargoDoColaborador = colabData.cargo || colabData.Categoria_Profissional || colabData.categoria_profissional || null;
          
          if (rolePerfil === 'Plantão Assistencial') {
            const isEnfermeiro = colabData.cargo?.toLowerCase().includes('enferm') || 
                                 colabData.categoria_profissional?.toLowerCase().includes('enferm');
            if (!isEnfermeiro) {
              console.warn("Acesso negado: Perfil Plantão Assistencial é exclusivo para enfermeiros. Rebaixando acesso.");
              rolePerfil = 'Colaborador';
            }
          }
        }
      }
      // 3. Busca e filtra setores onde o usuário é chefe, diretor ou unidade vinculada
      let setoresArray = [];
      let setoresDetalhesArray = [];

      const { data: setoresData, error: setoresError } = await supabase
        .from('setores_unidades')
        .select('*');

      if (!setoresError && setoresData) {
        if (unidadeIdPerfil && !unidadePerfil) {
          const setorVinc = setoresData.find(s => s.id === unidadeIdPerfil);
          if (setorVinc) {
            unidadePerfil = setorVinc.nome_oficial || setorVinc.Nome_Oficial || setorVinc.nome;
          }
        }

        setoresDetalhesArray = setoresData.filter(setor => {
          const status = (setor.status || setor.Status || '').toUpperCase();
          if (status !== 'ATIVO') return false;

          if (isGestorAltoNivel) return true;
          if (unidadeIdPerfil && setor.id === unidadeIdPerfil) return true;

          const nomeChefe = (setor.enf_chefe || setor.Enf_Chefe || '').toLowerCase().trim();
          const nomeDiretor = (setor.diretor_area || setor.Diretor_Area || '').toLowerCase().trim();
          const meuNome = nomeReal.toLowerCase().trim();

          return (nomeChefe === meuNome) || (nomeDiretor === meuNome);
        });

        setoresArray = setoresDetalhesArray.map(s => s.nome_oficial || s.Nome_Oficial || s.nome_setor || s.nome);
      }

      // Monta o usuário final com os dados exatos do banco
      setUser({
        ...currentSession.user,
        email: currentSession.user.email,
        role: rolePerfil,
        perfil_secundario: perfilData?.perfil_secundario || perfilData?.Perfil_Secundario || '',
        perfis: [rolePerfil, perfilData?.perfil_secundario || perfilData?.Perfil_Secundario].filter(Boolean),
        nome: nomeReal,
        unidadeId: unidadeIdPerfil,
        unidadeLogada: isGestorAltoNivel ? 'Global' : ((setoresArray && setoresArray.length > 0) ? setoresArray[0] : (unidadeDoColaborador || unidadePerfil || "")),
        matricula: matriculaPerfil || null,
        setores: setoresArray,
        setores_detalhes: setoresDetalhesArray,
        acesso_v1: perfilData?.acesso_v1,
        acesso_v2: perfilData?.acesso_v2,
      });
      
      setSession(currentSession);
    } catch (error) {
      console.error("Erro fatal ao carregar perfil:", error);
      setUser(currentSession.user);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserProfile(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true); 
      loadUserProfile(session); 
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      throw error;
    }
  };

  const loginUnidadeSemSenha = (unidadeObj) => {
    const nomeUnidade = unidadeObj?.nome || unidadeObj?.nome_oficial || String(unidadeObj || '');
    const usuarioUnidade = {
      id: `unidade_${unidadeObj?.id || nomeUnidade}`,
      email: unidadeObj?.login_email || 'unidade@rundown.local',
      role: 'Unidade',
      perfil_secundario: '',
      perfis: ['Unidade'],
      nome: nomeUnidade,
      unidadeId: unidadeObj?.id || null,
      unidadeLogada: nomeUnidade,
      matricula: null,
      setores: [nomeUnidade],
      setores_detalhes: unidadeObj ? [unidadeObj] : [],
      acesso_v1: false,
      acesso_v2: true,
      modoTesteSemSenha: true,
    };
    localStorage.setItem('escalaenf_sessao_unidade_teste', JSON.stringify(usuarioUnidade));
    setUser(usuarioUnidade);
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    localStorage.removeItem('escalaenf_sessao_unidade_teste');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  const value = {
    session,
    user,
    signIn,
    loginUnidadeSemSenha,
    signOut,
    filtroGlobalSetor,
    setFiltroGlobalSetor,
    pedidosFolga,
    setPedidosFolga
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};