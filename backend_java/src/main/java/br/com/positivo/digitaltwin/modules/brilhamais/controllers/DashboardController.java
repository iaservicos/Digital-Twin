package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChamadoResumoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChamadoReincidenteDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChamadoSlaPerdidoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.RankingDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Campanha;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.ApuracaoMensalRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.CampanhaRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.services.DashboardService;
import br.com.positivo.digitaltwin.modules.brilhamais.services.MotorCalculoService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/v1/dashboard", "/dashboard"})
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final MotorCalculoService motorCalculoService;
    private final CampanhaRepository campanhaRepository;
    private final ApuracaoMensalRepository apuracaoRepository;

    @GetMapping("/version")
    public ResponseEntity<Map<String, String>> getVersion() {
        Map<String, String> info = new HashMap<>();
        info.put("version", "v4-digitaltwin-modulith");
        info.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(info);
    }

    @GetMapping("/ranking")
    public ResponseEntity<List<RankingDTO>> getRanking(
            @RequestParam(name = "mesAno", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate mesAno) {
        Campanha campanha = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);

        if (mesAno == null) {
            if (campanha != null && campanha.getDataFim() != null) {
                // 1. Tenta buscar o ranking da data final consolidada da campanha (se já houver com dados)
                List<RankingDTO> rankingConsolidado = dashboardService.getRankingMensal(campanha.getDataFim());
                if (rankingConsolidado != null && !rankingConsolidado.isEmpty() && 
                    rankingConsolidado.stream().anyMatch(r -> r.getQuantidadeProdutividade() != null && r.getQuantidadeProdutividade() > 0)) {
                    return ResponseEntity.ok(rankingConsolidado);
                }

                // 2. Se a campanha estiver em andamento (mês seguinte ainda sem chamados),
                // busca o mês mais recente da campanha ativa que efetivamente possui atendimentos
                LocalDate mesValido = apuracaoRepository.findMaxMesAnoComChamados(campanha.getDataInicio(), campanha.getDataFim()).orElse(null);
                if (mesValido != null) {
                    List<RankingDTO> rankingMes = dashboardService.getRankingMensal(mesValido);
                    if (rankingMes != null && !rankingMes.isEmpty()) {
                        return ResponseEntity.ok(rankingMes);
                    }
                }
            }

            // 3. Fallback geral
            mesAno = apuracaoRepository.findMaxMesAno().orElse(LocalDate.now().withDayOfMonth(1));
        }

        List<RankingDTO> ranking = dashboardService.getRankingMensal(mesAno);
        return ResponseEntity.ok(ranking);
    }

    @GetMapping("/calcular/status")
    public ResponseEntity<MotorCalculoService.CalculoTracker> getCalculateStatus() {
        return ResponseEntity.ok(MotorCalculoService.getTracker());
    }

    @PostMapping("/calcular")
    public ResponseEntity<String> forceCalculate(
            @RequestParam(name = "mesAno", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate mesAno) {
        motorCalculoService.calcularEProcessarMes(mesAno);
        return ResponseEntity.ok("Solicitação de recálculo disparada com sucesso para o motor DataIngest.");
    }

    @PostMapping("/calcular-tecnico")
    public ResponseEntity<String> forceCalculateTecnico(
            @RequestParam(name = "matricula") String matricula) {
        motorCalculoService.calcularEProcessarTecnico(matricula);
        return ResponseEntity.ok("Recálculo individual disparado para a matrícula " + matricula);
    }

    @GetMapping("/tecnico/{id}/reincidentes")
    public ResponseEntity<List<ChamadoReincidenteDTO>> getReincidentesTecnico(
            @PathVariable("id") Integer id,
            @RequestParam(name = "mesAno", required = false) String mesAno) {
        return ResponseEntity.ok(dashboardService.getReincidentesTecnico(id, mesAno));
    }

    @GetMapping("/tecnico/{id}/chamados")
    public ResponseEntity<Page<ChamadoResumoDTO>> getChamadosTecnico(
            @PathVariable("id") Integer id,
            @RequestParam(name = "dataInicio", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(name = "dataFim", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            Pageable pageable) {
        return ResponseEntity.ok(dashboardService.getChamadosPaginados(id, dataInicio, dataFim, pageable));
    }


    @GetMapping("/tecnico/{id}/sla-perdidos")
    public ResponseEntity<List<ChamadoSlaPerdidoDTO>> getChamadosSlaPerdidos(
            @PathVariable("id") Integer id,
            @RequestParam(name = "mesAno", required = false) String mesAno) {
        return ResponseEntity.ok(dashboardService.getChamadosSlaPerdidos(id, mesAno));
    }

    @GetMapping("/tecnico/{idTecnico}/perdas")
    public ResponseEntity<List<ChamadoSlaPerdidoDTO>> getChamadosPerdas(
            @PathVariable("idTecnico") Integer idTecnico,
            @RequestParam(name = "mesAno", required = false) String mesAno) {
        return ResponseEntity.ok(dashboardService.getChamadosPerdas(idTecnico, mesAno));
    }

    @GetMapping("/tecnico/{id}/pecas")
    public ResponseEntity<List<br.com.positivo.digitaltwin.modules.brilhamais.dto.PecaAplicadaDTO>> getChamadosPecas(
            @PathVariable("id") Integer id,
            @RequestParam(name = "mesAno", required = false) String mesAno) {
        return ResponseEntity.ok(dashboardService.getChamadosPecas(id, mesAno));
    }
}
