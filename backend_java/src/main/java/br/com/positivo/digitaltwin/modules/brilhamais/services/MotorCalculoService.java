package br.com.positivo.digitaltwin.modules.brilhamais.services;

import br.com.positivo.digitaltwin.modules.brilhamais.models.Campanha;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.CampanhaRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.util.Map;

/**
 * Serviço de Orquestração de Cálculo.
 * Delega o processamento analítico de alta performance ao microserviço DataIngest (Python / Polars).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MotorCalculoService {

    @Getter
    @Setter
    public static class CalculoTracker {
        private String status = "idle";
        private int progress = 0;
        private int processados = 0;
        private int total = 0;
        private String step = "Pronto para iniciar";
        private double elapsedSeconds = 0;
        private int estimatedSecondsRemaining = 0;
        private String error = null;
    }

    @Getter
    private static final CalculoTracker tracker = new CalculoTracker();

    private final CampanhaRepository campanhaRepository;
    private final RestClient dataIngestRestClient;

    @Value("${data.ingest.url:http://data_ingest:8000}")
    private String dataIngestUrl;

    public void rotinaDiariaCalculo() {
        calcularEProcessarMes(LocalDate.now().withDayOfMonth(1));
    }

    public void calcularEProcessarMes(LocalDate mesAno) {
        Campanha campanhaAtiva = campanhaRepository.findFirstByAtivaTrueOrderByIdCampanhaDesc().orElse(null);
        LocalDate dataRef = mesAno != null ? mesAno : (campanhaAtiva != null ? campanhaAtiva.getDataFim() : LocalDate.now());
        int mes = dataRef.getMonthValue();
        int ano = dataRef.getYear();

        long startTs = System.currentTimeMillis();

        synchronized (tracker) {
            tracker.setStatus("processing");
            tracker.setProgress(15);
            tracker.setProcessados(0);
            tracker.setTotal(357);
            tracker.setStep(String.format("Iniciando apuração analítica no DataIngest (%02d/%d)...", mes, ano));
            tracker.setElapsedSeconds(0);
            tracker.setEstimatedSecondsRemaining(5);
            tracker.setError(null);
        }

        try {
            log.info("Disparando cálculo geral no DataIngest para {}/{}...", mes, ano);
            dataIngestRestClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/calculo/geral")
                            .queryParam("mes", mes)
                            .queryParam("ano", ano)
                            .build())
                    .retrieve()
                    .toBodilessEntity();

            double totalElapsed = Math.round(((System.currentTimeMillis() - startTs) / 1000.0) * 10.0) / 10.0;

            synchronized (tracker) {
                tracker.setStatus("success");
                tracker.setProgress(100);
                tracker.setProcessados(357);
                tracker.setTotal(357);
                tracker.setStep("Apuração da campanha concluída com sucesso no DataIngest!");
                tracker.setElapsedSeconds(totalElapsed);
                tracker.setEstimatedSecondsRemaining(0);
            }
            log.info("Cálculo finalizado com sucesso em {}s", totalElapsed);

        } catch (Exception e) {
            double totalElapsed = Math.round(((System.currentTimeMillis() - startTs) / 1000.0) * 10.0) / 10.0;
            log.error("Falha ao comunicar com o microserviço DataIngest: {}", e.getMessage());

            synchronized (tracker) {
                tracker.setStatus("failed");
                tracker.setProgress(0);
                tracker.setStep("Falha na comunicação com o motor DataIngest.");
                tracker.setError(e.getMessage());
                tracker.setElapsedSeconds(totalElapsed);
                tracker.setEstimatedSecondsRemaining(0);
            }
        }
    }

    public void calcularEProcessarTecnico(String matricula) {
        calcularEProcessarMes(LocalDate.now());
    }
}
