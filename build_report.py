#!/usr/bin/env python3
"""
Builds Project_Report_3149895.docx (matching Literature_Review_3149895.docx formatting)
and Project_Report_3149895.md for DriveHUD, strictly verifying Assignment 2 word-count limits.
"""

import re
import zipfile
from xml.sax.saxutils import escape

def count_words(text: str) -> int:
    return len(re.findall(r"\b\w+(?:[-’'\u2019]\w+)*\b", text))

# ==============================================================================
# 1. ABSTRACT (Up to 300 words)
# ==============================================================================
ABSTRACT_PARAGRAPHS = [
    (
        "In-car voice user interfaces (VUIs) enable eyes-free control of navigation, communications, climate, "
        "and driver-assistance settings while visual and manual attention remain occupied on traffic. However, "
        "when road, rain, or crosswind noise (50–82 dB) causes automatic speech recognition (ASR) phonetic "
        "confusions (e.g., “14 Oak Road” versus “40 Oak Road”, or “Dr. Patel” versus “Daughter Payal”), "
        "commercial automotive VUIs conceal low acoustic certainty, commit the misheard action silently, and "
        "close the microphone channel. Discovering errors post-execution forces dangerous downward console "
        "glances and multi-turn wake-word restarts."
    ),
    (
        "To resolve this breakdown, this project presents DriveHUD, a full-stack Python and web-based automotive "
        "cockpit and Augmented-Reality Windshield Head-Up Display (AR-HUD) implementing decision-theoretic "
        "pre-execution grounding and wake-word-free verbal slot repair. Grounded in Horvitz’s (1999) expected-utility "
        "framework, DriveHUD evaluates posterior slot confidence P(s1|x), domain irreversibility loss L_err "
        "(weighting outbound calls and speed limiters above reversible climate tweaks), and dynamic driving "
        "workload W to select the minimum-expected-loss policy: Direct Commit, a 4.0-second Prosodic Readback "
        "Gate (“Routing to FORTY Oak Road...?”) paired with forward-eye-line HUD pills, or Explicit Hold. "
        "Drivers intercept misheard slots mid-turn via single-phrase patching (“No, fourteen”) while a "
        "domain-scoped grammar filters out passenger chatter."
    ),
    (
        "Current scope encompasses a working Python REST engine, articulatory phonetic confusion graph across "
        "four vehicle subsystems, interactive lane-keeping AR-HUD, hybrid audio pipeline, and a 120-trial Monte "
        "Carlo policy benchmark (reducing silent errors from 28.3% to 10.8% while keeping confirmation fatigue "
        "at 1.7% versus 44.2% for static prompts). Cabin SNR posteriors are simulated; seat-zone microphone "
        "beamforming and infrared gaze tracking remain planned."
    ),
]

# ==============================================================================
# 2. MAIN REPORT PROSE & RATIONALE TABLE (Around 1,000 words; max 1,100 words)
# ==============================================================================
SEC1_PARAGRAPHS = [
    (
        "In Assignment 1, literature synthesis across conversational breakdown taxonomies (Benner et al., 2021; "
        "Alghamdi et al., 2024), eyes-free speech guidelines (Murad et al., 2018; Kontogiorgos et al., 2021), "
        "and real-world turn-taking analyses (Albert et al., 2023) identified a core limitation in spoken "
        "assistants: reliance on reactive post-failure repair rather than proactive pre-execution interception. "
        "Through Norman’s (2013) action cycle (Week 1), silent execution under acoustic ambiguity creates a "
        "compounded safety hazard while driving: a Gulf of Evaluation, because internal ASR uncertainty remains "
        "invisible until a wrong route or outbound call activates, and a high-distraction Gulf of Execution, "
        "forcing visual attention toward a center touchscreen or repetitive wake-word restarts."
    ),
    (
        "Developing our initial Assignment 1 concept revealed that a static domestic timer form could not capture "
        "continuous attentional demand or asymmetric action risk. Pivoting to DriveHUD enabled a rigorous "
        "application of Weeks 1–4 concepts. Operationalizing Horvitz’s (1999) mixed-initiative utility principles "
        "(Week 3) alongside Amershi et al.’s (2019) Guidelines G2 (Make clear how well the system can do what it "
        "can do) and G10 (Scope services when in doubt) (Week 2), DriveHUD computes expected loss across three "
        "policies using posterior P(s1|x), domain error cost L_err (9.2 for outbound calls, 8.8 for speed limiters, "
        "7.6 for navigation, 3.8 for climate), and driving workload W. When prosodic gating minimizes expected loss, "
        "Guidelines G8 (Efficient dismissal) and G9 (Efficient correction) shape a 4.0-second wake-word-free "
        "open-mic window supporting natural next-turn self-repair (Clark & Brennan, 1991; Albert et al., 2023)."
    ),
]

