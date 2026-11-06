"""Scarica le fermate del trasporto pubblico dal portale open data del Comune di Milano
e le salva in un unico GeoJSON compatto per la dashboard.

    python scripts/prepara_dati.py

Dataset usati (licenza CC BY, Comune di Milano / ATM):
- ds534 "ATM - Fermate linee di superficie urbane" (bus, tram, filobus);
- ds535 "ATM - Fermate linee metropolitane".

Produce:
- data/fermate.geojson: una Feature per fermata con id, nome, tipo ("superficie" o "metro")
  e linee (lista);
- data/fonte.json: dataset, link, licenza, data di aggiornamento sul portale e di download;
- data/fermate.js: gli stessi dati come script JavaScript, caricato dalla dashboard. A differenza
  di fetch, un tag <script> funziona anche aprendo index.html direttamente dal disco.

Usa solo la libreria standard di Python.
"""

import argparse
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGO = "https://dati.comune.milano.it/api/3/action/package_show?id="
DATASET = {
    "superficie": {"id": "ds534-atm-fermate-linee-di-superficie-urbane", "campo_nome": "ubicazione"},
    "metro": {"id": "ds535_atm-fermate-linee-metropolitane", "campo_nome": "nome"},
}


def scarica_json(url, timeout=60):
    richiesta = urllib.request.Request(url, headers={"User-Agent": "dashboard-fermate-tpl"})
    with urllib.request.urlopen(richiesta, timeout=timeout) as risposta:
        return json.load(risposta)


def metadati(id_dataset):
    """Metadati del dataset e link della risorsa GeoJSON, letti dal catalogo CKAN."""
    pacchetto = scarica_json(CATALOGO + id_dataset)["result"]
    geojson = next(r for r in pacchetto["resources"] if r["format"].lower() == "geojson")
    return {
        "dataset": pacchetto["title"],
        "pagina": f"https://dati.comune.milano.it/dataset/{pacchetto['name']}",
        "licenza": pacchetto.get("license_title"),
        "aggiornato_sul_portale": pacchetto.get("metadata_modified", "")[:10],
        "url": geojson["url"],
    }


def dividi_linee(valore):
    """"50,64,326" -> ["50", "64", "326"], senza duplicati e in ordine naturale."""
    linee = {t for t in re.split(r"[,;\s]+", str(valore or "")) if t}
    return sorted(linee, key=lambda t: (int(t) if t.isdigit() else float("inf"), t))


def normalizza(geojson, tipo, campo_nome):
    """Feature compatte: coordinate a 6 decimali (circa 10 cm), nomi senza spazi superflui."""
    risultato, scartate = [], 0
    for feature in geojson["features"]:
        geometria, proprieta = feature.get("geometry"), feature.get("properties") or {}
        if not geometria or geometria.get("type") != "Point":
            scartate += 1
            continue
        lon, lat = geometria["coordinates"][:2]
        nome = " ".join(str(proprieta.get(campo_nome) or "").split())
        risultato.append({
            "type": "Feature",
            "properties": {"id": proprieta.get("id_amat"), "nome": nome, "tipo": tipo,
                           "linee": dividi_linee(proprieta.get("linee"))},
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
        })
    return risultato, scartate


def scrivi_script(percorso, collezione, fonte):
    """Dati per la dashboard come variabili globali JavaScript (window.FERMATE, window.FONTE)."""
    contenuto = ("// Generato da scripts/prepara_dati.py: non modificare a mano.\n"
                 f"window.FONTE = {json.dumps(fonte, ensure_ascii=False)};\n"
                 f"window.FERMATE = {json.dumps(collezione, ensure_ascii=False, separators=(',', ':'))};\n")
    percorso.write_text(contenuto, encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--uscita", type=Path, default=ROOT / "data")
    args = parser.parse_args(argv)

    features, fonti = [], {}
    for tipo, config in DATASET.items():
        info = metadati(config["id"])
        dati, scartate = normalizza(scarica_json(info["url"]), tipo, config["campo_nome"])
        features += dati
        fonti[tipo] = {**info, "fermate": len(dati), "scartate": scartate}
        print(f"{info['dataset']}: {len(dati)} fermate ({scartate} senza coordinate valide)")

    args.uscita.mkdir(parents=True, exist_ok=True)
    collezione = {"type": "FeatureCollection", "features": features}
    (args.uscita / "fermate.geojson").write_text(
        json.dumps(collezione, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    fonte = {"scaricato_il": date.today().isoformat(), "dataset": fonti}
    (args.uscita / "fonte.json").write_text(json.dumps(fonte, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    scrivi_script(args.uscita / "fermate.js", collezione, fonte)
    print(f"Salvate {len(features)} fermate in {args.uscita / 'fermate.geojson'} e fermate.js")
    return 0


if __name__ == "__main__":
    sys.exit(main())
