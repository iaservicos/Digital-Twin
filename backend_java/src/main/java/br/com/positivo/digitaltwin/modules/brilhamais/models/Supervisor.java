package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

@Entity
@Table(name = "tb_supervisor")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Supervisor implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_supervisor")
    private Integer idSupervisor;

    @Column(name = "matricula", unique = true)
    private String matricula;

    @Column(name = "nome_completo", nullable = false)
    private String nomeCompleto;

    @Column(name = "primeiro_nome")
    private String primeiroNome;

    @Column(name = "sobrenome")
    private String sobrenome;

    @Column(name = "senha")
    private String senha;

    @Column(name = "email")
    private String email;

    @Column(name = "id_coordenador")
    private Integer idCoordenador;

    @Column(name = "role")
    @Builder.Default
    private String role = "ADMINISTRADOR";

    @Column(name = "ativo")
    @Builder.Default
    private Boolean ativo = true;

    @Column(name = "is_primeiro_acesso")
    @Builder.Default
    private Boolean isPrimeiroAcesso = true;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getPassword() {
        return senha;
    }

    @Override
    public String getUsername() {
        return matricula;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return ativo != null ? ativo : true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return ativo != null ? ativo : true;
    }
}
