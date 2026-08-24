package br.com.positivo.digitaltwin.modules.brilhamais.repositories;

import br.com.positivo.digitaltwin.modules.brilhamais.models.Chamado;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChamadoRepository extends JpaRepository<Chamado, Long> {
    
    // Busca todos os chamados finalizados do técnico, utilizando a matrícula
    List<Chamado> findAllByTecnicoMatriculaAndDataFtIsNotNullOrderByDataFtDesc(String matricula);

    @Query(value = "SELECT c.* FROM chamados c JOIN tb_tecnico t ON UPPER(TRIM(c.tecnico_nome)) LIKE UPPER(TRIM(t.nome_completo)) || '%' WHERE t.id_tecnico = :idTecnico AND c.ft IS NOT NULL AND (cast(:dataInicio as timestamp) IS NULL OR c.ft >= :dataInicio) AND (cast(:dataFim as timestamp) IS NULL OR c.ft <= :dataFim) ORDER BY c.ft DESC",
           countQuery = "SELECT count(c.chamado) FROM chamados c JOIN tb_tecnico t ON UPPER(TRIM(c.tecnico_nome)) LIKE UPPER(TRIM(t.nome_completo)) || '%' WHERE t.id_tecnico = :idTecnico AND c.ft IS NOT NULL AND (cast(:dataInicio as timestamp) IS NULL OR c.ft >= :dataInicio) AND (cast(:dataFim as timestamp) IS NULL OR c.ft <= :dataFim)",
           nativeQuery = true)
    org.springframework.data.domain.Page<Chamado> findChamadosPorTecnicoPaginado(@org.springframework.data.repository.query.Param("idTecnico") Integer idTecnico, @org.springframework.data.repository.query.Param("dataInicio") LocalDateTime dataInicio, @org.springframework.data.repository.query.Param("dataFim") LocalDateTime dataFim, org.springframework.data.domain.Pageable pageable);

    @Query(value = "SELECT c.* FROM chamados c JOIN tb_tecnico t ON UPPER(TRIM(c.tecnico_nome)) LIKE UPPER(TRIM(t.nome_completo)) || '%' WHERE t.id_tecnico IN :ids AND c.ft IS NOT NULL AND c.ft >= :dataInicio AND c.ft <= :dataFim ORDER BY c.ft DESC", nativeQuery = true)
    List<Chamado> findChamadosRecentesPorTecnicos(@org.springframework.data.repository.query.Param("ids") List<Integer> ids, @org.springframework.data.repository.query.Param("dataInicio") LocalDateTime dataInicio, @org.springframework.data.repository.query.Param("dataFim") LocalDateTime dataFim);
}
