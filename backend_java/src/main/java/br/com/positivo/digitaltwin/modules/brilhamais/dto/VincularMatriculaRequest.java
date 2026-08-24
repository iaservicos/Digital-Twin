package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VincularMatriculaRequest {
    @NotNull
    private Integer id;

    @NotBlank
    @Size(min = 5, max = 5, message = "Matrícula inválida")
    private String matricula;
}
