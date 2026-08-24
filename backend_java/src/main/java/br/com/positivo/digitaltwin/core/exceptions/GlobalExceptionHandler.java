package br.com.positivo.digitaltwin.core.exceptions;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.net.URI;
import java.time.Instant;

/**
 * Manipulador global de exceções formatado no padrão oficial RFC 7807 (ProblemDetail).
 * Garante respostas seguras sem expor stacktraces em produção e registra logs estruturados.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(BadCredentialsException.class)
    public ProblemDetail handleBadCredentials(BadCredentialsException ex, WebRequest request) {
        log.warn("Tentativa de autenticação com credenciais inválidas: {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Matrícula ou senha inválidos.");
        problem.setTitle("Credenciais Inválidas");
        problem.setType(URI.create("https://digitaltwin.positivo.com.br/errors/unauthorized"));
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    @ExceptionHandler(UsernameNotFoundException.class)
    public ProblemDetail handleUserNotFound(UsernameNotFoundException ex, WebRequest request) {
        log.warn("Usuário não encontrado: {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Usuário Não Encontrado");
        problem.setType(URI.create("https://digitaltwin.positivo.com.br/errors/not-found"));
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleResourceNotFound(ResourceNotFoundException ex, WebRequest request) {
        log.warn("Recurso não encontrado: {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Recurso Não Encontrado");
        problem.setType(URI.create("https://digitaltwin.positivo.com.br/errors/not-found"));
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    @ExceptionHandler(BusinessException.class)
    public ProblemDetail handleBusinessException(BusinessException ex, WebRequest request) {
        log.warn("Violação de regra de negócio: {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setTitle("Regra de Negócio Violada");
        problem.setType(URI.create("https://digitaltwin.positivo.com.br/errors/business-rule"));
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGenericException(Exception ex, WebRequest request) {
        log.error("Erro interno não tratado no servidor: ", ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Ocorreu um erro interno ao processar a solicitação. Por favor, contate o suporte."
        );
        problem.setTitle("Erro Interno do Servidor");
        problem.setType(URI.create("https://digitaltwin.positivo.com.br/errors/internal-error"));
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }
}
