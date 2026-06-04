/**
 * useLiveLessonTranscript
 *
 * Captures local microphone audio in 8-second chunks while a Jitsi call is
 * running, sends each chunk to the `transcribe-lesson-chunk` edge function,
 * and appends the returned partial transcript to live captions.
 *
 * On stop(), it also concatenates all chunks into a single Blob and uploads
 * it to the `lesson-audio` storage bucket, then triggers
 * `process-lesson-recording` so notes + StudyMode reinforcement run.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseLiveLessonTranscriptOptions {
  bookingId?: string;
  tutorId?: string;
  learnerId?: string;
  enabled: boolean;
}

const CHUNK_MS = 8000;

export function useLiveLessonTranscript({
  bookingId, tutorId, learnerId, enabled,
}: UseLiveLessonTranscriptOptions) {
  const [caption, setCaption] = useState("");
  const [fullTranscript, setFullTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const liveChunkRef = useRef<Blob[]>([]);
  const sliceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = r.result as string;
      resolve(s.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  const sendLiveChunk = useCallback(async () => {
    if (!liveChunkRef.current.length) return;
    const chunk = new Blob(liveChunkRef.current, { type: "audio/webm" });
    liveChunkRef.current = [];
    try {
      const b64 = await blobToBase64(chunk);
      const { data, error } = await supabase.functions.invoke("transcribe-lesson-chunk", {
        body: { audio_base64: b64, mime_type: "audio/webm" },
      });
      if (error || !data?.text) return;
      setCaption(data.text);
      setFullTranscript((prev) => (prev ? `${prev} ${data.text}` : data.text));
    } catch (e) {
      console.error("[live transcript] chunk failed", e);
    }
  }, []);

  const start = useCallback(async () => {
    if (!enabled || recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const rec = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
      });
      recorderRef.current = rec;
      chunksRef.current = [];
      liveChunkRef.current = [];

      rec.ondataavailable = (ev) => {
        if (!ev.data || ev.data.size === 0) return;
        chunksRef.current.push(ev.data);
        liveChunkRef.current.push(ev.data);
      };

      rec.start(2000); // emit data every 2s
      sliceTimerRef.current = setInterval(sendLiveChunk, CHUNK_MS);
      setIsRecording(true);
    } catch (e) {
      console.error("[live transcript] start failed", e);
    }
  }, [enabled, sendLiveChunk]);

  const stop = useCallback(async () => {
    if (!recorderRef.current) return;
    const rec = recorderRef.current;

    await new Promise<void>((resolve) => {
      rec.addEventListener("stop", () => resolve(), { once: true });
      rec.stop();
    });

    if (sliceTimerRef.current) { clearInterval(sliceTimerRef.current); sliceTimerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);

    // Flush any remaining live chunk
    await sendLiveChunk();

    if (!bookingId || !tutorId || !learnerId || !chunksRef.current.length) return;

    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const path = `${bookingId}/${Date.now()}.webm`;
      const up = await supabase.storage.from("lesson-audio").upload(path, blob, {
        contentType: "audio/webm",
        upsert: false,
      });
      if (up.error) throw up.error;

      const { data: recording, error: insErr } = await supabase
        .from("lesson_recordings")
        .insert({
          booking_id: bookingId,
          tutor_id: tutorId,
          learner_id: learnerId,
          storage_path: path,
          status: "uploaded",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Fire-and-forget — pipeline runs in background.
      supabase.functions.invoke("process-lesson-recording", {
        body: { recording_id: recording.id },
      }).catch((e) => console.error("[live transcript] processing trigger failed", e));
    } catch (e) {
      console.error("[live transcript] upload failed", e);
    }
  }, [bookingId, tutorId, learnerId, sendLiveChunk]);

  useEffect(() => () => { stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { caption, fullTranscript, isRecording, start, stop };
}
