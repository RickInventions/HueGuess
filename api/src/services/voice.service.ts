import { v2 as cloudinary } from 'cloudinary';

/**
 * Voice notes.
 *
 * Cloudinary holds the audio; nothing about it is stored in Postgres. That is a
 * deliberate match to how rooms work — a room is a `Map` entry in this process
 * and there is no `rooms` table, so a database row for a voice note would
 * outlive the only thing that gives it meaning.
 *
 * The consequence is that the room map is the sole record that an upload
 * happened, and a crash or a redeploy destroys that map. Hence `sweepOrphans`:
 * anything tagged as a voice note and older than a day is unreachable by
 * definition, because no room survives that long.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

/** Every upload carries this, so the sweep can find them without a folder walk. */
const TAG = 'hueguess_voice';

/** Nothing that reaches Cloudinary is older than a round of Challenge mode. */
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

const configured = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (configured) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
}

/** Cloudinary tags reject most punctuation; room codes are A–Z0–9 but be sure. */
function roomTag(roomCode: string): string {
  return `room_${roomCode.replace(/[^A-Za-z0-9]/g, '')}`;
}

export class VoiceService {
  /** False when the env vars are absent — callers should 503 rather than crash. */
  static get isConfigured(): boolean {
    return configured;
  }

  /**
   * Uploads one recording and returns its delivery URL.
   *
   * `resource_type: 'video'` is not a mistake — Cloudinary has no separate audio
   * bucket, and audio-only files belong to the video type. Uploading them as
   * `raw` would work for storage but lose transcoding and duration metadata.
   */
  static async upload(
    buffer: Buffer,
    roomCode: string
  ): Promise<{ url: string; publicId: string }> {
    if (!configured) throw new Error('Cloudinary is not configured');

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: `hueguess/voice/${roomCode}`,
          tags: [TAG, roomTag(roomCode)],
          // Transcode to mp3 before the URL is handed out, and wait for it.
          //
          // What arrives here is whatever the *sender's* browser can record:
          // Chrome and Firefox produce WebM/Opus, which Safari and every browser
          // on iOS refuse to decode. Serving the original meant a note played
          // fine for half the room and read "Audio unavailable" for the rest —
          // mp3 plays everywhere, and a ten-second clip converts in well under
          // the time the upload itself takes.
          eager: [{ format: 'mp3' }],
          eager_async: false,
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Upload returned no result'));
            return;
          }
          // Fall back to the original if the derivation is missing for any
          // reason: a note most of the room can play beats no note at all.
          const derived = (result.eager as { secure_url?: string }[] | undefined)?.[0]?.secure_url;
          resolve({ url: derived ?? result.secure_url, publicId: result.public_id });
        }
      );

      stream.end(buffer);
    });
  }

  /**
   * Deletes every recording made in one room.
   *
   * Called when the room is torn down. Deliberately swallows its own errors: the
   * caller is the room-deletion path, and a Cloudinary hiccup must not stop a
   * room from closing. `sweepOrphans` is the backstop for whatever this misses.
   */
  static async deleteRoom(roomCode: string): Promise<void> {
    if (!configured) return;

    try {
      await cloudinary.api.delete_resources_by_tag(roomTag(roomCode), {
        resource_type: 'video',
      });
      // Folders are not removed by deleting their contents, and an empty folder
      // per room played would accumulate forever.
      await cloudinary.api.delete_folder(`hueguess/voice/${roomCode}`).catch(() => {});
    } catch (error) {
      console.error(`⚠️  Voice cleanup failed for room ${roomCode}:`, (error as Error).message);
    }
  }

  /**
   * Deletes voice notes whose room no longer exists.
   *
   * Run at boot. The room map lives in memory, so a restart orphans every file
   * from every room that was open at the time — without this they are billable
   * storage that nothing can ever reach again.
   */
  static async sweepOrphans(): Promise<number> {
    if (!configured) return 0;

    const cutoff = Date.now() - ORPHAN_AGE_MS;
    let deleted = 0;
    let nextCursor: string | undefined;

    do {
      const page = await cloudinary.api.resources_by_tag(TAG, {
        resource_type: 'video',
        max_results: 500,
        next_cursor: nextCursor,
      });

      const stale = (page.resources ?? [])
        .filter((r: { created_at: string }) => new Date(r.created_at).getTime() < cutoff)
        .map((r: { public_id: string }) => r.public_id);

      if (stale.length > 0) {
        await cloudinary.api.delete_resources(stale, { resource_type: 'video' });
        deleted += stale.length;
      }

      nextCursor = page.next_cursor;
    } while (nextCursor);

    return deleted;
  }
}
