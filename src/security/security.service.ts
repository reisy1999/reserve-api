import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

@Injectable()
export class SecurityService {
  private readonly pepper: string;

  constructor() {
    const pepperEnv = process.env.SECURITY_PIN_PEPPER ?? '';
    try {
      this.pepper = pepperEnv
        ? Buffer.from(pepperEnv, 'base64').toString('utf8')
        : '';
    } catch {
      this.pepper = pepperEnv;
    }
  }

  private get argonOptions(): argon2.Options & { raw?: false } {
    return {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 64 * 1024,
      parallelism: 1,
    };
  }

  async hash(value: string): Promise<string> {
    return argon2.hash(value + this.pepper, this.argonOptions);
  }

  async verify(value: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, value + this.pepper, this.argonOptions);
    } catch {
      return false;
    }
  }
}
