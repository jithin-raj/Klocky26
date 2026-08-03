import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// ─────────────────────────────────────────────────────────────────────────────
// ScrollHeroComponent — a pinned, scroll-scrubbed WebGL "chapters" section for
// the landing page: a starfield + nebula + parallax teal-horizon silhouette
// that the camera glides through as the visitor scrolls, surfacing three
// short beats of Klockk's pitch (product → one connected HR workflow).
//
// Angular port of a React/Three.js/GSAP hero: lifecycle moves from
// useEffect(mount)/useEffect(cleanup) to ngAfterViewInit/ngOnDestroy, refs
// become @ViewChild + plain fields, and useState becomes signals. The scene
// is driven by scroll math scoped to this component's own host height (not
// the whole document), since here it's one section of a longer page rather
// than the entire scrollable app.
// ─────────────────────────────────────────────────────────────────────────────

interface Chapter {
  title: string;
  sub1: string;
  sub2: string;
}

@Component({
  selector: 'app-scroll-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scroll-hero.component.html',
  styleUrl: './scroll-hero.component.scss',
})
export class ScrollHeroComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('titleEl') titleEl?: ElementRef<HTMLElement>;
  @ViewChild('subtitleEl') subtitleEl?: ElementRef<HTMLElement>;
  @ViewChild('ctaEl') ctaEl?: ElementRef<HTMLElement>;

  readonly chapters: Chapter[] = [
    {
      title: 'KLOCKK',
      sub1: 'Where HR meets clarity —',
      sub2: 'attendance, leave and insight in one calm platform.',
    },
    {
      title: 'WORKFLOW',
      sub1: 'One platform,',
      sub2: 'every HR workflow.',
    },
  ];

  readonly activeChapter = signal(0);
  readonly titleChars = computed(() => this.chapters[this.activeChapter()].title.split(''));
  readonly progressPct = signal(0);
  /** Fades the text/hint out during the final hand-off to the next section,
   *  instead of them abruptly sliding out through the top of the viewport. */
  readonly contentOpacity = signal(1);

  private readonly prefersReducedMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Phones need a much lighter scene: capped pixel ratio, fewer stars, and
  // a cheaper/no bloom pass are what actually keep this smooth — a full
  // desktop-spec WebGL scene on a mid-range phone is what makes a "scroll
  // animation" feel janky rather than cinematic.
  private readonly isMobile =
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;

  private el: HTMLElement | null = null;
  private renderer?: THREE.WebGLRenderer;
  private composer?: EffectComposer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private stars: THREE.Points[] = [];
  private clockGroup?: THREE.Group;
  private clockGlowMat?: THREE.ShaderMaterial;
  private mountains: THREE.Mesh[] = [];
  private animationId?: number;

  private readonly smoothCameraPos = { x: 0, y: 26, z: 260 };
  private target = { x: 0, y: 26, z: 260 };

  // Now that lookAt is camera-relative and the mountains/clock track the
  // camera's own depth every frame (see animate()), a bigger, livelier dolly
  // is safe again — nothing can end up outside the frustum no matter how
  // far the camera travels, since the whole scene rides along with it.
  private readonly cameraStops = [
    { x: 0, y: 26, z: 260 },
    { x: 0, y: 34, z: -60 },
    { x: 0, y: 42, z: -380 },
  ];

  private readonly router = inject(Router);

  constructor(private hostRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.el = this.hostRef.nativeElement;
    try {
      this.initThree();
      this.animate();
    } catch (err) {
      // WebGL unsupported/context creation failed — the dark background,
      // text and CTAs (plain DOM, not canvas-drawn) still work fine on
      // their own; just skip the 3D scene instead of leaving a broken page.
      console.warn('ScrollHero: WebGL scene failed to initialise, showing static fallback.', err);
    }
    this.playEntrance();

    // Progress is recomputed every animation frame (see animate()) rather
    // than driven off the native 'scroll' event, which can fire in
    // irregular bursts (especially with trackpad momentum) and made the
    // camera chase a stale, jumpy target between events. Reading the live
    // scroll position on every frame ties the motion to the display's
    // refresh rate instead, which is what actually reads as "smooth".
    window.addEventListener('resize', this.onResize);
    this.updateScrollProgress();
  }

  goTrial(): void { this.router.navigate(['/free-trial']); }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.animationId) cancelAnimationFrame(this.animationId);

    this.stars.forEach(s => { s.geometry.dispose(); (s.material as THREE.Material).dispose(); });
    this.mountains.forEach(m => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
    this.clockGroup?.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    this.renderer?.dispose();
  }

  // ── Three.js scene setup ──────────────────────────────────────────────────

  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x03110f, 0.00035);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(this.smoothCameraPos.x, this.smoothCameraPos.y, this.smoothCameraPos.z);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.isMobile, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.55;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Bloom is the single most expensive pass (multiple blur sub-passes at
    // full resolution) — keep it, but noticeably cheaper, on mobile.
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.isMobile ? 0.45 : 0.7,
      0.4,
      0.86,
    );
    this.composer.addPass(bloom);

    this.createStarField();
    this.createClockMotif();
    this.createMountains();
    this.createAtmosphere();
  }

  private createStarField(): void {
    const starCount = this.isMobile ? 700 : 1800;
    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);
      const sizes = new Float32Array(starCount);

      for (let j = 0; j < starCount; j++) {
        const radius = 200 + Math.random() * 800;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        positions[j * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[j * 3 + 2] = radius * Math.cos(phi);

        const color = new THREE.Color();
        const choice = Math.random();
        if (choice < 0.72) color.setHSL(0, 0, 0.85 + Math.random() * 0.15);
        else if (choice < 0.9) color.setHSL(0.45, 0.55, 0.75); // teal-tinted stars
        else color.setHSL(0.09, 0.6, 0.75); // warm accent stars

        colors[j * 3] = color.r;
        colors[j * 3 + 1] = color.g;
        colors[j * 3 + 2] = color.b;
        sizes[j] = Math.random() * 2 + 0.5;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, depth: { value: i } },
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          varying vec3 vColor;
          uniform float time;
          uniform float depth;
          void main() {
            vColor = color;
            vec3 pos = position;
            float angle = time * 0.05 * (1.0 - depth * 0.3);
            mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
            pos.xy = rot * pos.xy;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(vColor, opacity);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const points = new THREE.Points(geometry, material);
      this.scene!.add(points);
      this.stars.push(points);
    }
  }

  /** A glowing "Klockk" clock-face — rim, hour ticks and two hands — in place
   *  of the original demo's nebula (whose radial glow read as a literal sun).
   *  A halo glows *around* the rim rather than filling the disc, so it never
   *  reads as a bright sun/moon core. */
  private createClockMotif(): void {
    const group = new THREE.Group();

    const haloMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color(0x14b8a6) },
        color2: { value: new THREE.Color(0xf59e0b) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float time;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float ring = smoothstep(0.5, 0.78, d) * (1.0 - smoothstep(0.78, 1.0, d));
          vec3 color = mix(color1, color2, sin(time * 0.25) * 0.5 + 0.5);
          gl_FragColor = vec4(color, ring * 0.55);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(new THREE.CircleGeometry(260, 64), haloMat));
    this.clockGlowMat = haloMat;

    const rimMat = new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(new THREE.RingGeometry(196, 204, 64), rimMat));
    group.add(new THREE.Mesh(new THREE.RingGeometry(170, 175, 64), rimMat.clone()));

    const tickMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 12; i++) {
      const major = i % 3 === 0;
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(major ? 5 : 2.4, major ? 20 : 10), tickMat.clone());
      const angle = (i / 12) * Math.PI * 2;
      const r = 182;
      tick.position.set(Math.sin(angle) * r, Math.cos(angle) * r, 1);
      tick.rotation.z = -angle;
      group.add(tick);
    }

    const handMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    const makeHand = (width: number, length: number, angleDeg: number, z: number) => {
      const geo = new THREE.PlaneGeometry(width, length);
      geo.translate(0, length / 2, 0); // pivot at the base, tip extends outward
      const mesh = new THREE.Mesh(geo, handMat.clone());
      mesh.rotation.z = THREE.MathUtils.degToRad(angleDeg);
      mesh.position.z = z;
      return mesh;
    };
    group.add(makeHand(5, 88, 55, 2));    // hour hand — resting near "10"
    group.add(makeHand(3.5, 128, -50, 2.2)); // minute hand — resting near "2"
    group.add(new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff })));

    group.position.set(0, 70, -900);
    this.scene!.add(group);
    this.clockGroup = group;
  }

  private createMountains(): void {
    // Teal "horizon" silhouette layers, in brand shades, instead of the
    // original's navy cosmos palette.
    const layers = [
      { distance: -50, height: 55, color: 0x064e46, opacity: 1 },
      { distance: -100, height: 75, color: 0x0a6b63, opacity: 0.8 },
      { distance: -150, height: 95, color: 0x0d9488, opacity: 0.55 },
      { distance: -200, height: 115, color: 0x14b8a6, opacity: 0.35 },
    ];

    layers.forEach((layer, index) => {
      const points: THREE.Vector2[] = [];
      const segments = 48;
      for (let i = 0; i <= segments; i++) {
        const x = (i / segments - 0.5) * 1000;
        const y = Math.sin(i * 0.1) * layer.height + Math.sin(i * 0.05) * layer.height * 0.5
          + Math.random() * layer.height * 0.2 - 100;
        points.push(new THREE.Vector2(x, y));
      }
      points.push(new THREE.Vector2(5000, -300));
      points.push(new THREE.Vector2(-5000, -300));

      const shape = new THREE.Shape(points);
      const geometry = new THREE.ShapeGeometry(shape);
      const material = new THREE.MeshBasicMaterial({
        color: layer.color, transparent: true, opacity: layer.opacity, side: THREE.DoubleSide,
      });

      const mountain = new THREE.Mesh(geometry, material);
      mountain.position.z = layer.distance;
      mountain.position.y = layer.distance;
      mountain.userData = { baseZ: layer.distance, index };
      this.scene!.add(mountain);
      this.mountains.push(mountain);
    });
  }

  private createAtmosphere(): void {
    const geometry = new THREE.SphereGeometry(600, 32, 32);
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform float time;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          vec3 atmosphere = vec3(0.06, 0.66, 0.60) * intensity; // teal rim glow
          float pulse = sin(time * 2.0) * 0.1 + 0.9;
          atmosphere *= pulse;
          gl_FragColor = vec4(atmosphere, intensity * 0.25);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });

    this.scene!.add(new THREE.Mesh(geometry, material));
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const time = Date.now() * 0.001;

    this.updateScrollProgress();

    this.stars.forEach(s => {
      const mat = s.material as THREE.ShaderMaterial;
      if (mat.uniforms['time']) mat.uniforms['time'].value = time;
    });
    if (this.clockGlowMat?.uniforms['time']) this.clockGlowMat.uniforms['time'].value = time * 0.5;
    if (this.clockGroup && !this.prefersReducedMotion) this.clockGroup.rotation.z = time * 0.02;

    if (this.camera) {
      const smoothing = this.prefersReducedMotion ? 1 : 0.065;
      this.smoothCameraPos.x += (this.target.x - this.smoothCameraPos.x) * smoothing;
      this.smoothCameraPos.y += (this.target.y - this.smoothCameraPos.y) * smoothing;
      this.smoothCameraPos.z += (this.target.z - this.smoothCameraPos.z) * smoothing;

      const floatX = this.prefersReducedMotion ? 0 : Math.sin(time * 0.1) * 2;
      const floatY = this.prefersReducedMotion ? 0 : Math.cos(time * 0.15) * 1;

      this.camera.position.set(
        this.smoothCameraPos.x + floatX,
        this.smoothCameraPos.y + floatY,
        this.smoothCameraPos.z,
      );
      // Aim *relative to the camera's own current position* — reproducing
      // the exact same camera→lookAt offset that framed chapter 1 correctly
      // (confirmed by screenshot) at every scroll position, instead of a
      // fixed world-space point whose relative angle to the camera changes
      // (and can end up aiming at nothing) as the camera moves.
      this.camera.lookAt(
        this.smoothCameraPos.x,
        this.smoothCameraPos.y - 16,
        this.smoothCameraPos.z - 720,
      );
    }

    // Keep the horizon layers and clock motif at a fixed depth *relative to
    // the camera's current position* (not an absolute scroll-progress
    // trajectory) — otherwise, once the camera travels far enough, static
    // "how far it's moved so far" offsets let these objects drift behind the
    // camera and out of frame, which is what left chapters 2/3 looking empty.
    const camZ = this.smoothCameraPos.z;
    this.mountains.forEach((m, i) => {
      m.position.z = camZ - (160 + i * 130);
      if (!this.prefersReducedMotion) {
        const parallax = 1 + i * 0.5;
        m.position.x = Math.sin(time * 0.1) * 2 * parallax;
      }
    });
    if (this.clockGroup) this.clockGroup.position.z = camZ - 650;

    this.composer?.render();
  };

  // ── Scroll-scrubbed chapter progress (scoped to this section only) ──────
  // Called every animation frame, not on the 'scroll' event — see animate().

  private updateScrollProgress = (): void => {
    if (!this.el) return;
    const rect = this.el.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const scrolled = -rect.top;
    const progress = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;

    this.progressPct.set(Math.round(progress * 100));

    // Once progress hits 1, the sticky box starts physically sliding away
    // (releasing) for one more viewport-height of scroll before the next
    // section takes over. Fade the text/hint out over that stretch instead
    // of just letting them slide off through the top of the screen.
    const releaseDistance = window.innerHeight;
    const scrolledPastEnd = Math.max(0, scrolled - total);
    const releaseProgress = releaseDistance > 0 ? Math.min(1, scrolledPastEnd / releaseDistance) : 0;
    this.contentOpacity.set(1 - releaseProgress);

    // Each chapter gets an equal, even share of the scroll (chapters.length
    // and cameraStops.length are both 3, one stop per chapter), rather than
    // splitting camera "segments" and chapter "text" on different divisors.
    const chapterCount = this.chapters.length;
    const totalProgress = progress * chapterCount;
    const idx = Math.min(chapterCount - 1, Math.floor(totalProgress));
    const localT = Math.min(1, totalProgress - idx);

    if (idx !== this.activeChapter()) this.activeChapter.set(idx);

    const a = this.cameraStops[idx];
    const b = this.cameraStops[Math.min(this.cameraStops.length - 1, idx + 1)];
    this.target = {
      x: a.x + (b.x - a.x) * localT,
      y: a.y + (b.y - a.y) * localT,
      z: a.z + (b.z - a.z) * localT,
    };
    // Mountain/clock depth is now kept relative to the camera every frame in
    // animate() — see the comment there.
  };

  private onResize = (): void => {
    if (!this.camera || !this.renderer || !this.composer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  };

  // ── Entrance (GSAP) ───────────────────────────────────────────────────────

  private playEntrance(): void {
    if (this.prefersReducedMotion) return;
    const tl = gsap.timeline();
    if (this.titleEl?.nativeElement) {
      tl.from(this.titleEl.nativeElement.querySelectorAll('.sh-char'), {
        y: 140, opacity: 0, duration: 1.1, stagger: 0.04, ease: 'power4.out',
      });
    }
    if (this.subtitleEl?.nativeElement) {
      tl.from(this.subtitleEl.nativeElement.querySelectorAll('.sh-subline'), {
        y: 30, opacity: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out',
      }, '-=0.6');
    }
    if (this.ctaEl?.nativeElement) {
      tl.from(this.ctaEl.nativeElement.children, {
        y: 20, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out',
      }, '-=0.4');
    }
  }
}
