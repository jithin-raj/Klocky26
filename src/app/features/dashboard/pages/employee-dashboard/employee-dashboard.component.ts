import { Component, ChangeDetectionStrategy, signal, inject, ViewChild, ElementRef, OnDestroy, ChangeDetectorRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AttendanceStateService } from '../../../../core/services/attendance-state.service';
import { FaceRosterService } from '../../../../core/services/face-roster.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import * as faceapi from '@vladmandic/face-api';

interface LeaveBalance {
  type: string;
  used: number;
  total: number;
  color: string;
}

interface Shift {
  day: string;
  date: number;
  start: string;
  end: string;
  isToday: boolean;
}

interface Activity {
  action: string;
  time: string;
  date: string;
  type: 'in' | 'out' | 'leave' | 'absent' | 'holiday';
}

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './employee-dashboard.component.html',
  styleUrl: './employee-dashboard.component.scss',
})
export class EmployeeDashboardComponent implements OnDestroy {
  constructor(private router: Router) {}

  readonly attendanceSvc = inject(AttendanceStateService);
  readonly rosterSvc     = inject(FaceRosterService);
  private  cdr           = inject(ChangeDetectorRef);
  private  appState      = inject(AppStateService);
  
  // Org-scoped route prefix for routerLink bindings
  orgPrefix = computed(() => `/${this.appState.orgSlug() || 'default'}`);

  // Shorthand getters for template
  get isClockedIn()  { return this.attendanceSvc.isClockedIn; }
  get geoStatus()    { return this.attendanceSvc.geoStatus; }

  now = new Date();
  todayHours = signal('0h 00m');

  private timerRef?: ReturnType<typeof setInterval>;

  // ── Face scan modal ─────────────────────────────────────────────
  @ViewChild('edVideo')  edVideo!:  ElementRef<HTMLVideoElement>;
  @ViewChild('edCanvas') edCanvas!: ElementRef<HTMLCanvasElement>;

  faceModalOpen = signal(false);
  faceMode      = signal<'idle' | 'cam' | 'processing' | 'success' | 'fail'>('idle');
  faceStatus    = signal('');
  faceId        = signal('');
  faceName      = signal('');   // recognised person's name
  faceConsent   = signal(false);
  faceCamErr    = signal('');
  private _stream: MediaStream | null = null;
  private static _modelsLoaded = false;

  openFaceModal() {
    if (this.attendanceSvc.isClockedIn()) {
      this.attendanceSvc.manualClockOut();
      this._stopTimer();
      return;
    }
    this.faceModalOpen.set(true);
    this.faceMode.set('idle');
    if (this.faceConsent()) {
      setTimeout(() => this.startFaceCam(), 80);
    }
  }

  grantConsentAndStart() {
    this.faceConsent.set(true);
    this.startFaceCam();
  }

  closeFaceModal() {
    this._stopCam();
    this.faceModalOpen.set(false);
    this.faceMode.set('idle');
  }

  async startFaceCam() {
    if (!this.faceConsent()) return;
    this.faceCamErr.set('');
    this.faceStatus.set('Loading AI models…');
    this.cdr.markForCheck();

    // Load face-api models once
    if (!EmployeeDashboardComponent._modelsLoaded) {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        EmployeeDashboardComponent._modelsLoaded = true;
        console.log('[Klocky Face] AI models ready');
      } catch (e) {
        this.faceCamErr.set('Failed to load AI models.');
        this.faceMode.set('idle');
        this.cdr.markForCheck();
        return;
      }
    }

