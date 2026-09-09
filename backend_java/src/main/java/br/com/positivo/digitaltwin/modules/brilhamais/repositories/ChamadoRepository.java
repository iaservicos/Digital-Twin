package br.com.positivo.digitaltwin.modules.brilhamais.repositories;

import br.com.positivo.digitaltwin.modules.brilhamais.models.Chamado;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChamadoRepository extends JpaRepository<Chamado, Long> {
    
    // Busca todos os chamados finalizados do técnico, utilizando a matrícula
    List<Chamado> findAllByTecnicoMatriculaAndDataFtIsNotNullOrderByDataFtDesc(String matricula);

    @Query(value = "SELECT c.* FROM tb_chamado c WHERE (c.id_tecnico = :idTecnico OR UPPER(TRIM(c.tecnico_nome)) = (SELECT UPPER(TRIM(t.nome_completo)) FROM tb_tecnico t WHERE t.id_tecnico = :idTecnico)) AND c.ft IS NOT NULL AND (cast(:dataInicio as timestamp) IS NULL OR c.ft >= :dataInicio) AND (cast(:dataFim as timestamp) IS NULL OR c.ft <= :dataFim) ORDER BY c.ft DESC",
           countQuery = "SELECT count(c.chamado) FROM tb_chamado c WHERE (c.id_tecnico = :idTecnico OR UPPER(TRIM(c.tecnico_nome)) = (SELECT UPPER(TRIM(t.nome_completo)) FROM tb_tecnico t WHERE t.id_tecnico = :idTecnico)) AND c.ft IS NOT NULL AND (cast(:dataInicio as timestamp) IS NULL OR c.ft >= :dataInicio) AND (cast(:dataFim as timestamp) IS NULL OR c.ft <= :dataFim)",
           nativeQuery = true)
    Page<Chamado> findChamadosPorTecnicoPaginado(@Param("idTecnico") Integer idTecnico, @Param("dataInicio") LocalDateTime dataInicio, @Param("dataFim") LocalDateTime dataFim, Pageable pageable);

    @Query(value = "SELECT c.* FROM tb_chamado c WHERE (c.id_tecnico IN :ids OR UPPER(TRIM(c.tecnico_nome)) IN (SELECT UPPER(TRIM(t.nome_completo)) FROM tb_tecnico t WHERE t.id_tecnico IN :ids)) AND c.ft IS NOT NULL AND c.ft >= :dataInicio AND c.ft <= :dataFim ORDER BY c.ft DESC", nativeQuery = true)
    List<Chamado> findChamadosRecentesPorTecnicos(@Param("ids") List<Integer> ids, @Param("dataInicio") LocalDateTime dataInicio, @Param("dataFim") LocalDateTime dataFim);
}
