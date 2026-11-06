# Dashboard delle fermate TPL di Milano
Dashboard web delle fermate del trasporto pubblico locale di Milano: bus, tram, filobus e metropolitana. Mostra dove sono le fermate e quali linee vi passano, con dati aperti del Comune di Milano.

<strong>Pagina pubblicata</strong>: https://grian100.github.io/repo_fermate-tlp/

## Funzionalità
- <strong>Mappa interattiva</strong> delle 4.813 fermate: 4.683 di superficie e 130 stazioni della metropolitana, queste ultime colorate secondo la linea, con bordo nero per gli interscambi. Clic su una fermata per vederne le linee.
- <strong>Filtri</strong> per tipo (superficie o metropolitana), per linea e per nome della fermata. La ricerca ignora maiuscole e accenti. La mappa si centra sui risultati.
- <strong>Indicatori</strong>: fermate visualizzate, fermate di superficie, stazioni della metropolitana e linee in transito, aggiornati con i filtri.
- <strong>Classifiche</strong>:
  - linee con più fermate, cliccabili per vedere la linea sulla mappa;
  - distribuzione delle fermate per numero di linee;
  - le 10 fermate servite da più linee.

Le linee della metropolitana sono indicate con M1–M5, perché nei dati hanno codici 1–5 come alcuni tram. Le fermate dei due sensi di marcia sono record distinti nei dati, e quindi sono contate separatamente.

## Dati
| Dataset | Contenuto | Licenza |
|---|---|---|
| [ATM - Fermate linee di superficie urbane](https://dati.comune.milano.it/dataset/ds534-atm-fermate-linee-di-superficie-urbane) (ds534) | codice ATM, ubicazione, linee e posizione delle fermate di bus, tram e filobus, comprese quelle nei comuni dell'area urbana | CC BY |
| [ATM - Fermate linee metropolitane](https://dati.comune.milano.it/dataset/ds535_atm-fermate-linee-metropolitane) (ds535) | codice, nome, linee e posizione delle stazioni della metropolitana | CC BY |

I due dataset sono uniti in `data/fermate.geojson`, con nome, tipo, linee e coordinate di ogni fermata. Il file `data/fonte.json` riporta le date di aggiornamento sul portale e di download.

La prima versione della dashboard, su Kibana, usava un dataset con informazioni su palina elettronica, pensilina e accessibilità delle fermate. Quel dataset non è pubblicato sul portale open data, quindi queste informazioni non sono più presenti.

## Repository
```
repo_fermate-tlp/
├── index.html               # pagina della dashboard
├── css/style.css            # stile (tema chiaro e scuro)
├── js/dashboard.js          # mappa, filtri e grafici (JavaScript senza framework)
├── data/
│   ├── fermate.geojson      # fermate di superficie e metropolitana (per il riuso dei dati)
│   ├── fermate.js           # gli stessi dati, caricati dalla pagina
│   └── fonte.json           # dataset di origine e date di aggiornamento
├── scripts/prepara_dati.py  # scarica e prepara i dati dal portale open data
└── tests/test_prepara_dati.py
```
La pagina usa solo [Leaflet](https://leafletjs.com/) per la mappa, caricato da cdnjs con controllo di integrità (SRI), e la mappa di base di [OpenStreetMap](https://www.openstreetmap.org/copyright).

## Utilizzo
### Visualizzazione in locale
Basta scaricare il repository e aprire `index.html` con un doppio clic: la dashboard funziona direttamente dal disco, senza installare nulla né avviare un server. Per scaricarlo:
```bash
git clone https://github.com/grian100/repo_fermate-tlp.git
```
oppure da GitHub con *Code → Download ZIP*.

Serve comunque la connessione a Internet per la libreria Leaflet e per la mappa di base di OpenStreetMap; i dati delle fermate sono invece nel repository.

In alternativa si può usare un server locale, dalla cartella del progetto:
```bash
python -m http.server 8000
```
e poi aprire http://localhost:8000.

### Aggiornamento dei dati

Per scaricare dal portale open data la versione più recente dei dati serve solo Python:
```bash
python scripts/prepara_dati.py
```
Test, con pytest installato:
```bash
python -m pytest tests
```

## Licenza
- <strong>Codice</strong> (HTML, CSS, JavaScript e script Python): [licenza MIT](LICENSE). Può essere usato, modificato e ridistribuito liberamente, anche per scopi commerciali, mantenendo l'avviso di copyright.
- <strong>Dati</strong> (`data/`): non sono coperti dalla licenza MIT. Derivano dai dataset del Comune di Milano / ATM, rilasciati con licenza [Creative Commons Attribuzione (CC BY)](http://www.opendefinition.org/licenses/cc-by): chi li riutilizza deve citare la fonte, per esempio "Dati: Comune di Milano / ATM, CC BY". Rispetto agli originali i dati sono stati uniti in un solo file, con le linee separate in elenchi e le coordinate arrotondate a 6 decimali.
- <strong>Mappa di base</strong>: © contributori di OpenStreetMap, dati con licenza [ODbL](https://www.openstreetmap.org/copyright).

## Correzioni rispetto alla prima versione
- La dashboard Kibana richiedeva il login: chi visitava la pagina pubblica non poteva vederla. Ora la dashboard è nella pagina stessa e funziona su GitHub Pages senza servizi esterni a pagamento.
- L'HTML aveva un contenitore non chiuso e un `</div>` di troppo. La navbar usava le classi di Materialize in modo errato.
- Sono stati rimossi:
  - Materialize (release candidate non più mantenuta, presente due volte, circa 900 KB);
  - jQuery 2.1.1 (con vulnerabilità note, usato solo per inizializzare un menu inesistente);
  - un file `debug.log` e immagini non usate.
- Accessibilità:
  - lo zoom su smartphone non è più bloccato;
  - etichette per tutti i controlli;
  - classifiche utilizzabili da tastiera;
  - tema scuro automatico.
- Sono indicati fonte, licenza e data dei dati. La pagina non usa più i loghi del Comune di Milano e di AMAT e dichiara di essere un progetto non ufficiale.
