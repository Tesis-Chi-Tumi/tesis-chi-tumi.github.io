/* Gráficos SVG del prototipo (datos sintéticos de ejemplo, no reales). */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function aleatorio(semilla) {
    let s = semilla >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function el(nombre, attrs, padre) {
    const n = document.createElementNS(NS, nombre);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  }

  /* Rodamiento 6309 a 1480 rpm (24.7 Hz). Factores aproximados de frecuencias de falla. */
  const GIRO = 24.67;
  const FRECUENCIAS = [
    { id: 'bpfo', nombre: 'Pista externa', sigla: 'BPFO', hz: GIRO * 3.07 },
    { id: 'bpfi', nombre: 'Pista interna', sigla: 'BPFI', hz: GIRO * 4.93 },
    { id: 'bsf', nombre: 'Elementos rodantes', sigla: 'BSF', hz: GIRO * 2.02 },
    { id: 'ftf', nombre: 'Jaula', sigla: 'FTF', hz: GIRO * 0.38 },
  ];

  function espectro({ semilla = 7, falla = 'bpfo', severidad = 1, puntos = 900, maxHz = 450 } = {}) {
    const r = aleatorio(semilla);
    const picos = [
      { hz: GIRO, a: 0.30 }, { hz: GIRO * 2, a: 0.11 }, { hz: GIRO * 3, a: 0.05 },
    ];
    const f = FRECUENCIAS.find(x => x.id === falla);
    if (f && severidad > 0) {
      [0.42, 0.22, 0.11].forEach((a, i) => picos.push({ hz: f.hz * (i + 1), a: a * severidad }));
      picos.push({ hz: f.hz - GIRO, a: 0.06 * severidad }, { hz: f.hz + GIRO, a: 0.06 * severidad });
    }
    const datos = [];
    for (let i = 0; i < puntos; i++) {
      const hz = (i / (puntos - 1)) * maxHz;
      let a = 0.018 + 0.03 * Math.exp(-hz / 60) + r() * 0.014;
      for (const p of picos) a += p.a * Math.exp(-((hz - p.hz) ** 2) / (2 * 0.9 ** 2));
      datos.push([hz, a]);
    }
    return datos;
  }

  /* Dibuja el espectro con marcadores de frecuencias de falla.
     opciones: { falla, mostrar: ['bpfo',...], anotar: bool, animar: bool, alto } */
  function dibujarEspectro(contenedor, datos, opciones = {}) {
    const ancho = contenedor.clientWidth || opciones.ancho || 960, alto = opciones.alto || 320;
    const m = { izq: 44, der: 16, sup: 46, inf: 44 };
    const maxHz = datos[datos.length - 1][0];
    const maxA = Math.max(...datos.map(d => d[1])) * 1.12;
    const x = hz => m.izq + (hz / maxHz) * (ancho - m.izq - m.der);
    const y = a => alto - m.inf - (a / maxA) * (alto - m.sup - m.inf);

    contenedor.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${ancho} ${alto}`, class: 'grafico-espectro', role: 'img',
      'aria-label': opciones.etiqueta || 'Espectro de vibración con frecuencias de falla del rodamiento' }, contenedor);

    // Cuadrícula y ejes
    for (let hz = 0; hz <= maxHz; hz += 50) {
      el('line', { x1: x(hz), x2: x(hz), y1: m.sup, y2: alto - m.inf, class: 'cuadricula' }, svg);
      el('text', { x: x(hz), y: alto - m.inf + 18, class: 'eje', 'text-anchor': 'middle' }, svg).textContent = hz;
    }
    el('text', { x: ancho - m.der, y: alto - 4, class: 'eje', 'text-anchor': 'end' }, svg).textContent = 'Frecuencia (Hz)';
    el('text', { x: 0, y: 0, class: 'eje', 'text-anchor': 'middle',
      transform: `translate(16 ${(m.sup + alto - m.inf) / 2}) rotate(-90)` }, svg).textContent = 'Amplitud (g)';
    el('line', { x1: m.izq, x2: ancho - m.der, y1: alto - m.inf, y2: alto - m.inf, class: 'eje-linea' }, svg);

    // Marcadores de frecuencias de falla (fundamental + armónicos)
    const mostrar = opciones.mostrar || FRECUENCIAS.map(f => f.id);
    const capaMarcas = el('g', { class: 'marcas' }, svg);
    FRECUENCIAS.forEach(f => {
      if (!mostrar.includes(f.id)) return;
      const activa = f.id === opciones.falla;
      // Solo la falla diagnosticada muestra armónicos; las demás, su fundamental.
      for (let k = 1; k <= (activa ? 3 : 1); k++) {
        const hz = f.hz * k;
        if (hz > maxHz) break;
        el('line', { x1: x(hz), x2: x(hz), y1: m.sup - (activa ? 22 : 8), y2: alto - m.inf,
          class: 'marca-falla ' + (activa ? 'marca-activa' : 'marca-tenue'), 'data-f': f.id }, capaMarcas);
        el('text', { x: x(hz), y: activa ? m.sup - 28 : m.sup - 12, 'text-anchor': 'middle',
          class: 'marca-texto ' + (activa ? 'marca-activa' : 'marca-tenue') },
          capaMarcas).textContent = k === 1 ? f.sigla : `${k}×`;
      }
    });

    // Línea del espectro
    const d = datos.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('');
    const area = el('path', { d: d + `L${x(maxHz)} ${alto - m.inf}L${x(0)} ${alto - m.inf}Z`, class: 'espectro-area' }, svg);
    const linea = el('path', { d, class: 'espectro-linea' }, svg);

    // Anotación del pico principal
    if (opciones.anotar && opciones.falla) {
      const f = FRECUENCIAS.find(z => z.id === opciones.falla);
      const pico = datos.reduce((mejor, p) => Math.abs(p[0] - f.hz) < 3 && p[1] > mejor[1] ? p : mejor, [0, 0]);
      const g = el('g', { class: 'anotacion' }, svg);
      const px = x(pico[0]), py = y(pico[1]);
      // El texto va a la derecha, en la zona sin picos, unido al pico por una guía.
      let tx = x(f.hz * 3) + 36, ancla = 'start';
      const ty = m.sup + (alto - m.sup - m.inf) * 0.28;
      if (tx + 300 > ancho) { tx = ancho - m.der; ancla = 'end'; } // pantallas angostas
      const finGuia = ancla === 'start' ? tx - 8 : Math.max(px + 60, tx - 200);
      el('polyline', { points: `${px + 6},${py} ${px + 40},${py} ${finGuia},${ty - 5}`, class: 'anotacion-guia', fill: 'none' }, g);
      el('circle', { cx: px, cy: py, r: 5, class: 'anotacion-punto' }, g);
      el('text', { x: tx, y: ty, class: 'anotacion-titulo', 'text-anchor': ancla }, g).textContent = `${f.nombre}, ${f.hz.toFixed(1)} Hz`;
      el('text', { x: tx, y: ty + 18, class: 'anotacion-texto', 'text-anchor': ancla }, g).textContent = ancho < 520 ? 'Desgaste probable'
        : (opciones.textoAnotacion || 'Pico con armónicos 2× y 3×: desgaste probable');
    }

    if (opciones.animar && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const largo = linea.getTotalLength();
      linea.style.strokeDasharray = largo;
      linea.style.strokeDashoffset = largo;
      area.style.opacity = 0;
      capaMarcas.style.opacity = 0;
      const anot = svg.querySelector('.anotacion');
      if (anot) anot.style.opacity = 0;
      requestAnimationFrame(() => {
        linea.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(.4,0,.2,1)';
        linea.style.strokeDashoffset = 0;
        setTimeout(() => { area.style.transition = 'opacity .6s'; area.style.opacity = 1; }, 1200);
        setTimeout(() => { capaMarcas.style.transition = 'opacity .5s'; capaMarcas.style.opacity = 1; }, 1700);
        if (anot) setTimeout(() => { anot.style.transition = 'opacity .5s'; anot.style.opacity = 1; }, 2200);
      });
    }
    return svg;
  }

  /* Tendencia con zonas de severidad (bandas) y umbrales. */
  function dibujarTendencia(contenedor, valores, opciones) {
    const ancho = contenedor.clientWidth || opciones.ancho || 600, alto = opciones.alto || 220;
    const m = { izq: 34, der: 76, sup: 14, inf: 28 };
    const maxV = opciones.max;
    const x = i => m.izq + (i / (valores.length - 1)) * (ancho - m.izq - m.der);
    const y = v => alto - m.inf - (Math.min(v, maxV) / maxV) * (alto - m.sup - m.inf);
    contenedor.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${ancho} ${alto}`, role: 'img', 'aria-label': opciones.etiqueta, class: 'grafico-tendencia' }, contenedor);

    let desde = 0;
    (opciones.zonas || []).forEach(z => {
      const hasta = Math.min(z.hasta, maxV);
      el('rect', { x: m.izq, width: ancho - m.izq - m.der, y: y(hasta), height: y(desde) - y(hasta), class: 'zona zona-' + z.clase }, svg);
      el('text', { x: ancho - m.der + 6, y: (y(hasta) + y(desde)) / 2 + 4, class: 'zona-texto zona-texto-' + z.clase }, svg).textContent = z.nombre;
      desde = hasta;
    });
    (opciones.marcasY || []).forEach(v => {
      el('text', { x: m.izq - 6, y: y(v) + 4, class: 'eje', 'text-anchor': 'end' }, svg).textContent = v;
    });
    (opciones.marcasX || []).forEach(([i, t]) => {
      el('text', { x: x(i), y: alto - 8, class: 'eje', 'text-anchor': 'middle' }, svg).textContent = t;
    });
    const d = valores.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
    el('path', { d, class: 'tendencia-linea' }, svg);
    if (opciones.evento != null) {
      const i = opciones.evento;
      el('line', { x1: x(i), x2: x(i), y1: m.sup, y2: alto - m.inf, class: 'evento-linea' }, svg);
      el('text', { x: x(i) - 4, y: m.sup + 10, class: 'evento-texto', 'text-anchor': 'end' }, svg).textContent = opciones.eventoTexto;
    }
    const ult = valores.length - 1;
    el('circle', { cx: x(ult), cy: y(valores[ult]), r: 4, class: 'tendencia-punto' }, svg);
    return svg;
  }

  function minitendencia(valores, clase) {
    const ancho = 96, alto = 26;
    const max = Math.max(...valores) * 1.1, min = Math.min(...valores) * 0.9;
    const x = i => 2 + (i / (valores.length - 1)) * (ancho - 4);
    const y = v => alto - 3 - ((v - min) / (max - min || 1)) * (alto - 6);
    const d = valores.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
    return `<svg class="mini ${clase}" viewBox="0 0 ${ancho} ${alto}" aria-hidden="true"><path d="${d}"/><circle cx="${x(valores.length - 1)}" cy="${y(valores[valores.length - 1])}" r="2.5"/></svg>`;
  }

  window.Graficos = { FRECUENCIAS, espectro, dibujarEspectro, dibujarTendencia, minitendencia, aleatorio };
})();
