#!/bin/bash
set -e

if [ ! -d "kpayload" ]; then
    curl -fL -o main.zip https://github.com/Scene-Collective/ps4-hen/archive/refs/heads/main.zip
    unzip -o main.zip
    cp -r ps4-hen-main/. .
    rm -rf ps4-hen-main main.zip
fi

cd kpayload && make clean && make && cd ..

mkdir -p installer/source plugins

curl -fL -o plugins.zip https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/plugins.zip
unzip -o plugins.zip -d plugins/ || true
find . -maxdepth 2 -name "*.prx" -exec cp -n {} plugins/ \;

for file in plugins/*.prx; do
    [ -f "$file" ] && xxd -i "$file" | sed 's/^unsigned /static const unsigned /' > "installer/source/$(basename "$file" .prx)_prx.inc.c"
done

if [ -f "hen.ini" ]; then
    xxd -i "hen.ini" | sed 's/^unsigned /static const unsigned /' > "installer/source/hen.ini.inc.c"
else
    printf "static const unsigned char hen_ini[] = {};\nstatic unsigned int hen_ini_len = 0;\n" > "installer/source/hen.ini.inc.c"
fi

cd installer && make clean && make && cd ..

cp installer/installer.bin Rev3rseApex.bin
echo "Build successful!"
