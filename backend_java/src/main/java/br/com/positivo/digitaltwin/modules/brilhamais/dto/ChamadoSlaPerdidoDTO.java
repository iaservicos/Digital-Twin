package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import java.time.LocalDateTime;

/**
 * DTO para detalhamento de chamados que estouraram o prazo de SLA ou foram classificados como perda.
 */
public record ChamadoSlaPerdidoDTO(
        String chamado,
        LocalDateTime dataFt,
        String tecnicoNome,
        String ctCodigo,
        String assistenciaNome,
        String equipamento,
        String projeto,
        String slaStatus,
        String causaPerda,
        String textoEncerramento
) {}
