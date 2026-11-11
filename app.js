'use strict';

const { subjects, challenges } = window.ACADEMY;
const allLessons = subjects.flatMap(subject => subject.lessons);
const lessonIds = new Set(allLessons.map(lesson => lesson.id));
const subjectIds = new Set(subjects.map(subject => subject.id));
const challengeIds = new Set(challenges.map(challenge => challenge.id));
const storageKey = 'academiaDigitalV3';
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const emptyState = () => ({ version:3, completed:[], labs:[], exams:{}, notes:{}, drafts:{}, lastLesson:'web-estructura', days:[] });
let state = emptyState();
let canSave = true;
let currentLesson = null;
let currentSubject = null;
let quizPassed = false;
let currentExam = null;
let currentChallenge = null;
let previewTimer;
let toastTimer;
let labRevision = 0;
let previewRevision = -1;

function normalizeState(input) {
  if (!input || input.version !== 3 || !Array.isArray(input.completed) || !Array.isArray(input.labs)) {
    throw new Error('El archivo no es un respaldo de Academia Digital versión 3.');
  }
  const result = emptyState();
  result.completed = [...new Set(input.completed.filter(id => lessonIds.has(id)))];
  result.labs = [...new Set(input.labs.filter(id => challengeIds.has(id)))];
  if (input.exams && typeof input.exams === 'object') {
    for (const [id, score] of Object.entries(input.exams)) {
      if (subjectIds.has(id) && Number.isInteger(score) && score >= 0 && score <= 100) result.exams[id] = score;
    }
  }
  if (input.notes && typeof input.notes === 'object') {
    for (const [id, note] of Object.entries(input.notes)) {
      if (lessonIds.has(id) && typeof note === 'string') result.notes[id] = note.slice(0, 4000);
    }
  }
  if (input.drafts && typeof input.drafts === 'object') {
    for (const [id, draft] of Object.entries(input.drafts)) {
      if (challengeIds.has(id) && draft && typeof draft.html === 'string' && typeof draft.css === 'string') {
        result.drafts[id] = { html:draft.html.slice(0,30000), css:draft.css.slice(0,30000) };
      }
    }
  }
  if (lessonIds.has(input.lastLesson)) result.lastLesson = input.lastLesson;
  if (Array.isArray(input.days)) result.days = [...new Set(input.days.filter(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)))].slice(-366);
  return result;
}

try {
  const raw = localStorage.getItem(storageKey);
  if (raw) state = normalizeState(JSON.parse(raw));
} catch {
  canSave = false;
}

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); canSave = true; }
  catch { canSave = false; }
  updateHeader();
}
function recordStudy() {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  if (!state.days.includes(day)) state.days.push(day);
  state.days = state.days.slice(-366);
}
function points() {
  return state.completed.length * 25 + state.labs.length * 60 + Object.values(state.exams).filter(score => score >= 80).length * 100;
}
function updateHeader() {
  $('#header-xp').textContent = `${points()} XP`;
  $('#header-level').textContent = `NIVEL ${Math.floor(points()/150)+1}`;
  $('.local-label').innerHTML = `<i></i> ${canSave ? 'Avance en este navegador' : 'Sin guardado persistente'}`;
}
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
function progressOf(subject) {
  return subject.lessons.filter(lesson => state.completed.includes(lesson.id)).length;
}
function lessonLink(lesson) { return `#clase/${lesson.id}`; }
function findSubject(lesson) { return subjects.find(subject => subject.lessons.includes(lesson)); }
function icon(subject) { return `<span class="subject-icon" style="--subject-color:${subject.color}">${escapeHTML(subject.icon)}</span>`; }
function subjectCard(subject, index) {
  const done = progressOf(subject);
  return `<a class="subject-card" href="#materia/${subject.id}">${icon(subject)}<div><span class="card-number">MATERIA ${String(index+1).padStart(2,'0')}</span><h3>${escapeHTML(subject.short)}</h3><p>${escapeHTML(subject.description)}</p><div class="card-progress"><span>${done}/${subject.lessons.length} lecciones</span><span>${Math.round(done/subject.lessons.length*100)}%</span></div><div class="track"><i style="width:${done/subject.lessons.length*100}%"></i></div></div><span class="card-arrow" aria-hidden="true">↗</span></a>`;
}
function pageHeading(kicker, title, copy='') {
  return `<div class="page-heading"><p class="eyebrow">${kicker}</p><h1>${title}</h1>${copy ? `<p>${copy}</p>` : ''}</div>`;
}
function storageWarning() {
  return canSave ? '' : '<p class="notice">El navegador no pudo cargar o guardar el avance. Puedes estudiar y exportar un respaldo desde Mi progreso.</p>';
}

