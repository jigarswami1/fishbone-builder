
/* =========================
   Fishbone Diagram Builder
   ========================= */

// ---------- Defaults ----------
const DEFAULT_STATE = {
  problem: "High defect rate",
  categories: [
    { name: "People", causes: [] },
    { name: "Process", causes: [] },
    { name: "Equipment", causes: [] },
    { name: "Materials", causes: [] },
    { name: "Environment", causes: [] },
    { name: "Management", causes: [] },
  ],
};

// ---------- State & elements ----------
let state = loadState();
let headSide = loadHeadSide(); // 'right' | 'left'

const problemInput   = document.getElementById("problemInput");
const categoryInput  = document.getElementById("categoryInput");
const categorySelect = document.getElementById("categorySelect");
const causeInput     = document.getElementById("causeInput");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const addCauseBtn    = document.getElementById("addCauseBtn");
const exportPngBtn   = document.getElementById("exportPngBtn");
const exportJsonBtn  = document.getElementById("exportJsonBtn");
const importJsonInput= document.getElementById("importJsonInput");
const resetBtn       = document.getElementById("resetBtn");
const structureDiv   = document.getElementById("structure");
const svg            = document.getElementById("fishSvg");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const headSideSelect = document.getElementById("headSideSelect");

// ---------- Init ----------
problemInput.value = state.problem;
renderCategorySelect();
renderStructure();
initTheme();
initHeadSide();
renderDiagram();

// ---------- Event bindings ----------
problemInput.addEventListener("input", () => {
  state.problem = problemInput.value.trim();
  persistState();
  renderDiagram();
});

addCategoryBtn.addEventListener("click", () => {
  const name = (categoryInput.value || "").trim();
  if (!name) { alert("Enter a category name"); return; }
  state.categories.push({ name, causes: [] });
  categoryInput.value = "";
  persistState();
  renderCategorySelect();
  renderStructure();
  renderDiagram();
});

addCauseBtn.addEventListener("click", () => {
  const idx = categorySelect.selectedIndex;
  const cause = (causeInput.value || "").trim();
  if (idx < 0) { alert("Add/select a category first"); return; }
  if (!cause) { alert("Enter a cause"); return; }
  state.categories[idx].causes.push(cause);
  causeInput.value = "";
  persistState();
  renderStructure();
  renderDiagram();
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset diagram to default? This will clear current changes.")) return;
  state = structuredClone(DEFAULT_STATE);
  problemInput.value = state.problem;
  persistState();
  renderCategorySelect();
  renderStructure();
  renderDiagram();
});

exportJsonBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "fishbone.json"; a.click();
  URL.revokeObjectURL(url);
});

importJsonInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.categories) || typeof data.problem !== "string") {
      throw new Error("Invalid JSON structure");
    }
    state = data;
    problemInput.value = state.problem;
    persistState();
    renderCategorySelect();
    renderStructure();
    renderDiagram();
  } catch (err) {
    alert("Import failed: " + err.message);
  } finally {
    e.target.value = "";
  }
});

exportPngBtn.addEventListener("click", exportSvgToPng);

// Theme toggle
themeToggleBtn.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("fishbone_theme", isDark ? "dark" : "light");
  themeToggleBtn.textContent = isDark ? "Dark → Light" : "Light → Dark";
});

// Head side toggle
headSideSelect.addEventListener("change", () => {
  headSide = headSideSelect.value === "left" ? "left" : "right";
  localStorage.setItem("fishbone_head_side", headSide);
  renderDiagram();
});

/* ---------- Persistence ---------- */
function persistState(){ localStorage.setItem("fishbone_state", JSON.stringify(state)); }
function loadState(){
  try {
    const raw = localStorage.getItem("fishbone_state");
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.categories) || typeof parsed.problem !== "string") {
      return structuredClone(DEFAULT_STATE);
    }
    return parsed;
  } catch { return structuredClone(DEFAULT_STATE); }
}

function initTheme(){
  const saved = localStorage.getItem("fishbone_theme") || "light";
  if (saved === "dark") document.body.classList.add("dark");
  themeToggleBtn.textContent = saved === "dark" ? "Dark → Light" : "Light → Dark";
}
function loadHeadSide(){
  const saved = localStorage.getItem("fishbone_head_side");
  return (saved === "left" || saved === "right") ? saved : "right";
}
function initHeadSide(){
  headSideSelect.value = headSide;
}

