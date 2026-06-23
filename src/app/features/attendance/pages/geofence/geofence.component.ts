import {
  Component, ChangeDetectionStrategy, signal, OnInit, OnDestroy, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OfficeService } from '../../../../core/services/office.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { Office, OfficeRequest } from '../../../../core/models/office.model';
import { Department, ClockInPolicyRequest } from '../../../../core/models/department.model';
import { ClockInMethod } from '../../../../core/models/user.model';

interface OfficeFormState {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geoRadiusM: number;
}

/** Per-department local edit buffer for the clock-in-policy form */
interface DeptPolicyDraft {
  allowedClockInMethods: Record<ClockInMethod, boolean>;
  requiredOfficeId: string;
}

const CLOCK_IN_METHODS: ClockInMethod[] = ['web', 'mobile', 'biometric', 'face'];

@Component({
  selector: 'app-geofence',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './geofence.component.html',
  styleUrl: './geofence.component.scss',
})
export class GeofenceComponent implements OnInit, OnDestroy {

  private readonly officeSvc = inject(OfficeService);
  private readonly deptSvc   = inject(DepartmentService);

  readonly clockInMethods = CLOCK_IN_METHODS;

  // ── Offices ──────────────────────────────────────────────────────────────
  readonly offices = signal<Office[]>([]);
  readonly loadingOffices = signal(false);
  readonly officesError = signal<string | null>(null);

  showAddForm = signal(false);
  editId = signal<string | null>(null);
  saving = signal(false);
  saveError = signal<string | null>(null);

  newZone = signal<OfficeFormState>({ name: '', address: '', latitude: 0, longitude: 0, geoRadiusM: 100 });

  // Geolocation state
  locating = signal(false);
  locError = signal<string | null>(null);
  locGranted = signal(false);

  // ── Departments / clock-in policy ───────────────────────────────────────
  readonly departments = signal<Department[]>([]);
  readonly loadingDepartments = signal(false);
  readonly departmentsError = signal<string | null>(null);
  readonly policyDrafts = signal<Record<string, DeptPolicyDraft>>({});
  readonly savingPolicyId = signal<string | null>(null);
  readonly policyError = signal<string | null>(null);

  private _watchId: number | null = null;

  ngOnInit() {
    this.loadOffices();
    this.loadDepartments();
  }

  // ── Offices ──────────────────────────────────────────────────────────────

  loadOffices() {
    this.loadingOffices.set(true);
    this.officesError.set(null);
    this.officeSvc.getAll().subscribe({
      next: (res) => {
        this.offices.set(res.data ?? []);
        this.loadingOffices.set(false);
      },
      error: () => {
        this.officesError.set('Could not load offices.');
        this.loadingOffices.set(false);
      },
    });
  }

