package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "tb_chamado")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Chamado {

    @Id
    @Column(name = "chamado")
    private Long numeroChamado;

    @Column(name = "id_tecnico")
    private Integer idTecnico;

    @Transient
    private Tecnico tecnico;

    @Column(name = "projeto")
    private String projeto;

    @Column(name = "ft")
    private LocalDateTime dataFt;

    @Column(name = "sla_status")
    private String statusSla;

    @Column(name = "equipamento")
    private String equipamento;

    @Column(name = "material_descricao")
    private String materialDescricao;

    @Column(name = "comercial")
    private String comercial;

    @Column(name = "assistencia_centro_trabalho")
    private String ctBase;

    @Column(name = "assistencia_nome")
    private String assistenciaNome;

    @Column(name = "tecnico_nome")
    private String tecnicoNome;

    @Column(name = "classifica_chamado")
    private String classificacaoChamado;

    @Column(name = "texto_encerrado")
    private String textoEncerrado;

    @Column(name = "reincidente")
    private String reincidente;
}