function renderHome() {
  const recent = allLessons.find(lesson => lesson.id === state.lastLesson) || allLessons[0];
  const next = state.completed.includes(recent.id) ? allLessons.find(lesson => !state.completed.includes(lesson.id)) || recent : recent;
  const subject = findSubject(next);
  $('#main').innerHTML = `${storageWarning()}<section class="hero"><div class="hero-shade"></div><div class="hero-content"><p class="eyebrow"><span class="tiny-spark">✦</span> TU SANTUARIO DEL CONOCIMIENTO</p><h1>Pequeños pasos.<br><em>Grandes habilidades.</em></h1><p>Ocho materias, un mundo por descubrir.<br>Aprende, experimenta y sube de nivel con Gengar.</p><div class="hero-actions"><a class="button primary" href="${lessonLink(next)}">Continuar mi aventura <span>→</span></a><a class="button quiet" href="#laboratorio">Abrir laboratorio</a></div><span class="hero-caption">EL TEMPLO DE LAS IDEAS · ACADEMIA DIGITAL</span></div><span class="scene-tag"><i></i> TU PRÓXIMA MISIÓN TE ESPERA</span></section>
    <section class="overview-strip" aria-label="Resumen de avance"><div><span class="stat-icon">▤</span><p><strong>8</strong><span>materias para explorar</span></p></div><div><span class="stat-icon">✓</span><p><strong>${state.completed.length}<small> / ${allLessons.length}</small></strong><span>lecciones completadas</span></p></div><div><span class="stat-icon">✦</span><p><strong>${points()}<small> XP</small></strong><span>cada logro suma</span></p></div><div><span class="stat-icon">◇</span><p><strong>${state.days.length}</strong><span>días de práctica registrados</span></p></div></section>
    <section class="continue-row"><div><p class="eyebrow">RETOMA TU CAMINO</p><h2>${escapeHTML(next.title)}</h2><p>${escapeHTML(subject.short)} <span>· ${next.minutes} min · ${next.level}</span></p></div><a href="${lessonLink(next)}" class="button secondary">Entrar a clase →</a></section>
    <section><div class="section-heading"><div><p class="eyebrow">ELIGE TU CAMINO</p><h2>Tus materias</h2></div><a href="#materias" class="text-link">Ver rutas de aprendizaje ↗</a></div><div class="subjects-grid">${subjects.map(subjectCard).join('')}</div></section>
    <section class="lab-banner"><span class="code-symbol" aria-hidden="true">&lt;/&gt;</span><div><p class="eyebrow">APRENDE CONSTRUYENDO</p><h2>Tu código. Tu primera creación.</h2><p>Escribe HTML y CSS, observa el resultado y supera cuatro retos prácticos.</p></div><a class="button secondary" href="#laboratorio">Entrar al laboratorio →</a></section>`;
}

function renderSubjects() {
  $('#main').innerHTML = `${pageHeading('OCHO MATERIAS · SIN P.C.A.', 'Cada materia tiene su camino.', 'Explora las lecciones por nivel. Puedes repasar cualquier tema sin perder tu progreso.')}<div class="subjects-grid">${subjects.map(subjectCard).join('')}</div><p class="footnote">Contenido inicial de refuerzo. Las rutas se ampliarán con nuevos temas; no sustituyen el programa completo del semestre.</p>`;
}

function renderSubject(subject) {
  const done = progressOf(subject);
  $('#main').innerHTML = `<a class="back-link" href="#materias">← Todas las materias</a>${pageHeading(subject.id === 'web' ? 'RUTA DE PROGRAMACIÓN' : 'RUTA DE ESTUDIO',escapeHTML(subject.name),escapeHTML(subject.description))}
    <div class="route-summary"><div>${icon(subject)}<span><strong>${done} de ${subject.lessons.length} lecciones</strong><small>${subject.lessons.reduce((sum,lesson)=>sum+lesson.minutes,0)} minutos estimados · +25 XP por lección</small></span></div><div class="track"><i style="width:${done/subject.lessons.length*100}%"></i></div></div>
    <div class="route-layout"><section class="lesson-list" aria-label="Lecciones">${subject.lessons.map((lesson,index)=>`<a class="lesson-row" href="${lessonLink(lesson)}"><span class="lesson-number ${state.completed.includes(lesson.id)?'done':''}">${state.completed.includes(lesson.id)?'✓':String(index+1).padStart(2,'0')}</span><div><span class="level-tag">${lesson.level} · ${lesson.minutes} min</span><h2>${escapeHTML(lesson.title)}</h2><p>${escapeHTML(lesson.objective)}</p></div><span aria-hidden="true">→</span></a>`).join('')}</section>
    <aside class="route-aside"><img src="assets/gengar.svg" alt="Gengar" width="100" height="100"><h2>Primero entiende.<br>Después, comprueba.</h2><p>Lee el ejemplo, predice qué ocurre y explica el resultado con tus palabras.</p><a class="button primary" href="#examen/${subject.id}">Examen de repaso →</a><small>${state.exams[subject.id] !== undefined ? `Mejor resultado: ${state.exams[subject.id]}%` : 'Aprueba con 80% · +100 XP una sola vez'}</small></aside></div>
    <div class="source-note"><strong>Base de esta ruta</strong><p>${escapeHTML(subject.source)}</p>${subject.url ? `<a href="${subject.url}" target="_blank" rel="noopener noreferrer">Abrir material del curso ↗</a>` : '<p>Prácticas originales para aprender haciendo.</p>'}</div>`;
}