  /** Ask browser for current position to fill the form */
  useMyLocation() {
    if (!navigator.geolocation) {
      this.locError.set('Geolocation is not supported by this browser.');
      return;
    }
    this.locating.set(true);
    this.locError.set(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.newZone.update(z => ({
          ...z,
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
        this.locating.set(false);
        this.locGranted.set(true);
      },
      (err) => {
        this.locating.set(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:    this.locError.set('Location access denied. Please allow permission and try again.'); break;
          case err.POSITION_UNAVAILABLE: this.locError.set('Location unavailable. Try entering coordinates manually.'); break;
          default:                       this.locError.set('Could not get location. Please enter coordinates manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  saveZone() {
    const z = this.newZone();
    if (!z.name.trim()) return;

    const payload: OfficeRequest = {
      name: z.name.trim(),
      address: z.address.trim() || undefined,
      latitude: Number(z.latitude) || 0,
      longitude: Number(z.longitude) || 0,
      geoRadiusM: Math.max(10, Number(z.geoRadiusM) || 100),
    };

    this.saving.set(true);
    this.saveError.set(null);

    const id = this.editId();
    const req = id ? this.officeSvc.update(id, payload) : this.officeSvc.create(payload);

    req.subscribe({
      next: (res) => {
        const office = res.data;
        this.offices.update(list =>
          id ? list.map(o => o.id === id ? office : o) : [...list, office]
        );
        this.saving.set(false);
        this.resetForm();
      },
      error: () => {
        this.saveError.set('Could not save office. Please try again.');
        this.saving.set(false);
      },
    });
  }

  editZone(office: Office) {
    this.editId.set(office.id);
    this.newZone.set({
      name: office.name,
      address: office.address ?? '',
      latitude: office.latitude ?? 0,
      longitude: office.longitude ?? 0,
      geoRadiusM: office.geoRadiusM ?? 100,
    });
    this.showAddForm.set(true);
  }

  deleteZone(id: string) {
    if (!confirm('Delete this office? This cannot be undone.')) return;
    this.officeSvc.delete(id).subscribe({
      next: () => this.offices.update(list => list.filter(o => o.id !== id)),
      error: () => this.officesError.set('Could not delete office — it may still be referenced by a department or employee.'),
    });
  }

  resetForm() {
    this.newZone.set({ name: '', address: '', latitude: 0, longitude: 0, geoRadiusM: 100 });
    this.showAddForm.set(false);
    this.editId.set(null);
    this.locError.set(null);
    this.locGranted.set(false);
    this.saveError.set(null);
  }

  patchName(v: string)       { this.newZone.update(z => ({ ...z, name: v })); }
  patchAddress(v: string)    { this.newZone.update(z => ({ ...z, address: v })); }
  patchLat(v: string)        { this.newZone.update(z => ({ ...z, latitude: +v })); }
  patchLng(v: string)        { this.newZone.update(z => ({ ...z, longitude: +v })); }
  patchRadius(v: string)     { this.newZone.update(z => ({ ...z, geoRadiusM: Math.max(10, +v) })); }

  /**
   * Scale radius to a CSS circle diameter in px, clamped to fit inside the
   * fixed-size radar frame (96px) — never lets a large real-world radius
   * (e.g. 500m+) overflow its container the way the old uncapped version did.
   */
  radiusCircle(r: number | null): number {
    return Math.min(78, Math.max(26, ((r ?? 0) / 500) * 78));
  }

  // ── Departments / clock-in policy ───────────────────────────────────────

  loadDepartments() {
    this.loadingDepartments.set(true);
    this.departmentsError.set(null);
    this.deptSvc.getAll().subscribe({
      next: (res) => {
        const list = res.data ?? [];
        this.departments.set(list);
        const drafts: Record<string, DeptPolicyDraft> = {};
        for (const d of list) {
          drafts[d.departmentId] = this._draftFromDepartment(d);
        }
        this.policyDrafts.set(drafts);
        this.loadingDepartments.set(false);
      },
      error: () => {
        this.departmentsError.set('Could not load departments.');
        this.loadingDepartments.set(false);
      },
    });
  }

  private _draftFromDepartment(d: Department): DeptPolicyDraft {
    const allowed = d.allowedClockInMethods ?? [];
    return {
      allowedClockInMethods: {
        web: allowed.includes('web'),
        mobile: allowed.includes('mobile'),
        biometric: allowed.includes('biometric'),
        face: allowed.includes('face'),
      },
      requiredOfficeId: d.requiredOfficeId ?? '',
    };
  }

  toggleMethod(departmentId: string, method: ClockInMethod, checked: boolean) {
    this.policyDrafts.update(drafts => {
      const draft = drafts[departmentId];
      if (!draft) return drafts;
      return {
        ...drafts,
        [departmentId]: {
          ...draft,
          allowedClockInMethods: { ...draft.allowedClockInMethods, [method]: checked },
        },
      };
    });
  }

  patchRequiredOffice(departmentId: string, officeId: string) {
    this.policyDrafts.update(drafts => {
      const draft = drafts[departmentId];
      if (!draft) return drafts;
      return { ...drafts, [departmentId]: { ...draft, requiredOfficeId: officeId } };
    });
  }

  /** Whether a given clock-in method is checked in a department's draft (template helper, avoids unnecessary `?.` on an indexed Record) */
  isMethodChecked(departmentId: string, method: ClockInMethod): boolean {
    return this.policyDrafts()[departmentId]?.allowedClockInMethods[method] ?? false;
  }

  /** The selected requiredOfficeId in a department's draft (template helper) */
  draftRequiredOfficeId(departmentId: string): string {
    return this.policyDrafts()[departmentId]?.requiredOfficeId ?? '';
  }

  saveDepartmentPolicy(departmentId: string) {
    const draft = this.policyDrafts()[departmentId];
    if (!draft) return;

    const allowedClockInMethods = this.clockInMethods.filter(m => draft.allowedClockInMethods[m]);
    const payload: ClockInPolicyRequest = {
      allowedClockInMethods,
      requiredOfficeId: draft.requiredOfficeId || undefined,
    };

    this.savingPolicyId.set(departmentId);
    this.policyError.set(null);

    this.deptSvc.updateClockInPolicy(departmentId, payload).subscribe({
      next: (res) => {
        const updated = res.data;
        this.departments.update(list => list.map(d => d.departmentId === departmentId ? updated : d));
        this.policyDrafts.update(drafts => ({ ...drafts, [departmentId]: this._draftFromDepartment(updated) }));
        this.savingPolicyId.set(null);
      },
      error: () => {
        this.policyError.set('Could not save clock-in policy. Please try again.');
        this.savingPolicyId.set(null);
      },
    });
  }

  ngOnDestroy() {
    if (this._watchId !== null) navigator.geolocation?.clearWatch(this._watchId);
  }
}
