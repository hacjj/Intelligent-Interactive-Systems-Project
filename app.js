/**
 * DriveHUD Frontend Controller — AR Traffic Windshield, Spectrum Analyzer,
 * Horvitz Expected-Loss HUD, Hybrid Speech Pipeline & 120-Trial Policy Benchmark
 * University of Birmingham — Intelligent Interactive Systems (3149895)
 */

const REPAIR_WINDOW_MS = 4000;

const SCENARIOS = {
  1: {
    intended: "Navigate to fourteen Oak Road",
    asrHeard: "Navigate to 40 Oak Road",
    altSlot: "14",
    rawConf: 0.65,
    weather: "Rain",
    speed: 65,
    noiseDb: 72,
    repairPhrase: "No, fourteen"
  },
  2: {
    intended: "Set cabin temperature to 19 degrees",
    asrHeard: "Set cabin temperature to 19 degrees",
    altSlot: "29",
    rawConf: 0.93,
    weather: "Clear",
    speed: 45,
    noiseDb: 54,
    repairPhrase: "No, 29"
  },
  3: {
    intended: "Call Dr. Patel",
    asrHeard: "Call Daughter Payal",
    altSlot: "Dr. Patel",
    rawConf: 0.34,
    weather: "Crosswind",
    speed: 75,
    noiseDb: 78,
    repairPhrase: "Actually Dr. Patel"
  },
  4: {
    intended: "Set speed limiter to 60 mph",
    asrHeard: "Set speed limiter to 16 mph",
    altSlot: "60",
    rawConf: 0.68,
    weather: "Motorway",
    speed: 70,
    noiseDb: 70,
    repairPhrase: "No, sixty"
  }
};

const WEATHER_PROFILES = {
  Rain: { speed: 65, noiseDb: 72 },
  Clear: { speed: 45, noiseDb: 54 },
  Crosswind: { speed: 75, noiseDb: 78 },
  Motorway: { speed: 70, noiseDb: 70 }
};

let currentScenarioId = 1;
let latestSnapshot = null;
let countdownRaf = null;
let countdownTimer = null;
let countdownStart = 0;
let liveMicUsed = false;
let activeMicSession = null;
let ttsSpeakingNow = false;
let liveSpectrumLevels = new Array(20).fill(4);

// Interactive Crosswind Lane-Keeping Workload State
let steeringTaskActive = false;
let carLateralOffset = 0; // -1.0 (left shoulder) to +1.0 (right shoulder)
let targetMouseSteer = 0;

let roadNoiseCtx = null;

function announceSR(message, assertive = false) {
  const el = document.getElementById(assertive ? "srAssertiveAnnouncer" : "srPoliteAnnouncer");
  if (el) {
    el.textContent = "";
    setTimeout(() => {
      el.textContent = message;
    }, 30);
  }
}

// Progress Ring CSS attr() fallback (progress-ring guide)
function setupProgressRingFallback() {
  const progress = document.getElementById("hudRepairProgress");
  if (!progress) return;
  if (!CSS.supports("width: attr(value type(<number>))")) {
    progress.style.setProperty("--value", progress.getAttribute("value") || "100");
    const observer = new MutationObserver(() => {
      progress.style.setProperty("--value", progress.getAttribute("value") || "0");
    });
    observer.observe(progress, { attributes: true, attributeFilter: ["value"] });
  }
}

// Native <dialog closedby="any"> Safari light-dismiss fallback & returnValue reset (dialog guide)
function setupDialogEnhancements() {
  const modal = document.getElementById("evalModal");
  if (!modal) return;

  modal.addEventListener("close", () => {
    modal.returnValue = "";
  });

  if (!("closedBy" in HTMLDialogElement.prototype)) {
    const outside = (e, dlg) => {
      const r = dlg.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    modal.addEventListener("pointerdown", (e) => {
      pressedOutside = outside(e, modal);
    });
    modal.addEventListener("pointerup", (e) => {
      if (pressedOutside && outside(e, modal)) modal.close();
    });
  }
}

function formatRepairExample(pendingObj) {
  if (!pendingObj) {
    return SCENARIOS[currentScenarioId] ? SCENARIOS[currentScenarioId].repairPhrase : "No, 14";
  }
  if (pendingObj.domain === "PHONE_CALL") {
    return `Actually ${pendingObj.alt_raw_value}`;
  }
  return `No, ${pendingObj.alt_raw_value}`;
}

// Automotive Spatial Earcons
function playEarcon(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "uncertain") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(587.33, now + 0.11);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === "blocked") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(392, now);
      osc.frequency.setValueAtTime(330, now + 0.09);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      osc.start(now);
      osc.stop(now + 0.21);
    } else if (type === "commit") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (type === "cancel") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(329.63, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === "baseline_commit") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch (e) {}
}

function toggleCabinSoundscape(enable) {
  if (!enable) {
    if (roadNoiseCtx) {
      roadNoiseCtx.close();
      roadNoiseCtx = null;
    }
    return;
  }
  if (roadNoiseCtx) return;
  try {
    roadNoiseCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = roadNoiseCtx.sampleRate * 2;
    const buffer = roadNoiseCtx.createBuffer(1, bufferSize, roadNoiseCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 2.5;
    }
    const noise = roadNoiseCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = roadNoiseCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;

    const gain = roadNoiseCtx.createGain();
    gain.gain.value = 0.06;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(roadNoiseCtx.destination);
    noise.start();
  } catch (e) {}
}

// Curated natural voice selection (explicitly blocks macOS MacInTalk novelty gag voices like "Albert")
const BANNED_NOVELTY_VOICES = new Set([
  "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos",
  "wobble", "fred", "good news", "jester", "junior", "kathy", "organ",
  "superstar", "ralph", "trinoids", "whisper", "zarvox", "eddy", "flo",
  "grandma", "grandpa", "reed", "rocko", "sandy", "shelley"
]);

const PREFERRED_VOICE_ORDER = [
  "daniel",
  "samantha",
  "google uk english female",
  "google uk english male",
  "google us english",
  "siri",
  "ava",
  "allison",
  "karen",
  "moira",
  "rishi"
];

