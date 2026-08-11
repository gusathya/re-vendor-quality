/**
 * scripts/synthetic-data.ts
 *
 * Populates the database with synthetic quality data for all 6 RE commodity categories.
 * Renames ./Clients → ./Vendors and creates vendor folder hierarchy.
 * Does NOT create user logins.
 *
 * Usage:  npm run seed:synthetic
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/lib/db/client';

// ── deterministic pseudo-RNG so runs are reproducible ───────────────────────
let _seed = 31337;
function rng(): number {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}
function rand(lo: number, hi: number): number { return lo + rng() * (hi - lo); }
function randInt(lo: number, hi: number): number { return Math.floor(rand(lo, hi + 0.9999)); }

/** Returns a value inside [min, max] if pass, outside if fail. */
function sampleValue(min: number, max: number, pass: boolean): number {
  const range = max - min || 0.1;
  if (pass) {
    return +rand(min + range * 0.05, max - range * 0.05).toFixed(4);
  }
  const margin = range * 0.2;
  return rng() < 0.5
    ? +rand(Math.max(0, min - margin * 3), Math.max(0, min - 0.001)).toFixed(4)
    : +rand(max + 0.001, max + margin * 3).toFixed(4);
}

// ── Parameter definition types ───────────────────────────────────────────────

interface ParamDef {
  name: string;
  unit: string;
  min: number;
  max: number;
  stationNo: number;
  stationName: string;
}

interface VendorDef {
  code: string;
  name: string;
  processName: string;
  categorySlug: string;
  partNumber: string;
  params: ParamDef[];
  passRate: number;
}

// ── Parameter templates ──────────────────────────────────────────────────────

function st(stationNo: number, stationName: string) {
  return { stationNo, stationName };
}

// SM – Sheet Metal & Fabrication
const SM_PARAMS: ParamDef[] = [
  { name: 'Material Thickness', unit: 'mm', min: 0.90, max: 1.10, ...st(1, 'Raw Material') },
  { name: 'Tensile Strength', unit: 'MPa', min: 290, max: 370, ...st(1, 'Raw Material') },
  { name: 'Yield Strength', unit: 'MPa', min: 200, max: 280, ...st(1, 'Raw Material') },
  { name: 'Elongation', unit: '%', min: 18, max: 28, ...st(1, 'Raw Material') },
  { name: 'Hardness HRB', unit: 'HRB', min: 48, max: 65, ...st(1, 'Raw Material') },
  { name: 'Bend Radius', unit: 'mm', min: 2.0, max: 4.0, ...st(2, 'Forming') },
  { name: 'Springback Angle', unit: '°', min: 0.0, max: 3.0, ...st(2, 'Forming') },
  { name: 'Flatness Deviation', unit: 'mm', min: 0.0, max: 0.5, ...st(2, 'Forming') },
  { name: 'Edge Burr Height', unit: 'mm', min: 0.0, max: 0.08, ...st(2, 'Forming') },
  { name: 'Hole Position Accuracy', unit: 'mm', min: 0.0, max: 0.15, ...st(2, 'Forming') },
  { name: 'Weld Bead Width', unit: 'mm', min: 5.0, max: 8.0, ...st(3, 'Welding') },
  { name: 'Weld Penetration', unit: 'mm', min: 1.5, max: 3.0, ...st(3, 'Welding') },
  { name: 'Weld Tensile Strength', unit: 'MPa', min: 260, max: 350, ...st(3, 'Welding') },
  { name: 'Post-Weld Distortion', unit: 'mm', min: 0.0, max: 1.0, ...st(3, 'Welding') },
  { name: 'Coating Thickness', unit: 'µm', min: 8.0, max: 15.0, ...st(4, 'Surface Treatment') },
  { name: 'Coating Adhesion', unit: 'MPa', min: 3.0, max: 8.0, ...st(4, 'Surface Treatment') },
  { name: 'Salt Spray Resistance', unit: 'h', min: 96, max: 200, ...st(4, 'Surface Treatment') },
  { name: 'Surface Roughness Ra', unit: 'µm', min: 0.8, max: 2.0, ...st(4, 'Surface Treatment') },
  { name: 'Length Tolerance', unit: 'mm', min: 0.0, max: 0.5, ...st(5, 'Final Inspection') },
  { name: 'Width Tolerance', unit: 'mm', min: 0.0, max: 0.5, ...st(5, 'Final Inspection') },
  { name: 'Component Weight', unit: 'g', min: 280, max: 340, ...st(5, 'Final Inspection') },
  { name: 'Profile Tolerance', unit: 'mm', min: 0.0, max: 0.5, ...st(5, 'Final Inspection') },
  { name: 'Visual Defect Count', unit: 'count', min: 0, max: 2, ...st(5, 'Final Inspection') },
];

// CM – Casting & Machining
const CM_PARAMS: ParamDef[] = [
  { name: 'Al Content', unit: '%', min: 88, max: 92, ...st(1, 'Chemical Composition') },
  { name: 'Si Content', unit: '%', min: 9.5, max: 11.0, ...st(1, 'Chemical Composition') },
  { name: 'Mg Content', unit: '%', min: 0.20, max: 0.45, ...st(1, 'Chemical Composition') },
  { name: 'Fe Content', unit: '%', min: 0.0, max: 0.50, ...st(1, 'Chemical Composition') },
  { name: 'Cu Content', unit: '%', min: 0.0, max: 0.10, ...st(1, 'Chemical Composition') },
  { name: 'Melt Temperature', unit: '°C', min: 665, max: 695, ...st(2, 'Melting & Degassing') },
  { name: 'Degassing Time', unit: 'min', min: 4, max: 8, ...st(2, 'Melting & Degassing') },
  { name: 'H₂ Content', unit: 'ppm', min: 0.0, max: 0.12, ...st(2, 'Melting & Degassing') },
  { name: 'Mould Temperature', unit: '°C', min: 180, max: 220, ...st(2, 'Melting & Degassing') },
  { name: 'Injection Pressure', unit: 'bar', min: 720, max: 980, ...st(3, 'Die Casting') },
  { name: 'Cooling Time', unit: 's', min: 16, max: 24, ...st(3, 'Die Casting') },
  { name: 'Cycle Time', unit: 's', min: 42, max: 58, ...st(3, 'Die Casting') },
  { name: 'Porosity Level', unit: '%', min: 0.0, max: 1.8, ...st(4, 'Post-Casting Inspection') },
  { name: 'Dimensional Accuracy', unit: 'mm', min: 0.0, max: 0.30, ...st(4, 'Post-Casting Inspection') },
  { name: 'Surface Roughness Ra', unit: 'µm', min: 1.6, max: 6.3, ...st(4, 'Post-Casting Inspection') },
  { name: 'Hardness HB', unit: 'HB', min: 85, max: 110, ...st(4, 'Post-Casting Inspection') },
  { name: 'Tensile Strength', unit: 'MPa', min: 230, max: 275, ...st(4, 'Post-Casting Inspection') },
  { name: 'Elongation', unit: '%', min: 2.5, max: 6.0, ...st(4, 'Post-Casting Inspection') },
  { name: 'Bore Diameter Accuracy', unit: 'mm', min: 0.0, max: 0.05, ...st(5, 'Machining') },
  { name: 'Machined Surface Roughness', unit: 'µm', min: 0.8, max: 1.6, ...st(5, 'Machining') },
  { name: 'Roundness', unit: 'mm', min: 0.0, max: 0.03, ...st(5, 'Machining') },
  { name: 'Perpendicularity', unit: 'mm', min: 0.0, max: 0.05, ...st(5, 'Machining') },
  { name: 'Wall Thickness', unit: 'mm', min: 2.5, max: 4.0, ...st(5, 'Machining') },
  { name: 'Draft Angle', unit: '°', min: 2.0, max: 5.0, ...st(5, 'Machining') },
];