function renderLesson(lesson) {
  currentLesson = lesson;
  currentSubject = findSubject(lesson);
  quizPassed = false;
  state.lastLesson = lesson.id;
  save();
  const index = currentSubject.lessons.indexOf(lesson);
  const done = state.completed.includes(lesson.id);
  const next = currentSubject.lessons[index+1];
  $('#main').innerHTML = `<a class="back-link" href="#materia/${currentSubject.id}">← ${escapeHTML(currentSubject.short)}</a>${pageHeading(`${lesson.level.toUpperCase()} · LECCIÓN ${index+1} / ${currentSubject.lessons.length} · ${lesson.minutes} MIN`,escapeHTML(lesson.title),escapeHTML(lesson.objective))}
    <div class="class-layout"><div><section class="reading-block"><p class="eyebrow">01 / COMPRENDE</p><h2>La idea, paso a paso</h2>${lesson.explanation.map(text=>`<p>${escapeHTML(text)}</p>`).join('')}</section><section class="reading-block"><div class="section-heading compact"><p class="eyebrow">02 / OBSERVA</p><button class="text-button" data-action="copy-example">Copiar ejemplo</button></div><pre><code>${escapeHTML(lesson.code)}</code></pre><div class="explanation"><span aria-hidden="true">↳</span><p>${escapeHTML(lesson.walkthrough)}</p></div></section>
    <section class="reading-block quiz-block"><p class="eyebrow">03 / PONTE A PRUEBA</p><h2>${escapeHTML(lesson.question)}</h2><div class="quiz-options">${lesson.options.map((option,i)=>`<button class="quiz-option" data-answer="${i}"><span>${String.fromCharCode(65+i)}</span>${escapeHTML(option)}</button>`).join('')}</div><div id="quiz-feedback" class="feedback" aria-live="polite"></div><div class="quiz-actions"><button class="text-button" data-action="hint">Necesito una pista</button><button class="button primary" id="complete-lesson" data-action="complete-lesson" disabled>${done?'Lección ya completada ✓':'Completar y ganar 25 XP'}</button></div></section>
    <section class="reading-block"><p class="eyebrow">04 / LLÉVALO A LA PRÁCTICA</p><h2>Ahora te toca crear</h2><p>${escapeHTML(lesson.practice)}</p>${lesson.lab?`<a class="button secondary" href="#laboratorio/${lesson.lab}">Practicar en el laboratorio →</a>`:'<p class="footnote">Realiza esta práctica en tu cuaderno, editor o simulador. La academia no verifica automáticamente esta actividad externa.</p>'}<label class="notes-label" for="lesson-notes">Mis apuntes · explica lo que entendiste</label><textarea id="lesson-notes" maxlength="4000" rows="4" placeholder="¿Qué cambió en tu forma de entender este tema?">${escapeHTML(state.notes[lesson.id]||'')}</textarea><small id="notes-status">${canSave?'Se guardan al escribir en este navegador.':'Guardado no disponible; exporta un respaldo antes de cerrar.'}</small></section>
    <div class="lesson-bottom"><a class="button quiet" href="#materia/${currentSubject.id}">Volver a la ruta</a>${next?`<a class="button secondary" href="${lessonLink(next)}">Siguiente: ${escapeHTML(next.title)} →</a>`:`<a class="button secondary" href="#examen/${currentSubject.id}">Hacer examen de repaso →</a>`}</div></div>
    <aside class="lesson-aside"><img class="floating-gengar" src="assets/gengar.svg" alt="Gengar, compañero de estudio" width="110" height="110"><p class="eyebrow">CONSEJO DE GENGAR</p><p>${escapeHTML(lesson.hint)}</p><button class="button quiet" data-action="explain">Explícamelo fácil</button><div class="source-note"><strong>Referencia</strong><p>${escapeHTML(currentSubject.source)}</p>${currentSubject.url?`<a href="${currentSubject.url}" target="_blank" rel="noopener noreferrer">Consultar fuente ↗</a>`:''}</div></aside></div>`;
}

