package br.com.positivo.digitaltwin.modules.brilhamais.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private boolean isPrimeiroAcesso;
    private String nome;
    private String cargo;
    private String localEquipe;
    private String role;
}
