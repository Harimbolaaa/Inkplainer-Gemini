/* Local SVG preparation and a single time-based renderer for all workshop outputs. */
const SVGMotion = (() => {
  'use strict';
  const C = SVGMotionCore, NS = 'http://www.w3.org/2000/svg';
  const preparedByData = new WeakMap(), sourceCache = new Map(), resolvedCache = new Map();
  const drawable = 'path,rect,circle,ellipse,line,polyline,polygon,text,use';
  const cssProperties = ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity', 'opacity', 'fill-rule', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'display', 'visibility', 'clip-path', 'mask', 'filter'];
  const svgURL = source => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  const image = source => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Ce SVG ne peut pas être décodé par le navigateur.'));
    img.src = source;
  });
  const safeValue = value => !/[\u0000-\u0008]|@import|expression\s*\(|javascript:|https?:|file:|data:/i.test(value) &&
    [...value.matchAll(/url\(([^)]+)\)/gi)].every(m => /^['"]?#[\w:.-]+['"]?$/.test(m[1].trim()));
  function sanitize(source) {
    if (typeof source !== 'string' || source.length > 2 * 1024 * 1024) throw new Error('Le fichier SVG doit faire moins de 2 Mo.');
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Les déclarations XML externes ne sont pas acceptées.');
    const original = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (original.querySelector('parsererror') || original.documentElement.localName !== 'svg') throw new Error('Le fichier ne contient pas un SVG valide.');
    if (/<\s*(?:[\w-]+:)?image\b/i.test(source)) throw new Error('Ce SVG contient une image intégrée. Importez une version vectorielle, sans balise image.');
    const cleaned = DOMPurify.sanitize(source, {
      USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['style'],
      FORBID_TAGS: ['script', 'foreignObject', 'a', 'animate', 'animateTransform', 'animateMotion', 'set', 'image', 'feImage'],
      FORBID_ATTR: ['onload', 'onerror'], ALLOW_DATA_ATTR: false,
    });
    const doc = new DOMParser().parseFromString(cleaned, 'image/svg+xml');
    const root = doc.documentElement;
    if (doc.querySelector('parsererror') || root.localName !== 'svg') throw new Error('Le fichier ne contient pas un SVG valide.');
    const warnings = [];
    if (/<\s*(?:script|foreignObject|animate\w*|set)\b|\bon\w+\s*=|(?:href\s*=\s*['"]|url\(\s*['"]?)(?:https?:|\/\/)|@import/i.test(source)) {
      warnings.push('Les scripts, liens et animations intégrées ont été retirés ; l’atelier crée sa propre animation.');
    }
    // Convert safe stylesheet declarations to inline styles before measuring.
    const declarations = new Map();
    for (const style of root.querySelectorAll('style')) {
      for (const match of style.textContent.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = match[1].trim();
        if (selector.startsWith('@') || selector.length > 500) continue;
        const parsed = document.createElement('span').style;
        parsed.cssText = match[2];
        try {
          for (const node of root.querySelectorAll(selector)) {
            const values = declarations.get(node) || {};
            for (const property of cssProperties) {
              const value = parsed.getPropertyValue(property);
              if (value && safeValue(value)) values[property] = value;
            }
            declarations.set(node, values);
          }
        } catch (_) { warnings.push('Une règle CSS non prise en charge a été ignorée.'); }
      }
      style.remove();
    }
    for (const [node, values] of declarations) for (const [property, value] of Object.entries(values)) {
      if (!node.style.getPropertyValue(property)) node.style.setProperty(property, value);
    }
    for (const node of [root, ...root.querySelectorAll('*')]) {
      for (const attr of [...node.attributes]) {
        if (/^on/i.test(attr.name) || ((attr.localName === 'href') && !/^#[\w:.-]+$/.test(attr.value))) {
          node.removeAttributeNode(attr); continue;
        }
        if (attr.name === 'style') {
          const values = cssProperties.map(p => [p, node.style.getPropertyValue(p)]).filter(([, v]) => v && safeValue(v));
          node.removeAttribute('style');
          for (const [p, v] of values) node.style.setProperty(p, v);
        } else if (!safeValue(attr.value) && !/^xmlns/.test(attr.name)) node.removeAttributeNode(attr);
      }
    }
    let box = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) {
      box = [0, 0, parseFloat(root.getAttribute('width')) || 256, parseFloat(root.getAttribute('height')) || 256];
    }
    if (box[2] > 4096 || box[3] > 4096 || box[2] < 1 || box[3] < 1) throw new Error('Le viewBox SVG doit être compris entre 1 et 4 096 unités.');
    root.setAttribute('xmlns', NS);
    root.setAttribute('viewBox', box.join(' '));
    root.setAttribute('width', box[2]); root.setAttribute('height', box[3]);
    return { root, box, warnings: [...new Set(warnings)] };
  }
  function shapeSource(data) {
    const shape = C.shapes.find(s => s.id === data.shape);
    const drawing = SVG().size(256, 256).viewbox(0, 0, 256, 256);
    drawing.path(shape.d).fill(data.noFill || shape.open ? 'none' : data.fill)
      .stroke({ color: data.stroke, width: shape.open ? Math.max(4, data.strokeWidth) : data.strokeWidth, linecap: 'round', linejoin: 'round' });
    return drawing.node.outerHTML;
  }
  function geometryPath(node) {
    const v = name => Number(node.getAttribute(name)) || 0, tag = node.localName;
    if (tag === 'path') return node.getAttribute('d') || '';
    if (tag === 'line') return `M${v('x1')} ${v('y1')}L${v('x2')} ${v('y2')}`;
    if (tag === 'polyline' || tag === 'polygon') {
      const points = (node.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      if (points.length < 4 || !points.every(Number.isFinite)) return '';
      return points.map((p, i) => i % 2 ? `${p}` : `${i ? 'L' : 'M'}${p} `).join(' ') + (tag === 'polygon' ? 'Z' : '');
    }
    if (tag === 'circle' || tag === 'ellipse') {
      const x = v('cx'), y = v('cy'), rx = tag === 'circle' ? v('r') : v('rx'), ry = tag === 'circle' ? v('r') : v('ry');
      return `M${x + rx} ${y}A${rx} ${ry} 0 1 1 ${x - rx} ${y}A${rx} ${ry} 0 1 1 ${x + rx} ${y}Z`;
    }
    if (tag === 'rect') {
      const x = v('x'), y = v('y'), w = v('width'), h = v('height');
      const rx = Math.min(w / 2, v('rx') || v('ry')), ry = Math.min(h / 2, v('ry') || v('rx'));
      return rx && ry ? `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z` : `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    }
    return '';
  }
  function isDefinition(node) {
    return !!node.parentElement?.closest('defs,clipPath,mask,pattern,symbol,marker');
  }
  function transformPoint(m, x, y) { return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; }
  function matrixValues(m) { return [m.a, m.b, m.c, m.d, m.e, m.f]; }
  async function prepareSVG(data) {
    const parsed = sanitize(data.kind === 'shape' ? shapeSource(data) : data.svg);
    const root = parsed.root, [minX, minY, width, height] = parsed.box;
    if (data.kind === 'svg' && !data.preserveColors) for (const node of root.querySelectorAll(drawable)) {
      if (node.localName === 'line' || node.localName === 'polyline') node.style.fill = 'none';
      else node.style.fill = data.noFill ? 'none' : data.fill;
      node.style.stroke = data.stroke;
      node.style.strokeWidth = data.strokeWidth;
      node.style.strokeLinecap = 'round'; node.style.strokeLinejoin = 'round';
    }
    const ids = new Map(), prefix = `motion-${crypto.randomUUID()}-`;
    for (const node of [root, ...root.querySelectorAll('[id]')]) if (node.id) {
      ids.set(node.id, prefix + node.id); node.id = prefix + node.id;
    }
    for (const node of [root, ...root.querySelectorAll('*')]) for (const attr of [...node.attributes]) {
      if (attr.localName === 'href' && ids.has(attr.value.slice(1))) node.setAttributeNS(attr.namespaceURI, attr.name, `#${ids.get(attr.value.slice(1))}`);
      else if (attr.value.includes('url(')) attr.value = attr.value.replace(/url\(\s*(['"]?)#([\w:.-]+)\1\s*\)/g, (match, quote, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
    }
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;opacity:0;pointer-events:none;';
    host.append(root); document.body.append(host);
    try {
      const toFrame = new DOMMatrix().translate(-minX, -minY).multiply(root.getScreenCTM().inverse());
      const matrixFor = node => {
        const matrix = node.getScreenCTM();
        return matrix && toFrame.multiply(matrix);
      };
      const elements = [...root.querySelectorAll(drawable)].filter(node => !isDefinition(node));
      if (!elements.length) throw new Error('Aucune forme vectorielle visible n’a été trouvée.');
      const selected = [];
      const collect = node => {
        if (node.nodeType !== 1 || ['defs', 'style', 'title', 'desc'].includes(node.localName)) return;
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (node.matches(drawable) || node.localName === 'g' && (Number(style.opacity) < 1 || style.filter !== 'none' || style.maskImage !== 'none')) selected.push(node);
        else for (const child of node.children) collect(child);
      };
      if (Number(getComputedStyle(root).opacity) < 1 || elements.length > 128) {
        selected.push(root);
        if (elements.length > 128) parsed.warnings.push('SVG détaillé : animation globale pour limiter la mémoire.');
      } else for (const child of root.children) collect(child);
      const meta = [];
      for (const [index, node] of selected.entries()) {
        let bounds;
        if (node === root) bounds = { x: 0, y: 0, w: width, h: height };
        else {
          const b = node.getBBox(), m = matrixFor(node);
          if (!m || (!b.width && !b.height)) continue;
          const corners = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => transformPoint(m, x, y));
          const pad = Math.max(3, (parseFloat(getComputedStyle(node).strokeWidth) || 0) * Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) + 3);
          const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
          bounds = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
        }
        node.setAttribute('data-motion-part', String(index));
        meta.push({ node, marker: String(index), ...bounds });
      }
      if (!meta.length) throw new Error('Les formes du SVG ont des dimensions nulles.');
      const resolution = 768 / Math.max(width, height);
      const pixels = meta.reduce((sum, b) => sum + b.w * b.h * resolution * resolution, 0);
      if (pixels > 16 * 1024 * 1024) {
        meta.splice(0, meta.length, { node: root, marker: '', x: 0, y: 0, w: width, h: height });
        parsed.warnings.push('Découpage regroupé pour garder un aperçu fluide.');
      }
      const parts = [];
      for (const item of meta) {
        const clone = root.cloneNode(true);
        if (item.node !== root) for (const candidate of clone.querySelectorAll('[data-motion-part]')) {
          if (candidate.getAttribute('data-motion-part') !== item.marker) candidate.remove();
        }
        const rasterScale = Math.min(1024 / Math.max(item.w, item.h), resolution);
        clone.setAttribute('x', 0); clone.setAttribute('y', 0);
        clone.setAttribute('overflow', 'hidden');
        const outer = document.createElementNS(NS, 'svg');
        outer.setAttribute('xmlns', NS);
        outer.setAttribute('viewBox', `${item.x} ${item.y} ${item.w} ${item.h}`);
        outer.setAttribute('width', Math.max(1, Math.ceil(item.w * rasterScale)));
        outer.setAttribute('height', Math.max(1, Math.ceil(item.h * rasterScale)));
        outer.append(clone);
        clone.removeAttribute('data-motion-part');
        clone.querySelectorAll('[data-motion-part]').forEach(n => n.removeAttribute('data-motion-part'));
        const source = new XMLSerializer().serializeToString(outer);
        const strokes = [];
        for (const geometry of item.node.matches('path,rect,circle,ellipse,line,polyline,polygon') ? [item.node] : item.node.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')) {
          if (isDefinition(geometry)) continue;
          const d = geometryPath(geometry), m = matrixFor(geometry);
          if (!d || !m) continue;
          try {
            const length = geometry.getTotalLength();
            if (length > 0) strokes.push({ d, path: new Path2D(d), length, matrix: matrixValues(m) });
          } catch (_) { /* A malformed individual outline should not lose a valid SVG. */ }
        }
        parts.push({ ...item, node: undefined, image: await image(svgURL(source)), source, strokes, length: strokes.reduce((sum, p) => sum + p.length, 0) });
      }
      return { width, height, parts, warnings: [...new Set(parsed.warnings)], svg: new XMLSerializer().serializeToString(root) };
    } finally { host.remove(); }
  }
  const graphemes = value => typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map(g => g.segment)
    : Array.from(value);
  async function prepareText(data) {
    if (!data.text.trim()) throw new Error('Écrivez au moins une lettre.');
    await document.fonts.load(`${data.bold ? 700 : 400} 96px "${data.font}"`);
    const font = `${data.bold ? 700 : 400} 96px "${data.font}"`, pad = 30, lineHeight = 128;
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = font;
    const lines = data.text.replace(/\r\n?/g, '\n').split('\n').slice(0, 8);
    const lineWidths = lines.map(text => measure.measureText(text).width + Math.max(0, graphemes(text).length - 1) * data.letterSpacing);
    const width = Math.min(4096, Math.max(64, Math.ceil(Math.max(...lineWidths) + pad * 2)));
    const height = lines.length * lineHeight + pad * 2;
    const parts = [];
    for (const [row, text] of lines.entries()) {
      const rtl = /[\u0590-\u08ff]/.test(text), letters = graphemes(text), widths = [];
      let previous = 0;
      for (let i = 0; i < letters.length; i++) {
        const next = measure.measureText(letters.slice(0, i + 1).join('')).width + i * data.letterSpacing;
        widths.push(Math.max(0, next - previous)); previous = next;
      }
      const line = document.createElement('canvas'); line.width = width; line.height = lineHeight;
      const c = line.getContext('2d');
      c.font = font; c.direction = rtl ? 'rtl' : 'ltr'; c.textAlign = rtl ? 'right' : 'left';
      c.fillStyle = data.fill; c.strokeStyle = data.stroke; c.lineWidth = data.strokeWidth;
      c.lineJoin = 'round'; c.letterSpacing = `${data.letterSpacing}px`;
      const start = rtl ? (width + lineWidths[row]) / 2 : (width - lineWidths[row]) / 2;
      if (data.strokeWidth > 0) c.strokeText(text, start, 96);
      if (!data.noFill) c.fillText(text, start, 96);
      let offset = 0;
      for (let i = 0; i < letters.length; i++) {
        let x = rtl ? start - offset - widths[i] : start + offset, w = Math.max(1, widths[i]);
        offset += widths[i];
        if (!letters[i].trim()) continue;
        const leftPad = (rtl ? i === letters.length - 1 : i === 0) ? data.strokeWidth + 4 : 0;
        const rightPad = (rtl ? i === 0 : i === letters.length - 1) ? data.strokeWidth + 4 : 0;
        x -= leftPad; w += leftPad + rightPad;
        const tile = document.createElement('canvas'); tile.width = Math.ceil(w); tile.height = lineHeight;
        tile.getContext('2d').drawImage(line, x, 0, w, lineHeight, 0, 0, w, lineHeight);
        parts.push({
          x, y: pad + row * lineHeight, w, h: lineHeight, image: tile, strokes: [], length: 0,
          text: { line: text, x: start, y: pad + row * lineHeight + 96, rtl, row },
        });
      }
    }
    if (!parts.length) throw new Error('Le texte ne contient aucune lettre visible.');
    return { width, height, parts, warnings: [], text: true };
  }
  function sourceKey(d) {
    return JSON.stringify([d.kind, d.shape, d.svg, d.text, d.font, d.bold, d.letterSpacing, d.fill, d.stroke, d.strokeWidth, d.noFill, d.preserveColors]);
  }
  async function prepare(data) {
    const key = sourceKey(data), existing = preparedByData.get(data);
    if (existing?.key === key) return existing.prepared;
    const cached = resolvedCache.get(key);
    if (cached) {
      preparedByData.set(data, { key, prepared: cached });
      return cached;
    }
    let pending = sourceCache.get(key);
    if (!pending) {
      pending = data.kind === 'text' ? prepareText(data) : prepareSVG(data);
      sourceCache.set(key, pending);
      if (sourceCache.size > 64) sourceCache.delete(sourceCache.keys().next().value);
    }
    try {
      const prepared = await pending;
      resolvedCache.set(key, prepared);
      if (resolvedCache.size > 128) resolvedCache.delete(resolvedCache.keys().next().value);
      preparedByData.set(data, { key, prepared });
      return prepared;
    } catch (error) { sourceCache.delete(key); throw error; }
  }
  function drawPart(c, data, prepared, part, motion) {
    const l = C.layout(data, prepared.width, prepared.height);
    const x = l.x + part.x * l.scale, y = l.y + part.y * l.scale, w = part.w * l.scale, h = part.h * l.scale;
    const cx = data.mode === 'all' ? 256 : x + w / 2, cy = data.mode === 'all' ? 256 : y + h / 2;
    c.save();
    c.translate(cx + motion.x, cy + motion.y);
    c.rotate(motion.rotation * Math.PI / 180);
    c.scale(motion.scaleX, motion.scaleY); c.translate(-cx, -cy);
    c.globalAlpha *= motion.opacity;
    if (motion.reveal < 1 || motion.trim < 1 && !part.strokes.length) {
      c.beginPath(); c.rect(x, y, w * Math.min(motion.reveal, motion.trim), h); c.clip();
    }
    c.save(); c.globalAlpha *= part.strokes.length ? motion.fill : 1;
    c.drawImage(part.image, x, y, w, h); c.restore();
    if (motion.trim < 1 && part.strokes.length && motion.trim > 0) {
      let budget = part.length * motion.trim;
      for (const stroke of part.strokes) {
        const fraction = C.clamp(budget / stroke.length, 0, 1); budget -= stroke.length;
        if (!fraction) continue;
        c.save();
        c.beginPath(); c.rect(l.x, l.y, prepared.width * l.scale, prepared.height * l.scale); c.clip();
        c.translate(l.x, l.y); c.scale(l.scale, l.scale); c.transform(...stroke.matrix);
        c.strokeStyle = data.stroke; c.lineWidth = Math.max(data.strokeWidth, 2);
        c.lineCap = 'round'; c.lineJoin = 'round'; c.setLineDash([stroke.length, stroke.length]);
        c.lineDashOffset = stroke.length * (1 - fraction); c.stroke(stroke.path); c.restore();
      }
    }
    c.restore();
  }
  function render(c, data, prepared, time, width = 512, height = 512, options = {}) {
    c.save(); c.scale(width / 512, height / 512);
    c.beginPath(); c.rect(0, 0, 512, 512); c.clip();
    if (options.background && data.background !== 'transparent') { c.fillStyle = data.background; c.fillRect(0, 0, 512, 512); }
    const sequence = C.timing(data, prepared.parts.length);
    prepared.parts.forEach((part, i) => drawPart(c, data, prepared, part, options.neutral
      ? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, trim: 1, reveal: 1, fill: 1 }
      : C.stateAt(data, time, i, prepared.parts.length, sequence)));
    c.restore();
  }
  function draw(c, data, time, width, height) {
    let prepared = preparedByData.get(data)?.prepared;
    if (!prepared && data) {
      const key = sourceKey(data);
      prepared = resolvedCache.get(key);
      if (prepared) {
        preparedByData.set(data, { key, prepared });
      }
    }
    if (!prepared) return false;
    render(c, data, prepared, time, width, height);
    return true;
  }
  async function poster(data) {
    const prepared = await prepare(data), canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    render(canvas.getContext('2d'), data, prepared, 0, 512, 512, { neutral: true });
    return image(canvas.toDataURL('image/png'));
  }
  let fontCSSPromise;
  async function embeddedFont(font) {
    if (font === 'Arial') return '';
    fontCSSPromise ||= fetch('vendor/fonts.css').then(r => r.text());
    const css = await fontCSSPromise;
    const blocks = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map(m => m[0]).filter(s => s.includes(`font-family: '${font}'`));
    const urls = new Map();
    for (const block of blocks) for (const match of block.matchAll(/url\(([^)]+)\)/g)) {
      if (!urls.has(match[1])) {
        const path = new URL(match[1], new URL('vendor/fonts.css', document.baseURI));
        const response = await fetch(path);
        if (!response.ok) throw new Error('La police locale est introuvable.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
        urls.set(match[1], `data:font/woff2;base64,${btoa(binary)}`);
      }
    }
    return blocks.map(block => block.replace(/url\(([^)]+)\)/g, (_, path) => `url(${urls.get(path)})`)).join('\n');
  }
  async function animatedSVG(data, prepared, fps = 30, options = {}) {
    const timing = C.timing(data, prepared.parts.length), duration = timing.cycle;
    const frames = Math.min(3600, Math.floor(120000 / prepared.parts.length), Math.max(2, Math.ceil(duration * fps)));
    const times = Array.from({ length: frames + 1 }, (_, i) => i / frames);
    const values = fn => times.map(fn).join(';');
    const keyTimes = times.map(t => +t.toFixed(7)).join(';');
    const repeat = data.loop ? 'indefinite' : data.iterations;
    const animate = (attribute, get) => `<animate attributeName="${attribute}" dur="${duration}s" repeatCount="${repeat}" fill="freeze" keyTimes="${keyTimes}" values="${values(t => get(t))}"/>`;
    const transform = (type, get) => `<animateTransform attributeName="transform" type="${type}" dur="${duration}s" repeatCount="${repeat}" fill="freeze" keyTimes="${keyTimes}" values="${values(t => get(t))}"/>`;
    const l = C.layout(data, prepared.width, prepared.height);
    let body = data.background === 'transparent' ? '' : `<rect width="512" height="512" fill="${data.background}"/>`;
    if (prepared.text) body += `<style>${await embeddedFont(data.font)}</style>`;
    for (const [index, part] of prepared.parts.entries()) {
      if (options.cancelled?.()) throw new DOMException('Export annulé', 'AbortError');
      const poses = times.map(t => C.stateAt(data, Math.min(duration - 1e-7, t * duration), index, prepared.parts.length, timing));
      const pose = t => poses[Math.round(t * frames)];
      const x = l.x + part.x * l.scale, y = l.y + part.y * l.scale, w = part.w * l.scale, h = part.h * l.scale;
      const cx = data.mode === 'all' ? 256 : x + w / 2, cy = data.mode === 'all' ? 256 : y + h / 2;
      const clipId = `motion-reveal-${index}`, textClipId = `motion-text-${index}`;
      body += `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}">${animate('width', t => +(w * Math.min(pose(t).reveal, part.strokes.length ? 1 : pose(t).trim)).toFixed(5))}</rect></clipPath></defs>`;
      body += `<g>${transform('translate', t => `${pose(t).x.toFixed(5)} ${pose(t).y.toFixed(5)}`)}<g transform="translate(${cx} ${cy})"><g>${transform('rotate', t => pose(t).rotation.toFixed(5))}<g>${transform('scale', t => `${pose(t).scaleX.toFixed(6)} ${pose(t).scaleY.toFixed(6)}`)}<g transform="translate(${-cx} ${-cy})">${animate('opacity', t => pose(t).opacity.toFixed(6))}<g clip-path="url(#${clipId})"><g>${animate('opacity', t => part.strokes.length ? pose(t).fill.toFixed(6) : '1')}`;
      if (prepared.text) {
        const text = part.text;
        body += `<g transform="translate(${l.x} ${l.y}) scale(${l.scale})"><defs><clipPath id="${textClipId}"><rect x="${part.x}" y="${part.y}" width="${part.w}" height="${part.h}"/></clipPath></defs><text clip-path="url(#${textClipId})" x="${text.x}" y="${text.y}" font-family="${C.esc(data.font)}" font-size="96" font-weight="${data.bold ? 700 : 400}" letter-spacing="${data.letterSpacing}" direction="${text.rtl ? 'rtl' : 'ltr'}" text-anchor="${text.rtl ? 'end' : 'start'}" fill="${data.noFill ? 'none' : data.fill}" stroke="${data.stroke}" stroke-width="${data.strokeWidth}" stroke-linejoin="round">${C.esc(text.line)}</text></g>`;
      } else body += `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${C.esc(svgURL(part.source))}"/>`;
      body += '</g>';
      let before = 0;
      for (const stroke of part.strokes) {
        const start = before; before += stroke.length;
        body += `<g transform="translate(${l.x} ${l.y}) scale(${l.scale})"><path d="${C.esc(stroke.d)}" transform="matrix(${stroke.matrix.join(' ')})" fill="none" stroke="${data.stroke}" stroke-width="${Math.max(data.strokeWidth, 2)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${stroke.length} ${stroke.length}">${animate('stroke-dashoffset', t => (stroke.length * (1 - C.clamp((pose(t).trim * part.length - start) / stroke.length, 0, 1))).toFixed(5))}${animate('opacity', t => pose(t).trim > 0 && pose(t).trim < 1 ? '1' : '0')}</path></g>`;
      }
      body += '</g></g></g></g></g></g>';
      options.onProgress?.((index + 1) / prepared.parts.length);
      if (index % 2 === 0) await new Promise(requestAnimationFrame);
    }
    return `<svg xmlns="${NS}" width="512" height="512" viewBox="0 0 512 512"><title>${C.esc(data.name)}</title><desc>Créé avec l’atelier SVG Inkplainer. Animation autonome, sans script.</desc><metadata id="inkplainer-motion-v1">${C.esc(JSON.stringify(C.normalize(data)))}</metadata>${body}</svg>`;
  }
  return { sanitize, prepare, getPrepared: data => preparedByData.get(data)?.prepared || (data ? resolvedCache.get(sourceKey(data)) : undefined), render, draw, poster, animatedSVG, graphemes };
})();
window.SVGMotion = SVGMotion;
