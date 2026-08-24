package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import br.com.positivo.digitaltwin.modules.brilhamais.models.ApuracaoMensal;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Campanha;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Tecnico;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.ApuracaoMensalRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.CampanhaRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.TecnicoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/equipes")
@RequiredArgsConstructor
public class EquipeController {

    private final ApuracaoMensalRepository apuracaoRepository;
    private final CampanhaRepository campanhaRepository;
    private final TecnicoRepository tecnicoRepository;

    @GetMapping("/{ctCodigo}/metricas")
    public ResponseEntity<Map<String, Object>> getMetricasEquipe(
            @PathVariable String ctCodigo,
            @RequestParam(name = "mesAno", required = false) String mesAnoStr) {
        
        Campanha campanha = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
        LocalDate mesAno = (mesAnoStr != null) ? LocalDate.parse(mesAnoStr) : 
                (campanha != null && campanha.getDataFim() != null ? campanha.getDataFim() : apuracaoRepository.findMaxMesAno().orElse(LocalDate.now()));

        List<Tecnico> tecnicosBase = tecnicoRepository.findByCtBasesContaining(ctCodigo);
        List<Integer> ids = tecnicosBase.stream().map(Tecnico::getIdTecnico).collect(Collectors.toList());

        List<ApuracaoMensal> apuracoes = apuracaoRepository.findHistoricoByTecnicoIdsAndDataRange(ids, mesAno, mesAno);

        double mediaSla = apuracoes.stream().mapToDouble(a -> a.getAtingimentoSla() != null ? a.getAtingimentoSla().doubleValue() * 100 : 0).average().orElse(0.0);
        int totalChamados = apuracoes.stream().mapToInt(a -> a.getTotalChamados() != null ? a.getTotalChamados() : 0).sum();

        Map<String, Object> resp = new HashMap<>();
        resp.put("ctCodigo", ctCodigo);
        resp.put("mesAno", mesAno);
        resp.put("totalTecnicos", tecnicosBase.size());
        resp.put("totalChamados", totalChamados);
        resp.put("mediaSla", Math.round(mediaSla * 100.0) / 100.0);

        return ResponseEntity.ok(resp);
    }
}
