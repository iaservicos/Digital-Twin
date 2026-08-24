package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import br.com.positivo.digitaltwin.core.exceptions.ResourceNotFoundException;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.AuthRequest;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.AuthResponse;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChangePasswordRequest;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.VerificarTecnicoRequest;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.VerificarTecnicoResponse;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.VincularMatriculaRequest;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Tecnico;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.TecnicoRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.services.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/v1/auth", "/auth"})
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final TecnicoRepository tecnicoRepository;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            Authentication authentication) {
        authService.alterarSenha(authentication.getName(), request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/vincular-matricula")
    public ResponseEntity<AuthResponse> vincularMatricula(@Valid @RequestBody VincularMatriculaRequest request) {
        return ResponseEntity.ok(authService.vincularMatricula(request));
    }

    @PostMapping("/verificar-tecnico")
    public ResponseEntity<VerificarTecnicoResponse> verificarTecnico(@Valid @RequestBody VerificarTecnicoRequest request) {
        String nome = request.getNome() != null ? request.getNome().trim() : "";
        String uf = request.getEstado() != null ? request.getEstado().trim() : "";

        Tecnico tecnico = tecnicoRepository.findByNomeAndEstadoNative(nome, uf).orElse(null);
        if (tecnico == null) {
            throw new ResourceNotFoundException("Nenhum técnico localizado com os dados informados.");
        }

        return ResponseEntity.ok(VerificarTecnicoResponse.builder()
                .id(tecnico.getIdTecnico())
                .nomeCompleto(tecnico.getNomeCompleto())
                .ctBase(tecnico.getCtBases() != null ? String.join(",", tecnico.getCtBases()) : "")
                .build());
    }
}
