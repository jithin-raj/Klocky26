import { Component, Input } from '@angular/core';

/**
 * Clock-Out icon — stopwatch body with stop square, indicating session end.
 */
@Component({
  selector: 'icon-clock-out',
  standalone: true,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      [attr.fill]="color"
      aria-hidden="true"
    >
      <!-- Crown stem -->
      <rect x="10.25" y="1" width="3.5" height="3" rx="1"/>
      <!-- Stopwatch body ring (outer − inner via evenodd) -->
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M12 5.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zm0 1.75a6.75 6.75 0 1 1 0 13.5 6.75 6.75 0 0 1 0-13.5z"
      />
      <!-- Stop square -->
      <rect x="9.25" y="11.5" width="5.5" height="5.5" rx="0.75"/>
    </svg>
  `,
})
export class IconClockOutComponent {
  @Input() color = 'currentColor';
  @Input() size: number | string = 20;
}
