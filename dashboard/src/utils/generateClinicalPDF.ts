import { jsPDF } from 'jspdf';
import type { PatientDetails } from '../components/ui/PatientDialog';

interface MLResult {
  risk_class?: string;
  risk_confidence?: number;
  insight?: string;
  query?: string;
  features?: {
    knee_variance?: number;
    pressure_asymmetry?: number;
    emg_amplitude?: number;
    gait_speed?: number;
  };
}

interface DataPoint {
  leftLeg?: { pressure?: { heel?: number }; quadEMG?: number };
  rightLeg?: { pressure?: { heel?: number }; quadEMG?: number };
  phase?: number;
}

// ─── Layout constants ────────────────────────────────────────────────────────
const PW   = 210;   // page width mm
const PH   = 297;   // page height mm
const ML   = 16;    // margin left
const MR   = 16;    // margin right
const MT   = 14;    // margin top (first page, below header)
const MB   = 18;    // margin bottom (above footer)
const CW   = PW - ML - MR;
const BOTTOM_LIMIT = PH - MB;
const HEADER_H = 22;
const FOOTER_H = 10;

// ─── Colours (print-safe) ────────────────────────────────────────────────────
const C = {
  black:   [0,   0,   0  ] as [number,number,number],
  dark:    [30,  30,  30 ] as [number,number,number],
  mid:     [90,  90,  90 ] as [number,number,number],
  light:   [150, 150, 150] as [number,number,number],
  rule:    [210, 210, 210] as [number,number,number],
  panel:   [245, 245, 245] as [number,number,number],
  white:   [255, 255, 255] as [number,number,number],
  red:     [200, 30,  30 ] as [number,number,number],
  amber:   [180, 100, 0  ] as [number,number,number],
  green:   [30,  130, 60 ] as [number,number,number],
  blue:    [30,  80,  200] as [number,number,number],
  orange:  [200, 100, 20 ] as [number,number,number],
};

function riskColor(rc: string): [number,number,number] {
  if (rc === 'Healthy')       return C.green;
  if (rc === 'Moderate Risk') return C.amber;
  return C.red;
}

function downsample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

// ─── Page manager ────────────────────────────────────────────────────────────
class Page {
  doc: jsPDF;
  cy: number;
  pageNum: number;

  constructor() {
    this.doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    this.pageNum = 1;
    this.cy = HEADER_H + MT;
    this._drawHeader();
    this._drawFooter();
  }

  // Ensure there is `needed` mm of space; add new page if not
  ensureSpace(needed: number) {
    if (this.cy + needed > BOTTOM_LIMIT) {
      this.doc.addPage();
      this.pageNum++;
      this.cy = HEADER_H + MT;
      this._drawHeader();
      this._drawFooter();
    }
  }

  _drawHeader() {
    const doc = this.doc;
    // Top border stripe
    doc.setFillColor(...C.dark);
    doc.rect(0, 0, PW, 1.5, 'F');

    // Red accent line
    doc.setFillColor(...C.red);
    doc.rect(0, 1.5, PW, 3.5, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.dark);
    doc.text('OA-Sense Gait Intelligence Platform', ML, 13);

    // Subtitle right-aligned
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.mid);
    doc.text('Clinical Osteoarthritis Risk Report', PW - MR, 9, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, PW - MR, 14, { align: 'right' });

