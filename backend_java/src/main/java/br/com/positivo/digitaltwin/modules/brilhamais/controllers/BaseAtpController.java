package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import br.com.positivo.digitaltwin.modules.brilhamais.models.BaseAtp;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.BaseAtpRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/bases")
@RequiredArgsConstructor
public class BaseAtpController {

    private final BaseAtpRepository baseAtpRepository;

    @GetMapping
    public ResponseEntity<List<BaseAtp>> getBases(
            @RequestParam(name = "idSupervisor", required = false) Integer idSupervisor) {
        if (idSupervisor != null) {
            return ResponseEntity.ok(baseAtpRepository.findByIdSupervisor(idSupervisor));
        }
        return ResponseEntity.ok(baseAtpRepository.findAll());
    }
}
