import {
  Component, ChangeDetectionStrategy, signal, ElementRef, ViewChild, OnDestroy, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent } from '../../../../shared/components';

type ScanMode = 'idle' | 'enroll' | 'verify';
type ScanStatus = 'idle' | 'processing' | 'success' | 'fail';

interface EnrolledEmployee {
  id: string;
  name: string;
  department: string;
  enrolled: boolean;
  enrolledAt?: Date;
  /** 64-char hex perceptual hash of the enrolled face frame */
  faceHash?: string;
}

interface ClockEntry {
  name: string;
  faceId: string;
  time: Date;
}

@Component({
  selector: 'app-face-scan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent],
  templateUrl: './face-scan.component.html',
  styleUrl: './face-scan.component.scss',
})
export class FaceScanComponent implements OnDestroy {

  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  mode           = signal<ScanMode>('idle');
  status         = signal<ScanStatus>('idle');
  statusMsg      = signal('');
  identifiedAs   = signal<EnrolledEmployee | null>(null);
  generatedHash  = signal('');
  consentGiven   = signal(false);
  cameraActive   = signal(false);
  cameraError    = signal<string | null>(null);
  httpsNotice    = signal(!location.protocol.startsWith('https'));
  clockLog       = signal<ClockEntry[]>([]);

  private _stream: MediaStream | null = null;

  employees = signal<EnrolledEmployee[]>([
    { id:'e1', name:'Riya Sharma',   department:'Engineering', enrolled:false },
    { id:'e2', name:'Arjun Mehta',   department:'Sales',       enrolled:false },
    { id:'e3', name:'Priya Patel',   department:'HR',          enrolled:false },
    { id:'e4', name:'Vikram Singh',  department:'Engineering', enrolled:false },
    { id:'e5', name:'Neha Gupta',    department:'Marketing',   enrolled:false },
    { id:'e0', name:'You (Demo)',     department:'Demo',        enrolled:false },
  ]);

  selectedEmployeeId = signal<string | null>(null);

  readonly employeeOptions = computed(() => [
    { label: '— Choose —', value: null },
    ...this.employees().map(e => ({ label: e.name, value: e.id })),
  ]);

  // ── Camera ─────────────────────────────────────────────────────────