RATIONALE_TABLE_HEADER = [
    "Design choice",
    "Status",
    "Why it suits the problem",
    "Supporting evidence or reference",
]

RATIONALE_TABLE_ROWS = [
    [
        "Horvitz expected-loss policy router (Direct Commit vs. 4.0s Prosodic Gate vs. Explicit Hold)",
        "Implemented (Python Engine) / Simulated (Posterior P)",
        "Replaces brittle static thresholds by minimizing expected cost across domain irreversibility L_err and speed/noise workload W, cutting confirmation fatigue.",
        "Horvitz (1999) mixed-initiative utility model; Amershi et al. (2019) G10 (Scope services when in doubt); verified in 120-trial benchmark (1.7% vs. 44.2% fatigue).",
    ],
    [
        "Prosodically stressed implicit readback (natural CarPlay voice + rising intonation) + spatial earcons",
        "Implemented",
        "Bridges Norman’s (2013) Gulf of Evaluation eyes-free by encoding recognition uncertainty into questioning intonation without forcing an extra turn when ASR is right.",
        "Amershi et al. (2019) G2 (Communicate uncertainty); Murad et al. (2018) eyes-free auditory feedback heuristics; Kontogiorgos et al. (2021).",
    ],
    [
        "4.0-second wake-word-free repair window with articulatory N-best slot patching",
        "Implemented",
        "Narrows Norman’s (2013) Gulf of Execution by enabling mid-turn slot replacement (“No, 14”), confirmation (“Yes”), or abort (“Cancel”) with hands on the wheel.",
        "Albert et al. (2023) Conversation Analysis of premature turn closure; Amershi et al. (2019) G8 (Dismissal) and G9 (Efficient correction).",
    ],
    [
        "Forward-eye-line AR-HUD pills + semantic conic progress ring + steering thumb shortcuts",
        "Implemented",
        "Prevents downward console glances during active lane-keeping workload and provides WCAG-compliant visual/tactile redundancy for hard-of-hearing drivers.",
        "Inclusive multimodal redundancy (Week 4); Alghamdi et al. (2024) scoping review on minimizing cognitive load during spoken repair.",
    ],
    [
        "Domain-scoped repair grammar and passenger-chatter false-activation guard",
        "Implemented",
        "Prevents cabin conversation during the 4.0s open-mic window from hijacking navigation routes, speed limiters, or outbound calls.",
        "Directly resolves the open-mic false-activation limitation identified in Assignment 1; verified by automated Test 2 in drivehud_engine.py.",
    ],
    [
        "Cabin SNR model (50–82 dB), active crosswind steering task, and 120-trial benchmark",
        "Simulated",
        "Isolates policy evaluation from browser cloud-ASR variance while enabling repeatable quantitative comparison against Baseline OEM and static binary prompts.",
        "Development testing exposed missing cloud ASR keys in embedded webviews; Monte Carlo simulation quantifies turn efficiency (1.41 vs. 2.07 turns).",
    ],
    [
        "Seat-zone beamforming microphone array",
        "Planned",
        "Would spatially isolate driver speech from passenger chatter and road rumble at the acoustic front-end in production vehicles.",
        "Albert et al. (2023) multi-party noise findings; requires physical multi-microphone automotive DSP hardware.",
    ],
    [
        "Infrared driver gaze and corrective prosody detector",
        "Planned",
        "Would pause the 4.0s gate during high-demand highway merges and fuse hyper-articulated pitch stress with lexical repair parsing.",
        "Alghamdi et al. (2024) prosodic repair shifts; Horvitz (1999) attentional-state inference.",
    ],
]

SEC2_PARAGRAPHS = [
    (
        "Figure 2 depicts DriveHUD’s full-stack architecture connecting the AR cockpit (`index.html`, `app.js`) "
        "to the Python decision-theoretic backend (`server.py`, `drivehud_engine.py`). Three engineering refinements "
        "shaped development. First, calibrating expected loss in 78 dB crosswind showed that constant missed-cue "
        "probabilities under-selected Explicit Hold; modelling noise-dependent masking raised gate risk at low P, "
        "safely blocking high-loss calls (Test 5). Second, testing live speech uncovered a race condition where "
        "short “Yes” confirmations triggered the Web Audio silence detector before Web Speech finalized; isolating "
        "Web Speech from the 20-band spectrum analyzer and adding `/s/` sibilance classification resolved this "
        "(Test 6). Third, a 120-trial Monte Carlo benchmark (Test 7) confirmed DriveHUD lowers silent errors from "
        "28.3% (Baseline OEM) to 10.8% while reducing mean effort to 1.41 turns/task."
    ),
]

