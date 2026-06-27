import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiToastContainerComponent } from './shared/components';
import { MobileBridgeService } from './core/services/mobile-bridge.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'klock';

  // Attach the RN WebView bridge listeners once for the whole app (no-op on web).
  private readonly bridge = inject(MobileBridgeService);
  constructor() { this.bridge.init(); }
}
