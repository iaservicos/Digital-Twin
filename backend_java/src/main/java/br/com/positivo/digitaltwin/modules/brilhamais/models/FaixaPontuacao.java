package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "tb_faixa_pontuacao")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FaixaPontuacao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idFaixa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_regra", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private RegraKpi regraKpi;

    @Column(name = "valor_minimo")
    private BigDecimal valorMinimo;

    @Column(name = "valor_maximo")
    private BigDecimal valorMaximo;

    @Column(name = "pontos_obtidos")
    private BigDecimal pontosObtidos;
}
