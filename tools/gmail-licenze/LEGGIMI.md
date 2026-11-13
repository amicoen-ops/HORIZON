# HORIZON Licenze — un solo file in Gmail

[`HORIZON-Licenze.gs`](HORIZON-Licenze.gs) va incollato in script.google.com, **entrato come horizonlicenses**. Fa tutto da sé:

- **Ogni minuto** guarda la casella.
  - Richiesta nuova: GitHub manda i prezzi al pilota.
  - Mail con l'etichetta **M**, **A** o **P**, messa da te dopo il pagamento: GitHub crea il codice e lo manda.
  - Le etichette si spostano da sole in «Da gestire» e «Gestite».
  - Segnalazione di un pilota («Problema», «Registrazione sensori»…): GitHub la analizza dai dati tecnici.
    - Caso noto: parte la risposta con le istruzioni e la mail va in **«Segnalazioni analizzate»**. Se il pilota non ha lasciato l'indirizzo, l'analisi resta scritta nella conversazione, con **«Senza indirizzo»**.
    - Tutto il resto (casi nuovi, difetti, suggerimenti, dati sbagliati, risposte dei piloti): resta in Posta in arrivo con **«Segnalazioni da vedere»**. Al pilota arriva solo la ricevuta. **Sono le uniche da guardare a mano.**
    - **Come chiudi quelle da vedere**: rispondi al pilota dalla casella (controlla che il destinatario sia il suo indirizzo e non web3forms), oppure, se non serve risposta, metti l'etichetta **«Chiusa»**. Al giro successivo la mail passa da sola in **«Segnalazioni gestite»**, fuori dalla Posta in arrivo. Se il pilota riscrive, la sua mail torna in arrivo con «Segnalazioni da vedere».
    - Le regole stanno in `tools/segnalazioni.py`; per insegnarne una nuova si aggiunge lì il caso (e la prova in `tools/test_segnalazioni.py`).
- **Ogni mattina dalle 7** parte il riepilogo, che va in «Archivio generale licenze».
- **Nel Calendar di horizonlicenses** mette i promemoria delle scadenze:
  - token GitHub: 14 giorni prima e il giorno stesso, con la data vera letta da GitHub;
  - Google Play: ogni 1° luglio, per il requisito Android entro il 31 agosto;
  - controllo annuale delle chiavi che non scadono ma si possono invalidare.

**I «tasti»** sono le etichette di Gmail. Sul telefono: apri la mail › **⋮** › **Etichetta** › **M**, **A** o **P**. In 1–2 minuti il pilota riceve il codice.

## Installazione (una volta, circa 5 minuti, meglio dal computer)

1. **Token GitHub.**
   - Apri <https://github.com/settings/personal-access-tokens/new>.
   - Nome: `HORIZON licenze Gmail`. Scadenza: 1 anno.
   - *Only select repositories* › `amicoen-ops/HORIZON`.
   - *Permissions* › **Actions: Read and write**.
   - Tocca **Generate token** e copialo. **Non incollarlo in chat.**
2. **Lo script.**
   - Apri <https://script.google.com>, entrato come horizonlicenses.
   - **Nuovo progetto**: cancella tutto e incolla il file.
   - Salva con l'icona del dischetto.
3. **Il token nello script.**
   - Ingranaggio **Impostazioni progetto** › in fondo **Aggiungi proprietà dello script**.
   - Proprietà `GITHUB_TOKEN`, valore il token del punto 1. Poi **Salva**.
4. **Avvio.**
   - Torna all'editor (icona `< >`), in alto scegli la funzione **installa** e tocca **Esegui**.
   - Google chiede il permesso. Compare «Google non ha verificato questa app»: *Avanzate* › *Vai a …* › *Consenti*. Lo script è tuo e non è pubblicato: va bene così.
   - Nel registro deve comparire «Pronto: controllo ogni minuto … il token scade il …».

## Quando il token scade (fra un anno, te lo ricorda il Calendar)

1. Su GitHub rigenera il token.
2. Sostituiscilo nella proprietà `GITHUB_TOKEN`.
3. Riesegui **installa**: i promemoria si spostano da soli alla nuova scadenza.

## Altre funzioni da lanciare dall'editor

- **stato:** quante mail ci sono da lavorare, l'ultimo avvio, la sveglia e se il token c'è.
- **riepilogoOra:** il riepilogo delle licenze subito.
