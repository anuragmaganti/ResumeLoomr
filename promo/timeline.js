(() => {
  const DURATION = 27;
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const mix = (from, to, amount) => from + ((to - from) * amount);
  const smooth = (value) => {
    const x = clamp(value);
    return x * x * (3 - (2 * x));
  };
  const progress = (time, start, end) => clamp((time - start) / (end - start));
  const fade = (time, start, end, edge = 0.55) => {
    const enter = smooth(progress(time, start, start + edge));
    const exit = 1 - smooth(progress(time, end - edge, end));
    return Math.min(enter, exit);
  };

  const set = (element, styles) => {
    Object.entries(styles).forEach(([key, value]) => {
      element.style[key] = value;
    });
  };

  const transform = ({ x = 0, y = 0, scale = 1, rotate = 0 }) =>
    `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`;

  const scenes = {
    hero: $('sceneHero'),
    import: $('sceneImport'),
    edit: $('sceneEdit'),
    layout: $('sceneLayout'),
    margins: $('sceneMargins'),
    organize: $('sceneOrganize'),
    cover: $('sceneCover'),
    final: $('sceneFinal'),
  };

  const cursor = $('cursor');
  const cursorPulse = cursor.querySelector('span');
  const progressBar = $('progressBar');

  function animateScene(scene, time, start, end, options = {}) {
    const visibility = fade(time, start, end, options.edge ?? 0.55);
    const travel = smooth(progress(time, start, end));
    const y = mix(options.fromY ?? 20, options.toY ?? -12, travel);
    const scale = mix(options.fromScale ?? 1.015, options.toScale ?? 0.995, travel);
    set(scene, { opacity: visibility.toFixed(4), transform: transform({ y, scale }) });
    return visibility;
  }

  function renderHero(time) {
    animateScene(scenes.hero, time, 0, 2.9, { edge: 0.42, fromY: 24, toY: -18, fromScale: 0.98, toScale: 1.025 });
    const logoIn = smooth(progress(time, 0.05, 0.48));
    const titleIn = smooth(progress(time, 0.26, 0.88));
    const detailIn = smooth(progress(time, 0.56, 1.15));
    const logo = scenes.hero.querySelector('.heroLogo');
    const title = scenes.hero.querySelector('.heroTitle');
    const kicker = scenes.hero.querySelector('.heroKicker');
    const subhead = scenes.hero.querySelector('.heroSubhead');
    const thread = scenes.hero.querySelector('.heroThread');
    set(logo, { opacity: logoIn, transform: transform({ y: mix(22, 0, logoIn), scale: mix(0.9, 1, logoIn) }) });
    set(title, { opacity: titleIn, transform: transform({ y: mix(44, 0, titleIn) }) });
    set(kicker, { opacity: detailIn, transform: transform({ y: mix(16, 0, detailIn) }) });
    set(subhead, { opacity: detailIn, transform: transform({ y: mix(18, 0, detailIn) }) });
    set(thread, { opacity: detailIn, transform: transform({ scale: mix(0.8, 1, detailIn) }) });
  }

  function renderImport(time) {
    const visible = animateScene(scenes.import, time, 2.25, 6.65, { edge: 0.38, fromY: 22, toY: -16, fromScale: 1.015, toScale: 1.02 });
    const move = smooth(progress(time, 2.35, 5.95));
    const appFrame = $('importFrame');
    set(appFrame, {
      transform: transform({ x: mix(145, -18, move), y: mix(28, -6, move), scale: mix(0.95, 1.02, move), rotate: mix(-1.5, -0.25, move) }),
      opacity: visible,
    });
    const dialogIn = smooth(progress(time, 3.12, 3.5));
    const fileIn = smooth(progress(time, 4.05, 4.36));
    const processing = smooth(progress(time, 4.9, 5.18));
    set($('importDialogBackdrop'), { opacity: (visible * dialogIn).toFixed(4) });
    set($('importDialogDemo'), {
      opacity: (visible * dialogIn).toFixed(4),
      transform: `translateX(-50%) ${transform({ y: mix(22, 0, dialogIn), scale: mix(0.96, 1, dialogIn) })}`,
    });
    $('resumeImportSlot').classList.toggle('isSelected', fileIn > 0.45);
    $('resumeImportFile').textContent = fileIn > 0.45 ? 'jordan-lee-resume.pdf' : 'Choose resume';
    $('importActionLabel').textContent = processing > 0.3 ? 'Processing…' : 'Import resume';
  }

  function renderEdit(time) {
    const visible = animateScene(scenes.edit, time, 5.95, 10.35, { edge: 0.4, fromY: 14, toY: -8, fromScale: 1.025, toScale: 1.06 });
    const zoom = smooth(progress(time, 6.05, 9.65));
    set($('editFrame'), {
      transform: transform({ x: mix(0, -126, zoom), y: mix(0, -22, zoom), scale: mix(1, 1.095, zoom) }),
      opacity: visible,
    });
    const copy = scenes.edit.querySelector('.floatingCopy--edit');
    const copyIn = smooth(progress(time, 6.12, 6.55));
    set(copy, { opacity: (visible * copyIn).toFixed(4), transform: transform({ x: mix(-50, 0, copyIn), y: mix(12, 0, copyIn) }) });
    const active = smooth(progress(time, 7.22, 7.4));
    const typing = smooth(progress(time, 7.4, 8.32));
    const name = 'Jordan Lee';
    $('previewNameValue').textContent = typing > 0
      ? name.slice(0, Math.max(1, Math.ceil(name.length * typing)))
      : 'Erlich Bachman';
    const nameTarget = $('previewNameEdit');
    set(nameTarget, {
      borderColor: 'transparent',
      outline: `1.5px solid rgba(49, 88, 213, ${0.58 * active})`,
      outlineOffset: `${2 * active}px`,
      boxShadow: `0 0 0 ${5 * active}px rgba(49, 88, 213, ${0.08 * active})`,
      background: 'transparent',
    });
    nameTarget.querySelector('i').style.opacity = active && Math.sin(time * 16) > -0.2 ? 1 : 0;
  }

  function renderLayout(time) {
    const visible = animateScene(scenes.layout, time, 9.7, 14.25, { edge: 0.4, fromY: 18, toY: -12, fromScale: 1, toScale: 1.025 });
    const frameMove = smooth(progress(time, 9.82, 13.72));
    set($('layoutFrame'), {
      opacity: visible,
      transform: transform({ x: mix(-90, -25, frameMove), y: mix(24, -10, frameMove), scale: mix(0.94, 1.02, frameMove), rotate: mix(1.2, 0.2, frameMove) }),
    });
    const demoIn = smooth(progress(time, 10.22, 10.58));
    set($('layoutDemo'), { opacity: (visible * demoIn).toFixed(4), transform: transform({ y: mix(60, 0, demoIn), scale: mix(0.9, 1, demoIn) }) });
    const roleMove = smooth(progress(time, 11.02, 11.68));
    set($('roleChip'), { transform: transform({ x: mix(0, 193, roleMove), y: mix(0, -76, roleMove), scale: mix(1, 1.04, Math.sin(roleMove * Math.PI)) }) });
    const target = scenes.layout.querySelector('.layoutSlot--target');
    set(target, {
      borderColor: `rgba(49, 88, 213, ${mix(0.35, 0.78, roleMove)})`,
      background: `rgba(49, 88, 213, ${mix(0.07, 0.15, roleMove)})`,
    });
  }

  function renderMargins(time) {
    const visible = animateScene(scenes.margins, time, 13.62, 17.75, { edge: 0.38, fromY: 18, toY: -10, fromScale: 1.01, toScale: 1.03 });
    const frameMove = smooth(progress(time, 13.72, 17.22));
    set($('marginFrame'), {
      opacity: visible,
      transform: transform({ x: mix(120, -30, frameMove), y: mix(25, -10, frameMove), scale: mix(0.94, 1.01, frameMove), rotate: mix(-1.1, -0.25, frameMove) }),
    });
    const badgeIn = smooth(progress(time, 14.25, 14.58));
    const tap = smooth(progress(time, 15.0, 15.24));
    set($('marginBadge'), {
      opacity: (visible * badgeIn).toFixed(4),
      transform: transform({ scale: mix(0.84, 1 - (tap * 0.08), badgeIn) }),
    });
  }

  function renderOrganize(time) {
    const visible = animateScene(scenes.organize, time, 17.02, 21.55, { edge: 0.4, fromY: 24, toY: -10, fromScale: 1, toScale: 1.03 });
    const frameMove = smooth(progress(time, 17.12, 20.98));
    set($('organizeFrame'), {
      opacity: visible,
      transform: transform({ x: mix(0, -40, frameMove), y: mix(16, -24, frameMove), scale: mix(0.96, 1.04, frameMove) }),
    });
    const open = smooth(progress(time, 18.35, 18.9));
    set($('organizeClosed'), { opacity: (1 - open).toFixed(4), transform: transform({ scale: mix(1, 1.015, open) }) });
    set($('organizeOpen'), { opacity: open.toFixed(4), transform: transform({ y: mix(-30, 0, open), scale: mix(0.985, 1, open) }) });
    const copy = scenes.organize.querySelector('.floatingCopy--organize');
    const copyIn = smooth(progress(time, 17.2, 17.62));
    set(copy, { opacity: (visible * copyIn).toFixed(4), transform: transform({ x: mix(-60, 0, copyIn), y: mix(20, 0, copyIn) }) });
    const calloutIn = smooth(progress(time, 18.62, 19.0));
    set($('folderCallout'), { opacity: (visible * calloutIn).toFixed(4), transform: transform({ x: mix(80, 0, calloutIn), scale: mix(0.9, 1, calloutIn) }) });
  }

  function renderCover(time) {
    const visible = animateScene(scenes.cover, time, 20.82, 24.95, { edge: 0.38, fromY: 22, toY: -8, fromScale: 1, toScale: 1.022 });
    const choiceIn = smooth(progress(time, 20.94, 21.35));
    const swap = smooth(progress(time, 21.82, 22.22));
    const sheetIn = smooth(progress(time, 22.02, 22.5));
    set($('coverChoiceFrame'), {
      opacity: (visible * choiceIn * (1 - swap)).toFixed(4),
      transform: transform({ x: mix(90, 0, choiceIn), y: mix(32, 0, choiceIn), scale: mix(0.92, 1, choiceIn), rotate: mix(1.4, -1.2, choiceIn) }),
    });
    set($('coverEditorFrame'), {
      opacity: (visible * swap * 0.62).toFixed(4),
      transform: transform({ x: mix(105, 0, swap), y: mix(30, 0, swap), scale: mix(0.94, 1, swap), rotate: mix(1.8, -0.7, swap) }),
    });
    set($('coverLetterSheet'), {
      opacity: (visible * sheetIn).toFixed(4),
      transform: transform({ x: mix(130, 0, sheetIn), y: mix(46, 0, sheetIn), scale: mix(0.86, 1, sheetIn), rotate: mix(2.2, 0, sheetIn) }),
    });
    const copy = scenes.cover.querySelector('.copyBlock--cover');
    const copyIn = smooth(progress(time, 21.08, 21.5));
    set(copy, { opacity: (visible * copyIn).toFixed(4), transform: transform({ x: mix(45, 0, copyIn), y: mix(12, 0, copyIn) }) });
  }

  function renderFinal(time) {
    const visible = animateScene(scenes.final, time, 24.35, DURATION, { edge: 0.34, fromY: 26, toY: 0, fromScale: 0.985, toScale: 1 });
    const fanIn = smooth(progress(time, 24.46, 25.02));
    const markIn = smooth(progress(time, 24.72, 25.28));
    set(scenes.final.querySelector('.documentFan'), { opacity: (visible * fanIn).toFixed(4), transform: transform({ x: mix(-130, 0, fanIn), y: mix(80, 0, fanIn), scale: mix(0.82, 1, fanIn) }) });
    set(scenes.final.querySelector('.finalMark'), { opacity: (visible * markIn).toFixed(4), transform: transform({ x: mix(80, 0, markIn), y: mix(20, 0, markIn) }) });
  }

  function cursorPoint(time) {
    const paths = [
      { start: 2.56, end: 3.02, from: [1660, 685], to: [1715, 522], click: 3.0 },
      { start: 3.58, end: 4.08, from: [1540, 610], to: [1260, 525], click: 4.06 },
      { start: 6.7, end: 7.25, from: [1520, 610], to: [1278, 400], click: 7.23 },
      { start: 11.02, end: 11.68, from: [732, 925], to: [925, 848], click: 11.04 },
      { start: 14.52, end: 15.05, from: [1590, 730], to: [1632, 490], click: 15.03 },
      { start: 17.85, end: 18.4, from: [1420, 190], to: [420, 173], click: 18.38 },
      { start: 21.22, end: 21.76, from: [1540, 760], to: [1315, 628], click: 21.74 },
    ];
    const path = paths.find((item) => time >= item.start - 0.25 && time <= item.end + 0.35);
    if (!path) return null;
    const amount = smooth(progress(time, path.start, path.end));
    return {
      x: mix(path.from[0], path.to[0], amount),
      y: mix(path.from[1], path.to[1], amount),
      click: Math.abs(time - path.click) < 0.18,
    };
  }

  function renderCursor(time) {
    const point = cursorPoint(time);
    if (!point) {
      cursor.style.opacity = 0;
      return;
    }
    cursor.style.opacity = 1;
    cursor.style.transform = transform({ x: point.x, y: point.y, scale: point.click ? 0.86 : 1 });
    cursorPulse.style.opacity = point.click ? 1 : 0;
    cursorPulse.style.transform = transform({ scale: point.click ? 1.5 : 0.6 });
  }

  window.renderFrame = (time) => {
    const t = clamp(Number(time) || 0, 0, DURATION);
    renderHero(t);
    renderImport(t);
    renderEdit(t);
    renderLayout(t);
    renderMargins(t);
    renderOrganize(t);
    renderCover(t);
    renderFinal(t);
    renderCursor(t);
    progressBar.style.width = `${(t / DURATION) * 100}%`;
    document.documentElement.dataset.ready = 'true';
  };

  window.PROMO_DURATION = DURATION;
  window.renderFrame(0);
})();