    // Separator
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.3);
    doc.line(ML, HEADER_H, PW - MR, HEADER_H);
  }

  _drawFooter() {
    const doc = this.doc;
    const y = PH - FOOTER_H;
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.3);
    doc.line(ML, y, PW - MR, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.light);
    doc.text('OA-Sense Platform  |  Clinical Motion Intelligence  |  CONFIDENTIAL MEDICAL DOCUMENT', ML, y + 5);
    doc.text(`Page ${this.pageNum}`, PW - MR, y + 5, { align: 'right' });
  }

  sectionTitle(title: string) {
    this.ensureSpace(14);
    const doc = this.doc;
    this.cy += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.red);
    doc.text(title.toUpperCase(), ML, this.cy);
    doc.setDrawColor(...C.red);
    doc.setLineWidth(0.4);
    doc.line(ML, this.cy + 1.5, PW - MR, this.cy + 1.5);
    this.cy += 6;
  }

  rule(gap = 4) {
    this.cy += gap;
    this.doc.setDrawColor(...C.rule);
    this.doc.setLineWidth(0.2);
    this.doc.line(ML, this.cy, PW - MR, this.cy);
    this.cy += gap;
  }
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────
function drawSparkline(
  doc: jsPDF,
  values: number[],
  x: number, y: number, w: number, h: number,
  color: [number,number,number]
) {
  if (values.length < 2) return;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    px: x + (i / (values.length - 1)) * w,
    py: y + h - ((v - min) / range) * h,
  }));
  doc.setDrawColor(...color);
  doc.setLineWidth(0.4);
  for (let i = 1; i < pts.length; i++) {
    doc.line(pts[i-1].px, pts[i-1].py, pts[i].px, pts[i].py);
  }
  // Faint grid
  doc.setDrawColor(...C.rule);
  doc.setLineWidth(0.15);
  for (let g = 0; g <= 3; g++) {
    const gy = y + (g / 3) * h;
    doc.line(x, gy, x + w, gy);
  }
  // Min/max labels
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...C.light);
  doc.text(`${max.toFixed(0)}`, x - 1, y + 2, { align: 'right' });
  doc.text(`${min.toFixed(0)}`, x - 1, y + h, { align: 'right' });
}

function labelValue(
  doc: jsPDF,
  label: string, value: string, unit: string,
  x: number, y: number,
  status: string, statusColor: [number,number,number]
) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.mid);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.dark);
  doc.text(value, x, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.light);
  doc.text(unit, x, y + 13);

  // Status pill
  doc.setFillColor(...statusColor);
  doc.roundedRect(x, y + 15, 22, 5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...C.white);
  doc.text(status, x + 11, y + 18.5, { align: 'center' });
}

