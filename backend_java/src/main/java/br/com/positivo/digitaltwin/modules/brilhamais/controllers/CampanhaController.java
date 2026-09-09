package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import br.com.positivo.digitaltwin.modules.brilhamais.models.Campanha;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.CampanhaRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@RestController
@RequestMapping({"/api/v1/campanha", "/campanha"})
@RequiredArgsConstructor
public class CampanhaController {

    private final CampanhaRepository campanhaRepository;
    private final JdbcTemplate jdbcTemplate;

    @Data
    public static class NovaCampanhaRequest {
        private String dataInicio;
        private Integer duracaoMeses;
        private Boolean limparDadosBrutos;
    }

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

    @RequestMapping(value = "/ativa", method = {RequestMethod.PUT, RequestMethod.POST})
    @PreAuthorize("hasAnyRole('ADMIN', 'ADMINISTRADOR', 'MODERADOR')")
    public ResponseEntity<Campanha> atualizarCampanhaAtiva(@RequestBody Campanha campanha) {
        Campanha existente = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
        if (existente == null) {
            return ResponseEntity.notFound().build();
        }
        if (campanha.getDataInicio() != null) {
            existente.setDataInicio(campanha.getDataInicio());
        }
        if (campanha.getDataFim() != null) {
            existente.setDataFim(campanha.getDataFim());
        } else if (campanha.getDuracaoMeses() != null && existente.getDataInicio() != null) {
            existente.setDataFim(existente.getDataInicio().plusMonths(campanha.getDuracaoMeses()).minusDays(1));
        }
        if (campanha.getDuracaoMeses() != null) {
            existente.setDuracaoMeses(campanha.getDuracaoMeses());
        }
        return ResponseEntity.ok(campanhaRepository.save(existente));
    }

    @PostMapping("/nova-campanha")
    @PreAuthorize("hasAnyRole('ADMIN', 'ADMINISTRADOR', 'MODERADOR')")
    @Transactional
    public ResponseEntity<?> iniciarNovaCampanha(@RequestBody NovaCampanhaRequest request) {
        if (request.getDataInicio() == null || request.getDataInicio().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("A data de início é obrigatória.");
        }

        try {
            LocalDate inicio = LocalDate.parse(request.getDataInicio().trim());
            int meses = (request.getDuracaoMeses() != null && request.getDuracaoMeses() > 0) 
                    ? request.getDuracaoMeses() 
                    : 1;
            LocalDate fim = inicio.plusMonths(meses).minusDays(1);

            log.info("Iniciando nova campanha: Início={}, Fim={}, Duração={} meses", inicio, fim, meses);

            // 1. Desativar campanha(s) anterior(es)
            campanhaRepository.findAll().forEach(c -> {
                if (Boolean.TRUE.equals(c.getAtiva())) {
                    c.setAtiva(false);
                    campanhaRepository.save(c);
                }
            });

            // 2. Criar e persistir a nova campanha ativa
            Campanha novaCampanha = Campanha.builder()
                    .dataInicio(inicio)
                    .dataFim(fim)
                    .duracaoMeses(meses)
                    .ativa(true)
                    .build();

            Campanha salva = campanhaRepository.save(novaCampanha);

            // 3. Limpeza opcional de dados brutos operacionais (se solicitado pelo usuário)
            if (Boolean.TRUE.equals(request.getLimparDadosBrutos())) {
                log.info("Limpando dados brutos operacionais para a nova campanha...");
                String[] tables = {"tb_nps", "tb_consumo_peca", "tb_chamado", "pecas", "reincidentes", "chamados"};
                for (String table : tables) {
                    try {
                        jdbcTemplate.execute("TRUNCATE TABLE " + table + " RESTART IDENTITY CASCADE");
                        log.info("Tabela {} limpa com sucesso.", table);
                    } catch (Exception ex) {
                        log.warn("Não foi possível truncar {}: {}. Tentando DELETE...", table, ex.getMessage());
                        try {
                            jdbcTemplate.execute("DELETE FROM " + table);
                            log.info("Tabela {} limpa via DELETE.", table);
                        } catch (Exception delEx) {
                            log.error("Erro ao limpar tabela {}: {}", table, delEx.getMessage());
                        }
                    }
                }
            }

            return ResponseEntity.status(HttpStatus.CREATED).body(salva);

        } catch (Exception e) {
            log.error("Erro ao criar nova campanha: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Erro ao iniciar nova campanha: " + e.getMessage());
        }
    }
}

