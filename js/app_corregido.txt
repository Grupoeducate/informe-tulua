(() => {
  "use strict";

  const PATHS = Object.freeze({
    config: "./data/configuracion.json",
    municipio: "./data/consolidados/municipio.json",
    prioridades: "./data/priorizacion/prioridades_municipales.json",
    plan: "./data/plan-mejoramiento/plan_mejoramiento_2027.json"
  });

  const FORMAT_2 = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  const FORMAT_0 = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0
  });

  function qs(selector) {
    return document.querySelector(selector);
  }

  function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function format2(value) {
    return isNumber(value) ? FORMAT_2.format(value) : "—";
  }

  function format0(value) {
    return isNumber(value) ? FORMAT_0.format(value) : "—";
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setText(selector, value) {
    const element = qs(selector);
    if (element) {
      element.textContent = value;
    }
  }

  async function loadJSON(path) {
    const response = await fetch(path, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(
        "No se pudo cargar " + path + " (HTTP " + response.status + ")"
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error("El archivo no contiene JSON válido: " + path);
    }
  }

  function showError(message) {
    const toast = qs("#errorToast");

    if (toast) {
      toast.textContent = message;
      toast.hidden = false;
    }

    console.error(message);
  }

  function validateMunicipio(municipio) {
    if (!municipio || typeof municipio !== "object") {
      throw new Error("municipio.json no contiene un objeto válido.");
    }

    if (!municipio.cobertura_institucional) {
      throw new Error("Falta cobertura_institucional en municipio.json.");
    }

    if (
      !municipio.poblaciones_y_aplicaciones ||
      !municipio.poblaciones_y_aplicaciones.grado_10
    ) {
      throw new Error(
        "Falta poblaciones_y_aplicaciones.grado_10 en municipio.json."
      );
    }

    if (
      !municipio.areas_evaluadas ||
      typeof municipio.areas_evaluadas !== "object"
    ) {
      throw new Error("Falta areas_evaluadas en municipio.json.");
    }
  }

  function validatePrioridades(prioridades) {
    if (!prioridades || typeof prioridades !== "object") {
      throw new Error(
        "prioridades_municipales.json no contiene un objeto válido."
      );
    }

    if (!Array.isArray(prioridades.resumen_focos_2027)) {
      throw new Error(
        "Falta resumen_focos_2027 en prioridades_municipales.json."
      );
    }

    if (!prioridades.areas || typeof prioridades.areas !== "object") {
      throw new Error("Falta areas en prioridades_municipales.json.");
    }
  }

  function renderKPIs(municipio) {
    const coverage = municipio.cobertura_institucional;
    const grade10 = municipio.poblaciones_y_aplicaciones.grado_10;
    const areas = Object.keys(municipio.areas_evaluadas || {});

    const evaluated = Number(coverage.instituciones_evaluadas);
    const official = Number(coverage.instituciones_oficiales);
    const students = Number(grade10.estudiantes_cohorte_reportados);
    const groups = Number(grade10.grupos);

    setText(
      "#kpiCoverage",
      Number.isFinite(evaluated) && Number.isFinite(official)
        ? evaluated + "/" + official
        : "—"
    );

    setText("#kpiStudents", format0(students));
    setText("#kpiGroups", format0(groups));
    setText("#kpiAreas", String(areas.length));

    setText("#heroStudents", format0(students));
    setText("#heroGroups", format0(groups));
  }

  function createFocusMap(prioridades) {
    const map = new Map();

    prioridades.resumen_focos_2027.forEach(function (item) {
      if (item && item.area_id) {
        map.set(item.area_id, item);
      }
    });

    return map;
  }

  function renderAreaCards(municipio, prioridades) {
    const container = qs("#areaCards");
    if (!container) return;

    const focusByArea = createFocusMap(prioridades);
    const entries = Object.entries(municipio.areas_evaluadas);

    container.innerHTML = entries
      .map(function (entry) {
        const id = entry[0];
        const area = entry[1] || {};
        const grade10 = area.grado_10_sigma10 || {};
        const priorityArea =
          prioridades.areas && prioridades.areas[id]
            ? prioridades.areas[id]
            : null;

        const cohort =
          priorityArea && priorityArea.cohorte_prioritaria_2027
            ? priorityArea.cohorte_prioritaria_2027
            : null;

        const low12 =
          cohort && cohort.niveles_1_2
            ? Number(cohort.niveles_1_2.porcentaje)
            : NaN;

        const institutionalPriority =
          cohort && cohort.instituciones_con_prioridad_o_alta_prioridad
            ? cohort.instituciones_con_prioridad_o_alta_prioridad
            : {};

        const focus = focusByArea.get(id) || {};
        const score = Number(grade10.promedio_municipal_ponderado);
        const progress = Number.isFinite(score)
          ? Math.max(0, Math.min(100, score))
          : 0;

        const areaName = escapeHTML(area.nombre || id);
        const focusName = escapeHTML(
          focus.competencia_foco || "Pendiente de priorización"
        );

        const priorityCount = Number(
          institutionalPriority.cantidad
        );

        return (
          '<article class="area-card">' +
            "<h3>" + areaName + "</h3>" +
            '<div class="score">' +
              "<strong>" + format2(score) + "</strong>" +
              "<span>promedio municipal</span>" +
            "</div>" +
            '<div class="progress" aria-label="Promedio ' +
              escapeHTML(format2(score)) +
              '">' +
              '<span style="width:' + progress + '%"></span>' +
            "</div>" +
            '<div class="area-meta">' +
              "<p><strong>" + format2(low12) +
                "%</strong> en niveles 1–2</p>" +
              "<p><strong>" + format0(priorityCount) +
                "</strong> instituciones con prioridad o alta prioridad</p>" +
              "<p><strong>Foco:</strong> " + focusName + "</p>" +
            "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderZoneTable(municipio) {
    const body = qs("#zoneTableBody");
    if (!body) return;

    body.innerHTML = Object.values(municipio.areas_evaluadas)
      .map(function (area) {
        const grade10 = area && area.grado_10_sigma10
          ? area.grado_10_sigma10
          : {};

        const urban = grade10.urbana || {};
        const rural = grade10.rural || {};
        const delta = Number(grade10.brecha_urbana_menos_rural);

        const className =
          Number.isFinite(delta) && delta >= 0
            ? "delta-positive"
            : "delta-negative";

        const sign =
          Number.isFinite(delta) && delta > 0 ? "+" : "";

        return (
          "<tr>" +
            "<td><strong>" + escapeHTML(area.nombre || "") + "</strong></td>" +
            "<td>" + format2(Number(urban.promedio_ponderado)) + "</td>" +
            "<td>" + format2(Number(rural.promedio_ponderado)) + "</td>" +
            '<td class="' + className + '">' +
              sign + format2(delta) +
            "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderFocusList(prioridades) {
    const container = qs("#focusList");
    if (!container) return;

    container.innerHTML = prioridades.resumen_focos_2027
      .map(function (item) {
        const rate = Number(item.competencia_recurrencia_porcentaje);

        return (
          '<article class="focus-row">' +
            '<div class="focus-area">' +
              escapeHTML(item.area || "") +
            "</div>" +
            '<div class="focus-cell">' +
              "<span>Competencia foco</span>" +
              "<strong>" + escapeHTML(item.competencia_foco || "—") + "</strong>" +
            "</div>" +
            '<div class="focus-cell">' +
              "<span>Componente foco</span>" +
              "<strong>" + escapeHTML(item.componente_foco || "—") + "</strong>" +
            "</div>" +
            '<div class="focus-rate">' +
              format2(rate) + "%" +
              "<small>recurrencia</small>" +
            "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderGrade11(municipio) {
    const body = qs("#grade11TableBody");
    if (!body) return;

    body.innerHTML = Object.values(municipio.areas_evaluadas)
      .map(function (area) {
        const grade11 = area && area.grado_11 ? area.grado_11 : {};
        const sigma = grade11.sigma11 || {};
        const master = grade11.masterpro11 || {};
        const delta = Number(grade11.diferencia_masterpro_menos_sigma);

        const className =
          Number.isFinite(delta) && delta >= 0
            ? "delta-positive"
            : "delta-negative";

        const sign =
          Number.isFinite(delta) && delta > 0 ? "+" : "";

        return (
          "<tr>" +
            "<td>" + escapeHTML(area.nombre || "") + "</td>" +
            "<td>" +
              format2(Number(sigma.promedio_municipal_ponderado)) +
            "</td>" +
            "<td>" +
              format2(Number(master.promedio_municipal_ponderado)) +
            "</td>" +
            '<td class="' + className + '">' +
              sign + format2(delta) +
            "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderRoadmap(plan) {
    const container = qs("#roadmap");
    if (!container) return;

    const cards = [
      {
        number: "01",
        title: "Comprender",
        text:
          "Socializar la línea base 2026, validar los hallazgos con docentes y acordar focos de intervención."
      },
      {
        number: "02",
        title: "Intervenir",
        text:
          "Formación docente focalizada y aplicación sostenida de estrategias de aula por competencia y componente."
      },
      {
        number: "03",
        title: "Medir",
        text:
          "Realizar mediciones de seguimiento técnicamente documentadas y comparar solo cuando exista soporte de comparabilidad."
      },
      {
        number: "04",
        title: "Ajustar y verificar",
        text:
          "Reorientar las acciones según la evidencia y valorar el ciclo completo de la Cohorte Saber 11 — 2027."
      }
    ];

    container.innerHTML = cards
      .map(function (card) {
        return (
          '<article class="roadmap-card">' +
            '<div class="roadmap-number">' +
              escapeHTML(card.number) +
            "</div>" +
            "<h3>" + escapeHTML(card.title) + "</h3>" +
            "<p>" + escapeHTML(card.text) + "</p>" +
          "</article>"
        );
      })
      .join("");

    if (
      plan &&
      plan.continuidad_alianza &&
      plan.continuidad_alianza.mensaje_ejecutivo
    ) {
      setText(
        "#allianceMessage",
        plan.continuidad_alianza.mensaje_ejecutivo
      );
    }
  }

  function setupMenu() {
    const button = qs("#menuToggle");
    const nav = qs("#mainNav");

    if (!button || !nav) return;

    button.addEventListener("click", function () {
      const open = nav.classList.toggle("open");
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", function (event) {
      const target = event.target;

      if (target && target.tagName === "A") {
        nav.classList.remove("open");
        button.setAttribute("aria-expanded", "false");
      }
    });
  }

  function setupActiveNav() {
    const links = Array.from(
      document.querySelectorAll(".main-nav a[href^='#']")
    );

    if (!links.length) return;

    const sections = links
      .map(function (link) {
        const selector = link.getAttribute("href");
        return selector ? document.querySelector(selector) : null;
      })
      .filter(function (section) {
        return Boolean(section);
      });

    if (!("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        const visible = entries
          .filter(function (entry) {
            return entry.isIntersecting;
          })
          .sort(function (a, b) {
            return b.intersectionRatio - a.intersectionRatio;
          })[0];

        if (!visible) return;

        links.forEach(function (link) {
          link.classList.toggle(
            "active",
            link.getAttribute("href") === "#" + visible.target.id
          );
        });
      },
      {
        rootMargin: "-25% 0px -65% 0px",
        threshold: [0.01, 0.25, 0.5]
      }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  async function init() {
    setupMenu();
    setupActiveNav();

    try {
      const results = await Promise.all([
        loadJSON(PATHS.config),
        loadJSON(PATHS.municipio),
        loadJSON(PATHS.prioridades),
        loadJSON(PATHS.plan)
      ]);

      const config = results[0];
      const municipio = results[1];
      const prioridades = results[2];
      const plan = results[3];

      validateMunicipio(municipio);
      validatePrioridades(prioridades);

      renderKPIs(municipio);
      renderAreaCards(municipio, prioridades);
      renderZoneTable(municipio);
      renderFocusList(prioridades);
      renderGrade11(municipio);
      renderRoadmap(plan);

      if (
        config &&
        config.aplicacion &&
        config.aplicacion.titulo
      ) {
        document.title =
          config.aplicacion.titulo + " | Tuluá 2026";
      }
    } catch (error) {
      const message =
        error && error.message
          ? error.message
          : "Error desconocido al cargar la aplicación.";

      console.error(error);

      showError(
        "No fue posible cargar correctamente los datos: " +
          message +
          " Verifica las rutas JSON y ejecuta el proyecto desde GitHub Pages o un servidor HTTP."
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
