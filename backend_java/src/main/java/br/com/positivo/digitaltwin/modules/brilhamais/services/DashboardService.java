package br.com.positivo.digitaltwin.modules.brilhamais.services;

import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChamadoResumoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.HistoricoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.RankingDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.mappers.DashboardMapper;
import br.com.positivo.digitaltwin.modules.brilhamais.models.ApuracaoMensal;
import br.com.positivo.digitaltwin.modules.brilhamais.models.BaseAtp;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Campanha;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Chamado;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.ApuracaoMensalRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.BaseAtpRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.CampanhaRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.ChamadoRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.TecnicoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private final ApuracaoMensalRepository apuracaoRepository;
    private final CampanhaRepository campanhaRepository;
    private final ChamadoRepository chamadoRepository;
    private final TecnicoRepository tecnicoRepository;
    private final BaseAtpRepository baseAtpRepository;
    private final JdbcTemplate jdbcTemplate;

    public List<RankingDTO> getRankingMensal(LocalDate mesAno) {
        List<ApuracaoMensal> apuracoes = apuracaoRepository.findRankingByMesAno(mesAno);
        if (apuracoes.isEmpty()) {
            return Collections.emptyList();
        }

        List<Integer> tecnicoIds = apuracoes.stream()
                .map(a -> a.getTecnico().getIdTecnico())
                .collect(Collectors.toList());

        Campanha campanhaAtiva = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
        Map<Integer, List<ApuracaoMensal>> historicoPorTecnico;

        if (campanhaAtiva != null && campanhaAtiva.getDataInicio() != null && campanhaAtiva.getDataFim() != null) {
            historicoPorTecnico = apuracaoRepository.findHistoricoByTecnicoIdsAndDataRange(
                    tecnicoIds, campanhaAtiva.getDataInicio(), campanhaAtiva.getDataFim()
            ).stream().collect(Collectors.groupingBy(h -> h.getTecnico().getIdTecnico()));
        } else {
            historicoPorTecnico = apuracaoRepository.findHistoricoByTecnicoIds(tecnicoIds)
                    .stream().collect(Collectors.groupingBy(h -> h.getTecnico().getIdTecnico()));
        }

        Map<String, String> cidadePorCt = new HashMap<>();
        try {
            List<BaseAtp> todasBases = baseAtpRepository.findAll();
            for (BaseAtp b : todasBases) {
                if (b.getCtCodigo() != null && !cidadePorCt.containsKey(b.getCtCodigo())) {
                    String cidade = b.getCidade() != null ? b.getCidade().trim() : "";
                    String uf = b.getUf() != null ? b.getUf().trim() : "";
                    if (!cidade.isEmpty() && !uf.isEmpty()) {
                        cidadePorCt.put(b.getCtCodigo(), cidade + "/" + uf);
                    } else if (!cidade.isEmpty()) {
                        cidadePorCt.put(b.getCtCodigo(), cidade);
                    } else if (b.getNomeAtp() != null) {
                        cidadePorCt.put(b.getCtCodigo(), b.getNomeAtp());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Erro ao carregar bases para lookup", e);
        }

        List<RankingDTO> ranking = new ArrayList<>(apuracoes.size());
        int posicao = 1;

        for (ApuracaoMensal apuracao : apuracoes) {
            int idTecnico = apuracao.getTecnico().getIdTecnico();
            List<ApuracaoMensal> historicoApuracao = historicoPorTecnico.getOrDefault(idTecnico, Collections.emptyList());

            List<HistoricoDTO> historico = historicoApuracao.stream()
                    .map(h -> DashboardMapper.toHistoricoDTO(h, formatarLabelMes(h.getMesAno())))
                    .collect(Collectors.toList());

            RankingDTO rDto = DashboardMapper.toRankingDTO(apuracao, posicao++, historico);

            List<String> ctList = apuracao.getTecnico().getCtBases();
            if (ctList != null && !ctList.isEmpty()) {
                String resolved = ctList.stream()
                        .map(ct -> cidadePorCt.getOrDefault(ct, ct))
                        .collect(Collectors.joining(","));
                rDto.setLocalEquipe(resolved);
            }

            ranking.add(rDto);
        }

        return ranking;
    }

    public Page<ChamadoResumoDTO> getChamadosPaginados(Integer idTecnico, LocalDate dataInicio, LocalDate dataFim, Pageable pageable) {
        LocalDateTime inicio = dataInicio != null ? dataInicio.atStartOfDay() : null;
        LocalDateTime fim = dataFim != null ? dataFim.atTime(23, 59, 59, 999999999) : null;

        Page<Chamado> chamadosPage = chamadoRepository.findChamadosPorTecnicoPaginado(idTecnico, inicio, fim, pageable);
        if (chamadosPage.isEmpty()) {
            return new PageImpl<>(Collections.emptyList(), pageable, 0);
        }

        List<Long> chamadosIds = chamadosPage.getContent().stream()
                .map(Chamado::getNumeroChamado)
                .collect(Collectors.toList());

        Map<Long, Map<String, String>> detalhesChamado = fetchPecasETextosChamados(chamadosIds);

        List<ChamadoResumoDTO> dtos = chamadosPage.getContent().stream()
                .map(c -> DashboardMapper.toChamadoResumoDTO(c, detalhesChamado.get(c.getNumeroChamado())))
                .collect(Collectors.toList());

        return new PageImpl<>(dtos, pageable, chamadosPage.getTotalElements());
    }

    private Map<Long, Map<String, String>> fetchPecasETextosChamados(List<Long> chamadosIds) {
        if (chamadosIds.isEmpty()) return Collections.emptyMap();

        String inClause = chamadosIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        Map<Long, Map<String, String>> resultado = new HashMap<>();

        try {
            String sqlPecas = "SELECT chamado, string_agg(DISTINCT grupo_mercadoria_desc, ', ') as pecas " +
                              "FROM pecas WHERE chamado IN (" + inClause + ") GROUP BY chamado";
            jdbcTemplate.query(sqlPecas, rs -> {
                long ch = rs.getLong("chamado");
                resultado.computeIfAbsent(ch, k -> new HashMap<>()).put("pecas", rs.getString("pecas"));
            });
        } catch (Exception e) {
            log.warn("Aviso ao buscar peças vinculadas aos chamados: {}", e.getMessage());
        }

        return resultado;
    }

    private String formatarLabelMes(LocalDate mesAno) {
        if (mesAno == null) return "Mês";
        if (mesAno.getDayOfMonth() > 27) return "Média Final";
        String mesNome = mesAno.getMonth().getDisplayName(TextStyle.FULL, new Locale("pt", "BR"));
        return mesNome.substring(0, 1).toUpperCase() + mesNome.substring(1);
    }
}
