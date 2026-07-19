import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiToastContainerComponent, OfflineModalComponent } from './shared/components';
import { UpgradePromptComponent } from './shared/components/upgrade-prompt/upgrade-prompt.component';
import { MobileBridgeService } from './core/services/mobile-bridge.service';
import { RouterHistoryService } from './core/services/router-history.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiToastContainerComponent, UpgradePromptComponent, OfflineModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'klock';

  // Attach the RN WebView bridge listeners once for the whole app (no-op on web).
  private readonly bridge = inject(MobileBridgeService);
  // Instantiate early so it's already tracking navigations before any page needs it.
  private readonly routerHistory = inject(RouterHistoryService);
  constructor() { this.bridge.init(); }
}