// FM – Forging & Machining
const FM_PARAMS: ParamDef[] = [
  { name: 'Billet Temperature', unit: '°C', min: 1160, max: 1240, ...st(1, 'Billet Inspection') },
  { name: 'C Content', unit: '%', min: 0.38, max: 0.45, ...st(1, 'Billet Inspection') },
  { name: 'Mn Content', unit: '%', min: 0.60, max: 0.90, ...st(1, 'Billet Inspection') },
  { name: 'Cr Content', unit: '%', min: 0.80, max: 1.10, ...st(1, 'Billet Inspection') },
  { name: 'Billet Hardness', unit: 'HB', min: 175, max: 215, ...st(1, 'Billet Inspection') },
  { name: 'Forging Temperature', unit: '°C', min: 960, max: 1090, ...st(2, 'Hot Forging') },
  { name: 'Flash Thickness', unit: 'mm', min: 0.4, max: 0.8, ...st(2, 'Hot Forging') },
  { name: 'Draft Angle', unit: '°', min: 5.0, max: 7.0, ...st(2, 'Hot Forging') },
  { name: 'Austenitizing Temp', unit: '°C', min: 852, max: 888, ...st(3, 'Heat Treatment') },
  { name: 'Quench Rate', unit: '°C/s', min: 32, max: 58, ...st(3, 'Heat Treatment') },
  { name: 'Tempering Temp', unit: '°C', min: 182, max: 218, ...st(3, 'Heat Treatment') },
  { name: 'Tempering Hold Time', unit: 'min', min: 62, max: 118, ...st(3, 'Heat Treatment') },
  { name: 'Surface Hardness', unit: 'HRC', min: 29, max: 35, ...st(4, 'Mechanical Testing') },
  { name: 'Core Hardness', unit: 'HRC', min: 26, max: 32, ...st(4, 'Mechanical Testing') },
  { name: 'Tensile Strength', unit: 'MPa', min: 760, max: 940, ...st(4, 'Mechanical Testing') },
  { name: 'Yield Strength', unit: 'MPa', min: 610, max: 790, ...st(4, 'Mechanical Testing') },
  { name: 'Elongation', unit: '%', min: 12.5, max: 17.5, ...st(4, 'Mechanical Testing') },
  { name: 'Reduction in Area', unit: '%', min: 46, max: 64, ...st(4, 'Mechanical Testing') },
  { name: 'Surface Roughness Ra', unit: 'µm', min: 0.8, max: 1.6, ...st(5, 'Machining') },
  { name: 'Diameter Tolerance', unit: 'mm', min: 0.0, max: 0.05, ...st(5, 'Machining') },
  { name: 'Length Tolerance', unit: 'mm', min: 0.0, max: 0.50, ...st(5, 'Machining') },
  { name: 'Roundness', unit: 'mm', min: 0.0, max: 0.05, ...st(5, 'Machining') },
  { name: 'Straightness', unit: 'mm', min: 0.0, max: 0.20, ...st(5, 'Machining') },
  { name: 'Surface Defect Count', unit: 'count', min: 0, max: 1, ...st(5, 'Machining') },
];

// NM – Rubber Seals & Gaskets
const NM_RUBBER_PARAMS: ParamDef[] = [
  { name: 'Shore A Hardness', unit: 'Shore A', min: 56, max: 64, ...st(1, 'Compound Inspection') },
  { name: 'Specific Gravity', unit: 'g/cm³', min: 1.16, max: 1.24, ...st(1, 'Compound Inspection') },
  { name: 'Tensile Strength', unit: 'MPa', min: 8.5, max: 14.5, ...st(1, 'Compound Inspection') },
  { name: 'Elongation at Break', unit: '%', min: 210, max: 390, ...st(1, 'Compound Inspection') },
  { name: 'Tear Strength', unit: 'kN/m', min: 16, max: 29, ...st(1, 'Compound Inspection') },
  { name: 'Mould Temperature', unit: '°C', min: 167, max: 183, ...st(2, 'Moulding & Vulcanisation') },
  { name: 'Cure Time', unit: 'min', min: 9, max: 14, ...st(2, 'Moulding & Vulcanisation') },
  { name: 'Injection Pressure', unit: 'bar', min: 110, max: 190, ...st(2, 'Moulding & Vulcanisation') },
  { name: 'Post Cure Temperature', unit: '°C', min: 132, max: 148, ...st(3, 'Post Cure') },
  { name: 'Post Cure Time', unit: 'h', min: 2.0, max: 4.0, ...st(3, 'Post Cure') },
  { name: 'Compression Set', unit: '%', min: 0.0, max: 24, ...st(3, 'Post Cure') },
  { name: 'Temperature Resistance', unit: '°C', min: 120, max: 150, ...st(3, 'Post Cure') },
  { name: 'Wall Thickness', unit: 'mm', min: 2.0, max: 4.0, ...st(4, 'Final Inspection') },
  { name: 'Sealing Force', unit: 'N', min: 16, max: 38, ...st(4, 'Final Inspection') },
  { name: 'Inner Diameter Tolerance', unit: 'mm', min: 0.0, max: 0.30, ...st(4, 'Final Inspection') },
  { name: 'Outer Diameter Tolerance', unit: 'mm', min: 0.0, max: 0.30, ...st(4, 'Final Inspection') },
  { name: 'Lip Thickness', unit: 'mm', min: 1.6, max: 2.9, ...st(4, 'Final Inspection') },
  { name: 'Component Weight', unit: 'g', min: 15, max: 25, ...st(4, 'Final Inspection') },
  { name: 'Visual Defect Count', unit: 'count', min: 0, max: 1, ...st(4, 'Final Inspection') },
];

