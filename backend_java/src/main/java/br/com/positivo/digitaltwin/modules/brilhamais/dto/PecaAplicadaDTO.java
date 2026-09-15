package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PecaAplicadaDTO {
    private String chamado;
    private LocalDateTime ft;
    private String tipoEquipamento;
    private String acao;
    private String codSolicDesc;
    private String codAplicDesc;
    private String subgrupo;
    private String grupoMercadoria;
    private String grupoMercadoriaDesc;
    private String tecnicoNome;
    private String projeto;
    private String assistenciaCidade;
    private String ocorrenciaChamado;
    private String textoEncerrado;
}
