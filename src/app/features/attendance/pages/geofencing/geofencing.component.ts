import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed, inject,
  OnInit, AfterViewChecked, OnDestroy, ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
export type ModalType = 'map' | 'manual' | 'location' | 'view' | 'confirm' | null;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const DEFAULT_RADIUS = 200;

@Component({
  selector: 'app-geofencing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, HasPermissionDirective],
  templateUrl: './geofencing.component.html',
  styleUrl: './geofencing.component.scss',
})
export class GeofencingComponent implements OnInit, AfterViewChecked, OnDestroy {

  private readonly geo = inject(GeofencingService);
  private readonly officeSvc = inject(OfficeService);
  private readonly deptSvc = inject(DepartmentService);
  private readonly empSvc = inject(EmployeeService);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('mapModalEl') private mapModalEl?: ElementRef<HTMLElement>;
  @ViewChild('viewMapEl') private viewMapEl?: ElementRef<HTMLElement>;
  @ViewChild('manualMapEl') private manualMapEl?: ElementRef<HTMLElement>;

  readonly canEdit = computed(() => this.permissions.can('geofencing', 2));

  // ── Scope / target ───────────────────────────────────────────────
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

  readonly selectedLabel = computed(() =>
    this.targetOptions().find(o => o.value === this.selectedId())?.label ?? ''
  );

