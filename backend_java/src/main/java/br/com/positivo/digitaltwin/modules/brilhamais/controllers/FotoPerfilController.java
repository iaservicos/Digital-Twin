package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import br.com.positivo.digitaltwin.core.exceptions.ResourceNotFoundException;
import br.com.positivo.digitaltwin.modules.brilhamais.models.FotoPerfil;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Tecnico;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.FotoPerfilRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.TecnicoRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.services.FotoPerfilService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping({"/api/v1/foto-perfil", "/api/v1/fotos"})
@RequiredArgsConstructor
public class FotoPerfilController {

    private final FotoPerfilService fotoPerfilService;
    private final FotoPerfilRepository fotoPerfilRepository;
    private final TecnicoRepository tecnicoRepository;

    @GetMapping("/{identificador}")
    public ResponseEntity<Map<String, String>> getFotoPerfil(@PathVariable String identificador) {
        Tecnico tecnico = encontrarTecnico(identificador);
        if (tecnico == null) {
            Map<String, String> resp = new HashMap<>();
            resp.put("foto", null);
            return ResponseEntity.ok(resp);
        }

        FotoPerfil foto = fotoPerfilRepository.findByTecnico(tecnico).orElse(null);
        Map<String, String> resp = new HashMap<>();
        if (foto != null && foto.getFotoBase64() != null && !foto.getFotoBase64().isBlank()) {
            resp.put("foto", foto.getFotoBase64());
        } else {
            resp.put("foto", null);
        }
        return ResponseEntity.ok(resp);
    }

    @PutMapping("/{identificador}")
    public ResponseEntity<Map<String, String>> updateFotoPerfil(
            @PathVariable String identificador,
            @RequestBody Map<String, String> body) {
        
        Tecnico tecnico = encontrarTecnico(identificador);
        if (tecnico == null) {
            throw new ResourceNotFoundException("Técnico não encontrado: " + identificador);
        }

        String base64 = body.get("foto");
        FotoPerfil foto = fotoPerfilRepository.findByTecnico(tecnico).orElse(
                FotoPerfil.builder().tecnico(tecnico).build()
        );
        foto.setFotoBase64(base64);
        fotoPerfilRepository.save(foto);

        Map<String, String> resp = new HashMap<>();
        resp.put("message", "Foto atualizada com sucesso");
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/{identificador}/upload")
    public ResponseEntity<Void> uploadFoto(
            @PathVariable String identificador,
            @RequestParam("file") MultipartFile file) throws IOException {
        Tecnico tecnico = encontrarTecnico(identificador);
        if (tecnico == null) {
            throw new ResourceNotFoundException("Técnico não encontrado: " + identificador);
        }
        fotoPerfilService.salvarFoto(tecnico.getIdTecnico(), file.getBytes(), file.getContentType());
        return ResponseEntity.ok().build();
    }

    private Tecnico encontrarTecnico(String identificador) {
        if (identificador == null || identificador.isBlank()) return null;
        Tecnico t = tecnicoRepository.findByMatricula(identificador.trim()).orElse(null);
        if (t == null && identificador.matches("\\d+")) {
            try {
                t = tecnicoRepository.findById(Integer.parseInt(identificador)).orElse(null);
            } catch (Exception ignored) {}
        }
        return t;
    }
}