let availableCleanVoices = [];

function refreshAvailableVoices() {
  if (!("speechSynthesis" in window)) return;
  const rawVoices = window.speechSynthesis.getVoices() || [];
  const englishVoices = rawVoices.filter((v) => {
    const lowName = v.name.toLowerCase();
    const isEn = /^en(-|_|$)/i.test(v.lang);
    const isBanned = Array.from(BANNED_NOVELTY_VOICES).some((b) => lowName.includes(b));
    return isEn && !isBanned;
  });

  englishVoices.sort((a, b) => {
    const aLow = a.name.toLowerCase();
    const bLow = b.name.toLowerCase();
    const aRank = PREFERRED_VOICE_ORDER.findIndex((p) => aLow.includes(p));
    const bRank = PREFERRED_VOICE_ORDER.findIndex((p) => bLow.includes(p));
    const aScore = (aRank === -1 ? 99 : aRank) - (aLow.includes("premium") || aLow.includes("enhanced") || aLow.includes("natural") ? 20 : 0);
    const bScore = (bRank === -1 ? 99 : bRank) - (bLow.includes("premium") || bLow.includes("enhanced") || bLow.includes("natural") ? 20 : 0);
    return aScore - bScore;
  });

  availableCleanVoices = englishVoices;
  const sel = document.getElementById("selectVoice");
  if (sel && englishVoices.length > 0) {
    const prev = sel.value;
    sel.innerHTML = "";
    for (const v of englishVoices.slice(0, 8)) {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      sel.appendChild(opt);
    }
    if (Array.from(sel.options).some((o) => o.value === prev)) {
      sel.value = prev;
    } else {
      sel.value = englishVoices[0].name;
    }
  }
}

function normalizeTextForNaturalSpeech(rawText) {
  return String(rawText)
    .replace(/\.\.\.\?/g, "?")
    .replace(/\.\.\./g, ", ")
    .replace(/(\d+(?:\.\d+)?)\s*°C/gi, "$1 degrees")
    .replace(/(\d+)\s*MPH\b/gi, "$1 miles per hour")
    .replace(/\bDr\.\s*/gi, "Doctor ")
    .replace(/\bPayal\b/gi, "Pie-al")
    .replace(/\bRd\b/gi, "Road")
    .replace(/\bSt\b/gi, "Street");
}

let speechSeqToken = 0;
let pendingSpeechDelayTimer = null;
let pendingSpeechSafetyTimer = null;

function speakProsodic(text, isQuestion = false, onDone = null) {
  if (!("speechSynthesis" in window)) {
    if (onDone) setTimeout(onDone, 150);
    return;
  }
  try {
    if (availableCleanVoices.length === 0) refreshAvailableVoices();

    const myToken = ++speechSeqToken;
    if (pendingSpeechDelayTimer) clearTimeout(pendingSpeechDelayTimer);
    if (pendingSpeechSafetyTimer) clearTimeout(pendingSpeechSafetyTimer);
    ttsSpeakingNow = false;

    // Only call cancel() if speechSynthesis is actively speaking or pending (avoids macOS Chromium state lockup)
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }

    const cleanSpeechText = normalizeTextForNaturalSpeech(text);
    const utter = new SpeechSynthesisUtterance(cleanSpeechText);
    // Pin to window to prevent Chromium V8 from garbage-collecting longer utterances mid-sentence
    window._activeDriveHudUtterance = utter;

    const sel = document.getElementById("selectVoice");
    const chosenVoice =
      availableCleanVoices.find((v) => sel && v.name === sel.value) || availableCleanVoices[0];
    if (chosenVoice) {
      utter.voice = chosenVoice;
      utter.lang = chosenVoice.lang;
    } else {
      utter.lang = "en-GB";
    }

    utter.pitch = isQuestion ? 1.02 : 1.0;
    utter.rate = isQuestion ? 0.97 : 1.0;

    let done = false;
    const finish = () => {
      if (done || myToken !== speechSeqToken) return;
      done = true;
      ttsSpeakingNow = false;
      if (pendingSpeechSafetyTimer) clearTimeout(pendingSpeechSafetyTimer);
      if (onDone) onDone();
    };

    utter.onend = finish;
    utter.onerror = (ev) => {
      if (ev && (ev.error === "canceled" || ev.error === "interrupted")) return;
      finish();
    };

    const maxDurationMs = Math.max(5500, cleanSpeechText.length * 120);
    pendingSpeechSafetyTimer = setTimeout(finish, maxDurationMs);

    // 260ms delay lets every earcon finish completely before human voice speaks
    pendingSpeechDelayTimer = setTimeout(() => {
      if (myToken !== speechSeqToken || done) return;
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      ttsSpeakingNow = true;
      window.speechSynthesis.speak(utter);
    }, 260);
  } catch (e) {
    ttsSpeakingNow = false;
    if (onDone) onDone();
  }
}

