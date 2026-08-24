package br.com.positivo.digitaltwin.modules.brilhamais.services;

import br.com.positivo.digitaltwin.core.exceptions.BusinessException;
import br.com.positivo.digitaltwin.core.security.JwtService;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.AuthRequest;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.AuthResponse;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChangePasswordRequest;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.VincularMatriculaRequest;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Supervisor;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Tecnico;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.SupervisorRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.TecnicoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final TecnicoRepository tecnicoRepository;
    private final SupervisorRepository supervisorRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;

    @Value("${admin.matricula:ADMIN}")
    private String adminMatricula;

    @Value("${admin.password:Admin@Positivo2026}")
    private String adminPassword;

    public AuthResponse login(AuthRequest request) {
        String mat = request.getMatricula() != null ? request.getMatricula().trim() : "";
        String senha = request.getSenha() != null ? request.getSenha().trim() : "";

        // Fallback do Admin Master
        if (adminMatricula.equalsIgnoreCase(mat)) {
            Supervisor admin = supervisorRepository.findByMatricula(adminMatricula).orElse(null);
            if (admin == null) {
                admin = Supervisor.builder()
                        .matricula(adminMatricula)
                        .nomeCompleto("Administrador Master")
                        .senha(passwordEncoder.encode(adminPassword))
                        .role("MODERADOR")
                        .ativo(true)
                        .isPrimeiroAcesso(false)
                        .build();
                supervisorRepository.save(admin);
            }
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(mat, senha)
            );
        } catch (Exception e) {
            throw new BadCredentialsException("Matrícula ou senha inválidos.");
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(mat);
        Map<String, Object> extraClaims = new HashMap<>();

        Tecnico tecnico = tecnicoRepository.findByMatricula(mat).orElse(null);
        if (tecnico != null) {
            extraClaims.put("id", tecnico.getIdTecnico());
            extraClaims.put("nome", tecnico.getNomeCompleto());
            extraClaims.put("cargo", tecnico.getCargo());
            extraClaims.put("role", tecnico.getRole());
            extraClaims.put("localEquipe", tecnico.getCtBases() != null ? String.join(",", tecnico.getCtBases()) : "");

            String token = jwtService.generateToken(extraClaims, userDetails);
            return AuthResponse.builder()
                    .accessToken(token)
                    .refreshToken(token)
                    .isPrimeiroAcesso(tecnico.getIsPrimeiroAcesso() != null && tecnico.getIsPrimeiroAcesso())
                    .nome(tecnico.getNomeCompleto())
                    .cargo(tecnico.getCargo())
                    .localEquipe(tecnico.getCtBases() != null ? String.join(",", tecnico.getCtBases()) : "")
                    .role(tecnico.getRole())
                    .build();
        }

        Supervisor supervisor = supervisorRepository.findByMatricula(mat).orElse(null);
        if (supervisor != null) {
            extraClaims.put("id", supervisor.getIdSupervisor());
            extraClaims.put("nome", supervisor.getNomeCompleto());
            extraClaims.put("role", supervisor.getRole());

            String token = jwtService.generateToken(extraClaims, userDetails);
            return AuthResponse.builder()
                    .accessToken(token)
                    .refreshToken(token)
                    .isPrimeiroAcesso(supervisor.getIsPrimeiroAcesso() != null && supervisor.getIsPrimeiroAcesso())
                    .nome(supervisor.getNomeCompleto())
                    .cargo("Supervisor de Campo")
                    .role(supervisor.getRole())
                    .build();
        }

        throw new BadCredentialsException("Dados de autenticação inconsistentes.");
    }

    @Transactional
    public void alterarSenha(String matricula, ChangePasswordRequest request) {
        if (request.getNovaSenha() == null || request.getNovaSenha().trim().length() < 4) {
            throw new BusinessException("A nova senha deve ter no mínimo 4 caracteres.");
        }

        Tecnico tecnico = tecnicoRepository.findByMatricula(matricula).orElse(null);
        if (tecnico != null) {
            tecnico.setSenha(passwordEncoder.encode(request.getNovaSenha().trim()));
            tecnico.setIsPrimeiroAcesso(false);
            tecnicoRepository.save(tecnico);
            return;
        }

        Supervisor supervisor = supervisorRepository.findByMatricula(matricula).orElse(null);
        if (supervisor != null) {
            supervisor.setSenha(passwordEncoder.encode(request.getNovaSenha().trim()));
            supervisor.setIsPrimeiroAcesso(false);
            supervisorRepository.save(supervisor);
            return;
        }

        throw new BusinessException("Usuário não localizado para alteração de senha.");
    }

    @Transactional
    public AuthResponse vincularMatricula(VincularMatriculaRequest request) {
        Tecnico tecnico = tecnicoRepository.findById(request.getId())
                .orElseThrow(() -> new BusinessException("Técnico não encontrado."));

        tecnico.setMatricula(request.getMatricula().trim());
        tecnico.setSenha(passwordEncoder.encode(request.getMatricula().trim()));
        tecnico.setIsPrimeiroAcesso(true);
        tecnicoRepository.save(tecnico);

        return login(AuthRequest.builder()
                .matricula(request.getMatricula().trim())
                .senha(request.getMatricula().trim())
                .build());
    }
}
