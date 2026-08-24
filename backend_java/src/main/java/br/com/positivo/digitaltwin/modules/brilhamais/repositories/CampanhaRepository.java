package br.com.positivo.digitaltwin.modules.brilhamais.repositories;

import br.com.positivo.digitaltwin.modules.brilhamais.models.Campanha;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CampanhaRepository extends JpaRepository<Campanha, Integer> {
    
    Optional<Campanha> findFirstByAtivaTrueOrderByIdCampanhaDesc();
    
}
