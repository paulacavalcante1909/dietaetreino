#!/usr/bin/env bash
# Gera avatar, logo e favicons de um tema a partir de uma imagem quadrada.
# Uso: bash deploy/gerar-mascote.sh <tema: coelhinha|onca|rato> <imagem.png> [x y lado do recorte do avatar]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMA=$1; IMG=$(realpath "$2"); X=${3:-}; Y=${4:-}; L=${5:-}
cd "$ROOT/frontend"
cp "$IMG" "src/assets-src/mascote-$TEMA-original.png"
node -e "
const sharp=require('sharp'); const [src,dir,x,y,l]=process.argv.slice(1);
(async()=>{ const m=await sharp(src).metadata(); const side=Math.min(m.width,m.height);
 const L=l?+l:Math.round(side*0.77), X=x?+x:Math.round((m.width-L)/2), Y=y?+y:0; const crop={left:X,top:Y,width:L,height:L};
 for (const f of ['mascote','logo']) await sharp(src).extract(crop).resize(256,256).png({compressionLevel:9}).toFile(dir+'/'+f+'.png');
 const sq=sharp(src).extract({left:Math.round((m.width-side)/2),top:Math.round((m.height-side)/2),width:side,height:side});
 await sq.clone().resize(64,64).png().toFile(dir+'/favicon.png');
 await sq.clone().resize(32,32).png().toFile(dir+'/favicon-32.png');
 await sq.clone().resize(180,180).png().toFile(dir+'/apple-touch-icon.png');
 console.log('ok: '+dir); })();" "src/assets-src/mascote-$TEMA-original.png" "public/themes/$TEMA" $X $Y $L
