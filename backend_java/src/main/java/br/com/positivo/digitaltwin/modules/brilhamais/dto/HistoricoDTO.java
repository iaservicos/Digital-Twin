package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class HistoricoDTO {
    private String mes;
    private String mesReferencia;
    private Double percentualSla;
    private Double pontosSla;
    private Double percentualReincidencia;
    private Double pontosReincidencia;
    private Double percentualReincidenciaEquipe;
    private Double pontosReincidenciaEquipe;
    private Double npsScore;
    private Double pontosNps;
    private Double percentualEficienciaPecas;
    private Double pontosPecas;
    private Double percentualPerdidos;
    private Double pontosPerdidos;
    private Double pontosTotal;
    private Boolean elegivel;
    private String motivoInelegibilidade;
}
