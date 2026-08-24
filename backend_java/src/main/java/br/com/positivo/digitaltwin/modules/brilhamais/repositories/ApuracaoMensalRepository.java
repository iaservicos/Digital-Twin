package br.com.positivo.digitaltwin.modules.brilhamais.repositories;

import br.com.positivo.digitaltwin.modules.brilhamais.models.ApuracaoMensal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ApuracaoMensalRepository extends JpaRepository<ApuracaoMensal, Integer> {
    Optional<ApuracaoMensal> findFirstByTecnicoIdTecnicoAndMesAno(Integer idTecnico, LocalDate mesAno);
    
    List<ApuracaoMensal> findByTecnicoIdTecnicoAndMesAnoBetween(Integer idTecnico, LocalDate dataInicio, LocalDate dataFim);
    
    @Query("SELECT a FROM ApuracaoMensal a JOIN FETCH a.tecnico t LEFT JOIN FETCH t.ctBases WHERE a.mesAno = :mesAno ORDER BY a.pontuacaoTotal DESC")
    List<ApuracaoMensal> findRankingByMesAno(@Param("mesAno") LocalDate mesAno);
    
    @Query("SELECT a FROM ApuracaoMensal a JOIN FETCH a.tecnico t LEFT JOIN FETCH t.ctBases WHERE a.mesAno = :mesAno AND t.idSupervisor = :idSupervisor ORDER BY a.pontuacaoTotal DESC")
    List<ApuracaoMensal> findRankingByMesAnoAndIdSupervisor(@Param("mesAno") LocalDate mesAno, @Param("idSupervisor") Integer idSupervisor);

    @Query("SELECT a FROM ApuracaoMensal a JOIN FETCH a.tecnico t LEFT JOIN FETCH t.ctBases WHERE a.tecnico.idTecnico = :idTecnico ORDER BY a.mesAno ASC")
    List<ApuracaoMensal> findHistoricoByTecnicoId(Integer idTecnico);

    @Query("SELECT a FROM ApuracaoMensal a JOIN FETCH a.tecnico t LEFT JOIN FETCH t.ctBases WHERE t.idTecnico IN :ids ORDER BY a.mesAno ASC")
    List<ApuracaoMensal> findHistoricoByTecnicoIds(@Param("ids") List<Integer> ids);

    @Query("SELECT a FROM ApuracaoMensal a JOIN FETCH a.tecnico t LEFT JOIN FETCH t.ctBases WHERE t.idTecnico IN :ids AND a.mesAno BETWEEN :dataInicio AND :dataFim ORDER BY a.mesAno ASC")
    List<ApuracaoMensal> findHistoricoByTecnicoIdsAndDataRange(
        @Param("ids") List<Integer> ids,
        @Param("dataInicio") LocalDate dataInicio,
        @Param("dataFim") LocalDate dataFim
    );

    @Query("SELECT MAX(a.mesAno) FROM ApuracaoMensal a")
    Optional<LocalDate> findMaxMesAno();
}
