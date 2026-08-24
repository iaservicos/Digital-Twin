package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_apuracao_mensal")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApuracaoMensal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idApuracao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_tecnico", nullable = false)
    private Tecnico tecnico;

    @Column(name = "mes_ano", nullable = false)
    private LocalDate mesAno;

    @Column(name = "atingimento_sla")
    private BigDecimal atingimentoSla;

    @Column(name = "pontos_sla")
    private Double pontosSla;

    @Column(name = "atingimento_reincidencia")
    private BigDecimal atingimentoReincidencia;

    @Column(name = "pontos_reincidencia")
    private Double pontosReincidencia;

    @Column(name = "atingimento_reincidencia_equipe")
    private BigDecimal atingimentoReincidenciaEquipe;

    @Column(name = "pontos_reincidencia_equipe")
    private Double pontosReincidenciaEquipe;

    @Column(name = "atingimento_pecas")
    private BigDecimal atingimentoPecas;

    @Column(name = "pontos_pecas")
    private Double pontosPecas;

    @Column(name = "atingimento_nps")
    private BigDecimal atingimentoNps;

    @Column(name = "pontos_nps")
    private Double pontosNps;

    @Column(name = "atingimento_perdidos")
    private BigDecimal atingimentoPerdidos;

    @Column(name = "pontos_perdidos")
    private Double pontosPerdidos;

    @Column(name = "pontuacao_total")
    private BigDecimal pontuacaoTotal;

    @Builder.Default
    @Column(name = "status_elegibilidade")
    private Boolean statusElegibilidade = true;

    @Column(name = "motivo_inelegibilidade")
    private String motivoInelegibilidade;

    @Column(name = "total_chamados")
    private Integer totalChamados;

    @Column(name = "data_calculo")
    private LocalDateTime dataCalculo;
}