// NM – Injection Moulded Plastics
const NM_PLASTIC_PARAMS: ParamDef[] = [
  { name: 'Melt Flow Index', unit: 'g/10min', min: 8.5, max: 14.5, ...st(1, 'Material Inspection') },
  { name: 'Moisture Content', unit: '%', min: 0.0, max: 0.020, ...st(1, 'Material Inspection') },
  { name: 'Melt Temperature', unit: '°C', min: 232, max: 258, ...st(2, 'Injection Moulding') },
  { name: 'Mould Temperature', unit: '°C', min: 52, max: 78, ...st(2, 'Injection Moulding') },
  { name: 'Injection Pressure', unit: 'bar', min: 920, max: 1180, ...st(2, 'Injection Moulding') },
  { name: 'Injection Speed', unit: 'mm/s', min: 52, max: 98, ...st(2, 'Injection Moulding') },
  { name: 'Packing Pressure', unit: 'bar', min: 610, max: 790, ...st(2, 'Injection Moulding') },
  { name: 'Cooling Time', unit: 's', min: 22, max: 33, ...st(2, 'Injection Moulding') },
  { name: 'Cycle Time', unit: 's', min: 47, max: 68, ...st(2, 'Injection Moulding') },
  { name: 'Wall Thickness', unit: 'mm', min: 2.6, max: 3.8, ...st(3, 'Part Inspection') },
  { name: 'Shrinkage', unit: '%', min: 1.0, max: 2.0, ...st(3, 'Part Inspection') },
  { name: 'Tensile Strength', unit: 'MPa', min: 46, max: 64, ...st(3, 'Part Inspection') },
  { name: 'Flexural Strength', unit: 'MPa', min: 62, max: 88, ...st(3, 'Part Inspection') },
  { name: 'Dimensional Accuracy', unit: 'mm', min: 0.0, max: 0.30, ...st(3, 'Part Inspection') },
  { name: 'Component Weight', unit: 'g', min: 42, max: 58, ...st(3, 'Part Inspection') },
  { name: 'Gloss Level', unit: 'GU', min: 62, max: 88, ...st(3, 'Part Inspection') },
  { name: 'Flash Length', unit: 'mm', min: 0.0, max: 0.10, ...st(3, 'Part Inspection') },
  { name: 'Warpage', unit: 'mm', min: 0.0, max: 0.50, ...st(3, 'Part Inspection') },
  { name: 'Sink Mark Depth', unit: 'mm', min: 0.0, max: 0.10, ...st(3, 'Part Inspection') },
  { name: 'Surface Roughness Ra', unit: 'µm', min: 0.8, max: 1.6, ...st(3, 'Part Inspection') },
  { name: 'Visual Defect Count', unit: 'count', min: 0, max: 2, ...st(3, 'Part Inspection') },
];

// NM – Fibre Reinforced Composites
const NM_COMPOSITE_PARAMS: ParamDef[] = [
  { name: 'Fibre Volume Fraction', unit: '%', min: 55, max: 65, ...st(1, 'Prepreg Inspection') },
  { name: 'Ply Thickness', unit: 'mm', min: 0.20, max: 0.28, ...st(1, 'Prepreg Inspection') },
  { name: 'Resin Content', unit: '%', min: 35, max: 45, ...st(1, 'Prepreg Inspection') },
  { name: 'Void Content', unit: '%', min: 0.0, max: 2.0, ...st(1, 'Prepreg Inspection') },
  { name: 'Cure Temperature', unit: '°C', min: 122, max: 138, ...st(2, 'Curing') },
  { name: 'Cure Pressure', unit: 'bar', min: 5.5, max: 7.5, ...st(2, 'Curing') },
  { name: 'Cure Time', unit: 'min', min: 55, max: 90, ...st(2, 'Curing') },
  { name: 'Post Cure Temperature', unit: '°C', min: 177, max: 183, ...st(2, 'Curing') },
  { name: 'Tensile Strength', unit: 'MPa', min: 480, max: 620, ...st(3, 'Mechanical Testing') },
  { name: 'Flexural Strength', unit: 'MPa', min: 550, max: 700, ...st(3, 'Mechanical Testing') },
  { name: 'Interlaminar Shear Strength', unit: 'MPa', min: 45, max: 65, ...st(3, 'Mechanical Testing') },
  { name: 'Tensile Modulus', unit: 'GPa', min: 55, max: 75, ...st(3, 'Mechanical Testing') },
  { name: 'Impact Strength', unit: 'kJ/m²', min: 35, max: 55, ...st(3, 'Mechanical Testing') },
  { name: 'Wall Thickness', unit: 'mm', min: 2.5, max: 3.5, ...st(4, 'Dimensional & Quality') },
  { name: 'Flatness', unit: 'mm', min: 0.0, max: 1.0, ...st(4, 'Dimensional & Quality') },
  { name: 'UT Scan Pass Area', unit: '%', min: 95, max: 100, ...st(4, 'Dimensional & Quality') },
  { name: 'Surface Roughness Ra', unit: 'µm', min: 0.8, max: 3.2, ...st(4, 'Dimensional & Quality') },
  { name: 'Component Weight', unit: 'g', min: 180, max: 220, ...st(4, 'Dimensional & Quality') },
  { name: 'Dimensional Accuracy', unit: 'mm', min: 0.0, max: 0.50, ...st(4, 'Dimensional & Quality') },
  { name: 'Visual Defect Area', unit: 'cm²', min: 0.0, max: 1.0, ...st(4, 'Dimensional & Quality') },
];

