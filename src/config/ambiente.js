// =============================================================================
// src/config/ambiente.js
// Configuração central de Modo de Operação (V1 Nominal vs V2 Quantitativo/Rundown)
// =============================================================================

const envModo = (import.meta.env.VITE_MODO_OPERACAO || '').toUpperCase().trim();

export function getModoOperacao() {
  // Permite alternar rapidamente em ambiente local/homologação se desejado pelo Admin
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const modoUrl = (urlParams.get('modo') || '').toUpperCase();
    if (modoUrl === 'NOMINAL' || modoUrl === 'QUANTITATIVO') {
      localStorage.setItem('escalaenf_modo_preview', modoUrl);
      return modoUrl;
    }
    const override = localStorage.getItem('escalaenf_modo_preview');
    if (override === 'NOMINAL' || override === 'QUANTITATIVO') {
      return override;
    }
  }
  if (envModo === 'NOMINAL' || envModo === 'QUANTITATIVO') {
    return envModo;
  }
  // Padrão seguro: V2 Quantitativo (Rundown sem dados nominais de colaboradores)
  return 'QUANTITATIVO';
}

export function setModoOperacaoPreview(novoModo) {
  if (typeof window !== 'undefined') {
    if (!novoModo) {
      localStorage.removeItem('escalaenf_modo_preview');
    } else {
      localStorage.setItem('escalaenf_modo_preview', novoModo.toUpperCase());
    }
    window.location.reload();
  }
}

export const MODO_ATUAL = getModoOperacao();
export const isNominal = MODO_ATUAL === 'NOMINAL';
export const isQuantitativo = MODO_ATUAL === 'QUANTITATIVO';

export const AMBIENTE_LABEL =
  import.meta.env.VITE_AMBIENTE_LABEL ||
  (isNominal ? 'VERSÃO 1 · DEMONSTRAÇÃO NOMINAL (DADOS FICTÍCIOS)' : '');

/**
 * Verifica se um módulo deve estar visível no modo atual.
 * @param {'NOMINAL' | 'QUANTITATIVO' | 'AMBOS'} modoModulo
 */
export function moduloVisivelNoModo(modoModulo = 'AMBOS') {
  if (modoModulo === 'AMBOS') return true;
  return modoModulo === MODO_ATUAL;
}
