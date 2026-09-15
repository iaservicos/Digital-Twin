package br.com.positivo.digitaltwin.modules.brilhamais.services;

import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChamadoResumoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChamadoReincidenteDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChamadoSlaPerdidoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.ChamadosSemTecnicoDTO;
import br.com.positivo.digitaltwin.modules.brilhamais.dto.PecaAplicadaDTO;
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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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

                String inClause = chamadosIds.stream().map(id -> "'" + id + "'").collect(Collectors.joining(","));
        Map<Long, Map<String, String>> resultado = new HashMap<>();

        try {
            String sqlPecas = "SELECT chamado, string_agg(DISTINCT COALESCE(cod_aplic_desc, cod_solic_desc), ', ') as pecas " +
                              "FROM pecas WHERE chamado IN (" + inClause + ") GROUP BY chamado";
            jdbcTemplate.query(sqlPecas, rs -> {
                String chStr = rs.getString("chamado");
                if (chStr != null && chStr.matches("\\d+")) {
                    long ch = Long.parseLong(chStr);
                    resultado.computeIfAbsent(ch, k -> new HashMap<>()).put("pecas", rs.getString("pecas"));
                }
            });
        } catch (Exception e) {
            log.warn("Aviso ao buscar peças vinculadas aos chamados: {}", e.getMessage());
        }

        return resultado;
    }

    public List<ChamadoReincidenteDTO> getReincidentesTecnico(Integer idTecnico, String mesAnoStr) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isSupervisorOrAdmin = auth != null && auth.getAuthorities().stream().anyMatch(a -> {
            String name = a.getAuthority().toUpperCase();
            return name.contains("SUPERVISOR") || name.contains("MODERADOR") || name.contains("ADMIN");
        });

        StringBuilder sql = new StringBuilder("""
            SELECT 
                r.chamado_anterior,
                r.chamado_rrc,
                r.ft_anterior,
                r.ft_rrc,
                CASE 
                    WHEN r.ft_rrc IS NOT NULL AND r.ft_anterior IS NOT NULL 
                    THEN EXTRACT(DAY FROM (r.ft_rrc - r.ft_anterior))::bigint 
                    ELSE NULL 
                END AS dias_entre,
                CASE 
                    WHEN r.ft_rrc IS NOT NULL AND r.ft_anterior IS NOT NULL 
                    THEN ROUND(EXTRACT(EPOCH FROM (r.ft_rrc - r.ft_anterior)) / 3600)::bigint 
                    ELSE NULL 
                END AS horas_entre,
                r.tecnico_nome_anterior,
                r.tecnico_nome_rrc,
                COALESCE((SELECT b.cidade FROM tb_base_atp b WHERE b.ct_codigo = r.ct_anterior LIMIT 1), r.ct_anterior) AS ct_anterior,
                COALESCE((SELECT b.cidade FROM tb_base_atp b WHERE b.ct_codigo = r.ct_rrc LIMIT 1), r.ct_rrc) AS ct_rrc,
                r.projeto_anterior,
                r.projeto_rrc,
                COALESCE(
                    (SELECT CASE 
                        WHEN UPPER(s.segmento) LIKE '%GOV%' THEN 'Governo'
                        WHEN UPPER(s.segmento) LIKE '%CORP%' THEN 'Corporativo'
                        ELSE s.segmento 
                     END 
                     FROM tb_encerrados_rrc s 
                     WHERE s.chamado = r.chamado_anterior LIMIT 1),
                    (SELECT CASE 
                        WHEN UPPER(c.comercial) LIKE '%GOV%' THEN 'Governo'
                        WHEN UPPER(c.comercial) LIKE '%CORP%' THEN 'Corporativo'
                        ELSE c.comercial 
                     END 
                     FROM tb_chamado c 
                     WHERE c.chamado::text = r.chamado_anterior LIMIT 1),
                    CASE 
                        WHEN r.projeto_anterior LIKE 'H3-%' OR r.projeto_anterior LIKE '%GOV%' THEN 'Governo'
                        WHEN r.segmento_rrc LIKE '%GOV%' THEN 'Governo'
                        ELSE 'Corporativo'
                    END
                ) AS segmento_anterior,
                COALESCE(
                    CASE 
                        WHEN UPPER(r.segmento_rrc) LIKE '%GOV%' THEN 'Governo'
                        WHEN UPPER(r.segmento_rrc) LIKE '%CORP%' THEN 'Corporativo'
                        ELSE NULL 
                    END,
                    (SELECT CASE 
                        WHEN UPPER(s.segmento) LIKE '%GOV%' THEN 'Governo'
                        WHEN UPPER(s.segmento) LIKE '%CORP%' THEN 'Corporativo'
                        ELSE s.segmento 
                     END 
                     FROM tb_encerrados_rrc s 
                     WHERE s.chamado = r.chamado_rrc LIMIT 1),
                    (SELECT CASE 
                        WHEN UPPER(c.comercial) LIKE '%GOV%' THEN 'Governo'
                        WHEN UPPER(c.comercial) LIKE '%CORP%' THEN 'Corporativo'
                        ELSE c.comercial 
                     END 
                     FROM tb_chamado c 
                     WHERE c.chamado::text = r.chamado_rrc LIMIT 1),
                    CASE 
                        WHEN r.projeto_rrc LIKE 'H3-%' OR r.projeto_rrc LIKE '%GOV%' THEN 'Governo'
                        WHEN r.projeto_anterior LIKE 'H3-%' OR r.projeto_anterior LIKE '%GOV%' THEN 'Governo'
                        ELSE 'Corporativo'
                    END
                ) AS segmento_rrc,
                r.defeito_anterior,
                r.ocorrencia_chamado_anterior,
                r.texto_encerrado_anterior,
                r.aplicado_peca_anterior,
                r.defeito_rrc,
                r.ocorrencia_chamado_rrc,
                r.texto_encerrado_rrc,
                r.aplicado_peca_rrc,
                (SELECT STRING_AGG(DISTINCT TRIM(p.subgrupo), ' | ') 
                 FROM tb_consumo_peca p 
                 WHERE p.chamado::text = r.chamado_anterior AND p.subgrupo IS NOT NULL) AS subgrupo_anterior,
                (SELECT STRING_AGG(DISTINCT TRIM(p.subgrupo), ' | ') 
                 FROM tb_consumo_peca p 
                 WHERE p.chamado::text = r.chamado_rrc AND p.subgrupo IS NOT NULL) AS subgrupo_rrc,
                COALESCE(
                    (SELECT STRING_AGG(DISTINCT 
                        CASE 
                            WHEN p.subgrupo IS NOT NULL AND p.codigo_aplicado_desc IS NOT NULL 
                            THEN CONCAT(TRIM(p.subgrupo), ' - ', TRIM(p.codigo_aplicado_desc))
                            WHEN p.subgrupo IS NOT NULL 
                            THEN TRIM(p.subgrupo)
                            ELSE TRIM(p.codigo_aplicado_desc)
                        END, ' | ') 
                     FROM tb_consumo_peca p 
                     WHERE p.chamado::text = r.chamado_anterior 
                       AND (p.subgrupo IS NOT NULL OR p.codigo_aplicado_desc IS NOT NULL)),
                    (SELECT STRING_AGG(DISTINCT p.cod_aplic_desc, ' | ') 
                     FROM pecas p 
                     WHERE p.chamado = r.chamado_anterior AND p.cod_aplic_desc IS NOT NULL),
                    CASE 
                        WHEN r.trocou_plm_anterior = 'Sim' THEN 'PLACA MÃE (PLM)' 
                        WHEN r.aplicado_peca_anterior = 'Sim' THEN 'PEÇA APLICADA (Ver laudo)'
                        ELSE 'Nenhuma peça aplicada' 
                    END
                ) AS peca_nome_anterior,
                COALESCE(
                    (SELECT STRING_AGG(DISTINCT 
                        CASE 
                            WHEN p.subgrupo IS NOT NULL AND p.codigo_aplicado_desc IS NOT NULL 
                            THEN CONCAT(TRIM(p.subgrupo), ' - ', TRIM(p.codigo_aplicado_desc))
                            WHEN p.subgrupo IS NOT NULL 
                            THEN TRIM(p.subgrupo)
                            ELSE TRIM(p.codigo_aplicado_desc)
                        END, ' | ') 
                     FROM tb_consumo_peca p 
                     WHERE p.chamado::text = r.chamado_rrc 
                       AND (p.subgrupo IS NOT NULL OR p.codigo_aplicado_desc IS NOT NULL)),
                    (SELECT STRING_AGG(DISTINCT p.cod_aplic_desc, ' | ') 
                     FROM pecas p 
                     WHERE p.chamado = r.chamado_rrc AND p.cod_aplic_desc IS NOT NULL),
                    CASE 
                        WHEN r.trocou_plm_rrc = 'Sim' THEN 'PLACA MÃE (PLM)' 
                        WHEN r.aplicado_peca_rrc = 'Sim' THEN COALESCE(r.material_descricao_rrc, 'PEÇA APLICADA (Ver laudo)')
                        ELSE 'Nenhuma peça aplicada' 
                    END
                ) AS peca_nome_rrc
            FROM reincidentes r
        """);

        List<Object> params = new ArrayList<>();

        String nomeTecnico = null;
        try {
            nomeTecnico = jdbcTemplate.queryForObject(
                "SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = ?", String.class, idTecnico);
        } catch (Exception e) {
            // fallback caso não encontre
        }
        if (nomeTecnico != null) {
            sql.append(" WHERE (r.tecnico_nome_anterior = ? OR UPPER(TRIM(r.tecnico_nome_anterior)) = UPPER(TRIM(?)))");
            params.add(nomeTecnico);
            params.add(nomeTecnico);
        } else {
            sql.append(" WHERE 1=0");
        }

        String mesFiltro = mesAnoStr != null ? mesAnoStr.trim().toLowerCase() : "";

        if (mesFiltro.contains("jul") || mesFiltro.contains("2026-07") || "7".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(r.ft_rrc, 'YYYY-MM') = '2026-07'");
        } else if (mesFiltro.contains("ago") || mesFiltro.contains("2026-08") || "8".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(r.ft_rrc, 'YYYY-MM') = '2026-08'");
        } else {
            // Campanha Inteira / Média Final: filtra todo o intervalo da campanha ativa
            Campanha camp = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
            if (camp != null && camp.getDataInicio() != null && camp.getDataFim() != null) {
                sql.append(" AND r.ft_rrc >= ? AND r.ft_rrc <= ?");
                params.add(camp.getDataInicio().atStartOfDay());
                params.add(camp.getDataFim().atTime(23, 59, 59));
            }
        }

        sql.append(" ORDER BY r.ft_rrc DESC");

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new ChamadoReincidenteDTO(
                rs.getString("chamado_anterior"),
                rs.getString("chamado_rrc"),
                rs.getTimestamp("ft_anterior") != null ? rs.getTimestamp("ft_anterior").toLocalDateTime() : null,
                rs.getTimestamp("ft_rrc") != null ? rs.getTimestamp("ft_rrc").toLocalDateTime() : null,
                rs.getObject("dias_entre") != null ? rs.getLong("dias_entre") : null,
                rs.getString("tecnico_nome_anterior"),
                rs.getString("tecnico_nome_rrc"),
                rs.getString("ct_anterior"),
                rs.getString("ct_rrc"),
                rs.getString("projeto_anterior"),
                rs.getString("projeto_rrc"),
                rs.getString("defeito_anterior"),
                rs.getString("ocorrencia_chamado_anterior"),
                rs.getString("texto_encerrado_anterior"),
                rs.getString("aplicado_peca_anterior"),
                rs.getString("defeito_rrc"),
                rs.getString("ocorrencia_chamado_rrc"),
                rs.getString("texto_encerrado_rrc"),
                rs.getString("aplicado_peca_rrc"),
                rs.getString("peca_nome_anterior"),
                rs.getString("peca_nome_rrc"),
                rs.getObject("horas_entre") != null ? rs.getLong("horas_entre") : null,
                rs.getString("segmento_anterior"),
                rs.getString("segmento_rrc"),
                rs.getString("subgrupo_anterior"),
                rs.getString("subgrupo_rrc")
        ), params.toArray());
    }

    private String formatarLabelMes(LocalDate mesAno) {
        if (mesAno == null) return "Mês";
        if (mesAno.getDayOfMonth() > 27) return "Média Final";
        String mesNome = mesAno.getMonth().getDisplayName(TextStyle.FULL, new Locale("pt", "BR"));
        return mesNome.substring(0, 1).toUpperCase() + mesNome.substring(1);
    }


    public List<ChamadoSlaPerdidoDTO> getChamadosSlaPerdidos(Integer idTecnico, String mesAnoStr) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isSupervisorOrAdmin = auth != null && auth.getAuthorities().stream().anyMatch(a -> {
            String name = a.getAuthority().toUpperCase();
            return name.contains("SUPERVISOR") || name.contains("MODERADOR") || name.contains("ADMIN");
        });

        StringBuilder sql = new StringBuilder("""
            SELECT 
                c.chamado,
                c.ft,
                c.tecnico_nome,
                c.assistencia_centro_trabalho AS ct,
                COALESCE(
                    (SELECT b.cidade FROM tb_base_atp b WHERE b.ct_codigo = c.assistencia_centro_trabalho AND b.cidade IS NOT NULL LIMIT 1),
                    c.assistencia_nome,
                    c.assistencia_centro_trabalho
                ) AS assistencia_nome,
                c.equipamento,
                CASE 
                    WHEN ch.gp_segmento = 'GOV' OR ch.gp_desc LIKE '%GOVERNO%' OR c.projeto LIKE 'H3-%' THEN 'Governo'
                    ELSE 'Corporativo'
                END AS projeto,
                c.sla_status,
                COALESCE(NULLIF(TRIM(c.classifica_chamado), ''), 'FORA DO SLA') AS causa_perda,
                c.texto_encerrado
            FROM tb_chamado c
            JOIN tb_tecnico_base tb ON tb.ct_codigo = c.assistencia_centro_trabalho
            JOIN tb_tecnico t ON t.id_tecnico = tb.id_tecnico
            LEFT JOIN chamados ch ON ch.chamado = c.chamado::text
            WHERE tb.id_tecnico = ?
              AND UPPER(TRIM(c.sla_status)) = 'FORA'
        """);

        List<Object> params = new ArrayList<>();
        params.add(idTecnico);

        if (!isSupervisorOrAdmin) {
            sql.append(" AND (UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(t.nome_completo)) OR TRANSLATE(UPPER(TRIM(c.tecnico_nome)), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC') = TRANSLATE(UPPER(TRIM(t.nome_completo)), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC'))");
        }

        String mesFiltro = mesAnoStr != null ? mesAnoStr.trim().toLowerCase() : "";

        if (mesFiltro.contains("jul") || mesFiltro.contains("2026-07") || "7".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-07'");
        } else if (mesFiltro.contains("ago") || mesFiltro.contains("2026-08") || "8".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-08'");
        } else {
            Campanha camp = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
            if (camp != null && camp.getDataInicio() != null && camp.getDataFim() != null) {
                sql.append(" AND c.ft >= ? AND c.ft <= ?");
                params.add(camp.getDataInicio().atStartOfDay());
                params.add(camp.getDataFim().atTime(23, 59, 59));
            }
        }

        sql.append(" ORDER BY c.ft DESC");

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new ChamadoSlaPerdidoDTO(
                rs.getString("chamado"),
                rs.getTimestamp("ft") != null ? rs.getTimestamp("ft").toLocalDateTime() : null,
                rs.getString("tecnico_nome"),
                rs.getString("ct"),
                rs.getString("assistencia_nome"),
                rs.getString("equipamento"),
                rs.getString("projeto"),
                rs.getString("sla_status"),
                rs.getString("causa_perda"),
                rs.getString("texto_encerrado")
        ), params.toArray());
    }

    public List<ChamadoSlaPerdidoDTO> getChamadosPerdas(Integer idTecnico, String mesAnoStr) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isSupervisorOrAdmin = auth != null && auth.getAuthorities().stream().anyMatch(a -> {
            String name = a.getAuthority().toUpperCase();
            return name.contains("SUPERVISOR") || name.contains("MODERADOR") || name.contains("ADMIN");
        });

        StringBuilder sql = new StringBuilder("""
            SELECT 
                c.chamado,
                c.ft,
                c.tecnico_nome,
                c.assistencia_centro_trabalho AS ct,
                COALESCE(
                    (SELECT b.cidade FROM tb_base_atp b WHERE b.ct_codigo = c.assistencia_centro_trabalho AND b.cidade IS NOT NULL LIMIT 1),
                    c.assistencia_nome,
                    c.assistencia_centro_trabalho
                ) AS assistencia_nome,
                c.equipamento,
                CASE 
                    WHEN ch.gp_segmento = 'GOV' OR ch.gp_desc LIKE '%GOVERNO%' OR c.projeto LIKE 'H3-%' THEN 'Governo'
                    ELSE 'Corporativo'
                END AS projeto,
                c.sla_status,
                COALESCE(NULLIF(TRIM(c.classifica_chamado), ''), 'PERFORMANCE FALHA GESTAO') AS causa_perda,
                c.texto_encerrado
            FROM tb_chamado c
            JOIN tb_tecnico_base tb ON tb.ct_codigo = c.assistencia_centro_trabalho
            JOIN tb_tecnico t ON t.id_tecnico = tb.id_tecnico
            LEFT JOIN chamados ch ON ch.chamado = c.chamado::text
            WHERE tb.id_tecnico = ?
              AND c.classifica_chamado IN ('PERFORMANCE FALHA GESTAO', 'TRANSFERENCIA ENTRE BASES')
        """);

        List<Object> params = new ArrayList<>();
        params.add(idTecnico);

        if (!isSupervisorOrAdmin) {
            sql.append(" AND (UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(t.nome_completo)) OR TRANSLATE(UPPER(TRIM(c.tecnico_nome)), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC') = TRANSLATE(UPPER(TRIM(t.nome_completo)), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC'))");
        }

        String mesFiltro = mesAnoStr != null ? mesAnoStr.trim().toLowerCase() : "";

        if (mesFiltro.contains("jul") || mesFiltro.contains("2026-07") || "7".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-07'");
        } else if (mesFiltro.contains("ago") || mesFiltro.contains("2026-08") || "8".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-08'");
        } else {
            Campanha camp = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
            if (camp != null && camp.getDataInicio() != null && camp.getDataFim() != null) {
                sql.append(" AND c.ft >= ? AND c.ft <= ?");
                params.add(camp.getDataInicio().atStartOfDay());
                params.add(camp.getDataFim().atTime(23, 59, 59));
            }
        }

        sql.append(" ORDER BY c.ft DESC");

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new ChamadoSlaPerdidoDTO(
                rs.getString("chamado"),
                rs.getTimestamp("ft") != null ? rs.getTimestamp("ft").toLocalDateTime() : null,
                rs.getString("tecnico_nome"),
                rs.getString("ct"),
                rs.getString("assistencia_nome"),
                rs.getString("equipamento"),
                rs.getString("projeto"),
                rs.getString("sla_status"),
                rs.getString("causa_perda"),
                rs.getString("texto_encerrado")
        ), params.toArray());
    }

    public List<PecaAplicadaDTO> getChamadosPecas(Integer idTecnico, String mesAnoStr) {
        String nomeTecnico = null;
        try {
            nomeTecnico = jdbcTemplate.queryForObject(
                "SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = ?", String.class, idTecnico);
        } catch (Exception e) {
            // fallback
        }

        StringBuilder sql = new StringBuilder("""
            SELECT 
                p.chamado,
                p.ft,
                p.equipamento AS tipo_equipamento,
                p.acao,
                p.codigo_solicitado_desc AS cod_solic_desc,
                p.codigo_aplicado_desc AS cod_aplic_desc,
                p.subgrupo,
                p.grupo_mercadoria,
                p.grupo_mercadoria_desc,
                p.tecnico_nome,
                CASE 
                    WHEN UPPER(COALESCE(p.segmento, '')) LIKE '%GOV%' OR p.projeto LIKE 'H3-%' THEN 'Governo'
                    ELSE COALESCE(p.projeto, 'Corporativo')
                END AS projeto,
                COALESCE(p.atp, p.cliente_cidade, p.ct) AS assistencia_cidade,
                p.ocorrencia_chamado,
                p.texto_encerrado
            FROM tb_consumo_peca p
            WHERE UPPER(COALESCE(p.acao, '')) NOT LIKE '%SEM NECESSIDADE%'
              AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%A009%'
              AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%ORÇAMENTO%'
              AND (
                  UPPER(COALESCE(p.subgrupo, '')) IN ('PLACA MÃE', 'PLACA MAE', 'PLM', 'SSD', 'HD', 'HDD', 'TAMPA FRONTAL/LCD', 'PAINEL LCD', 'LCD', 'LCD ALFANUM')
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%PLACA MAE%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%PLM%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%SSD%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%HARD DISK%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%LCD%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%TELA%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%PLM%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%SSD%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%HDD%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%LCD%'
              )
        """);

        List<Object> params = new ArrayList<>();

        if (nomeTecnico != null && !nomeTecnico.isEmpty()) {
            sql.append(" AND UPPER(TRIM(p.tecnico_nome)) LIKE UPPER(TRIM(?)) || '%'");
            params.add(nomeTecnico);
        }

        String mesFiltro = mesAnoStr != null ? mesAnoStr.trim().toLowerCase() : "";

        if (mesFiltro.contains("jul") || mesFiltro.contains("2026-07") || "7".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-07'");
        } else if (mesFiltro.contains("ago") || mesFiltro.contains("2026-08") || "8".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-08'");
        } else if (mesFiltro.contains("set") || mesFiltro.contains("2026-09") || "9".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-09'");
        } else if (mesFiltro.contains("out") || mesFiltro.contains("2026-10") || "10".equals(mesFiltro)) {
            sql.append(" AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-10'");
        } else {
            Campanha camp = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
            if (camp != null && camp.getDataInicio() != null && camp.getDataFim() != null) {
                sql.append(" AND p.ft >= ? AND p.ft <= ?");
                params.add(camp.getDataInicio().atStartOfDay());
                params.add(camp.getDataFim().atTime(23, 59, 59));
            }
        }

        sql.append(" ORDER BY p.ft DESC");

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new PecaAplicadaDTO(
                rs.getString("chamado"),
                rs.getTimestamp("ft") != null ? rs.getTimestamp("ft").toLocalDateTime() : null,
                rs.getString("tipo_equipamento"),
                rs.getString("acao"),
                rs.getString("cod_solic_desc"),
                rs.getString("cod_aplic_desc"),
                rs.getString("subgrupo"),
                rs.getString("grupo_mercadoria"),
                rs.getString("grupo_mercadoria_desc"),
                rs.getString("tecnico_nome"),
                rs.getString("projeto"),
                rs.getString("assistencia_cidade"),
                rs.getString("ocorrencia_chamado"),
                rs.getString("texto_encerrado")
        ), params.toArray());
    }

    /**
     * Consulta e agrupa chamados que não possuem técnico atribuído (nulos, vazios ou 'Não Definido'),
     * consolidando métricas por Região/UF e Base ATP para acompanhamento da supervisão.
     */
    public ChamadosSemTecnicoDTO getChamadosSemTecnicoPorRegiao(String mesAnoStr, Integer idSupervisor) {
        StringBuilder sqlFiltroData = new StringBuilder();
        List<Object> paramsFiltro = new ArrayList<>();

        String mesFiltro = mesAnoStr != null ? mesAnoStr.trim().toLowerCase() : "";
        if (mesFiltro.contains("jul") || mesFiltro.contains("2026-07") || "7".equals(mesFiltro)) {
            sqlFiltroData.append(" AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-07'");
        } else if (mesFiltro.contains("ago") || mesFiltro.contains("2026-08") || "8".equals(mesFiltro)) {
            sqlFiltroData.append(" AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-08'");
        } else if (mesFiltro.contains("set") || mesFiltro.contains("2026-09") || "9".equals(mesFiltro)) {
            sqlFiltroData.append(" AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-09'");
        } else if (mesFiltro.contains("out") || mesFiltro.contains("2026-10") || "10".equals(mesFiltro)) {
            sqlFiltroData.append(" AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-10'");
        } else {
            Campanha camp = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
            if (camp != null && camp.getDataInicio() != null && camp.getDataFim() != null) {
                sqlFiltroData.append(" AND c.ft >= ? AND c.ft <= ?");
                paramsFiltro.add(camp.getDataInicio().atStartOfDay());
                paramsFiltro.add(camp.getDataFim().atTime(23, 59, 59));
            }
        }

        StringBuilder sqlSup = new StringBuilder();
        if (idSupervisor != null) {
            sqlSup.append(" AND b.id_supervisor = ?");
            paramsFiltro.add(idSupervisor);
        }

        // 1. Agrupamento por Região / Base ATP
        String sqlRegioes = """
            SELECT 
                COALESCE(b.uf, 'OUTROS') AS uf,
                COALESCE(b.atp_resumidas, b.nome_atp, 'BASE INDEFINIDA') AS atp_nome,
                c.assistencia_centro_trabalho AS ct_codigo,
                COUNT(*) AS total_chamados,
                COUNT(*) FILTER (WHERE UPPER(TRIM(c.sla_status)) = 'DENTRO') AS dentro_sla,
                COUNT(*) FILTER (WHERE UPPER(TRIM(c.sla_status)) = 'FORA') AS fora_sla,
                ROUND((COUNT(*) FILTER (WHERE UPPER(TRIM(c.sla_status)) = 'DENTRO')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) AS perc_sla
            FROM tb_chamado c
            LEFT JOIN (
                SELECT DISTINCT ON (ct_codigo) ct_codigo, uf, atp_resumidas, nome_atp, id_supervisor
                FROM tb_base_atp
            ) b ON c.assistencia_centro_trabalho = b.ct_codigo
            WHERE (c.id_tecnico IS NULL 
               OR c.tecnico_nome IS NULL 
               OR UPPER(TRIM(c.tecnico_nome)) IN ('', 'NÃO DEFINIDO', 'NAO DEFINIDO', 'SEM TECNICO', 'SEM TÉCNICO'))
        """ + sqlFiltroData + sqlSup + """
            GROUP BY b.uf, b.atp_resumidas, b.nome_atp, c.assistencia_centro_trabalho
            ORDER BY total_chamados DESC;
        """;

        List<ChamadosSemTecnicoDTO.RegiaoSemTecnicoDTO> regioes = jdbcTemplate.query(
                sqlRegioes,
                (rs, rowNum) -> new ChamadosSemTecnicoDTO.RegiaoSemTecnicoDTO(
                        rs.getString("uf"),
                        rs.getString("atp_nome"),
                        rs.getString("ct_codigo"),
                        rs.getInt("total_chamados"),
                        rs.getInt("dentro_sla"),
                        rs.getInt("fora_sla"),
                        rs.getDouble("perc_sla")
                ),
                paramsFiltro.toArray()
        );

        // 2. Lista Detalhada dos Chamados sem Técnico (Limitado a 500 registros para alta performance)
        String sqlChamados = """
            SELECT 
                c.chamado::text AS chamado,
                c.ft AS data_ft,
                COALESCE(c.tecnico_nome, 'NÃO DEFINIDO') AS tecnico_nome,
                c.assistencia_centro_trabalho AS ct_codigo,
                COALESCE(b.nome_atp, c.assistencia_nome, c.assistencia_centro_trabalho) AS assistencia_nome,
                c.equipamento,
                COALESCE(c.projeto, 'Corporativo') AS projeto,
                c.sla_status,
                COALESCE(NULLIF(TRIM(c.classifica_chamado), ''), 'SEM TÉCNICO ATRIBUÍDO') AS causa_perda,
                c.texto_encerrado
            FROM tb_chamado c
            LEFT JOIN (
                SELECT DISTINCT ON (ct_codigo) ct_codigo, uf, atp_resumidas, nome_atp, id_supervisor
                FROM tb_base_atp
            ) b ON c.assistencia_centro_trabalho = b.ct_codigo
            WHERE (c.id_tecnico IS NULL 
               OR c.tecnico_nome IS NULL 
               OR UPPER(TRIM(c.tecnico_nome)) IN ('', 'NÃO DEFINIDO', 'NAO DEFINIDO', 'SEM TECNICO', 'SEM TÉCNICO'))
        """ + sqlFiltroData + sqlSup + """
            ORDER BY c.ft DESC
            LIMIT 500;
        """;

        List<ChamadoSlaPerdidoDTO> chamados = jdbcTemplate.query(
                sqlChamados,
                (rs, rowNum) -> new ChamadoSlaPerdidoDTO(
                        rs.getString("chamado"),
                        rs.getTimestamp("data_ft") != null ? rs.getTimestamp("data_ft").toLocalDateTime() : null,
                        rs.getString("tecnico_nome"),
                        rs.getString("ct_codigo"),
                        rs.getString("assistencia_nome"),
                        rs.getString("equipamento"),
                        rs.getString("projeto"),
                        rs.getString("sla_status"),
                        rs.getString("causa_perda"),
                        rs.getString("texto_encerrado")
                ),
                paramsFiltro.toArray()
        );

        int totalGeral = regioes.stream().mapToInt(ChamadosSemTecnicoDTO.RegiaoSemTecnicoDTO::totalChamados).sum();
        int totalBases = regioes.size();

        return new ChamadosSemTecnicoDTO(totalGeral, totalBases, regioes, chamados);
    }
}
