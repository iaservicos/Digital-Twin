package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class RankingDTO {
    private Integer posicaoRanking;
    private Integer idTecnico;
    private String tecnico;
    
    private Double pontosTotal;
    
    private BigDecimal percentualPerdidos;
    private Double pontosPerdidos;
    
    private BigDecimal percentualSla;
    private Double pontosSla;
    
    private BigDecimal percentualReincidencia;
    private Double pontosReincidencia;
    private BigDecimal percentualReincidenciaEquipe;
    private Double pontosReincidenciaEquipe;
    private Integer quantidadeProdutividade;
    private Double pontosProdutividade;
    
    private BigDecimal percentualEficienciaPecas;
    private Double pontosPecas;
    
    private BigDecimal npsScore;
    private Double pontosNps;
    private Integer npsPromotores;
    private Integer npsDetratores;

    private Boolean elegivel;
    private String motivoInelegibilidade;
    private LocalDate mesReferencia;
    private String matricula;
    private String localEquipe;
    
    private List<HistoricoDTO> historico;
}
