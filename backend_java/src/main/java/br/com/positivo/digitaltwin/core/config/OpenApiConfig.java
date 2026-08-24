package br.com.positivo.digitaltwin.core.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "Bearer Authentication";

    @Bean
    public OpenAPI digitalTwinOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Digital Twin Platform API")
                        .description("API REST Oficial de Performance Técnica, Apuração e Ranking — Positivo Tecnologia")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Equipe Digital Twin Positivo")
                                .email("suporte.tecnico@positivo.com.br"))
                        .license(new License()
                                .name("Proprietário - Positivo Tecnologia S.A.")
                                .url("https://www.meupositivo.com.br")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME, new SecurityScheme()
                                .name(SECURITY_SCHEME_NAME)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Insira o token JWT retornado no login para autenticar as rotas protegidas.")));
    }
}
