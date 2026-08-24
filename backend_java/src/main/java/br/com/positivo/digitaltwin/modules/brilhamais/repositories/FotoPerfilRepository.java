package br.com.positivo.digitaltwin.modules.brilhamais.repositories;

import br.com.positivo.digitaltwin.modules.brilhamais.models.FotoPerfil;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Tecnico;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FotoPerfilRepository extends JpaRepository<FotoPerfil, Integer> {
    Optional<FotoPerfil> findByTecnico(Tecnico tecnico);
    Optional<FotoPerfil> findByTecnicoMatricula(String matricula);
}