// ─── Main export function ─────────────────────────────────────────────────────
export function generateClinicalPDF(
  capturedData: DataPoint[],
  mlResult: MLResult | null,
  patientDetails: PatientDetails
): void {
  const pg = new Page();
  const doc = pg.doc;

  // ── PATIENT / SESSION INFO ──────────────────────────────────────────────────
  doc.setFillColor(...C.panel);
  doc.roundedRect(ML, pg.cy, CW, 18, 1.5, 1.5, 'F');
  doc.setDrawColor(...C.rule);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, pg.cy, CW, 18, 1.5, 1.5, 'S');

  const infoFields: [string, string][] = [
    ['Patient Name',  patientDetails.name || 'Unknown'],
    ['Patient ID',    patientDetails.id || 'N/A'],
    ['Demographics',  `${patientDetails.age || '?'} yrs, ${patientDetails.gender || 'Unknown'}`],
    ['Date',          new Date().toLocaleDateString()],
    ['Time',          new Date().toLocaleTimeString()],
  ];
  infoFields.forEach(([lbl, val], i) => {
    const fx = ML + 6 + i * (CW / 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.mid);
    doc.text(lbl, fx, pg.cy + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.dark);
    doc.text(val, fx, pg.cy + 13);
  });
  pg.cy += 24;

  // ── RISK CLASSIFICATION BANNER ──────────────────────────────────────────────
  const riskClass  = mlResult?.risk_class ?? 'Not Analysed';
  const confidence = Math.round((mlResult?.risk_confidence ?? 0) * 100);
  const rc         = riskColor(riskClass);

  doc.setDrawColor(...rc);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, pg.cy, CW, 22, 1.5, 1.5, 'S');
  // Left colour bar
  doc.setFillColor(...rc);
  doc.roundedRect(ML, pg.cy, 4, 22, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.mid);
  doc.text('AI RISK CLASSIFICATION', ML + 8, pg.cy + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...rc);
  doc.text(riskClass, ML + 8, pg.cy + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.mid);
  doc.text('MODEL CONFIDENCE', PW - MR - 40, pg.cy + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.dark);
  doc.text(`${confidence}%`, PW - MR - 40, pg.cy + 19);

  pg.cy += 28;

  // ── BIOMECHANICAL FEATURES ──────────────────────────────────────────────────
  pg.sectionTitle('Biomechanical Feature Summary');

  const f = mlResult?.features ?? {};
  const kv = f.knee_variance      ?? 0;
  const pa = f.pressure_asymmetry ?? 0;
  const ea = f.emg_amplitude      ?? 0;
  const gs = f.gait_speed         ?? 0;

  function getStatus(value: number, highThresh: number, modThresh: number, invert = false): { statusLabel: string; statusColor: [number,number,number] } {
    const isHigh = invert ? value < highThresh : value > highThresh;
    const isMod  = invert ? value < modThresh  : value > modThresh;
    if (isHigh) return { statusLabel: 'HIGH RISK', statusColor: C.red };
    if (isMod)  return { statusLabel: 'MODERATE',  statusColor: C.amber };
    return             { statusLabel: 'NORMAL',    statusColor: C.green };
  }

  const cards: { label: string; value: string; unit: string; statusLabel: string; statusColor: [number,number,number] }[] = [
    { label: 'Knee Variance',      value: kv.toFixed(2),              unit: 'deg²/s²',     ...getStatus(kv, 20,   10,   false) },
    { label: 'Pressure Asymmetry', value: `${(pa*100).toFixed(1)}%`,  unit: '% asymmetry', ...getStatus(pa, 0.3,  0.15, false) },
    { label: 'EMG Amplitude',      value: `${(ea*100).toFixed(1)}%`,  unit: 'normalised',  ...getStatus(ea, 0.3,  0.5,  true)  },
    { label: 'Gait Speed',         value: gs.toFixed(2),              unit: 'm/s proxy',   ...getStatus(gs, 0.8,  1.1,  true)  },
  ];

  pg.ensureSpace(36);
  const cw2 = (CW - 6) / 4;

  cards.forEach((card, i) => {
    const cx = ML + i * (cw2 + 2);
    doc.setFillColor(...C.panel);
    doc.roundedRect(cx, pg.cy, cw2, 30, 1.5, 1.5, 'F');
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.25);
    doc.roundedRect(cx, pg.cy, cw2, 30, 1.5, 1.5, 'S');

    labelValue(
      doc,
      card.label, card.value, card.unit,
      cx + 4, pg.cy + 4,
      card.statusLabel,
      card.statusColor
    );
  });
  pg.cy += 36;

  // ── FEATURE DESCRIPTIONS ────────────────────────────────────────────────────
  pg.ensureSpace(28);
  const descs = [
    { label: 'Knee Variance',      desc: 'Variance of knee-shank gyroscope Z-axis during the Walking Phase. High values indicate stiff, wobbly, or pain-avoidance gait patterns consistent with OA.' },
    { label: 'Pressure Asymmetry', desc: 'Left-right heel FSR load imbalance averaged across all 3 test phases. Values above 30% indicate chronic off-loading of a painful joint.' },
    { label: 'EMG Amplitude',      desc: 'Normalised quadriceps muscle activation during the assessment. Below 30% indicates muscle atrophy, a key OA progression marker.' },
    { label: 'Gait Speed',         desc: 'Forward thigh acceleration proxy averaged over the Walking Phase. Reduced speed is one of the strongest OA clinical predictors.' },
  ];

  descs.forEach((d) => {
    pg.ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.dark);
    doc.text(`${d.label}:`, ML, pg.cy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.mid);
    const wrapped = doc.splitTextToSize(d.desc, CW - 36);
    doc.text(wrapped, ML + 35, pg.cy);
    pg.cy += wrapped.length * 4 + 2;
  });

  // ── SENSOR WAVEFORMS ────────────────────────────────────────────────────────
  pg.sectionTitle('Sensor Waveforms');

  const chartConfigs = [
    { title: 'Heel Pressure — Left Leg',    vals: downsample(capturedData.map(d => d.leftLeg?.pressure?.heel  ?? 0), 200), color: C.blue },
    { title: 'Heel Pressure — Right Leg',   vals: downsample(capturedData.map(d => d.rightLeg?.pressure?.heel ?? 0), 200), color: C.orange },
    { title: 'Quadriceps EMG — Left Leg',   vals: downsample(capturedData.map(d => d.leftLeg?.quadEMG         ?? 0), 200), color: C.blue },
    { title: 'Quadriceps EMG — Right Leg',  vals: downsample(capturedData.map(d => d.rightLeg?.quadEMG        ?? 0), 200), color: C.orange },
  ];

  const CHART_H = 26;
  const CHART_COL_W = (CW - 6) / 2;

  for (let i = 0; i < chartConfigs.length; i += 2) {
    pg.ensureSpace(CHART_H + 16);
    const rowY = pg.cy;

    [0, 1].forEach(col => {
      const ch = chartConfigs[i + col];
      if (!ch) return;
      const cx = ML + col * (CHART_COL_W + 6);

      doc.setFillColor(...C.panel);
      doc.roundedRect(cx, rowY, CHART_COL_W, CHART_H + 12, 1.5, 1.5, 'F');
      doc.setDrawColor(...C.rule);
      doc.setLineWidth(0.25);
      doc.roundedRect(cx, rowY, CHART_COL_W, CHART_H + 12, 1.5, 1.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.dark);
      doc.text(ch.title, cx + 6, rowY + 6);

      const plotX = cx + 12;
      const plotY = rowY + 9;
      const plotW = CHART_COL_W - 16;

      drawSparkline(doc, ch.vals, plotX, plotY, plotW, CHART_H, ch.color);
    });

    pg.cy = rowY + CHART_H + 18;
  }

  // ── AI GENERATED INSIGHT ────────────────────────────────────────────────────
  pg.sectionTitle('AI Generated Clinical Insight');

  const insight = mlResult?.insight ?? 'No insight generated. Please run a full clinical assessment first.';
  const insightLines = doc.splitTextToSize(insight, CW - 8);
  const insightH = insightLines.length * 4.5 + 10;

  pg.ensureSpace(insightH + 4);
  doc.setFillColor(...C.panel);
  doc.roundedRect(ML, pg.cy, CW, insightH, 1.5, 1.5, 'F');
  doc.setDrawColor(...C.blue);
  doc.setLineWidth(0.5);
  doc.line(ML, pg.cy, ML, pg.cy + insightH); // left accent line
  doc.setDrawColor(...C.rule);
  doc.setLineWidth(0.25);
  doc.roundedRect(ML, pg.cy, CW, insightH, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...C.dark);
  doc.text(insightLines, ML + 6, pg.cy + 7);
  pg.cy += insightH + 6;

  // Model info
  pg.ensureSpace(8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.light);
  doc.text(
    'Model: XGBoost (Statistical Data Augmentation from PhysioNet baselines)  •  LLM: Qwen 2.5 0.5B Instruct (local edge inference)',
    ML, pg.cy
  );
  pg.cy += 8;

  // ── PHYSICIAN NOTES ─────────────────────────────────────────────────────────
  pg.sectionTitle('Physician Notes & Clinical Correlation');

  pg.ensureSpace(50);
  doc.setFillColor(...C.panel);
  doc.roundedRect(ML, pg.cy, CW, 46, 1.5, 1.5, 'F');
  doc.setDrawColor(...C.rule);
  doc.setLineWidth(0.25);
  doc.roundedRect(ML, pg.cy, CW, 46, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.light);
  doc.text('Observation / Diagnosis:', ML + 4, pg.cy + 7);
  doc.text('Treatment Plan:', ML + 4, pg.cy + 26);

  doc.setDrawColor(...C.rule);
  doc.setLineWidth(0.2);
  for (let l = 0; l < 2; l++) {
    doc.setLineDashPattern([1.5, 1], 0);
    doc.line(ML + 4, pg.cy + 11 + l * 5, PW - MR - 4, pg.cy + 11 + l * 5);
  }
  for (let l = 0; l < 2; l++) {
    doc.setLineDashPattern([1.5, 1], 0);
    doc.line(ML + 4, pg.cy + 31 + l * 5, PW - MR - 4, pg.cy + 31 + l * 5);
  }
  doc.setLineDashPattern([], 0);
  pg.cy += 52;

  // Signature row
  pg.ensureSpace(22);
  const sigW = (CW - 10) / 2;
  ['Physician Signature & Stamp', 'Date & Registration No.'].forEach((lbl, i) => {
    const sx = ML + i * (sigW + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.mid);
    doc.text(lbl, sx, pg.cy);
    doc.setDrawColor(...C.dark);
    doc.setLineWidth(0.3);
    doc.line(sx, pg.cy + 14, sx + sigW, pg.cy + 14);
  });
  pg.cy += 20;

  // ── DISCLAIMER ──────────────────────────────────────────────────────────────
  pg.ensureSpace(20);
  const disc = 'DISCLAIMER: This report is an AI-assisted gait screening tool and does not constitute a medical diagnosis. All findings must be clinically correlated by a qualified and licensed medical practitioner before any treatment, referral, or prescription decision is made. The OA-Sense platform is a clinical screening and research prototype device.';
  const discLines = doc.splitTextToSize(disc, CW);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.light);
  doc.text(discLines, ML, pg.cy);

  doc.save('oa-clinical-report.pdf');
}
