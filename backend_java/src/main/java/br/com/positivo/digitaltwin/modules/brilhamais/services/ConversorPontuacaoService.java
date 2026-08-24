package br.com.positivo.digitaltwin.modules.brilhamais.services;

import br.com.positivo.digitaltwin.modules.brilhamais.models.FaixaPontuacao;
import br.com.positivo.digitaltwin.modules.brilhamais.models.RegraKpi;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.FaixaPontuacaoRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.RegraKpiRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ConversorPontuacaoService {

    private final RegraKpiRepository regraKpiRepository;
    private final FaixaPontuacaoRepository faixaPontuacaoRepository;

    public List<RegraKpi> getRegrasKpis() {
        return regraKpiRepository.findAll();
    }

    public List<FaixaPontuacao> getFaixasPontuacao() {
        return faixaPontuacaoRepository.findAll();
    }
}
