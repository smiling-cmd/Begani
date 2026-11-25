# Starter audio for the Resources library

Compact copies (64 kbps mono for nature sounds and voice, 96 kbps stereo for music) of the audio used by
`python manage.py seed_audio`. They live here, not in `frontend/src/assets`, so they are not bundled into the website.

To add more audio: drop the file in this folder, add a line to `CATALOG` in
`resources/management/commands/seed_audio.py`, and run the command again.
Check each file's licence (Mixkit, Pixabay and the breathing-meditation authors have their own terms) and keep credits.
