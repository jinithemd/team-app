#!/usr/bin/env bash
# Usage: put shot01.mp4 ... shot11.mp4 (shot09 = 9a+9b joined, or shot09a/shot09b) in clips/, then run:
#   ./assemble.sh narration.mp3
# Trims each clip to its slot, crops/scales to 1080x1920, applies vintage grade + grain, lays the narration on top.
set -euo pipefail
AUDIO="${1:?narration mp3}"; cd "$(dirname "$0")"; mkdir -p work
DURS=(4.9 2.6 3.5 1.5 2.4 5.2 4.4 2.5 8.2 5.0 4.2)
LOOK="scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=24,\
colorbalance=rs=.06:gs=.02:bs=-.08:rm=.05:bm=-.06,eq=saturation=0.62:contrast=1.08:gamma=1.04,\
curves=all='0/0.06 1/0.94',noise=alls=14:allf=t,vignette=PI/5"
: > work/list.txt
for i in $(seq 1 11); do
  n=$(printf %02d "$i"); src="clips/shot$n.mp4"
  if [ "$i" = 9 ] && [ ! -f "$src" ]; then
    ffmpeg -y -loglevel error -i clips/shot09a.mp4 -i clips/shot09b.mp4 -filter_complex \
      "[0:v]trim=0:4.0,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=24[a];\
       [1:v]trim=0:4.2,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=24[b];[a][b]concat=n=2:v=1[v]" \
      -map "[v]" -an work/shot09_joined.mp4; src=work/shot09_joined.mp4
  fi
  d=${DURS[$((i-1))]}
  ffmpeg -y -loglevel error -i "$src" -t "$d" -vf "$LOOK,setpts=PTS-STARTPTS" -an \
    -c:v libx264 -crf 18 -pix_fmt yuv420p "work/s$n.mp4"
  echo "file 's$n.mp4'" >> work/list.txt
done
ffmpeg -y -loglevel error -f concat -safe 0 -i work/list.txt -c copy work/video.mp4
ffmpeg -y -loglevel error -i work/video.mp4 -i "$AUDIO" -map 0:v -map 1:a \
  -vf "fade=t=in:st=0:d=0.6,fade=t=out:st=43.2:d=1.2" -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest emu_war_reel.mp4
echo "Done -> $(pwd)/emu_war_reel.mp4"
