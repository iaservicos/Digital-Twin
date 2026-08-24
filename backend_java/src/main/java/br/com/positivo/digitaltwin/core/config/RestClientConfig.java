package br.com.positivo.digitaltwin.core.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Configuração do RestClient moderno do Spring Boot 3 para comunicação autenticada com o DataIngest.
 */
@Configuration
public class RestClientConfig {

    @Value("${data.ingest.url:http://data_ingest:8000}")
    private String dataIngestUrl;

    @Value("${data.ingest.api-key:pos-data-token-2026}")
    private String dataIngestApiKey;

    @Bean
    public RestClient dataIngestRestClient() {
        return RestClient.builder()
                .baseUrl(dataIngestUrl)
                .defaultHeader("X-API-Key", dataIngestApiKey)
                .build();
    }
}