function renderExam(subject) {
  currentSubject = subject;
  // Repaso de los conceptos trabajados, sin fingir que es una evaluación oficial.
  currentExam = {subject, questions:subject.lessons.slice(0,5), submitted:false};
  $('#main').innerHTML = `<a class="back-link" href="#materia/${subject.id}">← Volver a la ruta</a>${pageHeading('EXAMEN DE REPASO',escapeHTML(subject.short),'Contesta todas las preguntas. Al finalizar verás por qué cada respuesta es correcta o incorrecta.')}<p class="exam-rules">${currentExam.questions.length} preguntas · Aprueba con 80% · Sin límite de tiempo · +100 XP al aprobar por primera vez</p><form id="exam-form">${currentExam.questions.map((lesson,index)=>`<fieldset class="exam-question"><legend><span>${String(index+1).padStart(2,'0')}</span> ${escapeHTML(lesson.question)}</legend>${lesson.options.map((option,i)=>`<label class="exam-option"><input type="radio" name="q${index}" value="${i}" required><span>${escapeHTML(option)}</span></label>`).join('')}<div class="exam-feedback" id="exam-feedback-${index}"></div></fieldset>`).join('')}<button class="button primary" type="submit">Revisar mis respuestas →</button></form><section id="exam-result" aria-live="polite"></section>`;
}

function submitExam(event) {
  event.preventDefault();
  if (!currentExam || currentExam.submitted) return;
  const form = event.target;
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  let correct = 0;
  currentExam.questions.forEach((lesson,index)=>{
    const answer = Number(values.get(`q${index}`));
    const ok = answer === lesson.answer;
    if (ok) correct++;
    const feedback = $(`#exam-feedback-${index}`);
    feedback.className = `exam-feedback ${ok?'success':'error'}`;
    feedback.textContent = `${ok?'✓ Correcto.':'Revisa este concepto.'} ${lesson.feedback[answer]}${ok?'':` Respuesta: ${lesson.options[lesson.answer]}. ${lesson.feedback[lesson.answer]}`}`;
  });
  const score = Math.round(correct/currentExam.questions.length*100);
  const previous = state.exams[currentExam.subject.id] || 0;
  state.exams[currentExam.subject.id] = Math.max(score,previous);
  currentExam.submitted = true;
  recordStudy(); save();
  form.querySelectorAll('input, button').forEach(element=>{element.disabled=true;});
  $('#exam-result').innerHTML = `<div class="result-box"><span class="result-score">${score}%</span><h2>${score>=80?'¡Examen superado!':'Ya sabes qué reforzar.'}</h2><p>${correct} de ${currentExam.questions.length} respuestas correctas. ${score>=80 && previous<80?'+100 XP para tu aventura.':'Revisa las explicaciones y vuelve a practicar.'}</p><div class="button-row"><button class="button secondary" data-action="retry-exam">Repetir examen</button><a class="button quiet" href="#materia/${currentExam.subject.id}">Repasar lecciones</a></div></div>`;
  $('#exam-result').scrollIntoView({behavior:'smooth',block:'center'});
}

function renderLab(challenge) {
  currentChallenge = challenge;
  const draft = state.drafts[challenge.id] || challenge;
  labRevision = 0;
  previewRevision = -1;
  $('#main').innerHTML = `${pageHeading('LABORATORIO HTML + CSS', 'Las ideas se convierten en código.', 'Modifica, observa y prueba. El editor guarda un borrador independiente por reto.')}<div class="lab-top"><label for="challenge-select">Tu misión <select id="challenge-select">${challenges.map(item=>`<option value="${item.id}" ${item.id===challenge.id?'selected':''}>${item.title} · ${item.level}</option>`).join('')}</select></label><span class="reward-tag">${state.labs.includes(challenge.id)?'Completado ✓':'+60 XP al superar el reto'}</span></div><div class="mission"><strong>${escapeHTML(challenge.title)}</strong><p>${escapeHTML(challenge.goal)}</p></div>
    <div class="lab-grid"><section class="editors" aria-label="Editores de código"><div class="editor-heading"><label for="html-editor">HTML <small>ESTRUCTURA</small></label><button class="text-button" data-action="reset-code">Restaurar reto</button></div><textarea id="html-editor" class="code-editor" spellcheck="false" maxlength="30000" aria-describedby="editor-help">${escapeHTML(draft.html)}</textarea><div class="editor-heading"><label for="css-editor">CSS <small>ESTILO</small></label><span id="draft-status">Borrador local</span></div><textarea id="css-editor" class="code-editor" spellcheck="false" maxlength="30000" aria-describedby="editor-help">${escapeHTML(draft.css)}</textarea></section><section class="preview-section" aria-label="Resultado del código"><div class="editor-heading"><strong>VISTA PREVIA</strong><div class="preview-size"><button class="active" data-size="desktop" aria-pressed="true">Escritorio</button><button data-size="mobile" aria-pressed="false">Móvil</button></div></div><div class="preview-stage"><iframe id="preview" title="Vista previa de tu HTML y CSS" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe></div><p id="editor-help" class="footnote">HTML y CSS locales. JavaScript, recursos externos, navegación y formularios están bloqueados en esta vista. Tab recorre los controles.</p></section></div><div class="lab-actions"><button class="button primary" data-action="check-code">Comprobar mi reto →</button><button class="button secondary" data-action="download-code">Descargar mi página</button><button class="text-button" data-action="lab-hint">Dame una pista</button></div><section id="lab-results" class="lab-results" aria-live="polite"></section>`;
  updatePreview();
}

