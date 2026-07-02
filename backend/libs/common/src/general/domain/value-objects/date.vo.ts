import { ValueObject } from './base.vo';

export class DateVO extends ValueObject<Date> {
  private static readonly SECOND_MS = 1000;
  private static readonly MINUTE_MS = 60 * DateVO.SECOND_MS;
  private static readonly HOUR_MS = 60 * DateVO.MINUTE_MS;
  private static readonly DAY_MS = 24 * DateVO.HOUR_MS;

  constructor(value: Date | string | number) {
    super(value instanceof Date ? value : new Date(value));
  }

  validate(): void {
    super.validate();
  }

  static none(): DateVO {
    return new DateVO(new Date(0));
  }

  isNone(): boolean {
    return this.toValue().getTime() === 0;
  }

  hasValue(): boolean {
    return !this.isNone();
  }

  static now(): DateVO {
    return new DateVO(new Date());
  }

  static random(): DateVO {
    // Generate a random date between 2 years ago and now
    const now = Date.now();
    const twoYearsAgo = now - 2 * 365 * DateVO.DAY_MS;
    const randomTime = twoYearsAgo + Math.random() * (now - twoYearsAgo);
    return new DateVO(new Date(randomTime));
  }

  static dateVOAtDaysFromNow(days: number): DateVO {
    const date = new Date();
    date.setTime(date.getTime() + days * DateVO.DAY_MS);
    return new DateVO(date);
  }

  static dateVOAtHoursFromNow(hours: number): DateVO {
    const date = new Date();
    date.setTime(date.getTime() + hours * DateVO.HOUR_MS);
    return new DateVO(date);
  }

  static dateVOAtMinutesFromNow(minutes: number): DateVO {
    const date = new Date();
    date.setTime(date.getTime() + minutes * DateVO.MINUTE_MS);
    return new DateVO(date);
  }

  static dateVOAtSecondsFromNow(seconds: number): DateVO {
    const date = new Date();
    date.setTime(date.getTime() + seconds * DateVO.SECOND_MS);
    return new DateVO(date);
  }

  hoursFromNow(): number {
    return (this.toValue().getTime() - new Date().getTime()) / DateVO.HOUR_MS;
  }

  minutesFromNow(): number {
    return (this.toValue().getTime() - new Date().getTime()) / DateVO.MINUTE_MS;
  }

  secondsFromNow(): number {
    return (this.toValue().getTime() - new Date().getTime()) / DateVO.SECOND_MS;
  }

  daysFromNow(): number {
    return (this.toValue().getTime() - new Date().getTime()) / DateVO.DAY_MS;
  }

  isPast(): boolean {
    return this.toValue() < new Date();
  }

  isFuture(): boolean {
    return this.toValue() > new Date();
  }

  isBefore(other: DateVO): boolean {
    return this.toValue() < other.toValue();
  }

  isBeforeOrEqual(other: DateVO): boolean {
    return this.toValue() <= other.toValue();
  }

  isAfter(other: DateVO): boolean {
    return this.toValue() > other.toValue();
  }

  isAfterOrEqual(other: DateVO): boolean {
    return this.toValue() >= other.toValue();
  }

  equals(other: DateVO): boolean {
    return this.toValue().getTime() === other.toValue().getTime();
  }

  isToday(): boolean {
    const today = new Date();
    const thisDate = this.toValue();
    return (
      thisDate.getFullYear() === today.getFullYear() &&
      thisDate.getMonth() === today.getMonth() &&
      thisDate.getDate() === today.getDate()
    );
  }

  isTodayUtc(): boolean {
    const thisDate = this.toValue();
    const now = new Date();
    return (
      thisDate.getUTCFullYear() === now.getUTCFullYear() &&
      thisDate.getUTCMonth() === now.getUTCMonth() &&
      thisDate.getUTCDate() === now.getUTCDate()
    );
  }

  diffInMilliseconds(other: Date): number {
    return Math.abs(this.toValue().getTime() - other.getTime());
  }

  diffInSeconds(other: Date): number {
    return Math.floor(this.diffInMilliseconds(other) / DateVO.SECOND_MS);
  }

  diffInMinutes(other: Date): number {
    return Math.floor(this.diffInMilliseconds(other) / DateVO.MINUTE_MS);
  }

  diffInHours(other: Date): number {
    return Math.floor(this.diffInMilliseconds(other) / DateVO.HOUR_MS);
  }

  diffInDays(other: Date): number {
    return Math.floor(this.diffInMilliseconds(other) / DateVO.DAY_MS);
  }

  isWithinTolerance(expected: Date, toleranceMs: number): boolean {
    return this.diffInMilliseconds(expected) <= toleranceMs;
  }

  getTime(): number {
    return this.toValue().getTime();
  }
}