/* ---------- UI helpers ---------- */
function renderCategorySelect() {
  categorySelect.innerHTML = "";
  state.categories.forEach((c, i) => {
    const opt = document.createElement("option");
    opt.value = i; opt.textContent = c.name;
    categorySelect.appendChild(opt);
  });
}
function renderStructure() {
  structureDiv.innerHTML = "";
  state.categories.forEach((c) => {
    const wrap = document.createElement("div");
    wrap.className = "cat";
    wrap.innerHTML = `<b>${c.name}:</b> ${c.causes.length ? "" : "<span class='cause'>Add causes</span>"}`;
    c.causes.forEach(cs => {
      const chip = document.createElement("span");
      chip.className = "cause";
      chip.textContent = cs;
      wrap.appendChild(chip);
    });
    structureDiv.appendChild(wrap);
  });
}

/* ---------- Diagram Rendering (SVG) ---------- */
function renderDiagram(){
  // Clear SVG
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 1200, H = 700;
  const margin = 80;
  const spineY = H / 2;

  // Spine direction based on headSide
  const spineStartX = (headSide === 'right') ? margin : W - margin*1.5;
  const spineEndX   = (headSide === 'right') ? W - margin*1.5 : margin;

  // Main spine
  addLine(spineStartX, spineY, spineEndX, spineY);

  // Head box
  const headW = 260, headH = 60;
  const headX = (headSide === 'right') ? (spineEndX - headW + 10) : (spineEndX - 10 - headW);
  const headY = spineY - headH/2;
  addRect(headX, headY, headW, headH);
  addText(headX + headW/2, headY + headH/2, state.problem, { anchor: "middle", fontSize: 14, weight: 600 });

  // Tail fin
  const tailOffset = (headSide === 'right') ? -30 : 30;
  addPolyline([
    [spineStartX + tailOffset, spineY],
    [spineStartX, spineY - 18],
    [spineStartX, spineY + 18],
    [spineStartX + tailOffset, spineY]
  ]);

  // Layout categories alternating top/bottom
  const usableSpine = Math.abs(spineEndX - spineStartX) - headW - 40;
  const step = Math.max(160, usableSpine / Math.max(1, state.categories.length));
  let xStart = (headSide === 'right') ? (spineStartX + 100) : (spineEndX - usableSpine + 100);

  state.categories.forEach((cat, i) => {
    const top = i % 2 === 0;
    const baseX = (headSide === 'right')
      ? Math.min(xStart + i*step, spineEndX - headW - 60)
      : Math.max(xStart + i*step, spineEndX + headW + 60);
    const baseY = spineY;

    // Bone geometry
    const boneLen = 220;
    const dy = top ? -130 : 130;
    const tipX = baseX + (headSide === 'right' ? boneLen : -boneLen);
    const tipY = baseY + dy;

    // Draw main bone
    addLine(baseX, baseY, tipX, tipY);

    // Category label near the tip
    addText(tipX + (headSide === 'right' ? 8 : -8), tipY + (top ? -10 : 22), cat.name, {
      anchor: headSide === 'right' ? "start" : "end",
      fontSize: 14,
      weight: 600
    });

    // --- Causes: perpendicular ticks + fanned labels ---
    const causes = cat.causes || [];
    const m = Math.max(causes.length, 1);
    const tickLen = 52;                 // length of perpendicular tick
    const labelOffset = 10;             // gap from tick end to label start
    const stackGap = 14;                // extra outward offset per cause (fans labels away)
    const alongStep = boneLen / (m + 1);

    // Unit along-bone vector (tip - base)
    const ux = tipX - baseX;
    const uy = tipY - baseY;
    const ulen = Math.hypot(ux, uy);
    const vx = ux / ulen;               // along direction
    const vy = uy / ulen;

    // Perpendicular unit (normal) pointing outward
    let nx = -vy, ny = vx;
    if (!top) { nx = -nx; ny = -ny; }   // flip normal for bottom side

    // Dynamic font size: many causes => slightly smaller text
    const labelFont = Math.max(11, 14 - Math.floor(causes.length / 3));

    causes.forEach((cause, j) => {
      const t = (j + 1) / (m + 1);
      // Point on bone
      const px = baseX + vx * (boneLen * t);
      const py = baseY + vy * (boneLen * t);

      // Perpendicular tick centered at (px,py)
      const half = tickLen / 2;
      const tx1 = px - nx * half, ty1 = py - ny * half;
      const tx2 = px + nx * half, ty2 = py + ny * half;
      addLine(tx1, ty1, tx2, ty2);

      // Fan the label away from the bone by labelOffset + j*stackGap
      const fan = labelOffset + j * stackGap;
      let lx = tx2 + nx * fan;
      let ly = ty2 + ny * fan;

      // Clamp to viewport with a margin
      lx = Math.max(margin, Math.min(W - margin, lx));
      ly = Math.max(margin, Math.min(H - margin, ly));

      // Wrap long labels to multiple lines
      addWrappedText(lx, ly, cause, {
        anchor: headSide === 'right' ? "start" : "end",
        fontSize: labelFont,
        maxCharsPerLine: 14,
        lineHeight: 16
      });
    });
  });

  /* --- SVG helpers --- */
  function addLine(x1,y1,x2,y2){
    const el = document.createElementNS("http://www.w3.org/2000/svg","line");
    el.setAttribute("x1", x1); el.setAttribute("y1", y1);
    el.setAttribute("x2", x2); el.setAttribute("y2", y2);
    svg.appendChild(el);
  }
  function addPolyline(points){
    const el = document.createElementNS("http://www.w3.org/2000/svg","polyline");
    el.setAttribute("points", points.map(p => p.join(",")).join(" "));
    svg.appendChild(el);
  }
  function addRect(x,y,w,h){
    const el = document.createElementNS("http://www.w3.org/2000/svg","rect");
    el.setAttribute("x", x); el.setAttribute("y", y);
    el.setAttribute("width", w); el.setAttribute("height", h);
    el.setAttribute("rx", 8); el.setAttribute("ry", 8);
    // readable head box for both themes
    el.style.fill = "rgba(0,0,0,0.75)";
    el.style.stroke = "none";
    svg.appendChild(el);
  }
  function addText(x,y,text,{anchor="middle",fontSize=14,weight=400}={}){
    const el = document.createElementNS("http://www.w3.org/2000/svg","text");
    el.setAttribute("x", x); el.setAttribute("y", y);
    el.setAttribute("text-anchor", anchor);
    el.style.fontSize = `${fontSize}px`;
    el.style.fontWeight = weight;
    el.textContent = text;
    svg.appendChild(el);
  }
  function addWrappedText(x,y,str,{anchor="start",fontSize=13,lineHeight=16,maxCharsPerLine=14}={}){
    const el = document.createElementNS("http://www.w3.org/2000/svg","text");
    el.setAttribute("x", x); el.setAttribute("y", y);
    el.setAttribute("text-anchor", anchor);
    el.style.fontSize = `${fontSize}px`;
    el.style.fontWeight = 400;

    const lines = wrapByWords(str, maxCharsPerLine);
    lines.forEach((ln, idx) => {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg","tspan");
      tspan.setAttribute("x", x);
      tspan.setAttribute("dy", idx === 0 ? 0 : lineHeight);
      tspan.textContent = ln;
      el.appendChild(tspan);
    });
    svg.appendChild(el);
  }
  function wrapByWords(text, maxLen){
    const words = (text || "").split(/\s+/);
    const lines = [];
    let cur = "";
    words.forEach(w => {
      if ((cur + " " + w).trim().length > maxLen) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = (cur ? cur + " " : "") + w;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }
}

/* ---------- Export PNG (white background) ---------- */
async function exportSvgToPng(){
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const width  = svg.viewBox.baseVal.width  || 1200;
    const height = svg.viewBox.baseVal.height || 700;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Always export on white for readability
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw SVG over white
    ctx.drawImage(img, 0, 0);

    // Export to PNG
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fishbone.png";
      a.click();
      URL.revokeObjectURL(a.href);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => {
    alert("PNG export failed.");
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
``