// MP – Rolling Bearings
const MP_BEARING_PARAMS: ParamDef[] = [
  { name: 'Inner Bore Diameter Deviation', unit: 'mm', min: 0.0, max: 0.008, ...st(1, 'Inner Ring') },
  { name: 'Inner Ring Width Deviation', unit: 'mm', min: 0.0, max: 0.12, ...st(1, 'Inner Ring') },
  { name: 'Inner Raceway Roughness', unit: 'µm', min: 0.0, max: 0.10, ...st(1, 'Inner Ring') },
  { name: 'Inner Ring Hardness', unit: 'HRC', min: 60, max: 65, ...st(1, 'Inner Ring') },
  { name: 'Outer Diameter Deviation', unit: 'mm', min: 0.0, max: 0.011, ...st(2, 'Outer Ring') },
  { name: 'Outer Ring Width Deviation', unit: 'mm', min: 0.0, max: 0.12, ...st(2, 'Outer Ring') },
  { name: 'Outer Raceway Roughness', unit: 'µm', min: 0.0, max: 0.10, ...st(2, 'Outer Ring') },
  { name: 'Outer Ring Hardness', unit: 'HRC', min: 60, max: 65, ...st(2, 'Outer Ring') },
  { name: 'Ball Diameter Variation', unit: 'µm', min: 0.0, max: 5.0, ...st(3, 'Rolling Elements') },
  { name: 'Ball Roundness', unit: 'µm', min: 0.0, max: 1.0, ...st(3, 'Rolling Elements') },
  { name: 'Ball Surface Roughness', unit: 'µm', min: 0.0, max: 0.06, ...st(3, 'Rolling Elements') },
  { name: 'Ball Hardness', unit: 'HRC', min: 62, max: 66, ...st(3, 'Rolling Elements') },
  { name: 'Radial Play', unit: 'µm', min: 7, max: 15, ...st(4, 'Assembly') },
  { name: 'Axial Play', unit: 'µm', min: 12, max: 28, ...st(4, 'Assembly') },
  { name: 'Starting Torque', unit: 'N·mm', min: 0.0, max: 28, ...st(4, 'Assembly') },
  { name: 'Cage Gap', unit: 'mm', min: 0.30, max: 0.80, ...st(4, 'Assembly') },
  { name: 'Grease Fill', unit: '%', min: 30, max: 40, ...st(4, 'Assembly') },
  { name: 'Noise Level', unit: 'dB(A)', min: 0.0, max: 34, ...st(5, 'Performance Test') },
  { name: 'Running Torque', unit: 'N·mm', min: 0.0, max: 19, ...st(5, 'Performance Test') },
  { name: 'Temperature Rise', unit: '°C', min: 0.0, max: 28, ...st(5, 'Performance Test') },
  { name: 'Vibration', unit: 'mm/s', min: 0.0, max: 3.8, ...st(5, 'Performance Test') },
];

// MP – Clutch Assemblies
const MP_CLUTCH_PARAMS: ParamDef[] = [
  { name: 'Friction Coefficient (Cold)', unit: '-', min: 0.30, max: 0.45, ...st(1, 'Friction Material') },
  { name: 'Friction Coefficient (Hot)', unit: '-', min: 0.28, max: 0.42, ...st(1, 'Friction Material') },
  { name: 'Pad Thickness', unit: 'mm', min: 4.0, max: 6.0, ...st(1, 'Friction Material') },
  { name: 'Compressibility', unit: '%', min: 0.5, max: 2.5, ...st(1, 'Friction Material') },
  { name: 'Hardness HRL', unit: 'HRL', min: 90, max: 115, ...st(1, 'Friction Material') },
  { name: 'Spring Free Length', unit: 'mm', min: 28.0, max: 32.0, ...st(2, 'Spring Inspection') },
  { name: 'Spring Load at Set Length', unit: 'N', min: 850, max: 1050, ...st(2, 'Spring Inspection') },
  { name: 'Spring Fatigue Life', unit: 'k-cycles', min: 100, max: 500, ...st(2, 'Spring Inspection') },
  { name: 'Engagement Force', unit: 'N', min: 80, max: 130, ...st(3, 'Assembly') },
  { name: 'Disengagement Force', unit: 'N', min: 60, max: 100, ...st(3, 'Assembly') },
  { name: 'Running Clearance', unit: 'mm', min: 0.20, max: 0.50, ...st(3, 'Assembly') },
  { name: 'Axial Runout', unit: 'mm', min: 0.0, max: 0.20, ...st(3, 'Assembly') },
  { name: 'Radial Runout', unit: 'mm', min: 0.0, max: 0.15, ...st(3, 'Assembly') },
  { name: 'OD Tolerance', unit: 'mm', min: 0.0, max: 0.10, ...st(3, 'Assembly') },
  { name: 'Bore Tolerance', unit: 'mm', min: 0.0, max: 0.05, ...st(3, 'Assembly') },
  { name: 'Torque Capacity', unit: 'N·m', min: 18, max: 26, ...st(4, 'Performance Test') },
  { name: 'Slip RPM', unit: 'rpm', min: 1800, max: 2200, ...st(4, 'Performance Test') },
  { name: 'Max Surface Temp', unit: '°C', min: 0, max: 280, ...st(4, 'Performance Test') },
  { name: 'Vibration Level', unit: 'mm/s', min: 0.0, max: 4.0, ...st(4, 'Performance Test') },
  { name: 'Noise Level', unit: 'dB(A)', min: 0.0, max: 45, ...st(4, 'Performance Test') },
  { name: 'Assembly Weight', unit: 'g', min: 380, max: 420, ...st(5, 'Final Inspection') },
  { name: 'Spline Fit', unit: 'µm', min: 5, max: 25, ...st(5, 'Final Inspection') },
];

