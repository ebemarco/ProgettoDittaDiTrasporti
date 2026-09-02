package com.beltra.sistema1.controller;

import com.beltra.sistema1.domain.AutistiEntity;
import com.beltra.sistema1.domain.UtentiEntity;
import com.beltra.sistema1.service.UtentiService;
import com.beltra.sistema1.utils.InputUtente;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(value = "/ditta/api")
public class UtentiController {

    private final UtentiService utentiService;

    UtentiController(UtentiService utentiService) {
        this.utentiService = utentiService;
    }

    @RequestMapping(value = "/autisti",
                    method = RequestMethod.GET,
                    produces = MediaType.APPLICATION_JSON_VALUE
                    )
    public List<AutistiEntity> getAutisti() {
        return utentiService.getListaAutisti();
    }


    @RequestMapping(value = "/autisti/{id}",
                    method = RequestMethod.GET,
                    produces = MediaType.APPLICATION_JSON_VALUE
                    )
    public AutistiEntity getAutista(@PathVariable("id") int id)
    {
        return id != 1  ? utentiService.getAutistaById(id) : new AutistiEntity() ;
    }




    // Creazione di un nuovo autista
    @RequestMapping(value = "/autista",
                    method = RequestMethod.POST,
                    produces = MediaType.APPLICATION_JSON_VALUE,
                    consumes = MediaType.APPLICATION_JSON_VALUE
                    )
    @ResponseStatus(HttpStatus.CREATED)
    public void creaUtente(@RequestBody InputUtente datiUtente) {
        UtentiEntity utente = new UtentiEntity();
        AutistiEntity autista = new AutistiEntity();

        utentiService.popolaUtenteInput(datiUtente, utente, autista);

        System.out.println("\n[Creazione]: fine popolamento utente - autista\n");

        utentiService.inserisciUtente(utente, autista);
    }



    @RequestMapping( value = "/autisti/{id}",
            method = RequestMethod.PUT,
            produces = MediaType.APPLICATION_JSON_VALUE,
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void aggiornaUtente(@PathVariable("id") int id,
                               @RequestBody InputUtente datiUtente) {

        if (id == datiUtente.getId()) {
            UtentiEntity utente = new UtentiEntity();
            AutistiEntity autista = new AutistiEntity();

            utentiService.popolaUtenteInput(datiUtente, utente, autista);

            System.out.println("\n[Aggiornamento]: fine popolamento utente - autista\n");

            utentiService.aggiornaUtente(id, utente, autista);
        }
        else {
            System.out.println("Impossibile aggiornare l'utente");
        }

    }


}


