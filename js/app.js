(() => {
  "use strict";

  const PATHS = {
    config: "./data/configuracion.json",
    municipio: "./data/consolidados/municipio.json",
    grado10: "./data/consolidados/grado10.json",
    grado11: "./data/consolidados/grado11.json",
    historico: "./data/historico/saber11_2025.json",
    class10: "./data/clasificaciones/clasificaciones_grado10.json",
    class11: "./data/clasificaciones/clasificaciones_grado11.json",
    prioridades: "./data/priorizacion/prioridades_municipales.json",
    plan: "./data/plan-mejoramiento/plan_mejoramiento_2027.json"
  };

  const AREA_ORDER = ["matematicas", "lectura_critica", "sociales_ciudadanas", "ciencias_naturales", "ingles"];
  const AREA_LABELS = {
    matematicas: "Matemáticas",
    lectura_critica: "Lectura Crítica",
    sociales_ciudadanas: "Sociales y Ciudadanas",
    ciencias_naturales: "Ciencias Naturales",
    ingles: "Inglés"
  };
  const SOURCE_LABELS = {
    masterpro11: "Master Pro 11 — 2026",
    sigma11: "Sigma 11 — 2026",
    sigma10: "Sigma 10 — 2026",
    saber11_2025: "Saber 11 2025-2"
  };

  const fmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
  const fmt0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

  const state = { data: null };

  function q(selector) { return document.querySelector(selector); }
  function qa(selector) { return Array.from(document.querySelectorAll(selector)); }
  function finite(v) { return typeof v === "number" && Number.isFinite(v); }
  function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }
  function f(v) { return finite(v) ? fmt.format(v) : "—"; }
  function f0(v) { return finite(v) ? fmt0.format(v) : "—"; }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  async function loadJSON(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(path + " · HTTP " + r.status);
    try { return await r.json(); }
    catch (_) { throw new Error(path + " · JSON inválido"); }
  }

  function showError(message) {
    const el = q("#errorToast");
    if (el) { el.textContent = message; el.hidden = false; }
    console.error(message);
  }

  function getInstitutionRows(source) {
    const d = state.data;
    if (!d) return [];

    if (source === "sigma10") {
      return d.grado10.instituciones.map(inst => ({
        numero: inst.numero, nombre: inst.nombre, dane: inst.dane, zona: inst.zona,
        areas: Object.fromEntries(AREA_ORDER.map(a => [a, {
          promedio: n(inst.areas[a] && inst.areas[a].promedio),
          desviacion_estandar: n(inst.areas[a] && inst.areas[a].desviacion_estandar)
        }]))
      }));
    }

    if (source === "sigma11" || source === "masterpro11") {
      return d.grado11.instituciones.map(inst => ({
        numero: inst.numero, nombre: inst.nombre, dane: inst.dane, zona: inst.zona,
        areas: Object.fromEntries(AREA_ORDER.map(a => {
          const block = inst.comparacion_areas[a] && inst.comparacion_areas[a][source];
          return [a, {
            promedio: n(block && block.promedio),
            desviacion_estandar: n(block && block.desviacion_estandar)
          }];
        }))
      }));
    }

    if (source === "saber11_2025") {
      return d.historico.instituciones.map(inst => ({
        numero: inst.numero, nombre: inst.nombre, dane: inst.dane, zona: inst.zona,
        areas: Object.fromEntries(AREA_ORDER.map(a => [a, {
          promedio: inst.resultados ? n(inst.resultados[a].promedio) : null,
          desviacion_estandar: inst.resultados ? n(inst.resultados[a].desviacion_estandar) : null
        }])),
        registro: inst.registro_saber11_2025_2
      }));
    }
    return [];
  }

  function getClassificationRows(source) {
    const d = state.data;
    if (source === "sigma10") return d.class10.aplicacion.instituciones || [];
    if (source === "sigma11" || source === "masterpro11") {
      return d.class11.aplicaciones[source].instituciones || [];
    }
    return [];
  }

  function getMunicipalReference(source, area) {
    const a = state.data.municipio.areas_evaluadas[area];
    if (!a) return null;
    if (source === "sigma10") return n(a.grado_10_sigma10.promedio_municipal_ponderado);
    if (source === "sigma11") return n(a.grado_11.sigma11.promedio_municipal_ponderado);
    if (source === "masterpro11") return n(a.grado_11.masterpro11.promedio_municipal_ponderado);
    return null;
  }

  function renderKPIs() {
    const m = state.data.municipio;
    const coverage = m.cobertura_institucional;
    const g10 = m.poblaciones_y_aplicaciones.grado_10;
    const g11 = m.poblaciones_y_aplicaciones.grado_11;

    q("#kpiCoverage").textContent = coverage.instituciones_evaluadas + "/" + coverage.instituciones_oficiales;
    q("#kpiG10").textContent = f0(n(g10.estudiantes_cohorte_reportados));

    const sigma = g11.aplicaciones.find(x => x.id === "sigma11");
    const master = g11.aplicaciones.find(x => x.id === "masterpro11");
    q("#kpiSigma11").textContent = f0(n(sigma && sigma.participantes_reportados));
    q("#kpiMaster11").textContent = f0(n(master && master.participantes_reportados));
  }

  function renderStatus() {
    const m = state.data.municipio;
    const p = state.data.prioridades;

    q("#grade11Scores").innerHTML = AREA_ORDER.map(a => {
      const block = m.areas_evaluadas[a].grado_11;
      const current = n(block.masterpro11.promedio_municipal_ponderado);
      const delta = n(block.diferencia_masterpro_menos_sigma);
      const cls = delta != null && delta >= 0 ? "positive" : "negative";
      const sign = delta != null && delta > 0 ? "+" : "";
      return '<div class="score-row">' +
        '<span class="score-name">' + esc(AREA_LABELS[a]) + '</span>' +
        '<strong class="score-value">' + f(current) + '</strong>' +
        '<span class="score-meta ' + cls + '">' + (delta == null ? "—" : sign + f(delta) + " vs Sigma") + '</span>' +
      '</div>';
    }).join("");

    const prioByArea = Object.fromEntries(p.resumen_focos_2027.map(x => [x.area_id, x]));
    q("#grade10Scores").innerHTML = AREA_ORDER.map(a => {
      const block = m.areas_evaluadas[a].grado_10_sigma10;
      const low = prioByArea[a] ? n(prioByArea[a].porcentaje_niveles_1_2) : null;
      return '<div class="score-row">' +
        '<span class="score-name">' + esc(AREA_LABELS[a]) + '</span>' +
        '<strong class="score-value">' + f(n(block.promedio_municipal_ponderado)) + '</strong>' +
        '<span class="score-meta">' + f(low) + '% niv. 1–2</span>' +
      '</div>';
    }).join("");

    const h = state.data.historico;
    q("#historyWithData").textContent = String(h.integridad.con_registro_2025);
    const missing = h.instituciones.find(x => !x.registro_saber11_2025_2);
    q("#historyMissing").textContent = missing ? missing.nombre : "Una institución";
  }

  function renderInsights() {
    const m = state.data.municipio;
    const p = state.data.prioridades.resumen_focos_2027;

    const g11Deltas = AREA_ORDER.map(a => ({
      area: AREA_LABELS[a],
      delta: n(m.areas_evaluadas[a].grado_11.diferencia_masterpro_menos_sigma)
    }));
    const positive = g11Deltas.filter(x => x.delta != null && x.delta > 0).length;
    const negative = g11Deltas.filter(x => x.delta != null && x.delta < 0);
    const highLow = [...p].sort((a,b) => b.porcentaje_niveles_1_2 - a.porcentaje_niveles_1_2).slice(0,2);
    const gaps = p.map(x => x.brecha_urbana_menos_rural);
    const minGap = Math.min.apply(null, gaps);
    const maxGap = Math.max.apply(null, gaps);

    const insights = [
      {
        title: "Grado 11 exige una lectura por área",
        text: "Master Pro 11 presenta un promedio mayor que Sigma 11 en <strong>" + positive +
          " de 5 áreas</strong>. " +
          (negative.length ? "<strong>" + esc(negative[0].area) + "</strong> muestra una diferencia negativa. " : "") +
          "Estas diferencias son descriptivas."
      },
      {
        title: "La cohorte 2027 tiene focos claros",
        text: "Las mayores concentraciones de estudiantes en niveles 1–2 se observan en <strong>" +
          esc(highLow[0].area) + " (" + f(n(highLow[0].porcentaje_niveles_1_2)) + "%)</strong> y <strong>" +
          esc(highLow[1].area) + " (" + f(n(highLow[1].porcentaje_niveles_1_2)) + "%)</strong>."
      },
      {
        title: "La brecha territorial aparece en las cinco áreas",
        text: "En grado 10, el promedio urbano supera al rural en las cinco áreas; las diferencias observadas van de <strong>" +
          f(minGap) + " a " + f(maxGap) + " puntos</strong>. No se atribuye causalidad a la zona."
      }
    ];

    q("#insightGrid").innerHTML = insights.map((x,i) =>
      '<article class="insight"><b>0' + (i+1) + '</b><h3>' + esc(x.title) + '</h3><p>' + x.text + '</p></article>'
    ).join("");
  }

  function renderInstitutionTable() {
    const source = q("#institutionSource").value;
    const zone = q("#institutionZone").value;
    const order = q("#institutionOrder").value;
    const search = q("#institutionSearch").value.trim().toLowerCase();

    let rows = getInstitutionRows(source).filter(x => {
      const zoneOK = zone === "todas" || x.zona === zone;
      const searchOK = !search || x.nombre.toLowerCase().includes(search);
      return zoneOK && searchOK;
    });

    if (order === "nombre") {
      rows.sort((a,b) => a.nombre.localeCompare(b.nombre, "es"));
    } else {
      rows.sort((a,b) => {
        const av = a.areas[order].promedio;
        const bv = b.areas[order].promedio;
        if (av == null && bv == null) return a.nombre.localeCompare(b.nombre, "es");
        if (av == null) return 1;
        if (bv == null) return -1;
        return bv - av;
      });
    }

    q("#institutionTable").innerHTML = rows.map(inst => {
      const cells = AREA_ORDER.map(a => {
        const v = inst.areas[a].promedio;
        return '<td class="' + (v == null ? "no-data" : "") + '">' + (v == null ? "Sin dato" : f(v)) + '</td>';
      }).join("");
      return '<tr>' +
        '<td><span class="inst-name">' + esc(inst.nombre) + '</span></td>' +
        '<td><span class="zone-tag">' + esc(inst.zona) + '</span></td>' +
        cells +
        '<td><button class="detail-btn" data-inst="' + inst.numero + '" data-source="' + esc(source) + '">Ver</button></td>' +
      '</tr>';
    }).join("");

    q("#institutionCount").textContent = rows.length + " instituciones visibles";

    if (source === "saber11_2025") {
      q("#institutionSourceMessage").innerHTML =
        "<strong>Saber 11 2025-2:</strong> referente histórico externo. No existe promedio municipal ponderado en esta fuente porque el archivo no contiene el número de evaluados por institución.";
    } else if (source === "sigma11" || source === "masterpro11") {
      q("#institutionSourceMessage").innerHTML =
        "<strong>" + esc(SOURCE_LABELS[source]) + ":</strong> comparación institucional dentro de la misma medición GEC de grado 11.";
    } else {
      q("#institutionSourceMessage").innerHTML =
        "<strong>Sigma 10 — 2026:</strong> línea base de la Cohorte Saber 11 — 2027.";
    }

    qa(".detail-btn").forEach(btn => btn.addEventListener("click", () => openInstitution(Number(btn.dataset.inst), btn.dataset.source)));
  }

  function renderHeatmap() {
    const source = q("#heatmapSource").value;
    const rows = getClassificationRows(source);
    const grid = q("#heatmap");

    let html = '<div class="heat-grid">';
    html += '<div class="heat-head">Institución</div>' +
      AREA_ORDER.map(a => '<div class="heat-head">' + esc(AREA_LABELS[a]) + '</div>').join("");

    rows.forEach(inst => {
      html += '<div class="heat-name">' + esc(inst.nombre) + '</div>';
      AREA_ORDER.forEach(a => {
        const area = inst.areas[a];
        const cat = area ? area.categoria_area : "";
        const score = area ? n(area.promedio) : null;
        const label = area ? area.etiqueta_categoria_area : "Sin dato";
        html += '<div class="heat-cell ' + esc(cat) + '" tabindex="0" role="button" ' +
          'title="' + esc(label + " · " + (score == null ? "Sin dato" : f(score))) + '" ' +
          'data-inst="' + inst.numero + '" data-source="' + esc(source) + '">' +
          (score == null ? "—" : f(score)) + '</div>';
      });
    });
    html += "</div>";
    grid.innerHTML = html;

    qa(".heat-cell[data-inst]").forEach(cell => {
      const handler = () => openInstitution(Number(cell.dataset.inst), cell.dataset.source);
      cell.addEventListener("click", handler);
      cell.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") handler(); });
    });
  }

  function renderAreaComparison() {
    const area = q("#areaSelect").value;
    const source = q("#areaSource").value;
    const rows = getInstitutionRows(source).map(inst => ({
      numero: inst.numero, nombre: inst.nombre, zona: inst.zona,
      score: inst.areas[area].promedio
    })).sort((a,b) => {
      if (a.score == null && b.score == null) return a.nombre.localeCompare(b.nombre,"es");
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score;
    });

    const ref = getMunicipalReference(source, area);
    q("#areaComparisonTitle").textContent = AREA_LABELS[area];

    if (ref == null) {
      q("#areaReferenceBox").innerHTML =
        "<strong>" + esc(SOURCE_LABELS[source]) + ".</strong> No se muestra referente municipal ponderado porque esta fuente no contiene tamaños institucionales de población.";
    } else {
      q("#areaReferenceBox").innerHTML =
        "<strong>Referente municipal ponderado: " + f(ref) + ".</strong> La línea vertical en cada barra indica este referente.";
    }

    q("#areaBars").innerHTML = rows.map(inst => {
      const width = inst.score == null ? 0 : Math.max(0, Math.min(100, inst.score));
      const refLine = ref == null ? "" : '<span class="reference-line" style="left:' + Math.max(0, Math.min(100, ref)) + '%"></span>';
      return '<div class="bar-row">' +
        '<span class="bar-label" title="' + esc(inst.nombre) + '">' + esc(inst.nombre) + '</span>' +
        '<div class="bar-track"><span class="bar-fill" style="width:' + width + '%"></span>' + refLine + '</div>' +
        '<strong class="bar-value">' + (inst.score == null ? "—" : f(inst.score)) + '</strong>' +
      '</div>';
    }).join("");
  }

  function renderTerritory() {
    const m = state.data.municipio;
    q("#territoryTable").innerHTML =
      '<div class="territory-row head"><span>Área</span><span>Urbana</span><span>Rural</span><span>Brecha</span></div>' +
      AREA_ORDER.map(a => {
        const b = m.areas_evaluadas[a].grado_10_sigma10;
        const gap = n(b.brecha_urbana_menos_rural);
        return '<div class="territory-row">' +
          '<span>' + esc(AREA_LABELS[a]) + '</span>' +
          '<span>' + f(n(b.urbana.promedio_ponderado)) + '</span>' +
          '<span>' + f(n(b.rural.promedio_ponderado)) + '</span>' +
          '<strong>+' + f(gap) + '</strong>' +
        '</div>';
      }).join("");
  }

  function renderPriorities() {
    const rows = state.data.prioridades.resumen_focos_2027;
    q("#priorityGrid").innerHTML = rows.map(x =>
      '<article class="priority-card">' +
        '<h3>' + esc(x.area) + '</h3>' +
        '<span class="priority-label">Competencia foco</span>' +
        '<strong>' + esc(x.competencia_foco) + '</strong>' +
        '<span class="priority-label">Componente foco</span>' +
        '<strong>' + esc(x.componente_foco) + '</strong>' +
        '<div class="recurrence"><span>Recurrencia competencia</span><b>' + f(n(x.competencia_recurrencia_porcentaje)) + '%</b></div>' +
      '</article>'
    ).join("");
  }

  function openInstitution(numero, source) {
    const rows = getInstitutionRows(source);
    const inst = rows.find(x => x.numero === numero);
    if (!inst) return;

    const classRows = source === "saber11_2025" ? [] : getClassificationRows(source);
    const classInst = classRows.find(x => x.numero === numero);

    const scoreCards = AREA_ORDER.map(a => {
      const area = inst.areas[a];
      const cat = classInst && classInst.areas[a] ? classInst.areas[a].etiqueta_categoria_area : null;
      return '<article class="dialog-score">' +
        '<span>' + esc(AREA_LABELS[a]) + '</span>' +
        '<strong>' + (area.promedio == null ? "—" : f(area.promedio)) + '</strong>' +
        '<small>' + (cat ? esc(cat) : (area.promedio == null ? "Sin dato en la fuente" : "DE: " + f(area.desviacion_estandar))) + '</small>' +
      '</article>';
    }).join("");

    let note;
    if (source === "saber11_2025") {
      note = "Saber 11 2025-2 es un referente histórico externo. No debe interpretarse su diferencia con GEC 2026 como ganancia o pérdida de aprendizaje.";
    } else {
      note = "La categoría visible es relativa a las demás instituciones para el mismo indicador y medición; orienta focalización pedagógica y no constituye una clasificación oficial del Icfes.";
    }

    q("#institutionDialogContent").innerHTML =
      '<div class="dialog-content">' +
        '<span class="micro-label">' + esc(SOURCE_LABELS[source]) + '</span>' +
        '<h2>' + esc(inst.nombre) + '</h2>' +
        '<div class="dialog-meta"><span class="zone-tag">' + esc(inst.zona) + '</span><span class="zone-tag">DANE ' + esc(inst.dane) + '</span></div>' +
        '<div class="dialog-grid">' + scoreCards + '</div>' +
        '<div class="dialog-note">' + esc(note) + '</div>' +
      '</div>';

    const dialog = q("#institutionDialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
  }

  function bindUI() {
    ["institutionSource","institutionZone","institutionOrder"].forEach(id => q("#"+id).addEventListener("change", renderInstitutionTable));
    q("#institutionSearch").addEventListener("input", renderInstitutionTable);
    q("#heatmapSource").addEventListener("change", renderHeatmap);
    q("#areaSelect").addEventListener("change", renderAreaComparison);
    q("#areaSource").addEventListener("change", renderAreaComparison);

    q("#showHistoryBtn").addEventListener("click", () => {
      q("#institutionSource").value = "saber11_2025";
      q("#institutionZone").value = "todas";
      q("#institutionOrder").value = "nombre";
      renderInstitutionTable();
      q("#instituciones").scrollIntoView({behavior:"smooth"});
    });

    qa("[data-scroll]").forEach(btn => btn.addEventListener("click", () => {
      const target = q(btn.dataset.scroll);
      if (target) target.scrollIntoView({behavior:"smooth"});
    }));

    const menuBtn = q("#menuBtn");
    const nav = q("#mainNav");
    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", e => {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded","false");
      }
    });

    if ("IntersectionObserver" in window) {
      const links = qa(".nav a[href^='#']");
      const sections = links.map(x => q(x.getAttribute("href"))).filter(Boolean);
      const observer = new IntersectionObserver(entries => {
        const visible = entries.filter(x => x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
        if (!visible) return;
        links.forEach(link => link.classList.toggle("active", link.getAttribute("href") === "#" + visible.target.id));
      }, {rootMargin:"-25% 0px -65% 0px", threshold:[.01,.25,.5]});
      sections.forEach(s => observer.observe(s));
    }
  }

  function renderContinuity() {
    const msg = state.data.plan && state.data.plan.continuidad_alianza && state.data.plan.continuidad_alianza.mensaje_ejecutivo;
    if (msg) q("#continuityMessage").textContent = msg;
  }

  async function init() {
    try {
      const keys = Object.keys(PATHS);
      const values = await Promise.all(keys.map(k => loadJSON(PATHS[k])));
      state.data = Object.fromEntries(keys.map((k,i) => [k, values[i]]));

      renderKPIs();
      renderStatus();
      renderInsights();
      renderInstitutionTable();
      renderHeatmap();
      renderAreaComparison();
      renderTerritory();
      renderPriorities();
      renderContinuity();
      bindUI();
    } catch (err) {
      showError("No fue posible cargar el informe: " + (err && err.message ? err.message : String(err)));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
