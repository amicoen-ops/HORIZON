# HORIZON Licenze — tasti in Gmail e sveglia

Componente aggiuntivo di Gmail per la casella **horizonlicenses@gmail.com**.

- Quando apri una richiesta di licenza compaiono i tasti **Mensile**, **Annuale** e **Perenne**. Ognuno mette l'etichetta M, A o P e fa partire subito il giro su GitHub, che crea il codice e lo manda al pilota.
- Ogni 10 minuti una sveglia guarda la casella e fa partire il giro se c'è qualcosa da lavorare.
- Una volta al giorno, dalle 7, la sveglia fa partire anche il riepilogo delle licenze.

Si installa una volta sola. Conviene farlo da un **computer**, perché l'editor di Apps Script dal telefono è scomodo. Ci vogliono circa 10 minuti.

## 1. Token GitHub (può solo far partire i lavori di HORIZON)

1. Apri <https://github.com/settings/personal-access-tokens/new>.
2. Compila così:
   - **Token name:** `HORIZON licenze Gmail`
   - **Expiration:** 1 anno (*Custom*: la data tra un anno)
   - **Repository access:** *Only select repositories* → `amicoen-ops/HORIZON`
   - **Permissions** → *Repository permissions* → **Actions:** `Read and write`. Tutto il resto resta *No access*.
3. Tocca **Generate token** e copia il token (inizia con `github_pat_`). **Non incollarlo in chat**: va solo al punto 2.5.

## 2. Lo script

1. Apri <https://script.google.com>, **entrato come horizonlicenses** (controlla l'icona in alto a destra).
2. Tocca **Nuovo progetto** e dai come nome `HORIZON Licenze`.
3. Nel file `Codice.gs` cancella tutto e incolla il contenuto di [`Codice.gs`](Codice.gs).
4. A sinistra apri l'ingranaggio **Impostazioni progetto**:
   - spunta **«Mostra il file manifest "appsscript.json" nell'editor»**;
   - in fondo, in **Proprietà dello script**, tocca *Aggiungi proprietà dello script*: proprietà `GITHUB_TOKEN`, valore il token del punto 1. Poi **Salva**.
5. Torna nell'**Editor** (icona `< >`), apri `appsscript.json`, cancella tutto e incolla il contenuto di [`appsscript.json`](appsscript.json). Salva con l'icona del dischetto.
6. In alto scegli la funzione **`installa`** e tocca **Esegui**:
   - Google chiede l'autorizzazione: *Rivedi le autorizzazioni* → scegli horizonlicenses;
   - compare «Google non ha verificato questa app»: *Avanzate* → *Vai a HORIZON Licenze (non sicuro)* → *Consenti*. Lo dice perché lo script è tuo e non è pubblicato: va bene.
   - Nel registro deve comparire: «Sveglia attiva ogni 10 minuti. Primo giro avviato su GitHub.»

## 3. I tasti in Gmail

1. Sempre nell'editor, in alto a destra: **Esegui il deployment** → **Testa i deployment**.
2. Tipo di applicazione: **Componente aggiuntivo di Google Workspace**. Tocca **Installa**, poi **Fine**.
3. Apri Gmail di horizonlicenses:
   - **dal computer**, nella barra a destra compare l'icona di HORIZON;
   - **dall'app Gmail sul telefono**, apri una mail e scorri in fondo: c'è la riga «HORIZON Licenze».

## Uso

- **Richiesta da un pilota:** apri la mail e controlla su PayPal il pagamento (nella nota c'è il codice del telefono). Poi tocca **Mensile**, **Annuale** o **Perenne**: in 1–2 minuti il pilota riceve il codice.
- **Tester:** **Perenne**, senza pagamento.
- **Senza aprire una richiesta:** l'icona mostra quante richieste sono in attesa e il tasto **Riepilogo licenze adesso**.

## Se qualcosa non va

- **«manca GITHUB_TOKEN»:** rifai il punto 2.4.
- **«GitHub ha risposto 401/403»:** il token è scaduto o non ha *Actions: Read and write*. Creane uno nuovo (punto 1) e sostituiscilo nella proprietà.
- **La sveglia si controlla qui:** script.google.com → progetto → **Trigger** (icona sveglia): deve esserci `sveglia`, ogni 10 minuti.