// EP – Switches & Controls
const EP_SWITCH_PARAMS: ParamDef[] = [
  { name: 'Contact Resistance', unit: 'mΩ', min: 0.0, max: 48, ...st(1, 'Component Inspection') },
  { name: 'Insulation Resistance', unit: 'MΩ', min: 100, max: 10000, ...st(1, 'Component Inspection') },
  { name: 'Wire Gauge', unit: 'AWG', min: 18, max: 22, ...st(1, 'Component Inspection') },
  { name: 'Terminal Plating Thickness', unit: 'µm', min: 2.2, max: 5.8, ...st(1, 'Component Inspection') },
  { name: 'Actuating Force', unit: 'N', min: 2.2, max: 7.8, ...st(2, 'Assembly') },
  { name: 'Over-Travel', unit: 'mm', min: 0.22, max: 0.78, ...st(2, 'Assembly') },
  { name: 'Differential Travel', unit: 'mm', min: 0.12, max: 0.38, ...st(2, 'Assembly') },
  { name: 'Crimping Pull-out Strength', unit: 'N', min: 42, max: 78, ...st(2, 'Assembly') },
  { name: 'Strip Length', unit: 'mm', min: 8.5, max: 11.5, ...st(2, 'Assembly') },
  { name: 'Crimp Height', unit: 'mm', min: 1.52, max: 1.98, ...st(2, 'Assembly') },
  { name: 'Contact Spring Force', unit: 'g', min: 22, max: 58, ...st(2, 'Assembly') },
  { name: 'Voltage Drop', unit: 'V', min: 0.0, max: 0.10, ...st(3, 'Electrical Testing') },
  { name: 'Contact Bounce Time', unit: 'ms', min: 0.0, max: 4.8, ...st(3, 'Electrical Testing') },
  { name: 'Dielectric Strength', unit: 'kV', min: 2.2, max: 4.8, ...st(3, 'Electrical Testing') },
  { name: 'Operating Voltage', unit: 'V', min: 11.5, max: 14.5, ...st(3, 'Electrical Testing') },
  { name: 'Connector Mating Force', unit: 'N', min: 8, max: 25, ...st(3, 'Electrical Testing') },
  { name: 'Salt Spray Resistance', unit: 'h', min: 98, max: 500, ...st(4, 'Environmental Testing') },
  { name: 'Vibration Resistance', unit: 'g', min: 10.5, max: 19.5, ...st(4, 'Environmental Testing') },
  { name: 'IP Seal Class', unit: '-', min: 54, max: 68, ...st(4, 'Environmental Testing') },
  { name: 'Temperature Cycling', unit: 'cycles', min: 100, max: 200, ...st(4, 'Environmental Testing') },
  { name: 'Component Weight', unit: 'g', min: 18, max: 28, ...st(5, 'Final Inspection') },
];

// EP – Lighting & Lamps
const EP_LIGHTING_PARAMS: ParamDef[] = [
  { name: 'Forward Voltage', unit: 'V', min: 2.8, max: 3.4, ...st(1, 'LED Characterisation') },
  { name: 'Forward Current', unit: 'mA', min: 18, max: 22, ...st(1, 'LED Characterisation') },
  { name: 'Luminous Intensity', unit: 'cd', min: 800, max: 1200, ...st(1, 'LED Characterisation') },
  { name: 'Color Temperature', unit: 'K', min: 5800, max: 6400, ...st(1, 'LED Characterisation') },
  { name: 'CRI', unit: '-', min: 70, max: 100, ...st(1, 'LED Characterisation') },
  { name: 'Beam Angle', unit: '°', min: 25, max: 35, ...st(2, 'Optical Testing') },
  { name: 'Hot Spot Width', unit: '°', min: 8, max: 14, ...st(2, 'Optical Testing') },
  { name: 'Lens Transmission', unit: '%', min: 88, max: 98, ...st(2, 'Optical Testing') },
  { name: 'Glare Rating', unit: '-', min: 0.0, max: 1.5, ...st(2, 'Optical Testing') },
  { name: 'Power Consumption', unit: 'W', min: 18.5, max: 21.5, ...st(3, 'Electrical Testing') },
  { name: 'Power Factor', unit: '-', min: 0.90, max: 1.00, ...st(3, 'Electrical Testing') },
  { name: 'Total Harmonic Distortion', unit: '%', min: 0.0, max: 5.0, ...st(3, 'Electrical Testing') },
  { name: 'Thermal Resistance', unit: '°C/W', min: 0.0, max: 5.0, ...st(4, 'Environmental Testing') },
  { name: 'Vibration Resistance', unit: 'g', min: 8, max: 15, ...st(4, 'Environmental Testing') },
  { name: 'Salt Spray Test', unit: 'h', min: 96, max: 240, ...st(4, 'Environmental Testing') },
  { name: 'IP Rating', unit: '-', min: 65, max: 68, ...st(4, 'Environmental Testing') },
  { name: 'Housing Seal Integrity', unit: 'mm', min: 0.0, max: 0.5, ...st(5, 'Final Inspection') },
  { name: 'Mounting Force', unit: 'N', min: 15, max: 30, ...st(5, 'Final Inspection') },
  { name: 'Total Assembly Weight', unit: 'g', min: 280, max: 350, ...st(5, 'Final Inspection') },
  { name: 'Visual Defect Count', unit: 'count', min: 0, max: 1, ...st(5, 'Final Inspection') },
];

// EP – Instrumentation
const EP_INSTRUMENT_PARAMS: ParamDef[] = [
  { name: 'Sensitivity', unit: 'mV/g', min: 95, max: 105, ...st(1, 'Sensor Calibration') },
  { name: 'Zero Error', unit: 'rpm', min: 0, max: 10, ...st(1, 'Sensor Calibration') },
  { name: 'Linearity Error', unit: '%', min: 0.0, max: 1.0, ...st(1, 'Sensor Calibration') },
  { name: 'Backlight Intensity', unit: 'cd/m²', min: 150, max: 250, ...st(2, 'Display Test') },
  { name: 'Viewing Angle', unit: '°', min: 100, max: 160, ...st(2, 'Display Test') },
  { name: 'Response Time', unit: 'ms', min: 0.0, max: 15, ...st(2, 'Display Test') },
  { name: 'Speed Accuracy', unit: 'rpm', min: 0.0, max: 20, ...st(3, 'Calibration Check') },
  { name: 'Fuel Level Accuracy', unit: '%', min: 0.0, max: 3.0, ...st(3, 'Calibration Check') },
  { name: 'Temp Gauge Accuracy', unit: '°C', min: 0.0, max: 5.0, ...st(3, 'Calibration Check') },
  { name: 'Odometer Accuracy', unit: '%', min: 0.0, max: 1.5, ...st(3, 'Calibration Check') },
  { name: 'Shock Resistance', unit: 'g', min: 30, max: 50, ...st(4, 'Environmental Testing') },
  { name: 'IP Rating', unit: '-', min: 54, max: 68, ...st(4, 'Environmental Testing') },
  { name: 'EMI Susceptibility', unit: 'V/m', min: 0.0, max: 10.0, ...st(4, 'Environmental Testing') },
  { name: 'Supply Voltage', unit: 'V', min: 11.5, max: 14.5, ...st(5, 'Final Electrical Check') },
  { name: 'Current Draw', unit: 'mA', min: 60, max: 120, ...st(5, 'Final Electrical Check') },
  { name: 'Connector Force', unit: 'N', min: 10, max: 25, ...st(5, 'Final Electrical Check') },
  { name: 'Weight', unit: 'g', min: 180, max: 240, ...st(5, 'Final Electrical Check') },
  { name: 'Visual Defect Count', unit: 'count', min: 0, max: 1, ...st(5, 'Final Electrical Check') },
];

