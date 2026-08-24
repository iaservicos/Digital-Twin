package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AuthRequest {
    @NotBlank(message = "A matrícula/CPF é obrigatória")
    private String matricula;
    
    @NotBlank(message = "A senha é obrigatória")
    private String senha;
}
