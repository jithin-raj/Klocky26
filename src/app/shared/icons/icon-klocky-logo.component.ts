import { Component, Input } from '@angular/core';

export type KlockyLogoBg = 'none' | 'circle' | 'square';

@Component({
  selector: 'icon-klocky-logo',
  standalone: true,
  imports: [],
  template: `
    <img
      src="logo.png"
      alt="Klockk"
      [style.width.px]="px"
      [style.height.px]="px"
      style="display:block;flex-shrink:0;object-fit:contain"
    />
  `,
})
export class IconKlockyLogoComponent {
  @Input() size: number | string = 40;
  /** bg kept for API compatibility */
  @Input() bg: KlockyLogoBg = 'none';

  get px(): number {
    return typeof this.size === 'number' ? this.size : parseInt(this.size as string, 10);
  }
}

