#!/usr/bin/env bash
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
#
# Giro del lavoro «Prepara i prati» (.github/workflows/prati-prepara.yml): prepara i riquadri a gruppi e dopo ogni gruppo
# li salva sul ramo «prati-dati».
#   bash tools/prati_pubblica.sh CARTELLA [LIMITE]
# CARTELLA è un deposito git con «origin» già impostato e dentro i file che sono già sul ramo (li mette il workflow).
# Il ramo non ha storia: ogni salvataggio è un commit senza genitore, spinto sopra il precedente (git manda solo i file
# cambiati, perché il commit di prima è ancora nella cartella).
# Variabili per le prove: PRATI_GRUPPO (riquadri per gruppo, 40), PRATI_MINUTI (tempo totale, 320), PRATI_OPZIONI (altre
# opzioni per tools/prati_prepara.js, per esempio una zona ridotta).
set -u
DIR="$1"; LIMITE="${2:-}"
GRUPPO="${PRATI_GRUPPO:-40}"; MINUTI="${PRATI_MINUTI:-320}"
QUI="$(cd "$(dirname "$0")" && pwd)"
case "$LIMITE" in ''|*[!0-9]*) [ -z "$LIMITE" ] || { echo "::error::Il limite deve essere un numero"; exit 2; } ;; esac
fine=$(( $(date +%s) + MINUTI*60 ))
fatti=0; esito=0

salva() {
  git -C "$DIR" add -A
  albero=$(git -C "$DIR" write-tree) || return 1
  # niente di nuovo rispetto al ramo: non si spinge
  if [ -n "${ultimo:-}" ] && [ "$(git -C "$DIR" rev-parse "$ultimo^{tree}")" = "$albero" ]; then echo "Niente di nuovo da salvare"; return 0; fi
  n=$(ls "$DIR/v1" 2>/dev/null | grep -c -v '^indice.json$' || true)
  nuovo=$(git -C "$DIR" -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit-tree "$albero" -m "Prati: $n riquadri pronti ($(date -u +%Y-%m-%d))") || return 1
  for prova in 1 2 3; do
    if git -C "$DIR" push -q -f origin "$nuovo:refs/heads/prati-dati"; then ultimo="$nuovo"; echo "Salvati sul ramo prati-dati: $n riquadri"; return 0; fi
    sleep $((prova*20))
  done
  echo "::warning::Salvataggio sul ramo non riuscito: si riprova al prossimo gruppo"; return 1
}
ultimo="$(git -C "$DIR" rev-parse -q --verify FETCH_HEAD 2>/dev/null || true)"

while :; do
  resta_min=$(( (fine - $(date +%s)) / 60 ))
  [ "$resta_min" -ge 3 ] || { echo "Tempo finito: il resto alla prossima corsa"; break; }
  n="$GRUPPO"
  if [ -n "$LIMITE" ]; then r=$((LIMITE - fatti)); [ "$r" -gt 0 ] || break; [ "$r" -lt "$n" ] && n="$r"; fi
  # shellcheck disable=SC2086
  node "$QUI/prati_prepara.js" --uscita "$DIR" --limite "$n" --minuti "$resta_min" ${PRATI_OPZIONI:-}
  esito=$?
  fatti=$((fatti + n))
  salvato=0; salva && salvato=1
  case "$esito" in
    0) break ;;                       # non resta niente da fare
    10) ;;                            # restano riquadri: un altro gruppo
    1) echo "::warning::Overpass non ha risposto per nessun riquadro del gruppo: ci si ferma, restano i riquadri di prima"; break ;;
    *) echo "::error::tools/prati_prepara.js è uscito con $esito"; exit 1 ;;
  esac
done

[ -f "$DIR/v1/indice.json" ] || { echo "::error::Nessun elenco dei riquadri"; exit 1; }
[ "${salvato:-1}" = 1 ] || salva || { echo "::error::Ultimo salvataggio non riuscito"; exit 1; }
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  node -e "const j=require(require('path').resolve(process.argv[1],'v1/indice.json'));const k=Object.keys(j.riquadri);console.log('Riquadri dei prati pronti: **'+k.length+'** · non riusciti da riprovare: '+Object.keys(j.falliti||{}).length+' · circa '+Math.round(k.reduce((s,x)=>s+(j.riquadri[x].kb||0),0)/1024)+' MB')" "$DIR" >> "$GITHUB_STEP_SUMMARY"
fi
exit 0
