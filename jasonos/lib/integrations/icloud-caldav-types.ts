export interface ICloudCalendar {
  href: string;
  name: string;
  ctag?: string;
}

export interface ICloudCalDavEvent {
  href: string;
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export interface ICloudCredentials {
  appleId: string;
  appPassword: string;
}
