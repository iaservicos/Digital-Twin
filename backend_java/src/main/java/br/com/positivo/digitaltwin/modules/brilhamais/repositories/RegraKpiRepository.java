package br.com.positivo.digitaltwin.modules.brilhamais.repositories;

import br.com.positivo.digitaltwin.modules.brilhamais.models.RegraKpi;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RegraKpiRepository extends JpaRepository<RegraKpi, Integer> {
    Optional<RegraKpi> findByNomeIndicador(String nomeIndicador);
}
