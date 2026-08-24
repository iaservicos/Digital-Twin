package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import br.com.positivo.digitaltwin.core.exceptions.ResourceNotFoundException;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.HistoricoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.RankingDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.ResetSenhaRequest;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.VerificarTecnicoRequest;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.VerificarTecnicoResponse;
import br.com.positivo.digitaltwin.modules.brilhamais.mappers.DashboardMapper;
import br.com.positivo.digitaltwin.modules.brilhamais.models.ApuracaoMensal;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Campanha;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Tecnico;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.ApuracaoMensalRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.CampanhaRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.TecnicoRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/tecnicos")
@RequiredArgsConstructor
public class TecnicoController {

    private final TecnicoRepository tecnicoRepository;
    private final ApuracaoMensalRepository apuracaoRepository;
    private final CampanhaRepository campanhaRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    public ResponseEntity<List<Tecnico>> getTecnicos(
            @RequestParam(name = "idSupervisor", required = false) Integer idSupervisor) {
        if (idSupervisor != null) {
            return ResponseEntity.ok(tecnicoRepository.findByIdSupervisor(idSupervisor));
        }
        return ResponseEntity.ok(tecnicoRepository.findAll());
    }

    @GetMapping("/{identificador}/dashboard")
    public ResponseEntity<RankingDTO> getDashboardTecnico(
            @PathVariable String identificador,
            @RequestParam(name = "mesAno", required = false) String mesAnoStr) {

        Tecnico tecnico;
        if (identificador.matches("\\d+")) {
            try {
                tecnico = tecnicoRepository.findById(Integer.parseInt(identificador)).orElse(null);
            } catch (Exception e) {
                tecnico = null;
            }
            if (tecnico == null) {
                tecnico = tecnicoRepository.findByMatricula(identificador).orElse(null);
            }
        } else {
            tecnico = tecnicoRepository.findByMatricula(identificador).orElse(null);
        }

        if (tecnico == null) {
            throw new ResourceNotFoundException("Técnico não encontrado: " + identificador);
        }

        Campanha campanha = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
        LocalDate dataRef = (mesAnoStr != null) ? LocalDate.parse(mesAnoStr) : 
                (campanha != null && campanha.getDataFim() != null ? campanha.getDataFim() : apuracaoRepository.findMaxMesAno().orElse(LocalDate.now()));

        List<ApuracaoMensal> historicoList;
        if (campanha != null && campanha.getDataInicio() != null && campanha.getDataFim() != null) {
            historicoList = apuracaoRepository.findHistoricoByTecnicoIdsAndDataRange(
                    Collections.singletonList(tecnico.getIdTecnico()), campanha.getDataInicio(), campanha.getDataFim()
            );
        } else {
            historicoList = apuracaoRepository.findHistoricoByTecnicoIds(Collections.singletonList(tecnico.getIdTecnico()));
        }

        List<HistoricoDTO> historico = historicoList.stream()
                .map(h -> DashboardMapper.toHistoricoDTO(h, formatarLabelMes(h.getMesAno())))
                .collect(Collectors.toList());

        ApuracaoMensal apuracaoMes = historicoList.stream()
                .filter(h -> h.getMesAno().equals(dataRef))
                .findFirst()
                .orElse(null);

        RankingDTO dto = DashboardMapper.toRankingDTO(
                apuracaoMes != null ? apuracaoMes : ApuracaoMensal.builder().tecnico(tecnico).mesAno(dataRef).build(),
                1,
                historico
        );

        return ResponseEntity.ok(dto);
    }

    @PostMapping("/verificar")
    public ResponseEntity<VerificarTecnicoResponse> verificarTecnico(@Valid @RequestBody VerificarTecnicoRequest request) {
        String nome = request.getNome() != null ? request.getNome().trim() : "";
        String uf = request.getEstado() != null ? request.getEstado().trim() : "";

        Tecnico tecnico = tecnicoRepository.findByNomeAndEstadoNative(nome, uf).orElse(null);
        if (tecnico == null) {
            throw new ResourceNotFoundException("Nenhum técnico localizado com os dados informados.");
        }

        return ResponseEntity.ok(VerificarTecnicoResponse.builder()
                .id(tecnico.getIdTecnico())
                .nomeCompleto(tecnico.getNomeCompleto())
                .ctBase(tecnico.getCtBases() != null ? String.join(",", tecnico.getCtBases()) : "")
                .build());
    }

    @PutMapping("/{id}/reset-senha")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MODERADOR')")
    public ResponseEntity<Void> resetSenha(@PathVariable Integer id, @RequestBody(required = false) ResetSenhaRequest req) {
        Tecnico tecnico = tecnicoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Técnico não encontrado."));

        String novaSenha = (req != null && req.getNovaSenha() != null && !req.getNovaSenha().isBlank()) ? 
                req.getNovaSenha() : tecnico.getMatricula();

        tecnico.setSenha(passwordEncoder.encode(novaSenha));
        tecnico.setIsPrimeiroAcesso(true);
        tecnicoRepository.save(tecnico);
        return ResponseEntity.ok().build();
    }

    private String formatarLabelMes(LocalDate mesAno) {
        if (mesAno == null) return "Mês";
        if (mesAno.getDayOfMonth() > 27) return "Média Final";
        return String.format("%02d/%d", mesAno.getMonthValue(), mesAno.getYear());
    }
}
