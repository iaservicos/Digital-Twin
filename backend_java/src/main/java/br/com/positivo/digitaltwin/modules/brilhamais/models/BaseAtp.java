package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tb_base_atp")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BaseAtp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_base")
    private Integer idBase;

    @Column(name = "ct_codigo", length = 20)
    private String ctCodigo;

    @Column(name = "nome_atp", nullable = false, length = 150)
    private String nomeAtp;

    @Column(name = "tipo_atp", length = 50)
    private String tipoAtp;

    @Column(name = "cidade", length = 100)
    private String cidade;

    @Column(name = "uf", length = 2)
    private String uf;

    @Column(name = "regiao", length = 50)
    private String regiao;

    @Column(name = "supervisor", length = 100)
    private String supervisor;

    @Column(name = "responsavel", length = 100)
    private String responsavel;

    @Column(name = "id_supervisor")
    private Integer idSupervisor;
}
