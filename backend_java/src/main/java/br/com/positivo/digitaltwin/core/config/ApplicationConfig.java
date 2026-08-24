package br.com.positivo.digitaltwin.core.config;

import br.com.positivo.digitaltwin.modules.brilhamais.models.Supervisor;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Tecnico;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.SupervisorRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.TecnicoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;

@Configuration
@RequiredArgsConstructor
public class ApplicationConfig {

    private final TecnicoRepository tecnicoRepository;
    private final SupervisorRepository supervisorRepository;

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            Tecnico tecnico = tecnicoRepository.findByMatricula(username).orElse(null);
            if (tecnico != null) {
                String role = (tecnico.getRole() != null && !tecnico.getRole().trim().isEmpty()) 
                        ? tecnico.getRole().trim().toUpperCase() 
                        : "PADRAO";
                if (!role.startsWith("ROLE_")) {
                    role = "ROLE_" + role;
                }
                return new User(
                        tecnico.getMatricula(),
                        tecnico.getSenha() != null ? tecnico.getSenha() : "",
                        Collections.singletonList(new SimpleGrantedAuthority(role))
                );
            }

            Supervisor supervisor = supervisorRepository.findByMatricula(username).orElse(null);
            if (supervisor != null) {
                String role = (supervisor.getRole() != null && !supervisor.getRole().trim().isEmpty()) 
                        ? supervisor.getRole().trim().toUpperCase() 
                        : "ADMINISTRADOR";
                if (!role.startsWith("ROLE_")) {
                    role = "ROLE_" + role;
                }
                return new User(
                        supervisor.getMatricula(),
                        supervisor.getSenha() != null ? supervisor.getSenha() : "",
                        Collections.singletonList(new SimpleGrantedAuthority(role))
                );
            }

            throw new UsernameNotFoundException("Usuário não encontrado: " + username);
        };
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(userDetailsService());
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
