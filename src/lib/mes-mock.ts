export const SPECIALIZATIONS = [
  { id: "casting_machining", label: "Casting & Machining" },
  { id: "electrical_proprietary", label: "Electrical Proprietary" },
  { id: "forging_machining", label: "Forging & Machining" },
  { id: "mechanical_proprietary", label: "Mechanical Proprietary" },
  { id: "non_metallic", label: "Non-Metallic" },
  { id: "sheet_metal_fabrication", label: "Sheet Metal & Fabrication" },
] as const;

export type SpecializationId = (typeof SPECIALIZATIONS)[number]["id"];

export const PERMISSIONS = [
  "Production",
  "Planning",
  "Purchase",
  "Inventory",
  "Dispatch",
  "Reports",
  "Administration",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface MesCompany {
  id: string;
  name: string;
  specialization: SpecializationId;
}

export interface MesPerson {
  id: string;
  name: string;
  login: string;
  email: string;
  companyId: string | null;
  permissions: Permission[];
  isRoot: boolean;
}

export const EMAIL_DOMAIN = "@lf";
export const SEEDED_ROOT_LOGIN = "admin";

export function specializationLabel(id: SpecializationId): string {
  return SPECIALIZATIONS.find((item) => item.id === id)?.label ?? id;
}

export function normalizeLogin(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const stripped = trimmed.endsWith(EMAIL_DOMAIN)
    ? trimmed.slice(0, -EMAIL_DOMAIN.length)
    : trimmed;
  return stripped;
}

export function isValidLogin(login: string): boolean {
  return /^[a-z0-9]+$/.test(login);
}

export function defaultEmail(login: string): string {
  return `${login}${EMAIL_DOMAIN}`;
}

export function defaultPassword(login: string): string {
  return `${login}123`;
}

export function initialCompanies(): MesCompany[] {
  return [
    {
      id: "co-platers",
      name: "Unique Platers",
      specialization: "casting_machining",
    },
    {
      id: "co-sheet",
      name: "Apex Sheet Works",
      specialization: "sheet_metal_fabrication",
    },
  ];
}

export function initialPeople(): MesPerson[] {
  return [
    {
      id: "pe-root",
      name: "Admin",
      login: SEEDED_ROOT_LOGIN,
      email: "admin@lf",
      companyId: null,
      permissions: [...PERMISSIONS],
      isRoot: true,
    },
    {
      id: "pe-priya",
      name: "Priya Nair",
      login: "priya",
      email: "priya@lf",
      companyId: "co-platers",
      permissions: ["Production", "Planning"],
      isRoot: false,
    },
    {
      id: "pe-rahul",
      name: "Rahul Desai",
      login: "rahul",
      email: "rahul@lf",
      companyId: "co-sheet",
      permissions: ["Purchase", "Inventory", "Dispatch", "Administration"],
      isRoot: false,
    },
  ];
}