    this.faceStatus.set('');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.faceCamErr.set('Camera not supported.');
      this.cdr.markForCheck();
      return;
    }

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      console.log(`[Klocky Face] Camera: ${this._stream.getVideoTracks()[0]?.label}`);

      setTimeout(() => {
        const vid = this.edVideo?.nativeElement;
        if (vid && this._stream) {
          vid.srcObject = this._stream;
          vid.onloadedmetadata = () => {
            this.faceStatus.set('Camera active — align your face then tap the button');
            this.cdr.markForCheck();
          };
          this.faceMode.set('cam');
          this.cdr.markForCheck();
        }
      }, 80);
    } catch (e: unknown) {
      const err = e as { name?: string };
      this.faceCamErr.set(err.name === 'NotAllowedError' ? 'Camera access denied.' : 'Could not start camera.');
      this.cdr.markForCheck();
    }
  }

  async captureAndVerify() {
    const video = this.edVideo?.nativeElement;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      this.faceStatus.set('Camera not ready — try again');
      this.cdr.markForCheck();
      return;
    }

    // Switch to processing overlay but keep stream alive so faceapi can read the frame
    this.faceMode.set('processing');
    this.cdr.markForCheck();

    console.log('[Klocky Face] Running face detection…');

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      // Stop camera only after detection has finished reading the frame
      this._stopCam();

      if (!detection) {
        this.faceCamErr.set('No face detected. Please look directly at the camera.');
        this.faceMode.set('cam');
        this.cdr.markForCheck();
        console.warn('[Klocky Face] No face detected in frame');
        // Restart the camera so the user can try again
        await this.startFaceCam();
        return;
      }

      console.log(`[Klocky Face] Face detected — score ${detection.detection.score.toFixed(3)}`);

      const match = this.rosterSvc.recognise(detection.descriptor);

      if (!match) {
        this.faceCamErr.set('Face not in roster. Go to Attendance → Face Roster to enrol first.');
        this.faceMode.set('fail');
        this.cdr.markForCheck();
        return;
      }

      const { face, distance } = match;
      console.log(`[Klocky Face] ✅ Matched "${face.name}" — ID: ${face.id} | distance: ${distance.toFixed(4)}`);

      this.faceId.set(face.id);
      this.faceName.set(face.name);
      this.faceMode.set('success');
      this.attendanceSvc.clockIn(face.id);
      this._startTimer();
      this.cdr.markForCheck();
      setTimeout(() => this.closeFaceModal(), 2000);
    } catch (e) {
      this._stopCam();
      this.faceCamErr.set('Detection error — please try again.');
      this.faceMode.set('idle');
      this.cdr.markForCheck();
      console.error('[Klocky Face] Detection error:', e);
    }
  }

  private _stopCam() {
    this._stream?.getTracks().forEach(t => t.stop());
    this._stream = null;
    const vid = this.edVideo?.nativeElement;
    if (vid) vid.srcObject = null;
  }

  private _startTimer() {
    this._stopTimer();
    this.timerRef = setInterval(() => {
      const t = this.attendanceSvc.clockInTime();
      if (!t) { this._stopTimer(); return; }
      const diff = Date.now() - t.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      this.todayHours.set(`${h}h ${String(m).padStart(2, '0')}m`);
    }, 10000);
  }

  private _stopTimer() {
    if (this.timerRef) { clearInterval(this.timerRef); this.timerRef = undefined; }
  }

  formatTime(d: Date): string {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  ngOnDestroy() {
    this._stopCam();
    this._stopTimer();
  }

  leaveBalances: LeaveBalance[] = [
    { type: 'Annual',      used: 5,  total: 18, color: '#6366f1' },
    { type: 'Sick',        used: 2,  total: 12, color: '#10b981' },
    { type: 'Casual',      used: 1,  total: 6,  color: '#f59e0b' },
    { type: 'Comp-off',    used: 0,  total: 3,  color: '#8b5cf6' },
  ];

  upcomingShifts: Shift[] = [
    { day: 'Mon', date: 28, start: '09:00', end: '18:00', isToday: false },
    { day: 'Tue', date: 29, start: '09:00', end: '18:00', isToday: false },
    { day: 'Wed', date: 30, start: '09:00', end: '18:00', isToday: false },
    { day: 'Thu', date: 1,  start: '09:00', end: '18:00', isToday: false },
    { day: 'Fri', date: 2,  start: '09:00', end: '18:00', isToday: false },
  ];

  recentActivity: Activity[] = [
    { action: 'Clocked In',   time: '09:02 AM', date: 'Today',     type: 'in'     },
    { action: 'Clocked Out',  time: '06:14 PM', date: 'Yesterday', type: 'out'    },
    { action: 'Clocked In',   time: '08:58 AM', date: 'Yesterday', type: 'in'     },
    { action: 'Leave Approved', time: '',       date: 'Apr 25',    type: 'leave'  },
    { action: 'Clocked Out',  time: '06:30 PM', date: 'Apr 24',    type: 'out'    },
  ];

  announcements = [
    { title: 'Public Holiday — May 1',   body: "Labour Day is an office holiday. Enjoy the long weekend!", date: 'Apr 26', tag: 'Holiday' },
    { title: 'Q2 Performance Reviews',   body: 'Self-assessments are due by May 5. Check your HR portal.', date: 'Apr 24', tag: 'HR' },
  ];

  activityColor(type: Activity['type']): string {
    const map: Record<Activity['type'], string> = {
      in: '#10b981', out: '#6366f1', leave: '#f59e0b', absent: '#ef4444', holiday: '#06b6d4',
    };
    return map[type];
  }

  leavePercent(b: LeaveBalance): number {
    return Math.round((b.used / b.total) * 100);
  }
}