  async startCamera(scanMode: ScanMode) {
    if (!this.consentGiven()) return;
    this.stopCamera();
    this.cameraError.set(null);
    this.mode.set(scanMode);
    this.status.set('idle');
    this.identifiedAs.set(null);
    this.generatedHash.set('');

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('Camera API not supported. Use a modern browser over HTTPS.');
      return;
    }

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setTimeout(() => {
        if (this.videoEl?.nativeElement && this._stream) {
          this.videoEl.nativeElement.srcObject = this._stream;
          this.cameraActive.set(true);
        }
      });
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        this.cameraError.set('Camera access denied. Allow camera in browser settings.');
      } else if (e.name === 'NotFoundError') {
        this.cameraError.set('No camera found. Please connect a camera.');
      } else if (e.name === 'NotReadableError') {
        this.cameraError.set('Camera in use by another application.');
      } else {
        this.cameraError.set('Could not access camera. Ensure you are on HTTPS.');
      }
      this.mode.set('idle');
    }
  }

  // ── Capture & hash ─────────────────────────────────────────────────

  captureFrame() {
    const video  = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas || !this.cameraActive()) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0);

    // Compute perceptual hash from the actual frame pixels.
    // Raw image data is NEVER stored or transmitted — only the 64-char hash.
    const hash = this.computePerceptualHash(ctx, canvas.width, canvas.height);
    this.generatedHash.set(hash);
    this.status.set('processing');

    if (this.mode() === 'enroll') {
      this.statusMsg.set('Extracting facial features…');
      setTimeout(() => this.finishEnroll(hash), 1200);
    } else {
      this.statusMsg.set('Matching face against enrolled users…');
      setTimeout(() => this.finishVerify(hash), 1500);
    }

    this.stopCamera();
  }

  private finishEnroll(hash: string) {
    const empId = this.selectedEmployeeId();
    if (!empId) { this.status.set('fail'); this.statusMsg.set('No employee selected.'); return; }

    this.employees.update(list => list.map(e =>
      e.id === empId ? { ...e, enrolled: true, enrolledAt: new Date(), faceHash: hash } : e
    ));
    this.status.set('success');
    this.statusMsg.set('Face enrolled! ID generated from your facial features.');
  }

  private finishVerify(hash: string) {
    const match = this.findBestMatch(hash);
    if (match) {
      this.identifiedAs.set(match);
      this.clockLog.update(l => [{
        name:   match.name,
        faceId: hash.slice(0, 16),
        time:   new Date(),
      }, ...l.slice(0, 9)]);
      this.status.set('success');
      this.statusMsg.set('Identity confirmed — attendance marked.');
    } else {
      this.status.set('fail');
      this.statusMsg.set('No match found. Please enrol your face first.');
    }
  }

  // ── Perceptual hash (pHash) ────────────────────────────────────────
  //
  // Steps:
  //  1. Crop the centre 60% of the frame (the likely face region)
  //  2. Downsample to 16×16 grayscale
  //  3. Each pixel is 1 if above mean brightness, else 0  → 256 bits
  //  4. Pack into 64 hex chars
  //
  // This produces a hash that is stable for the same face under similar
  // lighting and changes substantially for a different face.
  // NOT suitable for production biometrics — use a real ML model in prod.

  private computePerceptualHash(ctx: CanvasRenderingContext2D, w: number, h: number): string {
    const cropX = w * 0.20, cropY = h * 0.05;
    const cropW = w * 0.60, cropH = h * 0.90;

    const off    = document.createElement('canvas');
    off.width    = 16;
    off.height   = 16;
    const offCtx = off.getContext('2d')!;
    offCtx.drawImage(ctx.canvas, cropX, cropY, cropW, cropH, 0, 0, 16, 16);

    const px     = offCtx.getImageData(0, 0, 16, 16).data;
    const grays: number[] = [];
    for (let i = 0; i < px.length; i += 4) {
      grays.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    }

    const mean = grays.reduce((s, v) => s + v, 0) / grays.length;
    const bits = grays.map(v => v >= mean ? 1 : 0);

    let hex = '';
    for (let i = 0; i < 256; i += 4) {
      const n = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
      hex += n.toString(16);
    }
    return hex; // 64 hex chars = 256 bits
  }

  private hammingDistance(a: string, b: string): number {
    let dist = 0;
    for (let i = 0; i < 64; i++) {
      const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
      // popcount nibble
      dist += ((xor * 0x200040008001 & 0x111111111111111) % 0xf);
    }
    return dist;
  }

  /** Returns the enrolled employee whose hash is closest to the probe,
   *  within the demo threshold (≤ 80 bit difference out of 256). */
  private findBestMatch(probe: string): EnrolledEmployee | null {
    const THRESHOLD = 80;
    let best: EnrolledEmployee | null = null;
    let bestDist = Infinity;

    for (const emp of this.employees()) {
      if (!emp.enrolled || !emp.faceHash) continue;
      const d = this.hammingDistance(probe, emp.faceHash);
      if (d < bestDist) { bestDist = d; best = emp; }
    }
    return bestDist <= THRESHOLD ? best : null;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  stopCamera() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    if (this.videoEl?.nativeElement) this.videoEl.nativeElement.srcObject = null;
    this.cameraActive.set(false);
    this.mode.set('idle');
  }

  resetStatus() {
    this.status.set('idle');
    this.statusMsg.set('');
    this.identifiedAs.set(null);
    this.generatedHash.set('');
  }

  enrolledCount() {
    return this.employees().filter(e => e.enrolled).length;
  }

  /** Short displayable ID — first 16 hex chars formatted as groups */
  shortId(hash: string) {
    return hash.slice(0, 16).replace(/(.{4})/g, '$1-').slice(0, -1).toUpperCase();
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}
