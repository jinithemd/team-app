#!/usr/bin/env bash
# mixes user narration + sound bed into the rendered video
set -e; cd "$(dirname "$0")"; D=63.5
ffmpeg -loglevel error -y \
 -f lavfi -i "anoisesrc=d=$D:c=brown:a=0.5:r=44100" \
 -f lavfi -i "anoisesrc=d=$D:c=pink:a=0.6:r=44100" \
 -f lavfi -i "aevalsrc='0.9*sin(2*PI*(55-25*t)*t)*exp(-3*t)':d=2:s=44100" \
 -f lavfi -i "aevalsrc='0.8*sin(2*PI*90*t)*exp(-14*t)':d=0.6:s=44100" \
 -f lavfi -i "aevalsrc='0.6*sin(2*PI*900*t)*exp(-30*t)+0.4*sin(2*PI*1400*t)*exp(-40*t)':d=0.4:s=44100" \
 -i user_vo/narration_user.mp3 \
 -f lavfi -i "aevalsrc='0.5*sin(2*PI*2200*t)*exp(-9*t)+0.4*sin(2*PI*3300*t)*exp(-12*t)+0.25*sin(2*PI*5100*t)*exp(-15*t)':d=1.2:s=44100" \
 -filter_complex "\
[0]lowpass=f=120,volume=0.3[drone];\
[1]bandpass=f=900:width_type=o:w=2,volume='if(between(t,0,3.8)+between(t,22.0,36.48)+between(t,47.27,54.6),0.32,0)':eval=frame[rush];\
[2]asplit=2[b1][b2];[b1]adelay=22000|22000,volume=0.8[boom];[b2]adelay=25700|25700,volume=0.4[boom2];\
[3]asplit=2[t1][t2];[t1]adelay=4800|4800,volume=0.7[th1];[t2]adelay=44810|44810,volume=0.7[th2];\
[4]adelay=19710|19710,volume=0.7[snap];\
[6]adelay=60790|60790,volume=0.9[clink];\
[drone][rush][boom][boom2][th1][th2][snap][clink]amix=inputs=8:normalize=0,volume=0.5[bed];\
[5]apad[vo];[vo][bed]amix=inputs=2:duration=longest:normalize=0,atrim=0:$D,afade=t=out:st=62.6:d=0.9,loudnorm=I=-14:TP=-1.0:LRA=11[out]" \
 -map "[out]" -ac 2 -ar 48000 -c:a aac -b:a 192k mix_user.m4a
ffmpeg -loglevel error -y -i beer_flood_v3_noaudio.mp4 -i mix_user.m4a -map 0:v -map 1:a -c:v copy -c:a copy -shortest -movflags +faststart BEER_FLOOD_YOUR_VOICE.mp4
