package br.com.positivo.digitaltwin.modules.brilhamais.services;

import br.com.positivo.digitaltwin.modules.brilhamais.models.FotoPerfil;
import br.com.positivo.digitaltwin.modules.brilhamais.models.Tecnico;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.FotoPerfilRepository;
import br.com.positivo.digitaltwin.modules.brilhamais.repositories.TecnicoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;

@Service
@RequiredArgsConstructor
public class FotoPerfilService {

    private final FotoPerfilRepository fotoPerfilRepository;
    private final TecnicoRepository tecnicoRepository;

    @Transactional
    public void salvarFoto(Integer idTecnico, byte[] bytes, String contentType) {
        Tecnico tecnico = tecnicoRepository.findById(idTecnico).orElseThrow();
        FotoPerfil foto = fotoPerfilRepository.findByTecnico(tecnico).orElse(
                FotoPerfil.builder().tecnico(tecnico).build()
        );
        String base64 = Base64.getEncoder().encodeToString(bytes);
        foto.setFotoBase64(base64);
        fotoPerfilRepository.save(foto);
    }

    public FotoPerfil buscarFoto(Integer idTecnico) {
        Tecnico tecnico = tecnicoRepository.findById(idTecnico).orElseThrow();
        return fotoPerfilRepository.findByTecnico(tecnico).orElse(null);
    }
}