function cleanPreviewHTML(html) {
  const doc = new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('script, iframe, frame, frameset, object, embed, link, base, meta, style').forEach(element=>element.remove());
  doc.querySelectorAll('*').forEach(element=>{
    for (const attr of [...element.attributes]) {
      if (/^on/i.test(attr.name) || ['srcdoc','action','formaction','href','xlink:href','srcset','ping','autofocus','target'].includes(attr.name)) element.removeAttribute(attr.name);
      if (attr.name === 'src' && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(attr.value)) element.removeAttribute('src');
    }
  });
  return doc.body.innerHTML;
}
function updatePreview() {
  const frame = $('#preview');
  if (!frame) return;
  const revision = labRevision;
  const html = cleanPreviewHTML($('#html-editor').value);
  const css = $('#css-editor').value.replace(/<\/style/gi,'<\\/style');
  frame.onload = () => { if ($('#preview') === frame) previewRevision = revision; };
  frame.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>body{font-family:system-ui,sans-serif;color:#231a2e;background:#faf8ff;margin:0;padding:20px;overflow-wrap:anywhere}*{box-sizing:border-box}img{max-width:100%}${css}</style></head><body>${html}</body></html>`;
}
function saveDraft() {
  if (!currentChallenge || !$('#html-editor')) return;
  state.drafts[currentChallenge.id] = {html:$('#html-editor').value,css:$('#css-editor').value};
  save();
  $('#draft-status').textContent = canSave?'Borrador guardado':'Solo en esta sesión';
  labRevision++;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview,350);
}
function checkCode() {
  if (previewRevision !== labRevision) { updatePreview(); toast('Actualizando vista previa. Comprueba el reto en un momento.'); return; }
  const frame = $('#preview');
  const doc = frame.contentDocument;
  if (!doc?.body) { toast('La vista previa aún está cargando.'); return; }
  const styleOf = selector => { const element = doc.querySelector(selector); return element ? frame.contentWindow.getComputedStyle(element) : null; };
  const profile = styleOf('.perfil');
  const menu = styleOf('nav');
  const gallery = styleOf('.galeria');
  const rules = [...doc.styleSheets].flatMap(sheet => [...sheet.cssRules]);
  const tests = {
    heading:[Boolean(doc.querySelector('h1')?.textContent.trim()),'Un h1 con contenido'],
    paragraph:[Boolean(doc.querySelector('p')?.textContent.trim()),'Un párrafo con contenido'],
    profile:[Boolean(profile),'Un elemento con clase perfil'],
    padding:[Boolean(profile && ['paddingTop','paddingRight','paddingBottom','paddingLeft'].every(side=>parseFloat(profile[side])>=16)),'Padding de al menos 16 px en los cuatro lados de .perfil'],
    background:[Boolean(profile && !['rgba(0, 0, 0, 0)','transparent'].includes(profile.backgroundColor)),'Color de fondo visible en .perfil'],
    nav:[Boolean(doc.querySelector('nav')),'Un elemento nav'],
    links:[doc.querySelectorAll('nav a').length>=3,'Tres enlaces dentro de nav'],
    flex:[Boolean(menu && ['flex','inline-flex'].includes(menu.display)),'Flexbox aplicado al nav'],
    gap:[Boolean(menu && parseFloat(menu.columnGap)>=8),'Separación horizontal de al menos 8 px'],
    articles:[doc.querySelectorAll('.galeria article').length>=4,'Cuatro artículos dentro de .galeria'],
    grid:[Boolean(gallery && ['grid','inline-grid'].includes(gallery.display)),'Grid aplicado a .galeria'],
    columns:[Boolean(gallery && gallery.gridTemplateColumns.split(' ').filter(Boolean).length>=2 && gallery.gridTemplateColumns!=='none'),'Al menos dos columnas en la vista actual'],
    landmarks:[['header','nav','main','footer'].every(tag=>doc.querySelector(tag)),'Header, nav, main y footer'],
    imagealt:[Boolean(doc.querySelector('img[alt]')?.getAttribute('alt')?.trim()),'Imagen con texto alternativo descriptivo'],
    media:[rules.some(rule=>rule.type===CSSRule.MEDIA_RULE && /width/.test(rule.conditionText) && rule.cssRules.length>0),'Media query de ancho con al menos una regla']
  };
  const results = currentChallenge.checks.map(key=>tests[key]);
  const passed = results.every(([ok])=>ok);
  $('#lab-results').innerHTML = `<h2>${passed?'¡Reto superado!':'Tu siguiente ajuste'}</h2><ul class="checklist">${results.map(([ok,label])=>`<li class="${ok?'success':'error'}"><span>${ok?'✓':'○'}</span>${escapeHTML(label)}</li>`).join('')}</ul><p>${passed?'Tu estructura cumple los criterios. Prueba también la vista móvil y revisa la legibilidad.':'Corrige los puntos pendientes y vuelve a comprobar. Las pruebas revisan estos criterios concretos, no toda la calidad del diseño.'}</p>`;
  if (passed && !state.labs.includes(currentChallenge.id)) {state.labs.push(currentChallenge.id);recordStudy();save();toast('¡+60 XP! Tu creación ya es parte del santuario.');$('.reward-tag').textContent='Completado ✓';}
}

