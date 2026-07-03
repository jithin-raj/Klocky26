import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import { Holiday, TimeOverview, UpcomingEventItem } from '../models/time-management.model';

@Injectable({ providedIn: 'root' })
export class TimeManagementService {

  private readonly api = inject(ApiService);

  getOverview(): Observable<TimeOverview> {
    return this.api.get<ApiResponse<TimeOverview>>('/time-management/overview')
      .pipe(map(res => res.data));
  }

  getHolidays(year?: number): Observable<Holiday[]> {
    return this.api.get<ApiResponse<Holiday[]>>('/holidays', year != null ? { year } : undefined)
      .pipe(map(res => res.data ?? []));
  }

  getUpcomingEvents(days = 30): Observable<UpcomingEventItem[]> {
    return this.api.get<ApiResponse<UpcomingEventItem[]>>('/time-management/events', { days })
      .pipe(map(res => res.data ?? []));
  }
}
