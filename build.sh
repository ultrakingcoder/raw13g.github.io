#!/bin/bash
set -e

# Download and extract base ps4-hen template via curl if kpayload doesn't exist
if [ ! -d "kpayload" ]; then
    echo "Downloading base ps4-hen template..."
    curl -fLJO https://github.com/Scene-Collective/ps4-hen/archive/refs/heads/main.zip
    unzip -o main.zip
    cp -r ps4-hen-main/. .
    rm -rf ps4-hen-main main.zip
fi

# Build kernel payload first so kpayload.inc.c is generated
cd kpayload
make clean || true
make
cd ..

mkdir -p installer/source
mkdir -p plugins

if [ ! -f "plugins.zip" ]; then
    curl -fLJO https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/plugins.zip
fi

unzip -o plugins.zip -d plugins/ || true
find . -maxdepth 2 -name "*.prx" -exec cp -n {} plugins/ \;

cd plugins
for file in *.prx; do
    if [ -f "$file" ]; then
        echo "${file}"
        xxd -i "$file" | sed 's/^unsigned /static const unsigned /' > "../installer/source/${file%.prx}_prx.inc.c"
    fi
done
cd ..

# Process configuration ini if present, otherwise create a valid empty fallback
if [ -f "hen.ini" ]; then
    xxd -i "hen.ini" | sed 's/^unsigned /static const unsigned /' > "installer/source/hen.ini.inc.c"
else
    echo "static const unsigned char hen_ini[] = {};" > "installer/source/hen.ini.inc.c"
    echo "static unsigned int hen_ini_len = 0;" >> "installer/source/hen.ini.inc.c"
fi

cd installer
make clean || true
make
cd ..

cp installer/installer.bin Rev3rseApex.bin