// ── Vendor definitions ───────────────────────────────────────────────────────

// Load dates spread across last 4 months; array index = load sequence (0=oldest)
const LOAD_DATES = [
  '2026-05-14T08:30:00',
  '2026-06-12T09:15:00',
  '2026-07-11T08:45:00',
  '2026-08-06T09:00:00',
];
// push_status per load: 0=approved, 1=approved, 2=pending, 3=draft
// (oldest batches were reviewed; most recent pending/draft)
const LOAD_STATUSES = ['approved', 'approved', 'pending', 'draft'] as const;
const REVIEWED_DATES = ['2026-05-19', '2026-06-17', null, null];

const VENDORS: VendorDef[] = [
  // ── Sheet Metal & Fabrication ─────────────────────────────────────────────
  {
    code: 'SM-001', name: 'Precision Stampings Pvt Ltd',
    processName: 'Progressive Die Stampings & Sheet Metal Components',
    categorySlug: 'sheet-metal-fabrication', partNumber: 'RE-SM-4471',
    params: SM_PARAMS, passRate: 0.93,
  },
  {
    code: 'SM-002', name: 'Apex Metal Fabricators',
    processName: 'Welded Sheet Metal Assemblies & Sub-Frames',
    categorySlug: 'sheet-metal-fabrication', partNumber: 'RE-SM-3882',
    params: SM_PARAMS, passRate: 0.87,
  },
  {
    code: 'SM-003', name: 'RajShree Auto Components',
    processName: 'Sheet Metal Stampings & Body Panels',
    categorySlug: 'sheet-metal-fabrication', partNumber: 'RE-SM-2219',
    params: SM_PARAMS, passRate: 0.78,
  },
  {
    code: 'SM-004', name: 'Lakshmi Metalforms Pvt Ltd',
    processName: 'Deep-Drawn Sheet Metal Parts',
    categorySlug: 'sheet-metal-fabrication', partNumber: 'RE-SM-5506',
    params: SM_PARAMS, passRate: 0.95,
  },

  // ── Casting & Machining ───────────────────────────────────────────────────
  {
    code: 'CM-001', name: 'Bharat Die Castings Ltd',
    processName: 'Aluminium High-Pressure Die Casting',
    categorySlug: 'casting-machining', partNumber: 'RE-CM-1101',
    params: CM_PARAMS, passRate: 0.91,
  },
  {
    code: 'CM-002', name: 'Precision Die Cast India',
    processName: 'Aluminium & Zinc Die Casting Components',
    categorySlug: 'casting-machining', partNumber: 'RE-CM-2204',
    params: CM_PARAMS, passRate: 0.86,
  },
  {
    code: 'CM-003', name: 'Indo Precision Foundry',
    processName: 'Sand Casting & CNC Machining',
    categorySlug: 'casting-machining', partNumber: 'RE-CM-3307',
    params: CM_PARAMS, passRate: 0.80,
  },
  {
    code: 'CM-004', name: 'Supreme Alloy Castings',
    processName: 'Gravity Die Casting – Engine Components',
    categorySlug: 'casting-machining', partNumber: 'RE-CM-4410',
    params: CM_PARAMS, passRate: 0.94,
  },

  // ── Forging & Machining ───────────────────────────────────────────────────
  {
    code: 'FM-001', name: 'Aggarwal Forgings Ltd',
    processName: 'Closed Die Steel Forgings – Drive Components',
    categorySlug: 'forging-machining', partNumber: 'RE-FM-0881',
    params: FM_PARAMS, passRate: 0.89,
  },
  {
    code: 'FM-002', name: 'Kalyani Forge Works',
    processName: 'Aluminium Forgings – Wheel & Chassis',
    categorySlug: 'forging-machining', partNumber: 'RE-FM-0962',
    params: FM_PARAMS, passRate: 0.94,
  },
  {
    code: 'FM-003', name: 'National Forgings India',
    processName: 'Drop Forgings – Transmission & Gearbox',
    categorySlug: 'forging-machining', partNumber: 'RE-FM-1143',
    params: FM_PARAMS, passRate: 0.76,
  },
  {
    code: 'FM-004', name: 'JSW Precision Components',
    processName: 'Precision Forgings – Engine & Drivetrain',
    categorySlug: 'forging-machining', partNumber: 'RE-FM-1224',
    params: FM_PARAMS, passRate: 0.92,
  },

  // ── Non-Metallic ──────────────────────────────────────────────────────────
  {
    code: 'NM-001', name: 'SealTech Polymers',
    processName: 'Rubber Oil Seals & Gaskets',
    categorySlug: 'non-metallic', partNumber: 'RE-NM-7711',
    params: NM_RUBBER_PARAMS, passRate: 0.91,
  },
  {
    code: 'NM-002', name: 'PlastiForm India Pvt Ltd',
    processName: 'Injection Moulded Plastic Components',
    categorySlug: 'non-metallic', partNumber: 'RE-NM-7812',
    params: NM_PLASTIC_PARAMS, passRate: 0.87,
  },
  {
    code: 'NM-003', name: 'PolyRub Industries',
    processName: 'Engineered Rubber & Polymer Components',
    categorySlug: 'non-metallic', partNumber: 'RE-NM-7913',
    params: NM_RUBBER_PARAMS, passRate: 0.82,
  },
  {
    code: 'NM-004', name: 'CompositeTech Pvt Ltd',
    processName: 'Fibre Reinforced Plastic Components',
    categorySlug: 'non-metallic', partNumber: 'RE-NM-8014',
    params: NM_COMPOSITE_PARAMS, passRate: 0.85,
  },

  // ── Mechanical Proprietary ────────────────────────────────────────────────
  {
    code: 'MP-001', name: 'Bimetal Bearings Ltd',
    processName: 'Ball & Roller Bearings – Engine & Transmission',
    categorySlug: 'mechanical-proprietary', partNumber: 'RE-MP-3301',
    params: MP_BEARING_PARAMS, passRate: 0.95,
  },
  {
    code: 'MP-002', name: 'Clutch Auto Ltd',
    processName: 'Dry Single-Plate Clutch Assemblies',
    categorySlug: 'mechanical-proprietary', partNumber: 'RE-MP-3402',
    params: MP_CLUTCH_PARAMS, passRate: 0.89,
  },
  {
    code: 'MP-003', name: 'Rane Precision Parts',
    processName: 'Precision Mechanical Sub-Assemblies',
    categorySlug: 'mechanical-proprietary', partNumber: 'RE-MP-3503',
    params: MP_BEARING_PARAMS, passRate: 0.92,
  },
  {
    code: 'MP-004', name: 'Jyoti Fuel Systems',
    processName: 'Fuel Delivery & Carburetion Components',
    categorySlug: 'mechanical-proprietary', partNumber: 'RE-MP-3604',
    params: MP_CLUTCH_PARAMS, passRate: 0.86,
  },

  // ── Electrical Proprietary ────────────────────────────────────────────────
  {
    code: 'EP-001', name: 'Minda Switches Ltd',
    processName: 'Electrical Switches & Control Modules',
    categorySlug: 'electrical-proprietary', partNumber: 'RE-EP-5501',
    params: EP_SWITCH_PARAMS, passRate: 0.91,
  },
  {
    code: 'EP-002', name: 'Lumax Lighting Pvt Ltd',
    processName: 'Headlamps, Indicators & Lighting Assemblies',
    categorySlug: 'electrical-proprietary', partNumber: 'RE-EP-5602',
    params: EP_LIGHTING_PARAMS, passRate: 0.88,
  },
  {
    code: 'EP-003', name: 'Pricol Instruments Ltd',
    processName: 'Speedometers, Tachometers & Instrument Clusters',
    categorySlug: 'electrical-proprietary', partNumber: 'RE-EP-5703',
    params: EP_INSTRUMENT_PARAMS, passRate: 0.90,
  },
  {
    code: 'EP-004', name: 'Fiem Industries Ltd',
    processName: 'Signal Lighting & Electrical Accessories',
    categorySlug: 'electrical-proprietary', partNumber: 'RE-EP-5804',
    params: EP_SWITCH_PARAMS, passRate: 0.93,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSopText(v: VendorDef): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    `STANDARD OPERATING PROCEDURE (SOP) — SYNTHETIC`,
    `Vendor Code : ${v.code}`,
    `Vendor Name : ${v.name}`,
    `Process     : ${v.processName}`,
    `Part Number : ${v.partNumber}`,
    `Generated   : ${new Date().toISOString().slice(0, 10)}`,
    `Status      : ACTIVE`,
    '═══════════════════════════════════════════════════════════════',
    '',
    'PARAMETER SPECIFICATIONS',
    '─────────────────────────────────────────────────────────────',
  ];

  let lastStation = -1;
  v.params.forEach((p, i) => {
    if (p.stationNo !== lastStation) {
      lines.push('');
      lines.push(`  Station ${p.stationNo} — ${p.stationName}`);
      lines.push('  ' + '─'.repeat(50));
      lastStation = p.stationNo;
    }
    const range = `${p.min} – ${p.max} ${p.unit}`;
    lines.push(`  ${String(i + 1).padStart(2, '0')}. ${p.name.padEnd(32)} ${range}`);
  });

  lines.push('');
  lines.push('[This is a synthetic file generated for demonstration purposes.]');
  return lines.join('\n');
}

