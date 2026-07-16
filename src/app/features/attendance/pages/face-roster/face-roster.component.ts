import {
  Component, ChangeDetectionStrategy, signal,
  ViewChild, ElementRef, OnDestroy, inject, ChangeDetectorRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaceRosterService, EnrolledFace } from '../../../../core/services/face-roster.service';
import { OrgDateTimePipe } from '../../../../shared/pipes/localization.pipes';
import * as faceapi from '@vladmandic/face-api';

type PageMode = 'list' | 'cam' | 'processing' | 'success' | 'error';

@Component({
  selector: 'app-face-roster',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, OrgDateTimePipe],
  templateUrl: './face-roster.component.html',
  styleUrl: './face-roster.component.scss',
})
export class FaceRosterComponent implements OnDestroy, AfterViewChecked {

  private rosterSvc = inject(FaceRosterService);
  private cdr       = inject(ChangeDetectorRef);

  readonly roster   = this.rosterSvc.roster;

  mode         = signal<PageMode>('list');
  statusMsg    = signal('');
  errMsg       = signal('');
  enrolledName = signal('');
  nameInput    = '';

  private _stream:       MediaStream | null = null;
  private _videoEl:      HTMLVideoElement | null = null;
  private _streamPending = false;
  private static _modelsLoaded = false;

  @ViewChild('enrollVideo') enrollVideo?: ElementRef<HTMLVideoElement>;

  /** Called after every CD cycle — attaches stream to video once element appears */
  ngAfterViewChecked() {
    if (this._streamPending && this.enrollVideo?.nativeElement && this._stream) {
      this._streamPending = false;
      this._videoEl = this.enrollVideo.nativeElement;
      this._videoEl.srcObject = this._stream;
      this._videoEl.onloadedmetadata = () => {
        const v = this._videoEl!;
        console.log('[Klocky Roster] Video ready: ' + v.videoWidth + 'x' + v.videoHeight);
        this.statusMsg.set('');   // clear so the overlay doesn't block the video
        this.cdr.markForCheck();
      };
      console.log('[Klocky Roster] Stream attached to video element');
      this.cdr.markForCheck();
    }
  }

  async startEnroll() {
    this.errMsg.set('');
    this.statusMsg.set('Loading AI models...');
    this.cdr.markForCheck();

    if (!FaceRosterComponent._modelsLoaded) {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        FaceRosterComponent._modelsLoaded = true;
        console.log('[Klocky Roster] AI models loaded');
      } catch (e) {
        this.errMsg.set('Failed to load AI models. Check /public/models files.');
        this.mode.set('error');
        this.cdr.markForCheck();
        console.error('[Klocky Roster] Model load error:', e);
        return;
      }
    }

    this.statusMsg.set('Starting camera...');
    this.cdr.markForCheck();

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const label = this._stream.getVideoTracks()[0]?.label ?? 'unknown';
      console.log('[Klocky Roster] Camera: ' + label);
    } catch (e: unknown) {
      const err = e as { name?: string };
      this.errMsg.set(err.name === 'NotAllowedError' ? 'Camera access denied.' : 'Could not start camera.');
      this.mode.set('error');
      this.cdr.markForCheck();
      return;
    }

    // Set pending flag — ngAfterViewChecked attaches stream once <video> is in DOM
    this._streamPending = true;
    this.statusMsg.set('');
    this.mode.set('cam');
    this.cdr.markForCheck();
  }

  async captureAndEnroll() {
    if (!this.nameInput.trim()) {
      this.errMsg.set('Please enter the person name first.');
      this.cdr.markForCheck();
      return;
    }

    const vid = this._videoEl ?? (this.enrollVideo?.nativeElement ?? null);
    console.log('[Klocky Roster] Capture — vid:' + !!vid + ' readyState:' + vid?.readyState + ' ' + vid?.videoWidth + 'x' + vid?.videoHeight);

    if (!vid) {
      this.errMsg.set('Camera element not found — please retry.');
      this.cdr.markForCheck();
      return;
    }
    if (vid.readyState < 2 || !vid.videoWidth) {
      this.errMsg.set('Camera stream not ready — wait a moment and try again.');
      this.cdr.markForCheck();
      return;
    }

    this.errMsg.set('');
    this.mode.set('processing');
    this.statusMsg.set('Detecting face...');
    this.cdr.markForCheck();

    try {
      console.log('[Klocky Roster] Running face detection...');
      const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
      const detection = await faceapi
        .detectSingleFace(vid, opts)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) {
        console.warn('[Klocky Roster] No face detected');
        this.errMsg.set('No face detected — look directly at camera and ensure good lighting.');
        this.mode.set('cam');
        this.cdr.markForCheck();
        return;
      }

      console.log('[Klocky Roster] Face detected — score: ' + detection.detection.score.toFixed(3));
      this.statusMsg.set('Saving face data...');
      this.cdr.markForCheck();

      const record = this.rosterSvc.enroll(this.nameInput.trim(), detection.descriptor);
      this._stopCam();
      this.enrolledName.set(record.name);
      this.nameInput = '';
      this.mode.set('success');
      this.cdr.markForCheck();
    } catch (e) {
      this.errMsg.set('Detection error — please try again.');
      this.mode.set('cam');
      this.cdr.markForCheck();
      console.error('[Klocky Roster] Enroll error:', e);
    }
  }

  enrollAnother() {
    this.errMsg.set('');
    this.mode.set('list');
    this.cdr.markForCheck();
  }

  cancelEnroll() {
    this._stopCam();
    this.errMsg.set('');
    this.mode.set('list');
    this.cdr.markForCheck();
  }

  removeFace(face: EnrolledFace) {
    if (!confirm('Remove "' + face.name + '" from the face roster?')) return;
    this.rosterSvc.remove(face.id);
  }

  private _stopCam() {
    this._stream?.getTracks().forEach(t => t.stop());
    this._stream = null;
    this._videoEl = null;
    this._streamPending = false;
    if (this.enrollVideo?.nativeElement) this.enrollVideo.nativeElement.srcObject = null;
  }

  ngOnDestroy() { this._stopCam(); }

  trackById(_: number, f: EnrolledFace) { return f.id; }
}