SEC3_PARAGRAPHS = [
    (
        "Figure 3 illustrates three core interaction storyboards (complemented by a fourth ADAS speed-limiter "
        "preset in the live cockpit). In Storyboard 1 (Highway Rain Reroute, P = 0.65, L_err = 7.6), a driver at "
        "65 mph in 72 dB rain says “Navigate to fourteen Oak Road”, inferred as “40 Oak Road”. Because "
        "EL(Gate) = 1.67 beats EL(Direct) = 2.66, DriveHUD withholds rerouting, plays a rising earcon and "
        "questioning readback (“Routing to FORTY Oak Road...?”), and projects a 4.0-second HUD ring (`40 Oak Rd` "
        "| `14 Oak Rd`). Saying “No, fourteen” patches the slot eyes-free (whereas 4.0s silence auto-commits). "
        "In Storyboard 2 (Quiet Cruise, P = 0.93, L_err = 3.8), a reversible climate tweak (“19 degrees”) selects "
        "Direct Commit (EL = 0.27) with zero confirmation fatigue, while passenger chatter (“Stopping for coffee "
        "soon?”) during open-mic windows is rejected by the noise guard. In Storyboard 3 (Crosswind Call, P = 0.34, "
        "L_err = 9.2), Explicit Hold blocks auto-dialing “Daughter Payal” until resolved verbally (“Actually Dr. "
        "Patel”) or via the `[→]` steering-wheel thumb switch."
    ),
]

FIG1_CAPTION = (
    "Figure 1: Baseline five-stage hands-free VUI interaction loop (reused from Assignment 1), illustrating how "
    "low-confidence speech-to-text inferences bypass pre-execution grounding and close the microphone prematurely."
)
FIG2_CAPTION = (
    "Figure 2: DriveHUD decision-theoretic full-stack architecture and AI control flow, distinguishing Implemented "
    "(green), Simulated (amber), and Planned (purple) components across the Horvitz router and AR-Windshield HUD."
)
FIG3_CAPTION = (
    "Figure 3: Three illustrated DriveHUD interaction storyboards showing driver actions, expected-loss policy "
    "selection, eye-line AR-HUD feedback, passenger chatter filtering, and wake-word-free slot repair."
)

REPO_SECTION_PARAGRAPHS = [
    "Public GitHub Repository & README: https://github.com/utkarshdev/drivehud-pre-execution-vui (Local Git repository on branch main; see README.md).",
    "Submitted Verification, Benchmark & Server: Run `python3 drivehud_engine.py` to execute all 7 assertions (including the 120-trial policy benchmark), and run `python3 server.py` (http://localhost:8000) to inspect the DriveHUD cockpit, active lane-keeping workload, and benchmark modal.",
    "Development Record Pointer: See Section 4 of README.md for the staged development record (including expected-loss calibration and audio race-condition fixes) and Section 5 for the AI assistance verification log.",
]

