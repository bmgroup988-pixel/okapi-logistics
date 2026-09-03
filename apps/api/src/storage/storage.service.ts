import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.schema';
import { presignS3Url } from './sigv4';

/**
 * Stockage objet S3-compatible (OVHcloud Object Storage en prod, MinIO en dev).
 * L'API ne relaie jamais le binaire : upload par URL PUT signée, lecture par URL
 * GET signée à durée limitée — ENF-SEC-08, EF-SUI-03.
 */
@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private opts() {
    return {
      endpoint: this.config.get('S3_ENDPOINT', { infer: true }).replace(/\/+$/, ''),
      region: this.config.get('S3_REGION', { infer: true }),
      bucket: this.config.get('S3_BUCKET', { infer: true }),
      accessKey: this.config.get('S3_ACCESS_KEY', { infer: true }),
      secretKey: this.config.get('S3_SECRET_KEY', { infer: true }),
      forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE', { infer: true }) as unknown as boolean,
    };
  }

  /** Clé d'objet pour la photo d'un colis. */
  buildPhotoKey(parcelId: string, ext = 'jpg'): string {
    return `parcels/${parcelId}/photos/${randomUUID()}.${ext}`;
  }

  presignPut(key: string, ttlSeconds?: number): { url: string; key: string; expiresIn: number } {
    const o = this.opts();
    const expiresIn = ttlSeconds ?? 600;
    return {
      url: presignS3Url({ method: 'PUT', key, expiresSeconds: expiresIn, ...o }),
      key,
      expiresIn,
    };
  }

  /** Dépose un objet côté serveur via l'URL PUT signée (documents PDF générés). */
  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const { url } = this.presignPut(key, 300);
    const res = await fetch(url, {
      method: 'PUT',
      body: Buffer.from(body),
      headers: { 'content-type': contentType },
    });
    if (!res.ok) {
      throw new Error(`Échec de l'upload objet (${res.status} ${res.statusText})`);
    }
  }

  presignGet(key: string, scope: 'internal' | 'client' = 'internal'): { url: string; expiresIn: number } {
    const o = this.opts();
    const expiresIn =
      scope === 'client'
        ? Number(this.config.get('S3_CLIENT_URL_TTL_SECONDS', { infer: true }))
        : Number(this.config.get('S3_PUBLIC_URL_TTL_SECONDS', { infer: true }));
    return {
      url: presignS3Url({ method: 'GET', key, expiresSeconds: expiresIn, ...o }),
      expiresIn,
    };
  }
}
