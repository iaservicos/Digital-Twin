package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import br.com.positivo.digitaltwin.modules.brilhamais.models.Campanha;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.CampanhaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/campanha", "/campanha"})
@RequiredArgsConstructor
public class CampanhaController {

    private final CampanhaRepository campanhaRepository;

    @GetMapping("/ativa")
    public ResponseEntity<Campanha> getCampanhaAtiva() {
        return campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/todas")
    public ResponseEntity<List<Campanha>> getTodasCampanhas() {
        return ResponseEntity.ok(campanhaRepository.findAll());
    }

    @PutMapping("/ativa")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MODERADOR')")
    public ResponseEntity<Campanha> atualizarCampanhaAtiva(@RequestBody Campanha campanha) {
        Campanha existente = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
        if (existente == null) {
            return ResponseEntity.notFound().build();
        }
        existente.setDataInicio(campanha.getDataInicio());
        existente.setDataFim(campanha.getDataFim());
        existente.setDuracaoMeses(campanha.getDuracaoMeses());
        return ResponseEntity.ok(campanhaRepository.save(existente));
    }
}