REFERENCES_LIST = [
    ("Albert, S., Hamann, M., & Stokoe, E. (2023). Conversational User Interfaces in Smart Homecare Interactions: A Conversation Analytic Case Study. ", "Proceedings of the 5th International Conference on Conversational User Interfaces (CUI '23)", ", 1–12. https://doi.org/10.1145/3571884.3597140"),
    ("Alghamdi, E., Halvey, M., & Nicol, E. (2024). System and user strategies to repair conversational breakdowns of spoken dialogue systems: A scoping review. ", "Proceedings of the 6th ACM Conference on Conversational User Interfaces (CUI '24)", ", Article 28, 1–13. https://doi.org/10.1145/3640794.3665558"),
    ("Amershi, S., Weld, D., Vorvoreanu, M., Fourney, A., Nushi, B., Collisson, P., Suh, J., Iqbal, S., Bennett, P. N., Inkpen, K., Teevan, J., Kikin-Gil, R., & Horvitz, E. (2019). Guidelines for Human-AI Interaction. ", "Proceedings of the 2019 CHI Conference on Human Factors in Computing Systems (CHI '19)", ", Paper 3, 1–13. https://doi.org/10.1145/3290605.3300233"),
    ("Benner, D., Elshan, E., Schöbel, S., & Janson, A. (2021). What do you mean? A Review on Recovery Strategies to Overcome Conversational Breakdowns of Conversational Agents. ", "Proceedings of the 42nd International Conference on Information Systems (ICIS 2021)", ", Paper 13, 1–17. https://aisel.aisnet.org/icis2021/hci_robot/hci_robot/13/"),
    ("Clark, H. H., & Brennan, S. E. (1991). Grounding in communication. In L. B. Resnick, J. M. Levine, & S. D. Teasley (Eds.), ", "Perspectives on Socially Shared Cognition", " (pp. 127–149). American Psychological Association. https://doi.org/10.1037/10096-006"),
    ("Horvitz, E. (1999). Principles of mixed-initiative user interfaces. ", "Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '99)", ", 159–166. https://doi.org/10.1145/302979.303030"),
    ("Kontogiorgos, D., Pereira, A., & Gustafson, J. (2021). Grounding behaviors with conversational interfaces: effects of embodiment and failures. ", "Journal on Multimodal User Interfaces", ", 15(2), 239–254. https://doi.org/10.1007/s12193-021-00366-y"),
    ("Murad, C., Munteanu, C., Clark, L., & Cowan, B. R. (2018). Design guidelines for hands-free speech interaction. ", "Proceedings of the 20th International Conference on Human-Computer Interaction with Mobile Devices and Services Adjunct (MobileHCI '18)", ", 269–276. https://doi.org/10.1145/3236112.3236149"),
    ("Norman, D. A. (2013). ", "The Design of Everyday Things: Revised and Expanded Edition", ". Basic Books."),
    ("Reused Material Acknowledgment: ", "Assignment 1 Literature Review (Dev, 2026)", " — Reused and adapted problem framing and Figure 1 baseline five-stage interaction loop diagram."),
]

def compute_counts():
    abstract_words = sum(count_words(p) for p in ABSTRACT_PARAGRAPHS)
    prose_words = sum(count_words(p) for p in SEC1_PARAGRAPHS + SEC2_PARAGRAPHS + SEC3_PARAGRAPHS)
    table_words = sum(count_words(c) for c in RATIONALE_TABLE_HEADER) + sum(
        count_words(cell) for row in RATIONALE_TABLE_ROWS for cell in row
    )
    main_report_words = prose_words + table_words
    total_counted_words = abstract_words + main_report_words
    return abstract_words, prose_words, table_words, main_report_words, total_counted_words

def w_p_title(text: str) -> str:
    return f'<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>{escape(text)}</w:t></w:r></w:p>'

def w_p_meta(line1: str, line2: str) -> str:
    return (
        f'<w:p><w:pPr><w:spacing w:after="160"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr>'
        f'<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>{escape(line1)}</w:t></w:r>'
        f'<w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:br/><w:t>{escape(line2)}</w:t></w:r></w:p>'
    )

def w_p_heading1(text: str) -> str:
    return (
        f'<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="280" w:after="120"/>'
        f'<w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>'
        f'<w:kern w:val="36"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:pPr>'
        f'<w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>'
        f'<w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr><w:t>{escape(text)}</w:t></w:r></w:p>'
    )

def w_p_heading2(text: str) -> str:
    return (
        f'<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="220" w:after="80"/>'
        f'<w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>'
        f'<w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>'
        f'<w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>'
        f'<w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>{escape(text)}</w:t></w:r></w:p>'
    )

def w_p_body(text: str) -> str:
    return f'<w:p><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:t>{escape(text)}</w:t></w:r></w:p>'

def w_p_image(rel_id: str, pic_id: int, cx: int, cy: int, caption: str) -> str:
    label, rest = caption.split(":", 1)
    img_p = (
        f'<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="140" w:after="60"/></w:pPr>'
        f'<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>'
        f'<wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{pic_id}" name="Picture {pic_id}"/>'
        f'<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        f'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        f'<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:nvPicPr><pic:cNvPr id="{pic_id}" name="Picture {pic_id}"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rel_id}" cstate="print"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        f'</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
    )
    cap_p = (
        f'<w:p><w:pPr><w:spacing w:after="180"/></w:pPr>'
        f'<w:r><w:rPr><w:rFonts w:ascii="Times-Bold" w:hAnsi="Times-Bold" w:cs="Times-Bold"/><w:b/><w:bCs/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
        f'<w:t>{escape(label)}:</w:t></w:r>'
        f'<w:r><w:rPr><w:rFonts w:ascii="Times-Roman" w:hAnsi="Times-Roman" w:cs="Times-Roman"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
        f'<w:t xml:space="preserve">{escape(rest)}</w:t></w:r></w:p>'
    )
    return img_p + cap_p

