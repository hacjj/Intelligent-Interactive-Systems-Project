# DriveHUD: Decision-Theoretic Pre-Execution Grounding and Verbal Repair in Eyes-Free In-Car VUIs

**Author:** Utkarsh Dev (Student ID: 3149895)  
**Module:** MSc Intelligent Interactive Systems — University of Birmingham (Prof. Eyal Ofek)  
**README Prose Word Count:** 718 words *(excluding code blocks and setup commands)*

---

## 1. Project Status

- **What was built:** **DriveHUD**, a full-stack MSc-level decision-theoretic automotive Voice User Interface (VUI) and Augmented-Reality Windshield Head-Up Display (AR-HUD) simulator enabling pre-execution conversational grounding and wake-word-free verbal slot repair under realistic driving workload.
- **Implemented & working:**
  - **Horvitz (1999) Expected-Loss Policy Router (`drivehud_engine.py`):** Evaluates candidate grounding actions—*Direct Commit*, *4.0s Prosodic Gate*, and *Explicit Hold*—by minimizing expected utility loss $\arg\min_a EL(a \mid P(s_1 \mid x), L_{\text{err}}, W)$ across four vehicle domains: Hands-Free Comms ($L_{\text{err}}=9.2$), ADAS Speed Limiter ($L_{\text{err}}=8.8$), Navigation ($L_{\text{err}}=7.6$), and Cabin Climate ($L_{\text{err}}=3.8$), scaled by dynamic driving workload $W(v_{\text{mph}}, \text{SNR})$.
  - **Articulatory Phonetic Confusion Graph & Repair Parser:** Maps spoken utterances onto phoneme-class skeletons to resolve N-best phonetic neighbors (*14↔40*, *16↔60*, *Dr. Patel↔Daughter Payal*, *Oak Rd↔York Rd*), supports wake-word-free mid-turn slot patching (*"No, fourteen"*, *"Actually Dr. Patel"*), preserves heard slots on verbal confirmation (*"Yes"*), and rejects passenger chatter.
  - **Prosodic Readback, Spatial Earcons & Panoramic Windshield HUD:** Selects natural human navigation voices (`Daniel` / `Samantha`, blocking novelty MacInTalk voices), normalizes spoken units (`°C`, `MPH`, `Dr.`), synthesizes rising question prosody (`1.02x` pitch, `?` contour) with Web Audio chimes, and renders an unobstructed `21:9` highway windshield above a lower-bezel `<progress>` 4.0-second countdown ring and candidate pills (`40 Oak Rd` vs. `14 Oak Rd`).
- **Simulated:**
  - **Cabin SNR Posterior & Acoustic Phonetic Fallback:** Models $50\text{–}82\text{ dB}$ clear, rain, and crosswind road profiles, optional Web Audio pink/brown road noise synthesis, and high-frequency `/s/` sibilance classification when embedded IDE webviews block cloud ASR keys.
- **Planned (Unfinished):**
  - **Seat-Zone Beamforming Microphone Array:** Physical multi-microphone automotive DSP to spatially separate driver vs. passenger speech.
  - **Infrared Driver Gaze & Prosodic Stress Classifier:** Hardware eye-tracking to pause the 4.0-second countdown during highway merges.

---

## 2. Technology Stack

- **Backend (`server.py`, `drivehud_engine.py`):** Python 3.10+ (`ThreadingHTTPServer` JSON REST API, decision-theoretic state machine, articulatory edit-distance matcher, 7-assertion test suite, and 120-trial Monte Carlo benchmark). Zero external packages or API keys required.
- **Frontend (`index.html`, `styles.css`, `app.js`):** HTML5 Canvas (AR windshield + 20-band audio spectrum), modern CSS Grid (`grid-template-areas`, `@container` responsive tables, `@property` conic-gradient `<progress>` countdown ring, native `<dialog>`), Web Speech API, and Web Audio API.
- **Undecided Future Choices:** Calibrating sub-word posteriors via Whisper-tiny vs. QNX Kaldi lattices on embedded automotive ECUs.

---

## 3. Running or Inspecting the Work

No external dependencies or API keys are required.

```bash
# 1. Run the 7-test MSc verification & 120-trial benchmark suite
python3 drivehud_engine.py

# 2. Launch the full-stack DriveHUD server
python3 server.py
# Open http://localhost:8000 in Chrome, Safari, or Edge
```

In the cockpit UI:
- Select **Scenarios 1–4** on the right, optionally enable **🎯 Active Crosswind Lane-Keeping Workload**, and press **🚘 Push-to-Talk** (`Space`).
- Click **📊 120-Trial Policy Benchmark** in the top-right header to inspect and re-run the empirical policy evaluation across random seeds.

---

## 4. Development Record

- **Stage 1 — Assignment 1 Problem Framing (`98abaa9`):** Modelled the five-stage hands-free VUI silent-commit failure loop.
- **Stage 2 — Domestic Timer Prototype (`4617f7b`, `839a3b5`):** Built an initial browser form for domestic timers; walkthroughs showed it lacked realistic eyes-busy attentional demand and domain-specific error risk.
- **Stage 3 — Full-Stack DriveHUD & Horvitz Expected-Loss Upgrade (`drivehud_engine.py`, `server.py`, `app.js`):** Rebuilt the system as a full-stack automotive cockpit. Replaced heuristic thresholds with Horvitz's (1999) expected-loss minimization, added an articulatory phonetic graph across four vehicle subsystems, fixed a parallel Web Speech / Web Audio race condition on short `"Yes"` confirmations, and added a 120-trial Monte Carlo benchmark modal.

---

## 5. AI Assistance

- **Tools Used:** Google Antigravity (Gemini) assistant.
- **How AI Was Used & Checked:**
  1. *Expected-Loss Formulation & Bug Fixing:* Used AI to structure the Python expected-loss router and audio pipeline. When testing revealed that `EXPLICIT_HOLD` was under-selected in 78 dB crosswind and that `"Yes"` raced against the VAD fallback, I calibrated the noise-dependent missed-cue probability `p_miss_gate` and isolated Web Speech transcription from the spectrum analyzer, verifying with 7 automated assertions.
  2. *Accessible UI & Diagrams:* Used AI to implement `<progress>` rings, `<dialog>` modals, and SVG diagrams, checking visual layout, keyboard navigation, and word-count compliance.

---

## 6. Additional Files

- `Project_Report_3149895.docx` & `Project_Report_3149895.md`: Assignment 2 MSc Project Report.
- `System_Architecture.svg` (`.jpg`) & `Storyboards_Interaction.svg` (`.jpg`): Architecture and storyboard figures.
- `Literature_Review_3149895.docx` & `Interaction_loop.svg`: Assignment 1 Literature Review and baseline loop figure.