function renderProgress() {
  const xp = points();
  const level = Math.floor(xp/150)+1;
  const badges = [
    ['Primer paso','Completa tu primera lección.',state.completed.length>=1,'✦'],
    ['Constructor web','Supera un reto del laboratorio.',state.labs.length>=1,'</>'],
    ['Explorador','Completa una lección en tres materias.',subjects.filter(subject=>progressOf(subject)>0).length>=3,'◇'],
    ['Mente preparada','Aprueba un examen de repaso.',Object.values(state.exams).some(score=>score>=80),'✓'],
    ['Arquitecto del templo','Supera los cuatro retos de código.',state.labs.length===4,'⌂'],
    ['Guardián del conocimiento','Completa las 31 lecciones iniciales.',state.completed.length===allLessons.length,'★']
  ];
  $('#main').innerHTML = `${pageHeading('TU HISTORIA, PASO A PASO','Cada intento construye algo.','Los puntos se otorgan una vez por logro. Repetir y repasar nunca borra lo que ya aprendiste.')}${storageWarning()}<section class="level-panel"><img src="assets/gengar.svg" alt="Gengar" width="100" height="100"><div><p class="eyebrow">${level<4?'APRENDIZ DEL SANTUARIO':level<8?'EXPLORADOR DE IDEAS':'GUARDIÁN DEL CONOCIMIENTO'}</p><h2>Nivel ${level} <span>· ${xp} XP</span></h2><div class="track"><i style="width:${xp%150/150*100}%"></i></div><p>${150-xp%150} XP para el siguiente nivel</p></div></section><div class="section-heading"><h2>Tus recompensas</h2><span>${badges.filter(b=>b[2]).length} / ${badges.length} desbloqueadas</span></div><div class="badges">${badges.map(([title,description,unlocked,symbol])=>`<div class="badge ${unlocked?'unlocked':''}"><span class="badge-symbol">${escapeHTML(symbol)}</span><h3>${title}</h3><p>${description}</p><small>${unlocked?'Desbloqueada ✓':'Por descubrir'}</small></div>`).join('')}</div><section class="progress-table"><h2>Avance por materia</h2>${subjects.map(subject=>`<a href="#materia/${subject.id}">${icon(subject)}<span>${escapeHTML(subject.short)}</span><strong>${progressOf(subject)}/${subject.lessons.length}</strong><small>${state.exams[subject.id]===undefined?'Sin examen':`Examen: ${state.exams[subject.id]}%`}</small></a>`).join('')}</section><section class="backup-panel"><div><h2>Lleva tu progreso contigo</h2><p>Exporta un respaldo e impórtalo en tu celular. No hay sincronización automática ni cuentas externas.</p><small>El respaldo incluye apuntes y borradores. Guárdalo en un lugar privado.</small></div><div class="button-row"><button class="button secondary" data-action="export">Exportar respaldo</button><label class="button quiet" for="import-file">Importar respaldo<input id="import-file" type="file" accept=".json,application/json" class="file-input"></label></div><button class="text-button danger" data-action="reset-progress">Borrar mi progreso local</button></section>`;
}

