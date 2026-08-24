package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import br.com.positivo.digitaltwin.modules.brilhamais.models.FaixaPontuacao;
import br.com.positivo.digitaltwin.modules.brilhamais.models.RegraKpi;
import br.com.positivo.digitaltwin.modules.brilhamais.services.ConversorPontuacaoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/regras", "/regras"})
@RequiredArgsConstructor
public class RegrasCampanhaController {

    private final ConversorPontuacaoService conversorPontuacaoService;

    @GetMapping("/kpis")
    public ResponseEntity<List<RegraKpi>> getRegrasKpis() {
        return ResponseEntity.ok(conversorPontuacaoService.getRegrasKpis());
    }

    @GetMapping("/faixas")
    public ResponseEntity<List<FaixaPontuacao>> getFaixasPontuacao() {
        return ResponseEntity.ok(conversorPontuacaoService.getFaixasPontuacao());
    }
}
