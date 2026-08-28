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
    plan: "./data/plan-mejoramiento/plan_mejoramiento_2027.json",
    recMat: "./json-recomendaciones-areas/recomendaciones_matematicas_saber11_2026.json",
    recLectura: "./json-recomendaciones-areas/recomendaciones_lectura_critica_saber11_2026.json",
    recSociales: "./json-recomendaciones-areas/recomendaciones_sociales_ciudadanas_saber11_2026.json",
    recNaturales: "./json-recomendaciones-areas/recomendaciones_ciencias_naturales_saber11_2026.json",
    recIngles: "./json-recomendaciones-areas/recomendaciones_ingles_saber11_2026.json"
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

  const REC_KEYS = {matematicas:"recMat",lectura_critica:"recLectura",sociales_ciudadanas:"recSociales",ciencias_naturales:"recNaturales",ingles:"recIngles"};

  const fmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
  const fmt0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

  const state = { data: null, dialogInstitution: null, dialogSource: null, dialogArea: "matematicas" };

  function q(selector) { return document.querySelector(selector); }
  function qa(selector) { return Array.from(document.querySelectorAll(selector)); }
  function finite(v) { return typeof v === "number" && Number.isFinite(v); }
  function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }
  function f(v) { return finite(v) ? fmt.format(v) : "—"; }
  function f0(v) { return finite(v) ? fmt0.format(v) : "—"; }
  function norm(v) { return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

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

  function getClassInstitution(numero, source) {
    return getClassificationRows(source).find(x => x.numero === numero) || null;
  }

  function getHistoricalInstitution(numero) {
    return state.data.historico.instituciones.find(x => x.numero === numero) || null;
  }

  function getRecommendation(area, type, name) {
    const rec = state.data[REC_KEYS[area]];
    if (!rec || !rec[type]) return null;
    const target = norm(name);
    let best = null;
    Object.values(rec[type]).forEach(obj => {
      [obj.nombre, obj.nombre_en_informe, obj.proceso_2026, obj.nombre_fuente].filter(Boolean).forEach(label => {
        const candidate = norm(label);
        let score = 0;
        if (candidate === target) score = 100;
        else if (candidate.includes(target) || target.includes(candidate)) score = 85;
        else {
          const a = new Set(target.split(" ").filter(Boolean));
          const b = new Set(candidate.split(" ").filter(Boolean));
          let inter = 0; a.forEach(t => { if (b.has(t)) inter++; });
          const union = new Set([...a, ...b]).size || 1;
          score = (inter / union) * 70;
        }
        if (!best || score > best.score) best = { score, obj };
      });
    });
    return best && best.score >= 32 ? best.obj : null;
  }

  function specificActions(rec, source) {
    if (!rec) return [];
    const block = source === "sigma10" ? rec.uso_exclusivo_grado_10 : rec.uso_exclusivo_grado_11;
    if (block && Array.isArray(block.acciones_especificas) && block.acciones_especificas.length) return block.acciones_especificas.slice(0, 4);
    if (Array.isArray(rec.estrategias_metodologicas)) return rec.estrategias_metodologicas.slice(0, 3).map(x => typeof x === "string" ? x : (x.nombre || x.proposito)).filter(Boolean);
    return [];
  }

  function sourceAreaStats(source, area) {
    const vals = getInstitutionRows(source).map(x => x.areas[area].promedio).filter(x => x != null);
    return { n: vals.length, min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null };
  }

  function categoryDistribution(source, area) {
    const out = { fortaleza_relativa: 0, seguimiento: 0, prioridad: 0, alta_prioridad: 0 };
    getClassificationRows(source).forEach(inst => {
      const a = inst.areas[area];
      if (a && Object.prototype.hasOwnProperty.call(out, a.categoria_area)) out[a.categoria_area]++;
    });
    return out;
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
        '<td><button class="detail-btn" data-inst="' + inst.numero + '" data-source="' + esc(source) + '">Analizar</button></td>' +
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

  function renderAreaDecision(area, source) {
    const priority = state.data.prioridades.areas[area];
    const stats = sourceAreaStats(source, area);
    const ref = getMunicipalReference(source, area);
    const dist = source === "saber11_2025" ? null : categoryDistribution(source, area);
    const focus = priority.foco_municipal_2027;
    const plan = priority.salida_para_plan_mejoramiento;
    const accompaniment = plan.instituciones_para_acompanamiento_inicial || [];
    let measurement;
    if (source === "saber11_2025") {
      measurement = '<p><strong>' + stats.n + ' instituciones</strong> con dato. Rango institucional observado: <strong>' + f(stats.min) + '–' + f(stats.max) + '</strong>. No se calcula promedio municipal ponderado con esta fuente.</p>';
    } else {
      measurement = '<p>Referente municipal ponderado: <strong>' + f(ref) + '</strong>. Rango institucional observado: <strong>' + f(stats.min) + '–' + f(stats.max) + '</strong>.</p>' +
        '<div class="category-mini"><span>Fortaleza relativa: ' + dist.fortaleza_relativa + '</span><span>Seguimiento: ' + dist.seguimiento + '</span><span>Prioridad: ' + dist.prioridad + '</span><span>Alta prioridad: ' + dist.alta_prioridad + '</span></div>';
    }
    q("#areaDecision").innerHTML =
      '<span class="micro-label">Lectura para la decisión</span><div class="area-decision-grid">' +
      '<article class="decision-panel"><h4>' + esc(SOURCE_LABELS[source]) + '</h4>' + measurement + '<div class="decision-kpis"><div class="decision-kpi"><span>Instituciones con dato</span><b>' + stats.n + '</b></div><div class="decision-kpi"><span>Amplitud observada</span><b>' + f(stats.max != null && stats.min != null ? stats.max - stats.min : null) + '</b></div></div></article>' +
      '<article class="decision-panel accent"><span class="micro-label">Foco de intervención 2027 · Grado 10</span><h4>' + esc(focus.competencia.nombre) + '</h4><p>Componente asociado: <strong>' + esc(focus.componente.nombre) + '</strong>. La competencia aparece como menor puntaje institucional con recurrencia equivalente de <strong>' + f(n(focus.competencia.porcentaje_instituciones_equivalente)) + '%</strong>.</p></article>' +
      '<article class="decision-panel"><span class="micro-label">Acción pedagógica</span><h4>' + esc(plan.objetivo) + '</h4><ul class="action-list">' + plan.acciones_iniciales.slice(0,3).map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></article></div>' +
      '<div class="accompaniment"><span>Instituciones para acompañamiento inicial en ' + esc(AREA_LABELS[area]) + '</span><div class="accompaniment-tags">' + accompaniment.map(x => '<button type="button" data-open-inst="' + x.numero + '">' + esc(x.nombre) + '</button>').join("") + '</div></div>';
    qa("[data-open-inst]").forEach(btn => btn.addEventListener("click", () => openInstitution(Number(btn.dataset.openInst), source === "saber11_2025" ? "sigma10" : source, area)));
  }

  function renderAreaComparison() {
    const area = q("#areaSelect").value;
    const source = q("#areaSource").value;
    const rows = getInstitutionRows(source).map(inst => ({ numero: inst.numero, nombre: inst.nombre, zona: inst.zona, score: inst.areas[area].promedio })).sort((a,b) => {
      if (a.score == null && b.score == null) return a.nombre.localeCompare(b.nombre,"es");
      if (a.score == null) return 1; if (b.score == null) return -1; return b.score - a.score;
    });
    const ref = getMunicipalReference(source, area);
    q("#areaComparisonTitle").textContent = AREA_LABELS[area];
    q("#areaReferenceBox").innerHTML = ref == null ?
      "<strong>" + esc(SOURCE_LABELS[source]) + ".</strong> No se muestra referente municipal ponderado porque esta fuente no contiene tamaños institucionales de población." :
      "<strong>Referente municipal ponderado: " + f(ref) + ".</strong> La línea vertical en cada barra indica este referente.";
    q("#areaBars").innerHTML = rows.map(inst => {
      const width = inst.score == null ? 0 : Math.max(0, Math.min(100, inst.score));
      const refLine = ref == null ? "" : '<span class="reference-line" style="left:' + Math.max(0, Math.min(100, ref)) + '%"></span>';
      return '<div class="bar-row clickable" data-bar-inst="' + inst.numero + '" data-bar-source="' + esc(source) + '"><span class="bar-label" title="' + esc(inst.nombre) + '">' + esc(inst.nombre) + '</span><div class="bar-track"><span class="bar-fill" style="width:' + width + '%"></span>' + refLine + '</div><strong class="bar-value">' + (inst.score == null ? "—" : f(inst.score)) + '</strong></div>';
    }).join("");
    qa("[data-bar-inst]").forEach(row => row.addEventListener("click", () => openInstitution(Number(row.dataset.barInst), row.dataset.barSource, area)));
    renderAreaDecision(area, source);
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

  function historicalContext(numero, area) {
    const h = getHistoricalInstitution(numero);
    if (!h || !h.registro_saber11_2025_2 || !h.resultados) {
      return '<div class="history-context"><div class="year-badge">25</div><div><h4>Saber 11 2025-2</h4><p>Sin dato disponible para esta institución en la fuente histórica consultada.</p></div></div>';
    }
    const score = h.resultados[area];
    return '<div class="history-context"><div class="year-badge">25</div><div><h4>Referente histórico externo · ' + esc(AREA_LABELS[area]) + '</h4><p>Registro fuente: ' + esc(h.nombre_fuente_original || h.nombre) + '. No se interpreta como medición equivalente a GEC 2026.</p><div class="history-scores"><span>Promedio: <strong>' + f(n(score.promedio)) + '</strong></span><span>DE: <strong>' + f(n(score.desviacion_estandar)) + '</strong></span></div></div></div>';
  }

  function renderInstitutionDialog() {
    const numero = state.dialogInstitution, source = state.dialogSource, area = state.dialogArea;
    const inst = getInstitutionRows(source).find(x => x.numero === numero);
    if (!inst) return;
    const classInst = getClassInstitution(numero, source);
    const classArea = classInst && classInst.areas ? classInst.areas[area] : null;
    const score = inst.areas[area];
    const ref = getMunicipalReference(source, area);
    const delta = score.promedio != null && ref != null ? score.promedio - ref : null;
    const sign = delta != null && delta > 0 ? "+" : "";
    const historical = source === "saber11_2025";
    const overview = AREA_ORDER.map(a => {
      const v = inst.areas[a];
      const cat = classInst && classInst.areas[a] ? classInst.areas[a].etiqueta_categoria_area : null;
      return '<article class="dialog-score"><span>' + esc(AREA_LABELS[a]) + '</span><strong>' + (v.promedio == null ? "—" : f(v.promedio)) + '</strong><small>' + (cat ? esc(cat) : (v.promedio == null ? "Sin dato" : "DE: " + f(v.desviacion_estandar))) + '</small></article>';
    }).join("");
    let analysis = "";
    if (historical) {
      analysis = '<div class="detail-section"><div class="detail-section-head"><div><span class="micro-label">Alcance de la fuente</span><h3>Referente histórico institucional</h3></div></div><div class="no-tech-detail">Esta fuente aporta promedio y desviación estándar por área, pero no competencias, componentes o niveles. Para análisis pedagógico seleccione Sigma 10, Sigma 11 o Master Pro 11.</div></div>';
    } else if (classArea) {
      const comps = [...(classArea.competencias || [])].sort((a,b) => a.puntaje - b.puntaje);
      const components = [...(classArea.componentes || [])].sort((a,b) => a.puntaje - b.puntaje);
      const weakComp = comps[0] || null, weakComponent = components[0] || null;
      const recComp = weakComp ? getRecommendation(area, "competencias", weakComp.nombre) : null;
      const recComponent = weakComponent ? getRecommendation(area, "componentes", weakComponent.nombre) : null;
      const actions = specificActions(recComp, source);
      analysis = '<div class="dialog-summary"><article class="dialog-summary-card"><span class="micro-label">Lectura frente al municipio</span><h3>' + esc(AREA_LABELS[area]) + '</h3><div class="big-metric"><strong>' + f(score.promedio) + '</strong><span>resultado institucional</span></div>' +
        (ref != null ? '<span class="delta-chip">' + sign + f(delta) + ' puntos frente al referente municipal (' + f(ref) + ')</span>' : '') +
        '<p style="margin-top:9px">DE institucional: <strong>' + f(score.desviacion_estandar) + '</strong> · Evaluados en el área: <strong>' + f0(n(classArea.total_evaluados_area)) + '</strong>.</p></article>' +
        '<article class="dialog-summary-card accent"><span class="micro-label">Prioridad relativa</span><h3>' + esc(classArea.etiqueta_categoria_area) + '</h3><p>Percentil del promedio: <strong>' + f(n(classArea.percentil_promedio_area)) + '</strong>. Estudiantes en niveles 1–2: <strong>' + f(n(classArea.porcentaje_niveles_1_2)) + '%</strong>.</p><p style="margin-top:8px">La categoría orienta focalización y no es una clasificación oficial del Icfes.</p></article></div>' +
        '<div class="detail-section"><div class="detail-section-head"><div><span class="micro-label">Diagnóstico pedagógico</span><h3>Competencias y componentes</h3></div><p>Ordenados de menor a mayor puntaje dentro de esta institución. El percentil compara el mismo indicador entre instituciones.</p></div><div class="indicator-grid"><div class="indicator-column"><h4>Competencias</h4>' + comps.map(x => '<div class="indicator-item"><div class="indicator-name">' + esc(x.nombre) + '<small>' + esc(x.etiqueta_categoria) + ' · percentil ' + f(n(x.percentil_relativo)) + '</small></div><div class="indicator-score">' + f(n(x.puntaje)) + '</div></div>').join("") + '</div><div class="indicator-column"><h4>Componentes</h4>' + components.map(x => '<div class="indicator-item"><div class="indicator-name">' + esc(x.nombre) + '<small>' + esc(x.etiqueta_categoria) + ' · percentil ' + f(n(x.percentil_relativo)) + '</small></div><div class="indicator-score">' + f(n(x.puntaje)) + '</div></div>').join("") + '</div></div></div>' +
        '<div class="detail-section"><div class="recommendation-box"><div><span class="micro-label">Hipótesis pedagógica orientadora</span><h4>' + (recComp ? esc(recComp.objetivo_de_mejoramiento || "Fortalecer la competencia priorizada") : "Fortalecer el indicador de menor desempeño") + '</h4><p>' + (recComp ? esc(recComp.diagnostico_pedagogico || "") : "La lectura debe contrastarse con evidencias de aula antes de atribuir causas.") + '</p></div><div><span class="micro-label">Acciones sugeridas</span><ul>' +
        (actions.length ? actions.map(x => '<li>' + esc(x) + '</li>').join("") : '<li>Contrastar el resultado con evidencias de aula.</li><li>Diseñar práctica focalizada.</li><li>Aplicar seguimiento formativo.</li>') +
        (recComponent && Array.isArray(recComponent.focos_de_trabajo) && recComponent.focos_de_trabajo.length ? '<li><strong>Componente ' + esc(weakComponent.nombre) + ':</strong> ' + esc(recComponent.focos_de_trabajo.slice(0,2).join(" · ")) + '</li>' : '') + '</ul></div></div></div>';
    }
    q("#institutionDialogContent").innerHTML = '<div class="dialog-content"><span class="micro-label">' + esc(SOURCE_LABELS[source]) + '</span><h2>' + esc(inst.nombre) + '</h2><div class="dialog-meta"><span class="zone-tag">' + esc(inst.zona) + '</span><span class="zone-tag">DANE ' + esc(inst.dane) + '</span></div>' +
      '<div class="dialog-toolbar"><label><span>Fuente / medición</span><select id="dialogSource">' + Object.keys(SOURCE_LABELS).map(k => '<option value="' + k + '" ' + (k === source ? 'selected' : '') + '>' + esc(SOURCE_LABELS[k]) + '</option>').join("") + '</select></label><label><span>Área de análisis</span><select id="dialogArea">' + AREA_ORDER.map(k => '<option value="' + k + '" ' + (k === area ? 'selected' : '') + '>' + esc(AREA_LABELS[k]) + '</option>').join("") + '</select></label></div>' +
      '<div class="dialog-grid">' + overview + '</div>' + analysis + '<div class="detail-section">' + historicalContext(numero, area) + '</div></div>';
    q("#dialogSource").addEventListener("change", e => { state.dialogSource = e.target.value; renderInstitutionDialog(); });
    q("#dialogArea").addEventListener("change", e => { state.dialogArea = e.target.value; renderInstitutionDialog(); });
  }

  function openInstitution(numero, source, area) {
    state.dialogInstitution = numero; state.dialogSource = source; state.dialogArea = area || "matematicas";
    renderInstitutionDialog();
    const dialog = q("#institutionDialog");
    if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    else if (!dialog.open) dialog.setAttribute("open", "open");
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
