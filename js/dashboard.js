/* Dashboard delle fermate TPL di Milano: mappa Leaflet, filtri e classifiche. */
(function () {
  "use strict";

  // Colori delle linee della metropolitana
  var COLORI_METRO = { M1: "#e3001b", M2: "#00a650", M3: "#f9b000", M4: "#0075bf", M5: "#9b4f96" };
  var CENTRO = [45.4642, 9.19];
  var formato = new Intl.NumberFormat("it-IT");

  var fermate = [];       // { id, nome, tipo, linee, latlng, marker }
  var perLinea = {};      // linea -> fermate
  var lineaAttiva = "";

  var el = function (id) { return document.getElementById(id); };

  // Le linee metro hanno codici 1-5 come alcuni tram: si distinguono con il prefisso M
  function codiceLinea(tipo, linea) { return tipo === "metro" ? "M" + linea : linea; }

  function ordinaLinee(a, b) {
    var ma = a.charAt(0) === "M", mb = b.charAt(0) === "M";
    if (ma !== mb) return ma ? -1 : 1;
    var na = parseInt(a.replace(/^M/, ""), 10), nb = parseInt(b.replace(/^M/, ""), 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b, "it");
  }

  function escape(testo) {
    return String(testo).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function normalizza(testo) {
    return testo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  // ---------------------------------------------------------------- mappa
  var mappa = L.map("mappa", { preferCanvas: true }).setView(CENTRO, 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mappa);
  var livello = L.layerGroup().addTo(mappa);

  function stileMarker(fermata, evidenziata) {
    if (fermata.tipo === "metro") {
      return {
        radius: evidenziata ? 9 : 7,
        color: fermata.linee.length > 1 ? "#000" : "#fff",
        weight: 2,
        // Con una linea selezionata le stazioni di interscambio prendono il suo colore
        fillColor: COLORI_METRO[lineaAttiva] || COLORI_METRO[fermata.linee[0]] || "#555",
        fillOpacity: 1
      };
    }
    var colore = getComputedStyle(document.documentElement).getPropertyValue("--superficie").trim() || "#2f6db5";
    return { radius: evidenziata ? 6 : 3.5, color: colore, weight: 1, fillColor: colore, fillOpacity: evidenziata ? 0.9 : 0.6 };
  }

  function popup(fermata) {
    var badge = fermata.linee.map(function (l) {
      var colore = COLORI_METRO[l];
      var stile = colore ? ' style="background:' + colore + ';color:#fff"' : "";
      return '<span class="linea-badge"' + stile + ">" + escape(l) + "</span>";
    }).join("");
    var tipo = fermata.tipo === "metro" ? "Stazione della metropolitana" : "Fermata di superficie";
    return '<div class="popup-titolo">' + escape(fermata.nome) + "</div>" +
      '<div class="popup-tipo">' + tipo + " · codice ATM " + escape(fermata.id) + "</div>" +
      "<div>" + fermata.linee.length + (fermata.linee.length === 1 ? " linea" : " linee") + ":</div>" + badge;
  }

  // ---------------------------------------------------------------- filtri
  function filtrate() {
    var superficie = el("filtro-superficie").checked, metro = el("filtro-metro").checked;
    var testo = normalizza(el("filtro-nome").value.trim());
    return fermate.filter(function (f) {
      if (f.tipo === "metro" ? !metro : !superficie) return false;
      if (lineaAttiva && f.linee.indexOf(lineaAttiva) === -1) return false;
      if (testo && f.nomeRicerca.indexOf(testo) === -1) return false;
      return true;
    });
  }

  function aggiorna(adatta) {
    var visibili = filtrate();
    var evidenziate = !!lineaAttiva || visibili.length < 50;
    livello.clearLayers();
    // Le stazioni della metropolitana vengono disegnate sopra le fermate di superficie
    visibili.filter(function (f) { return f.tipo !== "metro"; }).concat(
      visibili.filter(function (f) { return f.tipo === "metro"; })
    ).forEach(function (f) {
      f.marker.setStyle(stileMarker(f, evidenziate));  // setStyle aggiorna anche il raggio
      livello.addLayer(f.marker);
    });

    var linee = {};
    visibili.forEach(function (f) { f.linee.forEach(function (l) { linee[l] = true; }); });
    el("kpi-fermate").textContent = formato.format(visibili.length);
    el("kpi-superficie").textContent = formato.format(visibili.filter(function (f) { return f.tipo === "superficie"; }).length);
    el("kpi-metro").textContent = formato.format(visibili.filter(function (f) { return f.tipo === "metro"; }).length);
    el("kpi-linee").textContent = formato.format(Object.keys(linee).length);

    var stato = el("stato");
    stato.classList.remove("errore");
    if (!visibili.length) {
      stato.textContent = "Nessuna fermata corrisponde ai filtri.";
    } else if (lineaAttiva) {
      stato.textContent = "Linea " + lineaAttiva + ": " + formato.format(visibili.length) + " fermate.";
    } else {
      stato.textContent = "";
    }
    if (adatta && visibili.length) {
      var limiti = L.latLngBounds(visibili.map(function (f) { return f.latlng; }));
      mappa.fitBounds(limiti, { padding: [30, 30], maxZoom: 16 });
    }
    disegnaDistribuzione(visibili);
    disegnaClassificaFermate(visibili);
    evidenziaLinea();
  }

  function selezionaLinea(linea) {
    lineaAttiva = linea;
    el("filtro-linea").value = linea;
    aggiorna(true);
  }

  // ---------------------------------------------------------------- grafici
  function barre(contenitore, righe, massimo, alClic) {
    contenitore.innerHTML = "";
    righe.forEach(function (riga) {
      var li = document.createElement("li");
      li.dataset.chiave = riga.chiave;
      li.innerHTML = '<span class="nome">' + escape(riga.nome) + "</span>" +
        '<span class="barra" style="width:' + (100 * riga.valore / (massimo || 1)).toFixed(1) + '%"></span>' +
        '<span class="numero">' + formato.format(riga.valore) + "</span>";
      if (alClic) {
        li.className = "cliccabile";
        li.tabIndex = 0;
        li.setAttribute("role", "button");
        li.setAttribute("aria-label", riga.nome + ", " + riga.valore + " fermate");
        li.addEventListener("click", function () { alClic(riga.chiave); });
        li.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alClic(riga.chiave); }
        });
      }
      contenitore.appendChild(li);
    });
  }

  function disegnaClassificaLinee() {
    var righe = Object.keys(perLinea).map(function (l) {
      return { chiave: l, nome: l, valore: perLinea[l].length };
    }).sort(function (a, b) { return b.valore - a.valore || ordinaLinee(a.chiave, b.chiave); }).slice(0, 12);
    barre(el("classifica-linee"), righe, righe.length ? righe[0].valore : 1, function (linea) {
      selezionaLinea(lineaAttiva === linea ? "" : linea);
    });
  }

  function evidenziaLinea() {
    Array.prototype.forEach.call(el("classifica-linee").children, function (li) {
      li.classList.toggle("attiva", li.dataset.chiave === lineaAttiva);
    });
  }

  function disegnaDistribuzione(visibili) {
    var classi = [1, 2, 3, 4, 5], conteggi = [0, 0, 0, 0, 0];
    visibili.forEach(function (f) { conteggi[Math.min(f.linee.length, 5) - 1] += 1; });
    var righe = classi.map(function (c, i) {
      return { chiave: String(c), nome: c === 5 ? "5 o più" : c + (c === 1 ? " linea" : " linee"), valore: conteggi[i] };
    });
    barre(el("distribuzione"), righe, Math.max.apply(null, conteggi));
  }

  function disegnaClassificaFermate(visibili) {
    var lista = el("classifica-fermate");
    lista.innerHTML = "";
    visibili.slice().sort(function (a, b) {
      return b.linee.length - a.linee.length || a.nome.localeCompare(b.nome, "it");
    }).slice(0, 10).forEach(function (f) {
      var li = document.createElement("li");
      var pulsante = document.createElement("button");
      pulsante.type = "button";
      pulsante.textContent = f.nome + " (" + f.linee.length + ")";
      pulsante.addEventListener("click", function () {
        mappa.setView(f.latlng, 17);
        f.marker.openPopup();
      });
      var linee = document.createElement("span");
      linee.className = "linee";
      linee.textContent = (f.tipo === "metro" ? "Metropolitana: " : "Linee: ") + f.linee.join(", ");
      li.appendChild(pulsante);
      li.appendChild(linee);
      lista.appendChild(li);
    });
  }

  // ---------------------------------------------------------------- dati
  function carica(dati) {
    dati.features.forEach(function (feature) {
      var p = feature.properties, c = feature.geometry.coordinates;
      var fermata = {
        id: p.id,
        nome: p.nome,
        nomeRicerca: normalizza(p.nome),
        tipo: p.tipo,
        linee: p.linee.map(function (l) { return codiceLinea(p.tipo, l); }).sort(ordinaLinee),
        latlng: L.latLng(c[1], c[0])
      };
      fermata.marker = L.circleMarker(fermata.latlng, stileMarker(fermata, false)).bindPopup(function () {
        return popup(fermata);
      });
      fermate.push(fermata);
      fermata.linee.forEach(function (l) { (perLinea[l] = perLinea[l] || []).push(fermata); });
    });

    var select = el("filtro-linea");
    Object.keys(perLinea).sort(ordinaLinee).forEach(function (l) {
      var opzione = document.createElement("option");
      opzione.value = l;
      opzione.textContent = (l.charAt(0) === "M" ? "Metro " : "Linea ") + l + " (" + perLinea[l].length + " fermate)";
      select.appendChild(opzione);
    });

    select.addEventListener("change", function () { selezionaLinea(select.value); });
    el("filtro-superficie").addEventListener("change", function () { aggiorna(false); });
    el("filtro-metro").addEventListener("change", function () { aggiorna(false); });
    var attesa;
    el("filtro-nome").addEventListener("input", function () {
      clearTimeout(attesa);
      attesa = setTimeout(function () { aggiorna(true); }, 250);
    });
    el("azzera").addEventListener("click", function () {
      el("filtro-superficie").checked = true;
      el("filtro-metro").checked = true;
      el("filtro-nome").value = "";
      lineaAttiva = "";
      select.value = "";
      aggiorna(false);
      mappa.setView(CENTRO, 12);
    });

    disegnaClassificaLinee();
    aggiorna(false);
  }

  function mostraAggiornamento(fonte) {
    var date = Object.keys(fonte.dataset).map(function (k) { return fonte.dataset[k].aggiornato_sul_portale; });
    el("aggiornamento").textContent = "Dati aggiornati sul portale il " +
      new Date(date.sort()[date.length - 1]).toLocaleDateString("it-IT") +
      ", scaricati il " + new Date(fonte.scaricato_il).toLocaleDateString("it-IT") + ".";
  }

  // I dati arrivano da data/fermate.js (window.FERMATE e window.FONTE), caricato con un tag
  // <script>: funziona anche aprendo index.html dal disco, dove fetch viene bloccato dal browser
  if (window.FERMATE) {
    carica(window.FERMATE);
    if (window.FONTE) mostraAggiornamento(window.FONTE);
  } else {
    var stato = el("stato");
    stato.classList.add("errore");
    stato.textContent = "Impossibile caricare i dati: manca il file data/fermate.js " +
      "(si genera con: python scripts/prepara_dati.py).";
  }
})();
