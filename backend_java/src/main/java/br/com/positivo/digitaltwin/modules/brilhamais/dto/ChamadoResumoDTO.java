package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChamadoResumoDTO {
    private String id;
    private String desc;
    private String status;
    private Boolean isLate;
    private String time;
    private String pecasUtilizadas;
    private String textoEncerramento;
}
