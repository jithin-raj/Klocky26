import {
  Component, ChangeDetectionStrategy, signal, computed, inject,
  OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent } from '../../../../shared/components';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { GeofencingService } from '../../../../core/services/geofencing.service';
import { OfficeService } from '../../../../core/services/office.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { GeofenceScope, ScopeGeofence } from '../../../../core/models/geofencing.model';
import { loadLeaflet } from '../../../../core/utils/leaflet-loader';

interface TargetOption { label: string; value: string; }

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const DEFAULT_RADIUS = 200;

@Component({
  selector: 'app-geofencing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, HasPermissionDirective],
  templateUrl: './geofencing.component.html',
  styleUrl: './geofencing.component.scss',
})
export class GeofencingComponent implements OnInit, AfterViewInit, OnDestroy {

  private readonly geo = inject(GeofencingService);
  private readonly officeSvc = inject(OfficeService);
  private readonly deptSvc = inject(DepartmentService);
  private readonly empSvc = inject(EmployeeService);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionService);

  @ViewChild('mapEl') private mapEl?: ElementRef<HTMLElement>;

  readonly canEdit = computed(() => this.permissions.can('geofencing', 2));

  // ── Scope + target ───────────────────────────────────────────────
  readonly scopes: { value: GeofenceScope; label: string }[] = [
    { value: 'office', label: 'Office' },
    { value: 'department', label: 'Department' },
    { value: 'employee', label: 'Employee' },
  ];
  scope = signal<GeofenceScope>('office');
  selectedId = signal('');

  private officeOpts = signal<TargetOption[]>([]);
  private deptOpts = signal<TargetOption[]>([]);
  private empOpts = signal<TargetOption[]>([]);
  readonly targetOptions = computed<TargetOption[]>(() => {
    const s = this.scope();
    return s === 'office' ? this.officeOpts() : s === 'department' ? this.deptOpts() : this.empOpts();
  });

  // ── Fence form (single source of truth for all three input modes) ─
  latitude = signal<number | null>(null);
  longitude = signal<number | null>(null);
  radiusMeters = signal<number | null>(DEFAULT_RADIUS);
  saving = signal(false);
  locating = signal(false);

  readonly hasValidCoords = computed(() => {
    const la = this.latitude(), lo = this.longitude(), r = this.radiusMeters();
    return la != null && lo != null && r != null
      && la >= -90 && la <= 90 && lo >= -180 && lo <= 180 && r >= 1 && r <= 100000;
  });

  // ── List ─────────────────────────────────────────────────────────
  fences = signal<ScopeGeofence[]>([]);
  loadingFences = signal(true);

  // ── Leaflet ──────────────────────────────────────────────────────
  private L: any;
  private map: any;
  private marker: any;
  private circle: any;
  private mapReady = false;

  ngOnInit() {
    this.loadFences();
    this.loadTargets(this.scope());
  }

  ngAfterViewInit() {
    loadLeaflet()
      .then(L => this.initMap(L))
      .catch(() => this.toast.error('Map unavailable', 'Could not load the map — use manual entry or current location.'));
  }

  ngOnDestroy() { this.map?.remove(); }

  // ── Data loading ─────────────────────────────────────────────────
  loadFences() {
    this.loadingFences.set(true);
    this.geo.getAll().subscribe({
      next: (rows) => { this.fences.set(rows); this.loadingFences.set(false); },
      error: () => { this.loadingFences.set(false); },
    });
  }

  private loadTargets(scope: GeofenceScope) {
    if (scope === 'office' && this.officeOpts().length === 0) {
      this.officeSvc.getAll().subscribe({ next: r => this.officeOpts.set((r.data ?? []).map(o => ({ label: o.name, value: o.id }))) });
    } else if (scope === 'department' && this.deptOpts().length === 0) {
      this.deptSvc.getAll().subscribe({ next: r => this.deptOpts.set((r.data ?? []).map(d => ({ label: d.name, value: d.departmentId }))) });
    } else if (scope === 'employee' && this.empOpts().length === 0) {
      this.empSvc.getAll().subscribe({ next: r => this.empOpts.set((r.data ?? []).map((e: any) => ({ label: e.fullName ?? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(), value: e.employeeId ?? e.id }))) });
    }
  }

  // ── Scope / target selection ─────────────────────────────────────
  setScope(s: GeofenceScope) {
    if (s === this.scope()) return;
    this.scope.set(s);
    this.selectedId.set('');
    this.resetForm();
    this.loadTargets(s);
  }

  onSelectTarget(id: string) {
    this.selectedId.set(id);
    const fence = this.fences().find(f => f.scope === this.scope() && f.scopeId === id);
    if (fence?.enabled && fence.latitude != null && fence.longitude != null) {
      this.latitude.set(fence.latitude);
      this.longitude.set(fence.longitude);
      this.radiusMeters.set(fence.radiusMeters ?? DEFAULT_RADIUS);
    } else {
      this.latitude.set(null);
      this.longitude.set(null);
      this.radiusMeters.set(DEFAULT_RADIUS);
    }
    this.syncMap(true);
  }

  private resetForm() {
    this.latitude.set(null);
    this.longitude.set(null);
    this.radiusMeters.set(DEFAULT_RADIUS);
    this.syncMap();
  }

  // ── Manual inputs ────────────────────────────────────────────────
  onLatInput(v: string) { this.latitude.set(v === '' ? null : +v); this.syncMap(); }
  onLngInput(v: string) { this.longitude.set(v === '' ? null : +v); this.syncMap(); }
  onRadiusInput(v: string) { this.radiusMeters.set(v === '' ? null : Math.max(1, +v)); this.updateCircle(); }

  // ── Current location ─────────────────────────────────────────────
  useMyLocation() {
    if (!navigator.geolocation) {
      this.toast.error('Location unavailable', 'Geolocation is not supported — use the map or manual entry.');
      return;
    }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.latitude.set(round6(pos.coords.latitude));
        this.longitude.set(round6(pos.coords.longitude));
        if (this.radiusMeters() == null) this.radiusMeters.set(DEFAULT_RADIUS);
        this.locating.set(false);
        this.syncMap(true);
      },
      (err) => {
        this.locating.set(false);
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Location access denied — use the map or manual entry.'
          : 'Could not get your location — use the map or manual entry.';
        this.toast.error('Location unavailable', msg);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // ── Leaflet map ──────────────────────────────────────────────────
  private initMap(L: any) {
    this.L = L;
    if (!this.mapEl) return;
    this.map = L.map(this.mapEl.nativeElement, { center: [20.5937, 78.9629], zoom: 4 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.map.on('click', (e: any) => {
      if (!this.canEdit() || !this.selectedId()) return;
      this.latitude.set(round6(e.latlng.lat));
      this.longitude.set(round6(e.latlng.lng));
      if (this.radiusMeters() == null) this.radiusMeters.set(DEFAULT_RADIUS);
      this.syncMap();
    });
    this.mapReady = true;
    setTimeout(() => this.map.invalidateSize(), 0);
    this.syncMap(true);
  }

  /** Reflect the form coords/radius onto the map. `recenter` pans/zooms to the point. */
  private syncMap(recenter = false) {
    if (!this.mapReady) return;
    const la = this.latitude(), lo = this.longitude(), r = this.radiusMeters() ?? DEFAULT_RADIUS;

    if (la == null || lo == null) {
      if (this.marker) { this.map.removeLayer(this.marker); this.marker = null; }
      if (this.circle) { this.map.removeLayer(this.circle); this.circle = null; }
      return;
    }
    const pos = [la, lo];
    if (!this.marker) {
      this.marker = this.L.marker(pos, { draggable: this.canEdit() }).addTo(this.map);
      this.marker.on('dragend', () => {
        const p = this.marker.getLatLng();
        this.latitude.set(round6(p.lat));
        this.longitude.set(round6(p.lng));
        this.updateCircle();
      });
    } else {
      this.marker.setLatLng(pos);
    }
    if (!this.circle) {
      this.circle = this.L.circle(pos, { radius: r, color: '#6366f1', weight: 2, fillColor: '#6366f1', fillOpacity: 0.12 }).addTo(this.map);
    } else {
      this.circle.setLatLng(pos);
      this.circle.setRadius(r);
    }
    if (recenter) this.map.setView(pos, Math.max(this.map.getZoom() ?? 14, 14));
  }

  private updateCircle() {
    if (this.circle && this.latitude() != null && this.longitude() != null) {
      this.circle.setLatLng([this.latitude(), this.longitude()]);
      this.circle.setRadius(this.radiusMeters() ?? DEFAULT_RADIUS);
    }
  }

  // ── Save / clear ─────────────────────────────────────────────────
  save() {
    if (!this.selectedId() || !this.hasValidCoords() || this.saving()) return;
    this.saving.set(true);
    this.geo.set(this.scope(), this.selectedId(), {
      latitude: this.latitude(),
      longitude: this.longitude(),
      radiusMeters: this.radiusMeters(),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Geofence saved', 'The geofence has been updated.');
        this.loadFences();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Could not save', err?.error?.message ?? 'The geofence could not be saved.');
      },
    });
  }

  clearFence() {
    if (!this.selectedId() || this.saving()) return;
    this.saving.set(true);
    this.geo.set(this.scope(), this.selectedId(), { latitude: null, longitude: null, radiusMeters: null }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Geofence cleared', 'The geofence has been removed.');
        this.latitude.set(null); this.longitude.set(null); this.radiusMeters.set(DEFAULT_RADIUS);
        this.syncMap();
        this.loadFences();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Could not clear', err?.error?.message ?? 'The geofence could not be cleared.');
      },
    });
  }

  /** Jump the editor to an existing fence row. */
  editFence(f: ScopeGeofence) {
    this.scope.set(f.scope);
    this.loadTargets(f.scope);
    this.onSelectTarget(f.scopeId);
  }

  scopeLabel(s: GeofenceScope): string {
    return s === 'office' ? 'Office' : s === 'department' ? 'Department' : 'Employee';
  }
}