def w_rationale_table(headers: list[str], rows: list[list[str]]) -> str:
    xml = [
        '<w:tbl><w:tblPr><w:tblStyle w:val="GridTable4-Accent1"/><w:tblW w:w="5000" w:type="pct"/>'
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>'
        '<w:tblGrid><w:gridCol w:w="2100"/><w:gridCol w:w="1350"/><w:gridCol w:w="3050"/><w:gridCol w:w="2850"/></w:tblGrid>'
    ]
    xml.append('<w:tr><w:trPr><w:cnfStyle w:val="100000000000" w:firstRow="1"/></w:trPr>')
    for h in headers:
        xml.append(
            f'<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/><w:shd w:val="clear" w:color="auto" w:fill="0F172A"/></w:tcPr>'
            f'<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>'
            f'<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>{escape(h)}</w:t></w:r></w:p></w:tc>'
        )
    xml.append('</w:tr>')
    for idx, row in enumerate(rows):
        fill = "F8FAFC" if idx % 2 == 0 else "FFFFFF"
        xml.append('<w:tr>')
        for c_idx, cell in enumerate(row):
            bold_tag = "<w:b/>" if c_idx in (0, 1) else ""
            xml.append(
                f'<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>'
                f'<w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/></w:tcBorders>'
                f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/></w:tcPr>'
                f'<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>'
                f'<w:r><w:rPr>{bold_tag}<w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>{escape(cell)}</w:t></w:r></w:p></w:tc>'
            )
        xml.append('</w:tr>')
    xml.append('</w:tbl>')
    return "".join(xml)

def w_p_reference(pre: str, italics: str, post: str) -> str:
    return (
        f'<w:p><w:pPr><w:spacing w:after="100" w:line="260" w:lineRule="atLeast"/>'
        f'<w:ind w:left="720" w:hanging="720"/></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{escape(pre)}</w:t></w:r>'
        f'<w:r><w:rPr><w:i/><w:iCs/></w:rPr><w:t>{escape(italics)}</w:t></w:r>'
        f'<w:r><w:t xml:space="preserve">{escape(post)}</w:t></w:r></w:p>'
    )

