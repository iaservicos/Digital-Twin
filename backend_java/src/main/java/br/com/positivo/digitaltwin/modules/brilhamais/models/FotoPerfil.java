package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "tb_foto_perfil")
public class FotoPerfil {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idFoto;

    @OneToOne
    @JoinColumn(name = "id_tecnico", nullable = false, unique = true)
    private Tecnico tecnico;

    @Column(name = "foto_base64", nullable = false, columnDefinition = "TEXT")
    private String fotoBase64;
}