async function apiPost(path, body = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

function stopCountdown() {
  if (countdownRaf) {
    cancelAnimationFrame(countdownRaf);
    countdownRaf = null;
  }
  if (countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
  }
}

function startHudRepairCountdown() {
  stopCountdown();
  const ringWrap = document.getElementById("ringWrapper");
  const progress = document.getElementById("hudRepairProgress");
  const textEl = document.getElementById("ringSecondsText");
  ringWrap.hidden = false;
  countdownStart = performance.now();

  function tick(now) {
    if (!latestSnapshot || latestSnapshot.state !== "REPAIR_WINDOW") return;
    const elapsed = now - countdownStart;
    const remainingMs = Math.max(0, REPAIR_WINDOW_MS - elapsed);
    const pct = Math.round((remainingMs / REPAIR_WINDOW_MS) * 100);
    const secStr = (remainingMs / 1000).toFixed(1);

    progress.setAttribute("value", String(pct));
    progress.setAttribute("aria-valuetext", `${secStr} seconds remaining`);
    textEl.textContent = `${secStr}s`;

    if (remainingMs > 0) {
      countdownRaf = requestAnimationFrame(tick);
    }
  }
  progress.setAttribute("value", "100");
  countdownRaf = requestAnimationFrame(tick);

  countdownTimer = setTimeout(async () => {
    if (latestSnapshot && latestSnapshot.state === "REPAIR_WINDOW") {
      const snap = await apiPost("/api/timeout");
      applySnapshot(snap);
      if (snap.earcon) playEarcon(snap.earcon);
      if (snap.tts) speakProsodic(snap.tts, false);
    }
  }, REPAIR_WINDOW_MS);

  if (liveMicUsed) {
    startLiveSpeechCapture("repair", true);
  }
}

function renderDecisionMatrix(dm) {
  const cDirect = document.getElementById("chipLossDirect");
  const cGate = document.getElementById("chipLossGate");
  const cHold = document.getElementById("chipLossHold");
  if (!dm || !dm.expected_losses) {
    cDirect.textContent = "EL(Direct): --";
    cGate.textContent = "EL(4s Gate): --";
    cHold.textContent = "EL(Hold): --";
    cDirect.className = "loss-chip";
    cGate.className = "loss-chip";
    cHold.className = "loss-chip";
    return;
  }
  const el = dm.expected_losses;
  const sel = dm.selected_policy;
  cDirect.textContent = `EL(Direct): ${el.DIRECT_COMMIT.toFixed(2)}${sel === "DIRECT_COMMIT" ? " ★" : ""}`;
  cGate.textContent = `EL(4s Gate): ${el.PROSODIC_4S_GATE.toFixed(2)}${sel === "PROSODIC_4S_GATE" ? " ★" : ""}`;
  cHold.textContent = `EL(Hold): ${el.EXPLICIT_HOLD.toFixed(2)}${sel === "EXPLICIT_HOLD" ? " ★" : ""}`;

  cDirect.className = `loss-chip${sel === "DIRECT_COMMIT" ? " loss-optimal" : ""}`;
  cGate.className = `loss-chip${sel === "PROSODIC_4S_GATE" ? " loss-optimal" : ""}`;
  cHold.className = `loss-chip${sel === "EXPLICIT_HOLD" ? " loss-optimal" : ""}`;
}

function applySnapshot(snap) {
  latestSnapshot = snap;
  const v = snap.vehicle;

  document.getElementById("chipSpeedWeather").textContent =
    `${v.speed_mph} MPH • ${v.weather} (${v.cabin_noise_db} dB Cabin)`;
  document.getElementById("chipWorkload").textContent =
    `COGNITIVE LOAD: ${v.cognitive_load_pct}% • FOLLOW 2.1s`;

  document.getElementById("valNavDest").textContent = v.nav_destination;
  document.getElementById("subNavEta").textContent = `ETA: ${v.nav_eta_min} min • Active`;
  document.getElementById("valClimate").textContent = `${v.cabin_temp_c.toFixed(1)}°C`;
  document.getElementById("valPhone").textContent = v.active_call;
  document.getElementById("valLimiter").textContent = `${v.speed_limiter_mph} MPH`;
  document.getElementById("valSafetySaved").textContent = `${v.silent_errors_prevented} Errors Caught`;
  document.getElementById("subSafetyChatter").textContent =
    `${v.passenger_chatter_filtered} Chatter • ${v.eyes_off_road_warnings} Glances`;

  renderDecisionMatrix(snap.last_decision);

  const overlay = document.getElementById("projectedHudOverlay");
  const eyebrow = document.getElementById("hudEyebrow");
  const headline = document.getElementById("hudHeadline");
  const instruction = document.getElementById("hudInstruction");
  const candidatesRow = document.getElementById("hudCandidatesRow");
  const ringWrap = document.getElementById("ringWrapper");
  const distractionBanner = document.getElementById("distractionBanner");
  const chipMic = document.getElementById("chipMicState");

  distractionBanner.hidden = true;

  if (snap.state === "CRUISING_IDLE") {
    overlay.dataset.hudMode = "idle";
    const intended = document.getElementById("inputIntended").value;
    eyebrow.textContent = `PROJECTED AR-HUD • SCENARIO ${currentScenarioId} ACTIVE`;
    headline.textContent = `Ready: "${intended}"`;
    instruction.textContent =
      "Press Push-to-Talk (or Spacebar) to issue command while keeping eyes on traffic ahead.";
    candidatesRow.hidden = true;
    ringWrap.hidden = true;
    chipMic.textContent = "STEERING MIC: STANDBY";
  } else if (snap.state === "REPAIR_WINDOW" && snap.pending) {
    const p = snap.pending;
    const exampleRepair = formatRepairExample(p);
    overlay.dataset.hudMode = "repair";
    eyebrow.textContent =
      `PROSODIC 4.0s GATE • ${p.domain_label.toUpperCase()} (P=${p.raw_confidence.toFixed(2)}, L_err=${p.decision_matrix.domain_error_loss})`;
    headline.textContent = `"${p.prosodic_prompt}"`;
    instruction.textContent =
      `Mic open (no wake word): Say "${exampleRepair}", press [→] thumb switch, or wait 4.0s to accept.`;
    document.getElementById("txtHudHeard").textContent = `Heard: ${p.slot_display}`;
    document.getElementById("hintHudHeard").textContent = `[← Confirm / "Yes"]`;
    document.getElementById("txtHudAlt").textContent = `Patch: ${p.alt_display}`;
    document.getElementById("hintHudAlt").textContent = `[→ Thumb / "${exampleRepair}"]`;
    document.getElementById("chipSaySlotRepair").textContent = `🗣️ Say: "${exampleRepair}"`;
    document.getElementById("inputRepairUtterance").value = exampleRepair;
    candidatesRow.hidden = false;
    ringWrap.hidden = false;
    chipMic.textContent = "🔴 MIC OPEN (4.0s NO WAKE WORD)";
    announceSR(`Uncertain slot: ${p.prosodic_prompt} Say ${exampleRepair} to repair.`, false);
  } else if (snap.state === "CLARIFYING" && snap.pending) {
    const p = snap.pending;
    const exampleRepair = formatRepairExample(p);
    overlay.dataset.hudMode = "clarify";
    eyebrow.textContent =
      `EXPLICIT HOLD • ${p.domain_label.toUpperCase()} (P=${p.raw_confidence.toFixed(2)}, L_err=${p.decision_matrix.domain_error_loss})`;
    headline.textContent = `Disambiguate: "${p.slot_display}" or "${p.alt_display}"?`;
    instruction.textContent =
      `High expected error loss — auto-commit blocked. Say "${exampleRepair}" or press [←] / [→] thumb switch.`;
    document.getElementById("txtHudHeard").textContent = `Confirm: ${p.slot_display}`;
    document.getElementById("hintHudHeard").textContent = `[← Confirm / "Yes"]`;
    document.getElementById("txtHudAlt").textContent = `Select: ${p.alt_display}`;
    document.getElementById("hintHudAlt").textContent = `[→ Thumb / "${exampleRepair}"]`;
    document.getElementById("chipSaySlotRepair").textContent = `🗣️ Say: "${exampleRepair}"`;
    document.getElementById("inputRepairUtterance").value = exampleRepair;
    candidatesRow.hidden = false;
    ringWrap.hidden = true;
    chipMic.textContent = "🔴 MIC OPEN (AWAITING CHOICE)";
    announceSR(`Execution held. Choose ${p.slot_display} or ${p.alt_display}.`, true);
  } else if (snap.state === "COMMITTED" && snap.last_commit) {
    const c = snap.last_commit;
    const isBaselineErr = c.commit_mode === "BASELINE_SILENT_COMMIT";
    overlay.dataset.hudMode = isBaselineErr ? "clarify" : "committed";
    eyebrow.textContent = `COMMITTED • ${c.commit_mode.replaceAll("_", " ")}`;
    headline.textContent = `${c.domain_label}: ${c.committed_slot}`;
    instruction.textContent = c.repaired
      ? "Patched pre-execution via single phrase without wake-word restart or downward console glance."
      : c.spoken_feedback;
    candidatesRow.hidden = true;
    ringWrap.hidden = true;
    chipMic.textContent = "STEERING MIC: CLOSED";
    if (isBaselineErr) distractionBanner.hidden = false;
    announceSR(`${c.domain_label} committed to ${c.committed_slot}.`, false);
  }

  const traceList = document.getElementById("traceList");
  traceList.innerHTML = "";
  for (const entry of snap.trace_log) {
    const li = document.createElement("li");
    li.className = "trace-item";
    const cls =
      entry.level === "ok"
        ? "trace-ok"
        : entry.level === "warn"
        ? "trace-warn"
        : entry.level === "err"
        ? "trace-err"
        : "trace-info";
    li.innerHTML = `<span class="trace-time">[${entry.time}]</span> <strong>[${entry.tag}]</strong> <span class="${cls}">${entry.message}</span>`;
    traceList.appendChild(li);
  }
}

async function triggerDriverCommand(fromLiveMic = false) {
  stopCountdown();
  stopActiveMicSession();
  liveMicUsed = fromLiveMic;

  const intended = document.getElementById("inputIntended").value;
  const asrHeard = document.getElementById("inputAsrHeard").value;
  const altSlot = document.getElementById("inputAltSlot").value;
  const rawConf = parseFloat(document.getElementById("sliderConfidence").value);
  const baseline = document.getElementById("chkBaselineOem").checked;

  await apiPost("/api/environment", { baseline_oem_mode: baseline });
  const snap = await apiPost("/api/command", {
    intended_utterance: intended,
    asr_transcript: asrHeard,
    raw_confidence: rawConf,
    explicit_alt: altSlot
  });

  applySnapshot(snap);
  if (snap.earcon) playEarcon(snap.earcon);

  if (snap.state === "REPAIR_WINDOW") {
    document.getElementById("hudRepairProgress").setAttribute("value", "100");
    speakProsodic(snap.tts, true, () => {
      if (latestSnapshot && latestSnapshot.state === "REPAIR_WINDOW") {
        startHudRepairCountdown();
      }
    });
  } else if (snap.state === "CLARIFYING") {
    speakProsodic(snap.tts, true, () => {
      if (latestSnapshot && latestSnapshot.state === "CLARIFYING" && liveMicUsed) {
        startLiveSpeechCapture("repair", true);
      }
    });
  } else if (snap.tts) {
    speakProsodic(snap.tts, false);
  }
}

async function triggerRepairUtterance(utteranceText) {
  const snap = await apiPost("/api/repair", { utterance: utteranceText });
  if (snap.repair_outcome && snap.repair_outcome !== "IGNORED_PASSENGER_CHATTER") {
    stopCountdown();
    stopActiveMicSession();
  }
  applySnapshot(snap);
  if (snap.earcon) playEarcon(snap.earcon);
  if (snap.tts) speakProsodic(snap.tts, Boolean(snap.prosodic_question));
}

async function selectScenario(id) {
  stopCountdown();
  stopActiveMicSession();
  currentScenarioId = id;
  const s = SCENARIOS[id];

  for (const num of [1, 2, 3, 4]) {
    const btn = document.getElementById(`btnScenario${num}`);
    const tag = document.getElementById(`tagScenario${num}`);
    const isSelected = num === id;
    if (btn) btn.setAttribute("aria-pressed", String(isSelected));
    if (tag) tag.textContent = isSelected ? "✓ Active" : "Select";
  }

  const harness = document.getElementById("commandHarnessCard");
  if (harness) {
    harness.classList.remove("panel-flash");
    void harness.offsetWidth;
    harness.classList.add("panel-flash");
  }

  document.getElementById("inputIntended").value = s.intended;
  document.getElementById("inputAsrHeard").value = s.asrHeard;
  document.getElementById("inputAltSlot").value = s.altSlot;
  document.getElementById("sliderConfidence").value = s.rawConf.toFixed(2);
  document.getElementById("lblConfidenceVal").textContent = s.rawConf.toFixed(2);
  document.getElementById("selectWeather").value = s.weather;
  document.getElementById("inputRepairUtterance").value = s.repairPhrase;
  document.getElementById("chipSaySlotRepair").textContent = `🗣️ Say: "${s.repairPhrase}"`;
  document.getElementById("hudRepairProgress").setAttribute("value", "100");
  document.getElementById("ringSecondsText").textContent = "4.0s";

  const keepBaseline = document.getElementById("chkBaselineOem").checked;
  const snap = await apiPost("/api/environment", {
    speed_mph: s.speed,
    cabin_noise_db: s.noiseDb,
    weather: s.weather,
    baseline_oem_mode: keepBaseline
  });
  snap.state = "CRUISING_IDLE";
  snap.last_decision = null;
  applySnapshot(snap);
}

// ================= BENCHMARK MODAL =================
async function loadAndShowBenchmark(seed = 42) {
  const data = await apiPost("/api/benchmark", { seed, n_trials: 120 });
  document.getElementById("lblBenchSeed").textContent =
    `Seed: ${data.seed} • N = ${data.n_trials} noisy cabin utterances`;

  const tbody = document.getElementById("benchTableBody");
  tbody.innerHTML = "";
  for (const row of data.policies) {
    const tr = document.createElement("tr");
    if (row.id === "drivehud") tr.className = "row-highlight";
    tr.innerHTML = `
      <th scope="row">${row.policy_name}</th>
      <td>${row.silent_error_rate_pct.toFixed(1)}%</td>
      <td>${row.confirmation_fatigue_pct.toFixed(1)}%</td>
      <td>${row.mean_turns_per_task.toFixed(2)} turns</td>
      <td>${row.console_glances} glances</td>
    `;
    tbody.appendChild(tr);
  }

  const [oem, binary, dhud] = data.policies;
  const noteEl = document.getElementById("benchSummaryNote");
  if (noteEl && oem && binary && dhud) {
    noteEl.innerHTML =
      `<strong>Key Empirical Finding (Seed ${data.seed}, N = ${data.n_trials}):</strong> ` +
      `DriveHUD lowers silent execution errors from <strong>${oem.silent_error_rate_pct.toFixed(1)}%</strong> ` +
      `(Commercial Baseline OEM) down to <strong>${dhud.silent_error_rate_pct.toFixed(1)}%</strong> ` +
      `(${dhud.console_glances} vs. ${oem.console_glances} console glances) while cutting unnecessary confirmation ` +
      `fatigue from <strong>${binary.confirmation_fatigue_pct.toFixed(1)}%</strong> down to ` +
      `<strong>${dhud.confirmation_fatigue_pct.toFixed(1)}%</strong> and achieving <strong>${dhud.mean_turns_per_task.toFixed(2)} turns/task</strong>.`;
  }

  const modal = document.getElementById("evalModal");
  if (!modal.open) modal.showModal();
}

// ================= HYBRID LIVE MICROPHONE + SPECTRUM POD =================
function setMicStatus(title, sub) {
  document.getElementById("micStatusTitle").textContent = title;
  document.getElementById("micStatusSub").textContent = sub;
}

function stopActiveMicSession() {
  if (!activeMicSession) return;
  try {
    if (activeMicSession.rec) {
      activeMicSession.rec.onresult = null;
      activeMicSession.rec.onerror = null;
      activeMicSession.rec.onend = null;
      activeMicSession.rec.stop();
    }
    if (activeMicSession.raf) cancelAnimationFrame(activeMicSession.raf);
    if (activeMicSession.stream) activeMicSession.stream.getTracks().forEach((t) => t.stop());
    if (activeMicSession.audioCtx) activeMicSession.audioCtx.close();
  } catch (e) {}
  activeMicSession = null;
  liveSpectrumLevels.fill(4);

  document.getElementById("btnLiveCommandMic").setAttribute("aria-pressed", "false");
  document.getElementById("btnLiveCommandMic").textContent = "🎙️ Live Mic";
  document.getElementById("btnLiveRepairMic").setAttribute("aria-pressed", "false");
  document.getElementById("btnLiveRepairMic").textContent = "🎙️ Live Repair Mic";
}

async function startLiveSpeechCapture(mode, autoOpened = false) {
  if (activeMicSession && !autoOpened) {
    stopActiveMicSession();
    setMicStatus("Steering-Wheel Mic: Standby", "Stopped by driver.");
    return;
  }
  stopActiveMicSession();
  window.speechSynthesis && window.speechSynthesis.cancel();

  if (mode === "repair" && (!latestSnapshot || !["REPAIR_WINDOW", "CLARIFYING"].includes(latestSnapshot.state))) {
    triggerDriverCommand(true);
    return;
  }

  const btn = document.getElementById(mode === "command" ? "btnLiveCommandMic" : "btnLiveRepairMic");
  btn.setAttribute("aria-pressed", "true");
  btn.textContent = "🔴 Listening...";

  const session = {
    mode,
    done: false,
    webSpeechFailed: false,
    lastInterim: ""
  };
  activeMicSession = session;

  function commitCapturedTranscript(cleanText, sourceLabel) {
    if (session.done || activeMicSession !== session) return;
    session.done = true;
    stopActiveMicSession();
    setMicStatus(`Cabin Mic (${sourceLabel})`, `Heard: "${cleanText}"`);

    if (mode === "command") {
      document.getElementById("inputIntended").value = cleanText;
      const rawConf = parseFloat(document.getElementById("sliderConfidence").value);
      let simulatedAsr = cleanText;
      if (rawConf < 0.80) {
        simulatedAsr = cleanText
          .replace(/\b(14|fourteen)\b/i, "40")
          .replace(/\b(15|fifteen)\b/i, "50")
          .replace(/\b(60|sixty)\b/i, "16")
          .replace(/dr\.?\s*patel/i, "Daughter Payal");
      }
      document.getElementById("inputAsrHeard").value = simulatedAsr;
      triggerDriverCommand(true);
    } else {
      document.getElementById("inputRepairUtterance").value = cleanText;
      triggerRepairUtterance(cleanText);
    }
  }

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec) {
    try {
      const rec = new SpeechRec();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      session.rec = rec;

      rec.onresult = (ev) => {
        let interim = "";
        let finalTxt = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalTxt += t;
          else interim += t;
        }
        if (interim) {
          session.lastInterim = interim.trim();
          setMicStatus("🔴 Cabin Mic Transcribing...", `Hearing: "${session.lastInterim}"`);
          if (latestSnapshot && latestSnapshot.state === "REPAIR_WINDOW") {
            countdownStart = Math.max(countdownStart, performance.now() - (REPAIR_WINDOW_MS - 1600));
          }
        }
        if (finalTxt) commitCapturedTranscript(finalTxt.trim(), "Web Speech ASR");
      };

      rec.onerror = () => {
        session.webSpeechFailed = true;
      };

      rec.onend = () => {
        if (!session.done && session.lastInterim) {
          commitCapturedTranscript(session.lastInterim, "Web Speech ASR");
        }
      };

      rec.start();
    } catch (e) {
      session.webSpeechFailed = true;
    }
  } else {
    session.webSpeechFailed = true;
  }

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activeMicSession !== session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      session.stream = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      session.audioCtx = audioCtx;
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);

      let activeFrames = 0;
      let silenceFrames = 0;
      let firstVoiceMs = 0;
      let lastVoiceMs = 0;
      let syllablePeaks = 0;
      let inPeak = false;
      let lastPeakMs = 0;
      const frameFeatures = [];

      const dynamicEx =
        latestSnapshot && latestSnapshot.pending
          ? formatRepairExample(latestSnapshot.pending)
          : `No, ${document.getElementById("inputAltSlot").value}`;
      setMicStatus(
        mode === "command"
          ? "🔴 Steering Mic Live — Speak Command Now"
          : `🔴 Open Mic Live — Say "Yes", "${dynamicEx}", or "Cancel"`,
        "Streaming 20-band cabin spectrum..."
      );

      function pollAudio() {
        if (activeMicSession !== session || session.done) return;
        analyser.getByteFrequencyData(bins);

        // Update 20-band spectrum visualizer
        for (let b = 0; b < 20; b++) {
          liveSpectrumLevels[b] = Math.max(3, Math.round((bins[b * 6 + 3] / 255) * 28));
        }

        let lowSum = 0;
        for (let i = 3; i <= 26; i++) lowSum += bins[i];
        const lowAvg = lowSum / 24;

        let highSum = 0;
        for (let i = 75; i <= 185; i++) highSum += bins[i];
        const highAvg = highSum / 111;

        const overall = lowAvg * 0.7 + highAvg * 0.3;
        const nowMs = performance.now();

        if (overall > 16 || highAvg > 20) {
          if (activeFrames === 0) firstVoiceMs = nowMs;
          lastVoiceMs = nowMs;
          activeFrames++;
          silenceFrames = 0;
          frameFeatures.push({ lowE: lowAvg, highE: highAvg });

          if (!inPeak && lowAvg > 28 && nowMs - lastPeakMs > 130) {
            syllablePeaks++;
            inPeak = true;
            lastPeakMs = nowMs;
          } else if (lowAvg < 16) {
            inPeak = false;
          }

          if (latestSnapshot && latestSnapshot.state === "REPAIR_WINDOW") {
            countdownStart = Math.max(countdownStart, nowMs - (REPAIR_WINDOW_MS - 1600));
          }
        } else {
          inPeak = false;
          if (activeFrames > 8) silenceFrames++;
        }

        if (session.webSpeechFailed && activeFrames > 8 && silenceFrames > 34) {
          const durationMs = Math.max(120, lastVoiceMs - firstVoiceMs);
          if (mode === "command") {
            commitCapturedTranscript(document.getElementById("inputIntended").value, "Cabin Acoustic VAD");
            return;
          }
          const halfIdx = Math.floor(frameFeatures.length / 2);
          const tailFrames = frameFeatures.slice(halfIdx);
          let tailLow = 1;
          let tailHigh = 0;
          for (const f of tailFrames) {
            tailLow += f.lowE;
            tailHigh += f.highE;
          }
          const tailSibilanceRatio = tailHigh / tailLow;
          const dynamicRepairPhrase =
            latestSnapshot && latestSnapshot.pending
              ? formatRepairExample(latestSnapshot.pending)
              : `No, ${document.getElementById("inputAltSlot").value}`;

          const inferred =
            durationMs < 760 && syllablePeaks <= 2 && tailSibilanceRatio >= 0.28
              ? "Yes"
              : dynamicRepairPhrase;
          commitCapturedTranscript(inferred, "Acoustic Phonetic Classifier");
          return;
        }
        session.raf = requestAnimationFrame(pollAudio);
      }
      session.raf = requestAnimationFrame(pollAudio);
      return;
    } catch (e) {
      if (session.webSpeechFailed) {
        stopActiveMicSession();
        setMicStatus(
          "Hardware Mic Blocked in IDE Preview",
          "Use voice chips / [←][→] keys, or open http://localhost:8000 in Chrome/Safari for hardware mic."
        );
      }
    }
  }
}