def build_docx_and_md():
    a_w, p_w, t_w, m_w, tot_w = compute_counts()
    assert a_w <= 300, f"Abstract exceeded 300 words: {a_w}"
    assert m_w <= 1100, f"Main report exceeded 1100 words: {m_w}"
    assert tot_w <= 1300, f"Total report exceeded 1300 safety limit: {tot_w}"

    meta_line1 = "[Utkarsh Dev] | [3149895] | [Intelligent Interactive Systems] | [University of Birmingham] | [Professor Eyal Ofek] | [25 November 2026]"
    meta_line2 = f"Total Report Word Count: {tot_w} words (Abstract: {a_w} words | Main Report including Rationale Table: {m_w} words)"

    body_parts = [
        w_p_title("Project Report: DriveHUD — Decision-Theoretic Pre-Execution Grounding and Verbal Repair in Eyes-Free In-Car VUIs"),
        w_p_meta(meta_line1, meta_line2),
        w_p_heading1(f"Abstract ({a_w} words)"),
    ]
    for p in ABSTRACT_PARAGRAPHS:
        body_parts.append(w_p_body(p))

    body_parts.append(w_p_heading1("1. Design Rationale and Project Explanation"))
    body_parts.append(w_p_body(SEC1_PARAGRAPHS[0]))
    body_parts.append(w_p_image("rId7", 101, 5800000, 2650000, FIG1_CAPTION))
    body_parts.append(w_p_body(SEC1_PARAGRAPHS[1]))
    body_parts.append(w_p_heading2("Table 1: Design Rationale, Implementation Status, and Supporting Evidence"))
    body_parts.append(w_rationale_table(RATIONALE_TABLE_HEADER, RATIONALE_TABLE_ROWS))

    body_parts.append(w_p_heading1("2. System Architecture and Development Decisions"))
    body_parts.append(w_p_body(SEC2_PARAGRAPHS[0]))
    body_parts.append(w_p_image("rId10", 102, 5943600, 3476000, FIG2_CAPTION))

    body_parts.append(w_p_heading1("3. Storyboards and Illustrated Interaction"))
    body_parts.append(w_p_body(SEC3_PARAGRAPHS[0]))
    body_parts.append(w_p_image("rId11", 103, 5943600, 3797000, FIG3_CAPTION))

    body_parts.append(w_p_heading1("4. Repository and Development Evidence"))
    for p in REPO_SECTION_PARAGRAPHS:
        body_parts.append(w_p_body(p))

    body_parts.append(w_p_heading1("References and Reused Material"))
    for pre, it, post in REFERENCES_LIST:
        body_parts.append(w_p_reference(pre, it, post))

    sect_pr = (
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>'
        '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>'
    )

    doc_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" '
        'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
        'xmlns:o="urn:schemas-microsoft-com:office:office" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
        'xmlns:v="urn:schemas-microsoft-com:vml" '
        'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        'xmlns:w10="urn:schemas-microsoft-com:office:word" '
        'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" '
        'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" '
        'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" '
        'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" '
        'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" '
        'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '
        'mc:Ignorable="w14 w15 wp14"><w:body>'
        + "".join(body_parts)
        + sect_pr
        + '</w:body></w:document>'
    )

    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
        '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>'
        '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>'
        '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/>'
        '<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.jpeg"/>'
        '<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>'
        '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>'
        '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.jpeg"/>'
        '<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image3.jpeg"/>'
        '</Relationships>'
    )

    with zipfile.ZipFile("Literature_Review_3149895.docx", "r") as zin:
        with zipfile.ZipFile("Project_Report_3149895.docx", "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == "word/document.xml":
                    zout.writestr(item, doc_xml.encode("utf-8"))
                elif item.filename == "word/_rels/document.xml.rels":
                    zout.writestr(item, rels_xml.encode("utf-8"))
                else:
                    zout.writestr(item, zin.read(item.filename))
            with open("System_Architecture.jpg", "rb") as f2:
                zout.writestr("word/media/image2.jpeg", f2.read())
            with open("Storyboards_Interaction.jpg", "rb") as f3:
                zout.writestr("word/media/image3.jpeg", f3.read())

    md_lines = [
        "# Project Report: DriveHUD — Decision-Theoretic Pre-Execution Grounding and Verbal Repair in Eyes-Free In-Car VUIs",
        "",
        f"**{meta_line1}**  ",
        f"**{meta_line2}**",
        "",
        f"## Abstract ({a_w} words)",
        "",
    ]
    for p in ABSTRACT_PARAGRAPHS:
        md_lines.extend([p, ""])

    md_lines.extend([
        "## 1. Design Rationale and Project Explanation",
        "",
        SEC1_PARAGRAPHS[0],
        "",
        "![Figure 1](Interaction_loop.svg)",
        f"*{FIG1_CAPTION}*",
        "",
        SEC1_PARAGRAPHS[1],
        "",
        "### Table 1: Design Rationale, Implementation Status, and Supporting Evidence",
        "",
        "| " + " | ".join(RATIONALE_TABLE_HEADER) + " |",
        "| --- | --- | --- | --- |",
    ])
    for row in RATIONALE_TABLE_ROWS:
        md_lines.append("| " + " | ".join(row) + " |")

    md_lines.extend([
        "",
        "## 2. System Architecture and Development Decisions",
        "",
        SEC2_PARAGRAPHS[0],
        "",
        "![Figure 2](System_Architecture.svg)",
        f"*{FIG2_CAPTION}*",
        "",
        "## 3. Storyboards and Illustrated Interaction",
        "",
        SEC3_PARAGRAPHS[0],
        "",
        "![Figure 3](Storyboards_Interaction.svg)",
        f"*{FIG3_CAPTION}*",
        "",
        "## 4. Repository and Development Evidence",
        "",
    ])
    for p in REPO_SECTION_PARAGRAPHS:
        md_lines.extend([f"- {p}", ""])

    md_lines.extend([
        "## References and Reused Material",
        "",
    ])
    for pre, it, post in REFERENCES_LIST:
        md_lines.append(f"- {pre}*{it}*{post}")

    with open("Project_Report_3149895.md", "w", encoding="utf-8") as fmd:
        fmd.write("\n".join(md_lines) + "\n")

    print("Successfully built DriveHUD Project_Report_3149895.docx and Project_Report_3149895.md!")
    print(f"Verified counts -> Abstract: {a_w}w | Main Report (Prose {p_w}w + Table {t_w}w): {m_w}w | Total Counted: {tot_w}w")

if __name__ == "__main__":
    build_docx_and_md()
