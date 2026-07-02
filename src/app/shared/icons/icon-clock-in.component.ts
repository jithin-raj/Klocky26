import { Component, Input } from '@angular/core';

/**
 * Clock-In icon — stopwatch body with play triangle, indicating session start.
 */
@Component({
  selector: 'icon-clock-in',
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
      <!-- Play triangle -->
      <path d="M10.25 10.75v6.5l5.75-3.25-5.75-3.25z"/>
    </svg>
  `,
})
export class IconClockInComponent {
  @Input() color = 'currentColor';
  @Input() size: number | string = 20;
}
