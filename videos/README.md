# Videos the agent can watch

Drop video files here and the agent can analyse them with `analyze_video`.
Nothing in this folder is committed: videos are large and usually private.

```bash
cp ~/Videoklipp/Skjermopptak/*.mp4 videos/
```

Supported: `.mp4`, `.m4v`, `.mov`, `.mkv`, `.webm`, `.avi`, `.mpg`, `.mpeg`,
`.ts`, `.mts`, `.m2ts`, `.3gp`, `.ogv`.

How it works:

1. `list_videos` shows what is in this folder.
2. `analyze_video` runs `ffprobe` for duration, codecs and resolution, then
   `ffmpeg` to grab evenly spaced stills (default 8, max 16, 1024 px wide).
3. The stills are sent to the configured vision model together with their
   timestamps, so the agent can say what happens and when.
4. The stills are also copied to `/workspace/videos/frames/<name>/` inside the
   sandbox, so they can be opened or bundled into an artifact.

Requirements:

- `ffmpeg` and `ffprobe` on the server (`sudo apt install ffmpeg`).
- A vision-capable model on the same OpenAI-compatible endpoint as the agent.
  Override with `VIDEO_VISION_MODEL`, `VIDEO_VISION_BASE_URL` and
  `VIDEO_VISION_API_KEY` if you want a separate model for images.

Override the folder with `EVE_VIDEOS_DIR=/some/other/path`.
