import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { join, resolve } from 'path';
import { PrismaService } from '../../prisma/prisma.service';

const UPLOAD_DIR = resolve(process.cwd(), 'uploads', 'recordings');

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

@Injectable()
export class RecordingsService {
  constructor(private readonly prisma: PrismaService) {}

  findByInterview(interviewId: string) {
    return this.prisma.recording.findUnique({ where: { interviewId } });
  }

  async upload(
    interviewId: string,
    payload: { data: string; mimeType: string; duration: number },
  ) {
    const buffer = Buffer.from(payload.data, 'base64');
    // MediaRecorder reports types like "audio/webm;codecs=opus"; strip the codec
    // parameter so the extension lookup matches (otherwise everything fell to .bin).
    const baseMime = payload.mimeType.split(';')[0].trim() || 'audio/webm';
    const ext = EXTENSIONS[baseMime] ?? 'bin';
    const filename = `${interviewId}.${ext}`;
    // Store the key with POSIX separators so it resolves regardless of the OS that
    // wrote it. path.join() would bake in a backslash on Windows, which is a literal
    // filename character on Linux and breaks the download path.
    const storageKey = `recordings/${filename}`;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(join(UPLOAD_DIR, filename), buffer);

    return this.prisma.recording.upsert({
      where: { interviewId },
      create: {
        interviewId,
        storageKey,
        duration: payload.duration,
        sizeBytes: buffer.byteLength,
        mimeType: baseMime,
      },
      update: {
        storageKey,
        duration: payload.duration,
        sizeBytes: buffer.byteLength,
        mimeType: baseMime,
      },
    });
  }

  async getDownloadStream(interviewId: string) {
    const recording = await this.findByInterview(interviewId);
    if (!recording) throw new NotFoundException('Recording not found');

    // Normalize any Windows backslashes baked into older keys so they resolve on
    // any platform.
    const relativePath = recording.storageKey.replace(/\\/g, '/');
    const absolutePath = resolve(process.cwd(), 'uploads', relativePath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException('Recording file is missing from storage');
    }

    return { recording, stream: createReadStream(absolutePath) };
  }
}
