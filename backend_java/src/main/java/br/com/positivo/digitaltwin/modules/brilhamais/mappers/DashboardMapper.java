package br.com.positivo.digitaltwin.modules.brilhamais.mappers;

import br.com.positivo.digitaltwin.modules.brilhamais.constants.BrilhaMaisConstants;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChamadoResumoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.HistoricoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.RankingDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.models.ApuracaoMensal;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Chamado;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Mapper utilitário desacoplado para conversão de Entidades JPA para DTOs do Dashboard.
 */
public final class DashboardMapper {

    private static final DateTimeFormatter FORMATTER_DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy - HH:mm");

    private DashboardMapper() {
    }

    public static HistoricoDTO toHistoricoDTO(ApuracaoMensal h, String label) {
        if (h == null) {
            return HistoricoDTO.builder()
                    .mes(label)
                    .percentualSla(0.0)
                    .pontosSla(0.0)
                    .percentualReincidencia(0.0)
                    .pontosReincidencia(0.0)
                    .percentualReincidenciaEquipe(0.0)
                    .pontosReincidenciaEquipe(0.0)
                    .npsScore(0.0)
                    .pontosNps(0.0)
                    .percentualEficienciaPecas(0.0)
                    .pontosPecas(0.0)
                    .percentualPerdidos(0.0)
                    .pontosPerdidos(0.0)
                    .pontosTotal(0.0)
                    .elegivel(false)
                    .motivoInelegibilidade(BrilhaMaisConstants.MOTIVO_SEM_CHAMADOS)
                    .build();
        }

        return HistoricoDTO.builder()
                .mes(label)
                .mesReferencia(h.getMesAno().toString())
                .percentualSla(valToPct(h.getAtingimentoSla()))
                .pontosSla(valToDouble(h.getPontosSla()))
                .percentualReincidencia(valToPct(h.getAtingimentoReincidencia()))
                .pontosReincidencia(valToDouble(h.getPontosReincidencia()))
                .percentualReincidenciaEquipe(valToPct(h.getAtingimentoReincidenciaEquipe()))
                .pontosReincidenciaEquipe(valToDouble(h.getPontosReincidenciaEquipe()))
                .npsScore(valToPct(h.getAtingimentoNps()))
                .pontosNps(valToDouble(h.getPontosNps()))
                .percentualEficienciaPecas(valToPct(h.getAtingimentoPecas()))
                .pontosPecas(valToDouble(h.getPontosPecas()))
                .percentualPerdidos(valToPct(h.getAtingimentoPerdidos()))
                .pontosPerdidos(valToDouble(h.getPontosPerdidos()))
                .pontosTotal(valToDouble(h.getPontuacaoTotal()))
                .elegivel(h.getStatusElegibilidade())
                .motivoInelegibilidade(h.getMotivoInelegibilidade())
                .build();
    }

    public static RankingDTO toRankingDTO(ApuracaoMensal apuracao, int pos, List<HistoricoDTO> historico) {
        boolean semChamados = apuracao.getTotalChamados() == null || apuracao.getTotalChamados() == 0;

        return RankingDTO.builder()
                .posicaoRanking(pos)
                .idTecnico(apuracao.getTecnico().getIdTecnico())
                .tecnico(apuracao.getTecnico().getNomeCompleto())
                .pontosTotal(semChamados ? 0.0 : valToDouble(apuracao.getPontuacaoTotal()))
                .percentualPerdidos(semChamados ? BigDecimal.ZERO : valToPctBD(apuracao.getAtingimentoPerdidos()))
                .pontosPerdidos(semChamados ? 0.0 : valToDouble(apuracao.getPontosPerdidos()))
                .percentualSla(semChamados ? BigDecimal.ZERO : valToPctBD(apuracao.getAtingimentoSla()))
                .pontosSla(semChamados ? 0.0 : valToDouble(apuracao.getPontosSla()))
                .percentualReincidencia(semChamados ? BigDecimal.ZERO : valToPctBD(apuracao.getAtingimentoReincidencia()))
                .pontosReincidencia(semChamados ? 0.0 : valToDouble(apuracao.getPontosReincidencia()))
                .percentualReincidenciaEquipe(semChamados ? BigDecimal.ZERO : valToPctBD(apuracao.getAtingimentoReincidenciaEquipe()))
                .pontosReincidenciaEquipe(semChamados ? 0.0 : valToDouble(apuracao.getPontosReincidenciaEquipe()))
                .quantidadeProdutividade(apuracao.getTotalChamados() != null ? apuracao.getTotalChamados() : 0)
                .pontosProdutividade(semChamados ? 0.0 : valToDouble(apuracao.getPontosPecas()))
                .percentualEficienciaPecas(semChamados ? BigDecimal.ZERO : valToPctBD(apuracao.getAtingimentoPecas()))
                .pontosPecas(semChamados ? 0.0 : valToDouble(apuracao.getPontosPecas()))
                .npsScore(semChamados ? BigDecimal.ZERO : valToPctBD(apuracao.getAtingimentoNps()))
                .pontosNps(semChamados ? 0.0 : valToDouble(apuracao.getPontosNps()))
                .npsPromotores(0)
                .npsDetratores(0)
                .elegivel(semChamados ? false : apuracao.getStatusElegibilidade())
                .motivoInelegibilidade(semChamados ? BrilhaMaisConstants.MOTIVO_SEM_CHAMADOS : apuracao.getMotivoInelegibilidade())
                .mesReferencia(apuracao.getMesAno())
                .matricula(apuracao.getTecnico().getMatricula())
                .localEquipe(apuracao.getTecnico().getCtBases() != null ? String.join(",", apuracao.getTecnico().getCtBases()) : "")
                .historico(historico)
                .build();
    }

    public static ChamadoResumoDTO toChamadoResumoDTO(Chamado c, Map<String, String> dt) {
        String pecas = (dt != null && dt.containsKey("pecas")) ? dt.get("pecas") : "Nenhuma peça consumida";
        String textoEnc = (dt != null && dt.containsKey("texto")) ? dt.get("texto")
                : (c.getTextoEncerrado() != null ? c.getTextoEncerrado()
                        : "Sem texto de encerramento");

        boolean isDentro = BrilhaMaisConstants.SLA_DENTRO.equalsIgnoreCase(c.getStatusSla());

        return ChamadoResumoDTO.builder()
                .id("Chamado-" + c.getNumeroChamado())
                .desc(c.getEquipamento() != null ? c.getEquipamento()
                        : (c.getProjeto() != null ? c.getProjeto() : "Chamado"))
                .status(isDentro ? "Encerrado dentro SLA" : "Encerrado fora do SLA")
                .isLate(!isDentro)
                .time(c.getDataFt() != null ? c.getDataFt().format(FORMATTER_DATA_HORA) : "")
                .pecasUtilizadas(pecas)
                .textoEncerramento(textoEnc)
                .build();
    }

    private static double valToPct(BigDecimal b) {
        return b != null ? b.multiply(new BigDecimal("100")).doubleValue() : 0.0;
    }

    private static BigDecimal valToPctBD(BigDecimal b) {
        return b != null ? b.multiply(new BigDecimal("100")) : BigDecimal.ZERO;
    }

    private static double valToDouble(Number n) {
        return n != null ? n.doubleValue() : 0.0;
    }
}
