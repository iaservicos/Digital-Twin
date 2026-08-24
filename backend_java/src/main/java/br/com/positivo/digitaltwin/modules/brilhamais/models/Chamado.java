package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "chamados")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Chamado {

    @Id
    @Column(name = "chamado")
    private Long numeroChamado;

    @Transient
    private Tecnico tecnico;

    @Column(name = "projeto")
    private String projeto;

    @Column(name = "ft")
    private LocalDateTime dataFt;

    @Column(name = "sla_status")
    private String statusSla;

    @Column(name = "tipo_equipamento")
    private String equipamento;

    @Column(name = "descricao_material")
    private String materialDescricao;

    @Transient
    private String comercial;

    @Column(name = "assistencia_centro_trabalho")
    private String ctBase;

    @Column(name = "assistencia_razao_social")
    private String assistenciaNome;

    @Column(name = "tecnico_nome")
    private String tecnicoNome;

    @Transient
    private String classificacaoChamado;

    @Column(name = "texto_encerrado")
    private String textoEncerrado;

    @Transient
    private String reincidente;
}
