package br.com.positivo.digitaltwin.modules.brilhamais.repositories;

import br.com.positivo.digitaltwin.modules.brilhamais.models.Supervisor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SupervisorRepository extends JpaRepository<Supervisor, Integer> {
    Optional<Supervisor> findByMatricula(String matricula);
    Optional<Supervisor> findByNomeCompleto(String nomeCompleto);
}
