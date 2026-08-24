package br.com.positivo.digitaltwin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Ponto de entrada oficial da Plataforma Digital Twin.
 * Inicializa os módulos de negócio e a infraestrutura central.
 */
@SpringBootApplication
public class DigitalTwinApplication {

    public static void main(String[] args) {
        SpringApplication.run(DigitalTwinApplication.class, args);
    }
}
