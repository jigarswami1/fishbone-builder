
/* =========================
   Fishbone Diagram Builder
   ========================= */

/* ---------- Data model ---------- */
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

let state = loadState();

/* ---------- UI Elements ---------- */
const problemInput = document.getElementById("problemInput");
const categoryInput = document.getElementById("categoryInput");
const categorySelect = document.getElementById("categorySelect");
const causeInput = document.getElementById("causeInput");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const addCauseBtn = document.getElementById("addCauseBtn");
const exportPngBtn = document.getElementById("exportPngBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const importJsonInput = document.getElementById("importJsonInput");
const resetBtn = document.getElementById("resetBtn");
const structureDiv = document.getElementById("structure");
const svg = document.getElementById("fishSvg");

/* ---------- Init ---------- */
problemInput.value = state.problem;
renderCategorySelect();
renderStructure();
renderDiagram();

/* ---------- Event bindings ---------- */
problemInput.addEventListener("input", () => {
  state.problem = problemInput.value.trim();
  persist(); renderDiagram();
});

addCategoryBtn.addEventListener("click", () => {
  const name = (categoryInput.value || "").trim();
  if (!name) { alert("Enter a category name"); return; }
  state.categories.push({ name, causes: [] });
  categoryInput.value = "";
  persist(); renderCategorySelect(); renderStructure(); renderDiagram();
});

addCauseBtn.addEventListener("click", () => {
  const idx = categorySelect.selectedIndex;
  const cause = (causeInput.value || "").trim();
  if (idx < 0) { alert("Add/select a category first"); return; }
  if (!cause) { alert("Enter a cause"); return; }
  state.categories[idx].causes.push(cause);
  causeInput.value = "";
  persist(); renderStructure(); renderDiagram();
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset diagram to default? This will clear current changes.")) return;
  state = structuredClone(DEFAULT_STATE);
  problemInput.value = state.problem;
  persist(); renderCategorySelect(); renderStructure(); renderDiagram();
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
    persist(); renderCategorySelect(); renderStructure(); renderDiagram();
  } catch (err) {
    alert("Import failed: " + err.message);
  } finally {
    e.target.value = "";
  }
});

exportPngBtn.addEventListener("click", exportSvgToPng);

/* ---------- Helpers: UI ---------- */
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
    wrap.innerHTML = `<b>${c.name}:</b> ${
      c.causes.length ? "" : "<span class='cause'>Add causes</span>"
    }`;
    c.causes.forEach(cs => {
      const chip = document.createElement("span");
      chip.className = "cause";
      chip.textContent = cs;
      wrap.appendChild(chip);
    });
    structureDiv.appendChild(wrap);
  });
}

/* ---------- Persistence ---------- */
function persist(){ localStorage.setItem("fishbone_state", JSON.stringify(state)); }
function loadState(){
  try {
    const raw = localStorage.getItem("fishbone_state");
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    // basic validation
    if (!parsed || !Array.isArray(parsed.categories) || typeof parsed.problem !== "string") {
      return structuredClone(DEFAULT_STATE);
    }
    return parsed;
  } catch { return structuredClone(DEFAULT_STATE); }
}

/* ---------- Diagram Rendering (SVG) ---------- */
function renderDiagram(){
  // Clear SVG
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 1200, H = 700;
  // Main spine from left (tail) to right (head)
  const margin = 80;
  const spineY = H/2;
  const spineStartX = margin, spineEndX = W - margin*1.5;

  // Draw spine
  addLine(spineStartX, spineY, spineEndX, spineY);

  // Draw "head" box (problem)
  const headW = 260, headH = 60;
  const headX = spineEndX - headW + 10, headY = spineY - headH/2;
  addRect(headX, headY, headW, headH);
  addText(headX + headW/2, headY + headH/2, state.problem, { anchor: "middle" });

  // Tail triangles (just a stylized fin)
  addPolyline([[spineStartX-30, spineY],[spineStartX, spineY-18],[spineStartX, spineY+18],[spineStartX-30, spineY]]);

  // Layout categories alternating top/bottom
  const n = state.categories.length;
  const usableSpine = spineEndX - spineStartX - headW - 40;
  const step = Math.max(140, usableSpine / Math.max(1, n)); // spacing per category

  let x = spineStartX + 100; // start some gap from tail
  state.categories.forEach((cat, i) => {
    const top = i % 2 === 0;
    const baseX = Math.min(x + i*step, spineEndX - headW - 60);
    const baseY = spineY;

    // Main bone length and angle
    const boneLen = 160;
    const dy = top ? -120 : 120;
    const tipX = baseX + boneLen, tipY = baseY + dy;

    // Draw main bone
    addLine(baseX, baseY, tipX, tipY);

    // Category label near the tip
    addText(tipX + 6, tipY + (top ? -8 : 16), cat.name, { anchor: "start" });

    // Causes "ticks" along the bone
    const m = Math.max(cat.causes.length, 1);
    const tickStep = boneLen / (m + 1);
    cat.causes.forEach((cause, j) => {
      const px = baseX + tickStep * (j+1);
      const py = baseY + dy * ((j+1)/(m+1)); // along the bone
      // Small line perpendicular-ish to bone (simple vertical shift)
      const tickLen = 40;
      const tdx = 0; const tdy = top ? -tickLen : tickLen;
      addLine(px, py, px + tdx, py + tdy);
      addText(px + 4, py + (top ? -tickLen - 4 : tickLen + 16), cause, { anchor: "start" });
    });
  });

  // Utility creators
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
    svg.appendChild(el);
  }
  function addText(x,y,text,{anchor="middle"}={}){
    const el = document.createElementNS("http://www.w3.org/2000/svg","text");
    el.setAttribute("x", x); el.setAttribute("y", y);
    el.setAttribute("text-anchor", anchor);
    el.textContent = text;
    svg.appendChild(el);
  }
}

/* ---------- Export PNG from SVG ---------- */
async function exportSvgToPng(){
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  // Draw into canvas, then export as PNG
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = svg.viewBox.baseVal.width || 1200;
    canvas.height = svg.viewBox.baseVal.height || 700;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0b1220"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fishbone.png";
      a.click();
      URL.revokeObjectURL(a.href);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => { alert("PNG export failed."); URL.revokeObjectURL(url); };
  img.src = url;
}
