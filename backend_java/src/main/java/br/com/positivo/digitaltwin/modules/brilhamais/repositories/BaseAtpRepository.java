package br.com.positivo.digitaltwin.modules.brilhamais.repositories;

import br.com.positivo.digitaltwin.modules.brilhamais.models.BaseAtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BaseAtpRepository extends JpaRepository<BaseAtp, Integer> {
    
    List<BaseAtp> findByIdSupervisor(Integer idSupervisor);
    List<BaseAtp> findByCtCodigoIn(List<String> ctCodigos);
    java.util.Optional<BaseAtp> findFirstByCtCodigo(String ctCodigo);
}