  readonly currentFence = computed<ScopeGeofence | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.fences().find(f => f.scope === this.scope() && f.scopeId === id) ?? null;
  });

  readonly hasFence = computed(() => !!(this.currentFence()?.enabled && this.currentFence()?.latitude != null));

  // ── Inline dropdown (replaces ui-select to avoid OnPush/fixed-pos issues) ─
  targetDropOpen = signal(false);
  selectSearch = signal('');
  readonly filteredTargetOpts = computed(() => {
    const q = this.selectSearch().toLowerCase().trim();
    return q
      ? this.targetOptions().filter(o => o.label.toLowerCase().includes(q))
      : this.targetOptions();
  });

  pickTarget(id: string) {
    this.onSelectTarget(id);
    this.targetDropOpen.set(false);
    this.selectSearch.set('');
  }

  // ── List ─────────────────────────────────────────────────────────
  fences = signal<ScopeGeofence[]>([]);
  loadingFences = signal(true);
  saving = signal(false);
  locating = signal(false);

  // ── Modal ────────────────────────────────────────────────────────
  activeModal = signal<ModalType>(null);

  // ── Map modal state ───────────────────────────────────────────────
  mapSearchQuery = signal('');
  mapSearchResults = signal<any[]>([]);
  mapSearching = signal(false);
  mapSearchDone = signal(false);
  mapLat = signal<number | null>(null);
  mapLng = signal<number | null>(null);
  mapRadius = signal<number>(DEFAULT_RADIUS);
  mapLocationName = signal('');
  private mapModalMap: any = null;
  private mapModalMarker: any = null;
  private mapModalCircle: any = null;

  // ── Manual modal state ────────────────────────────────────────────
  manualLat = signal<number | null>(null);
  manualLng = signal<number | null>(null);
  manualRadius = signal<number>(DEFAULT_RADIUS);
  manualLocationName = signal('');
  manualPreviewReady = signal(false);
  private manualPreviewMap: any = null;
  private manualPreviewMarker: any = null;
  private manualPreviewCircle: any = null;

  readonly manualValid = computed(() => {
    const la = this.manualLat(), lo = this.manualLng(), r = this.manualRadius();
    return la != null && lo != null && r != null
      && la >= -90 && la <= 90 && lo >= -180 && lo <= 180 && r >= 1 && r <= 100000;
  });

  // ── Current location modal state ──────────────────────────────────
  currentLat = signal<number | null>(null);
  currentLng = signal<number | null>(null);
  currentRadius = signal<number>(DEFAULT_RADIUS);
  currentLocationName = signal('');

  // ── Pending fence (held between set-modals and confirm) ───────────
  pendingLat = signal<number | null>(null);
  pendingLng = signal<number | null>(null);
  pendingRadius = signal<number>(DEFAULT_RADIUS);
  pendingLocationName = signal('');

  // ── Leaflet ──────────────────────────────────────────────────────
  private L: any;
  private viewMap: any = null;
  private viewMarker: any = null;
  private viewCircle: any = null;

  // Flags: set when a modal opens so ngAfterViewChecked can init the map
  // once the @if block has rendered and ViewChild is populated.
  private _pendingMapModal = false;
  private _pendingViewMap = false;
  private _pendingManualMap = false;

  ngOnInit() {
    this.loadFences();
    this.loadTargets(this.scope());
    loadLeaflet().then(L => { this.L = L; }).catch(() => {});
  }

  ngOnDestroy() {
    this.mapModalMap?.remove();
    this.viewMap?.remove();
    this.manualPreviewMap?.remove();
  }

  ngAfterViewChecked() {
    if (this._pendingMapModal && this.mapModalEl) {
      this._pendingMapModal = false;
      this.initMapModal();
    }
    if (this._pendingViewMap && this.viewMapEl) {
      this._pendingViewMap = false;
      this.initViewMap();
    }
    if (this._pendingManualMap && this.manualMapEl) {
      this._pendingManualMap = false;
      const la = this.manualLat(), lo = this.manualLng();
      if (la != null && lo != null) this.initOrUpdateManualMap(la, lo);
    }
  }

  // ── Data loading ─────────────────────────────────────────────────
  loadFences() {
    this.loadingFences.set(true);
    this.geo.getAll().subscribe({
      next: rows => { this.fences.set(rows); this.loadingFences.set(false); },
      error: () => { this.loadingFences.set(false); },
    });
  }

  private loadTargets(scope: GeofenceScope) {
    if (scope === 'office' && this.officeOpts().length === 0) {
      this.officeSvc.getAll().subscribe({
        next: r => {
          const opts = (r.data ?? []).map((o: any) => ({ label: o.name, value: o.officeId ?? o.id ?? '' }));
          this.officeOpts.set(opts);
          if (opts.length > 0) this.onSelectTarget(opts[0].value);
        },
      });
    } else if (scope === 'department' && this.deptOpts().length === 0) {
      this.deptSvc.getAll().subscribe({
        next: r => {
          const opts = (r.data ?? []).map(d => ({ label: d.name, value: d.departmentId }));
          this.deptOpts.set(opts);
          if (opts.length > 0) this.onSelectTarget(opts[0].value);
        },
      });
    } else if (scope === 'employee' && this.empOpts().length === 0) {
      this.empSvc.getAll().subscribe({
        next: r => {
          const opts = (r.data ?? []).map((e: any) => ({ label: e.fullName ?? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(), value: e.employeeId ?? e.id }));
          this.empOpts.set(opts);
          if (opts.length > 0) this.onSelectTarget(opts[0].value);
        },
      });
    } else {
      // Options already loaded — auto-select first if nothing is selected
      const opts = this.targetOptions();
      if (opts.length > 0 && !this.selectedId()) this.onSelectTarget(opts[0].value);
    }
  }

  // ── Scope / target ────────────────────────────────────────────────
  setScope(s: GeofenceScope) {
    if (s === this.scope()) return;
    this.scope.set(s);
    this.selectedId.set('');
    this.targetDropOpen.set(false);
    this.selectSearch.set('');
    this.loadTargets(s);
  }

  onSelectTarget(id: string) {
    this.selectedId.set(id);
  }

  scopeLabel(s: GeofenceScope): string {
    return s === 'office' ? 'Office' : s === 'department' ? 'Department' : 'Employee';
  }

  // ── Open modals ───────────────────────────────────────────────────
  openMapModal() {
    const fence = this.currentFence();
    if (fence?.enabled && fence.latitude != null) {
      this.mapLat.set(fence.latitude);
      this.mapLng.set(fence.longitude);
      this.mapRadius.set(fence.radiusMeters ?? DEFAULT_RADIUS);
      this.reverseGeocode(fence.latitude, fence.longitude!).then(n => { this.mapLocationName.set(n); this.mapSearchQuery.set(n); this.cdr.markForCheck(); });
    } else {
      this.mapLat.set(null);
      this.mapLng.set(null);
      this.mapRadius.set(DEFAULT_RADIUS);
      this.mapLocationName.set('');
      this.mapSearchQuery.set('');
    }
    this.mapSearchResults.set([]);
    this.mapSearchDone.set(false);
    this._pendingMapModal = true;
    this.activeModal.set('map');
  }

  openManualModal() {
    const fence = this.currentFence();
    if (fence?.enabled && fence.latitude != null) {
      this.manualLat.set(fence.latitude);
      this.manualLng.set(fence.longitude);
      this.manualRadius.set(fence.radiusMeters ?? DEFAULT_RADIUS);
      this.reverseGeocode(fence.latitude, fence.longitude!).then(n => { this.manualLocationName.set(n); this.cdr.markForCheck(); });
      this.manualPreviewReady.set(true);
      this._pendingManualMap = true;
    } else {
      this.manualLat.set(null);
      this.manualLng.set(null);
      this.manualRadius.set(DEFAULT_RADIUS);
      this.manualLocationName.set('');
      this.manualPreviewReady.set(false);
    }
    this.activeModal.set('manual');
  }

  openLocationModal() {
    if (!navigator.geolocation) {
      this.toast.error('Location unavailable', 'Geolocation is not supported by your browser.');
      return;
    }
    this.currentLat.set(null);
    this.currentLng.set(null);
    this.currentRadius.set(DEFAULT_RADIUS);
    this.currentLocationName.set('Detecting your location…');
    this.locating.set(true);
    this.activeModal.set('location');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const la = round6(pos.coords.latitude);
        const lo = round6(pos.coords.longitude);
        this.currentLat.set(la);
        this.currentLng.set(lo);
        this.locating.set(false);
        this.reverseGeocode(la, lo).then(name => { this.currentLocationName.set(name); this.cdr.markForCheck(); });
        this.cdr.markForCheck();
      },
      err => {
        this.locating.set(false);
        this.currentLocationName.set('Could not detect location');
        const msg = err.code === err.PERMISSION_DENIED ? 'Location access denied.' : 'Could not get your location.';
        this.toast.error('Location unavailable', msg);
        this.cdr.markForCheck();
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  openViewModal() {
    this._pendingViewMap = true;
    this.activeModal.set('view');
  }

  closeModal() {
    this.activeModal.set(null);
    this.destroyAllMaps();
  }

  private destroyAllMaps() {
    this.mapModalMap?.remove(); this.mapModalMap = null; this.mapModalMarker = null; this.mapModalCircle = null;
    this.viewMap?.remove(); this.viewMap = null; this.viewMarker = null; this.viewCircle = null;
    this.manualPreviewMap?.remove(); this.manualPreviewMap = null; this.manualPreviewMarker = null; this.manualPreviewCircle = null;
  }

  editFromView(mode: 'map' | 'manual' | 'location') {
    this.viewMap?.remove(); this.viewMap = null; this.viewMarker = null; this.viewCircle = null;
    if (mode === 'map') this.openMapModal();
    else if (mode === 'manual') this.openManualModal();
    else this.openLocationModal();
  }

  // ── Map modal ─────────────────────────────────────────────────────
  private async initMapModal() {
    if (!this.mapModalEl) return;
    if (!this.L) {
      try { this.L = await loadLeaflet(); } catch { this.toast.error('Map unavailable', 'Could not load the map.'); return; }
    }
    if (this.mapModalMap) { this.mapModalMap.remove(); }
    const la = this.mapLat() ?? 20.5937;
    const lo = this.mapLng() ?? 78.9629;
    const zoom = this.mapLat() != null ? 14 : 4;
    this.mapModalMap = this.L.map(this.mapModalEl.nativeElement, { center: [la, lo], zoom });
    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.mapModalMap);
    this.mapModalMap.on('click', (e: any) => {
      this.mapLat.set(round6(e.latlng.lat));
      this.mapLng.set(round6(e.latlng.lng));
      this.syncMapModal();
      this.reverseGeocode(e.latlng.lat, e.latlng.lng).then(name => {
        this.mapSearchQuery.set(name);
        this.mapLocationName.set(name);
        this.cdr.markForCheck();
      });
    });
    setTimeout(() => this.mapModalMap?.invalidateSize(), 0);
    this.syncMapModal(true);
  }

  private syncMapModal(recenter = false) {
    if (!this.mapModalMap) return;
    const la = this.mapLat(), lo = this.mapLng(), r = this.mapRadius();
    if (la == null || lo == null) {
      if (this.mapModalMarker) { this.mapModalMap.removeLayer(this.mapModalMarker); this.mapModalMarker = null; }
      if (this.mapModalCircle) { this.mapModalMap.removeLayer(this.mapModalCircle); this.mapModalCircle = null; }
      return;
    }
    const pos: [number, number] = [la, lo];
    if (!this.mapModalMarker) {
      this.mapModalMarker = this.L.marker(pos, { draggable: true }).addTo(this.mapModalMap);
      this.mapModalMarker.on('dragend', () => {
        const p = this.mapModalMarker.getLatLng();
        this.mapLat.set(round6(p.lat));
        this.mapLng.set(round6(p.lng));
        this.reverseGeocode(p.lat, p.lng).then(name => { this.mapSearchQuery.set(name); this.mapLocationName.set(name); this.cdr.markForCheck(); });
        if (this.mapModalCircle) this.mapModalCircle.setLatLng([p.lat, p.lng]);
        this.cdr.markForCheck();
      });
    } else {
      this.mapModalMarker.setLatLng(pos);
    }
    if (!this.mapModalCircle) {
      this.mapModalCircle = this.L.circle(pos, { radius: r, color: '#6366f1', weight: 2, fillColor: '#6366f1', fillOpacity: 0.13 }).addTo(this.mapModalMap);
    } else {
      this.mapModalCircle.setLatLng(pos);
      this.mapModalCircle.setRadius(r);
    }
    if (recenter) this.mapModalMap.setView(pos, Math.max(this.mapModalMap.getZoom() ?? 14, 14));
  }

  onMapRadiusChange(v: any) {
    const r = (v == null || v === '') ? DEFAULT_RADIUS : Math.max(1, +v);
    this.mapRadius.set(r);
    if (this.mapModalCircle && this.mapLat() != null) this.mapModalCircle.setRadius(r);
  }

  async searchMap() {
    const q = this.mapSearchQuery().trim();
    if (!q) return;
    this.mapSearching.set(true);
    this.mapSearchDone.set(false);
    try {
      // addressdetails + extratags includes businesses, shops, offices, showrooms, POIs
      const url = `https://nominatim.openstreetmap.org/search`
        + `?q=${encodeURIComponent(q)}`
        + `&format=json&limit=8&addressdetails=1&extratags=1&namedetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const results: any[] = await res.json();
      this.mapSearchResults.set(results);
    } catch {
      this.mapSearchResults.set([]);
    } finally {
      this.mapSearchDone.set(true);
      this.mapSearching.set(false);
      this.cdr.markForCheck();
    }
  }

  selectSearchResult(r: any) {
    const la = round6(+r.lat);
    const lo = round6(+r.lon);
    const name = r.display_name?.split(',').slice(0, 3).join(', ') ?? '';
    this.mapLat.set(la);
    this.mapLng.set(lo);
    this.mapSearchQuery.set(name);
    this.mapLocationName.set(name);
    this.mapSearchResults.set([]);
    this.syncMapModal(true);
    this.cdr.markForCheck();
  }

  saveFromMap() {
    if (this.mapLat() == null || this.mapLng() == null) return;
    this.pendingLat.set(this.mapLat());
    this.pendingLng.set(this.mapLng());
    this.pendingRadius.set(this.mapRadius());
    this.pendingLocationName.set(this.mapLocationName());
    this.mapModalMap?.remove(); this.mapModalMap = null; this.mapModalMarker = null; this.mapModalCircle = null;
    this.activeModal.set('confirm');
  }

  // ── Manual modal ──────────────────────────────────────────────────
  onManualLatChange(v: any) {
    this.manualLat.set((v == null || v === '') ? null : +v);
    this.scheduleManualPreview();
  }

  onManualLngChange(v: any) {
    this.manualLng.set((v == null || v === '') ? null : +v);
    this.scheduleManualPreview();
  }

  onManualRadiusChange(v: any) {
    const r = (v == null || v === '') ? DEFAULT_RADIUS : Math.max(1, +v);
    this.manualRadius.set(r);
    if (this.manualPreviewCircle && this.manualLat() != null) this.manualPreviewCircle.setRadius(r);
  }

  private scheduleManualPreview() {
    const la = this.manualLat(), lo = this.manualLng();
    if (la == null || lo == null || la < -90 || la > 90 || lo < -180 || lo > 180) {
      this.manualPreviewReady.set(false);
      return;
    }
    this.manualPreviewReady.set(true);
    this.reverseGeocode(la, lo).then(name => { this.manualLocationName.set(name); this.cdr.markForCheck(); });
    // Flag tells ngAfterViewChecked to init/update the map once #manualMapEl is in the DOM
    this._pendingManualMap = true;
  }

  private async initOrUpdateManualMap(la: number, lo: number) {
    if (!this.manualMapEl) return;
    if (!this.L) {
      try { this.L = await loadLeaflet(); } catch { return; }
    }
    const r = this.manualRadius();
    if (!this.manualPreviewMap) {
      this.manualPreviewMap = this.L.map(this.manualMapEl.nativeElement, {
        center: [la, lo], zoom: 14, zoomControl: true, attributionControl: false,
      });
      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.manualPreviewMap);
      this.manualPreviewMarker = this.L.marker([la, lo]).addTo(this.manualPreviewMap);
      this.manualPreviewCircle = this.L.circle([la, lo], { radius: r, color: '#6366f1', weight: 2, fillColor: '#6366f1', fillOpacity: 0.13 }).addTo(this.manualPreviewMap);
      setTimeout(() => this.manualPreviewMap?.invalidateSize(), 0);
    } else {
      this.manualPreviewMap.setView([la, lo], 14);
      this.manualPreviewMarker.setLatLng([la, lo]);
      this.manualPreviewCircle.setLatLng([la, lo]);
      this.manualPreviewCircle.setRadius(r);
    }
  }

  saveFromManual() {
    if (!this.manualValid()) return;
    this.pendingLat.set(this.manualLat());
    this.pendingLng.set(this.manualLng());
    this.pendingRadius.set(this.manualRadius());
    this.pendingLocationName.set(this.manualLocationName());
    this.manualPreviewMap?.remove(); this.manualPreviewMap = null; this.manualPreviewMarker = null; this.manualPreviewCircle = null;
    this.activeModal.set('confirm');
  }

  // ── Location modal ────────────────────────────────────────────────
  saveFromLocation() {
    if (this.currentLat() == null) return;
    this.pendingLat.set(this.currentLat());
    this.pendingLng.set(this.currentLng());
    this.pendingRadius.set(this.currentRadius());
    this.pendingLocationName.set(this.currentLocationName());
    this.activeModal.set('confirm');
  }

  // ── View modal ────────────────────────────────────────────────────
  private async initViewMap() {
    if (!this.viewMapEl) return;
    if (!this.L) {
      try { this.L = await loadLeaflet(); } catch { return; }
    }
    const fence = this.currentFence();
    if (!fence?.enabled || fence.latitude == null) return;
    if (this.viewMap) { this.viewMap.remove(); }
    this.viewMap = this.L.map(this.viewMapEl.nativeElement, { center: [fence.latitude, fence.longitude], zoom: 14 });
    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.viewMap);
    this.viewMarker = this.L.marker([fence.latitude, fence.longitude]).addTo(this.viewMap);
    this.viewCircle = this.L.circle([fence.latitude, fence.longitude], {
      radius: fence.radiusMeters ?? DEFAULT_RADIUS,
      color: '#6366f1', weight: 2, fillColor: '#6366f1', fillOpacity: 0.13,
    }).addTo(this.viewMap);
    setTimeout(() => this.viewMap?.invalidateSize(), 0);
  }

  deleteFromView() {
    if (!this.selectedId() || this.saving()) return;
    this.saving.set(true);
    this.geo.set(this.scope(), this.selectedId(), { latitude: null, longitude: null, radiusMeters: null }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Geofence removed', 'The geofence has been cleared.');
        this.viewMap?.remove(); this.viewMap = null;
        this.activeModal.set(null);
        this.loadFences();
      },
      error: err => {
        this.saving.set(false);
        this.toast.error('Could not remove', err?.error?.message ?? 'The geofence could not be removed.');
      },
    });
  }

  // ── Confirm modal ─────────────────────────────────────────────────
  confirmSave() {
    if (!this.selectedId() || this.saving()) return;
    this.saving.set(true);
    this.geo.set(this.scope(), this.selectedId(), {
      latitude: this.pendingLat(),
      longitude: this.pendingLng(),
      radiusMeters: this.pendingRadius(),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Geofence saved', 'The geofence has been updated.');
        this.activeModal.set(null);
        this.loadFences();
      },
      error: err => {
        this.saving.set(false);
        this.toast.error('Could not save', err?.error?.message ?? 'The geofence could not be saved.');
      },
    });
  }

  cancelConfirm() {
    this.activeModal.set(null);
  }

  // ── Utilities ─────────────────────────────────────────────────────
  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      return data.display_name?.split(',').slice(0, 3).join(', ') ?? `${lat}, ${lng}`;
    } catch {
      return `${lat}, ${lng}`;
    }
  }
}