function generateLoadText(v: VendorDef, loadNum: string, batchDate: string): string {
  return [
    '═══════════════════════════════════════════════════════════════',
    `LOAD REPORT — SYNTHETIC`,
    `Vendor Code : ${v.code}`,
    `Vendor Name : ${v.name}`,
    `Load Number : ${loadNum}`,
    `Part Number : ${v.partNumber}`,
    `Batch Date  : ${batchDate.slice(0, 10)}`,
    '═══════════════════════════════════════════════════════════════',
    '[This is a synthetic file generated for demonstration purposes.]',
  ].join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getDb();
  const VENDORS_DIR = resolve('./Vendors');

  // 1. Rename Clients/ → Vendors/
  const clientsDir = resolve('./Clients');
  if (existsSync(clientsDir) && !existsSync(VENDORS_DIR)) {
    console.log('Renaming Clients/ → Vendors/');
    renameSync(clientsDir, VENDORS_DIR);
    // Update existing file paths stored in the DB
    db.exec(`UPDATE load_reports SET file_path = REPLACE(file_path, 'Clients', 'Vendors') WHERE file_path LIKE '%Clients%'`);
    db.exec(`UPDATE sop_documents SET file_path = REPLACE(file_path, 'Clients', 'Vendors') WHERE file_path LIKE '%Clients%'`);
    console.log('Updated existing DB file paths.');
  } else {
    mkdirSync(VENDORS_DIR, { recursive: true });
  }

  // 2. Look up admin user for uploaded_by FK
  const adminUser = db
    .prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`)
    .get() as { id: string } | undefined;

  if (!adminUser) {
    console.error('No admin user found — run "npm run seed" first to create base users.');
    process.exit(1);
  }
  const adminId = adminUser.id;

  // 3. Load category lookup
  type CatRow = { id: string; slug: string };
  const cats = db.prepare(`SELECT id, slug FROM vendor_categories`).all() as CatRow[];
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));

  // 4. Prepare insert statements
  const insertVendor = db.prepare(`
    INSERT OR IGNORE INTO vendors (id, name, process_name, category_id, vendor_code, created_at)
    VALUES (@id, @name, @processName, @categoryId, @vendorCode, datetime('now'))
  `);
  const updateVendorMeta = db.prepare(`
    UPDATE vendors SET category_id = @categoryId, vendor_code = @vendorCode WHERE id = @id
  `);
  const insertSopDoc = db.prepare(`
    INSERT OR IGNORE INTO sop_documents (id, vendor_id, file_path, status, uploaded_by, uploaded_at, activated_at)
    VALUES (@id, @vendorId, @filePath, 'active', @uploadedBy, @uploadedAt, @uploadedAt)
  `);
  const insertSopParam = db.prepare(`
    INSERT INTO sop_parameters
      (id, sop_document_id, station_group_key, sr_no, station_no, process, characteristic, min_value, max_value, unit, status, raw_control_limit, raw_spec_limit)
    VALUES
      (@id, @sopDocId, @stationKey, @srNo, @stationNo, @process, @characteristic, @minValue, @maxValue, @unit, 'parsed', @rawLimit, @rawLimit)
  `);
  const insertLoadReport = db.prepare(`
    INSERT OR IGNORE INTO load_reports
      (id, vendor_id, load_number, file_path, part_number, uploaded_by, uploaded_at, push_status, pushed_at, reviewed_at)
    VALUES
      (@id, @vendorId, @loadNumber, @filePath, @partNumber, @uploadedBy, @uploadedAt, @pushStatus, @pushedAt, @reviewedAt)
  `);
  const insertReading = db.prepare(`
    INSERT INTO load_readings
      (id, load_report_id, sop_parameter_id, station_no, station_name, parameter_name, value, score)
    VALUES
      (@id, @loadReportId, @sopParamId, @stationNo, @stationName, @paramName, @value, @score)
  `);

  const seedAll = db.transaction(() => {
    let vendorCount = 0;
    let loadCount = 0;
    let readingCount = 0;

    for (const v of VENDORS) {
      // -- Create or update vendor
      const existingVendor = db
        .prepare(`SELECT id FROM vendors WHERE name = ?`)
        .get(v.name) as { id: string } | undefined;

      let vendorId: string;
      if (existingVendor) {
        vendorId = existingVendor.id;
        updateVendorMeta.run({
          id: vendorId,
          categoryId: catBySlug.get(v.categorySlug) ?? null,
          vendorCode: v.code,
        });
        console.log(`  Vendor exists — updated: ${v.code} ${v.name}`);
      } else {
        vendorId = randomUUID();
        insertVendor.run({
          id: vendorId,
          name: v.name,
          processName: v.processName,
          categoryId: catBySlug.get(v.categorySlug) ?? null,
          vendorCode: v.code,
        });
        vendorCount++;
        console.log(`  Created vendor: ${v.code} ${v.name}`);
      }

      // -- Check if this vendor already has an active SOP
      const existingSop = db
        .prepare(`SELECT id FROM sop_documents WHERE vendor_id = ? AND status = 'active' LIMIT 1`)
        .get(vendorId) as { id: string } | undefined;

      if (existingSop) {
        console.log(`    SOP already exists for ${v.code} — skipping SOP + loads`);
        continue;
      }

      // -- Create vendor folder
      const vendorDir = join(VENDORS_DIR, v.code);
      mkdirSync(join(vendorDir, 'Uploads'), { recursive: true });

      // -- Write SOP file
      const sopPath = join(vendorDir, `SOP_${v.code}_v1.txt`);
      writeFileSync(sopPath, generateSopText(v));

      // -- Insert SOP document
      const sopId = randomUUID();
      const sopDate = '2026-04-01T10:00:00';
      insertSopDoc.run({ id: sopId, vendorId, filePath: sopPath, uploadedBy: adminId, uploadedAt: sopDate });

      // -- Insert SOP parameters and collect IDs (indexed by param position)
      const paramIds: string[] = [];
      v.params.forEach((p, i) => {
        const paramId = randomUUID();
        const stationKey = `ST${String(p.stationNo).padStart(2, '0')}-${p.stationName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        insertSopParam.run({
          id: paramId,
          sopDocId: sopId,
          stationKey,
          srNo: String(i + 1),
          stationNo: String(p.stationNo),
          process: v.processName,
          characteristic: p.name,
          minValue: p.min,
          maxValue: p.max,
          unit: p.unit,
          rawLimit: `${p.min} – ${p.max}`,
        });
        paramIds.push(paramId);
      });

      // -- Create 4 load reports
      for (let l = 0; l < 4; l++) {
        const loadNum = `${v.code}-L${String(l + 1).padStart(3, '0')}`;
        const uploadedAt = LOAD_DATES[l];
        const status = LOAD_STATUSES[l];
        const pushedAt = status !== 'draft' ? LOAD_DATES[l].slice(0, 10) + 'T14:00:00' : null;
        const reviewedAt = REVIEWED_DATES[l] ? REVIEWED_DATES[l] + 'T11:00:00' : null;

        const loadPath = join(vendorDir, 'Uploads', `${loadNum}.txt`);
        writeFileSync(loadPath, generateLoadText(v, loadNum, uploadedAt));

        const loadId = randomUUID();
        insertLoadReport.run({
          id: loadId,
          vendorId,
          loadNumber: loadNum,
          filePath: loadPath,
          partNumber: v.partNumber,
          uploadedBy: adminId,
          uploadedAt,
          pushStatus: status,
          pushedAt,
          reviewedAt,
        });
        loadCount++;

        // -- Inject per-load pass rate variance (±5 pp across loads)
        const loadPassRate = Math.max(0.55, Math.min(0.99, v.passRate + rand(-0.05, 0.05)));

        // -- Insert one reading per SOP parameter
        v.params.forEach((p, pi) => {
          const passes = rng() < loadPassRate;
          const value = sampleValue(p.min, p.max, passes);
          insertReading.run({
            id: randomUUID(),
            loadReportId: loadId,
            sopParamId: paramIds[pi],
            stationNo: p.stationNo,
            stationName: p.stationName,
            paramName: p.name,
            value,
            score: passes ? 'pass' : 'fail',
          });
          readingCount++;
        });
      }
    }

    return { vendorCount, loadCount, readingCount };
  });

  console.log('\nSeeding synthetic data...');
  const { vendorCount, loadCount, readingCount } = seedAll();

  console.log('\n✓ Done.');
  console.log(`  Vendors created : ${vendorCount}`);
  console.log(`  Load reports    : ${loadCount}`);
  console.log(`  Readings        : ${readingCount}`);
  console.log(`  Files written to: ${VENDORS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