function renderSources() {
  $('#main').innerHTML = `${pageHeading('MATERIALES Y ALCANCE','Una academia basada en tus clases.','Revisión curricular del 11 de noviembre de 2026. La edición pública omite los enlaces y archivos privados del curso.')}<section class="reading-block"><h2>Qué se revisó</h2><p>Se consultaron los programas de Inglés y Señales, el índice y secciones relevantes de Deitel (7.ª edición), la guía de Java de cuatro páginas, publicaciones de Cifrado y material de Conmutación.</p><p>La revisión fue parcial. Las lecciones iniciales no sustituyen el temario completo ni el libro de Java.</p><p>Las lecciones son explicaciones originales y ejercicios de refuerzo. Los libros y las entregas privadas no se incluyen en el proyecto. No se modificó ni entregó trabajo en Classroom.</p></section><div class="source-list">${subjects.map(subject=>`<article><h2>${escapeHTML(subject.name)}</h2><p>${escapeHTML(subject.source)}</p>${subject.url?`<a href="${subject.url}" target="_blank" rel="noopener noreferrer">Consultar referencia ↗</a>`:'<span>Ruta propia de programación</span>'}</article>`).join('')}</div><section class="reading-block"><h2>Lo que sigue</h2><p>Ampliar Señales con Cauchy, residuos, TFD, TFDT y transformada Z; desarrollar prácticas completas de VLAN, VTP y STP; agregar proyectos web más extensos y revisar las entregas restantes.</p><p>El acompañamiento de Gengar funciona sin servicios externos: ofrece pistas y retroalimentación preparada. No interpreta cualquier pregunta libre ni ejecuta Java o Python. El laboratorio sí muestra HTML/CSS y comprueba criterios concretos.</p><p>Gengar pertenece a sus respectivos titulares. Este proyecto personal de estudio no es un producto oficial de Pokémon.</p></section>`;
}

function showHelp(type='hint') {
  let message;
  if (currentLesson) {
    message = type==='explain' ? `${currentLesson.explanation[0]} Ejemplo: ${currentLesson.walkthrough}` : type==='next' ? `Tu siguiente paso: ${currentLesson.practice}` : currentLesson.hint;
  } else if (currentChallenge) {
    const hints = {perfil:'Selecciona .perfil y prueba padding: 20px; background: #39234d;. Después cambia los valores para entenderlos.',menu:'Aplica display: flex; gap: 16px; al nav. Añade flex-wrap: wrap; para que pueda ajustarse.',galeria:'Prueba display: grid; grid-template-columns: repeat(2, 1fr); en .galeria. Comprueba en escritorio.',proyecto:'Usa los cuatro elementos semánticos. Una imagen debe tener alt descriptivo. Añade @media (max-width: 600px) con una regla dentro.'};
    message = hints[currentChallenge.id];
  } else message = 'Elige una materia. Lee una lección, explica el ejemplo con tus palabras y resuelve la pregunta. Luego construye algo en el laboratorio.';
  $('#mentor-message').textContent = message;
  $('#mentor-panel').hidden = false;
  $('#mentor-toggle').setAttribute('aria-expanded','true');
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content],{type}));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function navigate() {
  clearTimeout(previewTimer);
  currentLesson = null; currentSubject = null; currentExam = null; currentChallenge = null;
  $('#mentor-panel').hidden = true;
  $('#mentor-toggle').setAttribute('aria-expanded','false');
  const [page,id] = (location.hash.slice(1) || 'inicio').split('/');
  const active = ['materia','clase','examen'].includes(page)?'materias':page;
  document.querySelectorAll('[data-nav]').forEach(link=>{
    const selected = link.dataset.nav===active;
    link.classList.toggle('active',selected);
    if (selected) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  });
  if (page==='materias') renderSubjects();
  else if (page==='materia' && subjectIds.has(id)) renderSubject(subjects.find(subject=>subject.id===id));
  else if (page==='clase' && lessonIds.has(id)) renderLesson(allLessons.find(lesson=>lesson.id===id));
  else if (page==='examen' && subjectIds.has(id)) renderExam(subjects.find(subject=>subject.id===id));
  else if (page==='laboratorio') renderLab(challenges.find(challenge=>challenge.id===id)||challenges[0]);
  else if (page==='progreso') renderProgress();
  else if (page==='fuentes') renderSources();
  else renderHome();
  document.title = `${$('#main h1')?.textContent || 'Inicio'} · Academia Digital`;
  window.scrollTo({top:0,behavior:'instant'});
  $('#main').focus({preventScroll:true});
  updateHeader();
}

