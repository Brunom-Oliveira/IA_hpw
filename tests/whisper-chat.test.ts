import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "events";

const { readFileMock, unlinkMock, spawnMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  unlinkMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock("fs", () => ({
  promises: {
    readFile: readFileMock,
    unlink: unlinkMock,
  },
}));

vi.mock("child_process", () => ({
  spawn: spawnMock,
}));

import { WhisperService } from "../src/services/whisper/whisperService";

describe("WhisperService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("transcreve e limpa o arquivo temporario de saida", async () => {
    const child = new EventEmitter() as EventEmitter & { on: any };
    spawnMock.mockReturnValue(child);
    readFileMock.mockResolvedValue("texto transcrito\n");
    unlinkMock.mockResolvedValue(undefined);

    const service = new WhisperService();
    const transcriptionPromise = service.transcribe("uploads/audio.wav");

    child.emit("close", 0);

    await expect(transcriptionPromise).resolves.toBe("texto transcrito");
    expect(spawnMock).toHaveBeenCalledOnce();
    expect(readFileMock).toHaveBeenCalledWith(expect.stringContaining("audio_transcript.txt"), "utf-8");
    expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining("audio_transcript.txt"));
  });

  it("propaga erro quando o processo Whisper falha", async () => {
    const child = new EventEmitter() as EventEmitter & { on: any };
    spawnMock.mockReturnValue(child);

    const service = new WhisperService();
    const transcriptionPromise = service.transcribe("uploads/audio.wav");

    child.emit("close", 127);

    await expect(transcriptionPromise).rejects.toThrow("Whisper finalizou com codigo 127");
  });
});
