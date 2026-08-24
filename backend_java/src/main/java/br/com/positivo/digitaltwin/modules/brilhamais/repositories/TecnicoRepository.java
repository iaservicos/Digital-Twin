package br.com.positivo.digitaltwin.modules.brilhamais.repositories;

import br.com.positivo.digitaltwin.modules.brilhamais.models.Tecnico;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.lang.NonNull;

import java.util.List;
import java.util.Optional;

@Repository
public interface TecnicoRepository extends JpaRepository<Tecnico, Integer> {
    
    @NonNull
    @EntityGraph(attributePaths = {"ctBases"})
    List<Tecnico> findAll();

    @EntityGraph(attributePaths = {"ctBases"})
    Optional<Tecnico> findByMatricula(String matricula);
    
    @EntityGraph(attributePaths = {"ctBases"})
    List<Tecnico> findByIdSupervisor(Integer idSupervisor);
    
    @EntityGraph(attributePaths = {"ctBases"})
    List<Tecnico> findByCtBasesContaining(String ctBase);

    @Query(value = "SELECT t.* FROM tb_tecnico t LEFT JOIN tb_tecnico_base tb ON t.id_tecnico = tb.id_tecnico LEFT JOIN tb_base_atp b ON tb.ct_codigo = b.ct_codigo WHERE t.nome_completo ILIKE concat('%', :nome, '%') AND (b.uf ILIKE :estado OR b.uf IS NULL) LIMIT 1", nativeQuery = true)
    Optional<Tecnico> findByNomeAndEstadoNative(@Param("nome") String nome, @Param("estado") String estado);

    @Query(value = "SELECT CASE WHEN b.cidade IS NOT NULL AND b.cidade <> '' THEN concat(initcap(b.cidade), ' - ', upper(b.uf)) ELSE upper(b.uf) END FROM tb_base_atp b WHERE b.ct_codigo = :ctBase LIMIT 1", nativeQuery = true)
    String findEstadoByCtBase(@Param("ctBase") String ctBase);
}
