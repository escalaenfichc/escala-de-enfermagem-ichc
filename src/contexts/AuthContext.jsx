import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase'; 

const AuthContext = createContext({});

export const PERFIS = {
  CHEFE_1: "Plantão Assistencial",
  CHEFE_2: "Liderança",
  CHEFE_3: "Supervisão",
  ADMIN: "Administrativo",
  COLABORADOR: "Colaborador"
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

      let nomeReal = currentSession.user.email;
      let unidadeDoColaborador = null;
      let cargoDoColaborador = null;
      
      let matriculaPerfil = perfilData?.matricula || perfilData?.Matricula;
      let rolePerfil = perfilData?.role || perfilData?.Role || 'Colaborador';
      let unidadePerfil = perfilData?.unidade || perfilData?.Unidade || null;
      
      // Fallback de segurança apenas para o admin de configuração inicial
      if (currentSession.user.email === 'admin@teste.com' && !matriculaPerfil) {
        rolePerfil = 'Administrador';
        matriculaPerfil = '100069'; 
      }
      
      // Identificador inteligente de poderes
      const isGestorAltoNivel = rolePerfil.includes('Administrador') || rolePerfil.includes('Diretor');
// Busca dados complementares do colaborador na tabela 'colaboradores'
      if (matriculaPerfil) {
        const { data: colabData, error: colabError } = await supabase
          .from('colaboradores')
          .select('*')
          .eq('matricula', String(matriculaPerfil)) 
          .maybeSingle();
          
        if (!colabError && colabData) {
          // Extrai o nome, unidade e cargo
          nomeReal = colabData.nome_completo || colabData.Nome_Completo || colabData.nome || nomeReal;
          unidadeDoColaborador = colabData.unidade_alocacao || colabData.Unidade_Alocacao || colabData.setor || colabData.Setor || null;
          cargoDoColaborador = colabData.cargo || colabData.Categoria_Profissional || colabData.categoria_profissional || null;
          
          // TRAVA DE ACESSO: Plantão Assistencial exclusivo para Enfermeiros (DENTRO DO ESCOPO)
          if (rolePerfil === 'Plantão Assistencial') {
            const isEnfermeiro = colabData.cargo?.toLowerCase().includes('enferm') || 
                                 colabData.categoria_profissional?.toLowerCase().includes('enferm');
            if (!isEnfermeiro) {
              console.warn("Acesso negado: Perfil Plantão Assistencial é exclusivo para enfermeiros. Rebaixando acesso.");
              rolePerfil = 'Colaborador'; // Rebaixa para visão básica
            }
          }

        } else {
          console.warn("Aviso: Não foi possível buscar o nome do colaborador ou unidade. Usando email da sessão.");
        }
      }
      // 3. Busca e filtra setores onde o usuário é chefe ou diretor
      let setoresArray = [];
      let setoresDetalhesArray = [];

      const { data: setoresData, error: setoresError } = await supabase
        .from('setores_unidades')
        .select('*');

      if (!setoresError && setoresData) {
        setoresDetalhesArray = setoresData.filter(setor => {
          const status = (setor.status || setor.Status || '').toUpperCase();
          if (status !== 'ATIVO') return false;

          // Se for Admin ou Diretor, aprova automaticamente todos os setores!
          if (isGestorAltoNivel) return true;

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
        unidadeLogada: isGestorAltoNivel ? 'Global' : ((setoresArray && setoresArray.length > 0) ? setoresArray[0] : (unidadeDoColaborador || unidadePerfil || "")),
        matricula: matriculaPerfil || null,
        setores: setoresArray,
        setores_detalhes: setoresDetalhesArray
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

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    signIn,
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