// ================= SPECTRUM & AR HIGHWAY WINDSHIELD RENDERERS =================
function initCanvases() {
  const wsCanvas = document.getElementById("windshieldCanvas");
  const spCanvas = document.getElementById("voiceSpectrumCanvas");
  if (!wsCanvas || !spCanvas) return;

  const ctx = wsCanvas.getContext("2d");
  const spCtx = spCanvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let dashOffset = 0;
  let leadCarBob = 0;
  const raindrops = Array.from({ length: 65 }, () => ({
    x: Math.random() * 960,
    y: Math.random() * 540,
    len: 12 + Math.random() * 16,
    speed: 10 + Math.random() * 7
  }));

  wsCanvas.addEventListener("pointermove", (e) => {
    if (!steeringTaskActive) return;
    const r = wsCanvas.getBoundingClientRect();
    const normX = ((e.clientX - r.left) / r.width) * 2 - 1;
    targetMouseSteer = Math.max(-0.85, Math.min(0.85, normX));
  });

  function renderFrame(now) {
    // 1. Render 20-Band Voice / Prosodic TTS Spectrum Pod
    spCtx.clearRect(0, 0, spCanvas.width, spCanvas.height);
    for (let i = 0; i < 20; i++) {
      let barH = liveSpectrumLevels[i];
      if (ttsSpeakingNow && !activeMicSession) {
        barH = 6 + Math.round(Math.abs(Math.sin(now * 0.012 + i * 0.6)) * 20);
      }
      spCtx.fillStyle = ttsSpeakingNow ? "#fbbf24" : activeMicSession ? "#22d3ee" : "#334155";
      spCtx.fillRect(4 + i * 6.2, 29 - barH, 4, barH);
    }

    // 2. Render Unobstructed Panoramic Forward Windshield Scene (980x420)
    const w = wsCanvas.width;
    const h = wsCanvas.height;
    const horizonY = h * 0.38;
    const v = latestSnapshot ? latestSnapshot.vehicle : { speed_mph: 65, weather: "Rain" };

    if (steeringTaskActive && !reducedMotion) {
      const gust = Math.sin(now * 0.0017) * 0.006 * (v.weather === "Crosswind" ? 2.2 : 1.0);
      carLateralOffset = Math.max(-0.9, Math.min(0.9, carLateralOffset * 0.94 + targetMouseSteer * 0.06 + gust));
    } else {
      carLateralOffset *= 0.9;
    }
    const shiftPx = -carLateralOffset * 95;

    // Dusk sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, v.weather === "Clear" ? "#0b1d3a" : "#050b16");
    sky.addColorStop(1, v.weather === "Clear" ? "#1d3b66" : "#11223d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizonY);

    // Distant horizon city/hills silhouette
    ctx.fillStyle = "#081223";
    for (let b = 0; b < 19; b++) {
      const bx = b * 54 + 8;
      const bh = 10 + ((b * 19) % 24);
      ctx.fillRect(bx, horizonY - bh, 40, bh);
    }

    // Asphalt highway surface
    const roadGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    roadGrad.addColorStop(0, "#09111f");
    roadGrad.addColorStop(1, "#132038");
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    const vanishX = w * 0.5 + shiftPx * 0.25;

    // Outer 3-lane highway boundaries + inner lane dividers
    ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(vanishX - 88, horizonY);
    ctx.lineTo(w * 0.04 + shiftPx, h);
    ctx.moveTo(vanishX + 88, horizonY);
    ctx.lineTo(w * 0.96 + shiftPx, h);
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([22, 26]);
    ctx.lineDashOffset = -dashOffset;
    ctx.beginPath();
    ctx.moveTo(vanishX - 30, horizonY);
    ctx.lineTo(w * 0.33 + shiftPx, h);
    ctx.moveTo(vanishX + 30, horizonY);
    ctx.lineTo(w * 0.67 + shiftPx, h);
    ctx.stroke();
    ctx.restore();

    // Projected AR Navigation Carpet in Center Ego Lane (Fully visible all the way to hood!)
    const state = latestSnapshot ? latestSnapshot.state : "CRUISING_IDLE";
    ctx.fillStyle =
      state === "REPAIR_WINDOW"
        ? "rgba(251, 191, 36, 0.22)"
        : state === "CLARIFYING"
        ? "rgba(248, 113, 113, 0.24)"
        : "rgba(34, 211, 238, 0.18)";
    ctx.beginPath();
    ctx.moveTo(vanishX - 20, horizonY + 42);
    ctx.lineTo(vanishX + 20, horizonY + 42);
    ctx.lineTo(w * 0.62 + shiftPx, h);
    ctx.lineTo(w * 0.38 + shiftPx, h);
    ctx.closePath();
    ctx.fill();

    // AR Chevrons along ego lane carpet
    ctx.strokeStyle =
      state === "REPAIR_WINDOW"
        ? "rgba(251, 191, 36, 0.55)"
        : state === "CLARIFYING"
        ? "rgba(248, 113, 113, 0.6)"
        : "rgba(34, 211, 238, 0.45)";
    ctx.lineWidth = 2;
    for (const cyRatio of [0.62, 0.78, 0.92]) {
      const cy = horizonY + (h - horizonY) * cyRatio;
      const spread = 24 + cyRatio * 48;
      const cx = vanishX + (shiftPx * 0.75 * cyRatio);
      ctx.beginPath();
      ctx.moveTo(cx - spread, cy + 10);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + spread, cy + 10);
      ctx.stroke();
    }

    // Lead Traffic Vehicle + ADAS Radar Bounding Reticle Ahead (Centered in clear view)
    const leadX = vanishX + Math.sin(leadCarBob) * 4;
    const leadY = horizonY + 78;
    // Contact shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(leadX - 42, leadY + 48, 84, 8);
    // Vehicle body & cabin roof
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(leadX - 40, leadY + 14, 80, 36, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(leadX - 28, leadY, 56, 20, 5);
    ctx.fill();
    ctx.stroke();
    // LED Tail lights
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(leadX - 35, leadY + 24, 16, 7);
    ctx.fillRect(leadX + 19, leadY + 24, 16, 7);
    // ADAS Green Radar Target Lock + Distance Label
    ctx.strokeStyle = "rgba(52, 211, 153, 0.9)";
    ctx.lineWidth = 1.8;
    ctx.strokeRect(leadX - 48, leadY - 8, 96, 64);
    ctx.fillStyle = "rgba(5, 16, 28, 0.8)";
    ctx.fillRect(leadX - 48, leadY - 25, 96, 16);
    ctx.fillStyle = "#6ee7b7";
    ctx.font = "700 10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RADAR 42m • 2.1s", leadX, leadY - 13);
    ctx.textAlign = "start";

    // Ego-Vehicle Hood Silhouette at very bottom edge for spatial grounding
    ctx.fillStyle = "#060d1a";
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h);
    ctx.quadraticCurveTo(w * 0.5, h - 18, w * 0.78, h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Steering Workload Indicator in upper sky band
    if (steeringTaskActive) {
      const driftWarn = Math.abs(carLateralOffset) > 0.48;
      ctx.fillStyle = driftWarn ? "rgba(239, 68, 68, 0.95)" : "rgba(52, 211, 153, 0.9)";
      ctx.font = "700 12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        driftWarn ? "⚠️ LANE DRIFT — STEER BACK TO CENTER" : "✓ LANE KEEPING ACTIVE (MOVE MOUSE ON ROAD)",
        w * 0.5,
        horizonY - 32
      );
      ctx.textAlign = "start";
    }

    // Rain / Crosswind Particles
    if (v.weather === "Rain" || v.weather === "Crosswind") {
      ctx.strokeStyle =
        v.weather === "Rain" ? "rgba(186, 230, 253, 0.34)" : "rgba(226, 232, 240, 0.22)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      const windTilt = v.weather === "Crosswind" ? 15 : 3;
      for (const d of raindrops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + windTilt, d.y + (v.weather === "Crosswind" ? 3 : d.len));
        if (!reducedMotion) {
          d.y += d.speed;
          d.x += windTilt * 0.4;
          if (d.y > h) {
            d.y = -15;
            d.x = Math.random() * w;
          }
          if (d.x > w) d.x = 0;
        }
      }
      ctx.stroke();
    }

    if (!reducedMotion) {
      dashOffset = (dashOffset + v.speed_mph * 0.085) % 48;
      leadCarBob += 0.025;
      requestAnimationFrame(renderFrame);
    }
  }

  requestAnimationFrame(renderFrame);
}

