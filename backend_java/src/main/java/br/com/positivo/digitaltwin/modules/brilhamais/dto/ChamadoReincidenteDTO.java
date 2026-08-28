package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import java.time.LocalDateTime;

public record ChamadoReincidenteDTO(
    String chamadoAnterior,
    String chamadoRrc,
    LocalDateTime ftAnterior,
    LocalDateTime ftRrc,
    Long diasEntreAtendimentos,
    String tecnicoNomeAnterior,
    String tecnicoNomeRrc,
    String ctAnterior,
    String ctRrc,
    String projetoAnterior,
    String projetoRrc,
    String defeitoAnterior,
    String ocorrenciaChamadoAnterior,
    String textoEncerradoAnterior,
    String aplicadoPecaAnterior
) {}
