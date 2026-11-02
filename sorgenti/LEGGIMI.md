# HORIZON v2 · sorgenti

Ramo `v2`: app separata **HORIZON v2** (`it.amicoen.horizon.v2`), si installa accanto alla versione 1 con dati suoi.

- `src/`: codice del telefono (strumento, piano, rotte, carburante, licenza, regole).
- `pfd.html`, `companion.html`: basi dello strumento e del piano su cui `build_android.py` innesta i file di `src/`.
- Compilazione: `python3 sorgenti/build_android.py` → `sorgenti/www_build/`, poi `python3 tools/prepare_www.py sorgenti/www_build` → `www/`.
- Su GitHub lo fa il workflow «Compila APK v2» a ogni push sul ramo `v2`: pubblica la pre-release `v2-build-N` e la prova sull'emulatore Android 14.

La versione 1 resta sul ramo `main` e non vede le pre-release della v2.
