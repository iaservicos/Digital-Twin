package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "reincidentes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reincidencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "chamado_rrc")
    private Long chamadoRrc;

    @Column(name = "chamado_anterior")
    private Long chamadoAnterior;

    @Column(name = "tecnico_nome_rrc")
    private String tecnicoNomeRrc;

    @Column(name = "tecnico_nome_anterior")
    private String tecnicoNomeAnterior;

    @Column(name = "ft_rrc")
    private LocalDateTime ftRrc;

    @Column(name = "ft_anterior")
    private LocalDateTime ftAnterior;

    @Column(name = "encerramento_rrc")
    private LocalDateTime encerramentoRrc;

    @Column(name = "encerramento_anterior")
    private LocalDateTime encerramentoAnterior;

    @Column(name = "intervalo_dias")
    private Integer intervaloDias;

    @Column(name = "projeto_rrc")
    private String projetoRrc;

    @Column(name = "projeto_anterior")
    private String projetoAnterior;
}
