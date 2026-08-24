package br.com.positivo.digitaltwin.modules.brilhamais.models;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Entity
@Table(name = "tb_tecnico")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tecnico implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idTecnico;

    @Column(name = "matricula", unique = true, length = 20)
    private String matricula;

    @Column(name = "cpf", unique = true, length = 20)
    private String cpf;

    @Column(name = "nome_completo", nullable = false)
    private String nomeCompleto;

    @Column(name = "primeiro_nome")
    private String primeiroNome;

    @Column(name = "sobrenome")
    private String sobrenome;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "tb_tecnico_base", joinColumns = @JoinColumn(name = "id_tecnico"))
    @Column(name = "ct_codigo")
    private List<String> ctBases;

    @Column(name = "cargo")
    private String cargo;

    @Column(name = "id_supervisor")
    private Integer idSupervisor;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "senha")
    private String senha;

    @Builder.Default
    @Column(name = "ativo")
    private Boolean ativo = true;

    @Builder.Default
    @Column(name = "is_primeiro_acesso")
    private Boolean isPrimeiroAcesso = true;


    @Builder.Default
    @Column(name = "role", length = 20)
    private String role = "PADRAO";

    // Métodos do UserDetails (Spring Security)
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + (this.role != null ? this.role.toUpperCase() : "PADRAO")));
    }

    @Override
    public String getPassword() {
        return this.senha;
    }

    @Override
    public String getUsername() {
        return this.matricula;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return this.ativo != null && this.ativo;
    }
}
