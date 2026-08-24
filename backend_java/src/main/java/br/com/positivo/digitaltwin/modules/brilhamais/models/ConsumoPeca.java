package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "pecas")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumoPeca {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "chamado")
    private Long chamado;

    @Column(name = "tecnico_nome")
    private String tecnicoNome;

    @Column(name = "ft")
    private LocalDateTime ft;

    @Column(name = "cod_aplic")
    private String codAplic;

    @Column(name = "cod_aplic_desc")
    private String codAplicDesc;

    @Column(name = "status_peca")
    private String statusPeca;

    @Column(name = "grupo_mercadoria_desc")
    private String grupoMercadoriaDesc;

    @Column(name = "qtd")
    private Integer quantidade;

    @Column(name = "projeto")
    private String projeto;
}