// ================= INITIALIZATION =================
window.addEventListener("DOMContentLoaded", async () => {
  setupProgressRingFallback();
  setupDialogEnhancements();
  refreshAvailableVoices();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener("voiceschanged", refreshAvailableVoices);
  }
  initCanvases();

  for (const id of [1, 2, 3, 4]) {
    document.getElementById(`btnScenario${id}`).addEventListener("click", () => selectScenario(id));
  }

  const slider = document.getElementById("sliderConfidence");
  slider.addEventListener("input", () => {
    document.getElementById("lblConfidenceVal").textContent = parseFloat(slider.value).toFixed(2);
  });

  document.getElementById("selectWeather").addEventListener("change", async (ev) => {
    const w = ev.target.value;
    const p = WEATHER_PROFILES[w] || WEATHER_PROFILES.Rain;
    const snap = await apiPost("/api/environment", {
      weather: w,
      speed_mph: p.speed,
      cabin_noise_db: p.noiseDb
    });
    applySnapshot(snap);
  });

  document.getElementById("chkSteeringTask").addEventListener("change", (ev) => {
    steeringTaskActive = ev.target.checked;
  });

  document.getElementById("chkRoadAudio").addEventListener("change", (ev) => {
    toggleCabinSoundscape(ev.target.checked);
  });

  document.getElementById("btnOpenBenchmark").addEventListener("click", () => loadAndShowBenchmark(42));
  document.getElementById("btnRerunBenchmark").addEventListener("click", () => {
    const newSeed = Math.floor(100 + Math.random() * 900);
    loadAndShowBenchmark(newSeed);
  });

  document.getElementById("btnIssueCommand").addEventListener("click", () => triggerDriverCommand(false));
  document.getElementById("btnLiveCommandMic").addEventListener("click", () => startLiveSpeechCapture("command", false));
  document.getElementById("btnLiveRepairMic").addEventListener("click", () => startLiveSpeechCapture("repair", false));

  document.getElementById("btnSendRepair").addEventListener("click", () => {
    triggerRepairUtterance(document.getElementById("inputRepairUtterance").value);
  });

  document.getElementById("chipSaySlotRepair").addEventListener("click", () => {
    const phrase =
      latestSnapshot && latestSnapshot.pending
        ? formatRepairExample(latestSnapshot.pending)
        : SCENARIOS[currentScenarioId].repairPhrase;
    triggerRepairUtterance(phrase);
  });
  document.getElementById("chipSayConfirm").addEventListener("click", () => triggerRepairUtterance("Yes, confirm"));
  document.getElementById("chipSayPassengerNoise").addEventListener("click", () => {
    triggerRepairUtterance("Are we stopping for coffee at the next services?");
  });
  document.getElementById("chipSayCancel").addEventListener("click", () => triggerRepairUtterance("Cancel"));

  document.getElementById("btnHudConfirm").addEventListener("click", () => triggerRepairUtterance("Yes"));
  document.getElementById("btnHudRepair").addEventListener("click", () => {
    if (latestSnapshot && latestSnapshot.pending) {
      triggerRepairUtterance(formatRepairExample(latestSnapshot.pending));
    }
  });

  document.getElementById("btnResetCockpit").addEventListener("click", async () => {
    stopCountdown();
    stopActiveMicSession();
    steeringTaskActive = false;
    carLateralOffset = 0;
    document.getElementById("chkSteeringTask").checked = false;
    document.getElementById("chkBaselineOem").checked = false;
    document.getElementById("chkRoadAudio").checked = false;
    toggleCabinSoundscape(false);
    document.getElementById("hudRepairProgress").setAttribute("value", "100");
    document.getElementById("ringSecondsText").textContent = "4.0s";
    await apiPost("/api/reset");
    await selectScenario(currentScenarioId);
  });

  window.addEventListener("keydown", (ev) => {
    const modal = document.getElementById("evalModal");
    if (modal && modal.open) return;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

    if (ev.code === "Space") {
      ev.preventDefault();
      triggerDriverCommand(false);
    } else if (ev.code === "ArrowLeft" && latestSnapshot && ["REPAIR_WINDOW", "CLARIFYING"].includes(latestSnapshot.state)) {
      ev.preventDefault();
      triggerRepairUtterance("Yes");
    } else if (ev.code === "ArrowRight" && latestSnapshot && ["REPAIR_WINDOW", "CLARIFYING"].includes(latestSnapshot.state)) {
      ev.preventDefault();
      triggerRepairUtterance(formatRepairExample(latestSnapshot.pending));
    } else if (ev.code === "Escape" && latestSnapshot && ["REPAIR_WINDOW", "CLARIFYING"].includes(latestSnapshot.state)) {
      ev.preventDefault();
      triggerRepairUtterance("Cancel");
    }
  });

  await apiPost("/api/reset");
  await selectScenario(1);
});