document.addEventListener('click',async event=>{
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.answer!==undefined && currentLesson) {
    const answer = Number(button.dataset.answer);
    const correct = answer===currentLesson.answer;
    document.querySelectorAll('.quiz-option').forEach(option=>option.classList.remove('correct','incorrect'));
    button.classList.add(correct?'correct':'incorrect');
    $('#quiz-feedback').className = `feedback ${correct?'success':'error'}`;
    $('#quiz-feedback').textContent = `${correct?'✓ ':''}${currentLesson.feedback[answer]}${correct?'':' Inténtalo otra vez o pide una pista.'}`;
    quizPassed = correct;
    $('#complete-lesson').disabled = !correct;
  }
  if (button.dataset.size) {
    $('#preview').classList.toggle('mobile-preview',button.dataset.size==='mobile');
    document.querySelectorAll('[data-size]').forEach(item=>{const selected=item===button;item.classList.toggle('active',selected);item.setAttribute('aria-pressed',String(selected));});
  }
  if (button.dataset.help) showHelp(button.dataset.help);
  const action = button.dataset.action;
  if (action==='hint' || action==='lab-hint') showHelp('hint');
  if (action==='explain') showHelp('explain');
  if (action==='complete-lesson' && currentLesson && quizPassed) {
    const done = state.completed.includes(currentLesson.id);
    if (!done) state.completed.push(currentLesson.id);
    recordStudy(); save();
    button.textContent = 'Lección completada ✓'; button.disabled=true;
    toast(done?'Repaso completado. Tu logro ya estaba guardado.':'¡+25 XP! Un paso más en tu aventura.');
  }
  if (action==='copy-example' && currentLesson) {
    try { await navigator.clipboard.writeText(currentLesson.code); toast('Ejemplo copiado.'); }
    catch { toast('Selecciona el código y cópialo manualmente; el navegador bloqueó el portapapeles.'); }
  }
  if (action==='retry-exam' && currentExam) renderExam(currentExam.subject);
  if (action==='check-code') checkCode();
  if (action==='reset-code' && currentChallenge && await confirmAction('¿Restaurar el código inicial de este reto? Se reemplazará su borrador.')) {
    delete state.drafts[currentChallenge.id]; save(); renderLab(currentChallenge);
  }
  if (action==='download-code' && currentChallenge) {
    const html = cleanPreviewHTML($('#html-editor').value);
    const css = $('#css-editor').value.replace(/<\/style/gi,'<\\/style');
    downloadFile(`${currentChallenge.id}.html`,`<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mi proyecto</title><style>${css}</style></head><body>${html}</body></html>`,'text/html;charset=utf-8');
  }
  if (action==='export') downloadFile('academia-digital-progreso.json',JSON.stringify(state,null,2),'application/json');
  if (action==='reset-progress' && await confirmAction('¿Borrar lecciones, exámenes, apuntes y borradores de este navegador? Exporta un respaldo primero si quieres conservarlos.')) {
    state=emptyState();save();renderProgress();toast('Progreso local reiniciado.');
  }
});

document.addEventListener('input',event=>{
  if (event.target.id==='lesson-notes' && currentLesson) {
    state.notes[currentLesson.id]=event.target.value;save();$('#notes-status').textContent=canSave?'Apuntes guardados.':'Solo en esta sesión. Exporta un respaldo.';
  }
  if (['html-editor','css-editor'].includes(event.target.id)) saveDraft();
});
document.addEventListener('change',async event=>{
  if(event.target.id==='challenge-select') location.hash=`laboratorio/${event.target.value}`;
  if(event.target.id==='import-file') {
    const file=event.target.files[0];
    if(!file)return;
    try {
      if(file.size>1000000) throw new Error('El respaldo supera el límite de 1 MB.');
      const imported=normalizeState(JSON.parse(await file.text()));
      if(!await confirmAction('¿Reemplazar el progreso de este navegador por el respaldo elegido?'))return;
      state=imported;save();renderProgress();toast('Respaldo importado.');
    } catch(error){toast(error instanceof SyntaxError?'El archivo no contiene JSON válido.':error.message);}
  }
});
document.addEventListener('submit',event=>{if(event.target.id==='exam-form')submitExam(event);});
$('#mentor-toggle').addEventListener('click',()=>{
  if(!$('#mentor-panel').hidden){$('#mentor-panel').hidden=true;$('#mentor-toggle').setAttribute('aria-expanded','false');}
  else showHelp();
});
$('#mentor-close').addEventListener('click',()=>{$('#mentor-panel').hidden=true;$('#mentor-toggle').setAttribute('aria-expanded','false');$('#mentor-toggle').focus();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('#mentor-panel').hidden=true;$('#mentor-toggle').setAttribute('aria-expanded','false');}});
window.addEventListener('hashchange',navigate);
navigate();

function confirmAction(message) {
  const dialog = document.querySelector('#confirmation');
  dialog.querySelector('p').textContent = message;
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'accept'), {once:true});
    dialog.returnValue = 'cancel';
    dialog.showModal();
  });
}