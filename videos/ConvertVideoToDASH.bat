chcp 65001
set filename=%~1
:: Extract the filename without the extension
for %%F in ("%filename%") do set basename=%%~nF

chcp 65001
@echo off 
cls 
 
if not exist %basename% ( 
mkdir %basename%
echo Folder created.
 ) else ( 
echo Folder already exists! 
) 


.\ffmpeg -i %filename% ^
 -c:v libx264 ^
 -c:a aac -b:a 128k ^
 -bf 1 -b_strategy 0 -sc_threshold 0 -pix_fmt yuv420p -preset faster -threads 3 ^
 -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 ^
 -b:v:0 300k  -s:v:0 720x480 -profile:v:0 baseline ^
 -b:v:1 700k  -s:v:1 1080x720 -profile:v:1 main ^
 -b:v:2 1300k -s:v:2 1920x1080 -profile:v:2 high ^
 -b:v:3 2500k ^
 -f mpegts - | ^
.\ffmpeg -f mpegts -i - ^
 -map 0 ^
 -use_timeline 1 -use_template 1 -adaptation_sets "id=0,streams=v id=1,streams=a" ^
 -f dash "%basename%/init.mpd"

:: ./ConvertVideoToDASH.bat test.mp4