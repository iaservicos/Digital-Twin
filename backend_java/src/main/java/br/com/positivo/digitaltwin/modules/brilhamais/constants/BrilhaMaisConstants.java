package br.com.positivo.digitaltwin.modules.brilhamais.constants;

/**
 * Constantes oficiais de regras de negócio do Programa Brilha+ (Performance Técnica).
 */
public final class BrilhaMaisConstants {

    private BrilhaMaisConstants() {
        // Construtor privado para classe utilitária de constantes
    }

    // --- Status de SLA ---
    public static final String SLA_DENTRO = "DENTRO";
    public static final String SLA_FORA = "FORA";

    // --- Classificação de Chamados ---
    public static final String CLASSIFICA_PERDAS_GESTAO = "PERFORMANCE FALHA GESTAO";
    public static final String CLASSIFICA_PEDIDO_PECA = "PEDIDO DE PEÇA";

    // --- Projetos Desconsiderados / Exceções ---
    public static final String PROJETO_EXCLUIDO_H3 = "H3-03535";

    // --- Regras de Corte e Pontuação ---
    public static final double PONTUACAO_CORTE_ELEGIBILIDADE = 70.0;
    public static final double SLA_EQUIPE_META_PADRAO = 90.0;

    // --- Motivos de Inelegibilidade ---
    public static final String MOTIVO_SEM_CHAMADOS = "Sem chamados/atendimentos registrados no mês";
    public static final String MOTIVO_ABAIXO_CORTE = "Pontuação abaixo da nota de corte (70 pts)";
}
