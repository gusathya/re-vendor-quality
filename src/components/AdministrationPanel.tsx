"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  defaultEmail,
  defaultPassword,
  initialCompanies,
  initialPeople,
  isValidLogin,
  normalizeLogin,
  PERMISSIONS,
  SEEDED_ROOT_LOGIN,
  SPECIALIZATIONS,
  specializationLabel,
  type MesCompany,
  type MesPerson,
  type Permission,
  type SpecializationId,
} from "@/lib/mes-mock";

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function AdministrationPanel() {
  const [companies, setCompanies] = useState<MesCompany[]>(initialCompanies);
  const [people, setPeople] = useState<MesPerson[]>(initialPeople);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companySpec, setCompanySpec] = useState<SpecializationId>("casting_machining");
  const [companySaved, setCompanySaved] = useState(false);

  const [personId, setPersonId] = useState<string | null>(null);
  const [personName, setPersonName] = useState("");
  const [personLogin, setPersonLogin] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personPassword, setPersonPassword] = useState("");
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [personCompanyId, setPersonCompanyId] = useState("");
  const [personPermissions, setPersonPermissions] = useState<Permission[]>([]);
  const [personError, setPersonError] = useState<string | null>(null);

  const editingRoot = people.find((p) => p.id === personId)?.isRoot === true;

  const sortedPeople = useMemo(
    () => [...people].sort((a, b) => a.login.localeCompare(b.login)),
    [people],
  );

  function peopleCount(id: string): number {
    return people.filter((p) => p.companyId === id).length;
  }

  function resetCompanyForm() {
    setCompanyId(null);
    setCompanyName("");
    setCompanySpec("casting_machining");
  }

  function resetPersonForm() {
    setPersonId(null);
    setPersonName("");
    setPersonLogin("");
    setPersonEmail("");
    setPersonPassword("");
    setPasswordEdited(false);
    setPersonCompanyId("");
    setPersonPermissions([]);
    setPersonError(null);
  }

  function onLoginChange(value: string) {
    const login = normalizeLogin(value);
    setPersonLogin(value);
    if (!passwordEdited) {
      const normalised = login || "";
      setPersonPassword(normalised ? defaultPassword(normalised) : "");
    }
  }

  function togglePermission(permission: Permission) {
    if (editingRoot) return;
    setPersonPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }

  function saveCompany(event: FormEvent) {
    event.preventDefault();
    const name = companyName.trim();
    if (!name) return;
    if (companyId) {
      setCompanies((current) =>
        current.map((row) =>
          row.id === companyId ? { ...row, name, specialization: companySpec } : row,
        ),
      );
    } else {
      setCompanies((current) => [
        ...current,
        { id: newId("co"), name, specialization: companySpec },
      ]);
    }
    setCompanySaved(true);
    window.setTimeout(() => setCompanySaved(false), 1600);
    resetCompanyForm();
  }

  function editCompany(row: MesCompany) {
    setCompanyId(row.id);
    setCompanyName(row.name);
    setCompanySpec(row.specialization);
    setCompanySaved(false);
  }

  function savePerson(event: FormEvent) {
    event.preventDefault();
    setPersonError(null);
    const name = personName.trim();
    const login = normalizeLogin(personLogin);
    if (!name) {
      setPersonError("Could not save");
      return;
    }
    if (!isValidLogin(login)) {
      setPersonError("Login must be lowercase letters and numbers");
      return;
    }
    const existing = people.find((p) => p.id === personId);
    if (existing?.isRoot && login !== SEEDED_ROOT_LOGIN) {
      setPersonError("Could not save");
      return;
    }
    const clash = people.some((p) => p.login === login && p.id !== personId);
    if (clash) {
      setPersonError("Login already exists");
      return;
    }
    const isRoot = existing?.isRoot === true;
    if (!isRoot && personPermissions.length === 0) {
      setPersonError("Pick at least one permission");
      return;
    }
    if (!isRoot && !personCompanyId) {
      setPersonError("Company is required");
      return;
    }
    const email = personEmail.trim() || defaultEmail(login);
    const next: MesPerson = {
      id: existing?.id ?? newId("pe"),
      name,
      login: isRoot ? SEEDED_ROOT_LOGIN : login,
      email,
      companyId: isRoot ? null : personCompanyId,
      permissions: isRoot ? [...PERMISSIONS] : personPermissions,
      isRoot,
    };
    setPeople((current) => {
      if (existing) {
        return current.map((row) => (row.id === existing.id ? next : row));
      }
      return [...current, next];
    });
    resetPersonForm();
  }

  function editPerson(row: MesPerson) {
    setPersonId(row.id);
    setPersonName(row.name);
    setPersonLogin(row.login);
    setPersonEmail(row.email);
    setPersonPassword("");
    setPasswordEdited(true);
    setPersonCompanyId(row.companyId ?? "");
    setPersonPermissions([...row.permissions]);
    setPersonError(null);
  }

  function removePerson(row: MesPerson) {
    if (row.isRoot) return;
    setPeople((current) => current.filter((item) => item.id !== row.id));
    if (personId === row.id) resetPersonForm();
  }

  return (
    <div className="admin-vision">
      <div className="card admin-vision-card">
        <h2>Companies</h2>
        <form className="company-form" onSubmit={saveCompany}>
          <label>
            Name
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </label>
          <label>
            Specialization
            <select
              value={companySpec}
              onChange={(e) => setCompanySpec(e.target.value as SpecializationId)}
            >
              {SPECIALIZATIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-vision-actions">
            <button type="submit" className="btn-compact">
              {companyId ? "Save company" : "Save"}
            </button>
            {companySaved && <span className="admin-saved">Saved</span>}
          </div>
        </form>
        <div className="table-wrap admin-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Specialization</th>
                <th>People</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {companies.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{specializationLabel(row.specialization)}</td>
                  <td>{peopleCount(row.id)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn-ghost" onClick={() => editCompany(row)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card admin-vision-card">
        <h2>People</h2>
        <form onSubmit={savePerson}>
          <div className="people-form-fields">
            <label>
              Name
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Priya Nair"
                required
              />
            </label>
            <label>
              Login
              <input
                type="text"
                value={personLogin}
                onChange={(e) => onLoginChange(e.target.value)}
                placeholder="priya"
                disabled={editingRoot}
                required
              />
            </label>
            <label>
              Email
              <input
                type="text"
                value={personEmail}
                onChange={(e) => setPersonEmail(e.target.value)}
                placeholder="priya@lf"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={personPassword}
                onChange={(e) => {
                  setPersonPassword(e.target.value);
                  setPasswordEdited(true);
                }}
                placeholder={personId ? "leave blank to keep" : undefined}
                autoComplete="new-password"
              />
            </label>
          </div>
          <label>
            Company
            <select
              value={personCompanyId}
              onChange={(e) => setPersonCompanyId(e.target.value)}
              disabled={editingRoot}
            >
              <option value="">{editingRoot ? "Platform" : "Select company"}</option>
              {companies.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <div className="perm-row">
            {PERMISSIONS.map((permission) => {
              const on = personPermissions.includes(permission);
              return (
                <button
                  key={permission}
                  type="button"
                  className={on ? "perm-chip on" : "perm-chip"}
                  disabled={editingRoot}
                  onClick={() => togglePermission(permission)}
                >
                  {permission}
                </button>
              );
            })}
          </div>
          <div className="admin-vision-actions">
            <button type="submit" className="btn-compact">
              {personId ? "Save person" : "Add"}
            </button>
            {personError && <span className="admin-form-error">{personError}</span>}
          </div>
        </form>
        <div className="table-wrap admin-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Login</th>
                <th>Email</th>
                <th>Company</th>
                <th>Permissions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedPeople.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.login}</td>
                  <td>{row.email}</td>
                  <td>
                    {row.isRoot
                      ? "Platform"
                      : companies.find((c) => c.id === row.companyId)?.name ?? "—"}
                  </td>
                  <td>
                    <div className="perm-pills">
                      {row.permissions.map((permission) => (
                        <span key={permission} className="perm-pill">
                          {permission}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button type="button" className="btn-ghost" onClick={() => editPerson(row)}>
                      Edit
                    </button>
                    {!row.isRoot && (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ marginLeft: 6 }}
                        onClick={() => removePerson(row)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
