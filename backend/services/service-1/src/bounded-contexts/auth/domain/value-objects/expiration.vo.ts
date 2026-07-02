import { DateVO } from '@libs/nestjs-common';

export class Expiration extends DateVO {
  constructor(value: Date) {
    super(value);
  }

  static atHoursFromNow(hours: number): Expiration {
    return new Expiration(DateVO.dateVOAtHoursFromNow(hours).toValue());
  }

  static atMinutesFromNow(minutes: number): Expiration {
    return new Expiration(DateVO.dateVOAtMinutesFromNow(minutes).toValue());
  }

  static atSecondsFromNow(seconds: number): Expiration {
    return new Expiration(DateVO.dateVOAtSecondsFromNow(seconds).toValue());
  }

  static atDaysFromNow(days: number): Expiration {
    return new Expiration(DateVO.dateVOAtDaysFromNow(days).toValue());
  }

  isExpired(): boolean {
    return this.isPast();
  }
}
