package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "tb_regra_kpi")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegraKpi {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idRegra;

    @Column(name = "nome_indicador", nullable = false)
    private String nomeIndicador;

    @Column(name = "descricao")
    private String descricao;

    @Column(name = "classe")
    private String classe;

    @Column(name = "is_gatilho")
    private Boolean isGatilho;

    @Column(name = "peso_percentual")
    private BigDecimal pesoPercentual;

    @Column(name = "meta_percentual")
    private BigDecimal metaPercentual;
}
