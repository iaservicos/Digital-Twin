package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import java.util.List;

/**
 * DTO para relatório e análise de chamados operacionais sem técnico atribuído
 * (nulos ou 'Não Definido'), agrupados por região/UF e Base ATP para a supervisão.
 */
public record ChamadosSemTecnicoDTO(
        int totalGeral,
        int totalBasesAfetadas,
        List<RegiaoSemTecnicoDTO> regioes,
        List<ChamadoSlaPerdidoDTO> chamados
) {
    public record RegiaoSemTecnicoDTO(
            String uf,
            String atpNome,
            String ctCodigo,
            int totalChamados,
            int dentroSla,
            int foraSla,
            double percSla
    ) {}
}
